import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Board, emptyBoard, parseBoard, boardLinks, wouldCycle, extractSubboard, tidyBoard, contained, canvasExport, removeNodes, History } from '../src/model';

function fixture(): Board {
  return { version: 2, viewport: { x: 0, y: 0, zoom: 1 }, nodes: [
    { id: 's', kind: 'section', title: '阅读', x: 0, y: 0, width: 800, height: 400, color: 'blue' },
    { id: 'a', kind: 'card', file: '资料/甲.md', x: 40, y: 60, width: 300, height: 260, color: 'sand' },
    { id: 'b', kind: 'board', file: '资料/深层.thoughtspace', x: 400, y: 60, width: 340, height: 265, color: 'green' },
    { id: 'c', kind: 'card', file: '资料/乙.md', x: 1100, y: 30, width: 300, height: 260, color: 'rose' }
  ], edges: [
    { id: 'inside', from: 'a', to: 'b', label: '深入研究' },
    { id: 'out', from: 'b', to: 'c', label: '支持' },
    { id: 'in', from: 'c', to: 'a', label: '问题' }
  ] };
}
test('Version 1 is read without mutation; version 2 round-trips nested boards', () => {
  const old = emptyBoard(); assert.equal(parseBoard(JSON.stringify(old)).version, 1);
  const b = fixture(); assert.deepEqual(parseBoard(JSON.stringify(b)), b);
  b.version = 1; assert.throws(() => parseBoard(JSON.stringify(b)));
});
test('Board references require a safe thoughtspace path', () => {
  for (const path of ['../secret.thoughtspace', '/root.thoughtspace', 'note.md', 'a/../../b.thoughtspace']) { const b = fixture(); b.nodes[2].file = path; assert.throws(() => parseBoard(JSON.stringify(b))); }
});
test('Cycles are rejected for self-reference and arbitrary descendant depth', () => {
  const graph = new Map([['A', ['B']], ['B', ['C']], ['C', ['D']], ['D', []]]);
  assert.equal(wouldCycle(graph, 'A', 'A'), true); assert.equal(wouldCycle(graph, 'D', 'A'), true);
  assert.equal(wouldCycle(graph, 'B', 'D'), false); assert.equal(wouldCycle(graph, 'E', 'B'), false);
});
test('Existing cyclic external graphs terminate; multiple parents are allowed', () => {
  const graph = new Map([['A', ['B']], ['B', ['A']], ['D', ['X']], ['E', ['X']]]);
  assert.equal(wouldCycle(graph, 'X', 'A'), false); assert.equal(wouldCycle(graph, 'E', 'X'), false);
});
test('Section extraction includes nested portals and preserves all relationships', () => {
  const original = fixture(), before = JSON.stringify(original);
  const { parent, child, portal } = extractSubboard(original, new Set(['s']), '新子板.thoughtspace', '阅读', 'portal');
  assert.equal(JSON.stringify(original), before);
  assert.deepEqual(child.nodes.map(n => n.id), ['s', 'a', 'b']);
  assert.deepEqual(child.edges.map(e => e.id), ['inside']);
  assert.deepEqual(parent.nodes.map(n => n.id), ['c', 'portal']);
  assert.equal(parent.edges[0].from, portal.id); assert.equal(parent.edges[0].to, 'c');
  assert.equal(parent.edges[1].from, 'c'); assert.equal(parent.edges[1].to, portal.id);
  assert.equal(child.nodes[1].x - child.nodes[0].x, 40);
  assert.deepEqual(parseBoard(JSON.stringify(parent)), parent);
  assert.deepEqual(parseBoard(JSON.stringify(child)), child);
});
test('Extracting selected cards upgrades parent while keeping external note paths', () => {
  const b = fixture(); const result = extractSubboard(b, new Set(['a']), '子.thoughtspace', '子', 'p');
  assert.equal(result.child.nodes[0].file, '资料/甲.md'); assert.equal(result.parent.version, 2);
  assert.equal(result.parent.edges.length, 3); assert.throws(() => extractSubboard(b, new Set(['missing']), '子.thoughtspace', '子'));
});
test('Undo extraction restores exact original layout and redo retains the child reference', () => {
  const b = fixture(), h = new History(); h.push(b);
  const result = extractSubboard(b, new Set(['s']), '子.thoughtspace', '子', 'p');
  const undo = h.undo(result.parent)!; assert.deepEqual(undo, b);
  assert.equal(h.redo(undo)!.nodes.find(n => n.id === 'p')!.file, '子.thoughtspace');
});
test('Deleting a portal removes only its reference and incident edges', () => {
  const b = fixture(); removeNodes(b, new Set(['b'])); assert.equal(b.nodes.length, 3); assert.deepEqual(b.edges.map(e => e.id), ['in']);
});
test('Nested portals participate in containment and Canvas file export', () => {
  const b = fixture(); assert.equal(contained(b.nodes[0], b.nodes[2]), true); assert.deepEqual(boardLinks(b), ['资料/深层.thoughtspace']);
  const n = canvasExport(b).nodes.find(n => n.id === 'b')!; assert.equal(n.type, 'file'); assert.ok('file' in n); assert.equal(n.file, '资料/深层.thoughtspace');
});
test('Tidy moves a section and its cards together without changing references or edges', () => {
  const b = fixture(), originalEdges = JSON.stringify(b.edges); tidyBoard(b);
  const s = b.nodes[0]; assert.equal(b.nodes[1].x - s.x, 40); assert.equal(b.nodes[2].y - s.y, 60);
  assert.equal(JSON.stringify(b.edges), originalEdges); assert.equal(b.nodes[2].file, '资料/深层.thoughtspace');
  assert.ok(b.nodes[3].x >= s.x + s.width + 60); assert.deepEqual(parseBoard(JSON.stringify(b)), b);
});
test('Tidy selected cards leaves unselected nodes untouched', () => {
  const b = fixture(); const original = JSON.stringify(b.nodes[0]); tidyBoard(b, new Set(['a', 'c']));
  assert.equal(JSON.stringify(b.nodes[0]), original); assert.equal(b.nodes[1].y, b.nodes[3].y);
});
