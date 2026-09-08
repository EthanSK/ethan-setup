import * as THREE from "three";
import { RoundedBoxGeometry } from "./lib/RoundedBoxGeometry.js";

// Rotatable Three.js product viewers for the hardware on Ethan's desk. Every model is built from published dimensions and reference
// geometry in millimetres (see PRODUCT-MODELS.md for the sources and known approximations), so the viewer
// fits the camera from the real bounding sphere instead of per-product magic numbers.

const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const FRAME_INTERVAL = 1000 / 30; // Product turntables never need more than 30 fps; the dialog is mostly static text.
const TURN_SPEED = .10; // Radians per second for the idle auto-turn.
const PITCH_MIN = -.55, PITCH_MAX = 1.35;

/**
 * Render one product in `canvas`. Resolves to {reset, dispose}; rejects when WebGL or the model is unavailable
 * so the caller can fall back to the reference photograph and link.
 */
export async function createProductViewer(canvas, productId, controls, loadSignal) {
  const build = builders[productId];
  if (!build) throw new Error(`No 3D model is available for "${productId}".`);
  const { group, view, movements = [] } = await build(loadSignal);
  loadSignal?.throwIfAborted(); // A closed MacBook request must finish before allocating a renderer or touching a newer product's shared controls.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
  const controller = new AbortController();
  const { signal } = controller;
  let frame = 0, lastRender = 0, lastTick = 0, visible = true, dragging = null, autoTurn = true, disposed = false;
  let elapsed = 0, movementTime = 0, movementIndex = 0, selectedMovement = -1, paused = reduced.matches, resumeTimer = 0;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 1, 10000);
  const pivot = new THREE.Group();
  scene.add(pivot);
  let environment;
  const previousTouchAction = canvas.style.touchAction;
  try {
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.setClearColor(0x000000, 0);
    environment = studioEnvironment(renderer);
    scene.environment = environment;
    scene.environmentIntensity = 1;
    const key = new THREE.DirectionalLight(0xfff7ef, 2.2);
    key.position.set(-4, 8, 6);
    scene.add(key);
    const edge = new THREE.DirectionalLight(0xdbe6ff, 1.1);
    edge.position.set(6, 3, -5);
    scene.add(edge);
    const fill = new THREE.DirectionalLight(0xffffff, 1.25);
    fill.position.set(2, -3, 7);
    scene.add(fill);

    for (const movement of movements) movement.apply(0);
    const bounds = new THREE.Box3().setFromObject(group);
    for (const movement of movements) { // Fit the whole adjustment sweep once; fitting only the initial pose clips raised desks and portrait monitors.
      for (let i = 0; i <= 16; i++) { movement.apply(i / 16); bounds.union(new THREE.Box3().setFromObject(group)); }
      movement.apply(0);
    }
    const center = bounds.getCenter(new THREE.Vector3());
    group.position.sub(center); // Rotate about the true centre of the hardware so it never swings out of frame.
    pivot.add(group);
    let radius = boundingRadius(group);
    for (const movement of movements) {
      for (let i = 0; i <= 16; i++) { movement.apply(i / 16); radius = Math.max(radius, boundingRadius(group, true)); }
      movement.apply(0);
    }
    const pose = { yaw: view.yaw, pitch: view.pitch };
    const shadow = contactShadow(bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z);
    const rotatedBounds = new THREE.Box3();
    scene.add(shadow);

    let width = 0, viewHeight = 0, zoom = 1, fitDistance = 0;
    function fit() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return false;
      if (w !== width || h !== viewHeight) {
        width = w; viewHeight = h;
        camera.aspect = w / h;
        const halfVertical = THREE.MathUtils.degToRad(camera.fov / 2);
        const halfHorizontal = Math.atan(Math.tan(halfVertical) * camera.aspect);
        const distance = radius / Math.sin(Math.min(halfVertical, halfHorizontal)) * 1.06; // The whole bounding sphere stays inside the shorter edge at any rotation.
        fitDistance = distance;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      }
      camera.position.z = fitDistance / zoom;
      camera.near = Math.max(.1, camera.position.z - radius * 1.6);
      camera.far = camera.position.z + radius * 1.6;
      camera.updateProjectionMatrix();
      return true;
    }
    function draw() {
      if (!fit()) return;
      pivot.rotation.set(pose.pitch, pose.yaw, 0, "XYZ"); // Yaw spins the hardware on its own axis first, then pitch tilts the turntable toward the camera.
      shadow.position.y = rotatedBounds.setFromObject(pivot).min.y - radius * .004; // A fixed shadow plane sliced through tilted products; keep it below the current rotation's lowest point.
      shadow.material.opacity = .55 * Math.max(0, 1 - Math.abs(pose.pitch - view.pitch) * 1.4);
      renderer.render(scene, camera);
    }
    function playing() { return visible && !document.hidden && !dragging && !paused && !resumeTimer; }
    function turning() { return autoTurn && playing(); }
    function moving() { return movements.length > 0 && playing(); }
    function syncControls() {
      controls.hidden = movements.length === 0;
      controls.querySelector("button").textContent = paused ? "Play movement" : "Pause movement";
      const current = movements[movementIndex]?.name;
      if (current) controls.querySelector('option[value="-1"]').textContent = `All movements · ${current}`;
    }
    const selector = controls.querySelector("select");
    selector.replaceChildren(new Option("All movements", "-1"), ...movements.map((movement, i) => new Option(movement.name, String(i))));
    selector.addEventListener("change", () => {
      movements[movementIndex]?.apply(0);
      selectedMovement = Number(selector.value);
      movementIndex = Math.max(0, selectedMovement);
      movementTime = 0;
      clearTimeout(resumeTimer); resumeTimer = 0;
      syncControls(); render();
    }, { signal });
    controls.querySelector("button").addEventListener("click", () => {
      paused = !paused;
      clearTimeout(resumeTimer); resumeTimer = 0;
      syncControls(); render();
    }, { signal });
    syncControls();
    function loop(now) {
      frame = 0;
      if (disposed) return;
      if (now - lastRender < FRAME_INTERVAL - 1) { frame = requestAnimationFrame(loop); return; }
      const delta = Math.min(now - lastTick, 100) / 1000;
      lastTick = now;
      if (turning()) {
        elapsed += delta;
        pose.yaw = movements.length ? view.yaw + Math.sin(elapsed * .16) * .2 : pose.yaw + TURN_SPEED * delta; // Keep mechanical demos near their useful viewing angle while the joints move.
      }
      if (moving()) {
        const movement = movements[movementIndex];
        movementTime += delta;
        const duration = movement.duration ?? 8;
        if (movementTime >= duration) {
          movement.apply(0);
          movementTime %= duration;
          if (selectedMovement < 0) movementIndex = (movementIndex + 1) % movements.length;
          syncControls();
        }
        const phase = movementTime / (movements[movementIndex].duration ?? 8);
        const progress = .5 - .5 * Math.cos(Math.PI * 2 * phase); // Ease from the resting position to the adjustment and back, without a jump at the loop seam.
        movements[movementIndex].apply(progress);
      }
      lastRender = now;
      draw();
      if (turning() || moving()) frame = requestAnimationFrame(loop);
    }
    function render() {
      if (disposed || frame) return;
      lastTick = performance.now();
      frame = requestAnimationFrame(loop);
    }
    function stop() { cancelAnimationFrame(frame); frame = 0; }
    function inspect() {
      autoTurn = false;
      clearTimeout(resumeTimer);
      resumeTimer = 0;
      if (movements.length && !paused) resumeTimer = setTimeout(() => { resumeTimer = 0; syncControls(); render(); }, 6000); // Resume the adjustment after inspection; a deliberate Pause stays paused.
      syncControls();
    }
    function interact() { inspect(); render(); }

    canvas.addEventListener("wheel", event => {
      event.preventDefault();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1);
      zoom = THREE.MathUtils.clamp(zoom * Math.exp(delta * .0015), .65, 2.4);
      interact();
    }, { passive: false, signal });
    canvas.style.touchAction = "pan-y"; // Horizontal touch drags rotate; vertical ones still scroll the dialog.
    canvas.addEventListener("pointerdown", event => {
      if (event.button !== 0 || dragging) return;
      dragging = { id: event.pointerId, x: event.clientX, y: event.clientY, yaw: pose.yaw, pitch: pose.pitch, touch: event.pointerType === "touch", moved: false };
    }, { signal });
    canvas.addEventListener("pointermove", event => {
      if (!dragging || event.pointerId !== dragging.id) return;
      if (event.pointerType === "mouse" && !(event.buttons & 1)) { release(event); return; } // A release outside the window can be missed; the next button-free move ends the drag.
      const dx = event.clientX - dragging.x, dy = event.clientY - dragging.y;
      if (!dragging.moved) {
        if (Math.hypot(dx, dy) < 4) return;
        if (dragging.touch && Math.abs(dy) > Math.abs(dx)) { dragging = null; return; } // Let a mostly vertical touch scroll the dialog instead of tilting the model.
        dragging.moved = true;
        canvas.setPointerCapture(event.pointerId);
        inspect();
      }
      pose.yaw = dragging.yaw + dx * .011;
      pose.pitch = THREE.MathUtils.clamp(dragging.pitch + dy * .008, PITCH_MIN, PITCH_MAX);
      render();
    }, { signal });
    function release(event) {
      if (!dragging || event.pointerId !== dragging.id) return;
      const moved = dragging.moved;
      dragging = null; // No inertia: the model stays exactly where the hand left it.
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      if (moved) inspect();
      render();
    }
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) canvas.addEventListener(type, release, { signal });
    canvas.addEventListener("keydown", event => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home"].includes(event.key)) return;
      event.preventDefault();
      if (event.key === "Home") { reset(); return; }
      if (event.key === "ArrowLeft") pose.yaw -= .16;
      if (event.key === "ArrowRight") pose.yaw += .16;
      if (event.key === "ArrowUp") pose.pitch = Math.max(PITCH_MIN, pose.pitch - .16);
      if (event.key === "ArrowDown") pose.pitch = Math.min(PITCH_MAX, pose.pitch + .16);
      interact();
    }, { signal });
    canvas.addEventListener("webglcontextlost", event => { event.preventDefault(); stop(); }, { signal });
    canvas.addEventListener("webglcontextrestored", () => { width = 0; render(); }, { signal });
    document.addEventListener("visibilitychange", () => { if (document.hidden) { stop(); dragging = null; } else render(); }, { signal });
    window.addEventListener("blur", () => { dragging = null; }, { signal });
    reduced.addEventListener("change", () => { paused = reduced.matches; clearTimeout(resumeTimer); resumeTimer = 0; syncControls(); render(); }, { signal });
    const resize = new ResizeObserver(() => { width = 0; render(); });
    resize.observe(canvas);
    const intersection = new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting);
      if (visible) render(); else stop();
    });
    intersection.observe(canvas);

    function reset() {
      zoom = 1;
      pose.yaw = view.yaw;
      pose.pitch = view.pitch;
      autoTurn = true;
      elapsed = movementTime = 0;
      movements[movementIndex]?.apply(0);
      movementIndex = Math.max(0, selectedMovement);
      paused = reduced.matches;
      clearTimeout(resumeTimer); resumeTimer = 0;
      syncControls(); render();
    }
    function dispose() {
      if (disposed) return;
      disposed = true;
      clearTimeout(resumeTimer);
      controls.hidden = true;
      stop();
      controller.abort();
      resize.disconnect();
      intersection.disconnect();
      canvas.style.touchAction = previousTouchAction;
      scene.traverse(object => {
        object.geometry?.dispose();
        for (const material of [].concat(object.material ?? [])) {
          for (const value of Object.values(material)) if (value?.isTexture) value.dispose();
          material.dispose();
        }
      });
      environment?.dispose();
      renderer.dispose();
      // Keep the reusable canvas context alive: forcing loss here made the next product fail to load.
    }
    render();
    return { reset, dispose };
  } catch (error) {
    controller.abort();
    canvas.style.touchAction = previousTouchAction;
    environment?.dispose();
    renderer.dispose();
    // A failed build still leaves this canvas available for another product.
    throw error;
  }
}

/** Largest distance from the group origin to any vertex, so the camera fit survives every rotation. */
function boundingRadius(group, cornersOnly = false) {
  group.updateMatrixWorld(true);
  const vertex = new THREE.Vector3();
  let radiusSquared = 0;
  group.traverse(object => {
    if (!object.isMesh) return;
    if (cornersOnly) { // Per-part box corners bound animated vertices without scanning dense geometry for every sampled pose.
      if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
      const {min, max} = object.geometry.boundingBox;
      for (const x of [min.x,max.x]) for (const y of [min.y,max.y]) for (const z of [min.z,max.z]) {
        vertex.set(x,y,z).applyMatrix4(object.matrixWorld); radiusSquared = Math.max(radiusSquared,vertex.lengthSq());
      }
      return;
    }
    const positions = object.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      vertex.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
      radiusSquared = Math.max(radiusSquared, vertex.lengthSq());
    }
  });
  return Math.sqrt(radiusSquared); // Per-mesh sphere unions overestimate long panels and made the products needlessly small.
}

