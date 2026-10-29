import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import postcss, { type Rule } from 'postcss';
import selectorParser from 'postcss-selector-parser';
import { interfaceStyleRules } from '../src/interface-style-tokens';

const styles = ['paper', 'editorial', 'glass', 'unknown', undefined] as const;
function palette(style: unknown, dark = false): Record<string, string> {
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

test('retired and unknown style values always resolve to the same paper material', () => {
  const paper = interfaceStyleRules('paper', false);
  for (const style of styles) for (const effects of [true, false]) {
    assert.equal(interfaceStyleRules(style, effects), paper);
  }
  assert.doesNotMatch(paper, /data-ts-glass-optics|ts-glass-content-shield|linear-gradient|blur\(/);
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
      if(/^--(?:background|text|font)-/.test(decl.prop)){const selector=(decl.parent as Rule).selector;assert.doesNotMatch(selector,/\.ts-(?:brain-shell|handwriting|collection-content)\b/);if(selector.includes('.ts-root'))assert.ok(selector.includes(' :is(.ts-commandbar,.ts-inspector,.ts-minimap,.ts-calendar,.ts-tour-bar,.ts-board-rail,.ts-rail-popover,.ts-footer .ts-view-dock,.ts-canvas-settings-panel)'),selector);else assert.match(selector,/\.ts-(?:settings|writing|ui-modal)/);}
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

test('paper retains AA text contrast on sheet, page and wash surfaces for all legacy settings', () => {
  for (const style of styles) for (const dark of [false, true]) {
    const values = palette(style, dark);
    for (const text of ['ink', 'muted', 'editorial']) for (const surface of ['sheet', 'paper', 'wash']) {
      const ratio = contrast(values[`--ts-e-${text}`], values[`--ts-e-${surface}`]);
      assert.ok(ratio >= 4.5, `${style}/${dark ? 'dark' : 'light'} ${text}/${surface}: ${ratio.toFixed(2)}`);
    }
  }
});

// Rendering paper chrome must not reactivate the old !important stage fill.
test('the interface finish leaves authored canvas paper and image backgrounds in control',()=>{
  const css=postcss.parse(readFileSync('styles.css','utf8'));
  css.walkDecls(/^background(?:-color)?$/,decl=>{
    const selector=(decl.parent as Rule).selector;
    if(selector.includes('[data-surface=paper]')&&/\.ts-(?:stage|brain-stage|handwriting-stage)\b/.test(selector))assert.ok(!decl.important,selector);
  });
});
