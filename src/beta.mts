// Interactive room, demos and setup directory. — GPT-6
import * as THREE from "three";
import { requiredElement } from "./dom.mjs";
import type { AppEntry, GearItem, ProjectEntry } from "./site-data.mjs";
import type { MouseHand, MouseMap } from "./simulator.mjs";
import type { createProductViewer } from "./product-models.mjs";
import { MouseSimulator } from "./simulator.mjs";
import { createNativeHUD } from "./native-hud.mjs";
import { createHeroMouse } from "./hero-mice.mjs";
import { createProductGallery } from "./product-gallery.mjs";
import { createFrameView } from "./frame-view.mjs";
import { projectLink } from "./project-links.mjs";

const stage = requiredElement("#room-stage");
const canvas = requiredElement<HTMLCanvasElement>("#room-canvas");
const roomStatus = requiredElement("#room-status");
const detail = requiredElement<HTMLDialogElement>("#room-detail");
const screenView = createFrameView(requiredElement("#screen-detail"), "desktop-frame");
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const gear: GearItem[] = await fetch(new URL("./gear.json?v=__SITE_VERSION__", import.meta.url)).then(response => { if (!response.ok) throw new Error("Hardware data did not load"); return response.json(); });
const apps: AppEntry[] = await fetch(new URL("./apps.json?v=__SITE_VERSION__", import.meta.url)).then(response => { if (!response.ok) throw new Error("App data did not load"); return response.json(); });
const projectWebsites: Readonly<Record<string, string>> = await fetch(new URL("./project-websites.json?v=__SITE_VERSION__", import.meta.url)).then(response => { if (!response.ok) throw new Error("Project websites did not load"); return response.json(); });
// The desktop inventory is synced from response-preferences. Keep its stable
// internal app ID, but show this site's current Agent Flow brand and destination
// until that canonical inventory is published with the renamed project.
const voiceApp = apps.find(app => app.id === "voiceinkplusplus");
if (voiceApp) Object.assign(voiceApp, {
  name: "Agent Flow",
  url: "https://ethansk.github.io/AgentFlow/",
  icon: new URL("./assets/agentflow-icon.png", import.meta.url).href,
  note: "Ethan’s VoiceInk fork for live agent context.",
});
function linkedApp(id: string) {
  const app = apps.find(entry => entry.id === id);
  if (!app?.url) throw new Error(`Missing public app link: ${id}`);
  return { ...app, url: app.url };
}
const menuBarDock = linkedApp("menu-bar-dock");
const menuBarDockLink = requiredElement<HTMLAnchorElement>("#menu-bar-dock-link");
menuBarDockLink.href = menuBarDock.url; menuBarDockLink.setAttribute("aria-label", menuBarDock.name);
const menuBarDockIcon = document.createElement("img");
menuBarDockIcon.src = new URL(menuBarDock.icon, "https://ethansk.github.io/response-preferences/").href;
menuBarDockIcon.width = 28; menuBarDockIcon.height = 28; menuBarDockIcon.alt = "";
const menuBarDockName = document.createElement("span"); menuBarDockName.textContent = menuBarDock.name;
menuBarDockLink.append(menuBarDockIcon, menuBarDockName); menuBarDockLink.hidden = false; // Keep the prominent link tied to the same canonical app metadata as Everything I use.
const gearById = new Map(gear.map(item => [item.id, item]));
const hotspotContainer = requiredElement(".room-hotspots");
for (const item of gear) {
  const button = document.createElement("button");
  button.type = "button"; button.dataset.topic = item.id; button.dataset.x = String(item.x); button.dataset.y = String(item.y);
  button.setAttribute("aria-label", item.name);
  const dot = document.createElement("span"); dot.className = "hotspot-dot"; dot.setAttribute("aria-hidden", "true");
  const label = document.createElement("span"); label.className = "hotspot-label"; label.textContent = item.label;
  button.append(dot, label); hotspotContainer.append(button);
}
const hotspots = [...hotspotContainer.querySelectorAll<HTMLButtonElement>("button")]; // Ethan rejected the full app-dock overlay: keep apps in the Software rail and directory, not a second grid over the photo (task 01a07944-b48e-7e43-8c2f-34b9cfe3df70).
const hotspotWidths = new Map<HTMLElement, number>();
const view = { zoom: 0, panX: 0, panY: 0 };
const target = { zoom: 0, panX: 0, panY: 0 };
let renderer: THREE.WebGLRenderer | null = null;
let camera: THREE.PerspectiveCamera;
let scene: THREE.Scene;
let photo: THREE.Mesh | undefined;
let frame = 0, width = 0, height = 0, lastFrame = 0;
let focusPoint = { x: 0, y: 0 };
const roomWidth = 20, roomHeight = 20 * 992 / 1586;
const point = new THREE.Vector3();

/** Share the visible photo scale between drawing and gestures, including a finger lift before the next frame. */
function roomProjection(zoomLevel = view.zoom) {
  const aspect = width / height;
  const visibleHeight = Math.min(roomHeight, roomWidth / aspect) * (1 - zoomLevel * .56); // Fill the viewport without stretching; Ethan preferred cropping and panning over the less immersive height fit, so do not restore side margins (task 01a07944-b48e-7e43-8c2f-34b9cfe3df70).
  const limitX = Math.max(0, (roomWidth - visibleHeight * aspect) / 2);
  const limitY = Math.max(0, (roomHeight - visibleHeight) / 2);
  return {
    x: THREE.MathUtils.clamp(view.panX + focusPoint.x * zoomLevel, -limitX, limitX),
    y: THREE.MathUtils.clamp(view.panY + focusPoint.y * zoomLevel, -limitY, limitY),
    depth: visibleHeight / (2 * Math.tan(THREE.MathUtils.degToRad(22.5))),
    scale: visibleHeight / height, limitX, limitY,
  };
}

