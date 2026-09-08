#!/usr/bin/env python3
"""Build the static site with one content version for every public asset reference."""
import hashlib
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'docs'
OUTPUT = ROOT / '.build' / 'site'

def build():
    files = sorted(p for p in SOURCE.rglob('*') if p.is_file() and not p.is_symlink() and p.suffix.lower() in {'.html','.css','.js','.mjs','.json','.svg','.webp','.png','.jpg','.jpeg','.glb','.wasm','.txt','.webmanifest','.xml'})
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
            target.write_text(path.read_text().replace('__SITE_VERSION__', version))
        else:
            shutil.copyfile(path,target)
    (OUTPUT/'.nojekyll').touch()
    print(f'Built {len(files)} files in {OUTPUT}, version {version}')

if __name__ == '__main__':
    build()
