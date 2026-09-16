# -*- coding: utf-8 -*-
"""
Consolida os dados do Painel de Indicadores de Mortalidade (2019 a 2025):

  1. DADOS  - uma entrada por maternidade (117 CNES) com os blocos de mortalidade materna,
              fetal, perinatal e neonatal recalculados do SIM/DATASUS
              (../Pipeline_Python/indicadores_recalculados.csv, formato long) e os
              metadados da unidade: nome, UF, região, território (município, região de saúde,
              macrorregião), coordenadas e grupo (lista oficial de 09/09/2026).
  2. GEO    - malhas compactadas (UF / macrorregião / região de saúde) - lidas do painel NV
              (somente leitura; o repositório do painel NV não é alterado).
  3. PONTOS - estabelecimentos de contexto do mapa de unidades (>=480 partos/ano, SIH/AIH 2025),
              também lidos do painel NV.
  4. cnes_dados.json - ficha CNES + habilitações: copiadas do painel NV para as unidades em
              comum e buscadas na API oficial para as demais (ou rode atualizar_cnes.py).

Saída: dados_mortalidade.js (const GEO / DADOS / PONTOS) e cnes_dados.json.
Uso:   py build_dados.py            (depois: py montar_painel.py)
"""
import csv, json, os, re, sys, time, unicodedata, urllib.request
from datetime import date

BASE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.dirname(BASE)                                   # "Mortalidade Indicadores"
DOCS = os.path.dirname(PROJ)                                   # "Documentos"
CSV_IND = os.path.join(PROJ, "Pipeline_Python", "indicadores_recalculados.csv")
LISTA_OFICIAL = os.path.join(PROJ, "lista_oficial_116.csv")    # LISTA MATERNIDADES POR GRUPO_09092026
RELATORIO = os.path.join(PROJ, "Apresentacoes_Mortalidade_2026-09", "relatorio_geracao.csv")
PAINEL_NV = os.path.join(DOCS, "Pojeto Apresentações NV_2026", "Painel_2026_Novo")   # leitura apenas
NV_DADOS = os.path.join(PAINEL_NV, "dados_nv2026.js")
NV_CNES = os.path.join(PAINEL_NV, "cnes_dados.json")

ANOS = list(range(2019, 2026))
PRELIMINARES = [2024, 2025]
EXTRAIDO_EM = "2026-09-11"          # data da extração do SIM/SINASC (calcula_indicadores.py)

# HCFAMEMA (Marília/SP): os CNES 2025507 (HC adulto) e 2025523 (materno-infantil) formam um
# complexo. No recálculo os óbitos dos dois códigos ficaram no 2025523; o painel NV usa 2025507.
ALIAS_NV = {"2025523": "2025507"}

UF_NOME = {"AC":"Acre","AL":"Alagoas","AM":"Amazonas","AP":"Amapá","BA":"Bahia","CE":"Ceará",
           "DF":"Distrito Federal","ES":"Espírito Santo","GO":"Goiás","MA":"Maranhão","MG":"Minas Gerais",
           "MS":"Mato Grosso do Sul","MT":"Mato Grosso","PA":"Pará","PB":"Paraíba","PE":"Pernambuco",
           "PI":"Piauí","PR":"Paraná","RJ":"Rio de Janeiro","RN":"Rio Grande do Norte","RO":"Rondônia",
           "RR":"Roraima","RS":"Rio Grande do Sul","SC":"Santa Catarina","SE":"Sergipe","SP":"São Paulo",
           "TO":"Tocantins"}
REGIAO_UF = {}
for reg, ufs in {"Norte":["AC","AM","AP","PA","RO","RR","TO"],"Nordeste":["AL","BA","CE","MA","PB","PE","PI","RN","SE"],
                 "Centro-Oeste":["DF","GO","MS","MT"],"Sudeste":["ES","MG","RJ","SP"],"Sul":["PR","RS","SC"]}.items():
    for u in ufs: REGIAO_UF[u] = reg

