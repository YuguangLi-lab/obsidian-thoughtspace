import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {clone, colorNames, emptyBoard, History, type Board} from '../src/model';
import {patchSelectionEdges, selectionEdges} from '../src/selection-edges';

const source = readFileSync('src/main.ts', 'utf8');
const start = source.indexOf('  private buildBatchEdgeTools(');
assert.ok(start > 0, 'test must exercise the real batch toolbar implementation');
const method = source.slice(start, source.indexOf('  private renderSelectionTools()', start));
const createView = new Function('act', 'colorNames', 'selectionEdges', 'patchSelectionEdges',
  transformSync(`class View {${method}}\nreturn View;`, {loader: 'ts'}).code);

class Element {
  children: Element[] = [];
  parent?: Element;
  attrs: Record<string, string> = {};
  value = '';
  text = '';
  disabled = false;
  attached = true;
  onchange?: () => void;
  constructor(public tag = 'div') {}
  get isConnected(): boolean { return this.attached && (!this.parent || this.parent.isConnected); }
  createEl(tag: string, options: any = {}): Element {
    const child = new Element(tag);
    child.parent = this;
    child.value = options.value ?? '';
    child.text = options.text ?? '';
    child.attrs = options.attr ?? {};
    this.children.push(child);
    return child;
  }
  createSpan(options: any): Element { return this.createEl('span', options); }
  empty(): void { for (const child of this.children) child.attached = false; this.children = []; }
  all(): Element[] { return [this, ...this.children.flatMap(child => child.all())]; }
}

function fixture(options: {blocked?: boolean; empty?: boolean} = {}) {
  const errors: unknown[] = [];
  const View = createView((run: () => unknown) => { try { return run(); } catch (error) { errors.push(error); } }, colorNames, selectionEdges, patchSelectionEdges);
  const view = new View(), board = emptyBoard();
  board.version = 3;
  board.nodes = ['a', 'b', 'c', 'd'].map((id, i) => ({id, kind: 'card', file: `${id}.md`, x: i * 240, y: 0, width: 220, height: 160, color: 'green'}));
  board.edges = options.empty ? [] : [
    {id: 'ab', from: 'a', to: 'b', label: 'supports', style: 'curve', color: 'green', kind: 'branch'},
    {id: 'bc', from: 'b', to: 'c', label: 'evidence', style: 'straight', color: 'rose'},
    {id: 'cd', from: 'c', to: 'd', label: 'outside', color: 'blue'}
  ];
  const history = new History(), host = new Element();
  let transactions = 0, renders = 0, edgeRenders = 0;
  const owner = {
    board, blocked: !!options.blocked,
    change(run: (board: Board) => void) { if (this.blocked) throw Error('blocked'); transactions++; history.push(this.board); run(this.board); }
  };
  view.session = owner;
  view.selected = new Set(['a', 'b', 'c']);
  view.batchFormatTarget = 'edges';
  view.batchEdgeScope = 'internal';
  view.requireOwner = (expected: unknown) => { if (expected !== view.session) throw Error('board changed'); return expected; };
  const rebuild = () => {
    host.empty();
    view.buildBatchEdgeTools(host, view.session, new Set(view.selected), selectionEdges(view.session.board, view.selected, view.batchEdgeScope));
  };
  view.renderSelectionTools = () => { renders++; rebuild(); };
  view.renderEdges = () => { edgeRenders++; };
  rebuild();
  const control = (label: string) => {
    const input = host.all().find(element => element.tag === 'select' && element.attrs['aria-label'] === label);
    assert.ok(input, `missing control: ${label}`);
    return input;
  };
  const change = (input: Element, value: string) => { input.value = value; input.onchange?.(); };
  return {view, owner, board, host, history, errors, rebuild, control, change, counts: () => ({transactions, renders, edgeRenders})};
}

test('batch toolbar represents mixed paths and colors without selecting a misleading value', () => {
  const f = fixture();
  for (const label of ['连线路径', '连线颜色']) {
    const input = f.control(label);
    assert.equal(input.value, '');
    assert.ok(input.children.some(option => option.value === '' && option.text === '混合' && option.disabled));
  }
  assert.equal(f.control('连线方向').value, 'forward');
  assert.equal(f.control('连线线型').value, 'solid');
  assert.equal(f.counts().transactions, 0);
});

test('one toolbar change patches all internal links in one undo transaction and preserves outside links', () => {
  const f = fixture(), before = clone(f.board);
  f.change(f.control('连线路径'), 'elbow');
  assert.equal(f.counts().transactions, 1);
  assert.deepEqual(f.board.edges.map(edge => edge.style), ['elbow', 'elbow', undefined]);
  assert.deepEqual(f.board.nodes, before.nodes);
  assert.deepEqual(f.board.edges[2], before.edges[2]);
  assert.equal(f.board.edges[0].kind, 'branch');
  assert.deepEqual(f.history.undo(f.board), before);
});

test('connected scope rebuilds the controls and allows explicitly including external links', () => {
  const f = fixture(), staleColor = f.control('连线颜色');
  f.change(f.control('批量连线范围'), 'connected');
  assert.equal(f.view.batchEdgeScope, 'connected');
  assert.deepEqual(f.counts(), {transactions: 0, renders: 1, edgeRenders: 1});
  assert.equal(staleColor.isConnected, false);
  f.change(f.control('连线颜色'), 'purple');
  assert.deepEqual(f.board.edges.map(edge => edge.color), ['purple', 'purple', 'purple']);
  assert.equal(f.counts().transactions, 1);
});

