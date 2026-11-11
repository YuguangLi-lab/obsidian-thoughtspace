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

test('paper uses the warm-white ramp and keeps the dark steps, host type and solid material', () => {
  const expected = [
    ['#f8f5ef','#f8f5ef','#f0eee8','#e9e6e0','#d4d2cc','#c4c3be','#cbcfcd','#b8bcba','#868e8b','#7c8481','#67675f','#272a25'],
    ['#18191b','#222326','#35363b','#3c3d43','#4a4b52','#585960','#6a6b73','#7c7d85','#8e8f97','#94959d','#9a9ba3','#ececee'],
  ];
  for (const [index, scale] of expected.entries()) {
    const values = palette('paper', Boolean(index));
    assert.deepEqual(Array.from({ length: 12 }, (_, i) => values[`--ts-ui-${i + 1}`]), scale);
    if(index===0)assert.equal(values['--ts-e-shadow'], '0 1px 3px #00000009');
    else{assert.notEqual(values['--ts-e-overlay'],values['--ts-e-paper']);assert.match(values['--ts-e-shadow'],/#000000[0-9a-f]{2}/i);assert.notEqual(values['--ts-e-shadow'],'0 1px 3px #00000009');}
  }
  const light=palette('paper',false);
  assert.equal(light['--ts-e-paper'],'#f8f5ef');
  assert.equal(light['--ts-e-sheet'],'#f8f5ef');
  assert.equal(light['--ts-e-wash'],'#f0eee8');
  for(const banned of ['#f3e9d4','#fffdf8','#f6f4ee','#eeece4'])for(const token of ['--ts-e-paper','--ts-e-sheet','--ts-e-wash'])assert.notEqual(light[token],banned,token);
  assert.equal(light['--ts-e-serif'], 'var(--font-interface)');
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
      assert.match((decl.parent as Rule).selector, /\.ts-(?:root(?:\.ts-root){3}|component-gallery(?:\.ts-component-gallery){3})/);
    });
  }
});

test('purpose tokens expose page, panel, overlay, body ink, control line and motion', () => {
  for (const dark of [false, true]) {
    const values = palette('paper', dark);
    for (const key of [
      '--ts-e-paper', '--ts-e-sheet', '--ts-e-overlay', '--ts-e-body',
      '--ts-e-control-line', '--ts-e-focus', '--ts-e-selected', '--ts-e-success',
      '--ts-e-title-size', '--ts-e-body-size', '--ts-e-meta-size',
      '--ts-e-space-icon', '--ts-e-space-control', '--ts-e-space-panel', '--ts-e-space-section',
      '--ts-e-radius-sm', '--ts-e-radius', '--ts-e-radius-lg',
      '--ts-e-motion', '--ts-e-ease', '--ts-e-grain-opacity',
    ]) assert.ok(values[key], `${dark ? 'dark' : 'light'} missing ${key}`);
    assert.equal(values['--ts-e-radius-sm'], '4px');
    assert.equal(values['--ts-e-radius'], '8px');
    assert.equal(values['--ts-e-radius-lg'], '12px');
    assert.equal(values['--ts-e-motion'], '200ms');
    assert.equal(values['--ts-e-ease'], 'ease-in-out');
    if (!dark) assert.equal(values['--ts-e-paper'], '#f8f5ef');
    else {
      assert.equal(values['--ts-e-paper'], '#222326');
      assert.equal(values['--ts-e-sheet'], '#18191b');
      assert.equal(values['--ts-e-overlay'], '#323339');
      assert.notEqual(values['--ts-e-overlay'], values['--ts-e-paper']);
      assert.equal(values['--ts-e-body'], '#c6c7cc');
      assert.equal(values['--ts-e-control-line'], '#b3b4bb');
      assert.equal(values['--ts-e-disabled'], '#787a82');
      assert.equal(values['--ts-e-focus'], '#8bbaf0');
      assert.equal(values['--ts-e-selected'], '#93c8b4');
      assert.equal(values['--ts-e-success'], '#7ec8a3');
      for (const stale of ['#20211e', '#252620', '#2c2d27', '#24211d', '#2d2822']) {
        assert.ok(!Object.values(values).includes(stale), stale);
      }
    }
    assert.notEqual(values['--ts-e-selected'], values['--ts-e-success']);
    for (const text of ['ink', 'body', 'muted']) {
      for (const surface of ['paper', 'sheet', 'overlay']) {
        assert.ok(
          contrast(values[`--ts-e-${text}`], values[`--ts-e-${surface}`]) >= 4.5,
          `${text}/${surface}`,
        );
      }
    }
    for (const line of ['control-line', 'focus', 'selected']) {
      assert.ok(contrast(values[`--ts-e-${line}`], values['--ts-e-sheet']) >= 3, line);
    }
  }
});

test('reduced-motion zeroes the duration token inside plugin roots', () => {
  const css = interfaceStyleRules('paper', false);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /--ts-e-motion:\s*0ms/);
});

test('paper retains AA text contrast on sheet, page and wash surfaces for all legacy settings', () => {
  for (const style of styles) for (const dark of [false, true]) {
    const values = palette(style, dark);
    const surfaces=dark?['sheet','paper','overlay']:['sheet','paper','wash'];
    for (const text of ['ink', 'muted', 'editorial']) for (const surface of surfaces) {
      const ratio = contrast(values[`--ts-e-${text}`], values[`--ts-e-${surface}`]);
      assert.ok(ratio >= 4.5, `${style}/${dark ? 'dark' : 'light'} ${text}/${surface}: ${ratio.toFixed(2)}`);
    }
  }
});

// Rendering paper chrome must not reactivate the old !important stage fill.
test('the interface finish leaves authored canvas paper and image backgrounds in control',()=>{
  const text=readFileSync('styles.css','utf8');
  for (const stale of ['#20211e','#252620','#2c2d27','#24211d','#2d2822','#342e26']) assert.doesNotMatch(text, new RegExp(stale, 'i'));
  const css=postcss.parse(text);
  css.walkDecls(/^background(?:-color)?$/,decl=>{
    const selector=(decl.parent as Rule).selector;
    if(selector.includes('[data-surface=paper]')&&/\.ts-(?:stage|brain-stage|handwriting-stage)\b/.test(selector))assert.ok(!decl.important,selector);
  });
});
