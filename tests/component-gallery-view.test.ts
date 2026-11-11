import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {cardFillHex} from '../src/model';

const source = readFileSync('src/component-gallery-view.ts', 'utf8').replace(/^import[^\n]*\n/gm, '').replace(/\bexport /g, '');
class El {
  children: El[] = [];
  parent?: El;
  classes = new Set<string>();
  attrs: Record<string, string> = {};
  dataset: Record<string, string> = {};
  style: Record<string, string> = {};
  text = '';
  disabled = false;
  onclick: (() => void) | null = null;
  ownerDocument: {body: El};
  constructor(readonly tagName: string, doc: {body: El}) { this.ownerDocument = doc; }
  get classList() { return {contains: (name: string) => this.classes.has(name)}; }
  addClass(...names: string[]) { for (const name of names) this.classes.add(name); }
  toggleClass(name: string, on?: boolean) { const enable = on ?? !this.classes.has(name); if (enable) this.classes.add(name); else this.classes.delete(name); }
  setAttribute(key: string, value: string) { this.attrs[key] = value; if (key.startsWith('data-')) this.dataset[key.slice(5)] = value; }
  getAttribute(key: string) { return this.attrs[key] ?? null; }
  createEl(tag: string, options: {cls?: string; text?: string; attr?: Record<string, string>} = {}) {
    const node = new El(tag, this.ownerDocument);
    node.parent = this;
    if (options.cls) node.addClass(...options.cls.split(' ').filter(Boolean));
    node.text = options.text || '';
    for (const [key, value] of Object.entries(options.attr || {})) node.setAttribute(key, value);
    if (node.attrs.disabled != null) node.disabled = true;
    this.children.push(node);
    return node;
  }
  createDiv(options?: {cls?: string; text?: string; attr?: Record<string, string>} | string) { return this.createEl('div', typeof options === 'string' ? {cls: options} : options); }
  empty() { this.children = []; }
  matches(selector: string) {
    if (selector.startsWith('[')) {
      const match = /^\[([^=\]]+)(?:="([^"]*)")?\]$/.exec(selector);
      if (!match) return false;
      const value = this.getAttribute(match[1]);
      return value !== null && (match[2] === undefined || value === match[2]);
    }
    const [tag, ...classes] = selector.split('.');
    return (!tag || this.tagName === tag) && classes.every(name => this.classes.has(name));
  }
  querySelectorAll(selector: string): El[] { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
  querySelector(selector: string) { return this.querySelectorAll(selector)[0]; }
  click() { if (!this.disabled) this.onclick?.(); }
}
class ItemView {
  contentEl: El;
  constructor(public leaf: {contentEl: El}) { this.contentEl = leaf.contentEl; }
  registerEvent() {}
  registerDomEvent() {}
}
const loaded = new Function('ItemView', 'cardFillHex', transformSync(`${source}\nreturn {COMPONENT_GALLERY_VIEW_TYPE, COMPONENT_GALLERY_COMMAND_ID, ComponentGalleryView};`, {loader: 'ts'}).code)(ItemView, cardFillHex) as {
  COMPONENT_GALLERY_VIEW_TYPE: string;
  COMPONENT_GALLERY_COMMAND_ID: string;
  ComponentGalleryView: new (leaf: {contentEl: El}) => {contentEl: El; onOpen: () => Promise<void>};
};

test('gallery command id is stable and not a daily-entry tool id', () => {
  assert.equal(loaded.COMPONENT_GALLERY_COMMAND_ID, 'thoughtspace-open-component-gallery');
  assert.equal(loaded.COMPONENT_GALLERY_VIEW_TYPE, 'thoughtspace-component-gallery');
  assert.notEqual(loaded.COMPONENT_GALLERY_COMMAND_ID, 'open-tool-palette');
  const main = readFileSync('src/main.ts', 'utf8');
  assert.match(main, /id:\s*COMPONENT_GALLERY_COMMAND_ID/);
  assert.match(main, /打开组件样板页/);
  assert.match(main, /registerView\(COMPONENT_GALLERY_VIEW_TYPE/);
  for (const file of ['src/tool-palette.ts', 'src/writing-view.ts', 'src/writing-format-toolbar.ts', 'src/settings-view.ts']) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), /thoughtspace-open-component-gallery|thoughtspace-component-gallery|打开组件样板页/);
  }
});

