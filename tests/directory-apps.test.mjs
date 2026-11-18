// Exercise the compiled app directory against the synced inventory and its local icon overrides. — GPT-6
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { projectLink } from '../.build.noindex/site/project-links.mjs';

test('the curated app grids keep the selected apps and use a local Activity Monitor icon', () => {
  const read = file => readFileSync(new URL(`../.build.noindex/site/${file}`, import.meta.url), 'utf8');
  const apps = JSON.parse(read('apps.json'));
  const projectWebsites = JSON.parse(read('project-websites.json'));
  const browserCode = read('beta.mjs');
  const grid = () => ({ links: [], append(link) { this.links.push(link); } });
  const grids = { '#apps-i-made': grid(), '#apps-from-others': grid() };
  const document = { createElement: () => ({ append(...children) { this.children = children; } }) };
  const requiredElement = selector => grids[selector];
  runInNewContext(browserCode.slice(browserCode.indexOf('const setupOnlyApps ='), browserCode.indexOf('const skills =')), {
    apps, projectWebsites, projectLink, requiredElement, document, URL,
  });

  const appsMade = grids['#apps-i-made'].links.map(link => link.children[1].textContent);
  const otherApps = new Map(grids['#apps-from-others'].links.map(link => [link.children[1].textContent, link]));
  for (const name of ['Hello Chat', 'The Fleet']) assert.ok(appsMade.includes(name), name);
  for (const name of ['Amphetamine', 'Adobe Photoshop 2026', 'Ableton Live 12 Suite', 'Stay', 'iCUE', 'Focusrite Control', 'Razer', 'Unity Hub', 'Bambu Studio']) {
    assert.ok(otherApps.has(name), name);
  }
  for (const name of ['Safari', 'iTerm', 'Logitech G HUB', 'OpenCode', 'TextEdit', 'Reminders', 'Music', 'System Settings', 'Firefox', 'Opera']) {
    assert.ok(!otherApps.has(name) && !appsMade.includes(name), name);
  }
  assert.match(otherApps.get('Activity Monitor').children[0].src, /^\.\/assets\/activity-monitor\.png\?v=[a-f0-9]+$/);
});
