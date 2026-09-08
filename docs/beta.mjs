import * as THREE from "three";
import { MouseSimulator } from "./simulator.mjs?v=__SITE_VERSION__";
import { createNativeHUD } from "./native-hud.mjs?v=__SITE_VERSION__";
import { createHeroMouse } from "./hero-mice.mjs?v=__SITE_VERSION__";

const stage = document.querySelector("#room-stage");
const canvas = document.querySelector("#room-canvas");
const detail = document.querySelector("#room-detail");
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const gear = await fetch(new URL("./gear.json?v=__SITE_VERSION__", import.meta.url)).then(response => { if (!response.ok) throw new Error("Hardware data did not load"); return response.json(); });
const gearById = new Map(gear.map(item => [item.id, item]));
const hotspotContainer = document.querySelector(".room-hotspots");
for (const item of gear) {
  const button = document.createElement("button");
  button.type = "button"; button.dataset.topic = item.id; button.dataset.x = item.x; button.dataset.y = item.y;
  button.setAttribute("aria-label", item.name);
  const dot = document.createElement("span"); dot.className = "hotspot-dot"; dot.setAttribute("aria-hidden", "true");
  const label = document.createElement("span"); label.className = "hotspot-label"; label.textContent = item.label;
  button.append(dot, label); hotspotContainer.append(button);
}
const hotspots = [...hotspotContainer.children];
const hotspotWidths = new Map();
const view = { zoom: 0, panX: 0, panY: 0 };
const target = { zoom: 0, panX: 0, panY: 0 };
let renderer, camera, scene, photo, frame = 0, width = 0, height = 0, lastFrame = 0;
let focusPoint = { x: 0, y: 0 };
const roomWidth = 20, roomHeight = 20 * 992 / 1586;
const point = new THREE.Vector3();

