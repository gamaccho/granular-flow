"""Copy a completed Pages build into both numbered editions.
Run npm run build:pages first, then python3 scripts/publish-pages.py.
The shared client selects shoal/clean mode from the aftertouch002 pathname.
"""
from pathlib import Path
import shutil

app = Path(__file__).resolve().parents[1]
repo = app.parents[1]
for edition in ('aftertouch001', 'aftertouch002'):
    destination = repo / edition
    destination.mkdir(exist_ok=True)
    assets = destination / 'assets'
    assets.mkdir(exist_ok=True)
    for old in assets.glob('index-*'):
        if old.suffix in ('.js', '.css'):
            old.unlink()
    shutil.copytree(app / 'dist', destination, dirs_exist_ok=True)
    if edition == 'aftertouch002':
        index = destination / 'index.html'
        html = index.read_text().replace('AFTERTOUCH 001', 'AFTERTOUCH 002')
        html = html.replace('001 / JEV', '002 / SHOAL')
        index.write_text(html)
    print(destination)
