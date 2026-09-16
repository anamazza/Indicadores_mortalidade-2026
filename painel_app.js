/* ============================================================
   Painel de Mortalidade 2026 — app
   Dados: const GEO / DADOS / PONTOS (dados_mortalidade.js) e CNES_INFO (cnes_dados.json)
   Estrutura e interações espelham o Painel NV 2026 (mesma família de painéis).
   ============================================================ */
"use strict";

const ANOS = DADOS.anos;                 // [2019..2025]
const NT = ANOS.length;                  // índice da coluna Acumulado nos blocos
const MAT = DADOS.maternidades;
const PRELIM = new Set(DADOS.preliminares || []);
const NS = "http://www.w3.org/2000/svg";

const UF_NOME = {AC:"Acre",AL:"Alagoas",AM:"Amazonas",AP:"Amapá",BA:"Bahia",CE:"Ceará",DF:"Distrito Federal",
ES:"Espírito Santo",GO:"Goiás",MA:"Maranhão",MG:"Minas Gerais",MS:"Mato Grosso do Sul",MT:"Mato Grosso",
PA:"Pará",PB:"Paraíba",PE:"Pernambuco",PI:"Piauí",PR:"Paraná",RJ:"Rio de Janeiro",RN:"Rio Grande do Norte",
RO:"Rondônia",RR:"Roraima",RS:"Rio Grande do Sul",SC:"Santa Catarina",SE:"Sergipe",SP:"São Paulo",TO:"Tocantins"};
const REGIAO_UFS = {Norte:["AC","AM","AP","PA","RO","RR","TO"],Nordeste:["AL","BA","CE","MA","PB","PE","PI","RN","SE"],
"Centro-Oeste":["DF","GO","MS","MT"],Sudeste:["ES","MG","RJ","SP"],Sul:["PR","RS","SC"]};

/* ---------------- formatação ---------------- */
const fmtInt = v => v == null ? "—" : Math.round(v).toLocaleString("pt-BR");
const fmtPct = v => v == null ? "—" : v.toLocaleString("pt-BR", {minimumFractionDigits:1, maximumFractionDigits:1}) + "%";
const fmtTaxa = v => v == null ? "—" : v.toLocaleString("pt-BR", {minimumFractionDigits:1, maximumFractionDigits:1});
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const rotAno = i => i >= NT ? "Acumulado 2019-2025" : String(ANOS[i]) + (PRELIM.has(ANOS[i]) ? " (preliminar)" : "");
const rotAnoCurto = i => i >= NT ? "Acumulado" : String(ANOS[i]);

/* ---------------- acesso aos blocos ----------------
   mt.blocos[bloco] = [[rotulo, [v2019..v2025, acumulado]], ...] — sempre números absolutos */
function linha(mt, bloco, rotulo){
  const b = mt.blocos[bloco]; if(!b) return null;
  const r = b.find(x => x[0] === rotulo);
  return r ? r[1] : null;
}
function somaLinhas(mt, bloco, rotulos, a){
  let s = 0, tem = false;
  rotulos.forEach(rot => { const v = linha(mt, bloco, rot); if(v && v[a] != null){ s += v[a]; tem = true; } });
  return tem ? s : null;
}
const totalSem = (mt, bloco, ign, a) => {
  const t = linha(mt, bloco, "Total")?.[a];
  if(t == null) return null;
  let i = 0; (ign || []).forEach(r => { i += linha(mt, bloco, r)?.[a] || 0; });
  return t - i;
};
const NV = (m, a) => linha(m, "mat_serie", "Nascidos vivos (denominador)")?.[a];
const NASC = (m, a) => linha(m, "fet_serie", "Nascimentos (NV + óbitos fetais)")?.[a];

/* rótulos dos blocos (iguais ao CSV / apresentação) */
const R = {
  obMat:"Número de óbitos maternos", obFet:"Número de óbitos fetais", obPer:"Número de óbitos perinatais",
  obNeo:"Número de óbitos neonatais (0–27 dias)", obPrec:"Número de óbitos neonatais 0–6 dias", obTard:"Número de óbitos neonatais 7–27 dias",
  nv:"Nascidos vivos (denominador)", nasc:"Nascimentos (NV + óbitos fetais)",
  totMat:"Total de óbitos maternos", dir:"Diretas (nº)", ind:"Indiretas (nº)", ines:"Inespecíficas (nº)",
  totDir:"Total diretas", totInd:"Total indiretas",
  p1:"Menos de 1000g", p2:"1000g a 1499g", p3:"1500g a 2499g", p4:"2500g a 3999g", p5:"4000g e mais", pIgn:"Ignorado / sem informação",
  ante:"Antes do parto (anteparto)", intra:"Durante o parto (intraparto)", apos:"Após o parto", momIgn:"Ignorado / sem informação",
  cFat:"Feto/RN afetado por fatores maternos, placenta, cordão e membranas", cGest:"Transtornos ligados à gestação e crescimento fetal",
  cHip:"Hipóxia/asfixia e transtornos respiratórios", cInf:"Infecções específicas do período perinatal",
  cHem:"Transtornos hemorrágicos e hematológicos do feto/RN", cAnom:"Anomalias congênitas", cMal:"Causas mal definidas", cDem:"Demais causas",
  lImu:"Reduzíveis por imunoprevenção", lGes:"Reduzíveis por atenção à mulher na gestação", lPar:"Reduzíveis por atenção à mulher no parto",
  lRN:"Reduzíveis por atenção ao recém-nascido", lDia:"Reduzíveis por diagnóstico e tratamento adequados", lPro:"Reduzíveis por promoção à saúde",
  lAno:"Anomalias congênitas", lMal:"Causas mal definidas", lDem:"Demais causas (não claramente evitáveis)"
};
const LBE_EVITAVEIS = [R.lImu, R.lGes, R.lPar, R.lRN, R.lDia, R.lPro];

/* ---------------- indicadores ----------------
   cada indicador sabe extrair num/den de uma maternidade num ano; a taxa = num/den × fator.
   tipo: "num" (absoluto), "taxa" (por 1.000 ou 100.000) ou "pct" (distribuição %).
   sentido: "menor" (menos é melhor), "neutro" (perfil, sem julgamento). */
const INDS = [
  // ---- visão geral
  {id:"nv", eixo:"geral", rot:"Nascidos vivos ocorridos", curto:"Nascidos vivos", tipo:"num", sentido:"neutro",
   num:(m,a)=> NV(m,a), den:null, fonte:"SINASC",
   desc:"Total de nascidos vivos ocorridos na unidade (SINASC): denominador da razão de mortalidade materna e das taxas neonatais."},
  {id:"rmm", eixo:"geral", rot:"Razão de mortalidade materna (por 100 mil NV)", curto:"RMM", tipo:"taxa", fator:1e5, unidade:"por 100 mil NV", sentido:"menor", alias:"rmm_m",
   num:(m,a)=> linha(m,"mat_serie",R.obMat)?.[a], den:(m,a)=> NV(m,a), fonte:"SIM-DO e SINASC",
   desc:"Óbitos maternos ocorridos na unidade por 100 mil nascidos vivos ocorridos na unidade (definição do Ministério da Saúde para óbito materno)."},
  {id:"tmf", eixo:"geral", rot:"Taxa de mortalidade fetal (por mil nascimentos)", curto:"Taxa fetal", tipo:"taxa", fator:1e3, unidade:"por mil nascimentos", sentido:"menor", alias:"tmf_f",
   num:(m,a)=> linha(m,"fet_serie",R.obFet)?.[a], den:(m,a)=> NASC(m,a), fonte:"SIM-DOFET e SINASC",
   desc:"Óbitos fetais (22 semanas ou mais, ou 500 g ou mais) por mil nascimentos (nascidos vivos + óbitos fetais) ocorridos na unidade."},
  {id:"tmp", eixo:"geral", rot:"Taxa de mortalidade perinatal (por mil nascimentos)", curto:"Taxa perinatal", tipo:"taxa", fator:1e3, unidade:"por mil nascimentos", sentido:"menor", alias:"tmp_p",
   num:(m,a)=> linha(m,"per_serie",R.obPer)?.[a], den:(m,a)=> NASC(m,a), fonte:"SIM-DOFET, SIM-DO e SINASC",
   desc:"Óbitos fetais mais óbitos neonatais precoces (0 a 6 dias) por mil nascimentos ocorridos na unidade."},
  {id:"tmn", eixo:"geral", rot:"Taxa de mortalidade neonatal (por mil NV)", curto:"Taxa neonatal", tipo:"taxa", fator:1e3, unidade:"por mil NV", sentido:"menor", alias:"tmn_n",
   num:(m,a)=> linha(m,"neo_serie",R.obNeo)?.[a], den:(m,a)=> NV(m,a), fonte:"SIM-DO e SINASC",
   desc:"Óbitos de nascidos vivos com 0 a 27 dias de vida ocorridos na unidade por mil nascidos vivos ocorridos na unidade."},
  // ---- materna
  {id:"obm", eixo:"materna", rot:"Número de óbitos maternos", curto:"Óbitos maternos", tipo:"num", sentido:"menor",
   num:(m,a)=> linha(m,"mat_serie",R.obMat)?.[a], den:null, fonte:"SIM-DO",
   desc:"Óbitos de mulheres na gestação ou até 42 dias após o seu término, por causa relacionada ou agravada pela gravidez, ocorridos na unidade (regra do Ministério da Saúde)."},
  {id:"rmm_m", eixo:"materna", rot:"Razão de mortalidade materna (por 100 mil NV)", curto:"RMM", tipo:"taxa", fator:1e5, unidade:"por 100 mil NV", sentido:"menor",
   num:(m,a)=> linha(m,"mat_serie",R.obMat)?.[a], den:(m,a)=> NV(m,a), fonte:"SIM-DO e SINASC",
   desc:"Óbitos maternos ocorridos na unidade por 100 mil nascidos vivos ocorridos na unidade."},
  {id:"mdir", eixo:"materna", rot:"% de óbitos maternos por causas obstétricas diretas", curto:"% causas diretas", tipo:"pct", sentido:"neutro",
   num:(m,a)=> linha(m,"mat_tipo",R.dir)?.[a], den:(m,a)=> linha(m,"mat_tipo",R.totMat)?.[a], fonte:"SIM-DO",
   desc:"Entre os óbitos maternos, proporção por causas obstétricas diretas (complicações da gravidez, parto e puerpério)."},
  {id:"mind", eixo:"materna", rot:"% de óbitos maternos por causas obstétricas indiretas", curto:"% causas indiretas", tipo:"pct", sentido:"neutro",
   num:(m,a)=> linha(m,"mat_tipo",R.ind)?.[a], den:(m,a)=> linha(m,"mat_tipo",R.totMat)?.[a], fonte:"SIM-DO",
   desc:"Entre os óbitos maternos, proporção por causas obstétricas indiretas (doenças pré-existentes ou que surgiram na gravidez, agravadas por ela)."},
  {id:"mhip", eixo:"materna", rot:"% dos óbitos maternos diretos por hipertensão", curto:"% hipertensão (diretas)", tipo:"pct", sentido:"neutro",
   num:(m,a)=> linha(m,"mat_diretas","Hipertensão (pré-eclâmpsia/eclâmpsia)")?.[a], den:(m,a)=> linha(m,"mat_diretas",R.totDir)?.[a], fonte:"SIM-DO",
   desc:"Entre os óbitos maternos por causas diretas, proporção por hipertensão (pré-eclâmpsia/eclâmpsia, O11 a O16)."},
  {id:"mhem", eixo:"materna", rot:"% dos óbitos maternos diretos por hemorragia", curto:"% hemorragia (diretas)", tipo:"pct", sentido:"neutro",
   num:(m,a)=> linha(m,"mat_diretas","Hemorragia")?.[a], den:(m,a)=> linha(m,"mat_diretas",R.totDir)?.[a], fonte:"SIM-DO",
   desc:"Entre os óbitos maternos por causas diretas, proporção por hemorragia (O20, O44 a O46, O67, O72)."},
  {id:"minf", eixo:"materna", rot:"% dos óbitos maternos diretos por infecção puerperal", curto:"% infecção (diretas)", tipo:"pct", sentido:"neutro",
   num:(m,a)=> linha(m,"mat_diretas","Infecção puerperal")?.[a], den:(m,a)=> linha(m,"mat_diretas",R.totDir)?.[a], fonte:"SIM-DO",
   desc:"Entre os óbitos maternos por causas diretas, proporção por infecção puerperal (O85, O86, O91)."},
  // ---- fetal
  {id:"obf", eixo:"fetal", rot:"Número de óbitos fetais", curto:"Óbitos fetais", tipo:"num", sentido:"menor",
   num:(m,a)=> linha(m,"fet_serie",R.obFet)?.[a], den:null, fonte:"SIM-DOFET",
   desc:"Óbitos fetais com 22 semanas ou mais de gestação ou 500 g ou mais, ocorridos na unidade."},
  {id:"tmf_f", eixo:"fetal", rot:"Taxa de mortalidade fetal (por mil nascimentos)", curto:"Taxa fetal", tipo:"taxa", fator:1e3, unidade:"por mil nascimentos", sentido:"menor",
   num:(m,a)=> linha(m,"fet_serie",R.obFet)?.[a], den:(m,a)=> NASC(m,a), fonte:"SIM-DOFET e SINASC",
   desc:"Óbitos fetais por mil nascimentos (nascidos vivos + óbitos fetais) ocorridos na unidade."},
  {id:"fante", eixo:"fetal", rot:"% de óbitos fetais anteparto", curto:"% anteparto", tipo:"pct", sentido:"neutro",
   num:(m,a)=> linha(m,"fet_momento",R.ante)?.[a], den:(m,a)=> totalSem(m,"fet_momento",[R.momIgn],a), fonte:"SIM-DOFET",
   desc:"Entre os óbitos fetais com momento informado, proporção ocorrida antes do trabalho de parto."},
  {id:"fintra", eixo:"fetal", rot:"% de óbitos fetais intraparto", curto:"% intraparto", tipo:"pct", sentido:"menor",
   num:(m,a)=> linha(m,"fet_momento",R.intra)?.[a], den:(m,a)=> totalSem(m,"fet_momento",[R.momIgn],a), fonte:"SIM-DOFET",
   desc:"Entre os óbitos fetais com momento informado, proporção ocorrida durante o parto — óbitos potencialmente sensíveis à assistência ao parto."},
  {id:"f1500", eixo:"fetal", rot:"% de óbitos fetais com peso <1500 g", curto:"% <1500 g", tipo:"pct", sentido:"neutro",
   num:(m,a)=> somaLinhas(m,"fet_peso",[R.p1,R.p2],a), den:(m,a)=> totalSem(m,"fet_peso",[R.pIgn],a), fonte:"SIM-DOFET",
   desc:"Entre os óbitos fetais com peso informado, proporção com menos de 1500 g."},
  {id:"f2500", eixo:"fetal", rot:"% de óbitos fetais com peso ≥2500 g", curto:"% ≥2500 g", tipo:"pct", sentido:"menor",
   num:(m,a)=> somaLinhas(m,"fet_peso",[R.p4,R.p5],a), den:(m,a)=> totalSem(m,"fet_peso",[R.pIgn],a), fonte:"SIM-DOFET",
   desc:"Entre os óbitos fetais com peso informado, proporção com 2500 g ou mais — fetos a termo ou próximos do termo, óbitos em geral mais evitáveis."},
  {id:"fmal", eixo:"fetal", rot:"% de óbitos fetais por causas mal definidas", curto:"% mal definidas", tipo:"pct", sentido:"menor",
   num:(m,a)=> linha(m,"fet_causas",R.cMal)?.[a], den:(m,a)=> linha(m,"fet_causas","Total")?.[a], fonte:"SIM-DOFET",
   desc:"Entre os óbitos fetais, proporção com causa básica mal definida (R00 a R99, P95) — indicador da qualidade da investigação do óbito."},
  // ---- perinatal
  {id:"obp", eixo:"perinatal", rot:"Número de óbitos perinatais", curto:"Óbitos perinatais", tipo:"num", sentido:"menor",
   num:(m,a)=> linha(m,"per_serie",R.obPer)?.[a], den:null, fonte:"SIM-DOFET e SIM-DO",
   desc:"Óbitos fetais (22 semanas ou mais, ou 500 g ou mais) mais óbitos neonatais precoces (0 a 6 dias) ocorridos na unidade."},
  {id:"tmp_p", eixo:"perinatal", rot:"Taxa de mortalidade perinatal (por mil nascimentos)", curto:"Taxa perinatal", tipo:"taxa", fator:1e3, unidade:"por mil nascimentos", sentido:"menor",
   num:(m,a)=> linha(m,"per_serie",R.obPer)?.[a], den:(m,a)=> NASC(m,a), fonte:"SIM-DOFET, SIM-DO e SINASC",
   desc:"Óbitos perinatais por mil nascimentos (nascidos vivos + óbitos fetais) ocorridos na unidade."},
  {id:"pfet", eixo:"perinatal", rot:"% do componente fetal na mortalidade perinatal", curto:"% componente fetal", tipo:"pct", sentido:"neutro",
   num:(m,a)=> linha(m,"per_momento","Fetal")?.[a], den:(m,a)=> linha(m,"per_momento","Total")?.[a], fonte:"SIM-DOFET e SIM-DO",
   desc:"Entre os óbitos perinatais, proporção de óbitos fetais (o restante são óbitos neonatais precoces)."},
  {id:"p1500", eixo:"perinatal", rot:"% de óbitos perinatais com peso <1500 g", curto:"% <1500 g", tipo:"pct", sentido:"neutro",
   num:(m,a)=> somaLinhas(m,"per_peso",[R.p1,R.p2],a), den:(m,a)=> totalSem(m,"per_peso",[R.pIgn],a), fonte:"SIM-DOFET e SIM-DO",
   desc:"Entre os óbitos perinatais com peso informado, proporção com menos de 1500 g."},
  {id:"phip", eixo:"perinatal", rot:"% de óbitos perinatais por hipóxia/asfixia e transtornos respiratórios", curto:"% asfixia/respiratórios", tipo:"pct", sentido:"menor",
   num:(m,a)=> linha(m,"per_causas",R.cHip)?.[a], den:(m,a)=> linha(m,"per_causas","Total")?.[a], fonte:"SIM-DOFET e SIM-DO",
   desc:"Entre os óbitos perinatais, proporção por hipóxia/asfixia e transtornos respiratórios (P10 a P15, P20, P21, P24, P28)."},
  {id:"panom", eixo:"perinatal", rot:"% de óbitos perinatais por anomalias congênitas", curto:"% anomalias congênitas", tipo:"pct", sentido:"neutro",
   num:(m,a)=> linha(m,"per_causas",R.cAnom)?.[a], den:(m,a)=> linha(m,"per_causas","Total")?.[a], fonte:"SIM-DOFET e SIM-DO",
   desc:"Entre os óbitos perinatais, proporção por anomalias congênitas (capítulo XVII da CID-10)."},
  // ---- neonatal
  {id:"obn", eixo:"neonatal", rot:"Número de óbitos neonatais (0 a 27 dias)", curto:"Óbitos neonatais", tipo:"num", sentido:"menor",
   num:(m,a)=> linha(m,"neo_serie",R.obNeo)?.[a], den:null, fonte:"SIM-DO",
   desc:"Óbitos de nascidos vivos com 0 a 27 dias completos de vida ocorridos na unidade."},
  {id:"tmn_n", eixo:"neonatal", rot:"Taxa de mortalidade neonatal (por mil NV)", curto:"Taxa neonatal", tipo:"taxa", fator:1e3, unidade:"por mil NV", sentido:"menor",
   num:(m,a)=> linha(m,"neo_serie",R.obNeo)?.[a], den:(m,a)=> NV(m,a), fonte:"SIM-DO e SINASC",
   desc:"Óbitos neonatais (0 a 27 dias) por mil nascidos vivos ocorridos na unidade."},
  {id:"tmnp", eixo:"neonatal", rot:"Taxa de mortalidade neonatal precoce (por mil NV)", curto:"Taxa neonatal precoce", tipo:"taxa", fator:1e3, unidade:"por mil NV", sentido:"menor",
   num:(m,a)=> linha(m,"neo_precoce",R.obPrec)?.[a], den:(m,a)=> NV(m,a), fonte:"SIM-DO e SINASC",
   desc:"Óbitos de 0 a 6 dias de vida por mil nascidos vivos ocorridos na unidade (IDB C.1.1)."},
  {id:"tmnt", eixo:"neonatal", rot:"Taxa de mortalidade neonatal tardia (por mil NV)", curto:"Taxa neonatal tardia", tipo:"taxa", fator:1e3, unidade:"por mil NV", sentido:"menor",
   num:(m,a)=> linha(m,"neo_tardia",R.obTard)?.[a], den:(m,a)=> NV(m,a), fonte:"SIM-DO e SINASC",
   desc:"Óbitos de 7 a 27 dias de vida por mil nascidos vivos ocorridos na unidade (IDB C.1.2)."},
  {id:"n0d", eixo:"neonatal", rot:"% de óbitos neonatais no 1º dia de vida", curto:"% no 1º dia", tipo:"pct", sentido:"neutro",
   num:(m,a)=> linha(m,"neo_momento","0 dias")?.[a], den:(m,a)=> linha(m,"neo_momento","Total")?.[a], fonte:"SIM-DO",
   desc:"Entre os óbitos neonatais, proporção ocorrida nas primeiras 24 horas de vida."},
  {id:"n1500", eixo:"neonatal", rot:"% de óbitos neonatais com peso <1500 g", curto:"% <1500 g", tipo:"pct", sentido:"neutro",
   num:(m,a)=> somaLinhas(m,"neo_peso",[R.p1,R.p2],a), den:(m,a)=> totalSem(m,"neo_peso",[R.pIgn],a), fonte:"SIM-DO",
   desc:"Entre os óbitos neonatais com peso informado, proporção com menos de 1500 g."},
  {id:"n2500", eixo:"neonatal", rot:"% de óbitos neonatais com peso ≥2500 g", curto:"% ≥2500 g", tipo:"pct", sentido:"menor",
   num:(m,a)=> somaLinhas(m,"neo_peso",[R.p4,R.p5],a), den:(m,a)=> totalSem(m,"neo_peso",[R.pIgn],a), fonte:"SIM-DO",
   desc:"Entre os óbitos neonatais com peso informado, proporção com 2500 g ou mais — recém-nascidos de peso adequado, óbitos em geral mais evitáveis."},
  {id:"nevit", eixo:"neonatal", rot:"% de óbitos neonatais por causas evitáveis (LBE)", curto:"% causas evitáveis", tipo:"pct", sentido:"menor",
   num:(m,a)=> somaLinhas(m,"neo_lbe",LBE_EVITAVEIS,a), den:(m,a)=> linha(m,"neo_lbe","Total")?.[a], fonte:"SIM-DO",
   desc:"Entre os óbitos neonatais, proporção por causas evitáveis por intervenções do SUS (Lista Brasileira: imunoprevenção, atenção à gestação, ao parto, ao recém-nascido, diagnóstico/tratamento e promoção à saúde)."},
  {id:"nges", eixo:"neonatal", rot:"% de óbitos neonatais reduzíveis por atenção à mulher na gestação", curto:"% reduzíveis na gestação", tipo:"pct", sentido:"menor",
   num:(m,a)=> linha(m,"neo_lbe",R.lGes)?.[a], den:(m,a)=> linha(m,"neo_lbe","Total")?.[a], fonte:"SIM-DO",
   desc:"Entre os óbitos neonatais, proporção por causas reduzíveis por adequada atenção à mulher na gestação (LBE)."},
  {id:"npar", eixo:"neonatal", rot:"% de óbitos neonatais reduzíveis por atenção à mulher no parto", curto:"% reduzíveis no parto", tipo:"pct", sentido:"menor",
   num:(m,a)=> linha(m,"neo_lbe",R.lPar)?.[a], den:(m,a)=> linha(m,"neo_lbe","Total")?.[a], fonte:"SIM-DO",
   desc:"Entre os óbitos neonatais, proporção por causas reduzíveis por adequada atenção à mulher no parto (LBE)."},
  {id:"nrn", eixo:"neonatal", rot:"% de óbitos neonatais reduzíveis por atenção ao recém-nascido", curto:"% reduzíveis no RN", tipo:"pct", sentido:"menor",
   num:(m,a)=> linha(m,"neo_lbe",R.lRN)?.[a], den:(m,a)=> linha(m,"neo_lbe","Total")?.[a], fonte:"SIM-DO",
   desc:"Entre os óbitos neonatais, proporção por causas reduzíveis por adequada atenção ao recém-nascido (LBE)."},
  {id:"nmal", eixo:"neonatal", rot:"% de óbitos neonatais por causas mal definidas", curto:"% mal definidas", tipo:"pct", sentido:"menor",
   num:(m,a)=> linha(m,"neo_causas",R.cMal)?.[a], den:(m,a)=> linha(m,"neo_causas","Total")?.[a], fonte:"SIM-DO",
   desc:"Entre os óbitos neonatais, proporção com causa básica mal definida (R00 a R99, P95) — qualidade da investigação do óbito."},
  {id:"nanom", eixo:"neonatal", rot:"% de óbitos neonatais por anomalias congênitas", curto:"% anomalias congênitas", tipo:"pct", sentido:"neutro",
   num:(m,a)=> linha(m,"neo_causas",R.cAnom)?.[a], den:(m,a)=> linha(m,"neo_causas","Total")?.[a], fonte:"SIM-DO",
   desc:"Entre os óbitos neonatais, proporção por anomalias congênitas (capítulo XVII da CID-10)."}
];
const EIXOS = [
  {id:"geral", rot:"Visão geral"}, {id:"materna", rot:"Mortalidade materna"},
  {id:"fetal", rot:"Mortalidade fetal"}, {id:"perinatal", rot:"Mortalidade perinatal"}, {id:"neonatal", rot:"Mortalidade neonatal"}
];
const indPorId = id => INDS.find(i => i.id === id);
/* indicadores únicos (sem os repetidos da visão geral) — usados no comparador e nas fichas */
const INDS_UNICOS = INDS.filter(i => !i.alias);
const fmtInd = (ind, v) => ind.tipo === "num" ? fmtInt(v) : ind.tipo === "taxa" ? fmtTaxa(v) : fmtPct(v);

