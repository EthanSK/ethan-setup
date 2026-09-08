# Product models

`docs/product-models.mjs` renders rotatable Three.js models of the hardware on the desk. Each model is hand-built
procedural geometry in millimetres from the manufacturer's published dimensions and product photography. Nothing here
is photogrammetry or a manufacturer CAD file; the notes below say which dimensions were published, which details came from reference images and
what is still approximate.

## Viewer

```js
import { createProductViewer } from "./product-models.mjs";
const viewer = await createProductViewer(canvas, "scarlett"); // rejects when WebGL or the model is unavailable
viewer.reset();   // return to the default three-quarter view and resume the slow auto-turn
viewer.dispose(); // stop rendering, drop listeners/observers and free GPU resources
```

- Product ids match `docs/gear.json`: `hs8`, `scarlett`, `flx4`, `akai`, `shure`, `bigknob`, `drive`, `macbook`,
  `dell`, `samsung`, `desk`, `chair`. `macmini` intentionally has no model (see below) and rejects like an unknown id.
- Drag rotates directly under the pointer (yaw and pitch), the pointer is captured only once a drag has started, a
  mostly vertical touch is left to scroll, and release leaves the model exactly where it is (no inertia). Arrow keys
  rotate and Home resets. A slow auto-turn runs only until the first interaction, and only while the canvas is on
  screen, the tab is visible and `prefers-reduced-motion` is off.
- Pixel ratio is capped at 1.5 and frames at 30 fps; nothing renders while idle. The camera is fitted from the model's
  true bounding sphere, so every vertex stays inside the canvas at any rotation and aspect ratio.
- Lighting is a neutral studio PMREM (feathered diffusers over a dark backdrop, mirroring `mouse-model.mjs`) with a
  warm key, cool edge and faint fill; the canvas clears transparent so the dialog's dark background shows through.
- Labels, screens and the bamboo top are small canvas textures drawn at load time; there are no image downloads.

## Sources and fidelity

