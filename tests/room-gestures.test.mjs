import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import * as THREE from '../docs/lib/three.module.min.js';

/** Run the room's real camera and pointer handlers without a browser or native input. */
function room(viewportWidth = 390, viewportHeight = 844) {
  class Element {
    handlers = new Map();
    captured = new Set();
    classes = new Set();
    style = {};
    clientWidth = viewportWidth;
    clientHeight = viewportHeight;
    classList = {
      add: name => this.classes.add(name), remove: name => this.classes.delete(name),
      toggle: (name, active) => active ? this.classes.add(name) : this.classes.delete(name),
    };
    addEventListener(type, callback) {
      const callbacks = this.handlers.get(type) || [];
      callbacks.push(callback); this.handlers.set(type, callbacks);
    }
    fire(type, values = {}) {
      const event = { target: this, button: 0, buttons: 1, pointerType: 'touch', pointerId: 1,
        clientX: 100, clientY: 400, detail: 1, defaultPrevented: false,
        preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}, ...values };
      for (const callback of this.handlers.get(type) || []) callback(event);
      return event;
    }
    closest() { return null; }
    getBoundingClientRect() { return { left: 0, top: 0 }; }
    hasPointerCapture(id) { return this.captured.has(id); }
    setPointerCapture(id) { this.captured.add(id); }
    releasePointerCapture(id) { this.captured.delete(id); this.fire('lostpointercapture', { pointerId: id }); }
    setAttribute() {}
    focus() {}
  }
  const stage = new Element(), canvas = new Element(), window = new Element(), document = new Element();
  const controls = new Map();
  document.hidden = false;
  document.querySelector = selector => {
    if (!controls.has(selector)) controls.set(selector, new Element());
    return controls.get(selector);
  };
  document.querySelectorAll = () => [];
  const callbacks = new Map();
  let frameID = 0, time = 0;
  const source = readFileSync(new URL('../docs/beta.mjs', import.meta.url), 'utf8');
  const cameraCode = source.slice(source.indexOf('const view ='), source.indexOf('async function createRoom()'));
  const gestureCode = source.slice(source.indexOf('stage.addEventListener("wheel"'), source.indexOf('const topics ='));
  const context = {
    THREE, stage, canvas, window, document, detail: { open: false }, directory: { open: false },
    reduced: { matches: true }, hotspots: [], hotspotWidths: new Map(),
    performance: { now: () => time },
    requestAnimationFrame: callback => { callbacks.set(++frameID, callback); return frameID; },
    cancelAnimationFrame: id => callbacks.delete(id),
  };
  runInNewContext(`${cameraCode}\n${gestureCode}\n
    width = ${viewportWidth}; height = ${viewportHeight};
    renderer = { render() {} }; camera = new THREE.PerspectiveCamera(45, width / height, .1, 100);
    Object.assign(view, { zoom: .5, panX: 2, panY: 0 }); Object.assign(target, view);
    draw();
    api = { view, target, camera, pointers: roomPointers, cancelRoomGesture };
  `, context);
  const { api } = context;
  return { ...api, stage, canvas, window, document, controls, Element,
    flush() { time += 16; const work = [...callbacks.values()]; callbacks.clear(); work.forEach(callback => callback(time)); },
    pointAt(x, y) {
      const scale = 2 * api.camera.position.z * Math.tan(Math.PI / 8) / viewportHeight;
      return [api.camera.position.x + (x - viewportWidth / 2) * scale, api.camera.position.y - (y - viewportHeight / 2) * scale];
    },
  };
}

function closePoint(actual, expected) {
  actual.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < .00001, `Photo point moved: ${actual} vs ${expected}`));
}

for (const [w, hgt] of [[390, 844], [320, 740], [844, 390]]) test(`pinch stays anchored at ${w} by ${hgt}`, () => {
  const h = room(w, hgt);
  const midX = w / 2 - 25, midY = hgt / 2;
  const anchor = h.pointAt(midX, midY);
  h.stage.fire('pointerdown', { pointerId: 1, clientX: midX - 50, clientY: midY });
  h.stage.fire('pointerdown', { pointerId: 2, clientX: midX + 50, clientY: midY });
  h.stage.fire('pointermove', { pointerId: 1, clientX: midX - 80, clientY: midY + 30 });
  h.stage.fire('pointermove', { pointerId: 2, clientX: midX + 120, clientY: midY + 30 });
  h.flush();
  assert.ok(h.view.zoom > .5, 'Spreading zooms in');
  closePoint(h.pointAt(midX + 20, midY + 30), anchor);
  h.stage.fire('pointermove', { pointerId: 1, clientX: midX - 30, clientY: midY });
  h.stage.fire('pointermove', { pointerId: 2, clientX: midX + 30, clientY: midY });
  h.flush();
  assert.ok(h.view.zoom < .5, 'Pinching together zooms out');
});

