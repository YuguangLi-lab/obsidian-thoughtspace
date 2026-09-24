import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {cardFillHex, emptyBoard, type Board} from '../src/model';
import {layoutBounds, layoutModes,planLayout} from '../src/layout-planner';
import {previewConnection} from '../src/layout-preview-geometry';
import {branchState, mindmapRoot} from '../src/mindmap';
import {topicRows} from '../src/mindmap-editor';
import {connectionPath} from '../src/connections';

class SvgElement {
  children: SvgElement[] = [];
  parent?: SvgElement;
  attrs = new Map<string, string>();
  dataset: Record<string, string> = {};
  textContent = '';
  constructor(readonly tag: string) {}
  setAttribute(name: string, value: string) { this.attrs.set(name, value); }
  getAttribute(name: string) { return this.attrs.get(name) ?? null; }
  hasAttribute(name: string) { return this.attrs.has(name); }
  appendChild(child: SvgElement) { child.parent = this; this.children.push(child); return child; }
  append(...children: SvgElement[]) { children.forEach(child => this.appendChild(child)); }
  replaceChildren(...children: SvgElement[]) { this.children.forEach(child => child.parent = undefined); this.children = []; this.append(...children); }
  empty() { this.replaceChildren(); }
  addEventListener() {}
  all(): SvgElement[] { return [this, ...this.children.flatMap(child => child.all())]; }
}
class HtmlElement extends SvgElement {
  isShown() { return true; }
}

// Obsidian delegates pointerover to [aria-label], then its delayed tooltip calls
// HTMLElement.isShown(). SVG deliberately lacks that HTMLElement-only method.
function dispatchNativeTooltip(target: SvgElement) {
  let candidate: SvgElement | undefined = target;
  while (candidate && !candidate.hasAttribute('aria-label')) candidate = candidate.parent;
  if (!candidate?.getAttribute('aria-label')) return;
  const matched = candidate;
  const timer = () => (matched as HtmlElement).isShown();
  timer();
}
function accessibleTitle(svg: SvgElement) {
  const ids = (svg.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean);
  assert.ok(ids.length, 'SVG must retain an explicit accessible name');
  return ids.map(id => {
    const matches = svg.all().filter(element => element.getAttribute('id') === id);
    assert.equal(matches.length, 1, 'every name reference must resolve to one element');
    assert.equal(matches[0].tag, 'title');
    return matches[0].textContent;
  }).join(' ');
}
function compileDraw(path: string, dependencies: Record<string, unknown>) {
  const source = readFileSync(path, 'utf8'), start = source.indexOf(' private draw(){'), end = source.indexOf('\n onClose(){', start);
  assert.ok(start > 0 && end > start, 'exercise the actual preview renderer');
  const code = `const ns='http://www.w3.org/2000/svg';let layoutPreviewScene=0,relationScene=0;class View{${source.slice(start, end)}}return View;`;
  return new Function(...Object.keys(dependencies), transformSync(code, {loader: 'ts'}).code)(...Object.values(dependencies));
}
const document = {createElementNS: (_namespace: string, tag: string) => new SvgElement(tag)};
function board(): Board {
  const result = emptyBoard();
  result.nodes = [
    {id: 'a', kind: 'text', topic: true, text: '中心主题', x: 0, y: 0, width: 180, height: 90, color: 'green'},
    {id: 'b', kind: 'text', topic: true, text: '子主题', x: 260, y: 40, width: 160, height: 80, color: 'blue'}
  ];
  result.edges = [{id: 'ab', from: 'a', to: 'b', kind: 'branch', label: ''}];
  return result;
}

test('tooltip harness reproduces the delayed HTMLElement-only call for a labeled SVG', () => {
  const svg = new SvgElement('svg'); svg.setAttribute('aria-label', '旧预览名称');
  assert.throws(() => dispatchNativeTooltip(svg), /isShown is not a function/);
});