/** A soft dark ellipse under the hardware; it grounds the turntable without a shadow pass. */
function contactShadow(width, depth) {
  const texture = canvasTexture(64, 64, (ctx, w, h) => {
    const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gradient.addColorStop(0, "rgba(0,0,0,1)");
    gradient.addColorStop(.55, "rgba(0,0,0,.55)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }, 1);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(width * 1.35, depth * 1.35), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, opacity: .55 }));
  plane.rotation.x = -Math.PI / 2;
  return plane;
}

/**
 * Soft studio rig baked to a PMREM: broad feathered diffusers over a dark table. This mirrors the mouse studio in
 * mouse-model.mjs but stays local so the viewer does not pull in the glTF, Draco and BVH loaders it never uses.
 */
function studioEnvironment(renderer) {
  const studio = new THREE.Scene();
  studio.add(backdrop(40));
  studio.add(softbox([-7, 12, 9], 18, 12, 11, [1, .97, .93]));
  studio.add(softbox([9, -1, 11], 16, 10, 2.4, [1, 1, 1]));
  studio.add(softbox([10, 6, -8], 4, 16, 6.5, [.92, .95, 1]));
  studio.add(softbox([-2, 9, -11], 18, 4, 3.5, [1, 1, 1]));
  studio.add(softbox([0, -9, 4], 16, 12, .8, [1, 1, 1]));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(studio, .035).texture;
  pmrem.dispose();
  studio.traverse(object => { object.geometry?.dispose(); object.material?.dispose(); });
  return texture;
}
function backdrop(radius) {
  const geometry = new THREE.SphereGeometry(radius, 48, 32);
  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const floor = new THREE.Color(.014, .013, .012), horizon = new THREE.Color(.07, .071, .075), ceiling = new THREE.Color(.34, .35, .38), color = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    const t = position.getY(i) / radius;
    color.lerpColors(horizon, t < 0 ? floor : ceiling, THREE.MathUtils.smoothstep(Math.abs(t), 0, 1));
    colors.set([color.r, color.g, color.b], i * 3);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }));
}
function softbox([x, y, z], width, height, peak, [r, g, b]) {
  const geometry = new THREE.PlaneGeometry(width, height, 24, 24);
  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const radial = Math.hypot(position.getX(i) * 2 / width, position.getY(i) * 2 / height);
    const glow = peak * Math.max(0, 1 - radial * radial) ** 1.4;
    colors.set([glow * r, glow * g, glow * b], i * 3);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const panel = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
  panel.position.set(x, y, z);
  panel.lookAt(0, 0, 0);
  return panel;
}

// ---------------------------------------------------------------------------------------------------------------
// Geometry helpers. Everything is in millimetres; +z faces the user, +y is up, +x is the user's right.

function std(color, roughness = .5, metalness = 0, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
}
function at(object, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  object.position.set(x, y, z);
  object.rotation.set(rx, ry, rz);
  return object;
}
function box(w, h, d, material, radius = 0, segments = 3) {
  return new THREE.Mesh(radius > 0 ? new RoundedBoxGeometry(w, h, d, segments, radius) : new THREE.BoxGeometry(w, h, d), material);
}
/** Vertical cylinder; pass `axis` "z" for one pointing at the user or "x" for one lying sideways. */
function cyl(rTop, rBottom, h, material, segments = 40, axis = "y", openEnded = false) {
  const geometry = new THREE.CylinderGeometry(rTop, rBottom, h, segments, 1, openEnded);
  if (axis === "z") geometry.rotateX(Math.PI / 2);
  if (axis === "x") geometry.rotateZ(Math.PI / 2);
  return new THREE.Mesh(geometry, material); // Bake the intrinsic axis into geometry; placement rotations previously turned microphone bodies and sockets upright again.
}
/** Revolve a profile around y. Outward normals need the profile to travel from the bottom to the top (Three's LatheGeometry convention). */
function lathe(points, material, segments = 48) {
  return new THREE.Mesh(new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), segments), material);
}
function ring(inner, outer, material, segments = 48) {
  return new THREE.Mesh(new THREE.RingGeometry(inner, outer, segments), material);
}
function roundedRect(w, h, r) {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2 + r, -h / 2);
  shape.lineTo(w / 2 - r, -h / 2);
  shape.absarc(w / 2 - r, -h / 2 + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(w / 2, h / 2 - r);
  shape.absarc(w / 2 - r, h / 2 - r, r, 0, Math.PI / 2, false);
  shape.lineTo(-w / 2 + r, h / 2);
  shape.absarc(-w / 2 + r, h / 2 - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(-w / 2, -h / 2 + r);
  shape.absarc(-w / 2 + r, -h / 2 + r, r, Math.PI, Math.PI * 1.5, false);
  return shape;
}
/** Flat rounded plate facing +z (thickness along z). */
function plate(w, h, thickness, radius, material) {
  const geometry = new THREE.ExtrudeGeometry(roundedRect(w, h, radius), { depth: thickness, bevelEnabled: false, curveSegments: 8 });
  geometry.translate(0, 0, -thickness / 2);
  return new THREE.Mesh(geometry, material);
}
function canvasTexture(wMM, hMM, draw, pxPerMM = 4) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(2, Math.ceil(wMM * pxPerMM));
  canvas.height = Math.max(2, Math.ceil(hMM * pxPerMM));
  const ctx = canvas.getContext("2d");
  ctx.scale(pxPerMM, pxPerMM);
  draw(ctx, wMM, hMM);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
/** Printed labels and screens: a plane facing +z carrying a canvas texture, sitting a hair above the surface. */
function decal(w, h, draw, { pxPerMM = 4, emissive = 0 } = {}) {
  const map = canvasTexture(w, h, draw, pxPerMM);
  const material = new THREE.MeshStandardMaterial({ map, transparent: true, roughness: .6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, emissive: 0xffffff, emissiveMap: emissive ? map : null, emissiveIntensity: emissive });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
}
function text(ctx, string, x, y, size, color = "#e8e8e8", weight = 600, align = "center") {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(string, x, y);
}
/** A knob with a soft top edge and a pointer line, standing on +y. */
function knob(r, h, material, markMaterial, segments = 40) {
  const group = new THREE.Group();
  const body = lathe([[0, 0], [r, 0], [r, h - r * .3], [r * .96, h - r * .12], [r * .82, h], [0, h]], material, segments);
  group.add(body);
  if (markMaterial) group.add(at(box(r * .1, .3, r * .55, markMaterial), 0, h + .15, -r * .6));
  return group;
}

// ---------------------------------------------------------------------------------------------------------------
// Product builders return {group, view}; each is fitted and centred by the viewer.

const builders = {
  hs8: buildHS8,
  scarlett: buildScarlett,
  flx4: buildFLX4,
  akai: buildAkai,
  shure: buildShure,
  bigknob: buildBigKnob,
  drive: buildDrive,
  macbook: buildMacBook,
  macmini: buildMacMini,
  canon: buildCanon,
  dell: buildDell,
  samsung: buildSamsung,
  desk: buildDesk,
  chair: buildChair,
};

/** Canon EOS M50 Mark II: 116.3 × 88.1 × 58.7 mm body, with a representative compact EF-M lens and articulated screen. */
function buildCanon() {
  const group = new THREE.Group();
  const shell = std(0x18191c, .58), grip = std(0x101113, .86), trim = std(0x292b2e, .42), black = std(0x050608, .64), silver = std(0x95989b, .3, .85);
  group.add(at(box(108, 62, 40, shell, 5, 5), 4, 33, 0));
  group.add(at(box(25, 65, 53, grip, 8, 6), -45.5, 34, 5));
  group.add(at(box(30, 9, 34, shell, 3), -43, 64, 1));
  group.add(at(box(33, 8, 39, shell, 3), 40, 64, 0));
  const hump = new THREE.Shape();
  hump.moveTo(-27, 60); hump.lineTo(-24, 77); hump.quadraticCurveTo(-22, 85, -15, 86);
  hump.lineTo(12, 86); hump.quadraticCurveTo(21, 85, 23, 77); hump.lineTo(26, 60); hump.closePath();
  const housing = new THREE.ExtrudeGeometry(hump, {depth: 35, bevelEnabled: true, bevelSize: 1.5, bevelThickness: 1.2, bevelSegments: 3, curveSegments: 16});
  group.add(at(new THREE.Mesh(housing, shell), -3, 0, -20));
  group.add(at(box(35, 2, 26, trim, 2), -4, 77, 7)); // A seam separates the pop-up flash from the viewfinder housing.
  group.add(at(box(20, 1.5, 20, silver, .6), -4, 87.5, -5));
  group.add(at(box(15, 1.8, 17, black, .5), -4, 88.5, -5));
  for (const x of [-13, 5]) group.add(at(box(1.4, 2.2, 19, silver, .4), x, 89, -5));
  group.add(at(decal(34, 10, (ctx, w, h) => text(ctx, "Canon", w / 2, h / 2, 9, "#eee", 700), {pxPerMM: 8}), -4, 72, 17));
  group.add(at(decal(17, 12, (ctx, w) => { text(ctx, "EOS", w / 2, 4, 4.8); text(ctx, "M50 II", w / 2, 9, 2.8); }, {pxPerMM: 8}), 40, 18, 20.4));
  group.add(at(cyl(29, 29, 4, silver, 64, "z"), -6, 35, 22));
  const lens = new THREE.Group();
  lens.position.set(-6, 35, 23);
  lens.add(at(lathe([[0, 0], [28, 0], [30.4, 3], [30.4, 11], [29.7, 12], [29.7, 25], [27, 27], [26.3, 40], [24.8, 43], [0, 43]], shell, 80), 0, 0, 0, Math.PI / 2));
  for (let i = 0; i < 96; i++) {
    const angle = i * Math.PI * 2 / 96;
    lens.add(at(box(.55, .65, 12, grip, .15, 1), Math.cos(angle) * 29.8, Math.sin(angle) * 29.8, 19, 0, 0, angle));
  }
  for (const z of [4, 11, 27, 39]) lens.add(at(new THREE.Mesh(new THREE.TorusGeometry(z < 27 ? 30 : 26.3, .6, 8, 80), trim), 0, 0, z));
  lens.add(at(ring(17.5, 24.8, black, 80), 0, 0, 43.3));
  lens.add(at(ring(15.5, 17.5, trim, 80), 0, 0, 43.6));
  lens.add(at(cyl(15.5, 15.5, 1.5, std(0x14232d, .13, .62), 80, "z"), 0, 0, 43.8));
  lens.add(at(decal(49, 49, (ctx, w, h) => {
    const glass = ctx.createRadialGradient(w * .44, h * .44, 1, w / 2, h / 2, 15);
    glass.addColorStop(0, "#080b10"); glass.addColorStop(.36, "#131f25"); glass.addColorStop(.59, "#445c63"); glass.addColorStop(.69, "#2b3144"); glass.addColorStop(1, "#090f14");
    ctx.fillStyle = glass; ctx.beginPath(); ctx.arc(w / 2, h / 2, 15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#9bbed55a"; ctx.beginPath(); ctx.ellipse(w * .41, h * .43, 3, 5, -.5, 0, Math.PI * 2); ctx.fill();
    text(ctx, "CANON EF-M", w / 2, 5, 2.4, "#b6b7b9", 400);
    text(ctx, "15–45mm", w / 2, h - 5, 2.6, "#b6b7b9", 400);
  }, {pxPerMM: 8}), 0, 0, 44.7));
  group.add(lens);
  group.add(at(cyl(8, 8, 4, trim, 40), -44, 71, -6));
  group.add(at(cyl(6.4, 6.4, 1.5, black, 40), -44, 73.5, -6));
  group.add(at(cyl(6.3, 7.2, 3, trim, 40), -44, 69, 16));
  group.add(at(cyl(4.6, 4.6, 1, silver, 40), -44, 71, 16));
  group.add(at(cyl(2.5, 2.5, .6, std(0xa12629, .6), 24), -29, 68, 9));
  group.add(at(cyl(3, 3, 2, trim, 24, "z"), 29, 29, 21.5));
  for (const x of [-58, 57]) group.add(at(new THREE.Mesh(new THREE.TorusGeometry(2.7, 1, 8, 16), silver), x, 59, 1, 0, Math.PI / 2));
  const rear = new THREE.Group(); rear.rotation.y = Math.PI; rear.position.z = -20.4;
  rear.add(at(plate(69, 47, 2, 2, trim), -6, 34));
  rear.add(at(plate(58, 38, .5, 1, black), -6, 34, 1.2));
  rear.add(at(plate(25, 17, 5, 5, grip), 3, 75, 2));
  rear.add(at(plate(15, 9, .5, 2, std(0x102026, .2, .4)), 3, 75, 4.8));
  rear.add(at(cyl(8.5, 8.5, 2, trim, 40, "z"), 42, 28, 1));
  rear.add(at(cyl(3.2, 3.2, 2.3, black, 32, "z"), 42, 28, 1.3));
  for (const [x, y] of [[41, 51], [28, 53], [44, 12], [27, 12]]) rear.add(at(cyl(2.8, 2.8, 1.5, trim, 24, "z"), x, y, 1));
  group.add(rear);
  const screen = new THREE.Group(); screen.position.set(42, 34, -24); screen.rotation.y = -.15;
  screen.add(at(cyl(2.4, 2.4, 42, trim, 24), 0, 0, 0));
  const flip = new THREE.Group(); screen.add(flip);
  flip.add(at(box(71, 49, 4.5, shell, 2.5), 36, 0, 0));
  flip.add(at(plate(64, 42, .5, 1.2, std(0x142028, .23, .22)), 36, 0, -2.6));
  flip.add(at(decal(59, 37, (ctx, w, h) => {
    const glow = ctx.createLinearGradient(0, 0, w, h); glow.addColorStop(0, "#27363f"); glow.addColorStop(1, "#111920"); ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
  }), 36, 0, -2.95, 0, Math.PI));
  group.add(screen);
  return {group, view: {yaw: -.55, pitch: .2}, movements: [
    {name: "Screen opening", duration: 10, apply: t => { screen.rotation.y = -Math.PI*t; }},
    {name: "Screen rotation", duration: 10, apply: t => { flip.rotation.x = -Math.PI*t; }},
  ]};
}

/** Four soft rubber feet under a chassis whose underside is at y = 0. */
function feet(group, w, d, inset = 18, r = 6, h = 3) {
  const rubber = std(0x101010, .9);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) group.add(at(cyl(r, r, h, rubber, 20), sx * (w / 2 - inset), -h / 2, sz * (d / 2 - inset)));
}
/** A ¼" or 3.5 mm socket: dark ring with a black hole, facing +z. */
function socket(r, ringMaterial, holeMaterial, depth = 6) {
  const group = new THREE.Group();
  group.add(cyl(r + 1.8, r + 1.8, 1.4, ringMaterial, 32, "z"));
  group.add(at(cyl(r, r, depth, holeMaterial, 24, "z"), 0, 0, -depth / 2 + .85)); // The hole's cap sits just proud of the ring face so the two never z-fight.
  return group;
}
/** XLR/TRS combo socket facing +z: satin ring, black insert with the jack hole and three pin holes. */
function comboSocket(materials) {
  const group = new THREE.Group();
  group.add(cyl(11.8, 11.8, 2.4, materials.satin, 40, "z"));
  group.add(at(cyl(9.8, 9.8, 1.2, materials.insert, 40, "z"), 0, 0, 1.6));
  group.add(at(cyl(3.3, 3.3, 8, materials.hole, 20, "z"), 0, 0, -1.5));
  for (let i = 0; i < 3; i++) {
    const angle = Math.PI / 2 + i * Math.PI * 2 / 3;
    group.add(at(cyl(1.3, 1.3, 4, materials.hole, 12, "z"), Math.cos(angle) * 6.2, Math.sin(angle) * 6.2, .8));
  }
  return group;
}

/** Yamaha HS8 (white). Cabinet 250 × 390 × 334 mm, 8" woofer, 1" dome in a waveguide, rear port and amp plate. */
function buildHS8() {
  const group = new THREE.Group();
  const white = std(0xf2f1ec, .42), cone = std(0xf7f7f3, .62), rubber = std(0x0c0c0d, .88), dark = std(0x1a1a1c, .55);
  const plateMaterial = std(0x141416, .5, .35), metal = std(0x8e9094, .35, .85), dome = std(0x232326, .38, .55);
  const W = 250, H = 390, D = 334, front = D / 2;
  const cabinet = box(W, H, D - 50, white, 4, 4);
  cabinet.position.set(0, H / 2, -25);
  group.add(cabinet);
  const baffle = roundedRect(W, H, 4);
  for (const [y, radius] of [[132, 96], [302, 56]]) { // The recessed drivers need real openings; a solid cabinet face hides the cone and tweeter.
    const opening = new THREE.Path();
    opening.absarc(0, y - H / 2, radius, 0, Math.PI * 2, true);
    baffle.holes.push(opening);
  }
  const baffleGeometry = new THREE.ExtrudeGeometry(baffle, {depth: 50, bevelEnabled: false, curveSegments: 48});
  group.add(at(new THREE.Mesh(baffleGeometry, white), 0, H / 2, front - 50));

  // Woofer: black rubber surround around a white paper cone with a soft dust cap, recessed into the baffle.
  const woofer = new THREE.Group();
  woofer.position.set(0, 132, front);
  woofer.add(at(ring(97, 104, dark), 0, 0, .1));
  woofer.add(at(new THREE.Mesh(new THREE.TorusGeometry(92, 8.5, 16, 64), rubber), 0, 0, -3));
  const coneMesh = lathe([[86, -1], [60, -18], [40, -30], [28, -38], [22, -38], [0, -38]], cone, 64);
  coneMesh.rotation.x = Math.PI / 2;
  woofer.add(coneMesh);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(27, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), cone);
  cap.rotation.x = Math.PI / 2;
  cap.scale.y = .55; // Local y becomes the dome's depth once the hemisphere is turned to face the listener.
  cap.position.z = -37;
  woofer.add(cap);
  group.add(woofer);

  // Tweeter: 1" dome sitting in a shallow white waveguide dish.
  const tweeter = new THREE.Group();
  tweeter.position.set(0, 302, front);
  const guide = lathe([[56, .01], [56, 0], [50, -.8], [40, -4.5], [30, -9], [20, -12.5], [12, -14], [0, -14]], white, 64);
  guide.rotation.x = Math.PI / 2;
  tweeter.add(guide);
  tweeter.add(at(ring(55.5, 58, dark), 0, 0, .1));
  const domeMesh = new THREE.Mesh(new THREE.SphereGeometry(12.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), dome);
  domeMesh.rotation.x = Math.PI / 2;
  domeMesh.scale.y = .6;
  domeMesh.position.z = -13;
  tweeter.add(domeMesh);
  group.add(tweeter);
  for (const [y, radius, count] of [[132, 114, 6], [302, 48, 4]]) {
    for (let i = 0; i < count; i++) {
      const angle = Math.PI / 6 + i * Math.PI * 2 / count;
      group.add(at(cyl(2.4, 2.4, .8, dark, 16, "z"), Math.cos(angle) * radius, y + Math.sin(angle) * radius, front + .6));
    }
  }
  tweeter.add(at(decal(27, 27, (ctx) => { // The HS8 tweeter has a fine silver grille, visible in the front product photograph.
    ctx.fillStyle = "#9fa1a1";
    for (let y = 1; y < 27; y += 1.2) for (let x = 1; x < 27; x += 1.2) {
      if (Math.hypot(x - 13.5, y - 13.5) < 12.3) ctx.fillRect(x, y, .5, .5);
    }
  }, {pxPerMM: 7}), 0, 0, -5));

  // Illuminated Yamaha emblem below the woofer: chrome badge with a white glow.
  group.add(at(cyl(6.5, 6.5, 1, metal, 32, "z"), 0, 22, front + .5));
  group.add(at(cyl(4.8, 4.8, .6, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.6, roughness: .3 }), 32, "z"), 0, 22, front + 1.1));

  // Rear: flared bass-reflex port above the black amplifier plate with its controls, sockets and heat-sink fins.
  const back = -D / 2;
  const port = lathe([[40, 0], [42, 2], [46, 6], [50, 10], [50, 14.5], [46, 16], [40, 14], [38, 10], [36, 4], [34, 0]], dark, 48); // Outer flare up, then back down the inner wall.
  port.rotation.x = -Math.PI / 2;
  port.position.set(0, 287, back - 2);
  group.add(port);
  group.add(at(cyl(34, 34, 62, std(0x050505, 1), 32, "z"), 0, 287, back + 27)); // Its cap sits 1 mm outside the cabinet so the port reads as an opening.
  group.add(at(plate(188, 286, 3, 6, plateMaterial), 0, 193, back - 1));
  for (let i = 0; i < 6; i++) group.add(at(box(2, 232, 8, plateMaterial), -80 + i * 8, 204, back - 6));
  const gain = at(knob(8, 9, dark, std(0xffffff, .5)), 62, 317, back - 2.5, -Math.PI / 2); group.add(gain);
  for (const y of [216, 187]) {
    group.add(at(box(22, 8, 2, dark), 60, y, back - 3.5));
    group.add(at(box(5, 6, 3, std(0xdcdcdc, .5)), 56, y, back - 5));
  }
  group.add(at(comboSocket({ satin: metal, insert: dark, hole: std(0, 1) }), 62, 285, back - 2.5, 0, Math.PI));
  group.add(at(socket(5, metal, std(0, 1)), 62, 255, back - 2.5, 0, Math.PI));
  group.add(at(box(14, 22, 3, dark), -62, 70, back - 3.5));
  group.add(at(box(10, 9, 1.5, std(0xe6e6e6, .5)), -62, 74, back - 5));
  group.add(at(box(28, 20, 3, dark), 0, 46, back - 3.5));
  group.add(at(box(22, 14, 2, std(0x050505, 1)), 0, 46, back - 5));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) group.add(at(cyl(9, 9, 4, rubber, 24), sx * 95, -2, sz * 130));
  return { group, view: { yaw: .55, pitch: .16 }, movements: [{name: "Volume dial", apply: t => { gain.rotation.y = t*1.4; }}] };
}

