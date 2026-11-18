#!/usr/bin/env python3
"""Build the static site with one content version for every public asset reference."""
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
from tempfile import TemporaryDirectory
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'docs'
OUTPUT = ROOT / '.build.noindex' / 'site'
TEXT_ASSETS = {'.html', '.css', '.js', '.mjs', '.json', '.webmanifest'}
ASSET_TYPES = TEXT_ASSETS | {'.svg', '.webp', '.png', '.jpg', '.jpeg', '.glb', '.wasm', '.txt', '.xml', '.otf'}
MODULE_IMPORT = re.compile(r'((?:\bfrom\s+|\bimport\s*\(\s*)["\'])(\./[^"\'?]+\.mjs)(["\'])')

def build():
    compiler = ROOT / 'node_modules' / 'typescript' / 'bin' / 'tsc'
    if not compiler.exists():
        raise SystemExit('Run npm ci before building the site.')
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(dir=OUTPUT.parent, prefix='compiled-') as temporary:
        compiled = Path(temporary)
        subprocess.run(['node', str(compiler), '--project', 'tsconfig.json', '--outDir', str(compiled)], cwd=ROOT, check=True)
        assemble_site(compiled)


def assemble_site(compiled: Path) -> None:
    websites = json.loads((SOURCE / 'project-websites.json').read_text(encoding='utf-8'))
    def project_link(match):
        """Resolve static project links from the same destinations used by the directories."""
        url = match.group(1)
        parsed = urlsplit(url)
        repository = parsed.path.strip('/')
        destination = websites.get(repository, url) if parsed.hostname == 'github.com' and not parsed.query and not parsed.fragment else url
        return f'href="{destination}"'
    files = {
        path.relative_to(SOURCE): path
        for path in SOURCE.rglob('*')
        if path.is_file() and not path.is_symlink() and path.suffix.lower() in ASSET_TYPES
    }
    for module in compiled.rglob('*.mjs'):
        relative = module.relative_to(compiled)
        if relative in files:
            raise ValueError(f'Compiled module conflicts with a static asset: {relative}')
        files[relative] = module
    digest = hashlib.sha256()
    for relative, path in sorted(files.items()):
        digest.update(relative.as_posix().encode())
        digest.update(path.read_bytes())
    version = digest.hexdigest()[:16]
    if OUTPUT.is_symlink():
        raise RuntimeError('Build output must not be a symbolic link')
    if OUTPUT.exists():
        shutil.rmtree(OUTPUT)  # This exact directory contains only artifacts produced by this script.
    OUTPUT.mkdir(parents=True)
    for relative, path in files.items():
        target = OUTPUT / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        if path.suffix in TEXT_ASSETS:
            content = path.read_text(encoding='utf-8')
            if path.is_relative_to(compiled):
                content = MODULE_IMPORT.sub(r'\1\2?v=__SITE_VERSION__\3', content) # Use the page's version for imports that TypeScript resolves without a query string.
            content = content.replace('__SITE_VERSION__', version)
            if path.suffix == '.html':
                content = re.sub(r'href="(https://github\.com/[^"\s]+)"', project_link, content) # Static sidebar and OBS links use the same verified destinations as dynamically created cards.
            target.write_text(content, encoding='utf-8')
        else:
            shutil.copyfile(path,target)
    (OUTPUT/'.nojekyll').touch()
    print(f'Built {len(files)} files in {OUTPUT}, version {version}')

if __name__ == '__main__':
    build()
