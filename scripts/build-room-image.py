#!/usr/bin/env python3
"""Package the complete rebuilt room without applying the rejected historical edits."""
import base64
from pathlib import Path

ASSETS = Path(__file__).resolve().parents[1] / 'docs' / 'assets'


def room_image():
    """Use one complete master for the room, fallback image and OBS preview."""
    image = base64.b64encode((ASSETS / 'room-rebuilt.webp').read_bytes()).decode('ascii')
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="1586" height="992" viewBox="0 0 1586 992">
  <title>Ethan's setup with his work screen and OBS layout</title>
  <image width="1586" height="992" href="data:image/webp;base64,{image}"/>
</svg>
'''  # Ethan rejected the accumulated portrait/screen/leg patches; do not reapply them over this fresh original-reference master (task 01a07944-b48e-7e43-8c2f-34b9cfe3df70).


if __name__ == '__main__':
    (ASSETS / 'room.svg').write_text(room_image())
    print('Packaged the complete rebuilt room; no historical correction layers are applied.')
