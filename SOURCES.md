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
| MacBook Pro 16-inch M5 Max, 64 GB | Ethan’s correction and matching live host chip/memory identification |
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
| Samsung S80UA / S27A800U | Live display name LS27A800U; regional suffix unconfirmed |
| Mac mini M4, 16 GB, silver | Direct hardware identification on 8 September 2026 confirms Mac mini, M4 and 16 GB; [Apple's 2024 specifications](https://support.apple.com/en-gb/121555) confirm the silver 127 × 127 × 50 mm enclosure |
| Corsair and Razer mice | Existing published Agentic Mouse setup and authored models |

Product links can lead to a current shop configuration, regional equivalent or support page after a model is discontinued. The configured desk size, chair colour and drive capacity above are the purchased setup, not a claim about a store’s default selection.

## Room image and screens

The room photograph was generated from Ethan’s own reference photos and later edited at his request to preserve his face, shirt, shorts and mice while giving him sausage legs. The current 1586 × 992 version extends the top and right of that approved image to include the full Samsung monitor. The edit requested the same person and room, a public OBS-style preview on the upper screen, and no private messages or account details. `docs/assets/room.webp` is a proportional WebP conversion of that generated image.

The share preview, `docs/assets/sausage-legs-social.jpg`, is a JPEG export of the original `ethan-sausage-legs.webp` at its unchanged 1671 × 941 dimensions. It keeps Ethan’s face and the sausage legs prominent without another image-generation pass.

Two desktop screenshots supplied on 8 September 2026 showed the ultrawide work layout and the upper OBS display. They contained private conversations and account details. No raw screenshot is included: the Dell reuses the public desktop example, and OBS recreates the recording layout with public example content. The page never connects to OBS or the native mouse app.

## Dependencies and rights

The website code inherits the Agentic Mouse MIT licence. Three.js, its loader utilities, Draco and three-mesh-bvh retain their vendored notices under `docs/lib/`. Any unused copied vendor files are not executed by the room.

App icons and the public desktop’s artwork retain their original owners’ rights; see [the canonical asset notes](https://github.com/EthanSK/response-preferences/blob/main/docs/desktop/ASSETS.md). Manufacturer names and product designs identify Ethan’s equipment and do not imply endorsement. Product model references and limitations are documented in `PRODUCT-MODELS.md`.

Ethan’s photo and likeness are published for this personal setup showcase. Reusing the source code does not grant permission to impersonate him or reuse his photographs as your own setup.
