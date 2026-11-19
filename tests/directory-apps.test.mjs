// Exercise the compiled app directory against the synced inventory and its local icon overrides. — GPT-6
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { projectLink } from '../.build.noindex/site/project-links.mjs';

function renderDirectoryCards() {
  const read = file => readFileSync(new URL(`../.build.noindex/site/${file}`, import.meta.url), 'utf8');
  const apps = JSON.parse(read('apps.json'));
  const projectWebsites = JSON.parse(read('project-websites.json'));
  const browserCode = read('beta.mjs');
  const grid = () => ({ links: [], append(...links) { this.links.push(...links); } });
  const grids = {
    '#apps-i-made': grid(), '#apps-from-others': grid(),
    '.directory-skills': grid(), '.directory-picks .directory-card-grid': grid(),
  };
  const document = {
    createElement: () => ({
      children: [], classList: new Set(), listeners: new Map(),
      append(...children) { this.children.push(...children); },
      setAttribute() {},
      addEventListener(type, listener) { this.listeners.set(type, listener); },
    }),
    querySelectorAll: () => [{
      dataset: { pickSummary: 'Plan meals.' }, href: 'https://ethansk.github.io/agentic-air-frying/',
      getAttribute: () => 'Agentic Air Frying', querySelector: () => null,
    }],
  };
  const requiredElement = selector => grids[selector];
  const cardContent = browserCode.slice(browserCode.indexOf('function artworkInitials'), browserCode.indexOf('const directory ='));
  const directoryCards = browserCode.slice(browserCode.indexOf('const setupOnlyApps ='), browserCode.indexOf('window.addEventListener("message"'));
  runInNewContext(cardContent + directoryCards, {
    apps, projectWebsites, projectLink, requiredElement, document, URL,
    railIcon: () => 'https://ethansk.github.io/hello-chat/app-icon.png',
    relatedTools: { replies: { icon: 'https://ethansk.github.io/response-preferences/mark.svg' } },
  });
  return grids;
}

const name = card => card.children[1].children[0].textContent;

test('the curated app grids keep the selected apps and use a local Activity Monitor icon', () => {
  const grids = renderDirectoryCards();
  const appsMade = grids['#apps-i-made'].links.map(name);
  const otherApps = new Map(grids['#apps-from-others'].links.map(link => [name(link), link]));
  for (const name of ['Hello Chat', 'The Fleet']) assert.ok(appsMade.includes(name), name);
  for (const name of ['Amphetamine', 'Adobe Photoshop 2026', 'Ableton Live 12 Suite', 'Stay', 'iCUE', 'Focusrite Control', 'Razer', 'Unity Hub', 'Bambu Studio']) {
    assert.ok(otherApps.has(name), name);
  }
  for (const name of ['Safari', 'iTerm', 'Logitech G HUB', 'OpenCode', 'TextEdit', 'Reminders', 'Music', 'System Settings', 'Firefox', 'Opera']) {
    assert.ok(!otherApps.has(name) && !appsMade.includes(name), name);
  }
  assert.match(otherApps.get('Activity Monitor').children[0].children[1].src, /^\.\/assets\/activity-monitor\.png\?v=[a-f0-9]+$/);
  assert.deepEqual(otherApps.get('Visual Studio Code').children[1].children.map(child => child.textContent), [
    'Visual Studio Code', 'Read and review code across agent worktrees.',
  ]);
});

test('Response Preferences reveals its artwork in both the Skills and Special Picks cards', () => {
  const grids = renderDirectoryCards();
  const hasName = card => name(card) === 'Response Preferences';
  const skill = grids['.directory-skills'].links.find(hasName);
  const pick = grids['.directory-picks .directory-card-grid'].links.find(hasName);
  assert.ok(skill && pick);
  assert.notEqual(skill, pick);
  assert.equal(skill.href, pick.href);
  for (const card of [skill, pick]) {
    const artwork = card.children[0];
    const image = artwork.children[1];
    assert.equal(image.src, 'https://ethansk.github.io/response-preferences/mark.svg');
    image.listeners.get('load')();
    assert.ok(artwork.classList.has('has-image'));
  }
});