/** Render the camera only while it is moving; the photograph keeps its original proportions. */
function draw(now = 0) {
  frame = 0;
  if (!renderer || !width || !height || document.hidden) return;
  const elapsed = Math.min(now - lastFrame, 50);
  lastFrame = now;
  const ease = reduced.matches ? 1 : 1 - Math.exp(-elapsed / 65);
  let moving = false;
  for (const key of ["zoom", "panX", "panY"] as const) {
    view[key] += (target[key] - view[key]) * ease;
    if (Math.abs(target[key] - view[key]) > .003) moving = true;
    else view[key] = target[key];
  }
  const projection = roomProjection();
  camera.position.set(projection.x, projection.y, projection.depth);
  camera.lookAt(projection.x, projection.y, 0);
  camera.updateMatrixWorld();
  renderer.render(scene, camera);
  const compact = width <= 760 || height <= 520; // Match the compact CSS layout on short landscape phones so labels clear the horizontal software bar.
  const left = compact ? 20 : 86, right = width - 28, top = compact ? 118 : 90, bottom = height - 126;
  const projected = hotspots.map(button => {
    point.set((Number(button.dataset.x) - .5) * roomWidth, (.5 - Number(button.dataset.y)) * roomHeight, .02).project(camera);
    const rawX = (point.x + 1) * width / 2, rawY = (1 - point.y) * height / 2;
    const outside = rawX < left || rawX > right || rawY < top || rawY > bottom;
    let x = rawX, y = rawY, edge;
    if (outside) {
      const cx = (left + right) / 2, cy = (top + bottom) / 2;
      const dx = rawX - cx, dy = rawY - cy;
      const tx = dx ? (dx > 0 ? right - cx : left - cx) / dx : Infinity;
      const ty = dy ? (dy > 0 ? bottom - cy : top - cy) / dy : Infinity;
      const scale = Math.min(tx, ty);
      x = cx + dx * scale; y = cy + dy * scale;
      edge = tx < ty ? (dx < 0 ? "left" : "right") : (dy < 0 ? "top" : "bottom");
    }
    return {button, rawX, rawY, x, y, edge, outside};
  });
  for (const edge of ["left", "right", "top", "bottom"]) {
    const vertical = edge === "left" || edge === "right", axis = vertical ? "y" : "x";
    const items = projected.filter(item => item.edge === edge).sort((a,b) => a[axis] - b[axis]);
    const min = (vertical ? top : left) + 18, max = (vertical ? bottom : right) - 18;
    const gap = Math.min(vertical ? 38 : 118, (max - min) / Math.max(1, items.length - 1));
    for (let i = 0; i < items.length; i++) items[i][axis] = Math.max(min + i * gap, Math.min(max - (items.length - 1 - i) * gap, items[i][axis])); // Reserve space for every arrow before clamping so several items cannot pile up at a corner.
    for (let i = 1; i < items.length; i++) items[i][axis] = Math.max(items[i][axis], items[i-1][axis] + gap);
  }
  const labelRects: { left: number; right: number; top: number; bottom: number }[] = [];
  for (const {button,rawX,rawY,x,y,outside} of projected.sort((a,b) => Number(a.outside) - Number(b.outside))) { // Give objects in the area being explored label space before distant edge arrows.
    button.classList.toggle("offscreen", outside);
    button.style.setProperty("--arrow-angle", `${Math.atan2(rawY - y, rawX - x) + Math.PI / 2}rad`);
    const labelWidth = hotspotWidths.get(button) || 120;
    const labelLeft = x + labelWidth + 25 > width - 18;
    button.classList.toggle("label-left", labelLeft);
    const box = {left: labelLeft ? x - labelWidth - 16 : x + 18, right: labelLeft ? x - 18 : x + labelWidth + 16, top:y-15, bottom:y+15};
    const collides = labelRects.some(other => box.left < other.right + 10 && box.right > other.left - 10 && box.top < other.bottom + 8 && box.bottom > other.top - 8);
    button.classList.toggle("compact", collides);
    if (!collides) labelRects.push(box);
    button.style.left = `${x}px`; button.style.top = `${y}px`;
    button.hidden = false;
  }
  if (moving) frame = requestAnimationFrame(draw);
}
function render() { if (!frame && !document.hidden) { lastFrame = performance.now(); frame = requestAnimationFrame(draw); } }
function zoom(value: number) {
  target.zoom = Math.max(0, Math.min(1.35, value));
  canvas.classList.toggle("at-zoom-limit", target.zoom === 1.35);
  if (target.zoom < .15) { target.panX = width < 760 ? 3.4 : 0; target.panY = -Math.max(0, (roomHeight - roomWidth * stage.clientHeight / stage.clientWidth) / 2); } // Start at the photo bottom when returning to the opening view, as Ethan requested.
  stage.classList.toggle("room-entered", target.zoom > .15);
  requiredElement('[data-view="desk"]').setAttribute("aria-pressed", String(target.zoom > .15));
  if (!renderer) {
    requiredElement(".room-poster").style.transform = `scale(${1 + target.zoom * .8})`;
    hotspots.forEach(button => { button.style.left = `${Number(button.dataset.x) * 100}%`; button.style.top = `${Number(button.dataset.y) * 100}%`; });
  }
  render();
}
/** Move a little closer while keeping the clicked point under the pointer. */
function zoomAt(clientX: number, clientY: number) {
  const nextZoom = Math.min(1.35, target.zoom + .35);
  if (renderer && width && height) { // A first click can arrive before the photo loads; anchoring needs the measured viewport to avoid invalid camera coordinates.
    const bounds = stage.getBoundingClientRect();
    const scale = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(22.5)) / height;
    const approach = 1 - (1 - nextZoom * .56) / (1 - view.zoom * .56); // Move the camera by the portion of the clicked point's offset lost to zoom, so it stays anchored instead of jumping to the centre.
    target.panX = camera.position.x + (clientX - bounds.left - width / 2) * scale * approach - focusPoint.x * nextZoom;
    target.panY = camera.position.y - (clientY - bounds.top - height / 2) * scale * approach - focusPoint.y * nextZoom;
  }
  zoom(nextZoom);
}
async function createRoom() {
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: "low-power" });
    renderer.setPixelRatio(1); // The room is a single photograph; supersampling it adds GPU work without adding image detail.
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, 1, .1, 100);
    const texture = await new THREE.TextureLoader().loadAsync(new URL("./assets/room.svg?v=__SITE_VERSION__", import.meta.url).href);
    texture.colorSpace = THREE.SRGBColorSpace;
    photo = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, roomHeight), new THREE.MeshBasicMaterial({ map: texture }));
    scene.add(photo); // A restrained camera over the original photo gives depth without distorting Ethan's face or inventing unseen parts of the room.
    new ResizeObserver(() => {
      cancelRoomGesture(); // Rotation or a resized viewport invalidates the active fingers' screen coordinates.
      width = stage.clientWidth; height = stage.clientHeight;
      if (target.zoom === 0) { target.panX = width < 760 ? 3.4 : 0; target.panY = -Math.max(0, (roomHeight - roomWidth * height / width) / 2); } // Start on Ethan in portrait and align the photo bottom in the wide-screen crop.
      hotspots.forEach(button => hotspotWidths.set(button, requiredElement(".hotspot-label", button).offsetWidth)); // Measure labels once per resize, not between style writes on every animation frame.
      camera.aspect = width / height; camera.updateProjectionMatrix();
      renderer?.setSize(width, height, false); render();
    }).observe(stage);
    stage.classList.add("room-ready");
    roomStatus.textContent = "Drag to look around";
  } catch (error) {
    if (renderer) { renderer.dispose(); renderer = null; }
    canvas.hidden = true;
    roomStatus.textContent = "Photo view · use the buttons to explore";
    console.warn("The room uses its photograph when WebGL is unavailable.", error);
  }
}
void createRoom();
canvas.addEventListener("webglcontextlost", event => {
  event.preventDefault(); cancelAnimationFrame(frame); frame = 0;
  stage.classList.remove("room-ready");
});
canvas.addEventListener("webglcontextrestored", () => { stage.classList.add("room-ready"); render(); });
document.addEventListener("visibilitychange", () => { cancelAnimationFrame(frame); frame = 0; if (!document.hidden) render(); });
reduced.addEventListener("change", render);
stage.addEventListener("wheel", event => {
  if ((event.target instanceof Element && event.target.closest(".room-dock")) || detail.open || directory.open) return;
  event.preventDefault();
  cancelRoomGesture();
  const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1);
  zoom(target.zoom + (event.ctrlKey ? -1 : 1) * Math.max(-.18, Math.min(.18, delta * .001))); // Scrolling down moves into the room; Chrome's Ctrl+wheel trackpad pinches keep their usual direction.
}, { passive: false });
interface Point { x: number; y: number }
const roomPointers = new Map<number, Point>();
let drag: (Point & { panX: number; panY: number; scale: number; limitX: number; limitY: number }) | null;
let pinch: { distance: number; zoom: number; anchor: Point | null } | null;
let dragged = false;
/** Start from the visible camera position so a gesture interrupts any unfinished approach. */
function startRoomGesture() {
  Object.assign(target, view);
  const [first, second] = roomPointers.values();
  drag = null; pinch = null;
  if (first && second) {
    const bounds = stage.getBoundingClientRect();
    const projection = camera && width && height ? roomProjection() : null;
    pinch = {
      distance: Math.hypot(second.x - first.x, second.y - first.y), zoom: view.zoom,
      anchor: projection && {
        x: projection.x + ((first.x + second.x) / 2 - bounds.left - width / 2) * projection.scale,
        y: projection.y - ((first.y + second.y) / 2 - bounds.top - height / 2) * projection.scale,
      },
    };
    dragged = true; // Two-finger contact is a pinch gesture even without movement; neither release should activate a label or zoom again.
  } else if (first && camera && width && height) {
    const projection = roomProjection(); // Rebase from the latest gesture state, not a camera matrix that may still be awaiting its render frame.
    drag = { x: first.x, y: first.y, panX: projection.x, panY: projection.y,
      scale: projection.scale, limitX: projection.limitX, limitY: projection.limitY };
  }
}
stage.addEventListener("pointerdown", event => {
  if (event.button !== 0 || detail.open || directory.open) return;
  if (!roomPointers.size) dragged = false;
  if (!(event.target instanceof Element)) return;
  const hotspot = event.target.closest(".room-hotspots button");
  if (!hotspot && event.target.closest("button:not(#enter-room), a")) return; // Room labels share drag/pinch input for mouse, pen and touch; toolbar buttons and links keep their own input.
  roomPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  startRoomGesture();
});
stage.addEventListener("pointermove", event => {
  if (!roomPointers.has(event.pointerId)) return; // Hover movement must never keep moving the camera after release. (Codex task: 01a07944-b48e-7e43-8c2f-34b9cfe3df70)
  if (event.pointerType === "mouse" && !(event.buttons & 1)) { cancelRoomGesture(); return; } // A release outside the browser can be missed; the next button-free move must end the drag.
  roomPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pinch) {
    const [first, second] = roomPointers.values();
    if (!first || !second) return;
    const distance = Math.hypot(second.x - first.x, second.y - first.y);
    if (!pinch.distance || !distance) return;
    zoom((1 - (1 - pinch.zoom * .56) * pinch.distance / distance) / .56); // Spreading two fingers reduces camera distance in proportion to their separation.
    if (pinch.anchor && width && height) {
      const bounds = stage.getBoundingClientRect();
      const projection = roomProjection(target.zoom);
      target.panX = THREE.MathUtils.clamp(pinch.anchor.x - ((first.x + second.x) / 2 - bounds.left - width / 2) * projection.scale, -projection.limitX, projection.limitX) - focusPoint.x * target.zoom;
      target.panY = THREE.MathUtils.clamp(pinch.anchor.y + ((first.y + second.y) / 2 - bounds.top - height / 2) * projection.scale, -projection.limitY, projection.limitY) - focusPoint.y * target.zoom;
    } // Keep the same photographed point under the two-finger midpoint while it moves and changes scale.
    Object.assign(view, target);
    dragged = true;
  } else if (drag) {
    if (!dragged && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 4) return;
    target.panX = THREE.MathUtils.clamp(drag.panX - (event.clientX - drag.x) * drag.scale, -drag.limitX, drag.limitX);
    target.panY = THREE.MathUtils.clamp(drag.panY + (event.clientY - drag.y) * drag.scale, -drag.limitY, drag.limitY);
    view.panX = target.panX; view.panY = target.panY; // Dragging tracks the hand directly; easing here made the scene feel detached and laggy.
    dragged = true;
  }
  if (dragged) {
    for (const id of roomPointers.keys()) if (!stage.hasPointerCapture(id)) stage.setPointerCapture(id); // Delay capture until movement so a plain tap on the entry prompt still works.
    canvas.classList.add("is-dragging");
    render();
  }
});
/** Release a pointer and rebase the remaining finger without a camera jump. */
function endRoomPointer(event: PointerEvent) {
  if (!roomPointers.delete(event.pointerId)) return;
  if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
  startRoomGesture();
  if (!roomPointers.size) canvas.classList.remove("is-dragging");
}
/** Cancel a gesture when focus or page visibility changes before its release arrives. */
function cancelRoomGesture() {
  const ids = [...roomPointers.keys()];
  roomPointers.clear(); drag = null; pinch = null;
  canvas.classList.remove("is-dragging");
  for (const id of ids) if (stage.hasPointerCapture(id)) stage.releasePointerCapture(id);
}
for (const type of ["pointerup", "pointercancel"] as const) stage.addEventListener(type, endRoomPointer);
stage.addEventListener("lostpointercapture", event => { if (event.target === stage) endRoomPointer(event); }); // Moving implicit touch capture from the canvas to the stage emits a bubbling loss on the canvas; that transfer must not cancel the active pinch.
window.addEventListener("blur", cancelRoomGesture);
document.addEventListener("visibilitychange", () => { if (document.hidden) cancelRoomGesture(); });
stage.addEventListener("click", event => {
  if (dragged && event.detail !== 0) { event.preventDefault(); event.stopPropagation(); return; } // Suppress every release click until a new press, while preserving keyboard activation (detail 0).
  if ((event.target instanceof Element && event.target.closest("button, a")) || detail.open || directory.open) return;
  zoomAt(event.clientX, event.clientY);
}, true);
canvas.addEventListener("keydown", event => {
  if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "Enter"].includes(event.key)) return;
  event.preventDefault();
  if (event.key === "ArrowUp" || event.key === "Enter") zoom(target.zoom + .2);
  if (event.key === "ArrowDown") zoom(target.zoom - .2);
  if (event.key === "Home") zoom(0);
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") { const { limitX } = roomProjection(); target.panX = THREE.MathUtils.clamp(target.panX + (event.key === "ArrowLeft" ? -.3 : .3), -limitX, limitX); render(); } // Use the same bounds as dragging so keyboard panning does not snap a dragged camera back to an unrelated fixed limit.
});
requiredElement("#enter-room").addEventListener("click", () => { target.panX = 0; target.panY = 0; zoom(.85); requiredElement('[data-view="desk"]').focus({ preventScroll: true }); });
requiredElement("#zoom-in").addEventListener("click", () => zoom(target.zoom + .2));
requiredElement("#zoom-out").addEventListener("click", () => zoom(target.zoom - .2));
document.querySelectorAll<HTMLElement>("[data-view]").forEach(button => button.addEventListener("click", () => {
  focusPoint = { x: 0, y: 0 }; target.panX = 0; target.panY = 0; zoom(button.dataset.view === "room" ? 0 : .85);
  if (button.dataset.view === "room") requiredElement("#enter-room").focus({ preventScroll: true });
}));

