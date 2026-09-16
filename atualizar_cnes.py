# -*- coding: utf-8 -*-
"""
Busca a ficha de cada maternidade na API oficial de Dados Abertos do Ministério da Saúde (CNES)
e as habilitações ativas no serviço do site do CNES, e grava cnes_dados.json.

    py atualizar_cnes.py        (depois: py montar_painel.py)
"""
import json, re, os, time, urllib.request
from datetime import date

BASE = os.path.dirname(os.path.abspath(__file__))
API = "https://apidadosabertos.saude.gov.br/cnes/estabelecimentos/{}"
API_HAB = "https://cnes.datasus.gov.br/services/estabelecimentos-habilitacoes/{}"
HEADERS = {"User-Agent": "Mozilla/5.0", "Referer": "https://cnes.datasus.gov.br/"}

def busca(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)

js = open(os.path.join(BASE, "dados_mortalidade.js"), encoding="utf-8").read()
m = re.search(r'const DADOS = (\{.*?\});\nconst PONTOS', js, re.S)
mats = json.loads(m.group(1))["maternidades"]

saida = {"_atualizado_em": date.today().isoformat()}
erros = []
for i, mt in enumerate(mats, 1):
    cnes = mt["cnes"]
    try:
        info = busca(API.format(int(cnes)))
        uid = info.get("codigo_estabelecimento_saude")
        try:
            info["habilitacoes"] = busca(API_HAB.format(uid)) if uid else None
        except Exception as e2:
            info["habilitacoes"] = None
            print(f"      habilitações indisponíveis: {e2}")
        saida[cnes] = info
        nh = len(info.get("habilitacoes") or [])
        print(f"[{i:3d}/{len(mats)}] {cnes} ok ({nh} habilitações) - {mt['nome']}")
    except Exception as e:
        erros.append((cnes, mt["nome"], str(e)))
        print(f"[{i:3d}/{len(mats)}] {cnes} ERRO: {e}")
    time.sleep(0.4)

with open(os.path.join(BASE, "cnes_dados.json"), "w", encoding="utf-8") as fh:
    json.dump(saida, fh, ensure_ascii=False, indent=1)

print(f"\n{len(saida) - 1} fichas gravadas em cnes_dados.json")
if erros:
    print("Falharam:", *[f"  {c} - {n}" for c, n, _ in erros], sep="\n")
