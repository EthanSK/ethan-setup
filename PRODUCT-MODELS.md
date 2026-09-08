# Product models

`docs/product-models.mjs` renders rotatable Three.js models of the hardware on the desk. Each model is hand-built
procedural geometry in millimetres from the manufacturer's published dimensions and product photography. Nothing here
is photogrammetry or a manufacturer CAD file; the notes below say which dimensions were published, which details came from reference images and
what is still approximate.

## Viewer

```js
import { createProductViewer } from "./product-models.mjs";
const viewer = await createProductViewer(canvas, "scarlett", movementControls); // rejects when WebGL or the model is unavailable
viewer.reset();   // restore the initial view and the selected movement
viewer.dispose(); // stop rendering, drop listeners/observers and free GPU resources
```

`movementControls` contains a labelled `<select>` and a play/pause `<button>`; the viewer hides it for fixed enclosures.

- Product ids match `docs/gear.json`: `hs8`, `scarlett`, `flx4`, `akai`, `shure`, `bigknob`, `drive`, `macbook`,
  `macmini`, `dell`, `canon`, `samsung`, `desk`, `chair`. The two mice use the original Agentic Mouse GLB files and their native button mapping.
- Drag rotates directly under the pointer (yaw and pitch), the pointer is captured only once a drag has started, a
  mostly vertical touch is left to scroll, and release leaves the model exactly where it is (no inertia). Arrow keys
  rotate and Home resets. Fixed products slowly turn until the first interaction. Moving products sway near their initial viewing angle,
  pause during inspection and resume their adjustment six seconds after release; the viewing angle stays where the visitor left it.
  Explicit Pause persists. Reduced motion starts paused; the visitor can deliberately choose Play.
- Pixel ratio is capped at 1.5 and frames at 30 fps; nothing renders while idle. The camera is fitted from the model's
  bounding sphere across every adjustment, so raised desks and portrait monitors stay inside the canvas without camera zoom changes.
  Rendering stops when the gallery photo hides the canvas, the browser page is hidden, or the demo is paused; movement changes transforms only.
- Lighting is a neutral studio PMREM (feathered diffusers over a dark backdrop, mirroring `mouse-model.mjs`) with a
  soft warm key, cool edge and neutral fill; the canvas clears transparent so the dialog's dark background shows through.
- Labels, camera reflections and the bamboo top are small canvas textures drawn at load time; the MacBook loads its bundled wallpaper image.

## Sources and fidelity