/** Focusrite Scarlett 18i8 3rd Gen: red anodised shell 241 × 61 × 159.5 mm, black front and rear panels. */
function buildScarlett() {
  const group = new THREE.Group();
  const red = std(0xb1121a, .46, .55), black = std(0x131315, .55), satin = std(0x2b2b2e, .4, .7), insert = std(0x0f0f10, .7);
  const hole = std(0x000000, 1), silver = std(0xc9cacc, .32, .9), white = std(0xf0f0f0, .5), halo = new THREE.MeshStandardMaterial({ color: 0x1a4d22, emissive: 0x3ce65a, emissiveIntensity: 1.1, roughness: .4 });
  const W = 241, H = 61, D = 159.5, front = D / 2;
  const shell = box(W, H, D, red, 5, 4);
  shell.position.y = H / 2;
  group.add(shell);
  group.add(at(plate(W - 8, H - 8, 2.4, 3.5, black), 0, H / 2, front - .8));
  group.add(at(plate(W - 8, H - 8, 2.4, 3.5, black), 0, H / 2, -front + .8));

  // Front: four combo inputs, gain halos and INST/AIR buttons above, then the monitor dial and two headphone outputs.
  const panelZ = front + .5;
  const combos = { satin, insert, hole };
  [-98, -70, -42, -14].forEach((x, i) => {
    group.add(at(comboSocket(combos), x, 17, panelZ));
    group.add(at(ring(7.4, 9.4, halo), x, 44, panelZ + .2));
    group.add(at(knob(6.4, 8, black, white), x, 44, panelZ, Math.PI / 2));
    for (const y of [48, 40]) group.add(at(box(5.5, 3.8, 1.6, std(0xd8d8d8, .5)), x + 13.5, y, panelZ + .8));
  });
  for (const y of [50, 41]) group.add(at(box(6.5, 4, 1.6, std(0xd8d8d8, .5)), 12, y, panelZ + .8));
  const monitorDial = at(knob(17.5, 12, silver, black), 52, 30.5, panelZ, Math.PI / 2); group.add(monitorDial);
  for (const x of [88, 108]) {
    group.add(at(socket(5.5, satin, hole), x, 15, panelZ));
    group.add(at(knob(5.8, 7.5, black, white), x, 43, panelZ, Math.PI / 2));
  }
  group.add(at(decal(W - 8, H - 8, (ctx, w, h) => {
    const cx = w / 2, cy = h / 2;
    for (const [i, x] of [-98, -70, -42, -14].entries()) {
      text(ctx, String(i + 1), cx + x - 11, cy - 13, 3.2, "#f2f2f2", 700);
      text(ctx, i < 2 ? "INST" : "PAD", cx + x + 13.5, cy - 16.5 + 3.6, 1.7, "#e8e8e8", 600);
      text(ctx, "AIR", cx + x + 13.5, cy - 8.5 + 3.6, 1.7, "#e8e8e8", 600);
    }
    text(ctx, "48V", cx + 12, cy - 15.5 + 3.4, 1.7, "#e8e8e8");
    text(ctx, "48V", cx + 12, cy - 6.5 + 3.4, 1.7, "#e8e8e8");
    text(ctx, "MONITOR", cx + 52, cy - 21, 2.2, "#f2f2f2", 700);
    text(ctx, "Scarlett 18i8", cx + 98, cy + 22.5, 3.4, "#f4f4f4", 700, "right");
  }), 0, H / 2, panelZ + .35));
  group.add(at(decal(60, 14, (ctx, w, h) => text(ctx, "Focusrite", w / 2, h / 2, 6.5, "#f6f6f6", 700), { pxPerMM: 6 }), -85, H + .2, 55, -Math.PI / 2));

  // Rear (world +x is the viewer's left when looking at the back): power, USB-C, MIDI, S/PDIF, ADAT, line I/O.
  const rearZ = -front - .5;
  const rear = new THREE.Group();
  rear.rotation.y = Math.PI;
  rear.position.z = rearZ;
  rear.add(at(box(3, 7, 2, hole), -104, 48, 0));
  rear.add(at(socket(4.6, satin, hole), -96, 20, 0));
  rear.add(at(box(11, 18, 2, black), -96, 43, .6));
  rear.add(at(box(8, 7, 1.5, std(0xe4e4e4, .5)), -96, 46, 1.6));
  rear.add(at(plate(9, 3.4, 2, 1.5, hole), -78, 30, .5));
  for (const x of [-58, -38]) rear.add(at(socket(7.4, satin, hole), x, 30, 0));
  for (const [x, colour] of [[-20, 0xe8a63a], [-8, 0x1a1a1a]]) rear.add(at(socket(3.8, std(colour, .45, .4), hole), x, 30, 0));
  rear.add(at(box(9, 9, 2, hole), 8, 30, .6));
  for (const x of [22, 36, 50, 64]) { rear.add(at(socket(5.2, satin, hole), x, 44, 0)); rear.add(at(socket(5.2, satin, hole), x, 16, 0)); }
  rear.add(at(decal(W - 8, H - 8, (ctx, w, h) => {
    const cx = w / 2, cy = h / 2;
    text(ctx, "12V DC", cx - 96, cy - 7, 1.7, "#ddd");
    text(ctx, "USB", cx - 78, cy - 3, 1.7, "#ddd");
    text(ctx, "MIDI IN", cx - 58, cy - 9.5, 1.6, "#ddd");
    text(ctx, "MIDI OUT", cx - 38, cy - 9.5, 1.6, "#ddd");
    text(ctx, "S/PDIF", cx - 14, cy - 8.5, 1.6, "#ddd");
    text(ctx, "OPTICAL IN", cx + 8, cy - 8.5, 1.6, "#ddd");
    text(ctx, "LINE INPUTS 5-8", cx + 43, cy - 21.5, 1.8, "#ddd");
    text(ctx, "LINE OUTPUTS 1-4", cx + 43, cy + 5, 1.8, "#ddd");
  }), 0, H / 2, .3));
  group.add(rear);
  feet(group, W, D, 22, 5, 2.5);
  return { group, view: { yaw: .5, pitch: .3 }, movements: [{name: "Volume dial", apply: t => { monitorDial.rotation.y = -.9 + 1.8*t; }}] };
}