/* valor de um indicador para UMA maternidade num ano (a = 0..NT) */
function valorUnidade(mt, ind, a){
  const n = ind.num(mt, a);
  if(ind.tipo === "num") return n;
  const d = ind.den(mt, a);
  return (n != null && d) ? n / d * (ind.fator || 100) : null;
}
/* agregação de uma lista de maternidades: soma numeradores e denominadores */
function agrega(lista, ind, a){
  if(ind.tipo === "num"){
    let s = 0, tem = false;
    lista.forEach(m => { const v = ind.num(m, a); if(v != null){ s += v; tem = true; } });
    return tem ? s : null;
  }
  let sn = 0, sd = 0;
  lista.forEach(m => {
    const n = ind.num(m, a), d = ind.den(m, a);
    if(n == null || d == null) return;
    sn += n; sd += d;
  });
  return sd > 0 ? sn / sd * (ind.fator || 100) : null;
}

/* ---------------- estado ---------------- */
const estado = {
  nivel:"uf", regiao:null, uf:null,
  eixoMapa:"geral", indMapa:"tmn", anoMapa:NT-1,
  cnes:MAT[0].cnes,
  comparar:[]
};
function selecionadas(){
  if(estado.uf) return MAT.filter(m => m.uf === estado.uf);
  if(estado.regiao) return MAT.filter(m => (REGIAO_UFS[estado.regiao] || []).includes(m.uf));
  return MAT;
}
function rotuloSelecao(){
  if(estado.uf) return UF_NOME[estado.uf];
  if(estado.regiao) return "Região " + estado.regiao;
  return "Brasil";
}

/* ============================================================
   MAPA SVG — coroplético com zoom por viewBox
   ============================================================ */
const svgBox = document.getElementById("mapaSvg");
let svgEl = null, vbHome = [0, 0, GEO.W, GEO.H];

function mostraTipMapa(e, html){
  const tip = document.getElementById("tipMapa");
  tip.innerHTML = html;
  tip.hidden = false;
  const larg = 310;
  tip.style.left = Math.min(e.clientX + 14, window.innerWidth - larg - 12) + "px";
  tip.style.top = Math.min(e.clientY + 14, window.innerHeight - tip.offsetHeight - 12) + "px";
}
function escondeTipMapa(){ document.getElementById("tipMapa").hidden = true; }

/* rampa de mortalidade: creme → vinho (mais escuro = maior) */
const RAMPA = ["#FBE9DA","#F5C4A1","#E8926B","#CF5A3F","#8C2A2A"];
const ESCURAS = new Set(["#CF5A3F","#8C2A2A"]);
function limiaresQuintis(vals){
  const ord = vals.filter(x => x != null).sort((a, b) => a - b);
  if(!ord.length) return null;
  const q = p => ord[Math.min(ord.length - 1, Math.floor(p * ord.length))];
  return [q(.2), q(.4), q(.6), q(.8)];
}
function corIndicador(v, lims){
  if(v == null || !lims) return "var(--sem-dado)";
  let i = 0;
  lims.forEach((t, k) => { if(v > t) i = k + 1; });
  return RAMPA[i];
}

function ufDoTerritorio(t){
  if(estado.nivel === "uf") return t.id;
  const m = /-\s*([A-Z]{2})\s*$/.exec(t.nome || "");
  return m ? m[1] : null;
}
const ufDoTerritorioNivel = (nivel, t) => nivel === "uf" ? t.id : ((/-\s*([A-Z]{2})\s*$/.exec(t.nome || "") || [])[1] || null);

/* cache: quais maternidades pertencem a cada território de cada nível */
const _cacheTerr = {};
function unidadesDoTerritorio(nivel, ti){
  if(!_cacheTerr[nivel]){
    _cacheTerr[nivel] = GEO.niveis[nivel].map(tt => {
      if(nivel === "uf") return MAT.filter(m => m.uf === tt.id);
      const uf = ufDoTerritorioNivel(nivel, tt);
      return MAT.filter(m => m.uf === uf && territorioContem(nivel, tt, m));
    });
  }
  return _cacheTerr[nivel][ti];
}
function territorioContem(nivel, t, m){
  // id da malha resolvido no build (build_dados.py); sem id, heurística pelo nome
  if(m.geo && m.geo[nivel] != null) return String(m.geo[nivel]) === String(t.id);
  const alvo = nivel === "macro" ? m.territorio.macro : m.territorio.regiao_saude;
  return simil(t.nome, alvo);
}
function normTxt(s){
  return String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toUpperCase()
    .replace(/MACRORREGIONAL|MACRORREGIAO|MACROREGIAO|MACRO|REGIAO DE SAUDE|REGIONAL|\bRS\b|SAUDE|\bDE\b|\bDA\b|\bDO\b|\bE\b|\bUNICA\b|[^A-Z0-9 ]/g," ")
    .replace(/\s+/g," ").trim();
}
function simil(a, b){
  const A = new Set(normTxt(a).split(" ").filter(Boolean));
  const B = new Set(normTxt(b).split(" ").filter(Boolean));
  if(!A.size || !B.size) return false;
  let inter = 0; A.forEach(x => { if(B.has(x)) inter++; });
  return inter / Math.min(A.size, B.size) >= 0.6;
}

/* detalhe do valor no tooltip: numerador e denominador */
const DEN_NOME = {
  mdir:"óbitos maternos", mind:"óbitos maternos", mhip:"óbitos maternos diretos", mhem:"óbitos maternos diretos", minf:"óbitos maternos diretos",
  fante:"óbitos fetais com momento informado", fintra:"óbitos fetais com momento informado", f1500:"óbitos fetais com peso informado",
  f2500:"óbitos fetais com peso informado", fmal:"óbitos fetais", pfet:"óbitos perinatais", p1500:"óbitos perinatais com peso informado",
  phip:"óbitos perinatais", panom:"óbitos perinatais", n0d:"óbitos neonatais", n1500:"óbitos neonatais com peso informado",
  n2500:"óbitos neonatais com peso informado", nevit:"óbitos neonatais", nges:"óbitos neonatais", npar:"óbitos neonatais",
  nrn:"óbitos neonatais", nmal:"óbitos neonatais", nanom:"óbitos neonatais"
};
function nomeDen(ind){
  if(ind.tipo === "taxa") return /NV/.test(ind.unidade || "") ? "nascidos vivos" : "nascimentos (NV + óbitos fetais)";
  return DEN_NOME[ind.id] || "no denominador";
}
function detalheAgregado(lst, ind, a){
  if(ind.tipo === "num" || !lst.length) return "";
  let sn = 0, sd = 0;
  lst.forEach(m => { const n = ind.num(m, a), d = ind.den(m, a); if(n != null && d != null){ sn += n; sd += d; } });
  return sd ? `<div class="tm-nd">${fmtInt(sn)} óbitos / ${fmtInt(sd)} ${nomeDen(ind)}</div>` : "";
}

