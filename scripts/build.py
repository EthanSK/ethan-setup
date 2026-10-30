#!/usr/bin/env python3
"""Build the static site with one content version for every public asset reference."""
import hashlib
import json
from pathlib import Path
import re
import shutil
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'docs'
OUTPUT = ROOT / '.build.noindex' / 'site'

def build():
    websites = json.loads((SOURCE / 'project-websites.json').read_text())
    def project_link(match):
        """Resolve static project links from the same destinations used by the directories."""
        url = match.group(1)
        parsed = urlsplit(url)
        repository = parsed.path.strip('/')
        destination = websites.get(repository, url) if parsed.hostname == 'github.com' and not parsed.query and not parsed.fragment else url
        return f'href="{destination}"'
    files = sorted(p for p in SOURCE.rglob('*') if p.is_file() and not p.is_symlink() and p.suffix.lower() in {'.html','.css','.js','.mjs','.json','.svg','.webp','.png','.jpg','.jpeg','.glb','.wasm','.txt','.webmanifest','.xml','.otf'})
    digest = hashlib.sha256()
    for path in files:
        digest.update(str(path.relative_to(SOURCE)).encode())
        digest.update(path.read_bytes())
    version = digest.hexdigest()[:16]
    if OUTPUT.is_symlink():
        raise RuntimeError('Build output must not be a symbolic link')
    if OUTPUT.exists():
        shutil.rmtree(OUTPUT)  # This exact directory contains only artifacts produced by this script.
    OUTPUT.mkdir(parents=True)
    for path in files:
        target = OUTPUT / path.relative_to(SOURCE)
        target.parent.mkdir(parents=True, exist_ok=True)
        if path.suffix in {'.html','.css','.js','.mjs','.json','.webmanifest'}:
            content = path.read_text().replace('__SITE_VERSION__', version)
            if path.suffix == '.html':
                content = re.sub(r'href="(https://github\.com/[^"\s]+)"', project_link, content) # Static sidebar and OBS links use the same verified destinations as dynamically created cards.
            target.write_text(content)
        else:
            shutil.copyfile(path,target)
    (OUTPUT/'.nojekyll').touch()
    print(f'Built {len(files)} files in {OUTPUT}, version {version}')

if __name__ == '__main__':
    build()
