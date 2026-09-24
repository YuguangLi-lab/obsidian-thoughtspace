import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {clone, colorNames, emptyBoard, type Board} from '../src/model';
import {selectionEdges, patchSelectionEdges} from '../src/selection-edges';
import {selectionFormatKey} from '../src/selection-format';

const source = readFileSync('src/main.ts', 'utf8');
function take(start: string, end: string): string {
  const from = source.indexOf(start), to = source.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `Missing real toolbar implementation: ${start}`);
  return source.slice(from, to);
}
const methods = take('  private buildBatchEdgeTools(', '  refreshStyleControls()')
  + take('  private renderSelectionTools(){', '  private renderInspector()');

class Element {
  children: Element[] = [];
  attrs: Record<string, string> = {};
  classes = new Set<string>();
  value = '';
  text = '';
  disabled = false;
  isConnected = true;
  clears = 0;
  onchange?: () => unknown;
  onclick?: () => unknown;
  constructor(readonly tag = 'div') {}
  createEl(tag: string, options: {attr?: Record<string, string>; text?: string; value?: string} = {}): Element {
    const child = new Element(tag);
    child.attrs = options.attr || {};
    child.text = options.text || '';
    child.value = options.value || '';
    this.children.push(child);
    return child;
  }
  createSpan(options: any): Element { return this.createEl('span', options); }
  createDiv(options: any): Element { return this.createEl('div', options); }
  setAttribute(key: string, value: string): void { this.attrs[key] = value; }
  addClass(name: string): void { this.classes.add(name); }
  toggleClass(name: string, enabled: boolean): void { if (enabled) this.classes.add(name); else this.classes.delete(name); }
  all(): Element[] { return [this, ...this.children.flatMap(child => child.all())]; }
  empty(): void { for (const child of this.all().slice(1)) child.isConnected = false; this.children = []; this.clears++; }
}

function fixture(size = 4) {
  const scans: {nodes: number; edges: number}[] = [];
  const deps = {
    colorNames, selectionFormatKey, patchSelectionEdges,
    selectionEdges: (...args: Parameters<typeof selectionEdges>) => {
      scans.push({nodes: args[0].nodes.length, edges: args[0].edges.length});
      return selectionEdges(...args);
    },
    preserveToolbarFocus: () => () => {},
    act: (run: () => unknown) => run(),
    button: (parent: Element, title: string, _icon: string, run: () => unknown) => {
      const button = parent.createEl('button', {attr: {'aria-label': title}});
      button.onclick = run;
      return button;
    },
  };
  const View = new Function(...Object.keys(deps), transformSync(`class View {${methods}}; return View;`, {loader: 'ts'}).code)(...Object.values(deps));
  const view = new View(), board = emptyBoard(), host = new Element();
  board.nodes = Array.from({length: size}, (_, i) => ({id: `n${i}`, kind: 'card', file: `n${i}.md`, x: i * 240, y: 0, width: 220, height: 160, color: 'green'}));
  board.edges = board.nodes.slice(1).map((node, i) => ({id: `e${i}`, from: `n${i}`, to: node.id, label: '', color: 'green'}));
  const counts = {changes: 0};
  const owner = {
    board, blocked: false,
    change(run: (board: Board) => void) { assert.equal(this.blocked, false); counts.changes++; run(this.board); },
  };
  Object.assign(view, {session: owner, selectionTools: host, selected: new Set(board.nodes.map(node => node.id)),
    batchFormatTarget: 'edges', batchEdgeScope: 'internal', plugin: {},
    requireOwner(expected: unknown) { assert.equal(view.session, expected); assert.equal(owner.blocked, false); return owner; },
    renderEdges() {},
  });
  const control = (label: string): Element => {
    const element = host.all().find(el => el.attrs['aria-label'] === label);
    assert.ok(element, `Missing ${label} control`);
    return element;
  };
  const changeColor = (value = 'blue') => { const input = control('连线颜色'); input.value = value; input.onchange?.(); };
  return {view, owner, board, host, scans, counts, control, changeColor};
}