# unidades fora do painel NV: metadados de território (região de saúde / macro como nas malhas)
EXTRA_META = {
    "0013846": {"nome": "Hospital do Rocio", "uf": "PR",
                "territorio": {"municipio": "Campo Largo", "regiao_saude": "2ª RS METROPOLITANA",
                               "macro": "MACRORREGIONAL LESTE", "uf": "Paraná"}},
    "2711613": {"nome": "CISAM - Centro Integrado de Saúde Amaury de Medeiros", "uf": "PE",
                "territorio": {"municipio": "Recife", "regiao_saude": "I REGIÃO DE SAÚDE",
                               "macro": "METROPOLITANA", "uf": "Pernambuco"}},
    "7958838": {"nome": "Hospital da Mulher do Recife", "uf": "PE",
                "territorio": {"municipio": "Recife", "regiao_saude": "I REGIÃO DE SAÚDE",
                               "macro": "METROPOLITANA", "uf": "Pernambuco"}},
}
NOME_EXIBICAO = {"2025523": "Hospital das Clínicas da FAMEMA (complexo HCFAMEMA)"}

# ----------------------------------------------------------------------------- blocos do CSV long
# (bloco, seção) do CSV -> chave do painel. Os valores guardados são os números absolutos (n);
# taxas e percentuais são calculados no painel (inclusive na coluna Acumulado).
SECOES = [
    ("MORTALIDADE MATERNA",   "Número de óbitos maternos",              "mat_serie"),
    ("MORTALIDADE MATERNA",   "Tipo de causa obstétrica",               "mat_tipo"),
    ("MORTALIDADE MATERNA",   "Grupo (direta)",                         "mat_diretas"),
    ("MORTALIDADE MATERNA",   "Grupo (indireta)",                       "mat_indiretas"),
    ("MORTALIDADE FETAL",     "Número de óbitos fetais",                "fet_serie"),
    ("MORTALIDADE FETAL",     "Faixa de peso ao nascer",                "fet_peso"),
    ("MORTALIDADE FETAL",     "Momento do óbito",                       "fet_momento"),
    ("MORTALIDADE FETAL",     "Grupo de causas",                        "fet_causas"),
    ("MORTALIDADE PERINATAL", "Número de óbitos perinatais",            "per_serie"),
    ("MORTALIDADE PERINATAL", "Faixa de peso ao nascer",                "per_peso"),
    ("MORTALIDADE PERINATAL", "Momento do óbito (componente)",          "per_momento"),
    ("MORTALIDADE PERINATAL", "Grupo de causas",                        "per_causas"),
    ("MORTALIDADE NEONATAL",  "Número de óbitos neonatais (0–27 dias)", "neo_serie"),
    ("MORTALIDADE NEONATAL",  "Momento do óbito (dias de vida)",        "neo_momento"),
    ("MORTALIDADE NEONATAL",  "Número de óbitos neonatais 0–6 dias",    "neo_precoce"),
    ("MORTALIDADE NEONATAL",  "Número de óbitos neonatais 7–27 dias",   "neo_tardia"),
    ("MORTALIDADE NEONATAL",  "Faixa de peso ao nascer",                "neo_peso"),
    ("MORTALIDADE NEONATAL",  "Grupo de causas",                        "neo_causas"),
    ("MORTALIDADE NEONATAL",  "Grupo de causas evitáveis (LBE)",        "neo_lbe"),
]
CHAVE = {(b, s): k for b, s, k in SECOES}
# rótulos de taxa (coluna valor) não entram: são recalculados no painel
ROTULOS_TAXA = re.compile(r"^(Razão|Taxa) de Mortalidade")


def norm(s):
    s = unicodedata.normalize("NFD", str(s or ""))
    return "".join(c for c in s if unicodedata.category(c) != "Mn").upper().strip()


def to_num(v):
    if v is None or v == "" or v == "nan":
        return None
    try:
        f = float(v)
    except ValueError:
        return None
    if f != f:                       # NaN
        return None
    return int(f) if f.is_integer() else round(f, 4)


def titulo_nome(s):
    """'HOSPITAL DO ROCIO' -> 'Hospital do Rocio' (para as unidades sem nome no painel NV)."""
    minus = {"DE", "DA", "DO", "DAS", "DOS", "E", "DR", "DRA", "N", "SRA"}
    out = []
    for p in str(s).split():
        pu = norm(p)
        if pu in {"DR", "DRA"}: out.append(pu.capitalize() + "."); continue
        if pu in {"IMIP", "HCFAMEMA", "CISAM", "HGCC", "HGF", "HRSM", "HRT", "HUCAM", "HEMU", "HMDLJ", "UFPEL",
                  "UFPR", "UFRJ", "UFTM", "UFMA", "SES", "AP", "RJ", "HC", "MVFA", "HMIB", "HGA"}:
            out.append(pu); continue
        if pu in minus and out: out.append(p.lower()); continue
        out.append(p.capitalize())
    return " ".join(out)