| id | Hardware | Published dimensions | Read from photographs | Known approximations |
| --- | --- | --- | --- | --- |
| `hs8` | Yamaha HS8 (white) | 250 × 390 × 334 mm, 8" cone, 1" dome — Yamaha HS series specifications ([uk.yamaha.com](https://uk.yamaha.com/en/products/proaudio/speakers/hs_series/), HS8 technical data sheet) | White cone with black rubber surround, white waveguide, lit emblem below the woofer, rear round port above the amp plate | Rear port, amplifier plate and controls follow the front/rear photograph, with approximate spacing; the emblem is a lit disc rather than the tuning-fork mark |
| `scarlett` | Focusrite Scarlett 18i8 3rd Gen | 241 × 61 × 159.5 mm (handoff spec, Focusrite user guide); front/rear/left/right official photos linked from the saved page ([Focusrite product gallery](https://us.focusrite.com/products/scarlett-18i8-3rd-gen)) | Four combo inputs with gain halos and INST/AIR/PAD/48V buttons, large silver monitor dial, two headphone outputs | Rear socket spacing is approximate; the panel silkscreen is simplified |
| `flx4` | Pioneer DJ DDJ-FLX4 | 482 × 59.2 × 272.8 mm, 111.6 mm jog touch surface, front PHONES/MIC, rear RCA + 2× USB-C ([Pioneer DJ specifications](https://www.pioneerdj.com/en/product/dj-controllers/ddj-flx4/), NZ specification page) | Two jog wheels, 8 pads per deck, 2-channel mixer with TRIM/HI/MID/LOW/CFX, Smart Fader / Smart CFX buttons, Beat FX section, tempo sliders | The wider sloped jog rims, circular transport/loop buttons, pads and tempo sliders were fitted to the official top photograph; small labels and the mixer details remain simplified |
| `akai` | AKAI MPK mini Plus | 451 × 180 × 52 mm (17.76 × 7.08 × 2.04 in, [AKAI FAQ](https://support.akaipro.com/en/support/solutions/articles/69000803493-akai-pro-mpk-mini-plus-frequently-asked-questions)); 37 keys, 8 pads, 8 encoders, wheels + joystick, OLED, transport | Black chassis with red end cheeks; C-to-C keybed, wheels and red joystick left, 2×4 pads left of the display, 2×4 encoders right, transport below | Key pitch derived from the width (about 19.4 mm); function-button labels are representative, not a transcription |
| `shure` | Shure SM7B | 197.1 mm barrel length, 62.5 mm diameter, 97.4 mm across knobs, 149.2 mm overall height ([Shure manual](https://pubs.shure.com/view/guide/SM7B/en-US.pdf), dimension drawing and exploded yoke) | Tapered rear barrel, standard RK345 foam, curved U-shaped stamped yoke, ridged black thumbscrews, rear switch plate and fixed XLR mounting bracket | Foam pores, moulded transitions and screw spacing remain approximate; the bracket follows the manual’s stand configuration |
| `bigknob` | Mackie Big Knob Passive | 137 W × 142 D × 79 H mm ([Mackie manual](https://mackie.com/img/file_resources/Big_Knob_Passive_OM.pdf), front and rear dimension drawings) | Grey sloped steel wedge, silver dial above the curved MONO/MUTE/DIM row, two A/B selectors, four rear TRS pairs and central 3.5 mm input | Front lip height and slope angle are estimated from photographs |
| `drive` | WD Elements Desktop 14 TB | 48 W × 135 D × 165.8 H mm ([WD product page](https://www.westerndigital.com/products/external-drives/wd-elements-desktop-usb-3-0-hdd?sku=WDBWLG0140HBK-EESN) / datasheet) | Upright black shell, WD wordmark and white LED on the front, USB micro-B, DC and Kensington on the rear | Rear grille, sockets and enclosure seams are simplified |
| `macbook` | MacBook Pro 16-inch (M5 Max, space black) | 355.7 × 248.1 × 16.8 mm closed, 16.2" 3456 × 2234 display, left MagSafe/2× TB/audio, right SD/TB/HDMI ([apple.com specs](https://www.apple.com/macbook-pro/specs/)) | Lid open about 105°, notch, black key well with individual keys, speaker grilles, large trackpad | Display uses Apple's actual Tahoe rocks-and-water wallpaper, cropped proportionally; the Apple mark on the lid is omitted |
| `macmini` | Mac mini M4 (2024), silver | 127 × 127 × 50 mm ([Apple specifications and front/rear photographs](https://support.apple.com/en-gb/121555)); M4 and 16 GB verified directly on Ethan's machine | Rounded aluminium enclosure, black ventilated base, two vertical front USB-C ports, indicator and headphone jack; rear power, Ethernet, HDMI and three vertical Thunderbolt ports; underside power button | Corner radius, vent spacing and sockets are drawn from the photographs; the Apple outline reuses the canonical desktop menu icon |
| `dell` | Dell S3422DW | 808 × 364.5 × 64 mm without stand, 1800R curve, 3440 × 1440 ([Dell user guide](https://dl.dell.com/manuals/all-products/esuprt_electronics_accessories/esuprt_electronics_accessories_monitors/dell-s3422dw-monitor_user's-guide_en-us.pdf)) | Thin black bezel, DELL badge, platinum rear shell and vents, silver stand with cable opening | Small sockets and mouldings are approximate; the screen shows generated dark desktop rectangles |
| `canon` | Canon EOS M50 Mark II, black | 116.3 × 88.1 × 58.7 mm body ([Canon specifications and product gallery](https://www.canon.co.uk/cameras/eos-m50-mark-ii/specifications/)) | Sculpted grip, viewfinder and flash housing, hot shoe, lens rings, shutter dial, rear controls and open articulated screen | Surface curves and small controls are approximate; the compact EF-M 15–45mm lens illustrates Canon's product reference, not a verified current lens configuration; the display is a plain reflection, not a live feed |
| `samsung` | Samsung S80UA (S27A800U) | 615.5 × 368.2 × 42.7 mm panel, 615.5 × 551.9 × 196.4 mm with stand, 596.7 × 335.7 mm active area ([samsung.com](https://www.samsung.com/pt/monitors/high-resolution/s80ua-27-inch-ips-uhd-4k-ls27a800ujpxen/)) | Slim bezels, SAMSUNG mark, rear vents, telescoping stand, tilt hinge and portrait pivot | Stand base shape simplified; generated desktop content |
| `desk` | FlexiSpot E7 Pro (2025) | 180 × 80 cm bamboo top; three-stage columns and C-frame per the E7 Pro product page ([flexispot.co.uk](https://flexispot.co.uk/next-generation-standing-desk-e7-pro)) | Black frame, flat feet, rear-set columns, keypad on the front edge | The 20 mm top thickness, column sections and exact overlap are photo-derived estimates; bamboo strips are a generated texture |
| `chair` | Hbada E3 Pro 2026 (grey, with footrest) | Width 25.6 in, seat width 20.27 in, seat height 18.1–20.4 in, five-star base ([hbada.uk](https://www.hbada.uk/products/hbada-e3-pro-ergonomic-office-chair?variant=57072259858807)); colours from `docs/assets/hbada.webp` | Grey mesh seat/back, light grey frame, lumbar wings, headrest, polished base, dark arm pads, footrest pulled out | Woven curved surfaces, separate padded wings, open rear Y frame, twin castors, folding split footrest and separate head/arm joints follow front, rear and reclined photos; upholstery contours and mechanical linkages remain approximate |

## Moving parts

The 12 adjustable procedural products have 39 demos. **All movements** cycles through them, or the selector loops one adjustment. Each loop eases from rest to the adjustment and back. Knob and key demos are silent illustrations; they do not change any device or computer setting.

| Product | Demos and reference |
| --- | --- |
| Hbada E3 Pro 2026 | 19: recline, footrest, seat height/depth, backrest height, lumbar height/depth/wings/adaptive support, four headrest adjustments, six armrest adjustments and chair swivel. [Hbada’s exact 2026 page](https://www.hbada.uk/products/hbada-e3-pro-ergonomic-office-chair?variant=57072259858807) supplies the ranges below; its front, rear and reclined photographs establish the joints. |
| FlexiSpot E7 Pro 2025 | Height: 635–1285 mm, with the top, crossmembers, tray and keypad moving on three telescoping stages above fixed feet. [Older E7 series comparison](https://flexispot.co.uk/e7-series) confirms this generation’s range; the current 2026 listing is not the reference. The cycle is illustrative, not a measured motor speed. |
| Dell S3422DW | Height 100 mm and tilt 5° forward / 21° back, from [Dell’s adjustment diagram](https://dl.dell.com/manuals/all-products/esuprt_electronics_accessories/esuprt_electronics_accessories_monitors/dell-s3422dw-monitor_Reference-Guide_en-us.pdf). No portrait mode or invented swivel. |
| Samsung S80UA | Height 120 mm, tilt 2° forward / 25° back, stand swivel ±30° and portrait 90°. The portrait demo raises and tilts the screen first for clearance. [Samsung’s S80UA specification table](https://images.samsung.com/is/content/samsung/assets/global/business/ds-showcase-2021/pdf/Samsung_High_Resolution_Monitor_Catalog_WEB.pdf). |
| Canon EOS M50 Mark II | Screen opening and independent screen flip, following [Canon’s articulated-screen instructions](https://cam.start.canon/en/C007/manual/html/UG-01_Preparations_0040.html). The demonstration covers a folded-to-open screen and a 180° selfie flip. |
| MacBook Pro | Lid closes from the initial 105° opening to almost shut; illustrative travel, not a claim about the hinge’s mechanical limits. |
| SM7B | Barrel tilts on its side pivots while the yoke and XLR bracket remain fixed, following Shure’s mounting diagram. The chosen arc is illustrative. |
| Mackie / Scarlett / HS8 | Their physical volume knobs turn back and forth; the HS8 knob is on the rear, visible when rotated. The chosen arcs do not assert calibrated gain values. |
| DDJ-FLX4 | Jog wheels scratch back and forth; the crossfader slides within its slot. |
| MPK mini Plus | Keys press, pitch and modulation wheels turn, and encoders rotate; control placement follows Akai’s top, front, rear and angled gallery photos. |

The Mac mini and WD enclosure remain fixed objects with the existing slow turntable. Both mice retain their canonical Agentic Mouse GLBs and interactive controls.

### Hbada ranges and limits

- Recline: 105–140° with accompanying arm support movement; the footrest is a separate manual adjustment.
- Seat depth 50 mm; backrest height 80 mm; lumbar height 60 mm, depth 32 mm, wing adjustment 40°, adaptive tilt 5° and glide 30 mm.
- Headrest: height 40 mm, depth 70 mm and two separate 70° pivots.
- Arms: height 70 mm, fore/aft 60 mm, stem and pad each rotate 360°, pad tilts 26° up / 13° down. Recline-linked arm movement uses 35° of the stated 40° range.
- Hbada’s page contradicts itself on seat lift: 85 mm in the feature text versus 18.1–20.4 inches in the dimensions. The demo uses the smaller 58 mm span; it does not claim a certified full stroke.
- Footrest extension and folding, upholstery contours, swivel demonstration and linkage offsets are estimated from photos. These models illustrate adjustments and cannot establish ergonomic fit, clearances or load ratings.

## Verification

Run `node scripts/check-model-geometry.mjs` for all 14 builders and 39 adjustment sweeps. It uses the bundled Three.js geometry and samples independent reset behavior, finite coordinates and containment throughout each movement. Canvas painting and image decoding require the browser checks; the test does not prove appearance or mechanical collision clearance.

Before publishing, inspect the exact built version in Codex’s built-in browser: compare front/side/rear silhouettes with the galleries, exercise adjustment selection and pause/play, rotate and release, reset, change photo and return, and switch products. Check narrow layouts and browser errors. Actual two-touch pinch remains unverified when the browser tool does not supply two-touch input.

Reference photographs remain available underneath the default 3D view; see `SOURCES.md` and each gallery entry for provenance. The models are photo-based illustrations, not manufacturer CAD.