const topics: Record<string, [string, string, string] | undefined> = {
  corsair: ["Right hand · Agentic Mouse", "Corsair Scimitar", "Twelve thumb controls for working with agents, with the top button for Agent Flow dictation."],
  razer: ["Left hand · Agentic Mouse", "Razer Naga", "The same controls mirrored for my left hand, so I can switch whenever I want."],
  codex: ["", "Codex", ""],
  vscode: ["Vibedio development", "My VS Code setup", "Every agent task gets its own worktree and dev stack; I review them all in one VS Code window."],
  obs: ["", "OBS", ""],
  wand: ["My current prototype", "Magic Wand", ""],
  sausages: ["", "Tesco Finest sausages", "(This is a joke, I only eat M&S, Waitrose, or Deliveroo sausages.)"],
  code: ["Great for Agentic Engineers", "Review code without moving your hand", "Quick press to jump to a change, or hold and release to stage the current file and jump in that direction."],
  voice: ["Agent Flow", "YouTube pauses when I start talking", "I use a top mouse button to dictate instead of typing, and my video resumes when I finish if my setup paused it."],
  desk: ["My desk setup", "Both mice stay on the desk", "High sensitivity keeps movement small, and I sometimes use both mice to click through code review faster."],
  chair: ["My desk setup", "Lean back without reaching for a keyboard", "I use thumb controls and dictation with the footrest out, switching hands whenever I want."],
};
const obsApp = linkedApp("obs");
const statsApp = linkedApp("stats-widget-from-website");
const relatedTools: Record<string, { name: string; url: string; icon?: string }> = {
  mouse: { name: "Agentic Mouse", url: "https://ethansk.github.io/agentic-mouse/", icon: "./agentic-mouse-mark.svg?v=__SITE_VERSION__" },
  voice: { name: "Agent Flow", url: "https://ethansk.github.io/AgentFlow/", icon: "./assets/agentflow-icon.png?v=__SITE_VERSION__" },
  code: { name: "Better Git VS Code", url: "https://marketplace.visualstudio.com/items?itemName=EthanSK.better-git-vscode", icon: "./assets/apps/vsCode.png" },
  replies: { name: "Response Preferences", url: "https://ethansk.github.io/response-preferences/", icon: "./assets/apps/codex.png" },
  skill: { name: "AIMVS dev skill", url: "https://github.com/EthanSK/aimvs-dev-skill", icon: "./assets/apps/codex.png" }, // The public mirror of the Codex skill; the private AIMVS app repository is never linked.
  obs: { name: "OBS++", url: obsApp.url, icon: new URL(obsApp.icon, "https://ethansk.github.io/response-preferences/").href },
  stats: { name: "Stats Widget", url: statsApp.url, icon: new URL(statsApp.icon, "https://ethansk.github.io/response-preferences/").href },
  menuBarDock: { name: menuBarDock.name, url: menuBarDock.url, icon: menuBarDockIcon.src },
  restream: { name: "Restream Channel Switcher", url: "https://github.com/EthanSK/restream-channel-switcher" },
  aitum: { name: "Aitum++", url: "https://github.com/EthanSK/obs-aitum-stream-suite" },
};
const topicTools: Record<string, string[] | undefined> = {
  corsair: ["mouse", "voice", "code"], razer: ["mouse", "voice", "code"],
  shure: ["voice", "obs"], scarlett: ["obs"], canon: ["obs"],
  macbook: ["stats", "replies", "menuBarDock"], dell: ["code", "replies", "stats", "menuBarDock"], samsung: ["obs", "aitum"],
  code: ["code", "mouse"], voice: ["voice", "mouse"], codex: ["replies", "stats", "menuBarDock"], vscode: ["skill", "code"], obs: ["obs", "aitum", "restream"],
}; // Link the tools documented for each item; keep hardware product links and separate room hotspots intact.
/** Follow nearby photo anchors once around the desk, keeping related demos beside their hardware. */
function buildDialogRoute() {
  const remaining = [...hotspots];
  const ordered: string[] = [];
  let current: HTMLButtonElement | null = remaining.reduce((left, button) => Number(button.dataset.x) < Number(left.dataset.x) ? button : left);
  while (current) {
    const anchor: HTMLButtonElement = current;
    remaining.splice(remaining.indexOf(anchor), 1);
    const topic = anchor.dataset.topic ?? "";
    ordered.push(topic);
    if (topic === "dell") ordered.push("code");
    if (topic === "shure") ordered.push("voice");
    const distance = (button: HTMLButtonElement): number => Math.hypot((Number(button.dataset.x) - Number(anchor.dataset.x)) * roomWidth, (Number(button.dataset.y) - Number(anchor.dataset.y)) * roomHeight); // Use photo proportions, not current zoom; a fixed route makes Previous undo Next instead of bouncing between two nearest items.
    current = remaining.reduce<HTMLButtonElement | null>((nearest, button) => !nearest || distance(button) < distance(nearest) ? button : nearest, null);
  }
  return ordered;
}
const dialogRoute = buildDialogRoute();
const dialogNavigation = [...detail.querySelectorAll<HTMLButtonElement>(".detail-nav")];
/** Update both destinations from one route, including wraparound at the ends. */
function updateDialogNavigation() {
  const index = dialogRoute.indexOf(detail.dataset.topic ?? "");
  for (const button of dialogNavigation) {
    const topic = dialogRoute[(index + Number(button.dataset.step) + dialogRoute.length) % dialogRoute.length];
    const name = topics[topic]?.[1] || gearById.get(topic)?.name || topic;
    button.dataset.destination = topic;
    button.title = `${Number(button.dataset.step) < 0 ? "Previous" : "Next"}: ${name}`;
    button.setAttribute("aria-label", button.title);
  }
}
let returnFocus: HTMLElement | undefined;
let returnView: typeof target | undefined;
let productViewer: Awaited<ReturnType<typeof createProductViewer>> | null = null;
let productRequest = 0;
let productLoad: AbortController | undefined;
let disposeGallery: (() => void) | null = null;
function openTopic(topic: string | undefined, trigger?: HTMLElement) {
  if (!topic) return;
  const item = gearById.get(topic);
  const copy = topics[topic] || (item && ["My setup", item.name, item.description]);
  if (!copy) return;
  const anchor = hotspots.find(button => button.dataset.topic === (topic === "code" ? "dell" : topic === "voice" ? "shure" : topic));
  if (!anchor) return;
  cancelRoomGesture();
  stopDetailInteraction();
  disposeGallery?.(); disposeGallery = null;
  productLoad?.abort();
  productViewer?.dispose(); productViewer = null; productRequest++;
  screenView.clear();
  if (!detail.open) { returnFocus = trigger; returnView = { ...target }; }
  const zoomLevel = 1.2;
  target.zoom = zoomLevel;
  target.panX = (Number(anchor.dataset.x) - .5) * roomWidth - focusPoint.x * zoomLevel;
  target.panY = (.5 - Number(anchor.dataset.y)) * roomHeight - focusPoint.y * zoomLevel;
  stage.classList.add("room-focused");
  detail.dataset.topic = topic;
  render();
  requiredElement("#detail-kicker").textContent = (topic === "desk" || topic === "chair") && item ? item.name : copy[0];
  requiredElement("#detail-title").textContent = copy[1];
  const description = requiredElement("#detail-description");
  description.textContent = copy[2];
  description.hidden = !copy[2];
  const mouse = topic === "razer" || topic === "corsair";
  const panel = mouse ? "mouse" : ["code", "voice", "vscode", "sausages", "wand"].includes(topic) ? topic : (topic === "codex" || topic === "obs") ? "screen" : "hardware"; // Hardware opens its product; separate nearby Codex, VS Code and OBS hotspots own the software views, never combined monitor/software labels (task 01a07944-b48e-7e43-8c2f-34b9cfe3df70).
  for (const name of ["mouse", "code", "voice", "vscode", "hardware", "screen", "sausages", "wand"]) requiredElement(`#${name}-detail`).hidden = name !== panel;
  const toolLinks = requiredElement("#detail-tools");
  toolLinks.replaceChildren();
  for (const id of topicTools[topic] || []) {
    const tool = relatedTools[id];
    const link = document.createElement("a"); link.href = projectLink(tool.url, projectWebsites); link.target = "_blank"; link.rel = "noopener noreferrer";
    if (tool.icon) {
      const icon = document.createElement("img"); icon.src = tool.icon; icon.alt = ""; icon.width = 26; icon.height = 26;
      link.append(icon);
    }
    const name = document.createElement("span"); name.textContent = `${tool.name} ↗`;
    link.append(name); toolLinks.append(link);
  }
  toolLinks.hidden = !toolLinks.childElementCount;
  const productLink = requiredElement<HTMLAnchorElement>("#product-link");
  if (topic === "scarlett") requiredElement(".product-info").prepend(description); // Keep Ethan's Scarlett explanation beside its image without duplicating it in the heading.
  else requiredElement(".detail-heading").insertBefore(description, toolLinks);
  productLink.hidden = !item;
  if (item) productLink.href = item.url;
  if (mouse) {
    if (simulator) { simulator.chooseHand(topic); updateMouse(); }
    document.querySelectorAll<HTMLElement>(".beta-mice figure").forEach(figure => { figure.hidden = figure.dataset.mouse !== topic; });
    loadMouse(topic);
  }
  if (topic === "code") updateReview();
  if (topic === "voice") updateVoice();
  if (topic === "vscode") showSlide(0); // Start the walkthrough from its first slide on every opening, like the product galleries.
  if (panel === "hardware") showHardware(topic);
  if (panel === "screen") showScreen(topic);
  if (item) disposeGallery = createProductGallery(requiredElement(mouse ? ".mouse-media" : ".product-media"), requiredElement(mouse ? ".beta-mice" : ".product-stage"), item);
  if (!detail.open) detail.showModal();
  requiredElement(".detail-body", detail).scrollTop = 0;
  updateDialogNavigation();
  (trigger?.classList.contains("detail-nav") ? trigger : requiredElement(".detail-close")).focus({ preventScroll: true }); // Keep repeated arrow clicks and keyboard activation on the same control while content changes.
}
document.querySelectorAll<HTMLElement>("[data-topic]").forEach(button => button.addEventListener("click", () => openTopic(button.dataset.topic, button)));
document.querySelectorAll<HTMLElement>("[data-voice]").forEach(button => button.addEventListener("click", () => openTopic("voice", button)));
for (const button of dialogNavigation) button.addEventListener("click", () => openTopic(button.dataset.destination, button));
requiredElement(".detail-close").addEventListener("click", () => detail.close());
detail.addEventListener("close", () => {
  disposeGallery?.(); disposeGallery = null;
  productLoad?.abort();
  productViewer?.dispose(); productViewer = null; productRequest++;
  screenView.clear();
  Object.assign(target, returnView); // Closing a feature returns to the exact zoom and pan from which it was opened.
  stage.classList.remove("room-focused");
  render();
  stopDetailInteraction();
  returnFocus?.focus({ preventScroll: true });
});

