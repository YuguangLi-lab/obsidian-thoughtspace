import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {join} from 'node:path';
import postcss from 'postcss';
import {interfaceStyleRules} from '../src/interface-style-tokens';

const bannedSurfaces = ['#f3e9d4', '#fffdf8', '#f6f4ee', '#eeece4'];

function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'node_modules' ? [] : cssFiles(path);
    return name.endsWith('.css') ? [path] : [];
  });
}

test('default paper chrome has no legacy yellow surfaces', () => {
  const css = interfaceStyleRules('paper', false);
  for (const banned of bannedSurfaces) {
    assert.equal(css.includes(`--ts-e-paper:${banned}`), false);
    assert.equal(css.includes(`--ts-e-sheet:${banned}`), false);
  }
});

test('plugin styles do not use legacy yellow as a default background or border', () => {
  const hits: string[] = [];
  for (const file of cssFiles('src')) {
    postcss.parse(readFileSync(file, 'utf8')).walkDecls(decl => {
      if (!/^(?:background|border)(?:-color)?$/.test(decl.prop)) return;
      const found = bannedSurfaces.find(color => decl.value.toLowerCase().includes(color));
      if (found) hits.push(`${file} ${decl.prop}:${decl.value}`);
    });
  }
  assert.deepEqual(hits, []);
});

test('dark dialogs keep an overlay lighter than the page, not the sheet', () => {
  const css = interfaceStyleRules('paper', true);
  postcss.parse(css).walkRules(rule => {
    const forcesSheet = rule.nodes?.some(node => node.type === 'decl' && node.prop === 'background' && node.value === 'var(--ts-e-sheet)' && node.important);
    if (!forcesSheet) return;
    assert.doesNotMatch(rule.selector, /\.ts-ui-modal(?:\.ts-ui-modal){3}/);
  });
  const dialogs = readFileSync('src/editorial-dialogs.css', 'utf8');
  assert.match(dialogs, /\.modal\.ts-ui-modal:where\(:not\(\.ts-space-hub\)\)\s*\{[^}]*background:var\(--ts-e-overlay\)!important/);
});

test('field errors stay readable and use the circled exclamation', () => {
  const collection = readFileSync('src/collection-context.css', 'utf8');
  const paper = readFileSync('src/paper-settings.css', 'utf8');
  const dialogs = readFileSync('src/editorial-dialogs.css', 'utf8');
  assert.match(collection, /\.ts-collection-export-fields \.ts-field-error\{[^}]*font-size:max\(13px,/);
  assert.match(collection, /\.ts-collection-export-fields \.ts-field-error::before\{[^}]*content:"!"/);
  assert.match(paper, /\.ts-paper-custom-row>\.ts-field-error::before\{[^}]*content:"!"/);
  assert.match(dialogs, /\.ts-prompt-field \.ts-field-error::before\s*\{[^}]*content:"!"/);
});

test('collection export footer reaches the dialog edges and selects keep their chevron', () => {
  const css = readFileSync('src/collection-context.css', 'utf8');
  assert.match(css, /\.ts-collection-note-export>\.ts-collection-export-actions\{[^}]*margin-inline:calc\(var\(--ts-e-space-panel\) \* -1\)/);
  assert.doesNotMatch(css, /select\{[^}]*\bbackground:var\(--ts-c-sheet\)/);
  assert.match(css, /select\{[^}]*background-color:var\(--ts-c-sheet\)/);
});

test('one inlined paper grain keeps the shared opacity formula', () => {
  const css = readFileSync('styles.css', 'utf8');
  assert.equal(css.split('data:image/png;base64,').length - 1, 1);
  assert.equal(css.includes('opacity: calc(clamp(0, var(--ts-paper-texture, .55), 1) * var(--ts-e-grain-opacity, 1))'), true);
});