test('default color deletes overrides on all targets and keeps unselected colors', () => {
  const f = fixture();
  f.change(f.control('连线颜色'), 'default');
  assert.ok(f.board.edges.slice(0, 2).every(edge => !Object.hasOwn(edge, 'color')));
  assert.equal(f.board.edges[2].color, 'blue');
  assert.equal(f.counts().transactions, 1);
});

test('directions and solid line settings apply actual boolean and union values', () => {
  const f = fixture();
  f.change(f.control('连线方向'), 'both');
  f.change(f.control('连线线型'), 'dashed');
  assert.ok(f.board.edges.slice(0, 2).every(edge => edge.direction === 'both' && edge.dashed === true));
  f.change(f.control('连线线型'), 'solid');
  assert.ok(f.board.edges.slice(0, 2).every(edge => edge.dashed === false));
  assert.equal(f.board.edges[2].direction, undefined);
  assert.equal(f.board.edges[2].dashed, undefined);
});

test('newly locked endpoints are skipped even when the native select was already open', () => {
  const f = fixture(), before = clone(f.board.edges[0]);
  f.board.nodes[0].locked = true;
  f.change(f.control('连线路径'), 'elbow');
  assert.deepEqual(f.board.edges[0], before);
  assert.equal(f.board.edges[1].style, 'elbow');
});

test('a reconnected edge that leaves the selected internal scope is not changed', () => {
  const f = fixture();
  f.board.edges[0].to = 'd';
  const before = clone(f.board.edges[0]);
  f.change(f.control('连线颜色'), 'red');
  assert.deepEqual(f.board.edges[0], before);
  assert.equal(f.board.edges[1].color, 'red');
});

test('links added after the toolbar was opened are not included accidentally', () => {
  const f = fixture();
  f.board.edges.push({id: 'ac', from: 'a', to: 'c', label: 'new', color: 'cyan'});
  f.change(f.control('连线颜色'), 'purple');
  assert.equal(f.board.edges[3].color, 'cyan');
  assert.equal(f.board.edges[0].color, 'purple');
});

test('detached controls cannot change documents or current scope', () => {
  const f = fixture(), color = f.control('连线颜色'), scope = f.control('批量连线范围'), before = clone(f.board);
  f.rebuild();
  f.change(color, 'purple');
  f.change(scope, 'connected');
  assert.deepEqual(f.board, before);
  assert.equal(f.view.batchEdgeScope, 'internal');
  assert.deepEqual(f.counts(), {transactions: 0, renders: 0, edgeRenders: 0});
});

test('changing the board owner invalidates all old toolbar callbacks', () => {
  const f = fixture(), before = clone(f.board);
  f.view.session = {board: emptyBoard(), blocked: false, change: () => assert.fail('new board must not be touched')};
  f.change(f.control('连线颜色'), 'purple');
  f.change(f.control('批量连线范围'), 'connected');
  assert.deepEqual(f.board, before);
  assert.equal(f.view.batchEdgeScope, 'internal');
  assert.deepEqual(f.counts(), {transactions: 0, renders: 0, edgeRenders: 0});
});

test('a different selection with the same cardinality invalidates old controls and scope callbacks', () => {
  const f = fixture(), before = clone(f.board);
  f.view.selected = new Set(['a', 'b', 'd']);
  f.change(f.control('连线颜色'), 'purple');
  f.change(f.control('批量连线范围'), 'connected');
  assert.deepEqual(f.board, before);
  assert.equal(f.view.batchEdgeScope, 'internal');
  assert.deepEqual(f.counts(), {transactions: 0, renders: 0, edgeRenders: 0});
});

test('switching from edges to object formatting invalidates prior edge controls', () => {
  const f = fixture(), before = clone(f.board);
  f.view.batchFormatTarget = 'nodes';
  f.change(f.control('连线颜色'), 'purple');
  f.change(f.control('批量连线范围'), 'connected');
  assert.deepEqual(f.board, before);
  assert.equal(f.view.batchEdgeScope, 'internal');
  assert.deepEqual(f.counts(), {transactions: 0, renders: 0, edgeRenders: 0});
});

test('old style controls cannot apply after an external scope change', () => {
  const f = fixture(), before = clone(f.board);
  f.view.batchEdgeScope = 'connected';
  f.change(f.control('连线颜色'), 'purple');
  assert.deepEqual(f.board, before);
  assert.equal(f.counts().transactions, 0);
});

test('an empty selection range still offers scope switching without editable style controls', () => {
  const f = fixture({empty: true});
  assert.equal(f.host.all().filter(element => element.tag === 'select').length, 1);
  assert.ok(f.host.all().some(element => element.text === '此范围没有可修改的连线'));
  f.change(f.control('批量连线范围'), 'connected');
  assert.equal(f.view.batchEdgeScope, 'connected');
  assert.equal(f.counts().transactions, 0);
});

test('blocked boards disable style controls and arbitrary scope values are rejected', () => {
  const f = fixture({blocked: true}), before = clone(f.board);
  assert.equal(f.control('连线颜色').disabled, true);
  f.change(f.control('连线颜色'), 'purple');
  f.change(f.control('批量连线范围'), 'unexpected');
  assert.deepEqual(f.board, before);
  assert.equal(f.view.batchEdgeScope, 'internal');
  assert.deepEqual(f.counts(), {transactions: 0, renders: 0, edgeRenders: 0});
});