/** Cancel a held demo control when leaving its topic without clearing the review's staged files. */
function stopDetailInteraction() {
  requiredElement(".video-example").classList.remove("is-playing");
  videoPlaying = videoOwned || videoPlaying; // Leaving dictation cancels it and resumes only the example video it paused.
  recording = false; videoOwned = false;
  reviewPress = null; clearTimeout(reviewTimer); // Escape can close the panel while a review key is still held; that cancelled hold must not stage on release.
  document.querySelectorAll<HTMLButtonElement>("[data-review]").forEach(button => button.classList.remove("is-ready"));
}

let simulator: MouseSimulator;
let updateHUD: (() => void) | undefined;
let pendingKeypad: ReturnType<typeof setTimeout> | undefined;
const loadedMice = new Set<MouseHand>();
const mapRequest = fetch(new URL("./simulator-data.json?v=__SITE_VERSION__", import.meta.url)).then(response => {
  if (!response.ok) throw new Error(`Mouse map could not load (${response.status})`);
  return response.json();
}).then((map: MouseMap) => {
  simulator = new MouseSimulator(map);
  for (const app of map.apps) {
    const option = document.createElement("option"); option.value = app.id; option.textContent = app.title; requiredElement<HTMLSelectElement>("#beta-app").append(option);
  }
  requiredElement<HTMLSelectElement>("#beta-app").value = simulator.app;
  updateHUD = createNativeHUD(requiredElement("#beta-hud"), simulator, {
    activate: cell => { simulator.press(cell); updateMouse(); },
    preview: cell => { simulator.state.selected = cell; requiredElement("#beta-feedback").textContent = simulator.control(cell).title; updateGestures(); },
    bindHold: () => {}, // Hold and wheel buttons provide explicit gestures in the beta, including touch and keyboard input.
    keydown: () => {},
  });
  updateMouse();
  requiredElement("#mouse-detail").inert = false;
  return map;
}).catch(error => { requiredElement("#beta-feedback").textContent = "The mouse map could not load. Reload to try again."; throw error; });
async function loadMouse(hand?: string) {
  if (hand !== "corsair" && hand !== "razer") return;
  if (loadedMice.has(hand)) return;
  loadedMice.add(hand);
  const state = requiredElement(`[data-mouse="${hand}"] .mouse-state`);
  state.hidden = false; requiredElement("span", state).textContent = "Loading 3D view…"; requiredElement("button", state).hidden = true;
  try {
    const map = await mapRequest;
    const ready = await createHeroMouse(requiredElement(`.beta-mice [data-mouse="${hand}"]`), map.sources[hand], (source, cell) => {
      simulator.chooseHand(source); simulator.press(cell); updateMouse();
    }, (_source, cell) => simulator.control(cell).title, true);
    if (!ready) throw new Error("Mouse model failed to load");
    requiredElement(`[data-mouse="${hand}"] .mouse-state`).hidden = true;
  } catch { loadedMice.delete(hand); requiredElement("span", state).textContent = "3D view failed to load."; requiredElement("button", state).hidden = false; }
}
document.querySelectorAll<HTMLButtonElement>("[data-retry-mouse]").forEach(button => button.addEventListener("click", () => loadMouse(button.dataset.retryMouse)));
function updateGestures() {
  const control = simulator.control(simulator.state.selected);
  const hold = requiredElement<HTMLButtonElement>("#beta-hold");
  const held = simulator.state.held === simulator.state.selected;
  hold.disabled = !control.wheel && !control.keypad;
  hold.textContent = held ? "Release selected button" : "Hold selected button";
  hold.setAttribute("aria-pressed", String(held));
  for (const id of ["beta-wheel-up", "beta-wheel-down"]) requiredElement<HTMLButtonElement>(`#${id}`).disabled = simulator.state.held === null;
}
function updateMouse() {
  updateHUD?.(); updateGestures();
  requiredElement("#beta-default").setAttribute("aria-pressed", String(simulator.state.mode === "default"));
  requiredElement("#beta-app-mode").setAttribute("aria-pressed", String(simulator.state.mode === simulator.app));
  requiredElement("#beta-feedback").textContent = simulator.state.output;
  clearTimeout(pendingKeypad);
  if (simulator.state.pending) pendingKeypad = setTimeout(() => { simulator.tick(performance.now()); updateMouse(); }, 850);
}
function selectMouseApp(app: string) {
  const hand = simulator.hand;
  simulator.chooseApp(app);
  // Open the selected preview and refresh either hand already following the app, preserving other modes.
  for (const source of Object.keys(simulator.states)) {
    simulator.chooseHand(source);
    if (source === hand || simulator.state.followsApp) simulator.chooseMode(app, true);
  }
  simulator.chooseHand(hand);
  updateMouse();
}
const mouseAppSelect = requiredElement<HTMLSelectElement>("#beta-app");
mouseAppSelect.addEventListener("change", () => { if (simulator) selectMouseApp(mouseAppSelect.value); });
requiredElement("#beta-default").addEventListener("click", () => { simulator.chooseMode("default"); updateMouse(); });
requiredElement("#beta-app-mode").addEventListener("click", () => { simulator.chooseMode(simulator.app, true); updateMouse(); });
requiredElement<HTMLButtonElement>("#beta-hold").addEventListener("click", () => {
  if (simulator.state.held === simulator.state.selected) simulator.release();
  else simulator.hold(simulator.state.selected);
  updateMouse();
});
requiredElement("#beta-wheel-up").addEventListener("click", () => { simulator.wheel("up"); updateMouse(); });
requiredElement("#beta-wheel-down").addEventListener("click", () => { simulator.wheel("down"); updateMouse(); });
requiredElement("#beta-reset").addEventListener("click", () => { simulator.reset(); updateMouse(); });

