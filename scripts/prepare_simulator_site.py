"""Build the standalone simulator from the same verified public release."""
from pathlib import Path
import shutil
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
subprocess.run([sys.executable, str(root / 'scripts/prepare_public_site.py')], check=True)
out = root / '_simulator_site'
if out.exists():
    shutil.rmtree(out)
shutil.copytree(root / '_site', out)

# Retain calculators and maps; the simulator becomes this site's home page.
game = (out / 'vivienda_simulator.html').read_text()
(out / 'index.html').write_text(game)
for file in out.glob('*.html'):
    html = file.read_text()
    html = html.replace('href="index.html"', 'href="https://www.algohabraquehacer.com/"')
    html = html.replace('href="vivienda_simulator.html"', 'href="index.html"')
    file.write_text(html)

# Keep the original URL working without two copies of the game.
(out / 'vivienda_simulator.html').write_text(
    '<!doctype html><html lang="es"><meta charset="utf-8">'
    '<meta http-equiv="refresh" content="0;url=./">'
    '<title>Vivienda Simulator</title><a href="./">Abrir Vivienda Simulator</a></html>')
nav = out / 'assets/mobile-app-nav.js'
js = nav.read_text()
original = "const page = location.pathname.split('/').pop() || 'index.html';"
assert original in js, 'Review navigation adaptation after source changes'
js = js.replace(original, "const file = location.pathname.split('/').pop() || 'index.html';\n  const page = file === 'index.html' ? 'vivienda_simulator.html' : file;")
original = 'href="${file}"'
assert original in js
js = js.replace(original, 'href="${file === \'index.html\' ? \'https://www.algohabraquehacer.com/\' : file === \'vivienda_simulator.html\' ? \'index.html\' : file}"')
nav.write_text(js)
(out / 'robots.txt').write_text('User-agent: *\nAllow: /\nSitemap: https://viviendasimulator.com/sitemap.xml\n')
(out / 'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://viviendasimulator.com/</loc></url></urlset>')
(out / 'CNAME').write_text('viviendasimulator.com\n')
assert not any('control' in str(p.relative_to(out)) or p.suffix == '.md' for p in out.rglob('*') if p.is_file())
print('Standalone simulator ready:', out)