function desenhaMapa(){
  const ind = indPorId(estado.indMapa), a = estado.anoMapa;
  const terr = GEO.niveis[estado.nivel];
  const valorTerr = terr.map((t, ti) => {
    const lst = unidadesDoTerritorio(estado.nivel, ti);
    return lst.length ? agrega(lst, ind, a) : null;
  });
  const ufsRecorte = estado.uf ? [estado.uf] : estado.regiao ? (REGIAO_UFS[estado.regiao] || []) : null;
  const vals = valorTerr.filter((v, ti) =>
    v != null && (!ufsRecorte || ufsRecorte.includes(ufDoTerritorio(terr[ti]))));
  const lims = limiaresQuintis(vals);

  svgBox.innerHTML = "";
  svgEl = document.createElementNS(NS, "svg");
  svgEl.setAttribute("viewBox", vbHome.join(" "));
  svgEl.setAttribute("role", "img");
  svgEl.setAttribute("aria-label", "Mapa do Brasil");
  const ufsVisiveis = ufsRecorte;
  const g = document.createElementNS(NS, "g");
  terr.forEach((t, ti) => {
    const uf = ufDoTerritorio(t);
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", t.d);
    p.setAttribute("class", "t");
    if(ufsVisiveis && !ufsVisiveis.includes(uf)) p.style.display = "none";
    const v = valorTerr[ti];
    p.setAttribute("fill", corIndicador(v, lims));
    const nomeT = estado.nivel === "uf" ? UF_NOME[t.id] : t.nome;
    const lst = unidadesDoTerritorio(estado.nivel, ti);
    const maxLista = 7;
    const nomes = lst.slice(0, maxLista).map(m => `<li>${esc(m.nome)}</li>`).join("") +
      (lst.length > maxLista ? `<li>+ ${lst.length - maxLista} outras</li>` : "");
    const tipHtml = `<div class="tm-titulo">${esc(nomeT)}</div>
      ${v != null ? `<div class="tm-valor">${esc(ind.curto)} · ${rotAnoCurto(a)}: ${fmtInd(ind, v)}${ind.unidade ? " " + ind.unidade : ""}</div>${detalheAgregado(lst, ind, a)}` : (lst.length ? `<div class="tm-nd">Sem dado no período.</div>` : "")}
      ${lst.length
        ? `Maternidade${lst.length > 1 ? "s" : ""} do painel (${lst.length}):<ul>${nomes}</ul>`
        : `<div class="tm-sem">Sem maternidade do painel neste território.</div>`}`;
    p.addEventListener("mousemove", e => mostraTipMapa(e, tipHtml));
    p.addEventListener("mouseleave", escondeTipMapa);
    p.addEventListener("click", () => { escondeTipMapa(); cliqueTerritorio(t, p); });
    g.appendChild(p);
  });
  if(estado.nivel !== "uf"){
    const bordasUF = ufsVisiveis
      ? GEO.niveis.uf.filter(t => ufsVisiveis.includes(t.id)).map(t => t.d)
      : (GEO.bordaUF ? [GEO.bordaUF] : []);
    bordasUF.forEach(d => {
      const b = document.createElementNS(NS, "path");
      b.setAttribute("d", d);
      b.setAttribute("fill", "none");
      b.setAttribute("stroke", "var(--indigo)");
      b.setAttribute("stroke-width", ufsVisiveis ? "1.4" : "1");
      b.setAttribute("vector-effect", "non-scaling-stroke");
      b.setAttribute("pointer-events", "none");
      b.setAttribute("opacity", ".45");
      g.appendChild(b);
    });
  }
  svgEl.appendChild(g);
  svgBox.appendChild(svgEl);

  if(estado.nivel === "uf"){
    const paths = svgEl.querySelectorAll("path.t");
    terr.forEach((t, i) => {
      if(paths[i].style.display === "none") return;
      const bb = paths[i].getBBox();
      if(bb.width < 14 && bb.height < 14) return;
      const txt = document.createElementNS(NS, "text");
      txt.setAttribute("x", (bb.x + bb.width/2).toFixed(1));
      txt.dataset.cy = (bb.y + bb.height/2).toFixed(1);
      txt.setAttribute("text-anchor", "middle");
      txt.setAttribute("class", "sigla");
      txt.setAttribute("fill", ESCURAS.has(paths[i].getAttribute("fill")) ? "#FFFFFF" : "#0A213D");
      txt.textContent = t.id;
      g.appendChild(txt);
    });
  }
  if(estado.uf) zoomUFs([estado.uf], false);
  else if(estado.regiao) zoomUFs(REGIAO_UFS[estado.regiao] || [], false);
  if(estado.nivel === "uf"){
    const vbw = Number(svgEl.getAttribute("viewBox").split(" ")[2]);
    const fsSigla = 13 * vbw / GEO.W;
    svgEl.querySelectorAll("text.sigla").forEach(tx => {
      tx.setAttribute("font-size", fsSigla.toFixed(2));
      tx.setAttribute("y", (Number(tx.dataset.cy) + fsSigla * 0.35).toFixed(1));
    });
  }
  desenhaLegenda(ind, lims, vals);
  desenhaPainelSelecao();
}

function cliqueTerritorio(t){
  const uf = ufDoTerritorio(t);
  if(estado.uf === uf){ limparSelecaoMapa(); return; }
  estado.uf = uf;
  estado.regiao = Object.keys(REGIAO_UFS).find(r => REGIAO_UFS[r].includes(uf)) || null;
  sincronizaFiltrosMapa();
  desenhaMapa();
}
function limparSelecaoMapa(){
  estado.uf = null;
  estado.regiao = null;
  sincronizaFiltrosMapa();
  animaViewBox(vbHome);
  desenhaMapa();
}
function preencheUFMapa(){
  const sUM = document.getElementById("selUFMapa");
  const ufs = estado.regiao ? [...(REGIAO_UFS[estado.regiao] || [])].sort() : Object.keys(UF_NOME).sort();
  sUM.innerHTML = `<option value="">${estado.regiao ? "Toda a região " + estado.regiao : "Todo o Brasil"}</option>` +
    ufs.map(u => `<option value="${u}">${UF_NOME[u]}</option>`).join("");
  sUM.value = estado.uf || "";
}
function sincronizaFiltrosMapa(){
  preencheUFMapa();
  document.getElementById("selRegiaoMapa").value = estado.regiao || "";
  document.getElementById("btnResetMapa").hidden = !(estado.uf || estado.regiao);
}
function zoomUFs(ufs, animar = true){
  const terr = GEO.niveis[estado.nivel];
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, achou = false;
  const paths = svgEl.querySelectorAll("path.t");
  terr.forEach((t, i) => {
    if(!ufs.includes(ufDoTerritorio(t))) return;
    const bb = paths[i].getBBox();
    x0 = Math.min(x0, bb.x); y0 = Math.min(y0, bb.y);
    x1 = Math.max(x1, bb.x + bb.width); y1 = Math.max(y1, bb.y + bb.height);
    achou = true;
  });
  if(!achou) return;
  const pad = Math.max((x1-x0), (y1-y0)) * 0.12;
  const vb = [x0-pad, y0-pad, (x1-x0)+2*pad, (y1-y0)+2*pad];
  if(animar) animaViewBox(vb); else svgEl.setAttribute("viewBox", vb.join(" "));
}
let animId = null;
function animaViewBox(alvo){
  if(!svgEl) return;
  cancelAnimationFrame(animId);
  const de = svgEl.getAttribute("viewBox").split(" ").map(Number);
  const t0 = performance.now(), dur = 480;
  const passo = now => {
    const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    const vb = de.map((v, i) => v + (alvo[i] - v) * e);
    svgEl.setAttribute("viewBox", vb.map(v => v.toFixed(1)).join(" "));
    if(k < 1) animId = requestAnimationFrame(passo);
  };
  animId = requestAnimationFrame(passo);
}

function itensLegenda(ind, lims, vals){
  let itens = [];
  if(lims){
    const fmt = v => fmtInd(ind, v);
    const distintos = [...new Set(vals)].sort((a, b) => a - b);
    if(distintos.length <= 5){
      itens = distintos.map(v => ({c:corIndicador(v, lims), r:fmt(v)}));
    } else {
      const rot = ["≤ " + fmt(lims[0]), fmt(lims[0]) + " - " + fmt(lims[1]), fmt(lims[1]) + " - " + fmt(lims[2]),
                   fmt(lims[2]) + " - " + fmt(lims[3]), "> " + fmt(lims[3])];
      itens = RAMPA.map((c, i) => ({c, r:rot[i]}));
    }
  }
  return itens;
}
function desenhaLegenda(ind, lims, vals){
  const nomeNivel = {uf:"UF", macro:"macrorregião de saúde", rs:"região de saúde"}[estado.nivel];
  const tl = document.getElementById("tituloLegenda");
  if(tl) tl.textContent = ind.curto + (ind.unidade ? " (" + ind.unidade + ")" : "") + " · por " + nomeNivel + " · " + rotuloSelecao() + " · " + rotAnoCurto(estado.anoMapa);
  const itens = itensLegenda(ind, lims, vals);
  itens.push({c:"var(--sem-dado)", r:"sem maternidade do painel / sem dado"});
  document.getElementById("legendaMapa").innerHTML = itens.map(i => `<span><i style="background:${i.c}"></i>${i.r}</span>`).join("");
  const di = document.getElementById("descIndMapa");
  if(di) di.textContent = ind.desc;
}

function desenhaPainelSelecao(){
  const lst = selecionadas();
  const a = estado.anoMapa;
  const el = document.getElementById("painelSelecao");
  const kpis = ["nv","obm","rmm","obf","tmf","obp","tmp","obn","tmn"].map(id => {
    const ind = indPorId(id);
    const v = agrega(lst, ind, a);
    return `<div class="kpi"><span>${esc(ind.curto)}</span><span class="v mono">${fmtInd(ind, v)}${ind.unidade ? ` <small>${ind.unidade}</small>` : ""}</span></div>`;
  }).join("");
  el.innerHTML = `
    <p class="eyebrow">${esc(rotuloSelecao())} · ${rotAno(a)}</p>
    <p style="margin-top:.15rem"><b class="mono" style="font-size:1.35rem; color:var(--verde-esmeralda)">${lst.length}</b>
      <span class="suave" style="font-size:.85rem"> maternidade${lst.length > 1 ? "s" : ""} do painel na seleção</span></p>
    <div class="kpi-lista">${kpis}</div>
    <p class="fonte" style="margin-top:.5rem">Taxas agregadas: soma dos óbitos ÷ soma dos denominadores das maternidades da seleção. Toque em um território para filtrar.</p>`;
}

/* ============================================================
   COMPARATIVO ENTRE ANOS — dois mapas lado a lado, mesmo indicador, faixas comuns
   ============================================================ */
const compSel = {regiao:null, uf:null, nivel:"uf", ind:"tmn"};

let _centrosUF = null;
function centroUF(svg, uf){
  if(!_centrosUF){
    _centrosUF = {};
    GEO.niveis.uf.forEach(t => {
      const p = document.createElementNS(NS, "path");
      p.setAttribute("d", t.d);
      p.setAttribute("fill", "none");
      svg.appendChild(p);
      const bb = p.getBBox();
      _centrosUF[t.id] = [bb.x + bb.width/2, bb.y + bb.height/2];
      svg.removeChild(p);
    });
  }
  return _centrosUF[uf];
}

function valoresComp(nivel, a){
  const terr = GEO.niveis[nivel];
  const ind = indPorId(compSel.ind);
  return terr.map((t, ti) => {
    const lst = unidadesDoTerritorio(nivel, ti);
    return lst.length ? agrega(lst, ind, a) : null;
  });
}

function desenhaMapaCompEm(alvoId, a, valores, lims){
  const terr = GEO.niveis[compSel.nivel];
  const ind = indPorId(compSel.ind);
  const ufsVis = compSel.uf ? [compSel.uf] : compSel.regiao ? (REGIAO_UFS[compSel.regiao] || []) : null;
  const box = document.getElementById(alvoId);
  box.innerHTML = "";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", vbHome.join(" "));
  const g = document.createElementNS(NS, "g");
  const visiveis = [];
  terr.forEach((t, ti) => {
    const uf = ufDoTerritorioNivel(compSel.nivel, t);
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", t.d);
    p.setAttribute("class", "t");
    if(ufsVis && !ufsVis.includes(uf)){ p.style.display = "none"; }
    else visiveis.push(p);
    const v = valores[ti];
    p.setAttribute("fill", corIndicador(v, lims));
    const nomeT = compSel.nivel === "uf" ? UF_NOME[t.id] : t.nome;
    const lst = unidadesDoTerritorio(compSel.nivel, ti);
    const tip = `<div class="tm-titulo">${esc(nomeT)} · ${rotAnoCurto(a)}</div>
      ${v != null ? `<div class="tm-valor">${esc(ind.curto)}: ${fmtInd(ind, v)}${ind.unidade ? " " + ind.unidade : ""}</div>${detalheAgregado(lst, ind, a)}
             <div>${lst.length} maternidade${lst.length > 1 ? "s" : ""} do painel</div>`
          : `<div class="tm-sem">${lst.length ? "Sem dado no ano." : "Sem maternidade do painel."}</div>`}`;
    p.addEventListener("mousemove", e => mostraTipMapa(e, tip));
    p.addEventListener("mouseleave", escondeTipMapa);
    g.appendChild(p);
  });
  if(compSel.nivel !== "uf"){
    const bordasUF = ufsVis
      ? GEO.niveis.uf.filter(t => ufsVis.includes(t.id)).map(t => t.d)
      : (GEO.bordaUF ? [GEO.bordaUF] : []);
    bordasUF.forEach(d => {
      const b = document.createElementNS(NS, "path");
      b.setAttribute("d", d);
      b.setAttribute("fill", "none");
      b.setAttribute("stroke", "var(--indigo)");
      b.setAttribute("stroke-width", ufsVis ? "1.4" : "1");
      b.setAttribute("vector-effect", "non-scaling-stroke");
      b.setAttribute("pointer-events", "none");
      b.setAttribute("opacity", ".5");
      g.appendChild(b);
    });
  }
  svg.appendChild(g);
  box.appendChild(svg);
  if(ufsVis && visiveis.length){
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    visiveis.forEach(p => {
      const bb = p.getBBox();
      x0 = Math.min(x0, bb.x); y0 = Math.min(y0, bb.y);
      x1 = Math.max(x1, bb.x + bb.width); y1 = Math.max(y1, bb.y + bb.height);
    });
    const pad = Math.max(x1 - x0, y1 - y0) * 0.06;
    svg.setAttribute("viewBox", [x0 - pad, y0 - pad, (x1 - x0) + 2*pad, (y1 - y0) + 2*pad].map(v => v.toFixed(1)).join(" "));
  }
  const vb = svg.getAttribute("viewBox").split(" ").map(Number);
  const fs = vb[2] / 62;
  (ufsVis || Object.keys(UF_NOME)).forEach(uf => {
    const c = centroUF(svg, uf);
    if(!c) return;
    const txt = document.createElementNS(NS, "text");
    txt.setAttribute("x", c[0].toFixed(1));
    txt.setAttribute("y", (c[1] + fs * 0.35).toFixed(1));
    txt.setAttribute("text-anchor", "middle");
    txt.setAttribute("font-size", fs.toFixed(1));
    txt.setAttribute("font-weight", "800");
    txt.setAttribute("fill", "#0A213D");
    txt.setAttribute("stroke", "#FFFFFF");
    txt.setAttribute("stroke-width", (fs * 0.16).toFixed(1));
    txt.setAttribute("paint-order", "stroke");
    txt.setAttribute("pointer-events", "none");
    txt.textContent = uf;
    svg.appendChild(txt);
  });
}

function desenhaComparativo(){
  const aA = +document.getElementById("selAnoCompA").value;
  const aB = +document.getElementById("selAnoCompB").value;
  const ind = indPorId(compSel.ind);
  const terr = GEO.niveis[compSel.nivel];
  const vA = valoresComp(compSel.nivel, aA), vB = valoresComp(compSel.nivel, aB);
  const ufsVis = compSel.uf ? [compSel.uf] : compSel.regiao ? (REGIAO_UFS[compSel.regiao] || []) : null;
  const visivel = ti => !ufsVis || ufsVis.includes(ufDoTerritorioNivel(compSel.nivel, terr[ti]));
  // faixas comuns aos dois mapas: quintis do conjunto dos dois anos
  const vals = [...vA.filter((v, ti) => v != null && visivel(ti)), ...vB.filter((v, ti) => v != null && visivel(ti))];
  const lims = limiaresQuintis(vals);
  desenhaMapaCompEm("mapaCompA", aA, vA, lims);
  desenhaMapaCompEm("mapaCompB", aB, vB, lims);
  const nomeNivel = {uf:"UF", macro:"macrorregião de saúde", rs:"região de saúde"}[compSel.nivel];
  document.getElementById("tituloLegComp").textContent =
    ind.curto + (ind.unidade ? " (" + ind.unidade + ")" : "") + " · por " + nomeNivel + " · " + (compSel.uf ? UF_NOME[compSel.uf] : compSel.regiao ? "Região " + compSel.regiao : "Brasil") + " · faixas comuns a " + rotAnoCurto(aA) + " e " + rotAnoCurto(aB);
  const itens = itensLegenda(ind, lims, vals);
  itens.push({c:"var(--sem-dado)", r:"sem maternidade do painel / sem dado"});
  document.getElementById("legendaComp").innerHTML = itens.map(i => `<span><i style="background:${i.c}"></i>${i.r}</span>`).join("");
}

/* ============================================================
   MAPA LEAFLET — pontos das unidades
   ============================================================ */
let leaf = null, camadaEstr = null, camadaCtx = null;
function iniciaLeaflet(){
  leaf = L.map("mapaLeaflet", {scrollWheelZoom:true}).setView([-14.5, -52], 4);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom:18
  }).addTo(leaf);
  desenhaPontos();
}
/* grupos da lista oficial de 09/09/2026: apoiadas (estratégicas) em verde; EBSERH e QUALINEO em azuis */
const CONJUNTOS = {
  apoiada:  {rot:"Maternidade apoiada (estratégica)", fundo:"#279261", borda:"#154A4B"},
  ebserh:   {rot:"Unidade EBSERH",                    fundo:"#2471A3", borda:"#103B5E"},
  qualineo: {rot:"QUALINEO 2026/2027",                fundo:"#5FB0D9", borda:"#1B6B8F"},
};
const ORDEM_CONJ = ["apoiada", "ebserh", "qualineo"];
/* uma unidade pode pertencer a mais de um grupo (ex.: APOIADA/QUALINEO). Para não repeti-la em
   dois seletores, cada uma entra só no primeiro desta ordem — que é também a cor que recebe no mapa. */
