import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../docs/beta.mjs', import.meta.url), 'utf8');
const html = readFileSync(new URL('../docs/index.html', import.meta.url), 'utf8');
const gear = JSON.parse(readFileSync(new URL('../docs/gear.json', import.meta.url)));
const apps = JSON.parse(readFileSync(new URL('../docs/apps.json', import.meta.url)));
const dockApps = apps.filter(app => !['trash', 'chatgpt', 'obs'].includes(app.id));
const anchors = [...html.matchAll(/data-topic="([^"]+)" data-x="([^"]+)" data-y="([^"]+)"/g)]
  .map(([, topic, x, y]) => ({ topic, x, y }));
const hotspots = [...anchors, ...gear.map(item => ({ topic: item.id, x: item.x, y: item.y }))]
  .map(dataset => ({ dataset, classList: { contains: () => false } }));
const context = { hotspots, dockApps, roomWidth: 20, roomHeight: 20 * 992 / 1586 };
runInNewContext(source.slice(source.indexOf('function buildDialogRoute()'), source.indexOf('const dialogNavigation =')), context);
const route = Array.from(runInNewContext('dialogRoute', context));

test('every desk item and app appears exactly once, with related demos and Dock apps together', () => {
  const expected = [...anchors.map(item => item.topic), ...gear.map(item => item.id), 'code', 'voice', ...dockApps.map(app => `software:${app.id}`)];
  assert.equal(new Set(route).size, expected.length);
  assert.deepEqual([...route].sort(), expected.sort());
  assert.equal(route[route.indexOf('dell') + 1], 'code');
  assert.equal(route[route.indexOf('shure') + 1], 'voice');
  assert.deepEqual(route.slice(route.indexOf('codex') + 1, route.indexOf('codex') + 1 + dockApps.length), dockApps.map(app => `software:${app.id}`));
});

test('previous and next remain inverse at every item, including both ends', () => {
  const buttons = [-1, 1].map(step => ({ dataset: { step }, setAttribute() {} }));
  Object.assign(context, { detail: { dataset: {} }, dialogNavigation: buttons,
    topics: { code: ['', 'Review code'], voice: ['', 'Dictation'], ...Object.fromEntries(anchors.map(item => [item.topic, ['', item.topic]])) },
    gearById: new Map(gear.map(item => [item.id, item])), apps });
  runInNewContext(source.slice(source.indexOf('function updateDialogNavigation()'), source.indexOf('let returnFocus,')), context);
  for (const topic of route) {
    context.detail.dataset.topic = topic;
    runInNewContext('updateDialogNavigation()', context);
    const [previous, next] = buttons.map(button => button.dataset.destination);
    assert.ok(buttons.every(button => button.title && !button.title.includes('undefined')));
    context.detail.dataset.topic = next;
    runInNewContext('updateDialogNavigation()', context);
    assert.equal(buttons[0].dataset.destination, topic);
    context.detail.dataset.topic = previous;
    runInNewContext('updateDialogNavigation()', context);
    assert.equal(buttons[1].dataset.destination, topic);
  }
});
