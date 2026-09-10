import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../docs/frame-view.mjs', import.meta.url), 'utf8');

function fixture() {
  class Element extends EventTarget {
    children = [];
    attributes = {};
    style = {};
    append(child) { this.children.push(child); child.parent = this; }
    remove() { this.parent.children = this.parent.children.filter(child => child !== this); }
    setAttribute(name, value) { this.attributes[name] = value; }
    set innerHTML(value) { this.parts = Object.fromEntries(['p', 'button', 'a'].map(tag => [tag, new Element()])); }
    querySelector(tag) { return this.parts[tag]; }
  }
  const timers = new Map();
  let nextTimer = 0;
  const context = {
    document: { createElement: () => new Element() },
    setTimeout: fn => { timers.set(++nextTimer, fn); return nextTimer; },
    clearTimeout: id => timers.delete(id),
  };
  runInNewContext(source.replace('export function', 'function'), context);
  const host = new Element(), view = context.createFrameView(host, 'desktop-frame');
  const status = host.children[0];
  return {host, view, status, timers, tick() { for (const fn of timers.values()) fn(); timers.clear(); }};
}

test('a page stays visibly loading until its load event, with an external destination', () => {
  const {host, view, status, timers} = fixture();
  view.load('https://example.com/desktop/', 'Desktop', 'Example desktop');
  const frame = host.children[1];
  assert.equal(status.hidden, false);
  assert.equal(status.parts.p.textContent, 'Loading Desktop…');
  assert.equal(frame.style.opacity, '0');
  assert.equal(frame.title, 'Example desktop');
  assert.equal(status.parts.a.href, frame.src);
  assert.equal(timers.size, 1);
  frame.dispatchEvent(new Event('load'));
  assert.equal(status.hidden, true);
  assert.equal(frame.style.opacity, '1');
  assert.equal(frame.attributes['aria-busy'], 'false');
  assert.equal(timers.size, 0);
});

test('a slow response remains pending and can still complete after the retry button appears', () => {
  const {host, view, status, tick} = fixture();
  view.load('/obs.html', 'OBS');
  tick();
  assert.equal(status.parts.p.textContent, 'Still loading OBS…');
  assert.equal(status.parts.button.hidden, false);
  assert.equal(host.children.length, 2);
  host.children[1].dispatchEvent(new Event('load'));
  assert.equal(status.hidden, true);
});

test('retry gets a new page and a stale load cannot dismiss its indicator', () => {
  const {host, view, status, timers, tick} = fixture();
  view.load('/portfolio', 'Portfolio');
  const oldFrame = host.children[1];
  tick();
  status.parts.button.dispatchEvent(new Event('click'));
  const newFrame = host.children[1];
  assert.notEqual(oldFrame, newFrame);
  assert.equal(newFrame.src, '/portfolio');
  assert.equal(status.parts.button.hidden, true);
  assert.equal(status.parts.p.textContent, 'Loading Portfolio…');
  oldFrame.dispatchEvent(new Event('load'));
  assert.equal(status.hidden, false);
  assert.equal(timers.size, 1);
  newFrame.dispatchEvent(new Event('load'));
  assert.equal(status.hidden, true);
});

test('closing or switching pages removes pending work without reviving an old page', () => {
  const {host, view, status, timers} = fixture();
  view.load('/desktop', 'Desktop');
  const oldFrame = host.children[1];
  view.clear();
  assert.equal(host.children.length, 1);
  assert.equal(timers.size, 0);
  assert.equal(status.hidden, true);
  view.load('/obs', 'OBS');
  oldFrame.dispatchEvent(new Event('load'));
  assert.equal(status.hidden, false);
  assert.equal(status.parts.p.textContent, 'Loading OBS…');
  assert.equal(timers.size, 1);
});
