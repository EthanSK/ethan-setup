import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { MouseSimulator } from '../docs/simulator.mjs';

const source = readFileSync(new URL('../docs/beta.mjs', import.meta.url), 'utf8');
const map = JSON.parse(readFileSync(new URL('../docs/simulator-data.json', import.meta.url)));
const handlers = source.slice(source.indexOf('function updateGestures()'), source.indexOf('const reviewFiles ='));

function mouseControls() {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, {
      attributes: {}, listeners: {}, textContent: '', disabled: false,
      setAttribute(name, value) { this.attributes[name] = value; },
      addEventListener(name, listener) { this.listeners[name] = listener; },
    });
    return elements.get(id);
  };
  const simulator = new MouseSimulator(map);
  const context = { simulator, pendingKeypad: null, updateHUD() {},
    document: { querySelector: selector => element(selector.slice(1)), getElementById: element },
    clearTimeout() {}, setTimeout() { return 1; }, performance };
  runInNewContext(handlers, context);
  const click = id => element(id).listeners.click();
  const select = app => element('beta-app').listeners.change({ target: { value: app } });
  const render = () => context.updateMouse();
  return { simulator, element, click, select, render };
}

test('selecting any published app opens its controls from default, keys and utility on both mice', () => {
  const { simulator, element, select } = mouseControls();
  for (const hand of Object.keys(map.sources)) {
    simulator.chooseHand(hand);
    for (const app of map.apps) {
      for (const previous of ['default', 'keys', 'utility']) {
        simulator.chooseMode(previous);
        select(app.id);
        assert.equal(simulator.hand, hand);
        assert.equal(simulator.state.mode, app.id);
        assert.equal(simulator.state.followsApp, true);
        assert.strictEqual(simulator.mode, map.sources[hand].modes[app.id]);
        assert.equal(element('beta-feedback').textContent, simulator.mode.title);
        assert.equal(element('beta-default').attributes['aria-pressed'], 'false');
        assert.equal(element('beta-app-mode').attributes['aria-pressed'], 'true');
      }
    }
  }
});

test('app changes refresh a following hand without replacing its independent utility mode', () => {
  const { simulator, select } = mouseControls();
  simulator.chooseHand('razer');
  simulator.chooseMode('utility');
  simulator.chooseHand('corsair');
  select('spotify');
  assert.equal(simulator.states.razer.mode, 'utility');
  simulator.chooseHand('razer');
  select('chrome');
  assert.equal(simulator.states.corsair.mode, 'chrome');
  assert.equal(simulator.states.corsair.output, map.sources.corsair.modes.chrome.title);
  assert.equal(simulator.states.razer.output, map.sources.razer.modes.chrome.title);
});

test('default and app preview buttons reopen the selected app, and reset returns to default', () => {
  const { simulator, element, select, click } = mouseControls();
  select('vsCode');
  click('beta-default');
  assert.equal(simulator.app, 'vsCode');
  assert.equal(simulator.state.mode, 'default');
  assert.equal(element('beta-default').attributes['aria-pressed'], 'true');
  assert.equal(element('beta-app-mode').attributes['aria-pressed'], 'false');
  click('beta-app-mode');
  assert.strictEqual(simulator.mode, map.sources.corsair.modes.vsCode);
  click('beta-reset');
  assert.equal(simulator.state.mode, 'default');
  assert.equal(element('beta-feedback').textContent, 'Try a button');
  assert.equal(element('beta-default').attributes['aria-pressed'], 'true');
});

test('hold toggles to release, disables wheel on release, and permits a new once-per-hold action', () => {
  const { simulator, element, click, render } = mouseControls();
  for (const hand of Object.keys(map.sources)) {
    simulator.chooseHand(hand);
    simulator.reset();
    const clipboard = simulator.mode.controls.find(control => control.wheel?.id === 'clipboard');
    simulator.state.selected = clipboard.cell;
    render();
    click('beta-hold');
    assert.equal(element('beta-hold').textContent, 'Release selected button');
    assert.equal(element('beta-hold').attributes['aria-pressed'], 'true');
    click('beta-wheel-up');
    assert.equal(element('beta-feedback').textContent, clipboard.wheel.up);
    click('beta-wheel-down');
    assert.equal(element('beta-feedback').textContent, clipboard.wheel.down);
    click('beta-hold');
    assert.equal(simulator.state.held, null);
    assert.equal(element('beta-hold').textContent, 'Hold selected button');
    assert.equal(element('beta-hold').attributes['aria-pressed'], 'false');
    assert.equal(element('beta-wheel-up').disabled, true);
    assert.equal(element('beta-wheel-down').disabled, true);

    const screenshot = simulator.mode.controls.find(control => control.wheel?.oncePerHold);
    simulator.state.selected = screenshot.cell;
    click('beta-hold');
    const direction = screenshot.wheel.down ? 'beta-wheel-down' : 'beta-wheel-up';
    click(direction);
    click(direction);
    assert.equal(element('beta-feedback').textContent, 'Release and hold again');
    click('beta-hold');
    click('beta-hold');
    click(direction);
    assert.notEqual(element('beta-feedback').textContent, 'Release and hold again');
  }
});

test('keypad feedback includes the pending letter and switches to mode or action feedback after typing', () => {
  const { simulator, element, render, click, select } = mouseControls();
  simulator.chooseMode('keypad');
  simulator.press(2, 0);
  simulator.press(3, 1);
  render();
  assert.equal(simulator.state.text, 'A');
  assert.equal(element('beta-feedback').textContent, 'Ad');
  simulator.press(10, 2);
  render();
  assert.equal(element('beta-feedback').textContent, 'Default mode');
  select('spotify');
  assert.equal(element('beta-feedback').textContent, map.sources.corsair.modes.spotify.title);
  click('beta-default');
  simulator.state.selected = 4;
  click('beta-hold');
  click('beta-wheel-up');
  assert.equal(element('beta-feedback').textContent, 'Paste');
});