const reviewFiles = [
  ["settings.json", '  {\n−   "reviewOnSave": false,\n+   "reviewOnSave": true,\n    "theme": "dark"\n  }'],
  ["review.ts", '  function nextChange() {\n−   openFile(next);\n+   openDiff(next);\n  }'],
  ["README.md", '  ## Review code\n+ Quick press to jump.\n+ Hold and release to stage and jump.'],
];
let reviewIndex = 0;
let reviewTimer: ReturnType<typeof setTimeout> | undefined;
let reviewPress: { button: HTMLButtonElement; at: number } | null = null;
const staged = new Set();
function updateReview() {
  requiredElement("#code-file").textContent = `${reviewFiles[reviewIndex][0]}${staged.has(reviewIndex) ? " · staged" : ""}`;
  requiredElement("#code-lines").textContent = reviewFiles[reviewIndex][1];
  requiredElement("#code-staged").textContent = `${staged.size} staged`;
}
function reviewStep(direction: number, stageFile: boolean) {
  const previous = reviewIndex;
  if (stageFile) staged.add(previous);
  reviewIndex = (reviewIndex + direction + reviewFiles.length) % reviewFiles.length;
  requiredElement("#review-feedback").textContent = `${stageFile ? `Staged ${reviewFiles[previous][0]} and opened` : "Opened"} ${reviewFiles[reviewIndex][0]}.`;
  updateReview();
}
for (const button of document.querySelectorAll<HTMLButtonElement>("[data-review]")) {
  const begin = () => { reviewPress = { button, at: performance.now() }; clearTimeout(reviewTimer); reviewTimer = setTimeout(() => button.classList.add("is-ready"), 300); };
  const end = () => {
    if (reviewPress?.button !== button) return;
    reviewStep(Number(button.dataset.review), performance.now() - reviewPress.at >= 300);
    reviewPress = null; clearTimeout(reviewTimer); button.classList.remove("is-ready");
  };
  button.addEventListener("pointerdown", event => { if (event.button === 0) { begin(); button.setPointerCapture(event.pointerId); } });
  button.addEventListener("pointerup", end);
  button.addEventListener("pointercancel", () => { reviewPress = null; clearTimeout(reviewTimer); button.classList.remove("is-ready"); });
  button.addEventListener("keydown", event => { if ([" ", "Enter"].includes(event.key) && !event.repeat) { event.preventDefault(); begin(); } });
  button.addEventListener("keyup", event => { if ([" ", "Enter"].includes(event.key)) { event.preventDefault(); end(); } });
  button.addEventListener("click", event => { if (event.detail === 0) reviewStep(Number(button.dataset.review), false); }); // Key handlers prevent their default click; assistive activation can still dispatch a click without duration events.
}
requiredElement("#review-reset").addEventListener("click", () => { staged.clear(); reviewIndex = 0; updateReview(); requiredElement("#review-feedback").textContent = "Quick press to jump, or hold for 300 ms and release to stage the file and jump."; });