/** Small rounded button; callers stand it on the surface at y = surface + h / 2. */
function button(w, d, h, material) {
  return box(w, h, d, material, Math.min(w, d, h) * .25, 2);
}
/** A fader: dark slot with a raised cap at `t` (0 at the +z end, 1 at the -z end). Lies on +y along z. */
function fader(length, t, slotMaterial, capMaterial, capW = 12, capD = 22) {
  const group = new THREE.Group();
  group.add(at(box(3, .6, length, slotMaterial), 0, .3, 0));
  group.add(at(box(capW, 7, capD, capMaterial, 1.5), 0, 3.5, length / 2 - t * length));
  group.add(at(box(capW - 2, .6, 1.2, std(0xf0f0f0, .5)), 0, 7.2, length / 2 - t * length));
  return group;
}

/** Pioneer DDJ-FLX4: 482 × 59.2 × 272.8 mm two-deck controller with 111.6 mm jog wheels and a central 2-channel mixer. */
function buildFLX4() {
  const group = new THREE.Group(), jogs = [];
  const body = std(0x141415, .58), panel = std(0x111112, .6), rubber = std(0x1f1f21, .82), pad = std(0x2c2c2e, .85);
  const platter = std(0x252527, .58, .15), bronze = std(0x343436, .58, .15), white = std(0xe9e9e9, .5), slot = std(0x050505, .9);
  const led = (colour) => new THREE.MeshStandardMaterial({ color: colour, emissive: colour, emissiveIntensity: 1.4, roughness: .5 });
  const W = 482, H = 48, D = 272.8, top = H;
  const chassis = box(W, H, D, body, 4.5, 4);
  chassis.position.y = H / 2;
  group.add(chassis);
  group.add(at(box(W - 6, .8, D - 6, panel), 0, top - .2, 0));
  const orange = led(0xf79a30); // The official FLX4 gallery shows orange pad outlines and dark jogs, not RGB pad faces or silver platters.

  const knobAt = (x, z, r = 6, h = 9, cap = white) => group.add(at(knob(r, h, rubber, cap), x, top, z));
  const buttonAt = (x, z, w, d, material = rubber, h = 3) => group.add(at(button(w, d, h, material), x, top + h / 2, z));

  for (const side of [-1, 1]) {
    const jx = side * 158, jz = -20;
    const jog = new THREE.Group(); jog.position.set(jx, top, jz); group.add(jog); jogs.push(jog);
    // The official top photo shows a wider sloped grip around the 111.6 mm touch surface; using that diameter for the entire wheel made the model visibly undersized.
    jog.add(at(cyl(61, 68, 9, rubber, 72), 0, 4.5, 0));
    jog.add(at(cyl(55.8, 58, 1.6, platter, 72), 0, 9.8, 0));
    jog.add(at(new THREE.Mesh(new THREE.TorusGeometry(58, 1.1, 10, 72), bronze), 0, 9.9, 0, Math.PI / 2));
    jog.add(at(cyl(24, 24, .8, panel, 64), 0, 11, 0));
    jog.add(at(new THREE.Mesh(new THREE.TorusGeometry(26, .8, 6, 72), std(0x5a5c60, .4, .8)), 0, 10.7, 0, Math.PI / 2));
    for (let i=0;i<16;i++) { const a=i*Math.PI/8; jog.add(at(box(5,1,9,rubber,1),Math.cos(a)*65,3,Math.sin(a)*65,0,-a)); }
    jog.add(at(decal(32,32,(ctx,w,h)=>{ctx.strokeStyle="#85898b";ctx.lineWidth=1;ctx.beginPath();ctx.arc(w/2,h/2,13,0,Math.PI*2);ctx.stroke();text(ctx,"Pioneer DJ",w/2,h/2,3,"#92969a",600);}),0,11.6,0,-Math.PI/2));
    // Performance pads (2 × 4) with the four pad-mode buttons above them and PLAY/CUE to the left.
    const padX0 = jx - 33;
    for (let row = 0; row < 2; row++) for (let col = 0; col < 4; col++) {
      group.add(at(box(18, 3.5, 18, orange, 1.5), padX0 + col * 22, top + 1.75, 84 + row * 24));
      group.add(at(box(15, .3, 15, pad), padX0 + col * 22, top + 3.6, 84 + row * 24));
    }
    for (let col = 0; col < 4; col++) buttonAt(padX0 + col * 22, 64, 18, 6, orange);
    group.add(at(cyl(10.2,10.2,4,rubber,36),jx-62,top+2,103));
    group.add(at(new THREE.Mesh(new THREE.TorusGeometry(10.5,.6,8,40),bronze),jx-62,top+4.1,103,Math.PI/2));
    group.add(at(box(6, .4, 8, led(0x3dff7a)), jx - 62, top + 4.2, 103));
    group.add(at(cyl(10.2,10.2,4,rubber,36),jx-62,top+2,75));
    group.add(at(new THREE.Mesh(new THREE.TorusGeometry(10.5,.6,8,40),bronze),jx-62,top+4.1,75,Math.PI/2));
    group.add(at(box(6, .4, 5, led(0xff9d3d)), jx - 62, top + 4.2, 75));
    buttonAt(jx - 62, 47, 9, 9);
    // Loop buttons, beat sync and the tempo slider beside each jog.
    for (const x of [-61,-36]) group.add(at(cyl(6.8,6.8,3,orange,32),jx+x,top+1.5,-109));
    for (const x of [-11,15,34]) group.add(at(cyl(4.2,4.2,3,rubber,24),jx+x,top+1.5,-109));
    group.add(at(cyl(7,7,3,rubber,32),jx+61,top+1.5,-109));
    group.add(at(decal(13,8,(ctx,w,h)=>text(ctx,"SYNC",w/2,h/2,2.5,"#f3a748")),jx+61,top+3.1,-109,-Math.PI/2));
    group.add(at(fader(65, .5, slot, rubber, 12, 10), jx + 62, top, 84));
  }

  // Mixer: browse encoder and LOAD buttons, master/headphone knobs, two channel strips, meters, faders, crossfader, Beat FX.
  group.add(at(knob(9, 8, rubber, null), 0, top, -110));
  for (const x of [-20, 20]) buttonAt(x, -110, 12, 7);
  knobAt(-46, -84, 6.5); knobAt(-46, -60, 5); knobAt(-46, -36, 5);
  knobAt(46, -84, 5.5); for (const x of [40, 52]) buttonAt(x, -62, 9, 6); buttonAt(46, -42, 14, 7); buttonAt(46, -24, 12, 6);
  for (const x of [-24, 24]) {
    knobAt(x, -84, 5.5); knobAt(x, -60, 6); knobAt(x, -36, 6); knobAt(x, -12, 6);
    knobAt(x, 14, 7, 10, std(0xe07a2a, .5));
    buttonAt(x, 34, 12, 6);
    group.add(at(fader(62, .35, slot, rubber), x, top, 82));
  }
  const meters = [0x3dff7a, 0x3dff7a, 0x3dff7a, 0xffb43d, 0xff4d4d];
  for (const x of [-7, 7]) meters.forEach((colour, i) => group.add(at(box(3, .4, 3, led(colour)), x, top + .3, 88 - i * 8)));
  const cross = at(fader(64, .5, slot, rubber, 22, 12), 0, top, 124, 0, Math.PI / 2); group.add(cross);
  buttonAt(-46, 124, 16, 7); buttonAt(46, 124, 16, 7);

  // Printed panel text; the chassis silkscreen keeps the layout readable once the knobs are on top.
  group.add(at(decal(W - 6, D - 6, (ctx, w, h) => {
    const cx = w / 2, cz = h / 2;
    const label = (x, z, string, size = 2.4, weight = 600) => text(ctx, string, cx + x, cz + z, size, "#cfcfcf", weight);
    for (const side of [-1, 1]) {
      const jx = side * 158;
      ["HOT CUE", "PAD FX", "BEAT JUMP", "SAMPLER"].forEach((name, col) => label(jx - 33 + col * 22, 58, name, 1.8));
      label(jx - 62, 118, "PLAY/PAUSE", 1.6); label(jx - 62, 75, "CUE", 1.8); label(jx - 62, 35, "SHIFT", 1.7);
      ["IN/4BEAT", "OUT", "RELOOP/EXIT"].forEach((name, i) => label(jx + [-66, -46, -26][i], -119, name, 1.5));
      label(jx + 30, -119, "BEAT SYNC", 1.6); label(jx + 58, -119, "MASTER", 1.4); label(jx + 78, -119, "CUE/LOOP", 1.3);
      label(jx + 72, -62, "TEMPO", 1.6);
      label(jx, -95, side < 0 ? "DECK 1" : "DECK 2", 2.2, 700);
    }
    label(0, -122, "BROWSE", 1.7); label(-20, -117, "LOAD", 1.5); label(20, -117, "LOAD", 1.5);
    label(-46, -93, "MASTER LEVEL", 1.5); label(-46, -67, "HEADPHONES", 1.4); label(-46, -43, "MIXING", 1.4);
    label(46, -93, "BEAT FX", 1.9, 700); label(46, -69, "FX SELECT", 1.4); label(46, -50, "ON/OFF", 1.4); label(46, -31, "CH SELECT", 1.3);
    for (const x of [-24, 24]) { label(x, -93, "TRIM", 1.6); label(x, -69, "HI", 1.6); label(x, -45, "MID", 1.6); label(x, -21, "LOW", 1.6); label(x, 4, "CFX", 1.8, 700); }
    label(-46, 116, "SMART FADER", 1.5); label(46, 116, "SMART CFX", 1.5);
    label(-190, -100, "DDJ-FLX4", 4, 700);
    label(190, -100, "Pioneer DJ", 3.4, 700);
  }, { pxPerMM: 2.6 }), 0, top + .4, 0, -Math.PI / 2));

  // Front headphone and mic sockets, rear master RCA pair and the two USB-C ports.
  const satin = std(0x333336, .4, .7), hole = std(0, 1);
  group.add(at(socket(3, satin, hole), -195, 22, D / 2));
  group.add(at(socket(5, satin, hole), -170, 22, D / 2));
  for (const [x, colour] of [[196, 0xe23b3b], [208, 0xf0f0f0]]) group.add(at(socket(3.6, std(colour, .45, .3), hole), x, 24, -D / 2, 0, Math.PI));
  for (const x of [150, 170]) group.add(at(plate(9, 3.4, 2.4, 1.5, hole), x, 24, -D / 2 - .4));
  feet(group, W, D, 26, 8, 3);
  return {group,view:{yaw:.32,pitch:.8},movements:[
    {name:"Jog wheels",apply:t=>{jogs.forEach((jog,i)=>{jog.rotation.y=(i?-1:1)*t*1.5;});}},
    {name:"Crossfader",apply:t=>{for(const cap of cross.children.slice(1))cap.position.z=Math.sin(t*Math.PI*2)*27;}},
  ]};
}