function conjuntoPrincipal(m){
  const c = m.conjuntos || ["apoiada"];
  return ORDEM_CONJ.find(k => c.includes(k)) || "apoiada";
}
function corDoConjunto(m){ return CONJUNTOS[conjuntoPrincipal(m)]; }
function rotuloConjuntos(m){
  const c = m.conjuntos || ["apoiada"];
  return ORDEM_CONJ.filter(k => c.includes(k)).map(k => CONJUNTOS[k].rot).join(" · ");
}
function passaFiltroPonto(p){
  const reg = document.getElementById("selRegiaoLeaflet").value;
  const uf = document.getElementById("selUFLeaflet").value;
  const q = normTxt(document.getElementById("buscaUnidade").value);
  if(reg && !(REGIAO_UFS[reg] || []).includes(p.uf)) return false;
  if(uf && p.uf !== uf) return false;
  if(q && !normTxt(p.nome).includes(q)) return false;
  return true;
}
function desenhaPontos(){
  if(!leaf) return;
  if(camadaEstr){ leaf.removeLayer(camadaEstr); camadaEstr = null; }
  if(camadaCtx){ leaf.removeLayer(camadaCtx); camadaCtx = null; }
  if(document.getElementById("chkContexto").checked){
    camadaCtx = L.markerClusterGroup({maxClusterRadius:44, disableClusteringAtZoom:9});
    PONTOS.filter(passaFiltroPonto).forEach(p => {
      const mk = L.circleMarker([p.lat, p.lon], {radius:4.5, color:"#7A8C80", weight:1, fillColor:"#AEBFB4", fillOpacity:.75});
      mk.bindPopup(`<div class="pop-nome">${esc(p.nome)}</div>
        <div>${esc(p.mun)} · ${p.uf} · CNES ${p.cnes}</div>
        <div>${fmtInt(p.partos)} partos em 2025 (SIH/AIH)</div>`);
      mk.on("click", () => leaf.flyTo(mk.getLatLng(), Math.max(leaf.getZoom(), 10), {duration:.7}));
      camadaCtx.addLayer(mk);
    });
    leaf.addLayer(camadaCtx);
  }
  camadaEstr = L.markerClusterGroup({maxClusterRadius:30, disableClusteringAtZoom:7});
  const visiveis = [];
  const a = NT - 1;
  MAT.filter(m => passaFiltroPonto({uf:m.uf, nome:m.nome + " " + (m.nomePlanilha || "")})).forEach(m => {
    if(m.lat == null) return;
    visiveis.push([m.lat, m.lon]);
    const cor = corDoConjunto(m);
    const li = (rotN, idN, idT) => {
      const n = valorUnidade(m, indPorId(idN), a), t = valorUnidade(m, indPorId(idT), a), ind = indPorId(idT);
      return `<div>${rotN}: <b>${fmtInt(n)}</b>${t != null ? ` · ${esc(ind.curto)} <b>${fmtTaxa(t)}</b> <span style="color:#4E6A5C">${ind.unidade}</span>` : ""}</div>`;
    };
    const mk = L.circleMarker([m.lat, m.lon], {radius:8, color:cor.borda, weight:2, fillColor:cor.fundo, fillOpacity:.95});
    mk.bindPopup(`<div class="pop-nome">${esc(m.nome)}</div>
      <div>${esc(m.territorio.municipio)} · ${m.uf} · CNES ${m.cnes}</div>
      <div style="color:${cor.borda}; font-weight:700">${esc(rotuloConjuntos(m))}</div>
      <div style="margin-top:.25rem">Nascidos vivos ${ANOS[a]}: <b>${fmtInt(NV(m, a))}</b></div>
      ${li("Óbitos maternos", "obm", "rmm")}
      ${li("Óbitos fetais", "obf", "tmf")}
      ${li("Óbitos neonatais", "obn", "tmn")}
      <a class="pop-btn" href="#" onclick="abrirDossie('${m.cnes}');return false;">Abrir dossiê →</a>`);
    mk.on("click", () => leaf.flyTo(mk.getLatLng(), Math.max(leaf.getZoom(), 11), {duration:.7}));
    camadaEstr.addLayer(mk);
  });
  leaf.addLayer(camadaEstr);
  if(visiveis.length && (document.getElementById("selRegiaoLeaflet").value || document.getElementById("selUFLeaflet").value || document.getElementById("buscaUnidade").value)){
    leaf.fitBounds(visiveis, {padding:[36,36], maxZoom:11});
  }
}

/* ============================================================
   GRÁFICOS SVG
   ============================================================ */
function grafLinhas(alvo, series, opts = {}){
  // series: [{nome, cor, vals:[…por ano…], dash}]
  const comRotulos = opts.rotulos !== false && series.length === 1;
  const W = 640, H = 320, mL = 52, mR = 22, mT = comRotulos ? 34 : 18, mB = 30;
  const todos = series.flatMap(s => s.vals).filter(v => v != null);
  const el = document.getElementById(alvo);
  if(!todos.length){ el.innerHTML = "<p class='suave'>Sem dados.</p>"; return; }
  let max = Math.max(...todos), min = Math.min(...todos);
  if(opts.zero !== false) min = 0;
  const span = (max - min) || 1; max += span * .12; if(opts.zero === false) min = Math.max(0, min - span * .12);
  const X = i => mL + (W - mL - mR) * i / (NT - 1);
  const Y = v => H - mB - (H - mT - mB) * (v - min) / (max - min);
  const fmt = opts.fmt || (opts.pct ? fmtPct : opts.taxa ? fmtTaxa : fmtInt);
  let s = `<svg class="graf" viewBox="0 0 ${W} ${H}">`;
  for(let k = 0; k <= 4; k++){
    const v = min + (max - min) * k / 4, y = Y(v);
    s += `<line x1="${mL}" y1="${y.toFixed(1)}" x2="${W-mR}" y2="${y.toFixed(1)}" stroke="#D8E8DC" stroke-width="1"/>`;
    s += `<text x="${mL-6}" y="${(y+4).toFixed(1)}" text-anchor="end" font-size="11.5" fill="#4E6A5C">${opts.pct ? Math.round(v) + "%" : opts.taxa ? fmtTaxa(v) : fmtInt(v)}</text>`;
  }
  ANOS.forEach((ano, i) => {
    s += `<text x="${X(i).toFixed(1)}" y="${H-8}" text-anchor="middle" font-size="12" font-weight="700" fill="#1D3229">${ano}${PRELIM.has(ano) ? "*" : ""}</text>`;
  });
  series.forEach(sr => {
    let d = "", prev = false;
    sr.vals.forEach((v, i) => {
      if(v == null){ prev = false; return; }
      d += (prev ? "L" : "M") + X(i).toFixed(1) + "," + Y(v).toFixed(1);
      prev = true;
    });
    s += `<path d="${d}" fill="none" stroke="${sr.cor}" stroke-width="3"${sr.dash ? ' stroke-dasharray="8 6"' : ""} stroke-linecap="round" stroke-linejoin="round"/>`;
    sr.vals.forEach((v, i) => {
      if(v == null) return;
      const _rot = fmt(v);
      s += `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="4" fill="${sr.cor}"><title>${esc(sr.nome)} · ${ANOS[i]} · ${_rot}${sr.extra && sr.extra[i] ? " · " + esc(sr.extra[i]) : ""}</title></circle>`;
      if(comRotulos){
        s += `<text x="${X(i).toFixed(1)}" y="${(Y(v) - 11).toFixed(1)}" text-anchor="middle" font-size="11.5" font-weight="700" fill="#1D3229">${_rot}</text>`;
      }
    });
  });
  s += "</svg>";
  let leg = "";
  if(series.length > 1 || opts.legenda){
    leg = `<div class="legenda">` + series.map(sr => `<span><i style="background:${sr.cor}"></i>${esc(sr.nome)}</span>`).join("") + `</div>`;
  }
  el.innerHTML = s + leg + (PRELIM.size ? `<p class="fonte" style="margin-top:.3rem">* dados preliminares, sujeitos a revisão.</p>` : "");
}
function grafRanking(alvo, itens, opts = {}){
  const linhas = itens.filter(i => i.v != null).sort((a,b) => opts.sentido === "menor" ? a.v - b.v : b.v - a.v).slice(0, 15);
  if(!linhas.length){ document.getElementById(alvo).innerHTML = "<p class='suave'>Sem dados na seleção.</p>"; return; }
  const W = 640, rh = 27, mL = 8, H = linhas.length * rh + 12;
  const max = Math.max(...linhas.map(i => i.v), 1e-9);
  const fmt = opts.fmt || fmtInt;
  let s = `<svg class="graf" viewBox="0 0 ${W} ${H}">`;
  linhas.forEach((it, i) => {
    const y = 8 + i * rh, w = (W - 275) * it.v / max;
    s += `<text x="${mL}" y="${y+13}" font-size="11.8" fill="#1D3229">${esc(it.nome.length > 30 ? it.nome.slice(0,29) + "…" : it.nome)}</text>`;
    s += `<rect x="205" y="${y}" width="${Math.max(w,2).toFixed(1)}" height="${rh-9}" rx="5" fill="${it.cor || "#279261"}"/>`;
    s += `<text x="${(207 + Math.max(w,2)).toFixed(1)}" y="${y+13}" font-size="11.8" font-weight="700" fill="#1D3229">${fmt(it.v)}</text>`;
  });
  s += "</svg>";
  document.getElementById(alvo).innerHTML = s;
}
/* barras horizontais de uma distribuição (modal do ano) */
function grafBarrasH(linhas, fmt, pctMax){
  // linhas: [{rot, v, sub}]
  const W = 660, rh = 40, mEsq = 230, H = linhas.length * rh + 12;
  const max = Math.max(...linhas.map(r => r.v), pctMax ? 100 : 1e-9);
  let s = `<svg class="graf" viewBox="0 0 ${W} ${H}">`;
  linhas.forEach((r, i) => {
    const v = r.v, y = 8 + i * rh;
    const w = (W - mEsq - 110) * v / max;
    const rot = String(r.rot);
    s += `<text x="${mEsq - 8}" y="${y + 17}" text-anchor="end" font-size="12.5" fill="#1D3229">${esc(rot.length > 32 ? rot.slice(0,31) + "…" : rot)}<title>${esc(rot)}</title></text>`;
    s += `<rect x="${mEsq}" y="${y + 5}" width="${Math.max(w, 2).toFixed(1)}" height="${rh - 16}" rx="6" fill="#279261"/>`;
    s += `<text x="${(mEsq + Math.max(w, 2) + 8).toFixed(1)}" y="${y + 17}" font-size="12.5" font-weight="800" fill="#1D3229">${fmt(v)}${r.sub ? ` <tspan font-weight="400" fill="#4E6A5C">${esc(r.sub)}</tspan>` : ""}</text>`;
  });
  return s + "</svg>";
}

/* ============================================================
   CARD — ficha de cadastro CNES e habilitações (API oficial)
   ============================================================ */
const dataBR = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ""); return m ? `${m[3]}/${m[2]}/${m[1]}` : iso; };
function cardCnesHTML(mt){
  const temInfo = typeof CNES_INFO !== "undefined" && CNES_INFO[mt.cnes];
  if(!temInfo){
    return `<h3>Ficha de cadastro CNES</h3>
      <p class="suave" style="margin-top:.5rem">Cadastro não embutido nesta versão do painel: rode <code>atualizar_cnes.py</code> e depois <code>montar_painel.py</code>.</p>`;
  }
  const info = CNES_INFO[mt.cnes];
  const gest = {M:"Municipal", E:"Estadual", D:"Dupla"}[(info.tipo_gestao || "").trim()] || info.tipo_gestao || null;
  const cep = info.codigo_cep_estabelecimento ? String(info.codigo_cep_estabelecimento).replace(/^(\d{5})(\d{3})$/, "$1-$2") : null;
  let end = [info.endereco_estabelecimento, info.numero_estabelecimento].filter(Boolean).join(", ");
  if(end && info.bairro_estabelecimento) end += " · " + info.bairro_estabelecimento;
  if(end && cep) end += " · CEP " + cep;
  const cnpj = info.numero_cnpj || info.numero_cnpj_entidade;
  const badges = [];
  if(info.estabelecimento_possui_centro_obstetrico) badges.push("Centro obstétrico");
  if(info.estabelecimento_possui_centro_neonatal) badges.push("Centro neonatal");
  if(info.estabelecimento_possui_centro_cirurgico) badges.push("Centro cirúrgico");
  if(info.estabelecimento_possui_atendimento_hospitalar) badges.push("Atendimento hospitalar");
  if(info.estabelecimento_faz_atendimento_ambulatorial_sus === "SIM") badges.push("Atendimento SUS");
  const consulta = CNES_INFO._atualizado_em;
  const linhasFicha = [
    ["Código CNES", mt.cnesComplexo ? mt.cnesComplexo.join(" + ") + " (complexo)" : mt.cnes],
    ["Razão social", info.nome_razao_social],
    ["Nome fantasia", info.nome_fantasia],
    ["CNPJ", cnpj],
    ["Esfera administrativa", info.descricao_esfera_administrativa],
    ["Gestão", gest],
    ["Endereço", end],
    ["Turno de atendimento", info.descricao_turno_atendimento],
    ["Estruturas cadastradas", badges.join(" · ")]
  ].filter(l => l[1]);
  return `<h3>Ficha de cadastro CNES</h3>
    <div class="tab-wrap" style="margin-top:.7rem"><table class="dados tab-verde tab-ficha">
      <thead><tr><th style="width:230px">Ficha do estabelecimento</th><th style="text-align:left">CNES / DATASUS</th></tr></thead>
      <tbody>${linhasFicha.map(l => `<tr><td style="font-weight:700">${l[0]}</td><td style="text-align:left; white-space:normal">${esc(l[1])}</td></tr>`).join("")}</tbody>
    </table></div>
    <p class="fonte" style="font-size:.8rem">
      <b>Última atualização do cadastro no CNES:</b> ${dataBR(info.data_atualizacao)} ·
      <b>Dados baixados da API oficial em:</b> ${dataBR(consulta)}. Fonte: Ministério da Saúde - Cadastro Nacional dos Estabelecimentos de Saúde do Brasil.
    </p>`;
}
function cardHabilitacoesHTML(mt){
  const info = typeof CNES_INFO !== "undefined" ? CNES_INFO[mt.cnes] : null;
  const habs = info && Array.isArray(info.habilitacoes) ? info.habilitacoes : null;
  if(!habs) return "";
  const ativas = habs.filter(h => h.dtCompFim === "99/9999")
    .sort((a, b) => String(a.coGrupo).localeCompare(String(b.coGrupo)));
  const origem = v => !v ? "Nacional" : (v === "P" ? "Local" : v);
  const consulta = CNES_INFO._atualizado_em;
  const corpo = ativas.length
    ? ativas.map(h => `<tr>
        <td class="mono" style="font-weight:700">${esc(h.coGrupo)}</td>
        <td style="text-align:left; white-space:normal">${esc(h.dsGrupo)}</td>
        <td style="text-align:center">${esc(origem(h.tpOrigem))}</td>
        <td class="mono" style="text-align:center">${esc(h.dtCompInicio || "—")}</td>
      </tr>`).join("")
    : `<tr><td colspan="4" class="suave" style="text-align:left">Nenhuma habilitação ativa registrada no CNES.</td></tr>`;
  return `<h3>Habilitações ativas no CNES</h3>
    <div class="tab-wrap" style="margin-top:.7rem"><table class="dados tab-verde">
      <thead><tr>
        <th style="width:90px; text-align:center">Código</th>
        <th style="text-align:left">Descrição</th>
        <th style="width:110px; text-align:center">Origem</th>
        <th style="width:150px; text-align:center">Competência Inicial</th>
      </tr></thead>
      <tbody>${corpo}</tbody>
    </table></div>
    <p class="fonte" style="font-size:.8rem">
      <b>Dados baixados do CNES em:</b> ${dataBR(consulta)} ·
      Fonte: Ministério da Saúde - Cadastro Nacional dos Estabelecimentos de Saúde do Brasil.
    </p>`;
}

/* ============================================================
   DOSSIÊ — cards espelhando a apresentação de mortalidade
   ============================================================ */
const FONTE_SIM = "Fonte: Ministério da Saúde - Sistema de Informações sobre Mortalidade (SIM) · dados sujeitos a revisão.";
const FONTE_SIM_SINASC = "Fonte: Ministério da Saúde - SIM e SINASC · dados sujeitos a revisão.";

/* cabeçalhos de ano como botões (abre o gráfico do ano) */
function thsAno(comTotal = true, npct = false){
  const th = (i, rot) => npct
    ? `<th class="th-ano par" data-a="${i}" colspan="2"><button class="btn-ano" title="Ver gráfico de ${rot}">${rot}</button></th>`
    : `<th class="th-ano" data-a="${i}"><button class="btn-ano" title="Ver gráfico de ${rot}">${rot}</button></th>`;
  let s = ANOS.map((a, i) => th(i, String(a) + (PRELIM.has(a) ? "*" : ""))).join("");
  if(comTotal) s += th(NT, "Total");
  return s;
}
const notaPrelim = `<span class="chip chip-prelim" title="2024 e 2025: dados preliminares do DATASUS">* preliminar</span>`;

