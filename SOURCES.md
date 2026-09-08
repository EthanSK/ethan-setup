# Sources and ownership

## Maintained elsewhere

| Content | Source | How this site uses it |
| --- | --- | --- |
| Mouse modes, actions and app-specific controls | [Agentic Mouse](https://github.com/EthanSK/agentic-mouse) | Published Swift-generated `simulator-data.json`, with its source revision |
| Mouse models, rotation, HUD and app mark | Same Agentic Mouse revision | Exact public files, recorded in `sources.lock.json` |
| Interactive desktop, Dock, menu bar and Codex example | [Response Preferences](https://ethansk.github.io/response-preferences/) | Direct iframe, so there is one maintained implementation |
| App inventory and artwork | [Public desktop directory](https://ethansk.github.io/response-preferences/desktop/apps.json) | Synced metadata; app icons remain at their canonical public URLs |
| Room, hardware inventory, camera and OBS example | This repository | Original setup presentation |

Run `python3 scripts/sync-sources.py` after publishing the upstream repositories. It downloads only allowlisted public website files, pins the mouse runtime to the native export’s commit, and records file hashes. It does not read local app settings or private development checkouts. Daily Actions refreshes perform the same operation; the desktop iframe updates with its source website independently.

## Hardware evidence

Public product links and exact selected configurations are in `docs/gear.json`. Verification used Ethan’s instructions, live hardware identification and selected purchase lines; invoices, message IDs, account details and serial numbers remain private.

| Item | Evidence |
| --- | --- |
| MacBook Pro 16-inch M5 Max, 64 GB, 2 TB | Live host identification on 8 September 2026 confirms the 18-core CPU, 40-core GPU, memory and internal SSD; [Apple's exact-model specifications](https://support.apple.com/en-gb/126319) confirm the display, ProMotion and ports |
| White Yamaha HS8 pair | Gear4music purchase, September 2024; Yamaha specifications |
| Scarlett 18i8 third generation | eBay purchase, May 2023; Focusrite’s third-generation page |
| Pioneer DDJ-FLX4 | Argos collected receipt, June 2025; Pioneer product dimensions |
| Akai MPK mini Plus | Amazon purchase, February 2023; Akai guide confirms 37 keys and 8 pads |
| Mackie Big Knob Passive | Gear4music purchase, March 2025; Mackie product page |
| WD Elements Desktop, black, 14 TB | Amazon order August 2026 and delivery September 2026 |
| Hbada E3 Pro 2026, grey, footrest | Hbada shipment confirmation, July 2026 |
| FlexiSpot E7 Pro 2025, bamboo 180 × 80 cm, black frame | Previously verified purchase configuration from Agentic Mouse; March 2025 invoice found again |
| Shure SM7B | Ethan’s identification; Shure manual drawings |
| Dell S3422DW | July 2026 host display inventory identifies DELL S3422DW at 3440 × 1440, 100 Hz; rechecked against that record and Dell's user guide. The current capture device obscures direct identification |
| Canon EOS M50 Mark II, black | Ethan's identification and original desk photograph, corroborated by historical model correspondence; [Canon specifications](https://www.canon.co.uk/cameras/eos-m50-mark-ii/specifications/) and product photographs. The currently fitted lens has not been verified |
| Samsung S80UA / S27A800U | Live display name LS27A800U; regional suffix unconfirmed |
| Mac mini M4, 16 GB, silver | Direct hardware identification on 8 September 2026 confirms Mac mini, M4 and 16 GB; [Apple's 2024 specifications](https://support.apple.com/en-gb/121555) confirm the silver 127 × 127 × 50 mm enclosure |
| Corsair and Razer mice | Existing published Agentic Mouse setup and authored models |

Product links can lead to a current shop configuration, regional equivalent or support page after a model is discontinued. The configured desk size, chair colour and drive capacity above are the purchased setup, not a claim about a store’s default selection.

## Official product galleries

The 43 gallery photographs and illustrations under `docs/assets/products/` were selected from manufacturer pages on 8 September 2026. Each `images` entry in `docs/gear.json` records its original URL; the photo links back to that source. Files are resized proportionally, with empty outer padding removed from product cutouts, stripped of metadata and stored locally as WebP, so opening a gallery does not depend on a manufacturer's image server.

Corsair and Razer photos show the black/yellow Scimitar Elite Wireless SE and black left-handed Naga. Yamaha images show white HS8 monitors; Focusrite shows the third-generation 18i8; Apple shows the Space Black MacBook Pro enclosure and silver M4 Mac mini. Canon photographs depict the black EOS M50 Mark II, including Canon's pictured kit lens; the currently fitted lens remains unverified. Hbada shows the grey 2026 E3 Pro with footrest.

The Akai images come from the [MPK mini Plus product gallery](https://www.akaipro.com/mpk-mini-plus/). Pioneer, Samsung, Mackie and Western Digital images come from their respective product pages linked in the inventory. Shure's photos show the SM7B in manufacturer recording setups. The Dell angled photo comes from its official S3422DW gallery; the front image is extracted from a [Dell-authored S3422DW brochure](https://cdn.e-misija.si/pdf/S3422DW.pdf) hosted by a distributor, because several images on Dell's older CDN currently return errors. That brochure image retains its original 400 × 235 resolution.

FlexiSpot now offers a newer frame at the UK product URL. Its gallery therefore uses a black E7 Pro frame-detail photograph from the manufacturer's 2025 US page and the UK bamboo-finish sample, labelled as such; it does not substitute a complete 2026 desk or a different desktop for Ethan's purchased 2025 configuration. Mackie supplies one isolated product image in the selected official gallery; no second angle is invented.

These are manufacturer-owned product assets, not generated photographs or MIT-licensed project artwork. Source links identify provenance and do not imply manufacturer endorsement or a general right to redistribute the assets elsewhere.

## Product geometry and movement

The model pass used the existing official multi-angle gallery captures, then added Shure’s dimension and exploded-yoke drawings, Mackie’s front/rear manual diagrams, monitor adjustment guides and Hbada’s exact 2026 mechanism specifications. [PRODUCT-MODELS.md](PRODUCT-MODELS.md) records the sources, implemented movements and uncertain dimensions, including the conflicting chair lift specifications and the older desk generation. No generated image is used as evidence of a product’s geometry.

## Room image and screens

The room photograph was generated from Ethan’s own reference photos and later edited at his request to preserve his face, shirt, shorts and mice while giving him sausage legs. The current 1586 × 992 version extends the top and right of that approved image to include the full Samsung monitor. The edit requested the same person and room, a public OBS-style preview on the upper screen, and no private messages or account details. `docs/assets/room.webp` is a proportional WebP conversion of that generated image.

At Ethan’s request, the sausage-leg hotspot links to [Tesco Finest 6 Pork Sausages 400G](https://www.tesco.com/shop/en-GB/products/280002982), with his parenthetical joke about only eating M&S, Waitrose or Deliveroo sausages. The product page was checked on 8 September 2026; this is a joke link, not purchased hardware or a product recommendation.

The share preview, `docs/assets/sausage-legs-social.jpg`, is a JPEG export of the original `ethan-sausage-legs.webp` at its unchanged 1671 × 941 dimensions. It keeps Ethan’s face and the sausage legs prominent without another image-generation pass.

The 00:22 and 00:25 desktop captures from 8 September 2026 are the references for the two external screens in the main photograph. The Dell insert retains the Vibideo asset browser, developer tools, Codex workspace and public mouse website; the Samsung insert retains OBS++, its scene preview, audio mixer and CPU/GPU graphs. The built-in image editing tool fitted their content into the photographed displays and removed private conversations, account details, local paths and transcription overlays. These are edited screenshot inserts, not untouched captures or a live view of Ethan’s computer.

`docs/assets/room-screens.webp` contains the edited external screens. After Ethan rejected the dry-pebble wallpaper and the accumulated face distortion, a fresh built-in image edit used his original short-hair portrait from 2 September as the identity reference and the actual installed Apple Tahoe rocks-and-water wallpaper as the screen reference. `room-details.webp` contains that correction; `image-prompts/room-face-wallpaper.txt` records the prompt without private input paths.

`scripts/build-room-image.py` packages only the external screens, laptop display and corrected head region over the unchanged original `room.webp` in the self-contained `room.svg`. A soft edge blends the head correction into the existing scene. The shirt and its printed photo, body, hands, shorts, sausage legs and surrounding room remain from the original outside those regions. The same composite loads in the Three.js room, plain-image fallback and OBS example. The social card retains its existing image.

The rotatable MacBook uses `docs/assets/macbook-wallpaper.webp`, a proportional 1280 × 720 WebP conversion of Apple's installed Tahoe default image. It replaces the previous procedural dry-pebble substitute and is the same wallpaper supplied to the room-image edit. Apple retains the wallpaper's rights; it is included to depict Ethan's actual setup, not as original project artwork.

The Canon camera above the ultrawide uses a small built-in image-generation edit based on the original desk photo and Canon's black EOS M50 Mark II product photograph. Only its 148 × 115 patch, `docs/assets/room-camera.webp`, is composited into the existing room at its original pixel scale. All previous image layers, including the corrected face and screen inserts, remain unchanged. `image-prompts/room-camera.txt` records the prompt and selected region; no raw reference photo is published.

No raw portrait or private screenshot is included. Clicking the Dell opens its monitor product; a separate nearby Codex hotspot opens the canonical public desktop example, and a separate OBS hotspot opens the interactive public OBS example. Samsung opens its monitor product. The page never connects to OBS or the native mouse app. The earlier external-screen prompt remains in `image-prompts/room-screens.txt`.

The personal site's head favicon uses Ethan's original short-hair portrait as the input to a built-in image edit, followed by local chroma-key removal. `docs/assets/ethan-head.png` is the transparent 512-pixel master; `scripts/build-icons.py` exports the smaller browser and home-screen PNGs without stretching it. The edit requested his original face and expression with only the head retained; `image-prompts/head-icon.txt` records the prompt. This is an edited cutout, not an untouched pixel crop of the original portrait.

## Dependencies and rights

The website code inherits the Agentic Mouse MIT licence. Three.js, its loader utilities, Draco and three-mesh-bvh retain their vendored notices under `docs/lib/`. Any unused copied vendor files are not executed by the room.

App icons and the public desktop’s artwork retain their original owners’ rights; see [the canonical asset notes](https://github.com/EthanSK/response-preferences/blob/main/docs/desktop/ASSETS.md). Manufacturer names and product designs identify Ethan’s equipment and do not imply endorsement. Product model references and limitations are documented in `PRODUCT-MODELS.md`.

Ethan’s photo and likeness are published for this personal setup showcase. Reusing the source code does not grant permission to impersonate him or reuse his photographs as your own setup.

## OBS setup details

The OBS view records a safe settings snapshot checked on 8 September 2026 against the installed OBS++ 32.2.2 bundle, Aitum++ 1.2.1 log entry, current profile settings and recording log. Desk and laptop profiles are identified separately. The website never exports raw profiles, stream keys, private browser dock addresses or device IDs. The Aitum canvas size and Apple H.264 encoder alignment are different values and are labelled separately. The public forks own their change notes and build instructions: [OBS++](https://github.com/EthanSK/obs-plus-plus) and [Aitum++](https://github.com/EthanSK/obs-aitum-stream-suite). Neither currently publishes a binary installer; the example is a simulation, not native-runtime verification.
