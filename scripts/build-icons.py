#!/usr/bin/env python3
"""Export proportional PNG icons from the transparent head cutout; requires Pillow."""
from pathlib import Path

from PIL import Image

ASSETS = Path(__file__).resolve().parents[1] / 'docs' / 'assets'

with Image.open(ASSETS / 'ethan-head.png') as source:
    assert source.mode == 'RGBA' and source.size == (512, 512)
    for size in (16, 32, 48, 180, 192):
        source.resize((size, size), Image.Resampling.LANCZOS).save(
            ASSETS / f'ethan-head-{size}.png', optimize=True)