/* tabela de série: óbitos, denominador e taxa (como nos slides "Razão/Taxa de Mortalidade …") */
function tabelaSerie(mt, bloco, rotN, rotD, rotTaxa, ind){
  const n = linha(mt, bloco, rotN) || [], d = linha(mt, bloco, rotD) || [];
  const taxa = ANOS.map((_, i) => valorUnidade(mt, ind, i)).concat([valorUnidade(mt, ind, NT)]);
  const td = (v, f) => `<td class="mono">${f(v)}</td>`;
  return `<div class="tab-wrap"><table class="dados tab-verde" data-bloco="${bloco}" data-serie="${ind.id}">
    <thead><tr><th></th>${thsAno()}</tr></thead>
    <tbody>
      <tr><td class="rot-click" data-row="0" title="Ver a evolução, 2019 a 2025">${esc(rotN)}</td>${n.map(v => td(v, fmtInt)).join("")}</tr>
      <tr><td class="rot-click" data-row="1" title="Ver a evolução, 2019 a 2025">${esc(rotD)}</td>${d.map(v => td(v, fmtInt)).join("")}</tr>
      <tr class="taxa"><td class="rot-click" data-row="taxa" title="Ver a evolução, 2019 a 2025">${esc(rotTaxa)}</td>${taxa.map(v => td(v, fmtTaxa)).join("")}</tr>
    </tbody></table></div>`;
}
/* tabela de números absolutos por ano com linhas de % opcionais (bloco materno) */
function tabelaN(mt, bloco, opts = {}){
  const b = mt.blocos[bloco];
  if(!b) return "<p class='suave'>Sem dados.</p>";
  const rows = b.map((r, ri) => {
    const ehTotal = /^total/i.test(r[0]);
    return `<tr class="${ehTotal ? "total" : ""}"><td class="rot-click" data-row="${ri}" title="Ver a evolução, 2019 a 2025">${esc(r[0])}</td>${r[1].map(v => `<td class="mono">${fmtInt(v)}</td>`).join("")}</tr>`;
  }).join("");
  let pctRows = "";
  if(opts.pctDe){
    const tot = linha(mt, bloco, opts.pctDe) || [];
    pctRows = b.filter(r => !/^total/i.test(r[0])).map(r => {
      const tds = r[1].map((v, i) => `<td class="mono">${(v != null && tot[i]) ? fmtPct(v / tot[i] * 100) : "—"}</td>`).join("");
      return `<tr class="pct"><td>% ${esc(r[0].replace(/ \(nº\)$/, ""))}</td>${tds}</tr>`;
    }).join("");
  }
  return `<div class="tab-wrap"><table class="dados tab-verde" data-bloco="${bloco}" data-pctde="${opts.pctDe || ""}">
    <thead><tr><th>${esc(opts.cab || "")}</th>${thsAno()}</tr></thead>
    <tbody>${rows}${pctRows}</tbody></table></div>`;
}
/* tabela n | % por ano (uma dupla de colunas por ano + Total), como nos slides de distribuição */
function tabelaNPct(mt, bloco, opts = {}){
  const b = mt.blocos[bloco];
  if(!b) return "<p class='suave'>Sem dados.</p>";
  const tot = linha(mt, bloco, "Total") || [];
  const rows = b.filter(r => !(opts.omiteZero && opts.omiteZero.includes(r[0]) && r[1].every(v => !v))).map((r, ri) => {
    const ehTotal = /^total$/i.test(r[0]);
    const tds = r[1].map((v, i) => {
      const p = ehTotal ? (v ? 100 : null) : (v != null && tot[i] ? v / tot[i] * 100 : null);
      return `<td class="mono n">${fmtInt(v)}</td><td class="mono p">${p == null ? "—" : fmtPct(p)}</td>`;
    }).join("");
    const idx = b.indexOf(r);
    return `<tr class="${ehTotal ? "total" : ""}"><td class="rot-click" data-row="${idx}" title="Ver a evolução, 2019 a 2025">${esc(r[0])}</td>${tds}</tr>`;
  }).join("");
  const sub = [...ANOS, "T"].map(() => `<th class="sub">n</th><th class="sub">%</th>`).join("");
  return `<div class="tab-wrap"><table class="dados tab-verde tab-npct" data-bloco="${bloco}" data-npct="1">
    <thead><tr><th rowspan="2" style="vertical-align:bottom">${esc(opts.cab || "")}</th>${thsAno(true, true)}</tr><tr>${sub}</tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

/* ---------------- modal: gráfico da distribuição de um ano ---------------- */
function abrirGraficoAno(tbl, a, tituloCard){
  const mt = MAT.find(m => m.cnes === estado.cnes) || MAT[0];
  const bloco = tbl.dataset.bloco;
  const b = mt.blocos[bloco];
  if(!b) return;
  let linhas, fmt, pctMax = false;
  if(tbl.dataset.serie){
    // série: óbitos e denominador do ano
    linhas = b.map(r => ({rot:r[0], v:r[1][a]})).filter(r => r.v != null);
    fmt = fmtInt;
  } else if(tbl.dataset.npct === "1"){
    const tot = linha(mt, bloco, "Total")?.[a];
    linhas = b.filter(r => !/^total$/i.test(r[0]) && r[1][a] != null)
      .map(r => ({rot:r[0], v:(tot ? r[1][a] / tot * 100 : 0), sub:`(${fmtInt(r[1][a])})`}));
    fmt = fmtPct; pctMax = true;
    if(!tot){ linhas = []; }
  } else {
    linhas = b.filter(r => !/^total/i.test(r[0]) && r[1][a] != null).map(r => ({rot:r[0].replace(/ \(nº\)$/, ""), v:r[1][a]}));
    fmt = fmtInt;
  }
  if(!linhas.length){
    document.getElementById("mgConteudo").innerHTML = "<p class='suave'>Sem óbitos neste período.</p>";
  } else {
    document.getElementById("mgConteudo").innerHTML = grafBarrasH(linhas, fmt, pctMax);
  }
  document.getElementById("mgTitulo").textContent = (tituloCard || "Distribuição") + " · " + rotAno(a);
  document.getElementById("mgSub").textContent = mt.nome + " - " + mt.uf + " · Fonte: SIM, dados sujeitos a revisão.";
  document.getElementById("modalGrafico").hidden = false;
}
function fecharModalGrafico(){ document.getElementById("modalGrafico").hidden = true; }

/* baixar o gráfico do modal como PNG */
function baixarPngModal(){
  const svg = document.querySelector("#mgConteudo svg");
  if(!svg) return;
  const vb = svg.viewBox.baseVal;
  const escala = 2.5;
  const W = Math.round(vb.width * escala), H = Math.round(vb.height * escala);
  const alto = 64 * (escala / 2);
  const xml = new XMLSerializer().serializeToString(svg);
  const url = URL.createObjectURL(new Blob([xml], {type: "image/svg+xml;charset=utf-8"}));
  const img = new Image();
  img.onload = () => {
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H + alto;
    const cx = cv.getContext("2d");
    cx.fillStyle = "#FFFFFF"; cx.fillRect(0, 0, cv.width, cv.height);
    cx.fillStyle = "#1D3229";
    cx.font = "700 " + Math.round(15 * escala / 2 * 1.25) + "px Arial";
    cx.fillText(document.getElementById("mgTitulo").textContent, 16, 26 * (escala / 2));
    cx.fillStyle = "#4E6A5C";
    cx.font = Math.round(11.5 * escala / 2 * 1.25) + "px Arial";
    cx.fillText(document.getElementById("mgSub").textContent, 16, 48 * (escala / 2));
    cx.drawImage(img, 0, alto, W, H);
    URL.revokeObjectURL(url);
    const nome = (document.getElementById("mgTitulo").textContent || "grafico")
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 90) || "grafico";
    const a = document.createElement("a");
    a.download = nome + ".png";
    a.href = cv.toDataURL("image/png");
    a.click();
  };
  img.src = url;
}
document.addEventListener("DOMContentLoaded", () => {
  const b = document.getElementById("btnBaixarPng");
  if(b) b.addEventListener("click", baixarPngModal);
});

/* clique no rótulo da linha: evolução 2019-2025 */
function abrirTendenciaBloco(tbl, rowKey, tituloCard){
  const mt = MAT.find(m => m.cnes === estado.cnes) || MAT[0];
  const bloco = tbl.dataset.bloco;
  const b = mt.blocos[bloco];
  if(!b) return;
  let rot, vals, opts = {legenda:false}, extra = null;
  if(rowKey === "taxa"){
    const ind = indPorId(tbl.dataset.serie);
    rot = ind.rot; vals = ANOS.map((_, i) => valorUnidade(mt, ind, i)); opts.taxa = true;
    extra = ANOS.map((_, i) => `${fmtInt(ind.num(mt, i))} / ${fmtInt(ind.den(mt, i))}`);
  } else {
    const r = b[+rowKey]; if(!r) return;
    rot = String(r[0]).replace(/ \(nº\)$/, "");
    if(tbl.dataset.npct === "1" && !/^total$/i.test(r[0])){
      const tot = linha(mt, bloco, "Total") || [];
      vals = ANOS.map((_, i) => (r[1][i] != null && tot[i]) ? r[1][i] / tot[i] * 100 : null);
      extra = ANOS.map((_, i) => `n = ${fmtInt(r[1][i])} de ${fmtInt(tot[i])}`);
      opts.pct = true; rot = "% " + rot;
    } else if(tbl.dataset.pctde && !/^total/i.test(r[0])){
      const tot = linha(mt, bloco, tbl.dataset.pctde) || [];
      vals = ANOS.map((_, i) => (r[1][i] != null && tot[i]) ? r[1][i] / tot[i] * 100 : null);
      extra = ANOS.map((_, i) => `n = ${fmtInt(r[1][i])} de ${fmtInt(tot[i])}`);
      opts.pct = true; rot = "% " + rot;
    } else {
      vals = r[1].slice(0, NT);
    }
  }
  document.getElementById("mgTitulo").textContent = (tituloCard ? tituloCard + " · " : "") + rot + " · evolução 2019-2025";
  document.getElementById("mgSub").textContent = mt.nome + " - " + mt.uf + " · Fonte: SIM e SINASC, dados sujeitos a revisão.";
  document.getElementById("modalGrafico").hidden = false;
  grafLinhas("mgConteudo", [{nome: rot, cor: "#279261", vals, extra}], opts);
}
function abrirTendencia(indId, cnes){
  const ind = indPorId(indId);
  const mt = MAT.find(m => m.cnes === cnes) || MAT[0];
  document.getElementById("mgTitulo").textContent = ind.rot + " · tendência 2019-2025";
  document.getElementById("mgSub").textContent = mt.nome + " - " + mt.uf + " · Fonte: SIM e SINASC, dados sujeitos a revisão.";
  document.getElementById("modalGrafico").hidden = false;
  const extra = ind.tipo === "num" ? null : ANOS.map((_, i) => `${fmtInt(ind.num(mt, i))} / ${fmtInt(ind.den(mt, i))}`);
  grafLinhas("mgConteudo",
    [{nome:ind.curto, cor:"#279261", vals:ANOS.map((_, i) => valorUnidade(mt, ind, i)), extra}],
    {pct:ind.tipo === "pct", taxa:ind.tipo === "taxa", legenda:false});
}
/* título do card sem os chips (ex.: "* preliminar") */
function tituloDoCard(el){
  const h = el.closest(".card")?.querySelector("h3");
  if(!h) return "";
  const c = h.cloneNode(true);
  c.querySelectorAll(".chip, select").forEach(x => x.remove());
  return c.textContent.replace(/\s+/g, " ").trim();
}
document.addEventListener("click", e => {
  const tdv = e.target.closest("td.var-click");
  if(tdv){ abrirTendencia(tdv.dataset.ind, evoCnes); return; }
  const tdr = e.target.closest("td.rot-click");
  if(tdr){
    const tituloCard = tituloDoCard(tdr);
    const tb = tdr.closest("table[data-bloco]");
    if(tb) abrirTendenciaBloco(tb, tdr.dataset.row, tituloCard);
    return;
  }
  const th = e.target.closest("th.th-ano");
  if(th){
    const tbl = th.closest("table[data-bloco]");
    if(tbl) abrirGraficoAno(tbl, +th.dataset.a, tituloDoCard(th));
    return;
  }
  if(e.target.id === "modalGrafico" || e.target.id === "btnFecharModal") fecharModalGrafico();
});
document.addEventListener("keydown", e => { if(e.key === "Escape") fecharModalGrafico(); });

function abrirDossie(cnes){
  estado.cnes = cnes;
  const sel = document.getElementById("selUnidade" + {apoiada:"", ebserh:"Ebserh", qualineo:"Qualineo"}[conjuntoPrincipal(MAT.find(m => m.cnes === cnes) || MAT[0])]);
  if(sel) sel.value = cnes;
  document.getElementById("selUnidadePd").value = cnes;
  desenhaDossie();
  const pg = document.getElementById("paginaDossie");
  if(pg.hidden){
    pg.hidden = false;
    document.body.classList.add("dossie-aberto");
    history.pushState({dossie:cnes}, "", "#dossie");
  }
  pg.scrollTop = 0;
}
window.abrirDossie = abrirDossie;
function fecharDossie(voltarHistorico = true){
  const pg = document.getElementById("paginaDossie");
  if(pg.hidden) return;
  pg.hidden = true;
  document.body.classList.remove("dossie-aberto");
  if(voltarHistorico && location.hash === "#dossie") history.back();
}
window.addEventListener("popstate", () => { fecharDossie(false); fecharMetodo(false); });

function cardGrafTab(id, titulo, mt, bloco, rotN, rotD, rotTaxa, indId, fonteExtra){
  const ind = indPorId(indId);
  return `<div class="card full">
    <h3>${esc(titulo)}, ${ANOS[0]} a ${ANOS[NT-1]} ${notaPrelim}</h3>
    <div id="${id}" style="max-width:820px; margin:.7rem auto 0"></div>
    <div style="margin-top:.9rem">${tabelaSerie(mt, bloco, rotN, rotD, rotTaxa, ind)}</div>
    <p class="fonte">${FONTE_SIM_SINASC}${fonteExtra ? " " + fonteExtra : ""}</p></div>`;
}

function desenhaDossie(){
  const mt = MAT.find(m => m.cnes === estado.cnes) || MAT[0];
  const el = document.getElementById("dossieConteudo");
  const t = mt.territorio;
  const a = NT - 1;
  const k = (idN, idT, rot) => {
    const n = valorUnidade(mt, indPorId(idN), a), tx = idT ? valorUnidade(mt, indPorId(idT), a) : null, ind = idT ? indPorId(idT) : null;
    return `<div class="k"><div class="n mono">${fmtInt(n)}</div><div class="t">${rot} ${ANOS[a]}</div>${ind ? `<div class="s">${esc(ind.curto)}: <b>${fmtTaxa(tx)}</b> ${ind.unidade}</div>` : `<div class="s">&nbsp;</div>`}</div>`;
  };
  const sep = txt => `<div class="full"><p class="eyebrow titulo-linha" style="margin:.6rem 0 .1rem">${txt}</p></div>`;
  el.innerHTML = `
  <div class="dossie-topo">
    <div>
      <p class="eyebrow" style="color:#A5D6A7">${esc(t.uf)} · ${esc(mt.regiao)}</p>
      <h2 style="color:#FFF">${esc(mt.nome)}</h2>
      <div class="meta">
        <span>CNES ${mt.cnesComplexo ? mt.cnesComplexo.join(" + ") : mt.cnes}</span><span>${esc(t.municipio)} · ${mt.uf}</span>
        ${t.regiao_saude ? `<span>Região de saúde: ${esc(t.regiao_saude)}</span>` : ""}${t.macro ? `<span>${esc(t.macro)}</span>` : ""}
        <span>${esc(rotuloConjuntos(mt))}</span>
        ${mt.oficial === false ? `<span class="anexo">anexo · fora da lista oficial de 09/09/2026</span>` : ""}
      </div>
    </div>
    <div class="kpis-topo">
      ${k("nv", null, "Nascidos vivos")}
      ${k("obm", "rmm", "Óbitos maternos")}
      ${k("obf", "tmf", "Óbitos fetais")}
      ${k("obn", "tmn", "Óbitos neonatais")}
    </div>
  </div>
  <div class="dossie-cards">
    <div class="card full">${cardCnesHTML(mt)}</div>
    ${cardHabilitacoesHTML(mt) ? `<div class="card full">${cardHabilitacoesHTML(mt)}</div>` : ""}

    ${sep("Mortalidade materna")}
    ${cardGrafTab("gRMM", "Razão de Mortalidade Materna", mt, "mat_serie", R.obMat, R.nv, "Razão de Mortalidade Materna (por 100.000 NV)", "rmm",
      "Óbito materno segundo a definição do Ministério da Saúde (IDB, Anexo I); razão por estabelecimento de ocorrência.")}
    <div class="card full"><h3>Óbitos maternos por causas obstétricas diretas e indiretas, ${ANOS[0]} a ${ANOS[NT-1]} ${notaPrelim}</h3>
      ${tabelaN(mt, "mat_tipo", {cab:"Tipo de causa obstétrica", pctDe:R.totMat})}
      <p class="fonte">${FONTE_SIM} Diretas: O00-O08, O11-O23, O24.4, O26-O92 (e A34, D39.2, E23.0, F53, M83.0); indiretas: O10, O24, O25, O94, O98, O99, B20-B24; inespecíficas: O95. Percentuais sobre o total de óbitos maternos.</p></div>
    <div class="card full"><h3>Óbitos maternos diretos por grupo de causas ${notaPrelim}</h3>
      ${tabelaN(mt, "mat_diretas", {cab:"Causas diretas", pctDe:R.totDir})}
      <p class="fonte">${FONTE_SIM} Percentuais sobre o total de causas diretas.</p></div>
    <div class="card full"><h3>Óbitos maternos indiretos por grupo de causas ${notaPrelim}</h3>
      ${tabelaN(mt, "mat_indiretas", {cab:"Causas indiretas", pctDe:R.totInd})}
      <p class="fonte">${FONTE_SIM} Percentuais sobre o total de causas indiretas.</p></div>

    ${sep("Mortalidade fetal")}
    ${cardGrafTab("gTMF", "Taxa de Mortalidade Fetal", mt, "fet_serie", R.obFet, R.nasc, "Taxa de Mortalidade Fetal (por 1.000 nasc.)", "tmf",
      "Óbitos fetais com 22 semanas ou mais de gestação ou 500 g ou mais.")}
    <div class="card full"><h3>Distribuição dos óbitos fetais por faixa de peso ${notaPrelim}</h3>${tabelaNPct(mt, "fet_peso", {cab:"Peso ao nascer"})}<p class="fonte">${FONTE_SIM}</p></div>
    <div class="card full"><h3>Distribuição dos óbitos fetais por momento do óbito ${notaPrelim}</h3>${tabelaNPct(mt, "fet_momento", {cab:"Momento do óbito", omiteZero:[R.apos]})}<p class="fonte">${FONTE_SIM} Momento em relação ao parto (campo OBITOPARTO da DO fetal).</p></div>
    <div class="card full"><h3>Distribuição dos óbitos fetais por grupo de causas ${notaPrelim}</h3>${tabelaNPct(mt, "fet_causas", {cab:"Grupo de causas (CID-10)"})}<p class="fonte">${FONTE_SIM} Classificação própria por faixas da CID-10 (ver Metodologia).</p></div>

    ${sep("Mortalidade perinatal")}
    ${cardGrafTab("gTMP", "Taxa de Mortalidade Perinatal", mt, "per_serie", R.obPer, R.nasc, "Taxa de Mortalidade Perinatal (por 1.000 nasc.)", "tmp",
      "Óbitos fetais (≥22 semanas ou ≥500 g) + óbitos neonatais precoces (0 a 6 dias).")}
    <div class="card full"><h3>Distribuição dos óbitos perinatais por faixa de peso ${notaPrelim}</h3>${tabelaNPct(mt, "per_peso", {cab:"Peso ao nascer"})}<p class="fonte">${FONTE_SIM}</p></div>
    <div class="card full"><h3>Distribuição dos óbitos perinatais por momento do óbito ${notaPrelim}</h3>${tabelaNPct(mt, "per_momento", {cab:"Componente"})}<p class="fonte">${FONTE_SIM} Fetal (DOFET) e neonatal precoce (DO, 0 a 6 dias de vida).</p></div>
    <div class="card full"><h3>Distribuição dos óbitos perinatais por grupo de causas ${notaPrelim}</h3>${tabelaNPct(mt, "per_causas", {cab:"Grupo de causas (CID-10)"})}<p class="fonte">${FONTE_SIM} Classificação própria por faixas da CID-10 (ver Metodologia).</p></div>

    ${sep("Mortalidade neonatal")}
    <div class="card full"><h3>Distribuição dos óbitos neonatais por momento do óbito ${notaPrelim}</h3>${tabelaNPct(mt, "neo_momento", {cab:"Dias de vida"})}<p class="fonte">${FONTE_SIM} 0 dias = óbito nas primeiras 24 horas de vida.</p></div>
    ${cardGrafTab("gTMN", "Taxa de Mortalidade Neonatal", mt, "neo_serie", R.obNeo, R.nv, "Taxa de Mortalidade Neonatal (por 1.000 NV)", "tmn",
      "Óbitos de 0 a 27 dias de vida ocorridos na unidade.")}
    <div class="card full"><h3>Taxa de Mortalidade Neonatal Precoce ${notaPrelim}</h3>
      ${tabelaSerie(mt, "neo_precoce", R.obPrec, R.nv, "Taxa de Mortalidade Neonatal Precoce (por 1.000 NV)", indPorId("tmnp"))}
      <p class="fonte">${FONTE_SIM_SINASC} Óbitos de 0 a 6 dias de vida.</p></div>
    <div class="card full"><h3>Taxa de Mortalidade Neonatal Tardia ${notaPrelim}</h3>
      ${tabelaSerie(mt, "neo_tardia", R.obTard, R.nv, "Taxa de Mortalidade Neonatal Tardia (por 1.000 NV)", indPorId("tmnt"))}
      <p class="fonte">${FONTE_SIM_SINASC} Óbitos de 7 a 27 dias de vida.</p></div>
    <div class="card full"><h3>Distribuição dos óbitos neonatais por faixa de peso ${notaPrelim}</h3>${tabelaNPct(mt, "neo_peso", {cab:"Peso ao nascer"})}<p class="fonte">${FONTE_SIM}</p></div>
    <div class="card full"><h3>Distribuição dos óbitos neonatais por grupo de causas ${notaPrelim}</h3>${tabelaNPct(mt, "neo_causas", {cab:"Grupo de causas (CID-10)"})}<p class="fonte">${FONTE_SIM} Classificação própria por faixas da CID-10 (ver Metodologia).</p></div>
    <div class="card full"><h3>Distribuição dos óbitos neonatais por grupo de causas evitáveis ${notaPrelim}</h3>${tabelaNPct(mt, "neo_lbe", {cab:"Lista Brasileira de Causas Evitáveis"})}<p class="fonte">${FONTE_SIM} Lista Brasileira de Causas de Mortes Evitáveis por intervenções do SUS, menores de 5 anos (Malta et al., 2007/2010), aplicada aos óbitos neonatais.</p></div>
  </div>`;

  const serie = (id, indId) => {
    const ind = indPorId(indId);
    grafLinhas(id, [{nome:ind.curto, cor:"#279261", vals:ANOS.map((_, i) => valorUnidade(mt, ind, i)),
      extra:ANOS.map((_, i) => `${fmtInt(ind.num(mt, i))} / ${fmtInt(ind.den(mt, i))}`)}], {taxa:true, legenda:false});
  };
  serie("gRMM", "rmm"); serie("gTMF", "tmf"); serie("gTMP", "tmp"); serie("gTMN", "tmn");
}

/* ============================================================
   COMPARADOR
   ============================================================ */
const CORES_COMP = ["#279261","#0A213D","#D68910","#C0392B"];
const COR_MEDIA = "#5E716A";
const MEDIA_ROT = {apoiada:"Apoiadas", ebserh:"EBSERH", qualineo:"QUALINEO"};
let anoComp = NT - 1;
let grupoComp = "apoiada";
function unidadesDoGrupo(g){ return MAT.filter(m => (m.conjuntos || ["apoiada"]).includes(g)); }
function entradaComp(c){
  if(String(c).startsWith("media:")){
    const g = String(c).slice(6), lst = unidadesDoGrupo(g);
    return {media:true, cnes:c, grupo:g, lista:lst, nome:"Agregado · " + (MEDIA_ROT[g] || g), sub:lst.length + " unidades · taxa agregada"};
  }
  return MAT.find(m => m.cnes === c);
}
function valorEntrada(e, ind, a){
  if(!e.media) return valorUnidade(e, ind, a);
  if(ind.tipo === "num"){
    const com = e.lista.map(m => ind.num(m, a)).filter(v => v != null);
    return com.length ? com.reduce((s, v) => s + v, 0) / com.length : null;   // média por unidade
  }
  return agrega(e.lista, ind, a);
}
function coresComp(lst){
  let k = 0;
  return lst.map(e => e && e.media ? COR_MEDIA : CORES_COMP[k++ % CORES_COMP.length]);
}
function desenhaChipsComp(){
  const el = document.getElementById("compChips");
  const lst = estado.comparar.map(entradaComp);
  const cores = coresComp(lst);
  el.innerHTML = lst.map((m, i) => {
    return `<span class="chip" style="border-color:${cores[i]}; color:${cores[i]}">
      ${esc(m.nome.length > 34 ? m.nome.slice(0,33) + "…" : m.nome)}
      <button aria-label="remover" onclick="removeComp('${m.cnes}')">✕</button></span>`;
  }).join("");
}
window.removeComp = c => { estado.comparar = estado.comparar.filter(x => x !== c); desenhaChipsComp(); desenhaComparador(); };
function addComp(cnes){
  if(!cnes || estado.comparar.includes(cnes)) return;
  if(estado.comparar.length >= 4){ alert("Máximo de 4 unidades no comparador."); return; }
  estado.comparar.push(cnes);
  desenhaChipsComp(); desenhaComparador();
  document.getElementById("secComparar").scrollIntoView({behavior:"smooth"});
}
function addMediaGrupo(){
  const id = "media:" + grupoComp;
  if(estado.comparar.includes(id)) return;
  if(estado.comparar.length >= 4){ alert("Máximo de 4 colunas no comparador."); return; }
  estado.comparar.push(id);
  desenhaChipsComp(); desenhaComparador();
  document.getElementById("secComparar").scrollIntoView({behavior:"smooth"});
}
function desenhaComparador(){
  const el = document.getElementById("compConteudo");
  const lst = estado.comparar.map(entradaComp).filter(Boolean);
  if(lst.length < 2){
    el.innerHTML = `<div class="card"><p class="suave">Adicione pelo menos duas maternidades do grupo escolhido acima — ou uma maternidade e o agregado do grupo, com o botão “+ agregado do grupo”.</p></div>`;
    return;
  }
  const cores = coresComp(lst);
  const temMedia = lst.some(e => e.media);
  const a = anoComp;
  let linhas = "";
  EIXOS.forEach(ex => {
    linhas += `<tr class="grupo"><td colspan="${lst.length + 1}">${esc(ex.rot)}</td></tr>`;
    INDS_UNICOS.filter(i => i.eixo === ex.id).forEach(ind => {
      const vals = lst.map(m => valorEntrada(m, ind, a));
      const ok = vals.filter((v, j) => v != null && !lst[j].media);
      let melhor = null;
      if(ok.length && ind.sentido === "menor" && ind.tipo !== "num") melhor = Math.min(...ok);
      const tds = vals.map((v, j) => {
        const destaque = melhor != null && !lst[j].media && v === melhor ? "melhor" : "";
        return `<td class="mono ${destaque}">${fmtInd(ind, v)}</td>`;
      }).join("");
      linhas += `<tr><td>${esc(ind.rot)}</td>${tds}</tr>`;
    });
  });
  el.innerHTML = `
  <div class="card comp-grid">
    <h3>Indicadores · ${rotAno(a)} <span class="chip">menor mortalidade destacada</span></h3>
    <div class="tab-wrap"><table class="comp">
      <thead><tr><th>Indicador</th>${lst.map((m, i) => `<th style="color:${cores[i]}">${esc(m.nome.length > 26 ? m.nome.slice(0,25) + "…" : m.nome)}<br><span class="suave" style="font-weight:400">${m.media ? m.sub : m.uf}</span></th>`).join("")}</tr></thead>
      <tbody>${linhas}</tbody></table></div>
    <p class="fonte">O destaque marca o menor valor nas taxas e nos percentuais de óbitos potencialmente evitáveis (intraparto, ≥2500 g, causas evitáveis, mal definidas). Números absolutos e indicadores de perfil (faixa de peso, tipo de causa, anomalias) não têm destaque. Taxas por estabelecimento de ocorrência: unidades de referência recebem gestantes e recém-nascidos de outros serviços, o que eleva as taxas.${temMedia ? " O agregado do grupo é a taxa agregada das unidades do grupo — soma dos óbitos ÷ soma dos denominadores (nos números absolutos, média por unidade) — e não participa do destaque." : ""}</p>
  </div>
  <div class="grid-2" style="margin-top:1.1rem">
    <div class="card"><h3 style="display:flex; justify-content:space-between; align-items:center; gap:.6rem">Série comparada <select id="selIndComp"></select></h3><div id="grafComp"></div></div>
    <div class="card"><h3 id="tituloRankComp">—</h3><div id="grafCompRank"></div></div>
  </div>`;
  const sel = document.getElementById("selIndComp");
  sel.innerHTML = INDS_UNICOS.filter(i => i.tipo !== "num").map(i => `<option value="${i.id}">${esc(i.rot)}</option>`).join("");
  sel.value = "tmn_n";
  sel.addEventListener("change", desenhaGrafComp);
  desenhaGrafComp();
  function desenhaGrafComp(){
    const ind = indPorId(sel.value);
    grafLinhas("grafComp",
      lst.map((m, i) => ({nome:m.nome, cor:cores[i], vals:ANOS.map((_, k) => valorEntrada(m, ind, k)), dash:m.media})),
      {pct:ind.tipo === "pct", taxa:ind.tipo === "taxa", legenda:true});
    document.getElementById("tituloRankComp").textContent = ind.curto + (ind.unidade ? " (" + ind.unidade + ")" : "") + " · " + rotAnoCurto(a);
    grafRanking("grafCompRank", lst.map((m, i) => ({nome:m.nome, v:valorEntrada(m, ind, a), cor:cores[i]})), {sentido:"menor", fmt:v => fmtInd(ind, v)});
  }
}

/* ============================================================
   EVOLUÇÃO — a mesma unidade comparada entre anos
   ============================================================ */
let evoCnes = MAT[0].cnes;
let anosEvoSel = new Set([NT - 2, NT - 1]);
function sparkline(vals){
  const ok = vals.map((v, i) => [i, v]).filter(p => p[1] != null);
  if(ok.length < 2) return "";
  const W = 110, H = 26, m = 3;
  const ys = ok.map(p => p[1]);
  const min = Math.min(...ys), max = Math.max(...ys), span = (max - min) || 1;
  const X = i => m + (W - 2*m) * i / (vals.length - 1);
  const Y = v => H - m - (H - 2*m) * (v - min) / span;
  const d = ok.map((p, k) => (k ? "L" : "M") + X(p[0]).toFixed(1) + "," + Y(p[1]).toFixed(1)).join("");
  const fim = ok[ok.length - 1];
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="vertical-align:middle">
    <path d="${d}" fill="none" stroke="#279261" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${X(fim[0]).toFixed(1)}" cy="${Y(fim[1]).toFixed(1)}" r="2.6" fill="#1B5F51"/>
  </svg>`;
}
function desenhaEvolucao(){
  const mt = MAT.find(m => m.cnes === evoCnes) || MAT[0];
  const el = document.getElementById("evoConteudo");
  const anos = [...anosEvoSel].sort((a, b) => a - b);
  if(anos.length < 2){
    el.innerHTML = `<div class="card"><p class="suave">Marque pelo menos dois anos para ver a evolução.</p></div>`;
    return;
  }
  const a0 = anos[0], a1 = anos[anos.length - 1];
  let linhas = "";
  EIXOS.forEach(ex => {
    linhas += `<tr class="grupo"><td colspan="${anos.length + 3}">${esc(ex.rot)}</td></tr>`;
    INDS_UNICOS.filter(i => i.eixo === ex.id).forEach(ind => {
      const serie = ANOS.map((_, i) => valorUnidade(mt, ind, i));
      const tds = anos.map(a => `<td class="mono">${fmtInd(ind, serie[a])}</td>`).join("");
      const v0 = serie[a0], v1 = serie[a1];
      let varTxt = "—", cls = "var-neutra";
      if(v0 != null && v1 != null){
        if(ind.tipo === "num"){
          const d = v0 ? (v1 - v0) / v0 * 100 : null;
          varTxt = d == null ? (v1 > 0 ? "▲ +" + fmtInt(v1) : "—") : (d >= 0 ? "▲ +" : "▼ ") + d.toLocaleString("pt-BR", {maximumFractionDigits:1}) + "%";
        } else {
          const d = v1 - v0;
          const un = ind.tipo === "pct" ? " p.p." : "";
          varTxt = (d >= 0 ? "▲ +" : "▼ ") + d.toLocaleString("pt-BR", {maximumFractionDigits:1}) + un;
          if(ind.sentido === "menor") cls = d <= 0 ? "var-ok" : "var-ruim";
        }
      }
      linhas += `<tr><td>${esc(ind.rot)}</td>
        ${tds}<td class="${cls} var-click" data-ind="${ind.id}" title="Ver o gráfico da tendência" style="white-space:nowrap">${varTxt}</td><td>${sparkline(serie)}</td></tr>`;
    });
  });
  el.innerHTML = `
  <div class="card comp-grid">
    <h3>${esc(mt.nome)} · ${mt.uf} <span class="chip">variação de ${ANOS[a0]} a ${ANOS[a1]}</span></h3>
    <div class="tab-wrap"><table class="comp">
      <thead><tr><th>Indicador</th>${anos.map(a => `<th>${ANOS[a]}${PRELIM.has(ANOS[a]) ? "*" : ""}</th>`).join("")}<th>Variação</th><th>Tendência 2019-2025</th></tr></thead>
      <tbody>${linhas}</tbody></table></div>
    <p class="fonte">Variação entre o primeiro e o último ano marcados: taxas em diferença absoluta (por mil ou por 100 mil), percentuais em pontos percentuais, números absolutos em variação relativa. Verde = a mortalidade caiu; vermelho = subiu; sem cor = número absoluto ou indicador de perfil, sem julgamento. A tendência mostra a série completa de 2019 a 2025. * 2024 e 2025 preliminares. ${FONTE_SIM_SINASC}</p>
  </div>`;
}