/** Render the camera only while it is moving; the photograph keeps its original proportions. */
function draw(now = 0) {
  frame = 0;
  if (!renderer || !width || !height || document.hidden) return;
  const elapsed = Math.min(now - lastFrame, 50);
  lastFrame = now;
  const ease = reduced.matches ? 1 : 1 - Math.exp(-elapsed / 65);
  let moving = false;
  for (const key of ["zoom", "panX", "panY"]) {
    view[key] += (target[key] - view[key]) * ease;
    if (Math.abs(target[key] - view[key]) > .003) moving = true;
    else view[key] = target[key];
  }
  const distance = Math.min(roomHeight / 2, roomWidth / (2 * camera.aspect)) / Math.tan(THREE.MathUtils.degToRad(22.5)); // Cover the viewport without stretching the photo or introducing letterbox bars.
  const travel = view.zoom;
  const depth = distance * (1 - travel * .56);
  const visibleHeight = 2 * depth * Math.tan(THREE.MathUtils.degToRad(22.5));
  const limitX = Math.max(0, (roomWidth - visibleHeight * camera.aspect) / 2);
  const limitY = Math.max(0, (roomHeight - visibleHeight) / 2);
  const centerX = THREE.MathUtils.clamp(view.panX + focusPoint.x * travel, -limitX, limitX);
  const centerY = THREE.MathUtils.clamp(view.panY + focusPoint.y * travel, -limitY, limitY);
  camera.position.set(centerX, centerY, depth);
  camera.lookAt(centerX, centerY, 0);
  camera.updateMatrixWorld();
  renderer.render(scene, camera);
  const left = width < 760 ? 20 : 86, right = width - 28, top = width < 760 ? 118 : 90, bottom = height - 126;
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
  const labelRects = [];
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
function zoom(value) {
  target.zoom = Math.max(0, Math.min(1.35, value));
  canvas.classList.toggle("at-zoom-limit", target.zoom === 1.35);
  if (target.zoom < .15) { target.panX = width < 760 ? 3.4 : 0; target.panY = Math.max(0, (roomHeight - roomWidth * stage.clientHeight / stage.clientWidth) / 2); } // Keep the full upper monitor in the wide-screen starting crop.
  stage.classList.toggle("room-entered", target.zoom > .15);
  document.querySelector('[data-view="desk"]').setAttribute("aria-pressed", String(target.zoom > .15));
  if (!renderer) {
    document.querySelector(".room-poster").style.transform = `scale(${1 + target.zoom * .8})`;
    hotspots.forEach(button => { button.style.left = `${Number(button.dataset.x) * 100}%`; button.style.top = `${Number(button.dataset.y) * 100}%`; });
  }
  render();
}
/** Move a little closer while keeping the clicked point under the pointer. */
function zoomAt(clientX, clientY) {
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
      width = stage.clientWidth; height = stage.clientHeight;
      if (target.zoom === 0) { target.panX = width < 760 ? 3.4 : 0; target.panY = Math.max(0, (roomHeight - roomWidth * height / width) / 2); } // Start on Ethan in portrait and keep the upper monitor inside the wide-screen crop.
      hotspots.forEach(button => hotspotWidths.set(button, button.querySelector(".hotspot-label").offsetWidth)); // Measure labels once per resize, not between style writes on every animation frame.
      camera.aspect = width / height; camera.updateProjectionMatrix();
      renderer.setSize(width, height, false); render();
    }).observe(stage);
    stage.classList.add("room-ready");
    document.querySelector(".room-loading").hidden = true;
  } catch (error) {
    if (renderer) { renderer.dispose(); renderer = null; }
    canvas.hidden = true;
    document.querySelector(".room-loading").textContent = "Photo view · use the buttons to explore";
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
  if (event.target.closest(".room-dock") || detail.open || directory.open) return;
  event.preventDefault();
  cancelRoomGesture();
  const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1);
  zoom(target.zoom + (event.ctrlKey ? -1 : 1) * Math.max(-.18, Math.min(.18, delta * .001))); // Scrolling down moves into the room; Chrome's Ctrl+wheel trackpad pinches keep their usual direction.
}, { passive: false });
const roomPointers = new Map();
let drag, pinch, dragged = false;
/** Start from the visible camera position so a gesture interrupts any unfinished approach. */
function startRoomGesture() {
  Object.assign(target, view);
  const [first, second] = roomPointers.values();
  drag = null; pinch = null;
  if (second) {
    pinch = { distance: Math.hypot(second.x - first.x, second.y - first.y), zoom: view.zoom };
  } else if (first && camera) {
    const visibleHeight = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(22.5)); // Convert pointer movement into the photo's current camera scale so it follows the drag at every zoom level.
    drag = { x: first.x, y: first.y, panX: camera.position.x, panY: camera.position.y, scale: visibleHeight / height, limitX: Math.max(0, (roomWidth - visibleHeight * camera.aspect) / 2), limitY: Math.max(0, (roomHeight - visibleHeight) / 2) };
  }
}
stage.addEventListener("pointerdown", event => {
  if (event.button !== 0 || detail.open) return;
  if (!roomPointers.size) dragged = false;
  if (event.target.closest("button:not(#enter-room), a")) return;
  roomPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  startRoomGesture();
});
stage.addEventListener("pointermove", event => {
  if (!roomPointers.has(event.pointerId)) return; // Hover movement must never keep moving the camera after release. (Codex task: 01a07944-b48e-7e43-8c2f-34b9cfe3df70)
  if (event.pointerType === "mouse" && !(event.buttons & 1)) { cancelRoomGesture(); return; } // A release outside the browser can be missed; the next button-free move must end the drag.
  roomPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pinch) {
    const [first, second] = roomPointers.values();
    const distance = Math.hypot(second.x - first.x, second.y - first.y);
    if (!pinch.distance || !distance) return;
    zoom((1 - (1 - pinch.zoom * .56) * pinch.distance / distance) / .56); // Spreading two fingers reduces camera distance in proportion to their separation.
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
function endRoomPointer(event) {
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
for (const type of ["pointerup", "pointercancel"]) stage.addEventListener(type, endRoomPointer);
stage.addEventListener("lostpointercapture", event => { if (event.target === stage) endRoomPointer(event); }); // Moving implicit touch capture from the canvas to the stage emits a bubbling loss on the canvas; that transfer must not cancel the active pinch.
window.addEventListener("blur", cancelRoomGesture);
document.addEventListener("visibilitychange", () => { if (document.hidden) cancelRoomGesture(); });
stage.addEventListener("click", event => {
  if (dragged) { event.preventDefault(); event.stopPropagation(); dragged = false; return; } // A drag or pinch must not also zoom the background or activate the entry prompt on release.
  if (event.target.closest("button, a") || detail.open || directory.open) return;
  zoomAt(event.clientX, event.clientY);
}, true);
canvas.addEventListener("keydown", event => {
  if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "Enter"].includes(event.key)) return;
  event.preventDefault();
  if (event.key === "ArrowUp" || event.key === "Enter") zoom(target.zoom + .2);
  if (event.key === "ArrowDown") zoom(target.zoom - .2);
  if (event.key === "Home") zoom(0);
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") { target.panX = Math.max(-4, Math.min(4, target.panX + (event.key === "ArrowLeft" ? -.3 : .3))); render(); }
});
document.querySelector("#enter-room").addEventListener("click", () => { target.panX = 0; target.panY = 0; zoom(.85); document.querySelector('[data-view="desk"]').focus({ preventScroll: true }); });
document.querySelector("#zoom-in").addEventListener("click", () => zoom(target.zoom + .2));
document.querySelector("#zoom-out").addEventListener("click", () => zoom(target.zoom - .2));
document.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", () => {
  focusPoint = { x: 0, y: 0 }; target.panX = 0; target.panY = 0; zoom(button.dataset.view === "room" ? 0 : .85);
  if (button.dataset.view === "room") document.querySelector("#enter-room").focus({ preventScroll: true });
}));