let videoPlaying = true, recording = false, videoOwned = false;
function updateVoice() {
  requiredElement(".video-example").classList.toggle("is-playing", videoPlaying);
  requiredElement("#video-toggle").textContent = videoPlaying ? "Pause video" : "Play video";
  requiredElement("#video-status").textContent = videoPlaying ? "Playing" : recording && videoOwned ? "Paused for dictation" : "Paused";
  requiredElement(".video-screen > span").textContent = videoPlaying ? "▶" : "Ⅱ";
  requiredElement("#dictate").textContent = recording ? "Finish dictation" : "Start dictation";
  requiredElement("#dictate").setAttribute("aria-pressed", String(recording));
}
requiredElement("#video-toggle").addEventListener("click", () => { videoPlaying = !videoPlaying; updateVoice(); });
requiredElement("#dictate").addEventListener("click", () => {
  recording = !recording;
  if (recording) {
    videoOwned = videoPlaying;
    videoPlaying = false;
    requiredElement("#transcript").textContent = '“Review these changes and explain anything I need to check.”';
  } else {
    videoPlaying = videoOwned || videoPlaying;
    requiredElement("#transcript").textContent = videoOwned ? "Transcript sent to my agent and the video resumes." : "Transcript sent to my agent; the video stays paused because it was already paused.";
    videoOwned = false;
  }
  updateVoice();
});

const slideTabs = [...document.querySelectorAll<HTMLElement>('#vscode-detail [role="tab"]')];
const slidePanels = slideTabs.map(tab => document.getElementById(tab.getAttribute("aria-controls") ?? ""));
const slideSteps = [...document.querySelectorAll<HTMLButtonElement>("[data-slide-step]")];
let slideIndex = 0;
/** Show one walkthrough slide; the tabs, panels and step buttons follow the same index, with no autoplay. */
function showSlide(index: number, focusTab = false) {
  slideIndex = Math.max(0, Math.min(slideTabs.length - 1, index));
  slideTabs.forEach((tab, i) => {
    const active = i === slideIndex;
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1; // Roving focus: arrow keys move between slides, Tab leaves the strip.
    const panel = slidePanels[i];
    if (panel) panel.hidden = !active;
  });
  for (const button of slideSteps) {
    const step = Number(button.dataset.slideStep);
    const destination = slideTabs[slideIndex + step];
    button.disabled = !destination;
    button.textContent = step < 0 ? `← ${destination ? destination.lastElementChild?.textContent : "Previous"}` : `${destination ? destination.lastElementChild?.textContent : "Next"} →`; // Name the destination so these differ from the outer arrows that switch desk items.
  }
  if (focusTab) slideTabs[slideIndex].focus(); // Bring the selected tab back into view after a mobile reader reaches the bottom of a long slide.
}
slideTabs.forEach((tab, i) => {
  tab.addEventListener("click", () => showSlide(i));
  tab.addEventListener("keydown", event => {
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: slideTabs.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    showSlide(next, true);
  });
});
for (const button of slideSteps) button.addEventListener("click", () => showSlide(slideIndex + Number(button.dataset.slideStep), true));