/* ============================================================
   PÁGINA DE METODOLOGIA
   ============================================================ */
const CALCULOS = {
  nv:{n:"Nascidos vivos ocorridos na unidade no ano (SINASC, CODESTAB = CNES da unidade, ano de DTNASC), independentemente do município de residência da mãe.", d:"Não se aplica: é um número absoluto."},
  obm:{n:"Óbitos de mulheres (SEXO = feminino) ocorridos na unidade (CODESTAB) com causa básica (CAUSABAS) O00-O95, O98 ou O99; ou A34, F53, M83.0 com óbito no puerpério até 42 dias ou ignorado; ou B20-B24, D39.2, E23.0 somente quando OBITOGRAV = 1 ou OBITOPUERP = 1. Sem filtro de idade.", d:"Não se aplica: é um número absoluto.",
    obs:"Regra do Ministério da Saúde (IDB C.3, Anexo I; Guia de Vigilância do Óbito Materno, 2009), a mesma do painel OOBr. Difere das planilhas anteriores a 10/09/2026, que contavam também homens e óbitos por HIV com os campos 43/44 ignorados."},
  rmm_m:{n:"Óbitos maternos ocorridos na unidade no ano (regra acima).", d:"Nascidos vivos ocorridos na unidade no ano (SINASC), × 100.000. Sem fator de correção.",
    obs:"Razão por estabelecimento de ocorrência: o numerador inclui mulheres cujo parto ocorreu em outro serviço ou transferidas; em unidades com poucos nascidos vivos, um único óbito produz valores altos — leia junto com o número absoluto."},
  mdir:{n:"Óbitos maternos por causas obstétricas diretas: O00-O08, O11-O23, O24.4, O26-O92, A34, D39.2, E23.0, F53, M83.0.", d:"Total de óbitos maternos da unidade no ano."},
  mind:{n:"Óbitos maternos por causas obstétricas indiretas: O10, O24 (exceto O24.4), O25, O94, O98, O99, B20-B24.", d:"Total de óbitos maternos da unidade no ano. Os óbitos O95 (inespecíficos) completam o total."},
  mhip:{n:"Óbitos maternos diretos por hipertensão: O11 a O16.", d:"Total de óbitos maternos por causas diretas."},
  mhem:{n:"Óbitos maternos diretos por hemorragia: O20, O44, O45, O46, O67, O72.", d:"Total de óbitos maternos por causas diretas."},
  minf:{n:"Óbitos maternos diretos por infecção puerperal: O85, O86, O91.", d:"Total de óbitos maternos por causas diretas."},
  obf:{n:"Declarações de óbito fetal (SIM-DOFET) da unidade com SEMAGESTAC ≥ 22 semanas ou PESO ≥ 500 g.", d:"Não se aplica: é um número absoluto.",
    obs:"Registros com os dois campos ignorados não entram (opção conservadora; o IDB recomenda incluí-los). A DO fetal é obrigatória a partir de 20 semanas, por isso o arquivo tem registros abaixo do limite estatístico."},
  tmf_f:{n:"Óbitos fetais (regra acima).", d:"Nascimentos ocorridos na unidade: nascidos vivos (SINASC) + óbitos fetais, × 1.000 (IDB C.5)."},
  fante:{n:"Óbitos fetais com OBITOPARTO = 1 (antes do parto).", d:"Óbitos fetais com momento informado (exclui ignorado)."},
  fintra:{n:"Óbitos fetais com OBITOPARTO = 2 (durante o parto).", d:"Óbitos fetais com momento informado (exclui ignorado)."},
  f1500:{n:"Óbitos fetais com peso de 100 a 1499 g.", d:"Óbitos fetais com peso informado (100 a 8.000 g)."},
  f2500:{n:"Óbitos fetais com peso de 2500 g ou mais.", d:"Óbitos fetais com peso informado (100 a 8.000 g)."},
  fmal:{n:"Óbitos fetais com causa básica R00-R99 ou P95.", d:"Total de óbitos fetais."},
  obp:{n:"Óbitos fetais (≥22 semanas ou ≥500 g) + óbitos de nascidos vivos com 0 a 6 dias de vida (SIM-DO) ocorridos na unidade.", d:"Não se aplica: é um número absoluto."},
  tmp_p:{n:"Óbitos perinatais (regra acima).", d:"Nascimentos ocorridos na unidade: nascidos vivos + óbitos fetais, × 1.000 (IDB C.5).",
    obs:"O componente neonatal precoce é atribuído pelo local do óbito; a DO não informa o estabelecimento de nascimento. Em maternidades com UTI neonatal, recém-nascidos nascidos em outro serviço entram no numerador sem entrar no denominador."},
  pfet:{n:"Óbitos fetais (componente fetal).", d:"Total de óbitos perinatais."},
  p1500:{n:"Óbitos perinatais com peso de 100 a 1499 g.", d:"Óbitos perinatais com peso informado."},
  phip:{n:"Óbitos perinatais com causa básica P10-P15, P20, P21, P24, P28.", d:"Total de óbitos perinatais."},
  panom:{n:"Óbitos perinatais com causa básica Q00-Q99.", d:"Total de óbitos perinatais."},
  obn:{n:"Óbitos de nascidos vivos com 0 a 27 dias completos de vida ocorridos na unidade (SIM-DO). Idade = DTOBITO − DTNASC; sem DTNASC, recuperada do campo IDADE (minutos/horas = 0 dias; dias = quantidade).", d:"Não se aplica: é um número absoluto."},
  tmn_n:{n:"Óbitos neonatais (0 a 27 dias) ocorridos na unidade.", d:"Nascidos vivos ocorridos na unidade (SINASC), × 1.000.",
    obs:"Taxa por estabelecimento de ocorrência: inclui recém-nascidos transferidos de outros serviços (o denominador só tem os nascidos vivos da própria unidade). Não é comparável à taxa populacional do IDB."},
  tmnp:{n:"Óbitos de 0 a 6 dias de vida ocorridos na unidade.", d:"Nascidos vivos ocorridos na unidade, × 1.000 (IDB C.1.1)."},
  tmnt:{n:"Óbitos de 7 a 27 dias de vida ocorridos na unidade.", d:"Nascidos vivos ocorridos na unidade, × 1.000 (IDB C.1.2)."},
  n0d:{n:"Óbitos neonatais com 0 dias de vida (primeiras 24 horas).", d:"Total de óbitos neonatais."},
  n1500:{n:"Óbitos neonatais com peso de 100 a 1499 g.", d:"Óbitos neonatais com peso informado."},
  n2500:{n:"Óbitos neonatais com peso de 2500 g ou mais.", d:"Óbitos neonatais com peso informado."},
  nevit:{n:"Óbitos neonatais nos seis grupos de causas evitáveis da Lista Brasileira (imunoprevenção; atenção à mulher na gestação; no parto; ao recém-nascido; diagnóstico e tratamento; promoção à saúde).", d:"Total de óbitos neonatais."},
  nges:{n:"Óbitos neonatais reduzíveis por atenção à mulher na gestação: A50, B20-B24, P00, P01, P02.2, P02.3, P02.7-P02.9, P04, P05, P07, P22.0, P26, P52, P55.0, P55.1, P55.8, P55.9, P56, P57, P77.", d:"Total de óbitos neonatais."},
  npar:{n:"Óbitos neonatais reduzíveis por atenção à mulher no parto: P02.0, P02.1, P02.4-P02.6, P03, P08, P10-P15, P20, P21, P24.0-P24.2, P24.8, P24.9.", d:"Total de óbitos neonatais."},
  nrn:{n:"Óbitos neonatais reduzíveis por atenção ao recém-nascido: P22.1, P22.8, P22.9, P23, P25, P27, P28, P35.1, P35.2, P35.4-P35.9, P36-P39, P50, P51, P53, P54, P58-P61, P70-P76, P78, P80-P83, P90-P94, P96.0-P96.8.", d:"Total de óbitos neonatais."},
  nmal:{n:"Óbitos neonatais com causa básica R00-R99 ou P95.", d:"Total de óbitos neonatais."},
  nanom:{n:"Óbitos neonatais com causa básica Q00-Q99.", d:"Total de óbitos neonatais."}
};
const FICHAS_EXTRAS = [
  {rot:"Grupos de causas dos óbitos fetais, perinatais e neonatais (tabelas do dossiê)",
   desc:"Classificação própria do projeto por faixas da CID-10, com precedência na ordem listada. Não há lista oficial do Ministério da Saúde para este recorte (a OMS publica a ICD-PM).",
   n:"Fatores maternos, placenta, cordão e membranas = P00-P04 · Gestação e crescimento fetal = P05, P07, P08 · Hipóxia/asfixia e transtornos respiratórios = P10-P15, P20, P21, P24, P28 · Infecções perinatais = P35-P39, A50 · Anomalias congênitas = Q00-Q99 · Hemorrágicos e hematológicos = P50-P61 · Mal definidas = R00-R99, P95 · Demais causas = outros códigos.",
   d:"Total de óbitos do bloco (fetal, perinatal ou neonatal) na unidade e no ano; a linha Total soma 100%.",
   fonte:"Ministério da Saúde - SIM (DO e DOFET), 2019 a 2025."},
  {rot:"Grupos de causas maternas diretas e indiretas (tabelas do dossiê)",
   desc:"Classificação por faixas da CID-10 aplicada aos óbitos maternos, com precedência na ordem listada.",
   n:"Diretas: Aborto = O00-O08 · Hipertensão = O11-O16 · Hemorragia = O20, O44-O46, O67, O72 · Infecção puerperal = O85, O86, O91 · Tromboembolismo = O88 · Outras diretas = demais causas diretas. Indiretas: Infecciosas e parasitárias = O98, B20-B24 · Cardiopatias = O99.4 · Respiratórias = O99.5 · Hipertensão/diabetes pré-existentes = O10, O24 (exceto O24.4), O25 · Outras afecções maternas = O99 (demais), O94.",
   d:"Total de causas diretas ou de causas indiretas da unidade no ano (os percentuais das tabelas). Óbitos O95 não entram nos grupos.",
   fonte:"Ministério da Saúde - SIM-DO, 2019 a 2025."},
  {rot:"Faixas de peso ao nascer (tabelas do dossiê)",
   desc:"Categorias do campo PESO (gramas) das declarações de óbito e de óbito fetal.",
   n:"Menos de 1000 g (100 a 999) · 1000 a 1499 g · 1500 a 2499 g · 2500 a 3999 g · 4000 g e mais (4.000 a 8.000) · Ignorado (branco, 0, 9999 ou fora de 100 a 8.000).",
   d:"Total de óbitos do bloco na unidade e no ano.",
   fonte:"Ministério da Saúde - SIM (DO e DOFET), 2019 a 2025."},
  {rot:"Agregado do grupo (comparador)",
   desc:"Coluna de referência do comparador de unidades: a maternidade é comparada com o conjunto do seu grupo (apoiadas, EBSERH ou QUALINEO 2026/2027). Unidades que pertencem a mais de um grupo contam em todos os grupos a que pertencem. O agregado não participa do destaque de menor valor.",
   n:"Soma dos numeradores do indicador nas unidades do grupo com dado no ano (nos números absolutos, média por unidade).",
   d:"Soma dos denominadores correspondentes nas mesmas unidades — a mesma regra de agregação usada nos mapas e no painel lateral.",
   fonte:"Ministério da Saúde - SIM e SINASC, 2019 a 2025."},
  {rot:"HCFAMEMA (Marília/SP): complexo hospitalar",
   desc:"Os CNES 2025507 (hospital adulto) e 2025523 (unidade materno-infantil) são tratados como um único complexo.",
   n:"Óbitos dos dois códigos CNES.",
   d:"Nascidos vivos do CNES 2025523 (unidade materno-infantil).",
   fonte:"Ministério da Saúde - SIM e SINASC, 2019 a 2025."}
];

