#!/usr/bin/env python3
"""Preserve the selected room, with the Dell screen and a small massage-gun insert."""
import base64
from pathlib import Path

ASSETS = Path(__file__).resolve().parents[1] / 'docs' / 'assets'


def room_image():
    """Preserve the selected portrait and screens while inserting the Dell view and massage guns."""
    original = base64.b64encode((ASSETS / 'room.webp').read_bytes()).decode('ascii')
    screens = base64.b64encode((ASSETS / 'room-screens.webp').read_bytes()).decode('ascii')
    details = base64.b64encode((ASSETS / 'room-details.webp').read_bytes()).decode('ascii')
    dell = base64.b64encode((ASSETS / 'room-dell-legs.webp').read_bytes()).decode('ascii')
    massage = base64.b64encode((ASSETS / 'room-massage-guns.webp').read_bytes()).decode('ascii')
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="1586" height="992" viewBox="0 0 1586 992">
  <title>Ethan's setup with his work screen and OBS layout</title>
  <defs>
    <clipPath id="screens">
      <polygon points="452,313 811,326 807,473 454,468"/>
      <polygon points="965,64 1390,34 1380,305 1174,311 1170,298 1163,286 1151,278 1137,273 1121,270 1105,272 1090,276 1076,283 1065,293 1057,304 1053,312 965,311"/>
    </clipPath>
    <clipPath id="dell">
      <polygon points="452,313 811,326 807,473 454,468"/>
    </clipPath>
    <image id="details" width="1586" height="992" href="data:image/webp;base64,{details}"/>
    <filter id="portrait-edge"><feGaussianBlur stdDeviation="2"/></filter>
    <mask id="portrait" maskUnits="userSpaceOnUse" x="0" y="0" width="1586" height="992">
      <ellipse cx="1109" cy="375" rx="76" ry="114" fill="white" filter="url(#portrait-edge)"/>
    </mask>
    <clipPath id="laptop">
      <polygon points="26,433 235,428 253,535 57,560"/>
    </clipPath>
    <clipPath id="massage-guns">
      <path d="M750 480 H882 V501 H925 V540 L912 549 L894 561 L869 574 L843 583 H750 Z"/>
    </clipPath>
  </defs>
  <image width="1586" height="992" href="data:image/webp;base64,{original}"/>
  <image width="1586" height="992" href="data:image/webp;base64,{screens}" clip-path="url(#screens)"/>
  <image width="1586" height="992" href="data:image/webp;base64,{dell}" clip-path="url(#dell)"/>
  <use href="#details" clip-path="url(#laptop)"/>
  <use href="#details" mask="url(#portrait)"/>
  <image x="750" y="480" width="180" height="110" href="data:image/webp;base64,{massage}" clip-path="url(#massage-guns)"/>
</svg>
'''  # Ethan selected the c220035 reference: preserve its exact portrait, body, sausage legs and room outside the requested Dell screen and local massage-gun inserts; do not reintroduce the later camera patch or full-frame regeneration (task 01a07944-b48e-7e43-8c2f-34b9cfe3df70).


if __name__ == '__main__':
    (ASSETS / 'room.svg').write_text(room_image())
    print('Preserved the selected room, face and screens; added the Dell insert and small massage-gun patch behind the arm.')
