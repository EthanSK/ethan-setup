# Verified website lessons

## Preview availability

The room and HUD can remain visible from browser cache after the local HTTP server stops. Product modules and mouse GLBs load on demand, so an unavailable preview server makes every newly opened 3D view fail even when the published assets are intact. Check the exact failed URL and server before replacing models. Leave the published URL as the final browser handoff; keep any requested local server independent of a turn-scoped command session.

## Product rotation and shadows

A ground shadow placed below the unrotated model can cut through its lower half after pitch rotation. Position it below the rotated bounds, then inspect front, side and tilted views. Preserve the shared canvas context while disposing each product's geometry, materials, listeners and animation work.

## Background navigation

The room needs a plain background-click action as well as drag handling. Increase zoom around the clicked photo point using the currently visible camera scale, and retain the drag/pinch click suppression so releasing a gesture cannot also zoom. Anchor only after the photo viewport is measured; a click can arrive during image loading. Give visible objects label space before distant edge arrows. Verify actual clicks at different coordinates, unchanged scale after dragging, drag-cursor release, wheel direction, and product/backdrop clicks in the built-in browser.

## Monitor views

The Dell room hotspot opens its rotatable monitor model, specs and product link. A separate nearby Codex hotspot opens the full-height desktop embed; do not route the Dell product click to that website again. The Samsung hotspot also opens its monitor product; a nearby OBS hotspot owns the recording demo and setup details. Do not combine distinct hardware/software identities in one label or click action. Do not reintroduce duplicate headings, subtitles or a Desktop / 3D monitor toolbar above the embedded screen. Keep its accessible name, close control and outside-click dismissal.

Screenshots requested for the main room picture must actually appear inside its photographed displays. Using them only as layout references for click-open demos leaves the reported blur unchanged. Apply the safe screen content to the main image and inspect the screen edges and head occlusion at close zoom. Keep the approved original photo outside those regions so another screen edit cannot change Ethan’s face or body. Preserving an older generated face does not prove its likeness: when Ethan requests a face correction, inspect and reuse his original real portrait, then isolate the corrected head so the rest of the person is not regenerated. His MacBook wallpaper means Apple’s Tahoe rocks in clear water; use the actual reference in both the room photo and rotatable model, not invented dry pebbles.

A request to shorten the sausage legs needs a separate lower-body mask, including the newly exposed footrest. Keep the previous corrected portrait and other screen layers; image generation can change their pixels even when the prompt says to preserve them. Inspect the output visually rather than assuming the requested length percentage was followed.

## Hardware identification

When purchase search cannot identify a paired computer, read its hardware model and chip through the existing diagnostic connection. Publish only the relevant specs, never its connection details or identifiers. Match the confirmed generation to official dimensions and photographs before building its enclosure.

Scarlett USB display names omit the generation. Check the connected device's serial prefix against Focusrite's official generation table before changing its model or gallery; a purchase year alone is insufficient. The live 18i8 was confirmed as third generation on 8 September 2026. Keep complete serial numbers and raw device dumps private.

Software and joke hotspots belong outside the verified hardware inventory. The sausage-leg link uses the existing dialog and camera flow with its own small link panel; routing it through the hardware viewer would request a product model that does not exist.

The MacBook's full specs come from its live CPU/GPU, memory and internal storage identification, with display and ports checked against Apple's exact-model page. Keep the first three entries as a compact directory summary and expose the full list in its dialog. A historical order with a return request can help identify a camera model, but cannot establish the currently fitted lens.

The AI wording disclaimer belongs once in the Everything I use footer. Putting it in the shared product dialog repeats it for every device and makes it appear to be part of embedded apps.

Small equipment corrections should retain only the generated object's local patch in the SVG composite. Keep the existing face and screen layers identical; do not replace the full room with another generated frame. Verify the composite in the built-in browser: ImageMagick's internal SVG renderer misrenders these embedded-image masks and cannot prove their visual appearance.

## Product galleries

Keep the existing canvas and mouse simulator mounted when showing a product photo. Hiding their preview lets the existing intersection observers stop rendering; returning to 3D retains the orientation and HUD mode. Reset the gallery selection on every dialog opening and dispose its DOM when changing topic or closing. Only scroll the thumbnail strip during selection; scrolling its ancestors can move the whole dialog. Check the strip at 390px, including wheel, keyboard, previous/next and returning to the model.