let _metodoPronta = false;
function desenhaMetodologia(){
  if(_metodoPronta) return;
  _metodoPronta = true;
  const fontes = [
    ["SIM · declarações de óbito (DO)", "Sistema de Informações sobre Mortalidade, Ministério da Saúde. Arquivos DO<UF><ano>.dbc de todas as 27 UFs (2019 a 2023 definitivos; 2024 e 2025 preliminares, extração de 10 e 11/09/2026). Os óbitos são atribuídos ao estabelecimento onde ocorreram (CODESTAB) e ao ano da data do óbito. Base dos óbitos maternos, neonatais e do componente neonatal precoce da mortalidade perinatal."],
    ["SIM · declarações de óbito fetal (DOFET)", "Arquivo nacional DOFET<aa>.dbc, 2019 a 2025. Entram os óbitos fetais com 22 semanas ou mais de gestação ou 500 g ou mais (CID-10, volume 2; IDB C.5). Base dos óbitos fetais e do componente fetal da mortalidade perinatal."],
    ["SINASC", "Sistema de Informações sobre Nascidos Vivos. Nascidos vivos ocorridos em cada unidade (CODESTAB) por ano de nascimento: denominador da razão de mortalidade materna e das taxas neonatais e, somado aos óbitos fetais, das taxas fetal e perinatal."],
    ["CNES", "Cadastro Nacional dos Estabelecimentos de Saúde. A ficha de cadastro vem da API oficial de Dados Abertos do Ministério da Saúde e as habilitações ativas do serviço do próprio site do CNES; coordenadas geográficas georreferenciadas a partir do cadastro."],
    ["Lista de maternidades", "LISTA MATERNIDADES POR GRUPO de 09/09/2026 (coordenação): 115 unidades classificadas como apoiadas (estratégicas), EBSERH e/ou QUALINEO 2026/2027. O painel inclui ainda, como anexo, o Hospital do Rocio (PR) e a Unidade Hospitalar de Iauaretê (AM)."],
    ["Malhas territoriais", "Limites de estados, macrorregiões de saúde (121) e regiões de saúde (439) compactados em SVG a partir das malhas oficiais utilizadas nos projetos de regionalização — as mesmas do Painel NV 2026."]
  ];
  const fichaHTML = (rot, desc, n, d, obs, fonte) => `
    <div class="card">
      <h3>${esc(rot)}</h3>
      <p class="suave" style="font-size:.88rem; margin-top:.4rem">${esc(desc)}</p>
      <p style="font-size:.88rem; margin-top:.5rem"><b>Numerador:</b> ${esc(n)}</p>
      <p style="font-size:.88rem"><b>Denominador:</b> ${esc(d)}</p>
      ${obs ? `<p style="font-size:.84rem; margin-top:.35rem; color:var(--ambar)"><b>Observação:</b> ${esc(obs)}</p>` : ""}
      <p class="fonte">Fonte: ${esc(fonte)} · dados sujeitos a revisão.</p>
    </div>`;
  const fichasPor = eixo => INDS_UNICOS.filter(i => i.eixo === eixo).map(ind => {
    const c = CALCULOS[ind.id] || {n:"—", d:"—"};
    return fichaHTML(ind.rot, ind.desc, c.n, c.d, c.obs, "Ministério da Saúde - " + ind.fonte + ", 2019 a 2025");
  }).join("");
  const extras = FICHAS_EXTRAS.map(f => fichaHTML(f.rot, f.desc, f.n, f.d, null, f.fonte)).join("");
  document.getElementById("metodoConteudo").innerHTML = `
    <div class="sec-head" style="margin-top:.7rem">
      <p class="eyebrow">Metodologia</p>
      <h2>De onde vem cada número</h2>
      <p style="max-width:none">As bases oficiais utilizadas no painel e, abaixo, a ficha de cálculo de cada indicador. As regras são as do recálculo de 11/09/2026 (dicionário de indicadores de mortalidade da coordenação): óbito materno pela definição do Ministério da Saúde, Lista Brasileira de Causas Evitáveis oficial e recuperação da idade neonatal pelo campo IDADE da DO.</p>
    </div>
    <div class="grid-3">
      ${fontes.map(f => `<div class="card"><h3>${f[0]}</h3><p class="suave" style="font-size:.88rem; margin-top:.5rem">${f[1]}</p></div>`).join("")}
    </div>
    <div class="card" style="margin-top:1.4rem">
      <h3>Leitura dos indicadores por estabelecimento</h3>
      <p class="suave" style="font-size:.9rem; margin-top:.5rem">
        Todos os óbitos são atribuídos ao CNES do local de ocorrência. A DO não informa o estabelecimento de nascimento: as taxas neonatais e perinatais de maternidades de referência incluem recém-nascidos transferidos de outros serviços, e a razão de mortalidade materna tem a mesma limitação para gestantes e puérperas transferidas. Os indicadores medem a mortalidade <b>ocorrida na unidade</b>, não o risco da população atendida, e não são comparáveis aos indicadores populacionais do IDB. Nascidos vivos ausentes em um ano (unidade ainda não existia) deixam as taxas daquele ano em branco.
      </p>
    </div>
    <h3 class="titulo-linha" style="margin:1.6rem 0 .7rem">Mortalidade materna</h3>
    <div class="grid-2">${fichasPor("materna")}</div>
    <h3 class="titulo-linha" style="margin:1.6rem 0 .7rem">Mortalidade fetal</h3>
    <div class="grid-2">${fichasPor("fetal")}</div>
    <h3 class="titulo-linha" style="margin:1.6rem 0 .7rem">Mortalidade perinatal</h3>
    <div class="grid-2">${fichasPor("perinatal")}</div>
    <h3 class="titulo-linha" style="margin:1.6rem 0 .7rem">Mortalidade neonatal</h3>
    <div class="grid-2">${fichasPor("neonatal")}</div>
    <h3 class="titulo-linha" style="margin:1.6rem 0 .7rem">Demais cálculos do painel</h3>
    <div class="grid-2">${fichasPor("geral")}${extras}</div>
    <div class="card" style="margin-top:1.4rem">
      <h3>Agregações, faixas de cores e dados preliminares</h3>
      <p class="suave" style="font-size:.9rem; margin-top:.5rem">
        Ao agregar territórios ou grupos, somam-se numeradores e denominadores das maternidades da seleção (taxa agregada); a coluna Acumulado 2019-2025 usa a mesma regra ao longo dos anos.
        Nos mapas, as faixas são quintis calculados sobre os territórios visíveis no recorte atual, na rampa creme → vinho (mais escuro = maior mortalidade); no comparativo entre anos, os quintis são calculados sobre os dois anos juntos, para que as cores sejam comparáveis.
        Territórios em cinza não possuem maternidade do painel ou não têm óbitos/denominador no período.
        2024 e 2025 são dados preliminares do DATASUS e os totais podem mudar nas próximas versões dos arquivos.
      </p>
    </div>`;
}
function abrirMetodo(){
  desenhaMetodologia();
  const pg = document.getElementById("paginaMetodo");
  if(pg.hidden){
    pg.hidden = false;
    document.body.classList.add("dossie-aberto");
    history.pushState({metodo:1}, "", "#metodologia");
  }
  pg.scrollTop = 0;
}
function fecharMetodo(voltarHistorico = true){
  const pg = document.getElementById("paginaMetodo");
  if(pg.hidden) return;
  pg.hidden = true;
  if(document.getElementById("paginaDossie").hidden) document.body.classList.remove("dossie-aberto");
  if(voltarHistorico && location.hash === "#metodologia") history.back();
}

