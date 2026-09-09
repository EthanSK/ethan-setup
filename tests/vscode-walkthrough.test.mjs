import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../docs/beta.mjs', import.meta.url), 'utf8');
const html = readFileSync(new URL('../docs/index.html', import.meta.url), 'utf8');
const names = ['Worktrees', 'Dev stacks', 'Review', 'Land'];

/** Run the walkthrough's real slide handlers against a minimal DOM stand-in. */
function walkthrough() {
  class Element {
    attributes = {}; handlers = new Map(); hidden = false; disabled = false; tabIndex = 0; textContent = ''; focused = 0;
    constructor(name, dataset = {}) { this.lastElementChild = { textContent: name }; this.dataset = dataset; }
    setAttribute(name, value) { this.attributes[name] = value; }
    getAttribute(name) { return this.attributes[name]; }
    addEventListener(type, callback) { this.handlers.set(type, [...(this.handlers.get(type) || []), callback]); }
    fire(type, values = {}) {
      const event = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...values };
      for (const callback of this.handlers.get(type) || []) callback(event);
      return event;
    }
    focus() { this.focused++; }
  }
  const tabs = names.map((name, i) => { const tab = new Element(name); tab.setAttribute('aria-controls', `slide-${i}`); return tab; });
  const panels = names.map(() => new Element());
  const steps = [-1, 1].map(step => new Element('', { slideStep: String(step) }));
  const document = {
    querySelectorAll: selector => selector.includes('role="tab"') ? tabs : steps,
    getElementById: id => panels[Number(id.slice(6))],
  };
  const context = { document };
  runInNewContext(`${source.slice(source.indexOf('const slideTabs ='), source.indexOf('/** Keep clicks inside a dialog intact'))}\nshowSlide(0);\napi = { showSlide };`, context);
  return { tabs, panels, steps, showSlide: context.api.showSlide, selected: () => tabs.findIndex(tab => tab.getAttribute('aria-selected') === 'true') };
}

test('one slide shows at a time, with the tabs and named step buttons in agreement', () => {
  const w = walkthrough();
  assert.equal(w.selected(), 0);
  assert.deepEqual(w.panels.map(panel => panel.hidden), [false, true, true, true]);
  assert.deepEqual(w.tabs.map(tab => tab.tabIndex), [0, -1, -1, -1]);
  assert.equal(w.steps[0].disabled, true);
  assert.equal(w.steps[1].textContent, 'Dev stacks →');
  w.tabs[2].fire('click');
  assert.equal(w.selected(), 2);
  assert.deepEqual(w.panels.map(panel => panel.hidden), [true, true, false, true]);
  assert.equal(w.steps[0].textContent, '← Dev stacks');
  assert.equal(w.steps[1].textContent, 'Land →');
  w.steps[1].fire('click');
  assert.equal(w.selected(), 3);
  assert.equal(w.steps[1].disabled, true, 'The last slide has no next destination and does not wrap');
  assert.equal(w.steps[1].textContent, 'Next →');
  w.steps[0].fire('click');
  assert.equal(w.selected(), 2);
});

test('arrow, Home and End keys move between slides and focus the selected tab', () => {
  const w = walkthrough();
  assert.equal(w.tabs[0].fire('keydown', { key: 'ArrowRight' }).defaultPrevented, true);
  assert.equal(w.selected(), 1);
  assert.equal(w.tabs[1].focused, 1);
  w.tabs[1].fire('keydown', { key: 'End' });
  assert.equal(w.selected(), 3);
  w.tabs[3].fire('keydown', { key: 'ArrowRight' });
  assert.equal(w.selected(), 3, 'Stays on the last slide instead of wrapping');
  w.tabs[3].fire('keydown', { key: 'Home' });
  assert.equal(w.selected(), 0);
  w.tabs[0].fire('keydown', { key: 'ArrowLeft' });
  assert.equal(w.selected(), 0);
  assert.equal(w.tabs[0].fire('keydown', { key: 'Tab' }).defaultPrevented, false, 'Tab leaves the strip normally');
  w.showSlide(2);
  assert.equal(w.selected(), 2, 'Opening the dialog can reset to any slide without a click');
});

test('the VS Code hotspot sits on the right half of the Dell screen, separate from Dell and Codex', () => {
  const anchors = Object.fromEntries([...html.matchAll(/data-topic="([^"]+)" data-x="([^"]+)" data-y="([^"]+)"/g)].map(([, topic, x, y]) => [topic, [Number(x), Number(y)]]));
  const [x, y] = anchors.vscode;
  assert.ok(x > 635 / 1586 && x < 807 / 1586 && y > 313 / 992 && y < 473 / 992, 'Inside the right half of the Dell screen polygon'); // Polygon from scripts/build-room-image.py; VS Code is on that half of the insert.
  const gear = JSON.parse(readFileSync(new URL('../docs/gear.json', import.meta.url)));
  const dell = gear.find(item => item.id === 'dell');
  assert.ok(Math.hypot(x - dell.x, y - dell.y) > .05 && Math.hypot(x - anchors.codex[0], y - anchors.codex[1]) > .05);
  assert.match(html, /<nav class="room-dock"[\s\S]*data-topic="vscode">VS Code</);
});

test('the walkthrough links only public destinations and uses example names', () => {
  const panel = html.slice(html.indexOf('<div id="vscode-detail"'), html.indexOf('<div id="sausages-detail"'));
  const links = [...panel.matchAll(/href="([^"]+)"/g)].map(([, url]) => url);
  assert.ok(links.length >= 4);
  for (const url of links) assert.match(url, /^https:\/\/github\.com\/EthanSK\/aimvs-dev-skill\/blob\/main\/references\/(worktree-lifecycle|stack-lifecycle|git-state-and-code-review)\.md/);
  assert.doesNotMatch(panel, /ai-music-video-studio"|github\.com\/EthanSK\/ai-music-video-studio|vibedio|vibideo/i);
  assert.doesNotMatch(panel, /\bwhether\b/i);
  assert.match(panel, /aimvs1-review[\s\S]*aimvs2-upload/);
  assert.match(panel, /Example names/);
  assert.equal((panel.match(/role="tab"/g) || []).length, 4);
  assert.equal((panel.match(/role="tabpanel"/g) || []).length, 4);
  assert.doesNotMatch(panel, /<iframe|autoplay/);
  assert.match(source, /skill: \{ name: "AIMVS dev skill", url: "https:\/\/github\.com\/EthanSK\/aimvs-dev-skill"/);
  assert.match(source, /vscode: \["skill", "code"\]/);
});