test('a fresh 1200-card batch toolbar scans edges once for both cache identity and controls', () => {
  const f = fixture(1200), before = clone(f.board);
  f.view.renderSelectionTools();
  assert.deepEqual(f.scans, [{nodes: 1200, edges: 1199}]);
  assert.ok(f.control('连线 1199'));
  assert.equal(f.control('连线颜色').value, 'green');
  assert.deepEqual(f.board, before);
  assert.equal(f.counts.changes, 0);
});

test('a cached toolbar keeps existing controls while checking current edge eligibility once', () => {
  const f = fixture(); f.view.renderSelectionTools();
  const color = f.control('连线颜色'), clears = f.host.clears;
  f.scans.length = 0;
  f.view.renderSelectionTools();
  assert.equal(f.scans.length, 1);
  assert.equal(f.control('连线颜色'), color);
  assert.equal(f.host.clears, clears);
});

test('lock changes invalidate a cached toolbar and reuse only the new render scan', () => {
  const f = fixture(); f.view.renderSelectionTools();
  const oldColor = f.control('连线颜色');
  f.board.nodes[0].locked = true;
  f.scans.length = 0;
  f.view.renderSelectionTools();
  assert.equal(f.scans.length, 1);
  assert.equal(oldColor.isConnected, false);
  assert.ok(f.control('连线 2'));
  f.changeColor();
  assert.equal(f.scans.length, 2, 'applying a change must independently revalidate live endpoints');
  assert.deepEqual(f.board.edges.map(edge => edge.color), ['green', 'blue', 'blue']);
});

test('an empty batch edge result is reused without an unnecessary fallback scan', () => {
  const f = fixture(); f.board.nodes.forEach(node => { node.locked = true; });
  f.view.renderSelectionTools();
  assert.equal(f.scans.length, 1);
  assert.ok(f.control('连线 0'));
  assert.ok(f.host.all().some(el => el.text === '此范围没有可修改的连线'));
});

test('direct toolbar construction still computes live edges without a prior render', () => {
  const f = fixture();
  f.view.buildSelectionTools();
  assert.equal(f.scans.length, 1);
  assert.ok(f.control('连线 3'));
  f.board.nodes[0].locked = true;
  f.view.buildSelectionTools();
  assert.equal(f.scans.length, 2);
  assert.ok(f.control('连线 2'));
});

test('a render snapshot cannot bypass later lock or reconnection checks in toolbar callbacks', () => {
  const f = fixture(5);
  f.view.selected = new Set(['n0', 'n1', 'n2', 'n3']);
  f.view.renderSelectionTools();
  f.board.nodes[0].locked = true;
  f.board.edges[1].to = 'n4';
  f.board.edges.push({id: 'new', from: 'n2', to: 'n3', label: '', color: 'rose'});
  const before = clone(f.board);
  f.scans.length = 0;
  f.changeColor();
  assert.equal(f.scans.length, 1);
  assert.equal(f.counts.changes, 1);
  assert.deepEqual(f.board.edges.map(edge => edge.color), ['green', 'green', 'blue', 'green', 'rose']);
  assert.deepEqual(f.board.nodes, before.nodes);
});

test('scope and owner changes invalidate controls before a stale snapshot can be applied', () => {
  for (const stale of ['scope', 'selection', 'owner']) {
    const f = fixture(); f.view.renderSelectionTools();
    const before = clone(f.board);
    if (stale === 'scope') f.view.batchEdgeScope = 'connected';
    if (stale === 'selection') f.view.selected = new Set(['n0', 'n1']);
    if (stale === 'owner') f.view.session = {board: emptyBoard()};
    f.scans.length = 0;
    if (stale === 'owner') assert.throws(() => f.changeColor()); else f.changeColor();
    assert.deepEqual(f.board, before);
    assert.equal(f.counts.changes, 0);
    assert.equal(f.scans.length, 0);
  }
});