test('layout previews retain names and hover safely before, after, cached and in separate scenes', () => {
  const View = compileDraw('src/layout-planner-view.ts', {document, layoutBounds, layoutModes, previewConnection, readingTitle: (node: Board['nodes'][number]) => node.text || node.id});
  const data = board(), titles: string[] = [];
  const create = () => {
    const view = new View(), canvas = new HtmlElement('div'); canvas.setAttribute('aria-label', '所选对象布局示意');
    Object.assign(view, {before: false, options: {mode: 'grid'}, previews: new Map(), canvas, host: {board: () => data}, plan: {items: data.nodes, originals: data.nodes, lanes: [], bounds: layoutBounds(data.nodes)}, mountPreview() { canvas.replaceChildren(view.svg); }});
    return view;
  };
  const first = create();
  for (const view of [first, create()]) for (const before of [false, true]) {
    view.before = before; view.draw(); const svg = view.svg as SvgElement;
    assert.doesNotThrow(() => dispatchNativeTooltip(svg));
    assert.equal(svg.getAttribute('role'), 'img'); assert.equal(svg.hasAttribute('aria-label'), false);
    assert.match(accessibleTitle(svg), before ? /原布局/ : /网格/);
    assert.match(accessibleTitle(svg), /2 项内容/);
    titles.push(svg.getAttribute('aria-labelledby')!);
    const node = svg.all().find(element => element.tag === 'rect')!;
    assert.doesNotThrow(() => dispatchNativeTooltip(node));
    view.draw(); assert.equal(view.svg, svg, 'cached scene retains the same naming reference');
  }
  assert.equal(new Set(titles).size, titles.length, 'simultaneous scenes must not share title IDs');
});

test('mindmap previews retain original/new names without becoming native tooltip targets', () => {
  const View = compileDraw('src/mindmap-studio-view.ts', {document, branchState, mindmapRoot, topicRows, connectionPath, cardFillHex, createTopicPreviewLabel: () => {}});
  const data = board(), view = new View(), preview = new HtmlElement('div');
  Object.assign(view, {preview, plan: {board: data, ids: new Set(['a', 'b'])}, baseline: data, draft: {selected: 'a'}, before: false, focused: false, presenting: false, previewGestures() {}});
  const ids: string[] = [];
  for (const before of [false, true, false]) {
    view.before = before; view.draw(); const svg = preview.children[0];
    assert.doesNotThrow(() => dispatchNativeTooltip(svg));
    assert.equal(svg.getAttribute('role'), 'img'); assert.equal(svg.hasAttribute('aria-label'), false);
    assert.equal(accessibleTitle(svg), before ? '原思维导图布局' : '新思维导图布局');
    ids.push(svg.getAttribute('aria-labelledby')!);
    for (const node of svg.all().filter(element => element.tag === 'rect')) assert.doesNotThrow(() => dispatchNativeTooltip(node));
  }
  assert.equal(new Set(ids).size, ids.length);
});


test('classified layout previews render the same named frame bounds that will be applied',()=>{
 const View=compileDraw('src/layout-planner-view.ts',{document,layoutBounds,layoutModes,previewConnection,readingTitle:(node:Board['nodes'][number])=>node.text||node.id}),data=board(),plan=planLayout(data,new Set(data.nodes.map(n=>n.id)),{mode:'color',columns:2,gap:8,sort:'position',anchor:'corner',createSections:true}),view=new View();
 Object.assign(view,{before:false,options:{mode:'color'},previews:new Map(),host:{board:()=>data},plan,mountPreview(){}});view.draw();const frames=(view.svg as SvgElement).all().filter(el=>el.getAttribute('class')==='ts-layout-frame');assert.equal(frames.length,plan.newSections!.length);for(const[i,frame]of frames.entries()){assert.equal(Number(frame.getAttribute('x')),plan.newSections![i].x);assert.equal(Number(frame.getAttribute('y')),plan.newSections![i].y);assert.equal(Number(frame.getAttribute('width')),plan.newSections![i].width);assert.equal(Number(frame.getAttribute('height')),plan.newSections![i].height);}const labels=(view.svg as SvgElement).all().filter(el=>el.tag==='text').map(el=>el.textContent);assert.ok(plan.newSections!.every(g=>labels.includes(g.title)));view.before=true;view.draw();assert.equal((view.svg as SvgElement).all().filter(el=>el.getAttribute('class')==='ts-layout-frame').length,0);
});