# ----------------------------------------------------------------------------- 1. painel NV (leitura)
def carrega_nv():
    js = open(NV_DADOS, encoding="utf-8").read()
    geo = json.loads(re.search(r"const GEO = (\{.*?\});\n", js, re.S).group(1))
    dados = json.loads(re.search(r"const DADOS = (\{.*?\});\nconst PONTOS", js, re.S).group(1))
    pontos = json.loads(re.search(r"const PONTOS = (\[.*?\]);", js, re.S).group(1))
    cnes = json.load(open(NV_CNES, encoding="utf-8")) if os.path.exists(NV_CNES) else {}
    return geo, {m["cnes"]: m for m in dados["maternidades"]}, pontos, cnes


geo, nv, pontos_nv, cnes_nv = carrega_nv()
print(f"[1] painel NV lido: {len(nv)} unidades, GEO {', '.join(f'{k}={len(v)}' for k, v in geo['niveis'].items())}, "
      f"{len(pontos_nv)} pontos de contexto, {len(cnes_nv) - 1} fichas CNES")

# ----------------------------------------------------------------------------- 2. lista oficial e relatório
oficial = {}
with open(LISTA_OFICIAL, encoding="utf-8-sig") as fh:
    for r in csv.DictReader(fh):
        c = re.sub(r"\D", "", r["cnes"]).zfill(7)
        oficial[c] = {"tipo": r["tipo"].strip().upper(), "nome": r["nome"].strip(), "uf": r["uf"].strip(),
                      "municipio": r["municipio"].strip(), "regiao": r["regiao"].strip()}
relatorio = {}
if os.path.exists(RELATORIO):
    with open(RELATORIO, encoding="utf-8-sig") as fh:
        for r in csv.DictReader(fh):
            relatorio[r["cnes"].zfill(7)] = r
print(f"[2] lista oficial: {len(oficial)} CNES | relatório de geração: {len(relatorio)} unidades")


def conjuntos_de(tipo):
    """'APOIADA/QUALINEO' -> ['apoiada', 'qualineo'] (ordem fixa: apoiada, ebserh, qualineo)."""
    t = norm(tipo)
    out = []
    if "APOIADA" in t: out.append("apoiada")
    if "EBSERH" in t: out.append("ebserh")
    if "QUALINEO" in t: out.append("qualineo")
    return out or ["apoiada"]


# ----------------------------------------------------------------------------- 3. indicadores (CSV long)
por_cnes = {}
n_lin = 0
with open(CSV_IND, encoding="utf-8") as fh:
    for r in csv.DictReader(fh):
        k = CHAVE.get((r["bloco"], r["secao"]))
        if not k or ROTULOS_TAXA.match(r["rotulo"]):
            continue
        cnes = r["cnes"].zfill(7); ano = int(r["ano"])
        bl = por_cnes.setdefault(cnes, {})
        sec = bl.setdefault(k, {})
        sec.setdefault(r["rotulo"], [None] * len(ANOS))[ANOS.index(ano)] = to_num(r["n"])
        n_lin += 1
print(f"[3] {n_lin} linhas do CSV long -> {len(por_cnes)} CNES")

# nascidos vivos ausentes (unidade ainda não existia): denominadores ficam nulos
for cnes, bl in por_cnes.items():
    nv_serie = bl["mat_serie"]["Nascidos vivos (denominador)"]
    for i, v in enumerate(nv_serie):
        if v is None:
            for k in ("fet_serie", "per_serie"):
                bl[k]["Nascimentos (NV + óbitos fetais)"][i] = None


def com_total(vals):
    """Acrescenta a coluna Acumulado 2019-2025 (soma; nula se todos os anos forem nulos)."""
    ok = [v for v in vals if v is not None]
    return list(vals) + [sum(ok) if ok else None]


