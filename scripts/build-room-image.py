#!/usr/bin/env python3
"""Package the edited screen regions with the unchanged room photograph as one SVG."""
import base64
from pathlib import Path

ASSETS = Path(__file__).resolve().parents[1] / 'docs' / 'assets'


def room_image():
    """Keep every pixel outside the monitor outlines from the approved room photo."""
    original = base64.b64encode((ASSETS / 'room.webp').read_bytes()).decode('ascii')
    screens = base64.b64encode((ASSETS / 'room-screens.webp').read_bytes()).decode('ascii')
    laptop = base64.b64encode((ASSETS / 'room-laptop.webp').read_bytes()).decode('ascii')
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="1586" height="992" viewBox="0 0 1586 992">
  <title>Ethan's setup with his work screen and OBS layout</title>
  <defs>
    <clipPath id="screens">
      <polygon points="452,313 811,326 807,473 454,468"/>
      <polygon points="965,64 1390,34 1380,305 1174,311 1170,298 1163,286 1151,278 1137,273 1121,270 1105,272 1090,276 1076,283 1065,293 1057,304 1053,312 965,311"/>
    </clipPath>
    <clipPath id="laptop">
      <polygon points="26,433 235,428 253,535 57,560"/>
    </clipPath>
  </defs>
  <image width="1586" height="992" href="data:image/webp;base64,{original}"/>
  <image width="1586" height="992" href="data:image/webp;base64,{screens}" clip-path="url(#screens)"/>
  <image width="1586" height="992" href="data:image/webp;base64,{laptop}" clip-path="url(#laptop)"/>
</svg>
'''  # Keep the original face and hair in front of the Samsung; do not replace the whole room with another generated portrait (task 01a07944-b48e-7e43-8c2f-34b9cfe3df70).


if __name__ == '__main__':
    (ASSETS / 'room.svg').write_text(room_image())
    print('Packaged the edited monitor regions; the original room pixels remain outside them.')
