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
export async function createProductViewer(canvas, productId) {
  const build = builders[productId];
  if (!build) throw new Error(`No 3D model is available for "${productId}".`);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
  const controller = new AbortController();
  const { signal } = controller;
  let frame = 0, lastRender = 0, lastTick = 0, visible = true, dragging = null, autoTurn = true, disposed = false;
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
    const key = new THREE.DirectionalLight(0xfff1e2, 1.75);
    key.position.set(-4, 8, 6);
    scene.add(key);
    const edge = new THREE.DirectionalLight(0xdbe6ff, 1.1);
    edge.position.set(6, 3, -5);
    scene.add(edge);
    const fill = new THREE.DirectionalLight(0xffffff, .8);
    fill.position.set(2, -3, 7);
    scene.add(fill);

    const { group, view } = await build();
    const bounds = new THREE.Box3().setFromObject(group);
    const center = bounds.getCenter(new THREE.Vector3());
    group.position.sub(center); // Rotate about the true centre of the hardware so it never swings out of frame.
    pivot.add(group);
    const radius = boundingRadius(group);
    const pose = { yaw: view.yaw, pitch: view.pitch };
    const shadow = contactShadow(bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z);
    const rotatedBounds = new THREE.Box3();
    scene.add(shadow);

    let width = 0, viewHeight = 0;
    function fit() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return false;
      if (w !== width || h !== viewHeight) {
        width = w; viewHeight = h;
        camera.aspect = w / h;
        const halfVertical = THREE.MathUtils.degToRad(camera.fov / 2);
        const halfHorizontal = Math.atan(Math.tan(halfVertical) * camera.aspect);
        const distance = radius / Math.sin(Math.min(halfVertical, halfHorizontal)) * 1.06; // The whole bounding sphere stays inside the shorter edge at any rotation.
        camera.position.set(0, 0, distance);
        camera.near = Math.max(1, distance - radius * 1.6);
        camera.far = distance + radius * 1.6;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      }
      return true;
    }
    function draw() {
      if (!fit()) return;
      pivot.rotation.set(pose.pitch, pose.yaw, 0, "XYZ"); // Yaw spins the hardware on its own axis first, then pitch tilts the turntable toward the camera.
      shadow.position.y = rotatedBounds.setFromObject(pivot).min.y - radius * .004; // A fixed shadow plane sliced through tilted products; keep it below the current rotation's lowest point.
      shadow.material.opacity = .55 * Math.max(0, 1 - Math.abs(pose.pitch - view.pitch) * 1.4);
      renderer.render(scene, camera);
    }
    function turning() { return autoTurn && visible && !document.hidden && !reduced.matches && !dragging; }
    function loop(now) {
      frame = 0;
      if (disposed) return;
      if (now - lastRender < FRAME_INTERVAL - 1) { frame = requestAnimationFrame(loop); return; }
      if (turning()) {
        pose.yaw += TURN_SPEED * Math.min(now - lastTick, 100) / 1000;
        lastTick = now;
      }
      lastRender = now;
      draw();
      if (turning()) frame = requestAnimationFrame(loop);
    }
    function render() {
      if (disposed || frame) return;
      lastTick = performance.now();
      frame = requestAnimationFrame(loop);
    }
    function stop() { cancelAnimationFrame(frame); frame = 0; }
    function interact() { autoTurn = false; render(); }

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
        autoTurn = false;
      }
      pose.yaw = dragging.yaw + dx * .011;
      pose.pitch = THREE.MathUtils.clamp(dragging.pitch + dy * .008, PITCH_MIN, PITCH_MAX);
      render();
    }, { signal });
    function release(event) {
      if (!dragging || event.pointerId !== dragging.id) return;
      dragging = null; // No inertia: the model stays exactly where the hand left it.
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
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
    reduced.addEventListener("change", render, { signal });
    const resize = new ResizeObserver(() => { width = 0; render(); });
    resize.observe(canvas);
    const intersection = new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting);
      if (visible) render(); else stop();
    });
    intersection.observe(canvas);

    function reset() {
      pose.yaw = view.yaw;
      pose.pitch = view.pitch;
      autoTurn = true;
      render();
    }
    function dispose() {
      if (disposed) return;
      disposed = true;
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
function boundingRadius(group) {
  group.updateMatrixWorld(true);
  const vertex = new THREE.Vector3();
  let radiusSquared = 0;
  group.traverse(object => {
    if (!object.isMesh) return;
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
  rear.add(at(plate(69, 47, 2, 2, trim), 5, 34));
  rear.add(at(plate(58, 38, .5, 1, black), 5, 34, 1.2));
  rear.add(at(plate(25, 17, 5, 5, grip), 3, 75, 2));
  rear.add(at(plate(15, 9, .5, 2, std(0x102026, .2, .4)), 3, 75, 4.8));
  rear.add(at(cyl(8.5, 8.5, 2, trim, 40, "z"), -42, 28, 1));
  rear.add(at(cyl(3.2, 3.2, 2.3, black, 32, "z"), -42, 28, 1.3));
  for (const [x, y] of [[-41, 51], [-28, 53], [-44, 12], [-27, 12]]) rear.add(at(cyl(2.8, 2.8, 1.5, trim, 24, "z"), x, y, 1));
  group.add(rear);
  const screen = new THREE.Group(); screen.position.set(59, 34, -15); screen.rotation.y = -.15;
  screen.add(at(cyl(2.4, 2.4, 42, trim, 24), 0, 0, 0));
  screen.add(at(box(71, 49, 4.5, shell, 2.5), 37, 0, 0));
  screen.add(at(plate(64, 42, .5, 1.2, std(0x142028, .23, .22)), 37, 0, 2.6));
  screen.add(at(decal(59, 37, (ctx, w, h) => {
    const glow = ctx.createLinearGradient(0, 0, w, h); glow.addColorStop(0, "#27363f"); glow.addColorStop(1, "#111920"); ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
  }), 37, 0, 2.95));
  group.add(screen);
  return {group, view: {yaw: -.38, pitch: .22}};
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
  group.add(at(knob(8, 9, dark, std(0xffffff, .5)), 62, 317, back - 2.5, -Math.PI / 2));
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
  return { group, view: { yaw: .55, pitch: .16 } };
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
  group.add(at(knob(17.5, 12, silver, black), 52, 30.5, panelZ, Math.PI / 2));
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
  return { group, view: { yaw: .5, pitch: .3 } };
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
  const group = new THREE.Group();
  const body = std(0x141415, .58), panel = std(0x111112, .6), rubber = std(0x1f1f21, .82), pad = std(0x2c2c2e, .85);
  const platter = std(0x252527, .58, .15), bronze = std(0x343436, .58, .15), white = std(0xe9e9e9, .5), slot = std(0x050505, .9);
  const led = (colour) => new THREE.MeshStandardMaterial({ color: colour, emissive: colour, emissiveIntensity: 1.4, roughness: .5 });
  const W = 482, H = 59.2, D = 272.8, top = H;
  const chassis = box(W, H, D, body, 4.5, 4);
  chassis.position.y = H / 2;
  group.add(chassis);
  group.add(at(box(W - 6, .8, D - 6, panel), 0, top - .2, 0));
  const orange = led(0xf79a30); // The official FLX4 gallery shows orange pad outlines and dark jogs, not RGB pad faces or silver platters.

  const knobAt = (x, z, r = 6, h = 9, cap = white) => group.add(at(knob(r, h, rubber, cap), x, top, z));
  const buttonAt = (x, z, w, d, material = rubber, h = 3) => group.add(at(button(w, d, h, material), x, top + h / 2, z));

  for (const side of [-1, 1]) {
    const jx = side * 150, jz = -20;
    // Jog wheel: dark rubberised rim, matte platter and fine concentric rings.
    group.add(at(cyl(56.5, 57.5, 9, rubber, 72), jx, top + 4.5, jz));
    group.add(at(cyl(54, 54, 1.6, platter, 72), jx, top + 9.8, jz));
    group.add(at(new THREE.Mesh(new THREE.TorusGeometry(55.6, 1.1, 10, 72), bronze), jx, top + 9.9, jz, Math.PI / 2));
    group.add(at(cyl(34, 34, .8, panel, 64), jx, top + 11, jz));
    group.add(at(new THREE.Mesh(new THREE.TorusGeometry(44, .5, 6, 72), std(0x5a5c60, .4, .8)), jx, top + 10.7, jz, Math.PI / 2));
    // Performance pads (2 × 4) with the four pad-mode buttons above them and PLAY/CUE to the left.
    const padX0 = jx - 48;
    for (let row = 0; row < 2; row++) for (let col = 0; col < 4; col++) {
      group.add(at(box(24, 3.5, 18, orange, 1.5), padX0 + col * 28, top + 1.75, 72 + row * 24));
      group.add(at(box(21, .3, 15, pad), padX0 + col * 28, top + 3.6, 72 + row * 24));
    }
    for (let col = 0; col < 4; col++) buttonAt(padX0 + col * 28, 52, 18, 6, orange);
    buttonAt(jx - 84, 100, 22, 22, rubber, 4);
    group.add(at(box(6, .4, 8, led(0x3dff7a)), jx - 84, top + 4.2, 100));
    buttonAt(jx - 84, 70, 22, 16, rubber, 4);
    group.add(at(box(6, .4, 5, led(0xff9d3d)), jx - 84, top + 4.2, 70));
    buttonAt(jx - 84, 124, 16, 6);
    // Loop buttons, beat sync and the tempo slider beside each jog.
    for (const x of [-66, -46, -26]) buttonAt(jx + x, -112, 16, 8, x < -26 ? orange : rubber);
    buttonAt(jx + 30, -112, 22, 8);
    group.add(at(box(8, .4, 4, led(0x3dff7a)), jx + 30, top + 3.2, -112));
    for (const x of [58, 78]) buttonAt(jx + x, -112, 14, 8);
    group.add(at(fader(65, .5, slot, rubber, 12, 10), jx + 72, top, 85));
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
  group.add(at(fader(64, .5, slot, rubber, 22, 12), 0, top, 124, 0, Math.PI / 2));
  buttonAt(-46, 124, 16, 7); buttonAt(46, 124, 16, 7);

  // Printed panel text; the chassis silkscreen keeps the layout readable once the knobs are on top.
  group.add(at(decal(W - 6, D - 6, (ctx, w, h) => {
    const cx = w / 2, cz = h / 2;
    const label = (x, z, string, size = 2.4, weight = 600) => text(ctx, string, cx + x, cz + z, size, "#cfcfcf", weight);
    for (const side of [-1, 1]) {
      const jx = side * 150;
      ["HOT CUE", "PAD FX", "BEAT JUMP", "SAMPLER"].forEach((name, col) => label(jx - 48 + col * 28, 45, name, 1.8));
      label(jx - 84, 111, "PLAY/PAUSE", 1.6); label(jx - 84, 59, "CUE", 1.8); label(jx - 84, 130, "SHIFT", 1.7);
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
  return { group, view: { yaw: .32, pitch: .8 } };
}

/** AKAI MPK mini Plus: 451 × 52 × 180 mm, 37 mini keys, wheels + joystick, 8 pads, 8 encoders, OLED and transport. */
function buildAkai() {
  const group = new THREE.Group();
  const black = std(0x161617, .6), red = std(0xb5121f, .48), whiteKey = std(0xf3f3ef, .38), blackKey = std(0x111111, .55);
  const rubber = std(0x1d1d1f, .85), padMaterial = std(0x7c7c7a, .7), white = std(0xededed, .5), glass = std(0x060608, .2, .1);
  const W = 451.1, H = 52, D = 180, top = H, keyZ0 = -24, keyLength = 108;
  // The chassis is a tall rear panel block and a lower front block that the keys rest on, so the keybed reads as a real well.
  group.add(at(box(W - 20, H, D / 2 + keyZ0 + 6, black, 4, 4), 0, H / 2, (-D / 2 + keyZ0 + 6) / 2));
  group.add(at(box(W - 20, H - 14, D / 2 - keyZ0, black, 4, 4), 0, (H - 14) / 2, (keyZ0 + D / 2) / 2));
  for (const side of [-1, 1]) group.add(at(box(11, H, D, red, 4, 4), side * (W / 2 - 5.5), H / 2, 0));

  // Keybed: 22 white keys with 15 black keys from F to F (37 keys).
  const keyPitch = (W - 24) / 22, keyTop = H - 14;
  const names = ["F", "G", "A", "B", "C", "D", "E"];
  for (let i = 0; i < 22; i++) {
    const x = -(W - 24) / 2 + keyPitch * (i + .5);
    group.add(at(box(keyPitch - 1.1, 11, keyLength, whiteKey, 1.2), x, keyTop + 5.5, keyZ0 + keyLength / 2));
    if (i < 21 && ["F", "G", "A", "C", "D"].includes(names[i % 7])) group.add(at(box(keyPitch * .55, 9, keyLength * .58, blackKey, 1), x + keyPitch / 2, keyTop + 9 + 4.5, keyZ0 + keyLength * .29));
  }

  // Control panel, left to right: pitch/mod wheels, joystick, function buttons, OLED + encoder + transport, pads, encoders.
  for (const x of [-203, -188]) {
    group.add(at(box(12, 1, 44, std(0x050505, 1)), x, top + .2, -58));
    group.add(at(cyl(19, 19, 9, rubber, 48, "x"), x, top - 12, -58));
  }
  group.add(at(cyl(7, 7, 1.2, rubber, 32), -168, top + .6, -76));
  group.add(at(cyl(2.4, 2.4, 11, std(0x2a2a2c, .5)), -168, top + 6, -76));
  group.add(at(new THREE.Mesh(new THREE.SphereGeometry(4.2, 20, 12), rubber), -168, top + 12.5, -76));
  const buttonAt = (x, z, w, d, material = rubber) => group.add(at(button(w, d, 2.6, material), x, top + 1.3, z));
  for (const z of [-82, -69]) for (const x of [-152, -137, -122, -107]) buttonAt(x, z, 12, 8);
  for (const x of [-152, -137, -122, -107]) buttonAt(x, -46, 12, 10, std(0x2a2a2c, .7));
  group.add(at(box(34, 1.2, 18, glass), -74, top + .4, -74));
  group.add(at(decal(30, 14, (ctx, w, h) => {
    ctx.fillStyle = "#5fb3ff";
    for (let i = 0; i < 12; i++) ctx.fillRect(2 + i * 2.3, h - 3 - (3 + ((i * 7) % 8)), 1.4, 3 + ((i * 7) % 8));
    ctx.fillRect(2, 2, 18, 1.4);
  }, { emissive: 1.2, pxPerMM: 8 }), -74, top + 1.1, -74, -Math.PI / 2));
  group.add(at(knob(6, 9, rubber, white), -42, top, -74));
  for (const x of [-84, -68, -52]) buttonAt(x, -46, 13, 9);
  for (let row = 0; row < 2; row++) for (let col = 0; col < 4; col++) group.add(at(box(26, 4, 22, padMaterial, 2), -12 + col * 30, top + 2, -77 + row * 27));
  for (let row = 0; row < 2; row++) for (let col = 0; col < 4; col++) group.add(at(knob(6.5, 9, rubber, white), 112 + col * 28, top, -77 + row * 27));

  group.add(at(decal(W - 22, 62, (ctx, w, h) => {
    const cx = w / 2, cz = h / 2;
    const label = (x, z, string, size = 1.8, weight = 600, colour = "#d2d2d2") => text(ctx, string, cx + x, cz + z, size, colour, weight);
    label(-203, -30, "PITCH", 1.6); label(-188, -30, "MOD", 1.6);
    ["NOTE REPEAT", "FULL LEVEL", "TAP TEMPO", "ARP"].forEach((name, i) => label(-152 + i * 15, -27, name, 1.3));
    ["OCT –", "OCT +", "CHORD", "SCALE"].forEach((name, i) => label(-152 + i * 15, -13, name, 1.3));
    ["STOP", "PLAY", "REC"].forEach((name, i) => label(-84 + i * 16, 5, name, 1.4));
    label(-42, -24, "PUSH TO ENTER", 1.2);
    label(30, -33, "AKAI PROFESSIONAL", 2.2, 700, "#eaeaea");
    label(168, -33, "MPK mini plus", 3, 700, "#f2f2f2");
    for (let col = 0; col < 4; col++) { label(112 + col * 28, -20, `K${col + 1}`, 1.4); label(112 + col * 28, 7, `K${col + 5}`, 1.4); }
  }, { pxPerMM: 3 }), 0, top + .3, -55, -Math.PI / 2));

  // Rear: USB-B, MIDI in/out, sustain pedal and CV/gate minijacks.
  const satin = std(0x333336, .4, .7), hole = std(0, 1);
  group.add(at(box(12, 11, 3, satin), -150, 28, -D / 2 - .5));
  group.add(at(box(9, 8, 2, hole), -150, 28, -D / 2 - 2));
  for (const x of [-95, -72]) group.add(at(socket(7.5, satin, hole), x, 28, -D / 2, 0, Math.PI));
  group.add(at(socket(5, satin, hole), -30, 28, -D / 2, 0, Math.PI));
  for (let i = 0; i < 5; i++) group.add(at(socket(2.4, satin, hole), 40 + i * 16, 28, -D / 2, 0, Math.PI));
  feet(group, W, D, 24, 6, 2.5);
  return { group, view: { yaw: .42, pitch: .78 } };
}

/** Shure SM7B: black dynamic microphone, thick foam windscreen, rear switch plate and the yoke with its stand nut. */
function buildShure() {
  const group = new THREE.Group();
  const paint = std(0x1b1b1d, .5, .25), foam = std(0x121212, 1), grille = std(0x3b3b3e, .55, .6), yoke = std(0x222225, .38, .65);
  const dark = std(0x0d0d0e, .8), metal = std(0x9c9ea2, .35, .9);
  // Body along z; +z is the front (windscreen). Overall length ≈ 197 mm including the yoke.
  group.add(at(cyl(31, 31, 92, paint, 64, "z"), 0, 0, -12));
  group.add(at(new THREE.Mesh(new THREE.TorusGeometry(31, 1.2, 8, 64), paint), 0, 0, 30));
  group.add(at(cyl(32, 32, 26, grille, 64, "z"), 0, 0, 44));
  const cap = lathe([[0, -19.5], [11, -19.5], [16, -19], [22, -17], [27, -12], [30, -6], [31, 0]], paint, 64);
  cap.rotation.x = Math.PI / 2;
  cap.position.z = -58;
  group.add(cap);
  group.add(at(plate(24, 16, 1.4, 2, dark), 0, 4, -77, -.25));
  group.add(at(cyl(10.5, 10.5, 10, metal, 32, "z"), 0, -12, -82));
  group.add(at(cyl(9.2, 9.2, 4, dark, 32, "z"), 0, -12, -87));
  // Windscreen: fat foam cylinder with a rounded nose, sitting over the grille.
  const screen = lathe([[0, -72], [32, -72], [39, -68], [41, -60], [41, -18], [39, -8], [34, -2], [24, 0], [0, 0]], foam, 64);
  screen.rotation.x = Math.PI / 2;
  screen.position.z = 97;
  group.add(screen);
  // Yoke: two flat arms from the side pivots sweep down and back to a crossbar carrying the captive stand nut.
  for (const side of [-1, 1]) {
    group.add(at(cyl(9, 9, 4.5, yoke, 32, "x"), side * 34, 0, -8));
    group.add(at(cyl(6.5, 6.5, 6, metal, 24, "x"), side * 38.5, 0, -8));
    group.add(at(box(3, 12, 68, yoke, 1), side * 36.5, -22, -34, Math.atan2(.65, -.77))); // From the side pivot down and back to the crossbar.
  }
  group.add(at(box(78, 12, 10, yoke, 1.5), 0, -44, -60));
  group.add(at(cyl(9, 9, 16, metal, 32), 0, -55, -60));
  group.add(at(cyl(6, 6, 6, dark, 24), 0, -66, -60));
  return { group, view: { yaw: .78, pitch: .22 } };
}

/** Mackie Big Knob Passive: grey steel wedge 137 × 79 × 142 mm with the 60 mm silver dial, three buttons and two selectors. */
function buildBigKnob() {
  const group = new THREE.Group();
  const steel = std(0x4a4d53, .52, .45), face = std(0x3a3c42, .5, .4), silver = std(0xd2d3d5, .28, .9), dark = std(0x111113, .7);
  const W = 137, D = 142, frontH = 24, rearH = 62;
  // Wedge chassis: shape drawn in (−z, y), extruded along x.
  const profile = new THREE.Shape();
  profile.moveTo(-D / 2, 0); profile.lineTo(-D / 2, frontH); profile.lineTo(D / 2, rearH); profile.lineTo(D / 2, 0); profile.closePath();
  const chassis = new THREE.Mesh(new THREE.ExtrudeGeometry(profile, { depth: W, bevelEnabled: true, bevelThickness: 1.5, bevelSize: 1.5, bevelSegments: 3 }), steel);
  chassis.rotation.y = Math.PI / 2;
  chassis.position.x = -W / 2;
  group.add(chassis);
  const slope = Math.atan2(rearH - frontH, D);
  const yAt = (z) => frontH + (D / 2 - z) / D * (rearH - frontH);
  // Face controls sit normal to the slope: big dial forward, MONO/MUTE/DIM row, then input and monitor selectors.
  const surface = new THREE.Group();
  surface.position.set(0, yAt(0), 0);
  surface.rotation.x = slope;
  const onSlope = (object, x, z, lift = 0) => { object.position.set(x, lift, z / Math.cos(slope)); surface.add(object); };
  onSlope(knob(30, 15, silver, dark), 0, 16);
  for (const x of [-32, 0, 32]) onSlope(cyl(5.5, 5.5, 3, dark, 32), x, -32, 1.5);
  for (const x of [-30, 30]) onSlope(at(box(14, 3, 7, dark, 1), 0, 1.5, 0), x, -53);
  onSlope(decal(W - 8, D - 4, (ctx, w, h) => {
    const cx = w / 2, cz = h / 2;
    ["MONO", "MUTE", "DIM"].forEach((name, i) => text(ctx, name, cx + (i - 1) * 32, cz - 24, 3, "#e6e6e6", 700));
    text(ctx, "INPUT A / B", cx - 30, cz - 46, 2.4, "#e6e6e6", 600);
    text(ctx, "MONITOR A / B", cx + 30, cz - 46, 2.4, "#e6e6e6", 600);
    text(ctx, "BIG KNOB PASSIVE", cx - 50, cz + 60, 3.2, "#f2f2f2", 800, "left");
    text(ctx, "MACKIE.", cx + 52, cz + 60, 3.6, "#f2f2f2", 800, "right");
  }, { pxPerMM: 4 }), 0, 0, 2); // The bevel expands the wedge face; its printed labels must sit above that surface.
  surface.children.at(-1).rotation.x = -Math.PI / 2;
  group.add(surface);
  // Rear: four TRS inputs, four TRS monitor outputs and the 3.5 mm input B jack.
  const satin = std(0x2c2c2f, .4, .7), hole = std(0, 1);
  for (const x of [-52, -36, -20, -4]) {
    group.add(at(socket(5, satin, hole), x, 46, -D / 2, 0, Math.PI));
    group.add(at(socket(5, satin, hole), x, 20, -D / 2, 0, Math.PI));
  }
  group.add(at(socket(2.4, satin, hole), 30, 46, -D / 2, 0, Math.PI));
  group.add(at(plate(W - 6, rearH - 6, 1, 3, face), 0, rearH / 2, -D / 2 - .4));
  feet(group, W, D, 14, 5, 2.5);
  return { group, view: { yaw: .48, pitch: .42 } };
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
  for (let i = 0; i < 9; i++) group.add(at(box(W - 20, .8, 2, hole), 0, H + .2, -50 + i * 8));
  group.add(at(plate(8.5, 4, 2, 1, hole), 0, 26, -D / 2 - .4));
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
  const scale = Math.max(w / wallpaper.naturalWidth, h / wallpaper.naturalHeight);
  const width = wallpaper.naturalWidth * scale, height = wallpaper.naturalHeight * scale;
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
async function buildMacBook() {
  const wallpaper = await new THREE.ImageLoader().loadAsync(new URL("./assets/macbook-wallpaper.webp?v=__SITE_VERSION__", import.meta.url).href);
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
  group.add(lid);
  feet(group, W, D, 22, 5, 1.6);
  return { group, view: { yaw: .5, pitch: .3 } };
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
  const group = new THREE.Group();
  const black = std(0x151517, .55), rear = std(0x1b1b1e, .6), silver = std(0xb9bbbf, .36, .85);
  const R = 1800, W = 808, H = 364.5, screenW = 797.2, screenH = 333.7, bottomBezel = 22, thickness = 18, lift = 110;
  const half = W / 2 / R, halfScreen = screenW / 2 / R;
  // Body: a curved slab (front arc radius R, the edges nearer the viewer) extruded upward.
  const outline = new THREE.Shape();
  outline.absarc(0, -R, R, Math.PI / 2 + half, Math.PI / 2 - half, true);
  outline.absarc(0, -R, R + thickness, Math.PI / 2 - half, Math.PI / 2 + half, false);
  outline.closePath();
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(outline, { depth: H, bevelEnabled: false, curveSegments: 48 }), black);
  body.rotation.x = -Math.PI / 2;
  body.position.y = lift;
  group.add(body);
  group.add(at(box(420, 250, 42, rear, 8, 3), 0, lift + H / 2, -thickness - 18));
  const screenTexture = canvasTexture(screenW, screenH, (ctx, w, h) => drawDesktop(ctx, w, h, [[.03, .07, .55, .84], [.61, .07, .36, .5], [.61, .6, .36, .31]]), 1.6);
  screenTexture.wrapS = THREE.RepeatWrapping;
  screenTexture.repeat.x = -1; // The concave face is rendered from inside the cylinder, which mirrors u.
  const screen = new THREE.Mesh(
    new THREE.CylinderGeometry(R - .6, R - .6, screenH, 64, 1, true, Math.PI - halfScreen, halfScreen * 2),
    new THREE.MeshStandardMaterial({ map: screenTexture, emissive: 0xffffff, emissiveMap: screenTexture, emissiveIntensity: .95, roughness: .28, side: THREE.BackSide }),
  );
  screen.position.set(0, lift + bottomBezel + screenH / 2, R);
  group.add(screen);
  group.add(at(decal(30, 10, (ctx, w, h) => {
    ctx.strokeStyle = "#cfcfcf"; ctx.lineWidth = .5;
    ctx.beginPath(); ctx.arc(w / 2, h / 2, 3.6, 0, Math.PI * 2); ctx.stroke();
    text(ctx, "DELL", w / 2, h / 2 + .1, 2.6, "#cfcfcf", 700);
  }, { pxPerMM: 8 }), 0, lift + bottomBezel / 2, .4));
  group.add(at(box(60, 300, 26, silver, 4), 0, 12 + 150, -thickness - 39 - 13));
  group.add(at(box(300, 12, 220, silver, 5), 0, 6, -30));
  return { group, view: { yaw: .42, pitch: .16 } };
}

/** Samsung S80UA 27" 4K: 615.5 × 368.2 mm flat panel with slim bezels and the thin metal stand. */
function buildSamsung() {
  const group = new THREE.Group();
  const black = std(0x141416, .55), rear = std(0x1c1c1f, .6), metal = std(0x2d2e32, .4, .8);
  const W = 615.5, H = 368.2, screenW = 596.7, screenH = 335.7, bottomBezel = 23, thickness = 16, lift = 150;
  group.add(at(box(W, H, thickness, black, 3, 3), 0, lift + H / 2, -thickness / 2));
  group.add(at(box(320, 250, 26, rear, 8, 3), 0, lift + H / 2, -thickness - 12));
  group.add(at(decal(screenW, screenH, (ctx, w, h) => drawDesktop(ctx, w, h, [[.03, .07, .62, .6], [.68, .07, .29, .86], [.03, .7, .62, .23]], [16, 18, 22]), { pxPerMM: 1.8, emissive: .95 }), 0, lift + bottomBezel + screenH / 2, .4));
  group.add(at(decal(40, 8, (ctx, w, h) => text(ctx, "SAMSUNG", w / 2, h / 2, 3.2, "#9a9a9e", 700), { pxPerMM: 8 }), 0, lift + bottomBezel / 2, .4));
  group.add(at(box(48, 250, 18, metal, 3), 0, 8 + 125, -thickness - 24 - 9));
  group.add(at(box(255, 8, 190, metal, 4), 0, 4, -25));
  return { group, view: { yaw: .45, pitch: .18 } };
}

/** FlexiSpot E7 Pro (2025), 180 × 80 cm bamboo top on the black C-frame with rear-set three-stage columns. */
function buildDesk() {
  const group = new THREE.Group();
  const frame = std(0x1c1c1e, .5, .35), black = std(0x111112, .5);
  const W = 1800, D = 800, T = 20, height = 720;
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
  group.add(at(box(W, T, D, std(0xffffff, .55, 0, { map: bamboo }), 3, 3), 0, height - T / 2, 0));
  for (const side of [-1, 1]) {
    const x = side * (W / 2 - 120);
    group.add(at(box(90, 30, 660, frame, 4), x, 15, -60));
    for (const z of [-370, 250]) group.add(at(cyl(14, 14, 6, black, 20), x, -3, z));
    group.add(at(box(110, 300, 80, frame, 3), x, 180, -250));
    group.add(at(box(98, 280, 70, frame, 3), x, 430, -250));
    group.add(at(box(86, 170, 62, frame, 3), x, 615, -250));
    group.add(at(box(100, 14, 520, frame, 3), x, height - T - 7, -60));
  }
  group.add(at(box(W - 400, 60, 80, frame, 3), 0, height - T - 38, -250));
  group.add(at(box(W - 700, 50, 70, frame, 3), 0, height - T - 38, -250));
  group.add(at(box(90, 12, 42, black, 2), 560, height - T - 6, D / 2 - 32));
  return { group, view: { yaw: .55, pitch: .32 } };
}

/** Hbada E3 Pro 2026 (grey, with footrest): mesh seat and curved back, lumbar wings, headrest, 4D arms, five-spoke base. */
function buildChair() {
  const group = new THREE.Group();
  const plastic = std(0xc6c9ce, .52), alu = std(0xc0c2c6, .3, .9), black = std(0x1a1a1c, .6), armPad = std(0x3b3d42, .85);
  /** Woven grey mesh tile repeated to the part size, so the seat and back read as fabric instead of flat plastic. */
  const fabric = (w, h, opacity = 1) => {
    const map = canvasTexture(20, 20, (ctx, tw, th) => {
      ctx.fillStyle = "#7a8291"; ctx.fillRect(0, 0, tw, th);
      ctx.strokeStyle = "rgba(15,18,26,.6)"; ctx.lineWidth = .55;
      for (let i = 0; i <= tw; i += 2) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, th); ctx.moveTo(0, i); ctx.lineTo(tw, i); ctx.stroke(); }
      ctx.fillStyle = "rgba(255,255,255,.14)";
      for (let y = 1; y < th; y += 2) for (let x = 1; x < tw; x += 2) ctx.fillRect(x - .45, y - .45, .9, .9);
    }, 10);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(w / 20, h / 20);
    return std(0xffffff, .92, 0, { map, transparent: opacity < 1, opacity, side: opacity < 1 ? THREE.DoubleSide : THREE.FrontSide });
  };
  // Five-spoke polished base with twin-wheel castors, gas lift and the tilt mechanism.
  group.add(at(cyl(46, 52, 40, alu, 48), 0, 62, 0));
  for (let i = 0; i < 5; i++) {
    const spoke = new THREE.Group();
    spoke.rotation.y = i * Math.PI * 2 / 5 + Math.PI / 2;
    spoke.add(at(box(300, 18, 56, alu, 5), 160, 62, 0, 0, 0, -.13));
    spoke.add(at(box(18, 28, 30, black, 4), 322, 44, 0));
    for (const z of [-8, 8]) spoke.add(at(cyl(30, 30, 12, black, 32, "z"), 322, 30, z));
    group.add(spoke);
  }
  group.add(at(cyl(24, 24, 250, alu, 32), 0, 205, 0));
  group.add(at(cyl(31, 31, 120, black, 32), 0, 140, 0));
  group.add(at(box(260, 55, 240, black, 6), 0, 357, 0));
  /** Round the panel outline in its face plane, then curve it to follow the chair's mesh and lumbar supports. */
  function curvedPanel(w, h, depth, material, radius, curve = 0) {
    const geometry = new THREE.ExtrudeGeometry(roundedRect(w, h, radius), {depth, bevelEnabled: true, bevelThickness: 2, bevelSize: 2, bevelSegments: 3, curveSegments: 16, steps: 10});
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      geometry.attributes.uv.setXY(i, positions.getX(i) / w + .5, positions.getY(i) / h + .5); // Extruded shapes use millimetre UVs; normalise them before repeating the woven texture.
      positions.setZ(i, positions.getZ(i) + curve * (positions.getX(i) / (w / 2)) ** 2);
    }
    geometry.computeVertexNormals();
    return new THREE.Mesh(geometry, material);
  }
  // Broad rounded mesh surfaces and curved arm supports match the photographed E3 rather than a square office chair.
  group.add(at(curvedPanel(520, 475, 22, plastic, 75, 15), 0, 396, 0, -Math.PI / 2));
  group.add(at(curvedPanel(503, 456, 18, fabric(503, 456), 70, 15), 0, 420, 0, -Math.PI / 2));
  for (const x of [-110, 110]) group.add(at(box(20, 14, 330, alu, 4), x, 395, 395));
  for (const x of [-90, 90]) group.add(at(curvedPanel(175, 225, 24, plastic, 44, 0), x, 407, 455, -Math.PI / 2));
  for (const side of [-1, 1]) {
    const rail = new THREE.CatmullRomCurve3([new THREE.Vector3(side * 188, 380, -95), new THREE.Vector3(side * 260, 430, -90), new THREE.Vector3(side * 279, 510, -65), new THREE.Vector3(side * 279, 640, -45)]);
    group.add(new THREE.Mesh(new THREE.TubeGeometry(rail, 24, 17, 10, false), alu));
    group.add(at(box(46, 112, 52, plastic, 12), side * 279, 590, -45));
    group.add(at(box(95, 26, 235, armPad, 12), side * 279, 660, 4)); // The arm pads run front-to-back; sideways pads made the model much wider than the actual chair.
  }
  const back = new THREE.Group();
  back.position.set(0, 415, -205);
  back.rotation.x = -.14;
  back.add(at(box(65, 470, 45, plastic, 15), 0, 290, -25));
  back.add(at(curvedPanel(470, 440, 20, plastic, 65, 38), 0, 430, -12));
  back.add(at(curvedPanel(442, 416, 10, fabric(442, 416), 58, 38), 0, 430, 11));
  back.add(at(curvedPanel(290, 165, 35, fabric(290, 165), 48, 12), 0, 183, 75));
  for (const side of [-1, 1]) back.add(at(curvedPanel(130, 200, 24, plastic, 44, 12), side * 205, 222, 66, 0, side * -.42, side * -.17));
  back.add(at(box(42, 120, 24, plastic, 9), 0, 681, -8));
  back.add(at(curvedPanel(354, 164, 50, fabric(354, 164), 60, 16), 0, 738, 15));
  group.add(back);
  return { group, view: { yaw: .6, pitch: .18 } };
}
