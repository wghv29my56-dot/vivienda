"""Create the Pages artifact from tracked public files; local review stays local."""
from pathlib import Path
import json
import shutil
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
out = root / '_site'
if '--check' not in sys.argv:
    if out.exists():
        shutil.rmtree(out)
    out.mkdir()
files = subprocess.check_output(['git', 'ls-files', '-z'], cwd=root).decode().split('\0')
root_public = {'.nojekyll', 'CNAME', 'robots.txt', 'sitemap.xml', 'index.html',
               'boceto_portal.html', 'simulador_total.html', 'vivienda_simulator.html',
               'mapa_desarrollo_urbano.html', 'mapa_fiscalidad_mejorada.html',
               'vivienda_simulator_nacional.png'}
private = ('assets/simulator/control', 'data/simulator/model.default',
           'data/simulator/model-backups/')
selected = []
for name in files:
    if not name or name.endswith('.md') or name.startswith(private):
        continue
    if name not in root_public and not name.startswith(('assets/', 'data/', 'schemas/')):
        continue
    selected.append(name)
    if '--check' not in sys.argv:
        target = out / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(root / name, target)
if '--check' not in sys.argv:
    revision = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root).decode().strip()
    (out / 'release.json').write_text(json.dumps({'source_commit': revision}) + '\n')
assert 'index.html' in selected and 'vivienda_simulator.html' in selected
assert all('control-lab' not in name and not name.endswith('.md') for name in selected)
print(f'Public artifact: {len(selected)} files. No internal panel, Markdown, SQL or review material.')
