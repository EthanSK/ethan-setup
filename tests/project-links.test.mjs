import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { projectLink } from '../docs/project-links.mjs';

const websites = JSON.parse(readFileSync(new URL('../docs/project-websites.json', import.meta.url)));

test('Response Preferences and every verified project open their website or installation page', () => {
  assert.equal(projectLink('https://github.com/EthanSK/response-preferences', websites), 'https://ethansk.github.io/response-preferences/');
  for (const [repository, website] of Object.entries(websites)) {
    assert.equal(projectLink(`https://github.com/${repository}`, websites), website);
    assert.equal(projectLink(`https://github.com/${repository}/`, websites), website);
    assert.equal(projectLink(website, websites), website);
  }
});

test('source references, section links, other services and projects without websites keep their destinations', () => {
  for (const url of [
    'https://github.com/EthanSK/obs-plus-plus',
    'https://github.com/EthanSK/response-preferences/blob/main/SKILL.md',
    'https://github.com/EthanSK/stats-widget-from-website#setup-walkthrough',
    'https://github.com/EthanSK/agentic-mouse?tab=readme-ov-file',
    'https://github.com/another-owner/agentic-mouse',
    'https://obsproject.com/',
  ]) assert.equal(projectLink(url, websites), url);
});

test('the built sidebar and OBS example resolve project links before JavaScript runs', () => {
  const site = new URL('../.build.noindex/site/', import.meta.url);
  for (const file of readdirSync(site).filter(file => file.endsWith('.html'))) {
    const html = readFileSync(new URL(file, site), 'utf8');
    for (const [, href] of html.matchAll(/href="(https:\/\/[^"\s]+)"/g)) {
      assert.equal(href, projectLink(href, websites), `${file}: repository link should open its verified website`);
    }
  }
  const html = readFileSync(new URL('index.html', site), 'utf8');
  assert.match(html, /aria-label="Response Preferences" href="https:\/\/ethansk\.github\.io\/response-preferences\/"/);
  assert.match(html, /href="https:\/\/github\.com\/EthanSK\/stats-widget-from-website#setup-walkthrough"/);
});