/** Keep clicks inside a dialog intact; a press and release on its backdrop dismiss it. */
function dismissOutside(dialog: HTMLDialogElement) {
  let startedOutside = false;
  const outside = (event: MouseEvent) => { const rect = dialog.getBoundingClientRect(); return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom; };
  dialog.addEventListener("pointerdown", event => { startedOutside = event.target === dialog && outside(event); });
  dialog.addEventListener("click", event => { if (startedOutside && event.target === dialog && outside(event)) dialog.close(); startedOutside = false; });
}
dismissOutside(detail);
/** Open the one on-demand renderer; a dismissed async load must not leave a WebGL context running. */
async function showHardware(id?: string) {
  const item = id ? gearById.get(id) : undefined;
  if (!id || !item) return;
  const request = ++productRequest;
  productLoad?.abort(); productLoad = new AbortController();
  const signal = AbortSignal.any([productLoad.signal, AbortSignal.timeout(20000)]);
  requiredElement("#hardware-detail").hidden = false;
  requiredElement("#screen-detail").hidden = true;
  screenView.clear(); // Stop the embedded desktop while its hardware model is shown.
  const specs = requiredElement("#product-specs"); specs.replaceChildren();
  for (const spec of item.specs) { const li = document.createElement("li"); li.textContent = spec; specs.append(li); }
  const link = requiredElement<HTMLAnchorElement>("#product-link"); link.href = item.url;
  const demo = requiredElement<HTMLButtonElement>("#product-demo");
  demo.hidden = id !== "shure";
  demo.textContent = "Try dictation";
  demo.onclick = () => openTopic("voice", demo);
  requiredElement<HTMLButtonElement>("#product-retry").hidden = true;
  const status = requiredElement("#product-state"); status.hidden = false; status.textContent = "Loading 3D view…";
  const productCanvas = requiredElement<HTMLCanvasElement>("#product-canvas"); productCanvas.hidden = false; productCanvas.style.visibility = "hidden"; // The reused canvas still holds the previous product's pixels while this one downloads.
  const failed = () => { if (request === productRequest) { status.textContent = "3D view failed to load."; productCanvas.hidden = true; requiredElement<HTMLButtonElement>("#product-retry").hidden = false; } };
  signal.addEventListener("abort", failed, { once: true }); // A stalled module import must not leave Loading visible forever.
  try {
    const {createProductViewer} = await import("./product-models.mjs");
    if (request !== productRequest) return;
    signal.throwIfAborted();
    productViewer?.dispose();
    const viewer = await createProductViewer(productCanvas, id, requiredElement("#product-movement"), signal);
    if (request !== productRequest || !detail.open) { viewer.dispose(); return; }
    productViewer = viewer; productCanvas.style.visibility = "visible"; status.hidden = true;
  } catch (error) { if (request === productRequest) { failed(); console.warn("Product view unavailable", id, error); } }
  finally { signal.removeEventListener("abort", failed); }
}
requiredElement<HTMLButtonElement>("#product-retry").addEventListener("click", () => showHardware(detail.dataset.topic));
requiredElement("#product-reset").addEventListener("click", () => productViewer?.reset());
/** Reuse the canonical public desktop so its apps and Codex example stay maintained in one place. */
function showScreen(id: string) {
  productLoad?.abort();
  productViewer?.dispose(); productViewer = null; productRequest++;
  requiredElement("#hardware-detail").hidden = true; requiredElement("#screen-detail").hidden = false;
  screenView.load(
    id === "obs" ? "./obs.html?v=__SITE_VERSION__" : "https://ethansk.github.io/response-preferences/",
    id === "obs" ? "OBS" : "Response Preferences",
    id === "obs" ? "OBS — demo" : "Interactive example of Ethan’s desktop",
  );
}
const directory = requiredElement<HTMLDialogElement>("#setup-directory");
const portfolioContainer = requiredElement("#portfolio-frame");
const portfolioView = createFrameView(portfolioContainer);
const portfolioObserver = new IntersectionObserver(entries => {
  if (!entries.some(entry => entry.isIntersecting)) return;
  portfolioView.load("https://portosaurus.github.io/ethansk/", "Portfolio", "Ethan SK portfolio");
  portfolioObserver.disconnect();
}, { root: directory, rootMargin: "300px" }); // Begin the loading timer only when the portfolio is near view, not while a lazy iframe is waiting offscreen.
portfolioObserver.observe(portfolioContainer);
let directoryTrigger: HTMLElement | undefined;
function openDirectory(trigger: HTMLElement) { directoryTrigger = trigger; directory.showModal(); }
for (const button of document.querySelectorAll<HTMLElement>("#show-directory, [data-directory]")) button.addEventListener("click", () => openDirectory(button));
requiredElement(".directory-close").addEventListener("click", () => directory.close());
directory.addEventListener("close", () => directoryTrigger?.focus({preventScroll:true}));
dismissOutside(directory);
for (const item of gear) {
  const button = document.createElement("button"); button.type = "button";
  const name = document.createElement("strong"); name.textContent = item.name;
  const specs = document.createElement("span"); specs.textContent = item.specs.slice(0, 3).join(" · "); // Keep directory cards short; each product dialog shows the complete specification list.
  button.append(name, specs); button.addEventListener("click", () => { directory.close(); openTopic(item.id, requiredElement("#show-directory")); }); // Hardware entries always open product models; software has separate room hotspots.
  requiredElement(".directory-gear").append(button);
}

const shopping = requiredElement<HTMLDialogElement>("#setup-shopping");
const shoppingTrigger = requiredElement<HTMLButtonElement>("#show-shopping");
const amazonAssociateTag: string | null = null; // Set only to the tracking ID issued by the current UK Associates account; the old account was closed.
for (const item of gear) {
  const purchase = item.purchase; // Ethan's “setup bundle” uses this same hardware inventory, so names, models and quantities cannot drift into a second list.
  const row = document.createElement("article"); row.className = "shopping-item"; row.dataset.product = item.id;
  const image = document.createElement("img"); image.src = item.images[0].src; image.alt = ""; image.width = 76; image.height = 76;
  const info = document.createElement("div");
  const name = document.createElement("h2"); name.textContent = item.name.startsWith(`${purchase.quantity}× `) ? item.name : `${purchase.quantity} × ${item.name}`;
  const specs = document.createElement("p"); specs.className = "shopping-specs"; specs.textContent = item.specs.slice(0, 3).join(" · ");
  const note = document.createElement("p"); note.textContent = purchase.note;
  info.append(name, specs, note);
  const link = document.createElement("a"); link.target = "_blank"; link.rel = "noopener noreferrer";
  if (purchase.url) {
    const url = new URL(purchase.url);
    const affiliate = url.hostname === "www.amazon.co.uk" && amazonAssociateTag !== null;
    if (affiliate) { url.searchParams.set("tag", amazonAssociateTag); link.rel += " sponsored"; }
    link.href = url.href; link.textContent = `${purchase.retailer} ↗${affiliate ? " · Ad" : ""}`;
  } else {
    link.href = item.url; link.textContent = "Product details ↗"; row.classList.add("shopping-unavailable"); // A support page or a different revision must never masquerade as a verified buying link.
  }
  row.append(image, info, link); requiredElement(".shopping-list").append(row);
}
requiredElement("#shopping-disclosure").hidden = amazonAssociateTag === null;
shoppingTrigger.disabled = false;
shoppingTrigger.addEventListener("click", () => { shopping.showModal(); shopping.scrollTop = 0; });
requiredElement(".shopping-close").addEventListener("click", () => shopping.close());
shopping.addEventListener("close", () => shoppingTrigger.focus({preventScroll:true}));
dismissOutside(shopping);
requiredElement("#shopping-software").addEventListener("click", () => {
  shopping.close(); openDirectory(shoppingTrigger); requiredElement("#directory-apps").scrollIntoView({block:"start"});
});