# ----------------------------------------------------------------------------- 4. maternidades
mats = []
avisos = []
for cnes in sorted(por_cnes):
    ref = nv.get(cnes) or nv.get(ALIAS_NV.get(cnes, ""))
    of = oficial.get(cnes)
    rel = relatorio.get(cnes) or relatorio.get(ALIAS_NV.get(cnes, ""))
    extra = EXTRA_META.get(cnes)
    if ref:
        nome = ref["nome"].replace("—", "-"); uf = ref["uf"]; terr = dict(ref["territorio"])
        lat, lon = ref.get("lat"), ref.get("lon"); partos = ref.get("partosAIH")
    elif extra:
        nome = extra["nome"]; uf = extra["uf"]; terr = dict(extra["territorio"]); lat = lon = partos = None
    else:
        nome = titulo_nome((of or rel or {}).get("nome", cnes)); uf = (of or rel or {}).get("uf", "")
        terr = {"municipio": (of or {}).get("municipio", ""), "regiao_saude": "", "macro": "", "uf": UF_NOME.get(uf, uf)}
        lat = lon = partos = None
        avisos.append(f"{cnes} sem território conhecido")
    nome = NOME_EXIBICAO.get(cnes, nome)
    tipo = of["tipo"] if of else ("APOIADA" if (rel or {}).get("lista") in ("v4", "QUALINEO_NOVE_IAUARETE") else "APOIADA")
    mt = {
        "cnes": cnes,
        "nome": nome,
        "nomePlanilha": (of or rel or {}).get("nome", nome),
        "uf": uf,
        "regiao": REGIAO_UF.get(uf, ""),
        "territorio": terr,
        "lat": lat, "lon": lon, "partosAIH": partos,
        "conjuntos": conjuntos_de(tipo),
        "tipoApoio": tipo,
        "oficial": cnes in oficial,
        "lista": (rel or {}).get("lista", ""),
        "blocos": {k: [[rot, com_total(v)] for rot, v in sec.items()] for k, sec in por_cnes[cnes].items()},
    }
    if cnes in ALIAS_NV:
        mt["cnesComplexo"] = [ALIAS_NV[cnes], cnes]
    mats.append(mt)

# ---- malhas: id da região de saúde e da macrorregião de cada unidade (mesma heurística do painel
#      + ajustes manuais onde o nome da planilha difere do nome da malha). O painel usa o id quando existe.
def _norm_geo(s):
    s = norm(s)
    s = re.sub(r"MACRORREGIONAL|MACRORREGIAO|MACROREGIAO|MACRO|REGIAO DE SAUDE|REGIONAL|\bRS\b|SAUDE|\bDE\b|\bDA\b|\bDO\b|\bE\b|\bUNICA\b|[^A-Z0-9 ]", " ", s)
    return set(s.split())

def _simil(a, b):
    A, B = _norm_geo(a), _norm_geo(b)
    return bool(A and B) and len(A & B) / min(len(A), len(B)) >= 0.6

GEO_AJUSTES = {   # cnes: {"rs": id, "macro": id}
    "0000396": {"rs": 26010, "macro": 2607}, "0000434": {"rs": 26010, "macro": 2607}, "2427427": {"rs": 26010, "macro": 2607},
    "0000418": {"rs": 26010, "macro": 2607}, "2711613": {"rs": 26010, "macro": 2607}, "7958838": {"rs": 26010, "macro": 2607},
    "2430711": {"rs": 26009, "macro": 2605},                       # Petrolina: VIII Região de Saúde / Vale do S. Francisco e Araripe
    "0002232": {"macro": 2801}, "4099206": {"macro": 2801}, "5714397": {"macro": 2801},   # Sergipe: Macro Única
}
def _uf_da_malha(t):
    mm = re.search(r"-\s*([A-Z]{2})\s*$", t.get("nome", ""))
    return mm.group(1) if mm else None

sem_malha = []
for m in mats:
    g = {}
    for niv, campo in (("rs", "regiao_saude"), ("macro", "macro")):
        aj = GEO_AJUSTES.get(m["cnes"], {}).get(niv)
        if aj is None:
            alvo = m["territorio"].get(campo, "")
            cand = [t for t in geo["niveis"][niv] if _uf_da_malha(t) == m["uf"] and _simil(t["nome"], alvo)]
            if len(cand) > 1:      # mais de uma malha parecida: fica a de maior semelhança (Jaccard)
                A = _norm_geo(alvo)
                cand.sort(key=lambda t: -len(A & _norm_geo(t["nome"])) / len(A | _norm_geo(t["nome"])))
                print(f"    {m['cnes']} {m['nome'][:40]}: '{alvo}' -> {cand[0]['nome']} (entre {len(cand)} parecidas)")
            aj = cand[0]["id"] if cand else None
        if aj is None: sem_malha.append(f"{m['cnes']} {m['nome']} ({niv}: {m['territorio'].get(campo)})")
        g[niv] = aj
    m["geo"] = g
if sem_malha: print("    sem malha casada:", *sem_malha, sep="\n      ")

conta = {}
for m in mats:
    for c in m["conjuntos"]: conta[c] = conta.get(c, 0) + 1