/** AKAI MPK mini Plus: 451 × 52 × 180 mm, 37 mini keys, wheels + joystick, 8 pads, 8 encoders, OLED and transport. */
function buildAkai() {
  const group = new THREE.Group(), keys = [], wheels = [], encoders = [];
  const black = std(0x161617, .6), red = std(0xb5121f, .48), whiteKey = std(0xf3f3ef, .38), blackKey = std(0x111111, .55);
  const rubber = std(0x1d1d1f, .85), white = std(0xededed, .5), glass = std(0x060608, .2, .1);
  const W = 451.1, H = 40, D = 180, top = H, keyZ0 = 4, keyLength = 84;
  // The chassis is a tall rear panel block and a lower front block that the keys rest on, so the keybed reads as a real well.
  group.add(at(box(W - 20, H, D / 2 + keyZ0 + 6, black, 4, 4), 0, H / 2, (-D / 2 + keyZ0 + 6) / 2));
  group.add(at(box(W - 20, H - 14, D / 2 - keyZ0, black, 4, 4), 0, (H - 14) / 2, (keyZ0 + D / 2) / 2));
  for (const side of [-1, 1]) group.add(at(box(11, H, D, red, 4, 4), side * (W / 2 - 5.5), H / 2, 0));

  // Keybed: 22 white keys with 15 black keys from C to C (37 keys).
  const keyPitch = (W - 24) / 22, keyTop = H - 14;
  const names = ["C", "D", "E", "F", "G", "A", "B"];
  for (let i = 0; i < 22; i++) {
    const x = -(W - 24) / 2 + keyPitch * (i + .5);
    const key = new THREE.Group(); key.position.set(x,keyTop+5.5,keyZ0);
    key.add(at(box(keyPitch-1.1,11,keyLength,whiteKey,1.2),0,0,keyLength/2));group.add(key);keys.push(key);
    if (i < 21 && ["F", "G", "A", "C", "D"].includes(names[i % 7])) group.add(at(box(keyPitch * .55, 9, keyLength * .58, blackKey, 1), x + keyPitch / 2, keyTop + 9 + 4.5, keyZ0 + keyLength * .29));
  }

  // The official top view places pads left of the display and encoders; the previous model swapped these sections.
  for (const x of [-201,-171]) {
    group.add(at(box(12,1,44,std(0x050505,1)),x,top+.2,-39));
    const wheel=new THREE.Group();wheel.position.set(x,top-12,-39);group.add(wheel);wheels.push(wheel);
    wheel.add(cyl(19,19,9,rubber,48,"x"));
    for(let i=0;i<24;i++){const a=i*Math.PI/12;wheel.add(at(box(9,1,2,blackKey,.5),0,Math.cos(a)*19,Math.sin(a)*19,a));}
  }
  group.add(at(cyl(11,11,2,rubber,32),-137,top+1,-74));
  group.add(at(cyl(3,3,6,rubber,24),-137,top+5,-74));
  group.add(at(cyl(8.5,10,4,std(0xd4362e,.45),40),-137,top+9,-74));
  const buttonAt=(x,z,w,d)=>group.add(at(button(w,d,2.5,rubber),x,top+1.25,z));
  for(const z of [-47,-33,-19]) for(const x of [-144,-126])buttonAt(x,z,13,7);
  const colours=[0x9144b4,0x28b66b,0x2b93bc,0xb5a536,0x68b239,0xc24766,0xe4a444,0x9236a3];
  for(let row=0;row<2;row++)for(let col=0;col<4;col++){
    const x=-94+35*col,z=-67+36*row;
    group.add(at(box(30,2.9,30,std(colours[row*4+col],.5,0,{emissive:colours[row*4+col],emissiveIntensity:.2}),1.8),x,top+1.45,z));
    group.add(at(box(28.4,1,28.4,rubber,1.4),x,top+3,z));
  }
  group.add(at(box(35,1.2,16,glass),53,top+.6,-74));
  group.add(at(decal(29,10,(ctx,w,h)=>{ctx.fillStyle='#a3bba8';text(ctx,'001  Program',w/2,h*.3,2.3,'#a3bba8');text(ctx,'120.0 BPM',w/2,h*.7,2.4,'#a3bba8');},{pxPerMM:8,emissive:.6}),53,top+1.3,-74,-Math.PI/2));
  group.add(at(knob(8.5,9,rubber,null),86,top,-74));
  for(const z of [-44,-22])for(const x of [47,65,83])buttonAt(x,z,13,8);
  for(let row=0;row<2;row++)for(let col=0;col<4;col++){
    const encoder=at(knob(8,10,rubber,white),117+30*col,top,-74+28*row);group.add(encoder);encoders.push(encoder);
  }
  for(let col=0;col<6;col++)buttonAt(116+18*col,-22,13,8);
  group.add(at(decal(W-22,90,(ctx,w,h)=>{
    const cx=w/2;
    text(ctx,'AKAI',cx-185,9,10,'#f3f3f3',800);text(ctx,'PROFESSIONAL',cx-185,16,3.1,'#ddd');
    text(ctx,'MPK mini plus',cx+195,86,8,'#eee',700,'right');
    for(let row=0;row<2;row++)for(let col=0;col<4;col++)text(ctx,`PAD ${col+1+(row?0:4)}`,cx-105+35*col,14+36*row,2.1,'#d2d2d2',500,'left');
    ['ARP','TEMPO','NOTE REPEAT','FULL LEVEL','OCT –','OCT +'].forEach((name,i)=>text(ctx,name,cx-144+(i%2)*18,43+Math.floor(i/2)*14,1.6,'#e17484'));
    ['<<','>>','STOP','PLAY','REC','SEQ'].forEach((name,i)=>text(ctx,name,cx+116+18*i,68,1.8,i===3?'#5ea470':'#cb929c'));
    for(let col=0;col<4;col++){text(ctx,`K${col+1}`,cx+117+30*col,4,2);text(ctx,`K${col+5}`,cx+117+30*col,32,2);}
  },{pxPerMM:4}),0,top+.3,-45,-Math.PI/2));

  // Rear: USB-B, MIDI in/out, sustain pedal and CV/gate minijacks.
  const satin = std(0x333336, .4, .7), hole = std(0, 1);
  group.add(at(box(12, 11, 3, satin), -150, 28, -D / 2 - .5));
  group.add(at(box(9, 8, 2, hole), -150, 28, -D / 2 - 2));
  for (const x of [-95, -72]) group.add(at(socket(7.5, satin, hole), x, 28, -D / 2, 0, Math.PI));
  group.add(at(socket(5, satin, hole), -30, 28, -D / 2, 0, Math.PI));
  for (let i = 0; i < 5; i++) group.add(at(socket(2.4, satin, hole), 40 + i * 16, 28, -D / 2, 0, Math.PI));
  feet(group, W, D, 24, 6, 2.5);
  return {group,view:{yaw:.42,pitch:.78},movements:[
    {name:"Keys",apply:t=>{keys.forEach((key,i)=>{key.rotation.x=[4,6,8,11].includes(i)?t*.04:0;});}},
    {name:"Pitch wheel",apply:t=>{wheels[0].rotation.x=Math.sin(t*Math.PI*2)*.6;}},
    {name:"Modulation wheel",apply:t=>{wheels[1].rotation.x=t*.9;}},
    {name:"Encoders",apply:t=>{encoders.forEach((encoder,i)=>{encoder.rotation.y=t*(i%2?-1:1)*1.2;});}},
  ]};
}

/** Shure SM7B: black dynamic microphone, thick foam windscreen, rear switch plate and the yoke with its stand nut. */
function buildShure() {
  const group = new THREE.Group(), mic = new THREE.Group();
  const paint = std(0x3b3c3f, .54, .3), band = std(0x242527, .46, .45), dark = std(0x101113, .85), metal = std(0x86898d, .4, .75);
  const pores = canvasTexture(24, 24, (ctx, w, h) => {
    const random = seeded(7345);
    ctx.fillStyle = "#777"; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 4800; i++) { const value = Math.round(45 + random() * 145); ctx.fillStyle = `rgb(${value},${value},${value})`; ctx.fillRect(random() * w, random() * h, .15 + random() * .3, .15 + random() * .3); }
  }, 10);
  pores.wrapS = pores.wrapT = THREE.RepeatWrapping; pores.repeat.set(7, 4);
  const foam = std(0x39393b, .99, 0, {bumpMap: pores, bumpScale: .22});
  // Shure's dimension drawing gives 197.1 mm length, 62.5 mm diameter and 97.4 mm across the thumbscrews.
  mic.add(at(lathe([[0, -98], [26.5, -98], [28.1, -95], [29.3, -53], [31.1, -7], [31.25, 0], [0, 0]], paint, 80), 0, 0, 0, Math.PI / 2));
  for (const z of [-5, 0, 4]) mic.add(at(cyl(31.5, 31.5, 1.2, band, 80, "z"), 0, 0, z));
  mic.add(at(lathe([[0, 3], [31.1, 3], [31.4, 9], [30.5, 52], [29, 91], [27.8, 96], [24, 99.1], [0, 99.1]], foam, 80), 0, 0, 0, Math.PI / 2)); // The standard RK345 has a nearly flat rounded end, not the oversized bulb of the alternate close-talk windscreen.
  const rear = new THREE.Group(); rear.position.z = -98.3; rear.rotation.y = Math.PI;
  rear.add(cyl(25.7, 25.7, .8, dark, 64, "z"));
  rear.add(at(decal(49, 49, (ctx, w, h) => {
    text(ctx, "SHURE", w / 2, 9, 6, "#ececed", 800);
    text(ctx, "SM7B", w / 2, 16, 3.5, "#bfc1c3", 600);
    ctx.strokeStyle = "#c9cbce"; ctx.lineWidth = .7;
    for (const x of [14, 33]) { ctx.strokeRect(x - 5, 25, 10, 12); ctx.beginPath(); ctx.moveTo(x - 4, 39); ctx.lineTo(x + 4, 39); ctx.stroke(); }
  }, {pxPerMM: 8}), 0, 0, .55));
  for (const x of [-9.5, 9.5]) { rear.add(at(box(2.2, 7, 1, std(0x050506, 1)), x, -6.5, .8)); rear.add(at(box(1.8, 2, .7, metal), x, -7.5, 1.4)); }
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; rear.add(at(cyl(1.4, 1.4, .6, metal, 16, "z"), Math.sin(a) * 23, Math.cos(a) * 23, .6)); }
  mic.add(rear);
  group.add(mic);
  // The stamped yoke wraps below the barrel in its pivot plane; the XLR belongs to the fixed bracket, not the microphone's rear cap.
  const profile = new THREE.Shape();
  profile.moveTo(-37, 5); profile.lineTo(-37, -25); profile.quadraticCurveTo(-37, -28, -35, -31); profile.lineTo(-18, -53); profile.quadraticCurveTo(-15, -57, -11, -57);
  profile.lineTo(11, -57); profile.quadraticCurveTo(15, -57, 18, -53); profile.lineTo(35, -31); profile.quadraticCurveTo(37, -28, 37, -25); profile.lineTo(37, 5);
  profile.lineTo(34.4, 5); profile.lineTo(34.4, -25); profile.quadraticCurveTo(34.4, -27, 32.5, -29.5); profile.lineTo(16, -51); profile.quadraticCurveTo(14, -54.4, 10, -54.4);
  profile.lineTo(-10, -54.4); profile.quadraticCurveTo(-14, -54.4, -16, -51); profile.lineTo(-32.5, -29.5); profile.quadraticCurveTo(-34.4, -27, -34.4, -25); profile.lineTo(-34.4, 5); profile.closePath();
  group.add(at(new THREE.Mesh(new THREE.ExtrudeGeometry(profile, {depth: 19, bevelEnabled: true, bevelSize: .5, bevelThickness: .5, bevelSegments: 2, curveSegments: 16}), band), 0, 0, -9.5));
  for (const side of [-1, 1]) {
    group.add(at(cyl(8.4, 8.4, 6, dark, 40, "x"), side * 34, 0, 0));
    group.add(at(cyl(9.5, 9.5, 10.7, band, 48, "x"), side * 43.35, 0, 0));
    for (let i = 0; i < 32; i++) { const a = i * Math.PI * 2 / 32; group.add(at(box(9, .7, .7, dark, .2, 1), side * 43.4, Math.cos(a) * 9.5, Math.sin(a) * 9.5, a)); }
  }
  group.add(at(cyl(10.5, 10.5, 53, band, 40), 0, -83, 0));
  group.add(at(box(20, 18, 31, band, 2), 0, -88, -14));
  group.add(at(cyl(11.5, 11.5, 41, band, 40), 0, -95, -28));
  group.add(at(cyl(9.5, 9.5, 1.4, metal, 40), 0, -116, -28));
  group.add(at(cyl(8, 8, 1.8, dark, 32), 0, -116.8, -28));
  for (const [x, z] of [[-3, -30], [3, -30], [0, -24]]) group.add(at(cyl(.9, .9, 3, metal, 16), x, -117, z));
  group.add(at(cyl(12, 12, 10, dark, 48), 0, -112.9, 0));
  for (let i = 0; i < 32; i++) { const a = i * Math.PI * 2 / 32; group.add(at(box(.8, 8, .8, band, .2, 1), Math.cos(a) * 12, -112.9, Math.sin(a) * 12)); }
  return { group, view: { yaw: -.95, pitch: .2 }, movements: [{name: "Mic tilt", apply: t => { mic.rotation.x = -.2 + t * .65; }}] };
}

/** Mackie Big Knob Passive: grey steel wedge 137 × 79 × 142 mm with the 60 mm silver dial, three buttons and two selectors. */
function buildBigKnob() {
  const group = new THREE.Group();
  const steel = std(0x34363b, .62, .35), silver = std(0xbfc1c5, .34, .83), dark = std(0x121315, .7);
  const W=137,D=142,frontH=22,rearH=74;
  const profile=new THREE.Shape(); profile.moveTo(-D/2,0);profile.lineTo(-D/2,frontH);profile.lineTo(D/2,rearH);profile.lineTo(D/2,0);profile.closePath();
  const shell=new THREE.Mesh(new THREE.ExtrudeGeometry(profile,{depth:W-4,bevelEnabled:true,bevelThickness:2,bevelSize:2,bevelSegments:3}),steel);
  shell.rotation.y=Math.PI/2;shell.position.x=-W/2+2;group.add(shell);
  const surface=new THREE.Group(),slope=Math.atan2(rearH-frontH,D);surface.position.y=(frontH+rearH)/2+2;surface.rotation.x=slope;group.add(surface);
  const dial=new THREE.Group();dial.position.set(0,0,-8);
  dial.add(at(cyl(28,29,15,silver,64),0,7.5,0));
  dial.add(at(cyl(27.7,27.7,.6,silver,64),0,15.3,0));
  dial.add(at(cyl(1.8,1.8,.4,dark,24),0,15.8,21));surface.add(dial);
  for(const x of [-26,0,26]){
    surface.add(at(cyl(6.1,6.1,1.5,silver,32),x,1,x===0?43:35));
    const b=at(cyl(5.3,5.3,3,dark,32),x,2.5,x===0?43:35);surface.add(b);
    surface.add(at(decal(10, 6, (ctx,w,h) => text(ctx, x < 0 ? "MONO" : x > 0 ? "DIM" : "MUTE", w/2, h/2, 2.1), {pxPerMM:12}), x, 4.1, x===0?43:35, -Math.PI/2));
  }
  for(const x of [-51,51]){
    surface.add(at(cyl(6.1,6.1,1.5,silver,32),x,1,43));
    surface.add(at(cyl(5.3,5.3,3,dark,32),x,2.5,43));
  }
  surface.add(at(decal(W-5,D-5,(ctx,w,h)=>{
    const cx=w/2,cz=h/2;ctx.fillStyle='#53616b';for(const x of [-50,50])ctx.fillRect(cx+x-14,cz-21,28,29);
    ctx.fillStyle='#121317';for(let y=5;y<=14;y+=3)for(let x=3;x<w-3;x+=2.8){ctx.beginPath();ctx.arc(x,y,.7,0,Math.PI*2);ctx.fill();}
    text(ctx,'SOURCE',cx-51,cz+48,2.6);text(ctx,'SELECT',cx-51,cz+52,2.6);text(ctx,'MONITOR',cx+51,cz+48,2.6);text(ctx,'SELECT',cx+51,cz+52,2.6);
    text(ctx,'A   B',cx-51,cz+24,2.7);text(ctx,'A   B',cx+51,cz+24,2.7);
    text(ctx,'BIG KNOB',w-8,23,4.3,'#e3e3e6',800,'right');text(ctx,'PASSIVE',w-8,29,2.5,'#c4c6c8',600,'right');
    ctx.strokeStyle='#a6a9ae';ctx.lineWidth=.5;ctx.beginPath();ctx.arc(cx,cz-8,33,.2,Math.PI-.2);ctx.stroke();
  },{pxPerMM:5}),0,.2,0,-Math.PI/2));
  for(const x of [-51,-30,12,33])for(const y of [24,48])group.add(at(socket(5.2,silver,dark),x,y,-D/2-1.5,0,Math.PI));
  group.add(at(socket(2.2,silver,dark),-9,24,-D/2-1.5,0,Math.PI));
  feet(group,W,D,14,5,3);
  return {group,view:{yaw:.35,pitch:.65},movements:[{name:"Volume dial",apply:t=>{dial.rotation.y=-.8+1.6*t;}}]};
}