test('a pinch can begin over an item without opening it on release', () => {
  const h = room(), hotspot = new h.Element();
  hotspot.closest = selector => selector.includes('.room-hotspots') || selector.includes('button') ? hotspot : null;
  h.stage.fire('pointerdown', { target: hotspot, pointerId: 1, clientX: 100 });
  h.stage.fire('pointerdown', { target: hotspot, pointerId: 2, clientX: 200 });
  h.stage.fire('pointermove', { pointerId: 2, clientX: 280 });
  h.flush();
  assert.ok(h.view.zoom > .5);
  h.stage.fire('pointerup', { pointerId: 1 });
  h.stage.fire('pointerup', { pointerId: 2 });
  assert.equal(h.stage.fire('click', { target: hotspot }).defaultPrevented, true);
});

test('two-finger contact suppresses both release clicks; the next deliberate tap works', () => {
  const h = room();
  h.stage.fire('pointerdown', { pointerId: 1 });
  h.stage.fire('pointerdown', { pointerId: 2, clientX: 200 });
  h.stage.fire('pointerup', { pointerId: 1 });
  h.stage.fire('pointerup', { pointerId: 2 });
  assert.equal(h.stage.fire('click').defaultPrevented, true);
  assert.equal(h.stage.fire('click').defaultPrevented, true);
  h.stage.fire('pointerdown'); h.stage.fire('pointerup');
  assert.equal(h.stage.fire('click').defaultPrevented, false);
});

test('lifting a finger before rendering does not jump the remaining drag', () => {
  const h = room();
  h.stage.fire('pointerdown', { pointerId: 1 });
  h.stage.fire('pointerdown', { pointerId: 2, clientX: 200 });
  h.stage.fire('pointermove', { pointerId: 2, clientX: 270 });
  const before = { ...h.view };
  h.stage.fire('pointerup', { pointerId: 2 });
  h.stage.fire('pointermove', { pointerId: 1 });
  assert.equal(h.view.panX, before.panX);
  assert.equal(h.view.panY, before.panY);
  assert.equal(h.view.zoom, before.zoom);
  h.flush();
  const shift = h.pointAt(110, 400)[0] - h.pointAt(100, 400)[0];
  h.stage.fire('pointermove', { clientX: 110 });
  assert.ok(Math.abs(h.view.panX - (before.panX - shift)) < .00001, 'The remaining finger uses the new pinch scale');
  h.stage.fire('pointerup');
  const releasedPan = h.view.panX;
  h.stage.fire('pointermove', { clientX: 300 });
  assert.equal(h.view.panX, releasedPan, 'Hover after release cannot continue the drag');
  assert.equal(h.canvas.classes.has('is-dragging'), false);
});

test('interrupted pointers are cleared and ordinary mouse wheel direction is preserved', () => {
  const h = room();
  h.stage.fire('pointerdown'); h.stage.fire('pointermove', { clientX: 140 });
  h.window.fire('blur');
  assert.equal(h.pointers.size, 0);
  assert.equal(h.stage.captured.size, 0);
  const before = h.target.zoom;
  h.stage.fire('wheel', { deltaY: 100, deltaMode: 0, ctrlKey: false });
  assert.ok(h.target.zoom > before);
  h.stage.fire('wheel', { deltaY: 100, deltaMode: 0, ctrlKey: true });
  assert.equal(h.target.zoom, before, 'Trackpad pinch keeps the inverse Ctrl+wheel polarity');
});

test('zero-distance fingers, large pinches and keyboard activation remain usable', () => {
  const h = room();
  h.stage.fire('pointerdown', { pointerId: 1, clientX: 100 });
  h.stage.fire('pointerdown', { pointerId: 2, clientX: 100 });
  h.stage.fire('pointermove', { pointerId: 2, clientX: 200 });
  assert.equal(h.view.zoom, .5);
  h.cancelRoomGesture();
  h.stage.fire('pointerdown', { pointerId: 1, clientX: 100 });
  h.stage.fire('pointerdown', { pointerId: 2, clientX: 200 });
  h.stage.fire('pointermove', { pointerId: 2, clientX: 2000 });
  assert.equal(h.view.zoom, 1.35);
  h.stage.fire('pointermove', { pointerId: 2, clientX: 101 });
  assert.equal(h.view.zoom, 0);
  assert.ok(Object.values(h.view).every(Number.isFinite));
  h.stage.fire('pointerup', { pointerId: 1 }); h.stage.fire('pointerup', { pointerId: 2 });
  const button = new h.Element(); button.closest = () => button;
  assert.equal(h.stage.fire('click', { target: button, detail: 0 }).defaultPrevented, false);
});