/* ============================================================
   LIGAÇÕES DE INTERFACE
   ============================================================ */
function opcaoUnidades(sel, conjunto){
  const porUF = {};
  const lista = conjunto ? MAT.filter(m => conjuntoPrincipal(m) === conjunto) : MAT;
  lista.forEach(m => { (porUF[m.uf] = porUF[m.uf] || []).push(m); });
  sel.innerHTML = Object.keys(porUF).sort().map(uf =>
    `<optgroup label="${UF_NOME[uf]}">` +
    porUF[uf].sort((a,b) => a.nome.localeCompare(b.nome)).map(m => `<option value="${m.cnes}">${esc(m.nome)}</option>`).join("") +
    `</optgroup>`).join("");
}
const GRUPO_ROT_PLURAL = {apoiada:"Maternidades apoiadas (estratégicas)", ebserh:"Unidades EBSERH", qualineo:"QUALINEO 2026/2027"};
function opcaoUnidadesPorGrupo(sel){
  sel.innerHTML = ORDEM_CONJ.map(g => {
    const lst = MAT.filter(m => conjuntoPrincipal(m) === g)
      .sort((a, b) => a.uf.localeCompare(b.uf) || a.nome.localeCompare(b.nome));
    if(!lst.length) return "";
    return `<optgroup label="${GRUPO_ROT_PLURAL[g]} (${lst.length})">` +
      lst.map(m => `<option value="${m.cnes}">${m.uf} · ${esc(m.nome)}</option>`).join("") +
      `</optgroup>`;
  }).join("");
}
const opcoesAno = (sel, padrao) => {
  sel.innerHTML = ANOS.map((a, i) => `<option value="${i}" ${i === padrao ? "selected" : ""}>${a}${PRELIM.has(a) ? " · preliminar" : ""}</option>`).join("") +
    `<option value="${NT}" ${padrao === NT ? "selected" : ""}>Acumulado 2019–2025</option>`;
};
function inicia(){
  // faixa de destaques
  document.getElementById("statMats").textContent = MAT.length;
  document.getElementById("statUFs").textContent = new Set(MAT.map(m => m.uf)).size;
  const a = NT - 1;
  document.getElementById("statNV").textContent = fmtInt(agrega(MAT, indPorId("nv"), a));
  document.getElementById("statMat").textContent = fmtInt(agrega(MAT, indPorId("obm"), a));
  document.getElementById("statMatSub").textContent = "RMM " + fmtTaxa(agrega(MAT, indPorId("rmm"), a)) + " por 100 mil NV";
  document.getElementById("statNeo").textContent = fmtInt(agrega(MAT, indPorId("obn"), a));
  document.getElementById("statNeoSub").textContent = "taxa " + fmtTaxa(agrega(MAT, indPorId("tmn"), a)) + " por mil NV";

  // trilho lateral
  const ICO = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const TRILHO = [
    {alvo:"inicio", rot:"Início", ico:ICO('<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>')},
    {alvo:"secMapa", rot:"Mapa do Brasil", ico:ICO('<path d="M9 20l-6-2V4l6 2 6-2 6 2v14l-6-2-6 2z"/><path d="M9 6v14M15 4v14"/>')},
    {alvo:"secUnidades", rot:"Mapa de unidades", ico:ICO('<path d="M12 21s-7-5.3-7-11a7 7 0 0 1 14 0c0 5.7-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>')},
    {alvo:"secDossie", rot:"Dossiê da unidade", ico:ICO('<path d="M5 21V8l7-4 7 4v13"/><path d="M9.5 21v-4.5h5V21"/><path d="M12 8v3.5M10.25 9.75h3.5"/><path d="M4 21h16"/>')},
    {alvo:"secComparar", rot:"Comparar unidades", ico:ICO('<path d="M6 3v18M18 3v18"/><path d="M6 8h5M13 8h5M6 13h5M13 13h5"/>')},
    {alvo:"secComparativo", rot:"Comparativo entre anos", ico:ICO('<rect x="3" y="5" width="7.5" height="14" rx="1.5"/><rect x="13.5" y="5" width="7.5" height="14" rx="1.5"/>')},
    {alvo:"__metodo", rot:"Metodologia", ico:ICO('<circle cx="12" cy="12" r="9"/><path d="M12 8h.01"/><path d="M11 12h1v4h1"/>')}
  ];
  const trilho = document.getElementById("trilho");
  trilho.innerHTML = TRILHO.map(t =>
    `<button data-alvo="${t.alvo}" data-rotulo="${t.rot}" aria-label="${t.rot}">${t.ico}</button>`).join("");
  trilho.querySelectorAll("button").forEach(b => {
    b.addEventListener("click", () => {
      if(b.dataset.alvo === "__metodo"){ abrirMetodo(); return; }
      document.getElementById(b.dataset.alvo).scrollIntoView({behavior:"smooth"});
    });
  });
  const secs = [...document.querySelectorAll("section[id]"), document.getElementById("inicio")];
  const spy = new IntersectionObserver(es => {
    es.forEach(e => {
      if(e.isIntersecting){
        trilho.querySelectorAll("button").forEach(b =>
          b.classList.toggle("ativo", b.dataset.alvo === e.target.id));
      }
    });
  }, {rootMargin:"-40% 0px -55% 0px"});
  secs.forEach(s => spy.observe(s));

  document.getElementById("btnMetodologia").addEventListener("click", abrirMetodo);
  document.getElementById("btnVoltarMetodo").addEventListener("click", () => fecharMetodo());

  // mapa svg — filtros
  const sNM = document.getElementById("selNivelMapa");
  sNM.addEventListener("change", () => { estado.nivel = sNM.value; desenhaMapa(); });
  const sRM = document.getElementById("selRegiaoMapa");
  sRM.addEventListener("change", () => {
    estado.regiao = sRM.value || null;
    estado.uf = null;
    sincronizaFiltrosMapa();
    if(!estado.regiao) animaViewBox(vbHome);
    desenhaMapa();
  });
  const sUM = document.getElementById("selUFMapa");
  preencheUFMapa();
  sUM.addEventListener("change", () => {
    estado.uf = sUM.value || null;
    if(estado.uf) estado.regiao = Object.keys(REGIAO_UFS).find(r => REGIAO_UFS[r].includes(estado.uf)) || null;
    sincronizaFiltrosMapa();
    if(!estado.uf && !estado.regiao) animaViewBox(vbHome);
    desenhaMapa();
  });

  // bloco e indicador como listas de botões
  const ICO_EIXO = {
    geral:ICO('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
    materna:ICO('<circle cx="12" cy="7" r="3.2"/><path d="M6.5 21c.6-4 2.6-6.5 5.5-6.5s4.9 2.5 5.5 6.5"/>'),
    fetal:ICO('<path d="M12 21s-6.6-4.3-6.6-9.1A4.1 4.1 0 0 1 12 7.4a4.1 4.1 0 0 1 6.6 3.5C18.6 15.7 12 21 12 21z"/>'),
    perinatal:ICO('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    neonatal:ICO('<circle cx="12" cy="9" r="4"/><path d="M5 21c0-4 3-6.5 7-6.5s7 2.5 7 6.5"/>')
  };
  const listaEixos = document.getElementById("listaEixosMapa");
  const listaInds = document.getElementById("listaIndsMapa");
  listaInds.classList.add("pills-ind");
  const desenhaPillsEixo = () => {
    listaEixos.innerHTML = EIXOS.map(e =>
      `<button data-eixo="${e.id}" class="${e.id === estado.eixoMapa ? "ativo" : ""}">${ICO_EIXO[e.id] || ""}<span>${e.rot}</span></button>`).join("");
    listaEixos.querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
      estado.eixoMapa = b.dataset.eixo;
      const primeiro = INDS.find(i => i.eixo === estado.eixoMapa && i.tipo !== "num") || INDS.find(i => i.eixo === estado.eixoMapa);
      estado.indMapa = primeiro ? primeiro.id : estado.indMapa;
      desenhaPillsEixo(); desenhaPillsInd(); desenhaMapa();
    }));
  };
  const desenhaPillsInd = () => {
    listaInds.innerHTML = INDS.filter(i => i.eixo === estado.eixoMapa).map(i =>
      `<button data-ind="${i.id}" class="${i.id === estado.indMapa ? "ativo" : ""}" title="${esc(i.rot)}"><span>${esc(i.curto)}</span></button>`).join("");
    listaInds.querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
      estado.indMapa = b.dataset.ind;
      desenhaPillsInd(); desenhaMapa();
    }));
  };
  desenhaPillsEixo(); desenhaPillsInd();
  const sAM = document.getElementById("selAnoMapa");
  opcoesAno(sAM, NT - 1);
  sAM.addEventListener("change", () => { estado.anoMapa = +sAM.value; desenhaMapa(); });
  document.getElementById("btnResetMapa").addEventListener("click", limparSelecaoMapa);

  // comparativo entre anos — filtros compartilhados pelos dois mapas
  const sIC = document.getElementById("selIndComp2");
  sIC.innerHTML = EIXOS.map(e => `<optgroup label="${e.rot}">` +
    INDS.filter(i => i.eixo === e.id).map(i => `<option value="${i.id}">${esc(i.rot)}</option>`).join("") + `</optgroup>`).join("");
  sIC.value = compSel.ind;
  sIC.addEventListener("change", () => { compSel.ind = sIC.value; desenhaComparativo(); });
  const sRC = document.getElementById("selRegiaoComp");
  const sUC = document.getElementById("selUFComp");
  const sNC = document.getElementById("selNivelComp");
  const preencheUFComp = () => {
    const ufs = compSel.regiao ? [...(REGIAO_UFS[compSel.regiao] || [])].sort() : Object.keys(UF_NOME).sort();
    sUC.innerHTML = `<option value="">${compSel.regiao ? "Toda a região " + compSel.regiao : "Todo o Brasil"}</option>` +
      ufs.map(u => `<option value="${u}">${UF_NOME[u]}</option>`).join("");
    sUC.value = compSel.uf || "";
  };
  sRC.addEventListener("change", () => {
    compSel.regiao = sRC.value || null; compSel.uf = null;
    preencheUFComp(); desenhaComparativo();
  });
  sUC.addEventListener("change", () => {
    compSel.uf = sUC.value || null;
    if(compSel.uf) compSel.regiao = Object.keys(REGIAO_UFS).find(r => REGIAO_UFS[r].includes(compSel.uf)) || null;
    sRC.value = compSel.regiao || "";
    preencheUFComp(); desenhaComparativo();
  });
  sNC.addEventListener("change", () => { compSel.nivel = sNC.value; desenhaComparativo(); });
  const sAA = document.getElementById("selAnoCompA");
  const sAB = document.getElementById("selAnoCompB");
  opcoesAno(sAA, 0); opcoesAno(sAB, NT - 1);
  sAA.addEventListener("change", desenhaComparativo);
  sAB.addEventListener("change", desenhaComparativo);
  preencheUFComp();
  desenhaComparativo();

  // leaflet — filtros
  const sReg = document.getElementById("selRegiaoLeaflet");
  sReg.innerHTML += Object.keys(REGIAO_UFS).map(r => `<option>${r}</option>`).join("");
  const sUF = document.getElementById("selUFLeaflet");
  sUF.innerHTML += Object.keys(UF_NOME).sort().map(u => `<option value="${u}">${UF_NOME[u]}</option>`).join("");
  const busca = document.getElementById("buscaUnidade");
  const chkCtx = document.getElementById("chkContexto");
  const btnLimpar = document.getElementById("btnLimparUnidades");
  [sReg, sUF].forEach(s => s.addEventListener("change", desenhaPontos));
  busca.addEventListener("input", () => { clearTimeout(window._tBusca); window._tBusca = setTimeout(desenhaPontos, 250); });
  chkCtx.addEventListener("change", desenhaPontos);
  btnLimpar.addEventListener("click", () => {
    sReg.value = ""; sUF.value = ""; busca.value = ""; chkCtx.checked = false;
    desenhaPontos();
    if(leaf) leaf.setView([-14.5, -52], 4);
  });

  // dossiê — um seletor por grupo + página sobreposta
  const sU = document.getElementById("selUnidade");
  opcaoUnidades(sU, "apoiada");
  sU.value = estado.cnes;
  if(!sU.value){ estado.cnes = sU.options[0]?.value || estado.cnes; sU.value = estado.cnes; }
  document.getElementById("btnAbrirDossie").addEventListener("click", () => abrirDossie(sU.value));
  [["Ebserh", "ebserh", "nEbserh"], ["Qualineo", "qualineo", "nQualineo"]].forEach(([sufixo, conj, elN]) => {
    const s = document.getElementById("selUnidade" + sufixo);
    if(!s) return;
    opcaoUnidades(s, conj);
    document.getElementById("btnAbrirDossie" + sufixo).addEventListener("click", () => abrirDossie(s.value));
    const n = document.getElementById(elN);
    if(n) n.textContent = `(${MAT.filter(m => conjuntoPrincipal(m) === conj).length})`;
  });
  const nAp = document.getElementById("nApoiada");
  if(nAp) nAp.textContent = `(${MAT.filter(m => conjuntoPrincipal(m) === "apoiada").length})`;
  const sPd = document.getElementById("selUnidadePd");
  opcaoUnidades(sPd);
  sPd.value = estado.cnes;
  sPd.addEventListener("change", () => abrirDossie(sPd.value));
  document.getElementById("btnVoltarDossie").addEventListener("click", () => fecharDossie());
  document.getElementById("btnPdfDossie").addEventListener("click", () => window.print());

  // comparador
  const sC = document.getElementById("selAddComp");
  opcaoUnidades(sC, grupoComp);
  document.querySelectorAll("#segGrupoComp button").forEach(b => {
    b.textContent += ` (${MAT.filter(m => conjuntoPrincipal(m) === b.dataset.grupo).length})`;
    b.addEventListener("click", () => {
      if(b.dataset.grupo === grupoComp) return;
      document.querySelectorAll("#segGrupoComp button").forEach(x => x.classList.remove("ativo"));
      b.classList.add("ativo");
      grupoComp = b.dataset.grupo;
      opcaoUnidades(sC, grupoComp);
      estado.comparar = [];
      desenhaChipsComp(); desenhaComparador();
    });
  });
  document.getElementById("btnAddComp").addEventListener("click", () => addComp(sC.value));
  document.getElementById("btnAddMedia").addEventListener("click", addMediaGrupo);
  const sAC = document.getElementById("selAnoComp");
  opcoesAno(sAC, NT - 1);
  sAC.addEventListener("change", () => { anoComp = +sAC.value; desenhaComparador(); });

  // modo "mesma unidade entre anos"
  document.querySelectorAll("#segModoComp button").forEach(b => {
    b.addEventListener("click", () => {
      document.querySelectorAll("#segModoComp button").forEach(x => x.classList.remove("ativo"));
      b.classList.add("ativo");
      const anosMode = b.dataset.modo === "anos";
      document.getElementById("compModoUnidades").hidden = anosMode;
      document.getElementById("compModoAnos").hidden = !anosMode;
      if(anosMode) desenhaEvolucao();
    });
  });
  const sEvo = document.getElementById("selUnidadeEvo");
  opcaoUnidadesPorGrupo(sEvo);
  sEvo.value = evoCnes;
  sEvo.addEventListener("change", () => { evoCnes = sEvo.value; desenhaEvolucao(); });
  const anosBox = document.getElementById("anosEvo");
  anosBox.innerHTML = ANOS.map((a, i) =>
    `<button class="chip chip-ano ${anosEvoSel.has(i) ? "ativo" : ""}" data-a="${i}">${a}</button>`).join("");
  anosBox.querySelectorAll("button").forEach(b => {
    b.addEventListener("click", () => {
      const i = +b.dataset.a;
      if(anosEvoSel.has(i)){
        if(anosEvoSel.size <= 2) return;
        anosEvoSel.delete(i); b.classList.remove("ativo");
      } else {
        anosEvoSel.add(i); b.classList.add("ativo");
      }
      desenhaEvolucao();
    });
  });

  // mapa de unidades: Leaflet só inicializa quando abrir
  const detUn = document.getElementById("detUnidades");
  detUn.addEventListener("toggle", () => {
    if(!detUn.open) return;
    if(!leaf) iniciaLeaflet();
    else setTimeout(() => leaf.invalidateSize(), 60);
  });

  desenhaMapa();
  desenhaChipsComp();
  desenhaComparador();
}
document.addEventListener("DOMContentLoaded", inicia);
if(document.readyState !== "loading") inicia();
