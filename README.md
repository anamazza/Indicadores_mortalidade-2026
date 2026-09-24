# Painel de Mortalidade 2026 · Maternidades Estratégicas

Painel interativo de indicadores de **mortalidade materna, fetal, perinatal e neonatal** das
maternidades da Qualificação do Modelo de Gestão em Maternidades Estratégicas na Rede de Atenção
à Saúde Materna e Neonatal — Coordenação de Ações Nacionais e de Cooperação em Saúde da Mulher,
da Criança e do Adolescente (IFF/Fiocruz). Mesma família e mesma estrutura do
[Painel NV 2026](https://anamazza.github.io/Indicadores_NV/).

**Arquivo final:** `index.html` (idêntico a `Painel_Mortalidade_2026.html`) — HTML único e
autocontido, pronto para o GitHub Pages. Requer internet só para o mapa de fundo do mapa de
unidades (Leaflet/OpenStreetMap).

## O que o painel contém

- **Mapa do Brasil**: coroplético por UF, macrorregião ou região de saúde, com recorte + zoom,
  filtros em cascata (território → estado), 5 blocos (visão geral, materna, fetal, perinatal,
  neonatal) e 38 indicadores; faixas por quintis recalculadas por recorte, tooltip com
  numerador/denominador e as maternidades de cada território; painel lateral com os totais da seleção.
- **Mapa de unidades**: as 120 maternidades (Leaflet), coloridas por grupo (apoiadas, EBSERH,
  QUALINEO 2026/2027), com filtros, busca, resumo de 2025 no popup e pontos de contexto
  (estabelecimentos ≥480 partos/ano, SIH/AIH 2025).
- **Dossiê da unidade**: página própria com ficha CNES e habilitações ativas (API oficial) e as
  23 seções da apresentação de indicadores de mortalidade (razão de mortalidade materna e causas
  obstétricas; taxas fetal, perinatal e neonatal; faixa de peso, momento do óbito, grupos de causas
  e causas evitáveis). Anos clicáveis abrem o gráfico do ano; rótulos clicáveis abrem a evolução
  2019-2025; download em PDF.
- **Comparador**: entre unidades (2 a 4 do mesmo grupo, por ano, com o agregado do grupo como
  referência) e da mesma unidade entre anos (variação e tendência).
- **Comparativo entre anos**: dois mapas lado a lado do mesmo indicador, com faixas de cor comuns.
- **Metodologia**: página própria com as fontes oficiais e a ficha de numerador/denominador de
  cada indicador (regras do recálculo de 11/09/2026: óbito materno pela definição do Ministério da
  Saúde, Lista Brasileira de Causas Evitáveis oficial, idade neonatal com recuperação pelo campo IDADE).

## Fontes

SIM (DO e DOFET) 2019–2025 e SINASC 2019–2025 (2024 e 2025 preliminares, dados sujeitos a
revisão) · CNES (ficha via API de Dados Abertos; habilitações via serviço do site do CNES) ·
lista oficial de maternidades por grupo de 09/09/2026 · malhas de macrorregiões e regiões de saúde
(as mesmas do Painel NV).

Unidades acrescentadas em 23/09/2026, a pedido da coordenação (fora da lista oficial de 09/09, marcadas
como anexo): Maternidade Carmosina Coutinho (Caxias/MA, CNES 2453665), Santa Casa de Misericórdia de
Sobral (CE, 3021114) e Santa Casa de Franca (SP, 2705982). Mesmas regras de cálculo; SIM extraído em
23/09/2026 das 27 UFs (`Pipeline_Python/indicadores_novas_2026-09.csv`).

## Como atualizar

| O quê | Como |
|---|---|
| Indicadores (novo recálculo do SIM/SINASC) | rodar o pipeline em `../Pipeline_Python` (gera `indicadores_recalculados.csv`) e depois `py build_dados.py` |
| Ficha CNES + habilitações | `py atualizar_cnes.py` |
| Remontar o painel | `py montar_painel.py` (gera `Painel_Mortalidade_2026.html` e `index.html`) |

`build_dados.py` lê, somente para leitura, o painel NV local (`Pojeto Apresentações NV_2026/Painel_2026_Novo`):
malhas SVG, coordenadas, território, nomes e fichas CNES das unidades em comum; as unidades que só
existem neste painel (Rocio, CISAM, Hospital da Mulher do Recife, HCFAMEMA) têm a ficha buscada na API.

## Estrutura

- `painel_base.html` — estrutura e estilos (fonte editável)
- `painel_app.js` — lógica do painel (fonte editável)
- `build_dados.py`, `atualizar_cnes.py`, `montar_painel.py` — scripts de dados e montagem
- `dados_mortalidade.js`, `cnes_dados.json` — dados gerados pelos scripts
- `logos_institucionais.png` — logos embutidos na montagem
