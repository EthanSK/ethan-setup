#!/usr/bin/env python3
"""Package the requested portrait, screen, camera and leg edits over the original room."""
import base64
from pathlib import Path

ASSETS = Path(__file__).resolve().parents[1] / 'docs' / 'assets'


def room_image():
    """Preserve the original room outside the explicitly edited regions."""
    original = base64.b64encode((ASSETS / 'room.webp').read_bytes()).decode('ascii')
    screens = base64.b64encode((ASSETS / 'room-screens.webp').read_bytes()).decode('ascii')
    details = base64.b64encode((ASSETS / 'room-details.webp').read_bytes()).decode('ascii')
    camera = base64.b64encode((ASSETS / 'room-camera.webp').read_bytes()).decode('ascii')
    dell_legs = base64.b64encode((ASSETS / 'room-dell-legs.webp').read_bytes()).decode('ascii')
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
    <image id="dell-legs" width="1586" height="992" href="data:image/webp;base64,{dell_legs}"/>
    <mask id="shorter-legs" maskUnits="userSpaceOnUse" x="0" y="730" width="1100" height="262">
      <path d="M 0,740 L 620,740 L 738,748 L 779,770 L 801,844 L 853,829 L 882,815 L 920,835 L 944,921 L 1050,974 L 1090,992 L 0,992 Z" fill="white" filter="url(#portrait-edge)"/>
    </mask>
    <image id="details" width="1586" height="992" href="data:image/webp;base64,{details}"/>
    <filter id="portrait-edge"><feGaussianBlur stdDeviation="2"/></filter>
    <mask id="portrait" maskUnits="userSpaceOnUse" x="0" y="0" width="1586" height="992">
      <ellipse cx="1109" cy="375" rx="76" ry="114" fill="white" filter="url(#portrait-edge)"/>
    </mask>
    <clipPath id="laptop">
      <polygon points="26,433 235,428 253,535 57,560"/>
    </clipPath>
    <mask id="camera" maskUnits="userSpaceOnUse" x="779" y="113" width="148" height="115">
      <rect x="782" y="116" width="142" height="109" rx="2" fill="white" filter="url(#portrait-edge)"/>
    </mask>
  </defs>
  <image width="1586" height="992" href="data:image/webp;base64,{original}"/>
  <image width="1586" height="992" href="data:image/webp;base64,{screens}" clip-path="url(#screens)"/>
  <use href="#dell-legs" clip-path="url(#dell)"/>
  <use href="#dell-legs" mask="url(#shorter-legs)"/>
  <use href="#details" clip-path="url(#laptop)"/>
  <use href="#details" mask="url(#portrait)"/>
  <image x="779" y="113" width="148" height="115" href="data:image/webp;base64,{camera}" mask="url(#camera)"/>
</svg>
'''  # Keep each requested edit local: whole-frame replacements would change the approved face, shirt and body; the later leg request only replaces the legs and newly exposed footrest (task 01a07944-b48e-7e43-8c2f-34b9cfe3df70).


if __name__ == '__main__':
    (ASSETS / 'room.svg').write_text(room_image())
    print('Packaged the corrected portrait, screens, camera and shorter legs; other room pixels remain unchanged.')
