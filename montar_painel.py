# -*- coding: utf-8 -*-
"""Monta o painel em arquivo único: embute dados, ficha CNES, app e logos no HTML.
Saída: Painel_Mortalidade_2026.html e index.html (cópia para o GitHub Pages)."""
import base64, os

BASE = os.path.dirname(os.path.abspath(__file__))
html = open(os.path.join(BASE, "painel_base.html"), encoding="utf-8").read()
dados = open(os.path.join(BASE, "dados_mortalidade.js"), encoding="utf-8").read()
app = open(os.path.join(BASE, "painel_app.js"), encoding="utf-8").read()

# ficha CNES + habilitações (build_dados.py / atualizar_cnes.py)
cnes_path = os.path.join(BASE, "cnes_dados.json")
cnes_js = ""
if os.path.exists(cnes_path):
    cnes_js = "\nconst CNES_INFO = " + open(cnes_path, encoding="utf-8").read() + ";"

html = html.replace('<script src="dados_mortalidade.js"></script>', "<script>\n" + dados + cnes_js + "\n</script>")
html = html.replace('<script src="painel_app.js"></script>', "<script>\n" + app + "\n</script>")

# logos institucionais (base64)
logos_path = os.path.join(BASE, "logos_institucionais.png")
if os.path.exists(logos_path):
    b64l = base64.b64encode(open(logos_path, "rb").read()).decode("ascii")
    html = html.replace('src="logos_institucionais.png"', 'src="data:image/png;base64,' + b64l + '"')

out = os.path.join(BASE, "Painel_Mortalidade_2026.html")
open(out, "w", encoding="utf-8").write(html)
open(os.path.join(BASE, "index.html"), "w", encoding="utf-8").write(html)
print(f"gerado {out} ({os.path.getsize(out) // 1024} KB) + index.html")