const topics = {
  corsair: ["Right hand · Agentic Mouse", "Corsair Scimitar", "Twelve thumb controls for working with agents, with the top button for VoiceInk++ dictation."],
  razer: ["Left hand · Agentic Mouse", "Razer Naga", "The same controls mirrored for my left hand, so I can switch whenever I want."],
  codex: ["", "Codex", ""],
  obs: ["", "OBS", ""],
  sausages: ["", "Tesco Finest sausages", "(This is a joke, I only eat M&S, Waitrose, or Deliveroo sausages.)"],
  code: ["Great for Agentic Engineers", "Review code without moving your hand", "Quick press to jump to a change, or hold and release to stage the current file and jump in that direction."],
  voice: ["VoiceInk++", "YouTube pauses when I start talking", "I use a top mouse button to dictate instead of typing, and my video resumes when I finish if my setup paused it."],
  desk: ["My desk setup", "Both mice stay on the desk", "High sensitivity keeps movement small, and I sometimes use both mice to click through code review faster."],
  chair: ["My desk setup", "Lean back without reaching for a keyboard", "I use thumb controls and dictation with the footrest out, switching hands whenever I want."],
};
let returnFocus, returnView, productViewer, productRequest = 0;
function openTopic(topic, trigger) {
  const item = gearById.get(topic);
  const copy = topics[topic] || (item && ["My setup", item.name, item.description]);
  if (!copy) return;
  cancelRoomGesture();
  productViewer?.dispose(); productViewer = null; productRequest++;
  document.querySelector("#desktop-frame").removeAttribute("src");
  if (!detail.open) { returnFocus = trigger; returnView = { ...target }; }
  const anchor = hotspots.find(button => button.dataset.topic === (topic === "code" ? "dell" : topic === "voice" ? "shure" : topic));
  const zoomLevel = 1.2;
  target.zoom = zoomLevel;
  target.panX = (Number(anchor.dataset.x) - .5) * roomWidth - focusPoint.x * zoomLevel;
  target.panY = (.5 - Number(anchor.dataset.y)) * roomHeight - focusPoint.y * zoomLevel;
  stage.classList.add("room-focused");
  detail.dataset.topic = topic;
  render();
  document.querySelector("#detail-kicker").textContent = topic === "desk" || topic === "chair" ? item.name : copy[0];
  document.querySelector("#detail-title").textContent = copy[1];
  document.querySelector("#detail-description").textContent = copy[2];
  document.querySelector("#detail-description").hidden = !copy[2];
  const mouse = topic === "razer" || topic === "corsair";
  const panel = mouse ? "mouse" : topic === "code" || topic === "voice" || topic === "sausages" ? topic : (topic === "codex" || topic === "obs") ? "screen" : "hardware"; // Hardware opens its product; separate nearby Codex and OBS hotspots own the software views, never combined monitor/software labels (task 01a07944-b48e-7e43-8c2f-34b9cfe3df70).
  for (const name of ["mouse", "code", "voice", "hardware", "screen", "sausages"]) document.querySelector(`#${name}-detail`).hidden = name !== panel;
  if (mouse) {
    if (simulator) { simulator.chooseHand(topic); updateMouse(); }
    document.querySelectorAll(".beta-mice figure").forEach(figure => { figure.hidden = figure.dataset.mouse !== topic; });
    loadMouse(topic);
  }
  if (topic === "code") updateReview();
  if (topic === "voice") updateVoice();
  if (panel === "hardware") showHardware(topic);
  if (panel === "screen") showScreen(topic);
  if (!detail.open) detail.showModal();
  detail.scrollTop = 0;
  document.querySelector(".detail-close").focus({ preventScroll: true });
}
document.querySelectorAll("[data-topic]").forEach(button => button.addEventListener("click", () => openTopic(button.dataset.topic, button)));
document.querySelectorAll("[data-voice]").forEach(button => button.addEventListener("click", () => openTopic("voice", button)));
document.querySelector(".detail-close").addEventListener("click", () => detail.close());
detail.addEventListener("close", () => {
  productViewer?.dispose(); productViewer = null; productRequest++;
  document.querySelector("#desktop-frame").removeAttribute("src");
  Object.assign(target, returnView); // Closing a feature returns to the exact zoom and pan from which it was opened.
  stage.classList.remove("room-focused");
  render();
  document.querySelector(".video-example").classList.remove("is-playing");
  videoPlaying = videoOwned || videoPlaying; // Leaving dictation cancels it and resumes only the example video it paused.
  recording = false; videoOwned = false;
  reviewPress = null; clearTimeout(reviewTimer); // Escape can close the panel while a review key is still held; that cancelled hold must not stage on release.
  document.querySelectorAll("[data-review]").forEach(button => button.classList.remove("is-ready"));
  returnFocus?.focus({ preventScroll: true });
});