/** WD Elements Desktop 14 TB: upright black enclosure 48 × 165.8 × 135 mm with the WD wordmark, LED and rear ports. */
function buildDrive() {
  const group = new THREE.Group();
  const shell = std(0x141416, .55), gloss = std(0x0d0d0f, .22, .1), satin = std(0x2c2c2f, .4, .7), hole = std(0, 1);
  const W = 48, H = 165.8, D = 135;
  const body = box(W, H, D, shell, 7, 5);
  body.position.y = H / 2;
  group.add(body);
  group.add(at(plate(W - 14, H - 14, 1, 4, gloss), 0, H / 2, D / 2 - .3));
  group.add(at(decal(W - 14, H - 14, (ctx, w, h) => {
    ctx.strokeStyle = "#f3f3f3"; ctx.lineWidth = .9;
    ctx.beginPath(); ctx.roundRect(w / 2 - 9, h - 40, 18, 9.5, 2.6); ctx.stroke();
    text(ctx, "WD", w / 2, h - 35.4, 5.4, "#f3f3f3", 800);
  }, { pxPerMM: 6 }), 0, H / 2, D / 2 + .25));
  group.add(at(box(2.2, 1.2, .6, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.5 })), 0, 14, D / 2 + .3));
  group.add(at(plate(34,100,1.4,3,hole),0,114,-D/2-.3));
  for(let y=69;y<162;y+=6) group.add(at(box(35,2.5,1.5,shell,.6),0,y,-D/2-1.4));
  for (let i = 0; i < 9; i++) group.add(at(box(W - 20, .8, 2, hole), 0, H + .2, -50 + i * 8));
  group.add(at(plate(12, 4, 2, 1, hole), 0, 26, -D / 2 - .4));
  group.add(at(socket(3.2, satin, hole), 0, 46, -D / 2, 0, Math.PI));
  group.add(at(box(3, 7, 2, hole), 0, 96, -D / 2 - .4));
  feet(group, W, D, 10, 4, 2);
  return { group, view: { yaw: .6, pitch: .22 } };
}

/** Deterministic pseudo-random stream so surface details look identical on every visit. */
function seeded(seed) {
  let state = seed >>> 0;
  return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
}
/** Abstract desktop: dark gradient, translucent menu strip, a couple of window rectangles and a dock of muted tiles. */
function drawDesktop(ctx, w, h, windows, tint = [18, 22, 32]) {
  const background = ctx.createLinearGradient(0, 0, w, h);
  background.addColorStop(0, `rgb(${tint[0] + 8},${tint[1] + 10},${tint[2] + 16})`);
  background.addColorStop(1, `rgb(${tint[0]},${tint[1]},${tint[2]})`);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(255,255,255,.08)";
  ctx.fillRect(0, 0, w, h * .028);
  for (const [x, y, ww, hh] of windows) {
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.beginPath(); ctx.roundRect(x * w + 2, y * h + 3, ww * w, hh * h, 4); ctx.fill();
    ctx.fillStyle = "#1c1f27";
    ctx.beginPath(); ctx.roundRect(x * w, y * h, ww * w, hh * h, 4); ctx.fill();
    ctx.fillStyle = "#2a2e38";
    ctx.beginPath(); ctx.roundRect(x * w, y * h, ww * w, h * .035, [4, 4, 0, 0]); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.07)";
    for (let i = 0; i < 9; i++) ctx.fillRect(x * w + w * .012, y * h + h * .06 + i * h * .045, ww * w * (.35 + ((i * 37) % 50) / 100), h * .012);
  }
  const dockW = w * .34, dockH = h * .075;
  ctx.fillStyle = "rgba(255,255,255,.12)";
  ctx.beginPath(); ctx.roundRect(w / 2 - dockW / 2, h - dockH - h * .02, dockW, dockH, dockH * .3); ctx.fill();
  const tiles = ["#6c7bd6", "#4fa3e0", "#e0b24f", "#5cc98a", "#d66c6c", "#8a8f99", "#b08ad6", "#4fc4c4", "#e08a4f"];
  tiles.forEach((colour, i) => {
    ctx.fillStyle = colour;
    const size = dockH * .66, gap = (dockW - tiles.length * size) / (tiles.length + 1);
    ctx.beginPath(); ctx.roundRect(w / 2 - dockW / 2 + gap + i * (size + gap), h - dockH - h * .02 + dockH * .17, size, size, size * .22); ctx.fill();
  });
}
/** Fit the actual Tahoe wallpaper without stretching it, then draw the MacBook's desktop chrome. */
function drawMacBookDesktop(ctx, w, h, wallpaper) {
  const scale = Math.max(w / wallpaper.width, h / wallpaper.height);
  const width = wallpaper.width * scale, height = wallpaper.height * scale;
  ctx.drawImage(wallpaper, (w - width) / 2, (h - height) / 2, width, height); // Ethan meant Apple's rocks-and-water wallpaper, not generated dry pebbles; do not restore the procedural substitute (task 01a07944-b48e-7e43-8c2f-34b9cfe3df70).
  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgba(255,255,255,.10)";
  ctx.fillRect(0, 0, w, h * .028);
  ctx.fillStyle = "#000";
  ctx.beginPath(); ctx.roundRect(w / 2 - 31, -4, 62, 13.5, [0, 0, 4, 4]); ctx.fill();
  const dockW = w * .36, dockH = h * .08;
  ctx.fillStyle = "rgba(255,255,255,.14)";
  ctx.beginPath(); ctx.roundRect(w / 2 - dockW / 2, h - dockH - h * .02, dockW, dockH, dockH * .3); ctx.fill();
  const tiles = ["#6c7bd6", "#4fa3e0", "#e0b24f", "#5cc98a", "#d66c6c", "#8a8f99", "#b08ad6", "#4fc4c4", "#e08a4f", "#5d6ac9"];
  tiles.forEach((colour, i) => {
    ctx.fillStyle = colour;
    const size = dockH * .68, gap = (dockW - tiles.length * size) / (tiles.length + 1);
    ctx.beginPath(); ctx.roundRect(w / 2 - dockW / 2 + gap + i * (size + gap), h - dockH - h * .02 + dockH * .16, size, size, size * .22); ctx.fill();
  });
}

/** 16-inch MacBook Pro (space black), lid open 105°: 355.7 × 248.1 mm base, 16:10 display with notch, keys and trackpad. */
async function buildMacBook(signal) {
  const response = await fetch(new URL("./assets/macbook-wallpaper.webp?v=__SITE_VERSION__", import.meta.url), { signal });
  if (!response.ok) throw new Error(`Wallpaper download failed (${response.status})`);
  const wallpaper = await createImageBitmap(await response.blob());
  if (signal?.aborted) { wallpaper.close(); signal.throwIfAborted(); }
  const group = new THREE.Group();
  const anodised = std(0x2c2c2f, .46, .72), keycap = std(0x121214, .6), well = std(0x09090a, .75), pad = std(0x202023, .35, .35);
  const glass = std(0x050506, .22, .15), hole = std(0, 1);
  const W = 355.7, D = 248.1, baseH = 9.6, lidH = 6.4;
  group.add(at(box(W, baseH, D, anodised, 3.4, 4), 0, baseH / 2, 0));
  group.add(at(box(279, 1.4, 112, well), 0, baseH - .5, -52));
  // Magic Keyboard: half-height function row, four alphanumeric rows and the bottom row with an inverted-T arrow cluster.
  const unit = 19.05, cap = unit - 1.9, keyH = 1.5;
  const key = (x, z, w, d) => group.add(at(box(w, keyH, d, keycap, .8, 2), x, baseH + keyH / 2 - .1, z));
  const rows = [
    [-101, 7.6, [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]],
    [-87.5, cap, [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5]],
    [-68.5, cap, [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]],
    [-49.5, cap, [1.75, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.75]],
    [-30.5, cap, [2.25, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.25]],
    [-11.5, cap, [1, 1, 1, 1.25, 5, 1.25, 1]],
  ];
  for (const [z, depth, units] of rows) {
    let x = -138.1;
    for (const u of units) { key(x + u * unit / 2, z, u * unit - 1.9, depth); x += u * unit; }
    if (z === -11.5) {
      key(x + unit / 2, z + 4.3, cap, 7.6); key(x + unit * 1.5, z - 4.3, cap, 7.6); key(x + unit * 1.5, z + 4.3, cap, 7.6); key(x + unit * 2.5, z + 4.3, cap, 7.6);
    }
  }
  group.add(at(box(160, .7, 100, pad, .3), 0, baseH, 62));
  for (const side of [-1, 1]) group.add(at(decal(30, 112, (ctx, w, h) => {
    ctx.fillStyle = "rgba(0,0,0,.85)";
    for (let y = 1.2; y < h; y += 1.6) for (let x = 1.2 + (Math.round(y / 1.6) % 2) * .8; x < w; x += 1.6) { ctx.beginPath(); ctx.arc(x, y, .42, 0, Math.PI * 2); ctx.fill(); }
  }, { pxPerMM: 8 }), side * 157, baseH + .25, -52, -Math.PI / 2));
  // Ports: MagSafe, two Thunderbolt and audio on the left; SDXC, Thunderbolt and HDMI on the right.
  group.add(at(box(2, 3.2, 12, hole), -W / 2, 4.6, -92));
  for (const z of [-70, -56]) group.add(at(box(2, 2.8, 8.6, hole), -W / 2, 4.6, z));
  group.add(at(cyl(2, 2, 2, hole, 16, "x"), -W / 2, 4.6, -38));
  group.add(at(box(2, 2, 24, hole), W / 2, 4.6, -90));
  group.add(at(box(2, 2.8, 8.6, hole), W / 2, 4.6, -68));
  group.add(at(box(2, 4.4, 15, hole), W / 2, 4.6, -50));
  // Lid: hinged along the rear edge, opened to 105°. The inner face is black glass carrying the display.
  const lid = new THREE.Group();
  lid.position.set(0, baseH, -D / 2);
  lid.rotation.x = -(Math.PI / 2 + THREE.MathUtils.degToRad(15));
  lid.add(at(box(W, lidH, D, anodised, 3, 4), 0, lidH / 2, D / 2));
  lid.add(at(plate(W - 3, D - 3, .6, 3, glass), 0, -.05, D / 2, Math.PI / 2));
  const screenW = 348.7, screenH = 218;
  lid.add(at(decal(screenW, screenH, (ctx, w, h) => drawMacBookDesktop(ctx, w, h, wallpaper), { pxPerMM: 3, emissive: .9 }), 0, -.5, D - 3.5 - screenH / 2, Math.PI / 2));
  wallpaper.close();
  group.add(lid);
  feet(group, W, D, 22, 5, 1.6);
  return { group, view: { yaw: .5, pitch: .3 }, movements: [{name: "Laptop lid", duration: 12, apply: t => { lid.rotation.x = -THREE.MathUtils.degToRad(105 - 100*t); }}] };
}