const setupOnlyApps = [
  { id: "hello-chat", name: "Hello Chat", url: "https://github.com/EthanSK/hello-chat", icon: "https://ethansk.github.io/hello-chat/app-icon.png" },
  { id: "the-fleet", name: "The Fleet", url: "https://github.com/EthanSK/the-fleet", icon: "https://raw.githubusercontent.com/EthanSK/the-fleet/main/desktop/Resources/FleetShips.png" },
  { id: "bambu-studio", name: "Bambu Studio", url: "https://github.com/bambulab/BambuStudio", icon: "https://raw.githubusercontent.com/bambulab/BambuStudio/master/resources/images/BambuStudio.png" },
];
const ethanAppIds = new Set([
  "agenticmouse", "voiceinkplusplus", "hello-chat", "the-fleet", "stats-widget-from-website",
  "obs", "restream-chat-plus-plus", "obscene", "menu-bar-dock", "producer-player", "aiwallpaper",
]);
const appUseOrder = new Map([
  "chatgpt", "agenticmouse", "voiceinkplusplus", "hello-chat", "the-fleet", "google-chrome", "visual-studio-code", "stats-widget-from-website", "obs",
  "spotify", "mail", "notion", "restream-chat-plus-plus", "finder", "telegram",
  "activity-monitor", "claude", "terminal", "surfshark", "obscene",
  "karabiner-elements", "docker-desktop", "menu-bar-dock",
  "xcode", "unity-hub", "preview", "icue",
  "focusrite-control", "razer", "karabiner-eventviewer", "rekordbox", "bambu-studio", "producer-player", "aiwallpaper",
  "magnet", "amphetamine", "stay", "ableton-live-12-suite", "adobe-photoshop-2026",
].map((id, index) => [id, index])); // Recent macOS use, with the daily mouse/dictation tools and configured desktop widgets near the top; keep this local order separate from the synced desktop inventory.
const directoryAppIcons: Record<string, string | undefined> = {
  agenticmouse: "./agentic-mouse-mark.svg?v=__SITE_VERSION__",
  "activity-monitor": "./assets/activity-monitor.png?v=__SITE_VERSION__",
};
const directoryAppInventory = new Map([...setupOnlyApps, ...apps.filter((app): app is AppEntry & { url: string } => !!app.url)].map(app => [app.id, app])); // Use synced metadata when it has a public link for the same app ID.
const madeAppsGrid = requiredElement("#apps-i-made");
const otherAppsGrid = requiredElement("#apps-from-others");
const rankedApps = [...directoryAppInventory.values()]
  .filter(app => appUseOrder.has(app.id))
  .sort((a, b) => (appUseOrder.get(a.id) ?? appUseOrder.size) - (appUseOrder.get(b.id) ?? appUseOrder.size));
for (const app of rankedApps) {
  const link = document.createElement("a"); link.href = projectLink(app.url, projectWebsites); link.target = "_blank"; link.rel = "noopener";
  const icon = document.createElement("img");
  const localIcon = directoryAppIcons[app.id];
  icon.src = localIcon ?? new URL(app.icon, "https://ethansk.github.io/response-preferences/").href;
  icon.alt = ""; icon.width = 30; icon.height = 30; icon.loading = "lazy";
  const name = document.createElement("span"); name.textContent = app.name;
  link.append(icon, name);
  const grid = ethanAppIds.has(app.id) ? madeAppsGrid : otherAppsGrid;
  grid.append(link);
}
const skills: [name: string, repo: string | null, description: string][] = [
 ["Response Preferences", "response-preferences", "How I want agents to write replies"],
 ["Development workflow", null, "Plan, build and check work"],
 ["AIMVS dev workflow", "aimvs-dev-skill", "My project workflow as a reference"],
 ["Coding in TypeScript", "coding-in-typescript", "Public consolidation of the TypeScript guidance I use through AIMVS’s project instructions"],
 ["Repository learnings", null, "Keep what agents learn about a repo"],
 ["Browser testing", null, "Test a website in a real browser"],
 ["UI wording", null, "Write UI text in my voice"],
 ["Outstanding Items", "outstanding-items", "Keep track of unfinished work"],
 ["Front-end design", null, "Design the front end"],
 ["Submit ChatGPT Feedback", null, "Report problems from the current task"],
 ["Local Web Debug Mode", "local-web-debug-mode", "Debug a local website with an agent"],
 ["Skill self-reload", "claude-skill-self-reload-plugins-mac", "Reload changed Claude skills on macOS"],
 ["Pre-Commit Codex Review", "pre-commit-codex-review", "Review changes before committing"],
 ["Emoji Consistency", "emoji-consistency", "Use consistent emoji meanings"],
 ["Deepgram dictation", "claude-code-deepgram-stt-skill", "Transcribes Telegram voice notes for Claude Code"],
]; // Rank public and personal skills together by recent use; splitting them forced commonly used personal workflows below older published tools.
function createDirectoryCard(name: string, description: string, url: string | null) {
  const card = url ? Object.assign(document.createElement("a"), {
    href: projectLink(url, projectWebsites),
    target: "_blank",
    rel: "noopener noreferrer",
  }) : document.createElement("article");
  const title = document.createElement("strong"); title.textContent = name;
  const summary = document.createElement("span"); summary.textContent = description;
  card.append(title, summary);
  return card;
}

const skillCards = new Map<string, HTMLElement>();
const skillsGrid = requiredElement(".directory-skills");
for (const [name, repo, description] of skills) {
  const card = createDirectoryCard(name, description, repo && `https://github.com/EthanSK/${repo}`);
  skillsGrid.append(card);
  if (repo) skillCards.set(repo, card);
}

const [airFryingPick, ...softwarePicks] = [...document.querySelectorAll<HTMLAnchorElement>(".project-rail [data-pick-summary]")]
  .map(link => createDirectoryCard(link.getAttribute("aria-label") ?? "", link.dataset.pickSummary ?? "", link.href));
const repliesPick = skillCards.get("response-preferences");
const typeScriptPick = skillCards.get("coding-in-typescript");
if (!repliesPick || !typeScriptPick) throw new Error("Special Picks skills are missing");
requiredElement(".directory-picks .directory-card-grid").append(
  airFryingPick,
  ...softwarePicks,
  repliesPick.cloneNode(true),
  typeScriptPick.cloneNode(true),
);

window.addEventListener("message", event => {
  if (event.origin === location.origin && event.source === document.querySelector<HTMLIFrameElement>("#desktop-frame")?.contentWindow && event.data === "close-setup-screen" && detail.open) detail.close(); // Accept Escape only from this site's embedded OBS demo.
});

for (const link of document.querySelectorAll<HTMLAnchorElement>('a[href^="https://"]')) { link.href = projectLink(link.href, projectWebsites); link.target = "_blank"; link.relList.add("noopener", "noreferrer"); }

const projects: ProjectEntry[] = await fetch(new URL("./projects.json?v=__SITE_VERSION__", import.meta.url)).then(response => response.json());
const wandProject = projects.find(project => project.repository === "EthanSK/magic-wand");
if (wandProject) requiredElement<HTMLAnchorElement>("[data-wand-website]").href = wandProject.url; // The room and project directory share the existing public website destination.
for (const project of projects) {
  const link = document.createElement("a"); link.href = projectLink(project.url, projectWebsites); link.target = "_blank"; link.rel = "noopener noreferrer";
  const title = document.createElement("strong"); title.textContent = project.name;
  const repository = document.createElement("span"); repository.textContent = project.description || project.repository;
  link.append(title, repository); requiredElement(".directory-projects").append(link);
}
