import assert from 'node:assert/strict';
import { test } from 'node:test';
import postcss, { type Rule } from 'postcss';
import selectorParser from 'postcss-selector-parser';
import { interfaceStyleRules } from '../src/interface-style-tokens';
import type { InterfaceStyle } from '../src/workspace';

const styles: InterfaceStyle[] = ['paper', 'editorial', 'glass'];
function palette(style: InterfaceStyle, dark = false): Record<string, string> {
  const result: Record<string, string> = {};
  postcss.parse(interfaceStyleRules(style, true)).walkRules(rule => {
    if (rule.parent?.type !== 'root' || rule.selector.startsWith('.theme-dark') !== dark) return;
    if (!rule.selector.includes('.ts-root.ts-root.ts-root.ts-root')) return;
    rule.walkDecls(decl => { if (decl.prop.startsWith('--')) result[decl.prop] = decl.value; });
  });
  return result;
}
function contrast(a: string, b: string): number {
  const luminance = (hex: string) => {
    const rgb = [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16) / 255)
      .map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  };
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

test('paper preserves all twelve historical light and dark steps, host type and solid material', () => {
  const expected = [
    ['#fffdf8','#f6f4ee','#eeece4','#e6e4dc','#dedcd3','#d3d1c7','#cbcfcd','#b8bcba','#868e8b','#7c8481','#67675f','#272a25'],
    ['#20211e','#252620','#2c2d27','#34352e','#3c3e35','#4c4e43','#444947','#5b625f','#63706b','#717d79','#b9bcaf','#e9ebdf'],
  ];
  for (const [index, scale] of expected.entries()) {
    const values = palette('paper', Boolean(index));
    assert.deepEqual(Array.from({ length: 12 }, (_, i) => values[`--ts-ui-${i + 1}`]), scale);
    assert.equal(values['--ts-e-shadow'], '0 1px 3px #00000009');
  }
  assert.equal(palette('paper')['--ts-e-serif'], 'var(--font-interface)');
  const css = interfaceStyleRules('paper', true);
  assert.match(css, /background:var\(--ts-e-sheet\)!important/);
  assert.doesNotMatch(css, /blur\(|url\(|--ts-paper-/);
});

test('magazine preserves the released warm palette and serif typesetting', () => {
  assert.equal(palette('editorial')['--ts-e-sheet'], '#fffdf7');
  assert.equal(palette('editorial')['--ts-e-editorial'], '#a24b32');
  assert.equal(palette('editorial', true)['--ts-e-paper'], '#24211d');
  assert.equal(palette('editorial', true)['--ts-e-muted'], '#bcad99');
  assert.match(palette('editorial')['--ts-c-serif'], /^"Iowan Old Style"/);
  const css = interfaceStyleRules('editorial', true);
  assert.doesNotMatch(css, /backdrop-filter|font-family:/);
  postcss.parse(css).walkDecls('background', decl => {
    assert.match((decl.parent as Rule).selector, /\.ts-ui-menu/);
  });
});

test('every generated selector stays inside named plugin roots and outside Calendar', () => {
  for (const style of styles) {
    const ast = postcss.parse(interfaceStyleRules(style, true));
    ast.walkRules(rule => {
      const selectors = selectorParser().astSync(rule.selector);
      for (const selector of selectors.nodes) {
        assert.match(selector.toString(), /\.ts-[a-z-]+/);
        assert.match(selector.toString(), /:not\(:where\(\.ts-calendar-plugin,\.ts-calendar-plugin \*\)\)/);
        assert.doesNotMatch(selector.toString(), /(^|[\s,])(?:body|html|:root|\.menu)(?=[\s.:#,[\]]|$)/);
        assert.doesNotMatch(selector.toString(), /\.ts-(?:card|node|stage|brain-stage|handwriting-stage)\b|\.cm-editor|\.markdown/);
      }
    });
    ast.walkDecls(decl => {
      assert.doesNotMatch(decl.prop, /^--(?:background|text|font)-/);
      assert.doesNotMatch(decl.prop, /^animation/);
      if (decl.prop.startsWith('transition')) {
        assert.match((decl.parent as Rule).selector, /\.ts-glass-content-shield/);
        assert.ok(decl.value === 'none' || decl.value === 'inset 140ms ease,border-radius 140ms ease,box-shadow 140ms ease');
      }
    });
  }
});

test('selected material beats late legacy palette selectors without global important tokens', () => {
  for (const style of styles) {
    const css = postcss.parse(interfaceStyleRules(style, true));
    css.walkDecls(/^--(?:ts-e|ts-ui|ts-c)-/, decl => {
      assert.equal(decl.important, undefined);
      assert.match((decl.parent as Rule).selector, /\.ts-root\.ts-root\.ts-root\.ts-root/);
    });
  }
});

test('glass limits blur to the compact dock and has opaque accessibility/small-pane fallbacks', () => {
  const css = interfaceStyleRules('glass', true);
  const ast = postcss.parse(css);
  let filters = 0;
  ast.walkDecls(/^(?:-webkit-)?backdrop-filter$/, decl => {
    if (decl.value === 'none') return;
    if (decl.value === 'var(--ts-glass-filter,none)') {
      assert.match((decl.parent as Rule).selector, /\[data-ts-glass-optics=true\]/);
      return;
    }
    assert.equal(decl.value, 'blur(6px)');
    const rule = decl.parent as Rule;
    assert.match(rule.selector, /\.ts-footer \.ts-view-dock/);
    assert.equal(rule.parent?.type, 'atrule');
    assert.match(rule.parent?.toString() ?? '', /@container ts-board-canvas \(min-width:681px\)/);
    filters++;
  });
  assert.equal(filters, 2);
  assert.match(css, /prefers-reduced-transparency:reduce/);
  assert.match(css, /prefers-contrast:more/);
  assert.match(css, /@container \(max-width:680px\)/);
  assert.match(css, /@supports not/);
  const disabled = postcss.parse(interfaceStyleRules('glass', false));
  disabled.walkDecls(/^(?:-webkit-)?backdrop-filter$/, decl => assert.equal(decl.value, 'none'));
  disabled.walkDecls('--ts-glass-surface', decl => assert.equal(decl.value, 'var(--ts-e-sheet)'));
  disabled.walkDecls('--ts-glass-reflection', decl => assert.equal(decl.value, 'none'));
});

test('macOS glass uses neutral material, with reflections confined to navigation and tools', () => {
  for (const dark of [false, true]) {
    const values = palette('glass', dark);
    for (const name of ['paper', 'sheet', 'wash', 'line']) {
      const hex = values[`--ts-e-${name}`];
      const channels = [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16));
      assert.ok(Math.max(...channels) - Math.min(...channels) <= 6, `${name} must remain neutral: ${hex}`);
    }
    assert.match(values['--ts-e-shadow'], /inset 0 1px 0 #ffffff/);
    assert.doesNotMatch(values['--ts-e-shadow'], /#(?:24466b|d6eaff)/);
  }
  const css = postcss.parse(interfaceStyleRules('glass', true));
  css.walkDecls('background', decl => {
    if (!decl.value.includes('var(--ts-glass-reflection)')) return;
    const selector = (decl.parent as Rule).selector;
    selectorParser().astSync(selector).walkClasses(node => {
      assert.ok(!['ts-collection-composer', 'ts-settings-panel', 'ts-inspector', 'ts-calendar', 'ts-writing-transition'].includes(node.value));
    });
    assert.match(selector, /\.ts-commandbar|\[data-ts-glass-optics=true\]/);
  });
  assert.equal(palette('glass')['--ts-e-radius'], '16px');
});

test('verified optics protect content without moving controls and have static CSS escape paths', () => {
  const css = interfaceStyleRules('glass', true);
  const ast = postcss.parse(css);
  const opticsRules: Rule[] = [];
  ast.walkRules(rule => { if (rule.selector.includes('[data-ts-glass-optics=true]')) opticsRules.push(rule); });
  assert.ok(opticsRules.length > 0);
  for (const rule of opticsRules) {
    assert.doesNotMatch(rule.selector, /\.ts-collection-nav|\.ts-settings-nav|\.ts-commandbar|\.ts-native-header|\.ts-inspector/);
    rule.walkDecls(decl => {
      assert.notEqual(decl.prop, 'transform');
      assert.notEqual(decl.prop, 'outline');
      if (['inset', 'position', 'z-index', 'transition', 'margin', 'padding'].includes(decl.prop)) {
        assert.match(rule.selector, /\.ts-glass-content-shield/);
      }
    });
  }
  const shield = opticsRules.find(rule => rule.nodes.some(node => node.type === 'decl' && node.prop === 'z-index'));
  assert.ok(shield);
  const values = new Map(shield.nodes.flatMap(node => node.type === 'decl' ? [[node.prop, node.value]] : []));
  assert.equal(values.get('z-index'), '-1');
  assert.equal(values.get('pointer-events'), 'none');
  assert.equal(values.get('inset'), '7px');
  assert.match(values.get('background') ?? '', /var\(--ts-e-sheet\) 96%/);
  assert.match(values.get('background') ?? '', /var\(--ts-glass-x,50%\).*var\(--ts-glass-y,50%\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /forced-colors:active/);
  for (const style of ['paper', 'editorial'] as const) assert.doesNotMatch(interfaceStyleRules(style, true), /data-ts-glass-optics|ts-glass-content-shield/);
  assert.doesNotMatch(interfaceStyleRules('glass', false), /data-ts-glass-optics|ts-glass-content-shield/);
});

test('all three palettes retain AA text contrast on their sheet, page and wash surfaces', () => {
  for (const style of styles) for (const dark of [false, true]) {
    const values = palette(style, dark);
    for (const text of ['ink', 'muted', 'editorial']) for (const surface of ['sheet', 'paper', 'wash']) {
      const ratio = contrast(values[`--ts-e-${text}`], values[`--ts-e-${surface}`]);
      assert.ok(ratio >= 4.5, `${style}/${dark ? 'dark' : 'light'} ${text}/${surface}: ${ratio.toFixed(2)}`);
    }
  }
});