/** M4 Mac mini: the verified 2024 silver 127 × 127 × 50 mm enclosure, including front and rear ports. */
function buildMacMini() {
  const group = new THREE.Group();
  const silver = std(0xbfc1c4, .4, .72), black = std(0x111214, .7), hole = std(0x020203, .9), contacts = std(0x616367, .45, .7);
  const shell = new THREE.ExtrudeGeometry(roundedRect(125.4, 125.4, 28), { depth: 42.4, bevelEnabled: true, bevelThickness: .8, bevelSize: .8, bevelSegments: 3, curveSegments: 20 });
  shell.translate(0, 0, -21.2);
  group.add(at(new THREE.Mesh(shell, silver), 0, 28, 0, -Math.PI / 2)); // Round the horizontal corners separately from the shallow lid edge; a rounded cube gives the wrong enclosure.
  group.add(at(plate(108, 108, 6, 24, black), 0, 3, 0, -Math.PI / 2));
  for (const side of [-1, 1]) for (let x = -39; x <= 39; x += 2.5) {
    group.add(at(box(.8, 4.6, .35, contacts), x, 3.4, side * 54.1, 0, 0, -.25));
    group.add(at(box(.35, 4.6, .8, contacts), side * 54.1, 3.4, x, .25));
  }
  const front = new THREE.Group();
  front.position.z = 63.55;
  for (const x of [-37, -22]) {
    front.add(at(plate(2.9, 8.6, .25, 1.4, hole), x, 22));
    front.add(at(plate(.65, 5.7, .3, .3, contacts), x, 22, .2));
  }
  front.add(at(cyl(1.95, 1.95, .35, black, 24, "z"), 36, 22));
  front.add(at(cyl(1.6, 1.6, .4, hole, 24, "z"), 36, 22, .2));
  front.add(at(cyl(.7, .7, .25, std(0xf6f5e9, .4, 0, { emissive: 0xffffff, emissiveIntensity: .8 }), 16, "z"), 24, 22));
  group.add(front);
  const rear = new THREE.Group();
  rear.position.z = -63.55; rear.rotation.y = Math.PI;
  rear.add(at(plate(19.5, 11.8, .35, 5.9, black), -33, 22));
  for (const x of [-37.1, -28.9]) {
    rear.add(at(cyl(3.65, 3.65, .4, hole, 24, "z"), x, 22, .2));
    rear.add(at(cyl(.85, .85, .5, contacts, 16, "z"), x, 22, .45));
  }
  rear.add(at(plate(12.4, 10.7, .3, .8, hole), -11, 22));
  for (let i = 0; i < 8; i++) rear.add(at(box(.55, 3.5, .25, contacts), -14.1 + i * .9, 19.5, .2));
  rear.add(at(plate(14.5, 5.8, .3, 1.7, hole), 8, 22));
  rear.add(at(plate(11.8, .8, .35, .35, contacts), 8, 22, .2));
  for (const x of [22.5, 31, 39.5]) {
    rear.add(at(plate(2.9, 8.6, .3, 1.4, hole), x, 22));
    rear.add(at(plate(.65, 5.7, .35, .3, contacts), x, 22, .2));
  }
  group.add(rear);
  group.add(at(decal(52, 52, (ctx, w, h) => {
    ctx.translate(w / 2 - 30, h / 2 - 30); ctx.scale(2.5, 2.5);
    ctx.fillStyle = "#18191b";
    ctx.fill(new Path2D("M16.9 12.7c0-2 1.6-3 1.7-3.1-1-1.5-2.5-1.7-3.1-1.7-1.3-.1-2.4.8-3.1.8-.6 0-1.6-.8-2.7-.8-1.4 0-2.6.8-3.3 2-1.4 2.4-.4 6.1.9 8 .6.9 1.3 1.9 2.3 1.8.9 0 1.3-.6 2.5-.6s1.6.6 2.6.6c1.1 0 1.7-.9 2.3-1.8.7-1 1-2 1-2.1-.1 0-3.1-1.2-3.1-3.1zM15 6.7c.5-.7.9-1.5.8-2.4-.8 0-1.8.6-2.4 1.3-.5.6-1 1.5-.9 2.3.9.1 1.8-.4 2.5-1.2z")); // Reuse the Apple outline from the canonical desktop's menu icon.
  }, { pxPerMM: 8 }), 0, 50.05, 0, -Math.PI / 2));
  group.add(at(cyl(3.8, 3.8, .3, black, 32), -42, 5.6, -41)); // The M4 power button is underneath, not on the rear panel.
  return { group, view: { yaw: .48, pitch: .38 } };
}

/** Dell S3422DW: 34" 1800R curved 21:9 panel, 808 × 364.5 mm, black bezel and slim silver stand. */
function buildDell() {
  const group = new THREE.Group(), panel = new THREE.Group();
  const black = std(0x151517, .55), rear = std(0xc3c5c7, .52, .15), silver = std(0xb9bbbf, .36, .85);
  const R = 1800, W = 808, H = 364.5, screenW = 797.2, screenH = 333.7, bottomBezel = 22, thickness = 18, lift = 25;
  const half = W / 2 / R, halfScreen = screenW / 2 / R;
  // Body: a curved slab (front arc radius R, the edges nearer the viewer) extruded upward.
  const outline = new THREE.Shape();
  outline.absarc(0, -R, R, Math.PI / 2 + half, Math.PI / 2 - half, true);
  outline.absarc(0, -R, R + thickness, Math.PI / 2 - half, Math.PI / 2 + half, false);
  outline.closePath();
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(outline, { depth: H, bevelEnabled: false, curveSegments: 48 }), black);
  body.rotation.x = -Math.PI / 2;
  body.position.y = lift;
  panel.add(body);
  panel.add(at(box(420, 250, 42, rear, 8, 3), 0, lift + H / 2, -thickness - 18));
  const screenTexture = canvasTexture(screenW, screenH, (ctx, w, h) => drawDesktop(ctx, w, h, [[.03, .07, .55, .84], [.61, .07, .36, .5], [.61, .6, .36, .31]]), 1.6);
  screenTexture.wrapS = THREE.RepeatWrapping;
  screenTexture.repeat.x = -1; // The concave face is rendered from inside the cylinder, which mirrors u.
  const screen = new THREE.Mesh(
    new THREE.CylinderGeometry(R - .6, R - .6, screenH, 64, 1, true, Math.PI - halfScreen, halfScreen * 2),
    new THREE.MeshStandardMaterial({ map: screenTexture, emissive: 0xffffff, emissiveMap: screenTexture, emissiveIntensity: .95, roughness: .28, side: THREE.BackSide }),
  );
  screen.position.set(0, lift + bottomBezel + screenH / 2, R);
  panel.add(screen);
  panel.add(at(decal(30, 10, (ctx, w, h) => {
    ctx.strokeStyle = "#cfcfcf"; ctx.lineWidth = .5;
    ctx.beginPath(); ctx.arc(w / 2, h / 2, 3.6, 0, Math.PI * 2); ctx.stroke();
    text(ctx, "DELL", w / 2, h / 2 + .1, 2.6, "#cfcfcf", 700);
  }, { pxPerMM: 8 }), 0, lift + bottomBezel / 2, .4));
  const neckShape = roundedRect(63, 253, 5), cableHole = roundedRect(25, 50, 11);
  neckShape.holes.push(cableHole);
  group.add(at(new THREE.Mesh(new THREE.ExtrudeGeometry(neckShape,{depth:27,bevelEnabled:true,bevelThickness:1,bevelSize:1,bevelSegments:2}),silver),0,142,-88));
  group.add(at(box(302, 13, 217, silver, 6),0,6.5,-30));
  const height = new THREE.Group(); group.add(height);
  height.add(at(box(44,125,19,silver,3),0,204,-77));
  const hinge = new THREE.Group(); hinge.position.set(0,lift+H/2,-57); height.add(hinge);
  panel.add(at(decal(58,58,(ctx,w,h)=>{ctx.strokeStyle='#777d84';ctx.lineWidth=1;ctx.beginPath();ctx.arc(w/2,h/2,23,0,Math.PI*2);ctx.stroke();text(ctx,'DELL',w/2,h/2,13,'#777d84');},{pxPerMM:3}),0,lift+H/2+64,-thickness-40,0,Math.PI));
  for(let x=-160;x<=160;x+=9)panel.add(at(box(4,1,18,black,1),x,lift+H/2+125,-33));
  hinge.attach(panel);
  return {group,view:{yaw:.42,pitch:.16},movements:[
    {name:"Monitor height",apply:t=>{height.position.y=100*t;}},
    {name:"Monitor tilt",apply:t=>{hinge.rotation.x=-THREE.MathUtils.degToRad(t<.25?-20*t:-5+(t-.25)/.75*26);}},
  ]};
}

/** Samsung S80UA 27" 4K: 615.5 × 368.2 mm flat panel with slim bezels and the thin metal stand. */
function buildSamsung() {
  const group = new THREE.Group(), panel = new THREE.Group();
  const black = std(0x141416, .55), rear = std(0x1c1c1f, .6), metal = std(0x2d2e32, .4, .8);
  const W = 615.5, H = 368.2, screenW = 596.7, screenH = 335.7, bottomBezel = 23, thickness = 16, lift = 63.7;
  panel.add(at(box(W, H, thickness, black, 3, 3), 0, lift + H / 2, -thickness / 2));
  panel.add(at(box(320, 250, 26, rear, 8, 3), 0, lift + H / 2, -thickness - 12));
  panel.add(at(decal(screenW, screenH, (ctx, w, h) => drawDesktop(ctx, w, h, [[.03, .07, .62, .6], [.68, .07, .29, .86], [.03, .7, .62, .23]], [16, 18, 22]), { pxPerMM: 1.8, emissive: .95 }), 0, lift + bottomBezel + screenH / 2, .4));
  panel.add(at(decal(40, 8, (ctx, w, h) => text(ctx, "SAMSUNG", w / 2, h / 2, 3.2, "#9a9a9e", 700), { pxPerMM: 8 }), 0, lift + bottomBezel / 2, .4));
  for(let y=lift+24;y<lift+H-15;y+=5)panel.add(at(box(W-30,1,1.2,rear,1),0,y,-19));
  const turn = new THREE.Group();group.add(turn);
  turn.add(at(box(48,271,22,metal,3),0,146,-55));
  group.add(at(box(255,9,196.4,metal,4),0,4.5,-25));
  const height = new THREE.Group();turn.add(height);
  height.add(at(box(35,140,15,metal,2),0,217,-57));
  const tilt = new THREE.Group();tilt.position.set(0,lift+H/2,-43);height.add(tilt);
  const portrait = new THREE.Group();tilt.add(portrait);portrait.attach(panel);
  return {group,view:{yaw:.45,pitch:.18},movements:[
    {name:"Monitor height",apply:t=>{height.position.y=120*t;}},
    {name:"Monitor tilt",apply:t=>{tilt.rotation.x=-THREE.MathUtils.degToRad(t<.25?-8*t:-2+(t-.25)/.75*27);}},
    {name:"Monitor swivel",apply:t=>{turn.rotation.y=Math.sin(t*Math.PI*2)*Math.PI/6;}},
    {name:"Portrait rotation",duration:12,apply:t=>{height.position.y=120*Math.min(1,t*4);tilt.rotation.x=-.2*Math.min(1,t*4);portrait.rotation.z=-Math.PI/2*Math.max(0,(t-.25)/.75);}}, // Lift and tilt before pivoting so the lower corner cannot hit the base, as Samsung's manual requires.
  ]};
}

/** FlexiSpot E7 Pro (2025), 180 × 80 cm bamboo top on the black C-frame with rear-set three-stage columns. */
function buildDesk() {
  const group = new THREE.Group(), top = new THREE.Group(), middles = [], inners = [];
  const frame = std(0x26272a, .5, .4), black = std(0x111214, .65), trim = std(0x37383c, .5);
  const W = 1800, D = 800, T = 20;
  const bamboo = canvasTexture(W, D, (ctx, w, h) => {
    const random = seeded(1809);
    const strip = 22;
    for (let y = 0; y < h; y += strip) {
      const shade = .9 + random() * .17;
      ctx.fillStyle = `rgb(${Math.round(216 * shade)},${Math.round(184 * shade)},${Math.round(122 * shade)})`;
      ctx.fillRect(0, y, w, strip);
      ctx.fillStyle = "rgba(70,45,15,.22)";
      ctx.fillRect(0, y, w, 1.1);
      for (let x = random() * 220; x < w; x += 180 + random() * 300) { ctx.fillStyle = "rgba(90,60,20,.3)"; ctx.fillRect(x, y, 1.3, strip); }
    }
    ctx.fillStyle = "rgba(120,90,40,.12)";
    for (let i = 0; i < 1400; i++) ctx.fillRect(random() * w, random() * h, 20 + random() * 120, .8);
  }, .6);
  top.position.y = 635;
  top.add(at(box(W, T, D, std(0xffffff, .55, 0, {map: bamboo}), 3, 3), 0, -T/2, 0));
  for (const side of [-1,1]) {
    const x = side * 765, z = -192;
    group.add(at(box(90, 28, 700, frame, 5), x, 22, -50));
    for (const footZ of [-363, 263]) group.add(at(cyl(15, 15, 9, black, 24), x, 5, footZ));
    group.add(at(box(100, 549, 70, frame, 3), x, 310.5, z));
    group.add(at(box(101, 5, 71, trim, 2), x, 584, z));
    const middle = at(box(87, 530, 60, frame, 2.5), x, 330, z); group.add(middle); middles.push(middle);
    const inner = at(box(75, 510, 50, frame, 2), x, 355, z); group.add(inner); inners.push(inner);
    top.add(at(box(85, 14, 545, frame, 3), x, -27, -60));
    top.add(at(box(114, 25, 145, black, 4), x, -51, z));
    for (const railZ of [-300, 160]) top.add(at(cyl(4,4,1,trim,16),x,-19,railZ));
  }
  for (const z of [-217, -157]) {
    top.add(at(box(1550, 49, 35, frame, 2), 0, -49, z));
    top.add(at(box(620, 51, 37, trim, 2), 0, -49, z));
  }
  top.add(at(box(860, 4, 135, frame, 2), 0, -91, -250)); // The 2025 C-frame includes the slim rear cable tray, beneath the telescoping support beam.
  top.add(at(box(860, 32, 4, frame, 2), 0, -77, -317));
  top.add(at(box(198, 28, 63, black, 3), 270, -45, -245));
  const keypad = new THREE.Group(); keypad.position.set(579, -26, 378); keypad.rotation.x = -.18;
  keypad.add(box(126, 17, 38, black, 3));
  keypad.add(at(plate(120, 14, 1, 2, trim), 0, 0, 19.5));
  keypad.add(at(decal(119, 13, (ctx,w,h) => {
    ctx.fillStyle='#060a10';ctx.fillRect(5,2,24,9);
    text(ctx,'▲',43,h/2,4);text(ctx,'▼',56,h/2,4);
    for(let i=0;i<4;i++)text(ctx,String(i+1),72+i*10,h/2,3.5);
  },{pxPerMM:6}),0,0,20.2));
  top.add(keypad); group.add(top);
  return {group,view:{yaw:.52,pitch:.24},movements:[{name:"Desk height",duration:22,apply:t=>{
    top.position.y=635+650*t;
    middles.forEach(part=>{part.position.y=330+325*t;});
    inners.forEach(part=>{part.position.y=355+650*t;});
  }}]};
}

