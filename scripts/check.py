#!/usr/bin/env python3
"""Check local references, the published inventory and source ownership before deploying."""
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import subprocess
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / '.build' / 'site'

class References(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []
    def handle_starttag(self, tag, attrs):
        for name, value in attrs:
            if name in ('src', 'href') and value:
                self.urls.append(value)

def check():
    if not (SITE / 'index.html').exists():
        raise ValueError('Run scripts/build.py first')
    for file in SITE.rglob('*.html'):
        parser = References(); parser.feed(file.read_text())
        for value in parser.urls:
            parsed = urlsplit(value)
            if parsed.scheme or parsed.netloc or not parsed.path:
                continue
            relative = unquote(parsed.path)
            path = SITE / relative.removeprefix('/ethan-setup/') if relative.startswith('/') else file.parent / relative
            if path.is_dir():
                path /= 'index.html'
            if not path.exists():
                raise ValueError(f'Missing local reference: {file.name} -> {value}')
    for file in (ROOT / 'docs').glob('*.mjs'):
        subprocess.run(['node', '--check', str(file)], check=True)
        for spec in re.findall(r'(?:from\s*|import\s*\()["\'](\./[^"\']+)', file.read_text()):
            if not (file.parent / spec.split('?')[0]).exists():
                raise ValueError(f'Missing module: {spec}')
    gear = json.loads((ROOT / 'docs/gear.json').read_text())
    expected = {'corsair','razer','macbook','hs8','scarlett','flx4','macmini','akai','shure','dell','canon','samsung','bigknob','drive','desk','chair'}
    assert {item['id'] for item in gear} == expected
    assert len(gear) == len(expected)
    for item in gear:
        assert 0 <= item['x'] <= 1 and 0 <= item['y'] <= 1
        assert item['url'].startswith('https://') and item['evidence'] and item['specs']
    lock = json.loads((ROOT / 'sources.lock.json').read_text())
    for relative, digest in lock['sha256'].items():
        assert hashlib.sha256((ROOT / 'docs' / relative).read_bytes()).hexdigest() == digest, f'Edit the canonical source, then sync: {relative}'
    for file in SITE.rglob('*'):
        if file.suffix not in {'.html','.json','.mjs','.css','.svg','.webmanifest'}:
            continue
        content = file.read_text()
        assert '__SITE_VERSION__' not in content, f'Unversioned build: {file}'
        assert not re.search(r'(?:/Users/|/private/tmp/|BEGIN (?:RSA |OPENSSH )?PRIVATE KEY|gh[pousr]_[A-Za-z0-9]{30}|sk-[A-Za-z0-9]{35})', content), f'Private content in {file}'
    print('Local references, JavaScript syntax, hardware inventory, source hashes and public-text scan passed')

if __name__ == '__main__':
    check()