print(f"[4] {len(mats)} maternidades | por grupo (com sobreposição): {conta} | fora da lista oficial: "
      f"{[m['cnes'] + ' ' + m['nome'] for m in mats if not m['oficial']]}")
for a in avisos: print("    ATENÇÃO:", a)

# ----------------------------------------------------------------------------- 5. ficha CNES
API = "https://apidadosabertos.saude.gov.br/cnes/estabelecimentos/{}"
API_HAB = "https://cnes.datasus.gov.br/services/estabelecimentos-habilitacoes/{}"
HEADERS = {"User-Agent": "Mozilla/5.0", "Referer": "https://cnes.datasus.gov.br/"}


def busca(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


saida_cnes_path = os.path.join(BASE, "cnes_dados.json")
saida_cnes = json.load(open(saida_cnes_path, encoding="utf-8")) if os.path.exists(saida_cnes_path) else {}
saida_cnes.setdefault("_atualizado_em", cnes_nv.get("_atualizado_em", date.today().isoformat()))
buscadas = 0
for m in mats:
    c = m["cnes"]
    if c in saida_cnes:
        continue
    if c in cnes_nv:                                   # mesma unidade, mesma ficha
        saida_cnes[c] = cnes_nv[c]; continue
    try:                                               # unidade nova: API oficial
        info = busca(API.format(int(c)))
        uid = info.get("codigo_estabelecimento_saude")
        try:
            info["habilitacoes"] = busca(API_HAB.format(uid)) if uid else None
        except Exception as e2:
            info["habilitacoes"] = None; print(f"    habilitações indisponíveis para {c}: {e2}")
        saida_cnes[c] = info; buscadas += 1
        # coordenadas da ficha quando a unidade não tem ponto no acervo AIH
        if m["lat"] is None and info.get("latitude_estabelecimento_decimo_grau") is not None:
            m["lat"] = round(float(info["latitude_estabelecimento_decimo_grau"]), 5)
            m["lon"] = round(float(info["longitude_estabelecimento_decimo_grau"]), 5)
        print(f"    ficha CNES buscada na API: {c} {m['nome']} ({len(info.get('habilitacoes') or [])} habilitações)")
        time.sleep(0.4)
    except Exception as e:
        print(f"    ATENÇÃO: ficha CNES indisponível para {c} {m['nome']}: {e}")
# coordenadas das unidades que já têm ficha, mas ainda sem lat/lon
for m in mats:
    info = saida_cnes.get(m["cnes"])
    if m["lat"] is None and info and info.get("latitude_estabelecimento_decimo_grau") is not None:
        m["lat"] = round(float(info["latitude_estabelecimento_decimo_grau"]), 5)
        m["lon"] = round(float(info["longitude_estabelecimento_decimo_grau"]), 5)
with open(saida_cnes_path, "w", encoding="utf-8") as fh:
    json.dump(saida_cnes, fh, ensure_ascii=False, indent=1)
sem_coord = [m["cnes"] + " " + m["nome"] for m in mats if m["lat"] is None]
print(f"[5] cnes_dados.json: {len(saida_cnes) - 1} fichas ({buscadas} buscadas agora) | sem coordenada: {sem_coord or 'nenhuma'}")

# ----------------------------------------------------------------------------- 6. pontos de contexto
alvo = {m["cnes"] for m in mats} | set(ALIAS_NV.values())
contexto = [p for p in pontos_nv if p["cnes"] not in alvo]
print(f"[6] {len(contexto)} pontos de contexto (>=480 partos/ano, fora do painel)")

# ----------------------------------------------------------------------------- 7. saída
dados = {"anos": ANOS, "preliminares": PRELIMINARES, "extraidoEm": EXTRAIDO_EM,
         "listaOficial": "LISTA MATERNIDADES POR GRUPO_09092026", "maternidades": mats}
out = os.path.join(BASE, "dados_mortalidade.js")
with open(out, "w", encoding="utf-8") as fh:
    fh.write("/* Gerado por build_dados.py — não editar à mão */\n")
    fh.write("const GEO = "); json.dump(geo, fh, ensure_ascii=False, separators=(",", ":"))
    fh.write(";\nconst DADOS = "); json.dump(dados, fh, ensure_ascii=False, separators=(",", ":"))
    fh.write(";\nconst PONTOS = "); json.dump(contexto, fh, ensure_ascii=False, separators=(",", ":"))
    fh.write(";\n")
print(f"[7] gravado {out} ({os.path.getsize(out) // 1024} KB)")