Manufacturer galleries can contain outdated CDN links, different generations, different colours and oversized blank borders. Verify each selected image visually and store the actual source URL in the hardware inventory. Preserve image proportions, remove only empty outer padding and avoid enlarging low-resolution originals. A current shop's default configuration does not establish Ethan's purchased configuration; use clearly labelled component details if an exact whole-product photo is unavailable.

## Moving product models

Fit the camera across each independent adjustment, reset each joint before evaluating the next, and keep the resulting frame stable while the model moves. A camera fitted only to a resting model clips raised desks and portrait screens; a repeatedly fitted camera makes them appear to shrink. Geometry sweeps catch non-finite coordinates and cross-adjustment reset errors, but manual side/rear inspection is still needed for hinge and panel clearance.

Use manufacturer diagrams alongside photos before assigning proportions or pivots. The SM7B manual locates the fixed XLR bracket and gives the windscreen diameter; Mackie’s rear drawing shows four vertical TRS pairs, not a single row. Current FlexiSpot listings can describe a newer frame than the purchased 2025 model. Hbada’s 2026 page contains contradictory seat-lift figures, so preserve that uncertainty in the model notes rather than inventing precision.

Keep explicit Pause separate from the six-second inspection pause. A visitor choosing a gallery image or hiding the browser page should stop animation work; returning should retain the selected adjustment and orientation. Do not rebuild geometry inside the animation loop.

## Mobile room gestures

Distance-only pinch changes magnification but loses the photo point between the fingers. Anchor that point in room coordinates at the start, then combine the new separation and moving midpoint; share the camera scale calculation with rendering and one-finger dragging. Touches starting on room item labels must join the gesture, while toolbar buttons and links keep their normal input. Suppress release clicks from the whole multi-touch gesture until a new press, and preserve keyboard clicks. Rebase a remaining finger from the current view, not the camera matrix from the preceding render frame; cancel when resizing invalidates screen coordinates.

Run `node --test tests/*.test.mjs` alongside the website checks. These tests exercise actual gesture handlers using synthetic two-pointer sequences; they do not prove physical Safari or Android touch behaviour. A narrow screenshot and a mouse drag cannot substitute for a real pinch when the browser tool does not support multitouch.

Use the compact navigation layout for short landscape viewports as well as narrow ones; width alone treated an 844 × 390 phone like a desktop and placed the vertical Software rail over the bottom dock. Keep the room label bounds consistent with the CSS breakpoint and verify the resulting screenshot.

## Async product loading

Closing a slow MacBook load and opening Dell reproduced stale movement controls: the older factory completed and modified the reused canvas and controls before its caller could discard it. Abort pending work on close or product change, load the wallpaper before creating the renderer, and check cancellation before touching shared controls. Keep network loading bounded with a visible retry action, including an import that has not settled. Rejected mouse downloads must leave the cache so reopening can retry; create the model before installing viewer observers.

Disposing a renderer leaves its last pixels on the reused canvas. Hide that canvas without removing its layout until the new viewer is ready, so a MacBook loading screen cannot show the previous Dell model; check this transition with a delayed wallpaper request.

Gallery thumbnails belong to the currently opened product and should load eagerly; creating lazy thumbnails while a modal is still hidden produced blank tiles until later interaction. Keep loading and retry state separate for the main photograph and the model. Mouse wheel zoom is opt-in in the canonical hero viewer so the standalone Agentic Mouse walkthrough still scrolls normally.

## Dialog navigation

Keep the floating previous/next controls outside the dialog's scrolling body, inside the same modal top layer. Centring them on that shell keeps their vertical position stable across short software cards, tall hardware content and full-height screen embeds. Mobile controls must remain inside the viewport, including at 320px and in landscape; keep the close control outside the scroller too.

Build one route from the photographed item positions, with related demos and the Dock apps inserted together. Computing an independent nearest destination on every click can bounce between two items and makes Previous fail to undo Next. Switching topics reuses the existing open/cleanup path and preserves the initial room camera and return focus; cancel held review buttons and active dictation on topic changes as well as close. Verify a full loop, reverse navigation, model/gallery transitions, repeated keyboard activation and backdrop dismissal.
