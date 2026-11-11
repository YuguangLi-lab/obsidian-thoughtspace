import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import postcss, { type Rule } from 'postcss';

function parse(...files: string[]) {
  return postcss.parse(files.map(f => readFileSync(f, 'utf8')).join('\n'));
}

test('buttons, fields, and modals use purpose tokens and 4/8/12 radii', () => {
  const css = parse('src/visual-system.css', 'src/editorial-dialogs.css');
  const text = css.toString();
  assert.match(text, /var\(--ts-e-motion\)/);
  assert.match(text, /var\(--ts-e-focus\)/);
  assert.match(text, /var\(--ts-e-control-line\)/);
  assert.match(text, /var\(--ts-e-radius-sm\)/);
  assert.doesNotMatch(text, /border-radius:\s*5px/);
  assert.doesNotMatch(text, /#f3e9d4|#fffdf8|#f6f4ee|#eeece4/);
  const roots = '.ts-root,.ts-ui-modal,.ts-writing,.ts-settings,.ts-materials-panel,.ts-materials-modal';
  let states = 0;
  css.walkRules((rule: Rule) => {
    if (!rule.selector.includes('.ts-')) return;
    const body = rule.toString();
    if (/:hover|:active|:focus-visible|:disabled|\[aria-disabled/.test(rule.selector) && /--ts-e-/.test(body)) states += 1;
  });
  assert.ok(states >= 4, `expected shared component states, saw ${states}`);
  assert.match(text, /--ts-e-overlay/);
  assert.match(text, /--ts-e-radius-lg/);
  assert.match(text, /--ts-e-space-panel/);
  assert.match(text, /--ts-e-danger/);
  assert.match(text, /ts-field-error/);
  assert.ok(text.includes(roots.split(',')[0]));
  css.walkRules((rule: Rule) => {
    const parent = rule.parent;
    if (parent?.type === 'atrule' && (parent as { name?: string }).name === 'keyframes') return;
    let depth = 0;
    let start = 0;
    const selector = rule.selector;
    const parts: string[] = [];
    for (let i = 0; i <= selector.length; i++) {
      const ch = selector[i];
      if (ch === '(') depth += 1;
      else if (ch === ')') depth -= 1;
      else if ((ch === ',' && depth === 0) || i === selector.length) {
        const trimmed = selector.slice(start, i).trim();
        if (trimmed) parts.push(trimmed);
        start = i + 1;
      }
    }
    for (const part of parts) assert.match(part, /^[.#:\[*]/, part);
  });
  assert.match(text, /\.ts-writing \.ts-writing-formatbar \.ts-md-select/);
  assert.match(text, /\.ts-writing \.ts-writing-search\{/);
  assert.match(text, /\.ts-ui-modal \.modal-button-container button \{/);
  assert.match(text, /\.ts-prompt-status \{/);
  const errorMark = text.match(/\.ts-field-error::before\s*\{[^}]+\}/)?.[0] ?? '';
  assert.match(errorMark, /content:\s*"!"/);
  assert.match(errorMark, /border-radius:\s*999px/);
  assert.doesNotMatch(errorMark, /content:\s*""/);
  assert.doesNotMatch(errorMark, /border-radius:\s*var\(--ts-e-radius-sm\)/);
  assert.match(text, /\.is-selected::after/);
  assert.match(text, /\.is-loading|\[aria-busy=true\]/);
  assert.match(text, /\.ts-field-success|\.ts-status-success/);
  assert.match(text, /\.is-error:focus-visible/);
});