/** Hbada E3 Pro 2026: grey mesh, open frame and the actual independent adjustment axes from Hbada's 2026 specification. */
function buildChair() {
  const group = new THREE.Group();
  const plastic = std(0x9da3aa, .55, .08), alu = std(0xb9bdc1, .35, .8), black = std(0x1b1c1e, .7), armPad = std(0x484c51, .88);
  const weave = canvasTexture(8, 8, (ctx, w, h) => {
    ctx.fillStyle = "#9098a1"; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#454c56"; ctx.lineWidth = .42;
    for (let i = .5; i < 8; i++) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.moveTo(0, i); ctx.lineTo(w, i); ctx.stroke(); }
    ctx.fillStyle = "#151a2060";
    for (let y = .7; y < 8; y++) for (let x = .7; x < 8; x++) ctx.fillRect(x, y, .45, .45);
  }, 12);
  /** A thin woven membrane inside an open moulded frame, bowed across its width and tapered toward its upper edge. */
  function panel(w, h, radius, bow, taper = 0) {
    const part = new THREE.Group(), frameShape = roundedRect(w, h, radius);
    const opening = roundedRect(w - 50, h - 50, Math.max(8, radius - 22)); frameShape.holes.push(opening);
    const frameGeometry = new THREE.ExtrudeGeometry(frameShape, {depth: 24, bevelEnabled: true, bevelSize: 3, bevelThickness: 2, bevelSegments: 2, curveSegments: 16});
    function bend(geometry) {
      const vertices = geometry.attributes.position;
      for (let i = 0; i < vertices.count; i++) {
        const x = vertices.getX(i), y = vertices.getY(i);
        vertices.setX(i, x * (1 - taper * (y / h + .5)));
        vertices.setZ(i, vertices.getZ(i) + bow * (x / (w / 2)) ** 2);
      }
      geometry.computeVertexNormals();
    }
    bend(frameGeometry); part.add(new THREE.Mesh(frameGeometry, plastic));
    const fabricGeometry = new THREE.PlaneGeometry(w - 8, h - 8, 48, 40), vertices = fabricGeometry.attributes.position;
    const halfW = (w - 8) / 2, halfH = (h - 8) / 2, r = radius - 4;
    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i), y = vertices.getY(i), corner = Math.max(0, Math.abs(y) - (halfH - r));
      const widthAtY = halfW - r + Math.sqrt(Math.max(0, r * r - corner * corner));
      vertices.setXYZ(i, x / halfW * widthAtY, y, 30 + 14 * (1 - (x / halfW) ** 2) * (1 - (y / halfH) ** 2));
    }
    bend(fabricGeometry);
    const map = weave.clone(); map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(w / 24, h / 24); map.needsUpdate = true;
    part.add(new THREE.Mesh(fabricGeometry, std(0xffffff, .94, 0, {map, bumpMap: map, bumpScale: .65, side: THREE.DoubleSide})));
    return part;
  }
  // Five tapered metal spokes and twin castors stay on the floor when the gas lift and seat move.
  group.add(at(cyl(42, 49, 46, alu, 48), 0, 69, 0));
  for (let i = 0; i < 5; i++) {
    const spoke = new THREE.Group(); spoke.rotation.y = i * Math.PI * 2 / 5 + .32;
    const shape = new THREE.Shape(); shape.moveTo(20, 84); shape.lineTo(304, 49); shape.lineTo(310, 34); shape.lineTo(20, 54); shape.closePath();
    spoke.add(at(new THREE.Mesh(new THREE.ExtrudeGeometry(shape, {depth: 35, bevelEnabled: true, bevelSize: 2, bevelThickness: 1, bevelSegments: 2}), alu), 0, 0, -17.5));
    spoke.add(at(cyl(9, 9, 25, alu, 20), 309, 39, 0));
    for (const z of [-11, 11]) {
      spoke.add(at(cyl(25, 25, 17, black, 32, "z"), 309, 26, z));
      spoke.add(at(cyl(20, 20, 1, std(0x34383b, .7), 32, "z"), 309, 26, z + Math.sign(z) * 9));
    }
    group.add(spoke);
  }
  group.add(at(cyl(29, 29, 185, black, 40), 0, 185, 0));
  const lift = new THREE.Group(); group.add(lift);
  lift.add(at(cyl(22, 22, 194, alu, 40), 0, 307, 0));
  const swivel = new THREE.Group(); lift.add(swivel);
  swivel.add(at(box(240, 54, 220, black, 15, 4), 0, 409, -15));
  const seat = new THREE.Group(); seat.position.set(0, 416, 0); swivel.add(seat);
  seat.add(at(panel(515, 465, 78, 17, -.035), 0, 0, 0, -Math.PI / 2));
  for (const side of [-1, 1]) seat.add(at(box(28, 27, 150, plastic, 11), side * 244, -18, -70));
  const footrest = new THREE.Group(); footrest.position.set(0, -34, 155); seat.add(footrest);
  for (const x of [-105, 105]) footrest.add(at(box(14, 10, 310, alu, 3), x, -5, -115));
  const footPads = new THREE.Group(); footPads.position.z = 45; footrest.add(footPads);
  for (const side of [-1, 1]) {
    const pad = panel(172, 238, 53, 8, -.06); pad.add(at(plate(172, 238, 8, 53, plastic), 0, 0, -3)); pad.rotation.set(-Math.PI / 2, 0, side * -.12); pad.position.set(side * 90, 0, 58); footPads.add(pad);
  }
  footPads.rotation.x = 3.05;
  const backPivot = new THREE.Group(); backPivot.position.set(0, 449, -205); backPivot.rotation.x = -THREE.MathUtils.degToRad(15); swivel.add(backPivot);
  const backRaise = new THREE.Group(); backPivot.add(backRaise);
  const spineShape = new THREE.Shape();
  spineShape.moveTo(-120, -15); spineShape.quadraticCurveTo(-151, 14, -103, 96); spineShape.quadraticCurveTo(-50, 205, -52, 458);
  spineShape.quadraticCurveTo(-49, 503, 0, 506); spineShape.quadraticCurveTo(49, 503, 52, 458); spineShape.quadraticCurveTo(50, 205, 103, 96); spineShape.quadraticCurveTo(151, 14, 120, -15); spineShape.closePath();
  const window = new THREE.Path(roundedRect(62, 226, 28).getPoints(32).map(point => new THREE.Vector2(point.x, point.y + 355))); // Keep a real opening through the rear spine instead of the old solid upright bar.
  spineShape.holes.push(window);
  backRaise.add(at(new THREE.Mesh(new THREE.ExtrudeGeometry(spineShape, {depth: 24, bevelEnabled: true, bevelSize: 5, bevelThickness: 3, bevelSegments: 3, curveSegments: 24}), plastic), 0, 0, -66));
  for (const side of [-1, 1]) { // The rear photo shows a moulded Y brace joining the spine to the shoulder frame.
    const brace = new THREE.Shape(); brace.moveTo(20, 300); brace.lineTo(22, 422); brace.quadraticCurveTo(80, 522, 188, 550); brace.lineTo(210, 530); brace.quadraticCurveTo(100, 500, 56, 412); brace.lineTo(54, 300); brace.closePath();
    const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(brace, {depth: 22, bevelEnabled: true, bevelSize: 4, bevelThickness: 3, bevelSegments: 3, curveSegments: 20}), plastic);
    mesh.scale.x = side * .88; mesh.position.z = -43; backRaise.add(mesh);
  }
  backRaise.add(at(panel(459, 413, 67, 37, .10), 0, 374, -18));
  backRaise.add(at(decal(38, 14, (ctx,w,h) => text(ctx, "HBADA", w/2, h/2, 6, "#666b72", 700)), 0, 232, -69, 0, Math.PI));
  const lumbar = new THREE.Group(); lumbar.position.set(0, 165, 30); backRaise.add(lumbar);
  lumbar.add(at(box(85, 76, 70, plastic, 15), 0, 0, -23));
  const lumbarAdaptive = new THREE.Group(); lumbar.add(lumbarAdaptive);
  lumbarAdaptive.add(at(panel(282, 188, 58, 12, 0), 0, 0, 24));
  const wings = [];
  for (const side of [-1, 1]) {
    const wing = new THREE.Group(); wing.position.set(side * 129, 2, 25); wing.rotation.y = side * -.18;
    wing.add(at(box(127, 195, 44, std(0x8b929b, .88), 22, 6), side * 51, 0, 15)); lumbarAdaptive.add(wing); wings.push(wing);
  }
  const headSlide = new THREE.Group(); headSlide.position.set(0, 574, -23); backRaise.add(headSlide);
  headSlide.add(at(box(45, 112, 29, plastic, 10), 0, 14, 0));
  const headStem = new THREE.Group(); headStem.position.set(0, 59, 0); headSlide.add(headStem);
  headStem.add(at(cyl(17, 17, 66, alu, 32, "x"), 0, 0, 0));
  headStem.add(at(box(39, 70, 18, plastic, 7), 0, 25, 0));
  const headPad = new THREE.Group(); headPad.position.set(0, 62, 0); headStem.add(headPad);
  headPad.add(at(cyl(13, 13, 83, alu, 32, "x"), 0, 0, 0));
  headPad.add(at(panel(342, 161, 62, 23, 0), 0, 0, 16));
  const arms = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(side * 218, 431, -103); swivel.add(arm);
    const rail = new THREE.CatmullRomCurve3([new THREE.Vector3(0,0,0),new THREE.Vector3(side*39,17,8),new THREE.Vector3(side*61,46,30),new THREE.Vector3(side*61,95,55)]);
    arm.add(new THREE.Mesh(new THREE.TubeGeometry(rail, 18, 11, 10, false), alu));
    const height = new THREE.Group(); height.position.set(side * 61, 95, 55); arm.add(height);
    height.add(at(box(37, 119, 41, plastic, 10), 0, 47, 0));
    const stem = new THREE.Group(); stem.position.set(0, 105, 0); height.add(stem);
    stem.add(at(cyl(15,15,12,alu,32),0,0,0));
    stem.add(at(box(31, 16, 73, alu, 6), 0, 10, 28, -.15));
    const tilt = new THREE.Group(); tilt.position.set(0, 17, 60); stem.add(tilt);
    const slide = new THREE.Group(); tilt.add(slide);
    const pad = new THREE.Group(); slide.add(pad);
    pad.add(at(box(84, 20, 219, armPad, 10, 4), 0, 12, 0));
    pad.add(at(box(67, 7, 138, plastic, 7), 0, 0, 0));
    arms.push({arm, height, stem, tilt, slide, pad});
  }
  const deg = THREE.MathUtils.degToRad;
  return { group, view: {yaw: .58, pitch: .14}, movements: [
    {name: "Recline", duration: 12, apply: t => { backPivot.rotation.x = -deg(15 + 35*t); for (const a of arms) a.arm.rotation.x = -deg(35*t); }},
    {name: "Footrest", apply: t => { footrest.position.z = 155 + 270*t; footPads.rotation.x = 3.05*(1-t); }},
    {name: "Seat height", apply: t => { lift.position.y = 58*t; }}, // Hbada's page conflicts (85 mm vs 18.1–20.4 inches); use the smaller confirmed span and do not claim a certified full stroke.
    {name: "Seat depth", apply: t => { seat.position.z = 50*t; }},
    {name: "Backrest height", apply: t => { backRaise.position.y = 80*t; }},
    {name: "Lumbar height", apply: t => { lumbar.position.y = 165 + 60*t; }},
    {name: "Lumbar depth", apply: t => { lumbar.position.z = 30 + 32*t; }},
    {name: "Lumbar wing angle", apply: t => { wings.forEach((wing,i) => { wing.rotation.y = (i ? -1 : 1)*deg(10 + 40*t); }); }},
    {name: "Adaptive lumbar support", apply: t => { lumbarAdaptive.rotation.x = deg(5*t); lumbarAdaptive.position.y = -30*t; }},
    {name: "Headrest height", apply: t => { headSlide.position.y = 574 + 40*t; }},
    {name: "Headrest depth", apply: t => { headSlide.position.z = -23 + 70*t; }},
    {name: "Headrest stem angle", apply: t => { headStem.rotation.x = deg(70*t); }},
    {name: "Headrest pad angle", apply: t => { headPad.rotation.x = deg(-70*t); }},
    {name: "Armrest height", apply: t => { for (const a of arms) a.height.position.y = 95 + 70*t; }},
    {name: "Armrest slide", apply: t => { for (const a of arms) a.slide.position.z = 60*t; }},
    {name: "Armrest stem swivel", duration: 12, apply: t => { arms.forEach((a,i) => { a.stem.rotation.y = (i ? 1 : -1)*Math.PI*2*t; }); }},
    {name: "Armrest pad rotation", duration: 12, apply: t => { arms.forEach((a,i) => { a.pad.rotation.y = (i ? -1 : 1)*Math.PI*2*t; }); }},
    {name: "Armrest tilt", apply: t => { for (const a of arms) a.tilt.rotation.x = deg(t < .5 ? -26*t*2 : -26 + 39*(t-.5)*2); }},
    {name: "Chair swivel", duration: 12, apply: t => { swivel.rotation.y = Math.sin(t * Math.PI * 2) * .6; }},
  ]};
}