| id | Hardware | Published dimensions | Read from photographs | Known approximations |
| --- | --- | --- | --- | --- |
| `hs8` | Yamaha HS8 (white) | 250 × 390 × 334 mm, 8" cone, 1" dome — Yamaha HS series specifications ([uk.yamaha.com](https://uk.yamaha.com/en/products/proaudio/speakers/hs_series/), HS8 technical data sheet) | White cone with black rubber surround, white waveguide, lit emblem below the woofer, rear round port above the amp plate | Rear port, amplifier plate and controls follow the front/rear photograph, with approximate spacing; the emblem is a lit disc rather than the tuning-fork mark |
| `scarlett` | Focusrite Scarlett 18i8 3rd Gen | 241 × 61 × 159.5 mm (handoff spec, Focusrite user guide); front/rear/left/right official photos linked from the saved page ([Focusrite product gallery](https://us.focusrite.com/products/scarlett-18i8-3rd-gen)) | Four combo inputs with gain halos and INST/AIR/PAD/48V buttons, large silver monitor dial, two headphone outputs | Rear socket spacing is approximate; the panel silkscreen is simplified |
| `flx4` | Pioneer DJ DDJ-FLX4 | 482 × 59.2 × 272.8 mm, 111.6 mm jog wheels, front PHONES/MIC, rear RCA + 2× USB-C ([Pioneer DJ specifications](https://www.pioneerdj.com/en/product/dj-controllers/ddj-flx4/), NZ specification page) | Two jog wheels, 8 pads per deck, 2-channel mixer with TRIM/HI/MID/LOW/CFX, Smart Fader / Smart CFX buttons, Beat FX section, tempo sliders | Exact knob/button spacing and the top-row loop/sync buttons are laid out by eye; the final dark jog surfaces, orange pad outlines and tempo-slider positions were checked against the official multi-angle gallery |
| `akai` | AKAI MPK mini Plus | 451 × 180 × 52 mm (17.76 × 7.08 × 2.04 in, [AKAI FAQ](https://support.akaipro.com/en/support/solutions/articles/69000803493-akai-pro-mpk-mini-plus-frequently-asked-questions)); 37 keys, 8 pads, 8 encoders, wheels + joystick, OLED, transport | Black chassis with red end cheeks, wheels left, pads centre, encoders right | Key pitch derived from the width (about 19.4 mm); function-button labels are representative, not a transcription |
| `shure` | Shure SM7B | ~197 × 149 × 97 mm including the yoke (Shure product page / spec sheet) | Black body, thick foam windscreen, side pivots with thumbscrews, rear switch plate, XLR at the rear bottom | The yoke is two straight bars and a crossbar rather than the curved stamped band |
| `bigknob` | Mackie Big Knob Passive | 137 W × 142 D × 79 H mm incl. knob ([mackie.com](https://mackie.com/en/products/accessories/big_knob_passive.html), manual) | Grey sloped steel wedge, 60 mm silver dial, MONO/MUTE/DIM row, two A/B selectors, rear 4 in / 4 out TRS + 3.5 mm | Front lip height and slope angle are estimated from photographs |
| `drive` | WD Elements Desktop 14 TB | 48 W × 135 D × 165.8 H mm ([WD product page](https://www.westerndigital.com/products/external-drives/wd-elements-desktop-usb-3-0-hdd?sku=WDBWLG0140HBK-EESN) / datasheet) | Upright black shell, WD wordmark and white LED on the front, USB micro-B, DC and Kensington on the rear | Top vents are a simple slot row |
| `macbook` | MacBook Pro 16-inch (M5 Max, space black) | 355.7 × 248.1 × 16.8 mm closed, 16.2" 3456 × 2234 display, left MagSafe/2× TB/audio, right SD/TB/HDMI ([apple.com specs](https://www.apple.com/macbook-pro/specs/)) | Lid open about 105°, notch, black key well with individual keys, speaker grilles, large trackpad | Wallpaper is a generated non-literal pebble scene; the Apple mark on the lid is omitted |
| `dell` | Dell S3422DW | 808 × 364.5 × 64 mm without stand, 1800R curve, 3440 × 1440 ([Dell user guide](https://dl.dell.com/manuals/all-products/esuprt_electronics_accessories/esuprt_electronics_accessories_monitors/dell-s3422dw-monitor_user's-guide_en-us.pdf)) | Thin black bezel, DELL badge, slim silver stand | The stand base/neck shape is simplified; the screen shows generated dark desktop rectangles |
| `samsung` | Samsung S80UA (S27A800U) | 615.5 × 368.2 × 42.7 mm panel, 615.5 × 551.9 × 196.4 mm with stand, 596.7 × 335.7 mm active area ([samsung.com](https://www.samsung.com/pt/monitors/high-resolution/s80ua-27-inch-ips-uhd-4k-ls27a800ujpxen/)) | Slim bezels, SAMSUNG mark, thin metal stand | Stand base shape simplified; generated desktop content |
| `desk` | FlexiSpot E7 Pro (2025) | 180 × 80 cm bamboo top; three-stage columns and C-frame per the E7 Pro product page ([flexispot.co.uk](https://flexispot.co.uk/next-generation-standing-desk-e7-pro)) | Black frame, flat feet, rear-set columns, keypad on the front edge | Column and foot cross-sections estimated; bamboo strips are a generated texture |
| `chair` | Hbada E3 Pro 2026 (grey, with footrest) | Width 25.6 in, seat width 20.27 in, seat height 18.1–20.4 in, five-star base ([hbada.uk](https://www.hbada.uk/products/hbada-e3-pro-ergonomic-office-chair?variant=57072259858807)); colours from `docs/assets/hbada.webp` | Grey mesh seat/back, light grey frame, lumbar wings, headrest, polished base, dark arm pads, footrest pulled out | Rounded mesh panels, curved metal arm supports, lumbar wings and split footrest follow the published chair photograph; the adjustment mechanisms and organic frame remain simplified |

### Not modelled

- **Mac mini** – the generation is unverified, and the M2-era (197 mm square) and M4-era (127 mm square) housings look
  nothing alike. Rather than invent one, `createProductViewer(canvas, "macmini")` rejects so the page shows its description and product link without an invented model.

## Verification

A development geometry check built all twelve products with real Three.js geometry and found no invalid coordinates. Manual Chrome testing covered loading, switching products, drag/release, keyboard rotation, reset, narrow viewports and clipping. The shared canvas retains its WebGL context between products while each viewer disposes its geometry, materials, textures, listeners and animation work.

The final visual pass corrected hidden speaker drivers, cylinder orientation, product switching, camera sizing, FLX4 colours and chair geometry. Reference pictures are linked rather than redistributed.