let simulator, updateHUD, pendingKeypad;
const loadedMice = new Set();
const mapRequest = fetch(new URL("./simulator-data.json?v=__SITE_VERSION__", import.meta.url)).then(response => {
  if (!response.ok) throw new Error(`Mouse map could not load (${response.status})`);
  return response.json();
}).then(map => {
  simulator = new MouseSimulator(map);
  for (const app of map.apps) {
    const option = document.createElement("option"); option.value = app.id; option.textContent = app.title; document.querySelector("#beta-app").append(option);
  }
  document.querySelector("#beta-app").value = simulator.app;
  updateHUD = createNativeHUD(document.querySelector("#beta-hud"), simulator, {
    activate: cell => { simulator.press(cell); updateMouse(); },
    preview: cell => { simulator.state.selected = cell; document.querySelector("#beta-feedback").textContent = simulator.control(cell).title; updateGestures(); },
    bindHold: () => {}, // Hold and wheel buttons provide explicit gestures in the beta, including touch and keyboard input.
    keydown: () => {},
  });
  updateMouse();
  document.querySelector("#mouse-detail").inert = false;
  return map;
}).catch(error => { document.querySelector("#beta-feedback").textContent = "The mouse map could not load. Reload to try again."; throw error; });
async function loadMouse(hand) {
  if (loadedMice.has(hand)) return;
  loadedMice.add(hand);
  try {
    const map = await mapRequest;
    await createHeroMouse(document.querySelector(`.beta-mice [data-mouse="${hand}"]`), map.sources[hand], (source, cell) => {
      simulator.chooseHand(source); simulator.press(cell); updateMouse();
    }, (_source, cell) => simulator.control(cell).title);
  } catch { loadedMice.delete(hand); }
}
function updateGestures() {
  const control = simulator.control(simulator.state.selected);
  document.querySelector("#beta-hold").disabled = !control.wheel && !control.keypad;
  for (const id of ["beta-wheel-up", "beta-wheel-down"]) document.getElementById(id).disabled = simulator.state.held === null;
}
function updateMouse() {
  updateHUD?.(); updateGestures();
  document.querySelector("#beta-feedback").textContent = simulator.state.text || simulator.state.output;
  clearTimeout(pendingKeypad);
  if (simulator.state.pending) pendingKeypad = setTimeout(() => { simulator.tick(performance.now()); updateMouse(); }, 850);
}
document.querySelector("#beta-app").addEventListener("change", event => { if (simulator) { simulator.chooseApp(event.target.value); updateMouse(); } });
document.querySelector("#beta-hold").addEventListener("click", () => { simulator.hold(simulator.state.selected); updateMouse(); });
document.querySelector("#beta-wheel-up").addEventListener("click", () => { simulator.wheel("up"); updateMouse(); });
document.querySelector("#beta-wheel-down").addEventListener("click", () => { simulator.wheel("down"); updateMouse(); });
document.querySelector("#beta-reset").addEventListener("click", () => { simulator.reset(); updateMouse(); });

