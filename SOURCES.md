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
| Scarlett 18i8 third generation | Live USB identification on 8 September 2026; the connected unit's serial prefix matches third generation in [Focusrite's identification guide](https://support.focusrite.com/hc/en-gb/articles/208295789-Which-generation-of-Scarlett-do-I-have). The complete serial remains private; the earlier purchase record is from May 2023 |
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

The current `docs/assets/room-rebuilt.webp` was rebuilt from original references on 8 September 2026 after Ethan rejected the accumulated room, face and sausage-leg edits. His original short-hair portrait from 2 September supplies his identity and black “CDO FOR LIFE” shirt with beige shorts; his actual 5 September desk photograph supplies the room arrangement. Manufacturer photographs identify the grey Hbada chair, both mice, Canon camera and music hardware. It remains an AI-generated scene, not an untouched photograph or a measured room scan.

The screen references are Apple's actual Tahoe rocks-and-clear-water wallpaper for the MacBook, Ethan's supplied VS Code diff screenshot for the Dell's right half, the 00:53 timeline frame from his Y Combinator AIMVS/Vibideo demo for the left half, and his 00:25 OBS/CPU/GPU capture for the Samsung. The generated inserts retain those layouts without private messages, account identifiers, local paths or transcription overlays; they are not pixel-exact screenshots.

The sausage legs use a [real cooked-sausage photograph from the English Breakfast Society](https://englishbreakfastsociety.com/bangers-sausage-recipe) as the reference for plump shape, browned casing and rounded ends. Ethan's joke hotspot still links to [Tesco Finest 6 Pork Sausages 400G](https://www.tesco.com/shop/en-GB/products/280002982), with his parenthetical note about M&S, Waitrose and Deliveroo. It is a joke, not purchased hardware.

The built-in image tool accepts five reference paths, so identity, product and screen references were arranged into private contact sheets with their proportions preserved. The first fresh generation used only original references, then framing and equipment corrections removed an invented wall slogan and duplicate interface. The final output is 1586 × 992, exported proportionally without metadata. [The complete prompts](image-prompts/room-rebuilt.txt) record the inputs and refinements without private source paths.

`scripts/build-room-image.py` now packages only this complete master into the self-contained `room.svg`, shared by the Three.js room, fallback image, README and OBS example. None of the historical portrait, screen, camera or leg layers is applied over it. The social card uses a JPEG export of the same completed frame at 1586 × 992. Historical source assets and prompts remain in the repository for provenance, not as active correction layers.

The rotatable MacBook separately uses `docs/assets/macbook-wallpaper.webp`, a proportional export of the same installed Apple Tahoe image. Apple retains its wallpaper rights. Product-gallery provenance and rights are listed above. The generated room and its equipment are illustrations, not manufacturer photography or proof of exact geometry.

No raw portrait, private screenshot or demo recording is published. Clicking Dell opens its monitor product; separate Codex and OBS hotspots open the public software examples, and Samsung opens its own product. The website never connects to Ethan's native apps.

The personal site's head favicon uses Ethan's original short-hair portrait, processed by the built-in image editor and local background removal. `docs/assets/ethan-head.png` is the transparent master; `scripts/build-icons.py` makes proportional icon exports. This is an edited cutout, not an untouched crop; `image-prompts/head-icon.txt` records that separate earlier edit.

## Dependencies and rights

The website code inherits the Agentic Mouse MIT licence. Three.js, its loader utilities, Draco and three-mesh-bvh retain their vendored notices under `docs/lib/`. Any unused copied vendor files are not executed by the room.

App icons and the public desktop’s artwork retain their original owners’ rights; see [the canonical asset notes](https://github.com/EthanSK/response-preferences/blob/main/docs/desktop/ASSETS.md). Manufacturer names and product designs identify Ethan’s equipment and do not imply endorsement. Product model references and limitations are documented in `PRODUCT-MODELS.md`.

Ethan’s photo and likeness are published for this personal setup showcase. Reusing the source code does not grant permission to impersonate him or reuse his photographs as your own setup.

## OBS setup details

The OBS view records a safe settings snapshot checked on 8 September 2026 against the installed OBS++ 32.2.2 bundle, Aitum++ 1.2.1 log entry, current profile settings and recording log. Desk and laptop profiles are identified separately. The website never exports raw profiles, stream keys, private browser dock addresses or device IDs. The Aitum canvas size and Apple H.264 encoder alignment are different values and are labelled separately. The public forks own their change notes and build instructions: [OBS++](https://github.com/EthanSK/obs-plus-plus) and [Aitum++](https://github.com/EthanSK/obs-aitum-stream-suite). Neither currently publishes a binary installer; the example is a simulation, not native-runtime verification.

## September 2026 interface audit

The expanded project directory uses public repository metadata checked without authentication on 8 September 2026; `docs/projects.json` records the selected repository URLs. The software hotspots derive the same synced `apps.json` as the app directory; Codex and OBS keep their separate screen views. Personal skill cards contain short capability descriptions, without private paths or unpublished repository links.

The wide Scroll to zoom heading uses the same Microgramma D Extended Bold font asset as Ethan's AIMVS heading, at his request. The included font is third-party artwork and is not covered by this repository's MIT code licence.

Ethan's portfolio URL, https://portosaurus.github.io/ethansk/, is linked as “Ethan's portfolio” by the official Portosaurus homepage. The public page returned HTTP 200 without a frame-blocking policy on 8 September 2026; the site links it beside the brand and embeds it in the directory. LinkedIn lists Portosaurus as Ethan's portfolio-generator project, but the homepage supplied the individual portfolio URL.