test('gallery renders type, selected cards, controls, and theme and width toggles', async () => {
  const doc = {body: new El('body', undefined as unknown as {body: El})};
  doc.body.ownerDocument = doc;
  const content = new El('div', doc);
  const view = new loaded.ComponentGalleryView({contentEl: content});
  await view.onOpen();
  assert.ok(content.classes.has('ts-component-gallery'));
  assert.equal(content.getAttribute('data-theme'), 'light');
  assert.equal(content.getAttribute('data-width'), 'wide');
  for (const selector of ['.ts-type-title', '.ts-type-body', '.ts-type-meta', 'button.ts-button', 'input', '.ts-outline-row', '[data-gallery-theme]', '[data-gallery-width]']) {
    assert.ok(content.querySelector(selector), selector);
  }
  const selected = content.querySelectorAll('.ts-library-card.is-selected');
  assert.ok(selected.length >= 2);
  assert.ok(selected.some(card => card.style.background.includes(cardFillHex.green)));
  assert.ok(selected.some(card => card.style.background.includes(cardFillHex.sand) && card.classes.has('is-focus-sample')));
  assert.ok(content.querySelector('button.mod-cta[disabled]') || content.querySelectorAll('button.mod-cta').some(button => button.disabled));
  assert.ok(content.querySelector('button.mod-cta.is-loading'));
  assert.ok(content.querySelector('input.is-error.is-focus-sample'));
  assert.ok(content.querySelector('.ts-field-error'));
  assert.ok(content.querySelector('.ts-field-success, .ts-status-success') || content.querySelector('.ts-status-success') || content.querySelector('.ts-field-success'));
  assert.ok(content.querySelector('.ts-sidebar-empty'));
  assert.ok(content.querySelector('.ts-outline-row.is-selected.is-focus-sample'));
  content.querySelector('[data-gallery-theme]')!.click();
  assert.equal(content.getAttribute('data-theme'), 'dark');
  assert.ok(content.classes.has('theme-dark'));
  content.querySelector('[data-gallery-width]')!.click();
  assert.equal(content.getAttribute('data-width'), 'narrow');
  const css = readFileSync('src/component-gallery.css', 'utf8');
  const visual = readFileSync('src/visual-system.css', 'utf8');
  assert.match(css, /--ts-e-title-size/);
  assert.match(css, /--ts-e-space-section/);
  assert.match(css, /--ts-e-space-control/);
  assert.doesNotMatch(css, /\.is-selected[^{]*\{[^}]*background\s*:/);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}/i);
  const cardRow = content.querySelector('.ts-gallery-cards');
  assert.equal(cardRow?.querySelectorAll('.ts-gallery-card').length, 3);
  assert.match(css, /\[data-width=wide\] \.ts-gallery-cards\s*\{[^}]*flex-direction:\s*row/);
  assert.match(css, /\[data-width=narrow\] \.ts-gallery-cards\s*\{[^}]*flex-direction:\s*column/);
  assert.match(css, /\[data-width=wide\] \.ts-gallery-card\s*\{[^}]*flex:\s*1 1 0/);
  assert.match(css, /\.ts-gallery-card\s*\{[^}]*border:\s*1px solid var\(--ts-e-line\)/);
  const pair = content.querySelector('.ts-gallery-field-pair');
  assert.equal(pair?.querySelectorAll('input').length, 2);
  assert.equal(pair?.querySelector('.is-error'), undefined);
  assert.match(css, /\[data-width=wide\] \.ts-gallery-field-pair\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\) minmax\(0,\s*1fr\)/);
  assert.match(css, /\[data-width=narrow\] \.ts-gallery-field-pair\s*\{[^}]*flex-direction:\s*column/);
  const textOf = (el: El | undefined): string => el ? el.text + el.children.map(textOf).join('') : '';
  const error = content.querySelector('[data-gallery-example="error"]');
  const success = content.querySelector('[data-gallery-example="success"]');
  assert.ok(error && success && error !== success);
  assert.match(textOf(error), /字段错误/);
  assert.match(textOf(error), /请填写标题后再继续/);
  assert.ok(error.querySelector('.ts-field-error'));
  assert.match(textOf(success), /保存成功/);
  assert.ok(success.querySelector('.ts-field-success') || success.querySelector('.ts-status-success'));
  assert.equal(error.querySelector('.ts-status-success'), undefined);
  assert.match(css, /\.ts-gallery-toolbar\s*\{[^}]*margin-block-end:\s*var\(--ts-e-space-section\)/);
  assert.match(css, /border:\s*1px solid var\(--ts-e-line\)/);
  assert.match(css, /height:\s*36px/);
  assert.match(css, /padding:\s*0 12px/);
  assert.match(css, /is-loading,\s*\[aria-busy=true\]\)::before\s*\{[^}]*position:\s*static/);
  assert.match(css, /gap:\s*8px/);
  assert.match(css, /min-width:\s*96px/);
  assert.doesNotMatch(visual, /ts-component-gallery\) :is\(\.ts-button,button\.mod-cta,button\.ts-primary\):is\(\.is-loading/);
  assert.match(css, /\.ts-gallery-dialog\s*\{[^}]*max-width:\s*420px/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  const paper = content.querySelector('[data-fill="paper"]');
  const green = content.querySelector('[data-fill="green"]');
  const sand = content.querySelector('[data-fill="sand"]');
  assert.ok(paper && green && sand);
  assert.match(css, /--ts-gallery-on-fill:\s*black/);
  assert.match(css, /\[data-fill=green\] :is\(\.ts-type-body, \.ts-type-meta\)/);
  assert.doesNotMatch(css, /\[data-fill=(?:green|sand)\][\s\S]{0,180}var\(--ts-e-(?:body|muted|ink)\)/);
  const onFill = '#000000';
  const mix = (hex: string, into: string, percent: number) => {
    const channel = (h: string, at: number) => Number.parseInt(h.slice(at, at + 2), 16);
    return '#' + [1, 3, 5].map(at => Math.round(channel(hex, at) * percent / 100 + channel(into, at) * (1 - percent / 100)).toString(16).padStart(2, '0')).join('');
  };
  const luminance = (hex: string) => [1, 3, 5].map(at => Number.parseInt(hex.slice(at, at + 2), 16) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((n, v, i) => n + v * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (fg: string, bg: string) => {
    const a = luminance(fg), b = luminance(bg);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };
  const built = readFileSync('styles.css', 'utf8');
  const dark = built.slice(built.indexOf('.theme-dark {'));
  const mixed = (name: string) => {
    const found = dark.match(new RegExp(`--ts-fill-${name}:color-mix\\(in srgb,(#[0-9a-f]{6}) (\\d+)%,(#[0-9a-f]{6})\\)`, 'i'));
    assert.ok(found, name);
    return mix(found[1], found[3], Number(found[2]));
  };
  for (const [name, light] of [['green', cardFillHex.green], ['sand', cardFillHex.sand]] as const) {
    for (const fill of [light, mixed(name)]) {
      const measured = ratio(onFill, fill);
      assert.ok(measured >= 4.5, `${name} ${fill} ${measured.toFixed(2)}`);
    }
  }
  for (const pale of ['#c6c7cc', '#9a9ba3', '#ececee']) assert.ok(ratio(pale, mixed('green')) < 4.5);
});
