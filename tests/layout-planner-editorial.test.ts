import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {layoutBounds} from '../src/layout-planner';
import type {Card} from '../src/model';

const css = readFileSync('src/layout-planner.css', 'utf8');

test('the controls column uses min and max variables and does not scroll with the page', () => {
  assert.match(css, /--ts-layout-controls-min:\s*260px/);
  assert.match(css, /--ts-layout-controls-max:\s*320px/);
  assert.match(css, /grid-template-columns:\s*minmax\(var\(--ts-layout-controls-min\),\s*var\(--ts-layout-controls-max\)\)\s*minmax\(0,\s*1fr\)/);
  assert.match(css, /\.ts-layout-body\s*\{[^}]*overflow:\s*hidden/);
  assert.match(css, /\.ts-layout-controls\s*\{[^}]*overflow-y:\s*auto/);
  assert.match(css, /--ts-layout-panel:\s*var\(--ts-e-sheet\)/);
  assert.match(css, /--ts-layout-soft:\s*var\(--ts-e-wash\)/);
  assert.match(css, /--ts-layout-line:\s*var\(--ts-e-line\)/);
  assert.doesNotMatch(css, /grid-template-columns:\s*296px|grid-template-columns:\s*258px/);
  assert.doesNotMatch(css, /#f3e9d4|#fffdf8|#f6f4ee/);
});

test('narrow containers collapse advanced options without clearing their values', async () => {
  const mod = await import('../src/layout-planner') as {layoutAdvancedSummary?: (options: {sort: 'position' | 'title'; anchor: 'corner' | 'center'}) => string; nextLayoutAdvancedOpen?: (state: {narrow: boolean; userOpened: boolean; open: boolean}, narrow: boolean, userOpen?: boolean) => {narrow: boolean; userOpened: boolean; open: boolean}};
  assert.equal(typeof mod.layoutAdvancedSummary, 'function');
  assert.equal(typeof mod.nextLayoutAdvancedOpen, 'function');
  const options = {sort: 'title' as const, anchor: 'corner' as const};
  const before = JSON.stringify(options);
  assert.equal(mod.layoutAdvancedSummary!(options), '更多选项 · 2');
  assert.equal(mod.layoutAdvancedSummary!({sort: 'position', anchor: 'center'}), '更多选项');
  assert.equal(JSON.stringify(options), before);
  const entered = mod.nextLayoutAdvancedOpen!({narrow: false, userOpened: false, open: true}, true);
  assert.equal(entered.open, false);
  assert.equal(entered.userOpened, false);
  const reopened = mod.nextLayoutAdvancedOpen!(entered, true, true);
  assert.equal(reopened.open, true);
  assert.equal(reopened.userOpened, true);
  assert.equal(mod.nextLayoutAdvancedOpen!(reopened, true).open, true);
  assert.match(css, /@container ts-layout-planner \(max-width:\s*860px\)/);
});

class SvgElement {
  children: SvgElement[] = [];
  attrs = new Map<string, string>();
  textContent = '';
  constructor(readonly tag: string) {}
  setAttribute(name: string, value: string) { this.attrs.set(name, value); }
  getAttribute(name: string) { return this.attrs.get(name) ?? null; }
  appendChild(child: SvgElement) { this.children.push(child); return child; }
  all(): SvgElement[] { return [this, ...this.children.flatMap(child => child.all())]; }
}

test('uncolored preview cards use paper fill and line stroke', () => {
  const source = readFileSync('src/layout-planner-view.ts', 'utf8');
  const start = source.indexOf(' private draw(){'), end = source.indexOf('\n onClose(){', start);
  const View = new Function('document', 'layoutBounds', 'layoutModes', 'previewConnection', 'readingTitle', transformSync(`const ns='http://www.w3.org/2000/svg';let layoutPreviewScene=0;class View{${source.slice(start, end)}}return View;`, {loader: 'ts'}).code)(
    {createElementNS: (_ns: string, tag: string) => new SvgElement(tag)},
    layoutBounds,
    {grid: '网格'},
    () => '',
    (node: Card) => node.text || node.id,
  );
  const plain = {id: 'plain', kind: 'text', text: '未着色', x: 10, y: 10, width: 120, height: 80} as Card;
  const sand = {...plain, id: 'sand', color: 'sand' as const};
  const view = new View();
  Object.assign(view, {before: false, options: {mode: 'grid'}, previews: new Map(), host: {board: () => ({edges: []})}, plan: {items: [plain, sand], originals: [plain, sand], lanes: [], bounds: layoutBounds([plain, sand])}, mountPreview() {}});
  view.draw();
  const rects = (view.svg as SvgElement).all().filter(element => element.tag === 'rect' && element.getAttribute('class')?.includes('ts-layout-object'));
  const uncolored = rects.find(element => element.getAttribute('fill') === 'var(--ts-e-paper)');
  assert.ok(uncolored);
  assert.equal(uncolored!.getAttribute('stroke'), 'var(--ts-e-line)');
  const colored = rects.find(element => element.getAttribute('fill') !== 'var(--ts-e-paper)');
  assert.equal(colored?.getAttribute('fill'), '#cfb963');
  for (const banned of ['#f3e9d4', '#fffdf8', '#f6f4ee', '#9da9b9']) assert.ok(!rects.some(element => element.getAttribute('fill') === banned || element.getAttribute('stroke') === banned));
});