const reviewFiles = [
  ["settings.json", '  {\n−   "reviewOnSave": false,\n+   "reviewOnSave": true,\n    "theme": "dark"\n  }'],
  ["review.ts", '  function nextChange() {\n−   openFile(next);\n+   openDiff(next);\n  }'],
  ["README.md", '  ## Review code\n+ Quick press to jump.\n+ Hold and release to stage and jump.'],
];
let reviewIndex = 0, reviewTimer, reviewPress;
const staged = new Set();
function updateReview() {
  document.querySelector("#code-file").textContent = `${reviewFiles[reviewIndex][0]}${staged.has(reviewIndex) ? " · staged" : ""}`;
  document.querySelector("#code-lines").textContent = reviewFiles[reviewIndex][1];
  document.querySelector("#code-staged").textContent = `${staged.size} staged`;
}
function reviewStep(direction, stageFile) {
  const previous = reviewIndex;
  if (stageFile) staged.add(previous);
  reviewIndex = (reviewIndex + direction + reviewFiles.length) % reviewFiles.length;
  document.querySelector("#review-feedback").textContent = `${stageFile ? `Staged ${reviewFiles[previous][0]} and opened` : "Opened"} ${reviewFiles[reviewIndex][0]}.`;
  updateReview();
}
for (const button of document.querySelectorAll("[data-review]")) {
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
document.querySelector("#review-reset").addEventListener("click", () => { staged.clear(); reviewIndex = 0; updateReview(); document.querySelector("#review-feedback").textContent = "Quick press to jump, or hold for 300 ms and release to stage the file and jump."; });

let videoPlaying = true, recording = false, videoOwned = false;
function updateVoice() {
  document.querySelector(".video-example").classList.toggle("is-playing", videoPlaying);
  document.querySelector("#video-toggle").textContent = videoPlaying ? "Pause video" : "Play video";
  document.querySelector("#video-status").textContent = videoPlaying ? "Playing" : recording && videoOwned ? "Paused for dictation" : "Paused";
  document.querySelector(".video-screen > span").textContent = videoPlaying ? "▶" : "Ⅱ";
  document.querySelector("#dictate").textContent = recording ? "Finish dictation" : "Start dictation";
  document.querySelector("#dictate").setAttribute("aria-pressed", String(recording));
}
document.querySelector("#video-toggle").addEventListener("click", () => { videoPlaying = !videoPlaying; updateVoice(); });
document.querySelector("#dictate").addEventListener("click", () => {
  recording = !recording;
  if (recording) {
    videoOwned = videoPlaying;
    videoPlaying = false;
    document.querySelector("#transcript").textContent = '“Review these changes and explain anything I need to check.”';
  } else {
    videoPlaying = videoOwned || videoPlaying;
    document.querySelector("#transcript").textContent = videoOwned ? "Transcript sent to my agent and the video resumes." : "Transcript sent to my agent; the video stays paused because it was already paused.";
    videoOwned = false;
  }
  updateVoice();
});

/** Keep clicks inside a dialog intact; a press and release on its backdrop dismiss it. */
function dismissOutside(dialog) {
  let startedOutside = false;
  const outside = event => { const rect = dialog.getBoundingClientRect(); return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom; };
  dialog.addEventListener("pointerdown", event => { startedOutside = event.target === dialog && outside(event); });
  dialog.addEventListener("click", event => { if (startedOutside && event.target === dialog && outside(event)) dialog.close(); startedOutside = false; });
}
dismissOutside(detail);
/** Open the one on-demand renderer; a dismissed async load must not leave a WebGL context running. */
async function showHardware(id) {
  const item = gearById.get(id);
  const request = ++productRequest;
  document.querySelector("#hardware-detail").hidden = false;
  document.querySelector("#screen-detail").hidden = true;
  document.querySelector("#desktop-frame").removeAttribute("src"); // Stop the embedded desktop while its hardware model is shown.
  const specs = document.querySelector("#product-specs"); specs.replaceChildren();
  for (const spec of item.specs) { const li = document.createElement("li"); li.textContent = spec; specs.append(li); }
  const link = document.querySelector("#product-link"); link.href = item.url;
  const demo = document.querySelector("#product-demo");
  demo.hidden = id !== "shure";
  demo.textContent = "Try dictation";
  demo.onclick = () => openTopic("voice", demo);
  const status = document.querySelector("#product-state"); status.hidden = false; status.textContent = "Loading 3D view…";
  const productCanvas = document.querySelector("#product-canvas"); productCanvas.hidden = false;
  try {
    const {createProductViewer} = await import("./product-models.mjs?v=__SITE_VERSION__");
    if (request !== productRequest) return;
    productViewer?.dispose();
    const viewer = await createProductViewer(productCanvas, id);
    if (request !== productRequest || !detail.open) { viewer.dispose(); return; }
    productViewer = viewer; status.hidden = true;
  } catch (error) { if (request === productRequest) { status.textContent = "3D view unavailable"; productCanvas.hidden = true; } console.warn("Product view unavailable", id, error); }
}
document.querySelector("#product-reset").addEventListener("click", () => productViewer?.reset());
/** Reuse the canonical public desktop so its apps and Codex example stay maintained in one place. */
function showScreen(id) {
  productViewer?.dispose(); productViewer = null; productRequest++;
  document.querySelector("#hardware-detail").hidden = true; document.querySelector("#screen-detail").hidden = false;
  const frame = document.querySelector("#desktop-frame");
  frame.src = id === "obs" ? "./obs.html?v=__SITE_VERSION__" : "https://ethansk.github.io/response-preferences/";
  frame.title = id === "obs" ? "OBS — demo" : "Interactive example of Ethan’s desktop";
}
const directory = document.querySelector("#setup-directory");
let directoryTrigger;
function openDirectory(trigger) { directoryTrigger = trigger; directory.showModal(); }
for (const button of document.querySelectorAll("#show-directory, [data-directory]")) button.addEventListener("click", () => openDirectory(button));
document.querySelector(".directory-close").addEventListener("click", () => directory.close());
directory.addEventListener("close", () => directoryTrigger?.focus({preventScroll:true}));
dismissOutside(directory);
for (const item of gear) {
  const button = document.createElement("button"); button.type = "button";
  const name = document.createElement("strong"); name.textContent = item.name;
  const specs = document.createElement("span"); specs.textContent = item.specs.join(" · ");
  button.append(name, specs); button.addEventListener("click", () => { directory.close(); openTopic(item.id, document.querySelector("#show-directory")); }); // Hardware entries always open product models; software has separate room hotspots.
  document.querySelector(".directory-gear").append(button);
}
const apps = await fetch(new URL("./apps.json?v=__SITE_VERSION__", import.meta.url)).then(response => response.json());
for (const app of apps.filter(app => app.url)) {
  const link = document.createElement("a"); link.href = app.url; link.target = "_blank"; link.rel = "noopener";
  const icon = document.createElement("img"); icon.src = new URL(app.icon, "https://ethansk.github.io/response-preferences/").href; icon.alt = ""; icon.width = 30; icon.height = 30; icon.loading = "lazy";
  const name = document.createElement("span"); name.textContent = app.name;
  link.append(icon,name); document.querySelector(".directory-apps").append(link);
}
const skills = [
 ["Response Preferences", "response-preferences", "How I want agents to write replies"],
 ["Outstanding Items", "outstanding-items", "Keep track of unfinished work"],
 ["Submit ChatGPT Feedback", "submit-chatgpt-feedback", "Report problems from the current task"],
 ["Local Web Debug Mode", "local-web-debug-mode", "Debug a local website with an agent"],
 ["Deepgram dictation", "claude-code-deepgram-stt-skill", "Talk to Claude Code"],
 ["Emoji Consistency", "emoji-consistency", "Use consistent emoji meanings"],
 ["Skill self-reload", "claude-skill-self-reload-plugins-mac", "Reload changed Claude skills on macOS"],
 ["AIMVS dev workflow", "aimvs-dev-skill", "My project workflow as a reference"],
 ["Agent Bridge", "agent-bridge", "Connect agents across machines"],
 ["Pre-Commit Codex Review", "pre-commit-codex-review", "Review changes before committing"],
];
for (const [name,repo,description] of skills) {
 const link = document.createElement("a"); link.href = `https://github.com/EthanSK/${repo}`;
 const title = document.createElement("strong"); title.textContent = name;
 const summary = document.createElement("span"); summary.textContent = description;
 link.append(title,summary); document.querySelector(".directory-skills").append(link);
}

window.addEventListener("message", event => {
  if (event.origin === location.origin && event.source === document.querySelector("#desktop-frame").contentWindow && event.data === "close-setup-screen" && detail.open) detail.close(); // Accept Escape only from this site's embedded OBS demo.
});
