#!/usr/bin/env python3
"""Refresh the two published sources without reading the installed Mac or private checkouts."""
import hashlib
import json
from pathlib import Path
import re
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_MOUSE = 'https://ethansk.github.io/agentic-mouse/'
PUBLIC_DESKTOP = 'https://ethansk.github.io/response-preferences/'
MOUSE_FILES = {'simulator.mjs', 'native-hud.mjs', 'hero-mice.mjs', 'mouse-model.mjs', 'mouse-motion.mjs', 'showcase.css', 'agentic-mouse-mark.svg', 'assets/corsair.webp', 'assets/razer.webp'}
MOUSE_PREFIXES = ('models/', 'lib/', 'assets/apps/')

def read(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'ethan-setup-source-sync', 'Cache-Control': 'no-cache'})
    with urllib.request.urlopen(request, timeout=45) as response:
        return response.read()

def sync():
    mouse_bytes = read(PUBLIC_MOUSE + 'simulator-data.json')
    mouse = json.loads(mouse_bytes)
    revision = mouse['revision']
    if not re.fullmatch('[0-9a-f]{40}', revision):
        raise ValueError('The published mouse map must identify its source commit')
    tree = json.loads(read(f'https://api.github.com/repos/EthanSK/agentic-mouse/git/trees/{revision}?recursive=1'))
    if tree.get('truncated'):
        raise ValueError('The public source tree is incomplete')
    files = {'simulator-data.json': mouse_bytes}
    for entry in tree['tree']:
        if entry['type'] != 'blob' or not entry['path'].startswith('docs/'):
            continue
        relative = entry['path'][5:]
        if relative in MOUSE_FILES or relative.startswith(MOUSE_PREFIXES):
            files[relative] = read(f'https://raw.githubusercontent.com/EthanSK/agentic-mouse/{revision}/docs/{relative}')
    if not MOUSE_FILES.issubset(files):
        raise ValueError('Required mouse runtime files are missing from its public commit')
    apps_bytes = read(PUBLIC_DESKTOP + 'desktop/apps.json')
    apps = json.loads(apps_bytes)
    if not isinstance(apps, list) or not all(app.get('name') and app.get('icon') and app.get('id') for app in apps):
        raise ValueError('The canonical public app list changed shape')
    files['apps.json'] = apps_bytes
    for relative, data in files.items():
        destination = ROOT / 'docs' / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data)
    lock = {
        'agenticMouse': {'repository': 'https://github.com/EthanSK/agentic-mouse', 'revision': revision, 'publishedMap': PUBLIC_MOUSE + 'simulator-data.json'},
        'desktop': {'url': PUBLIC_DESKTOP, 'apps': PUBLIC_DESKTOP + 'desktop/apps.json'},
        'sha256': {name: hashlib.sha256(data).hexdigest() for name, data in sorted(files.items())},
    }
    (ROOT / 'sources.lock.json').write_text(json.dumps(lock, indent=2) + '\n')
    print(f'Synced {len(files)} public files; mouse source {revision[:7]}, {len(apps)} apps')

if __name__ == '__main__':
    sync()
