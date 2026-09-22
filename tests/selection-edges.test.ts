import test from 'node:test';
import assert from 'node:assert/strict';
import {clone, emptyBoard, History, parseBoard, type Board, type Card} from '../src/model';
import {patchSelectionEdges, selectionEdges, type SelectionEdgePatch} from '../src/selection-edges';

function fixture(): Board {
  const board = emptyBoard();
  board.version = 3;
  board.nodes = ['a', 'b', 'c', 'd'].map((id, i): Card => ({
    id, kind: 'card', file: `${id}.md`, x: i * 240, y: 0, width: 220, height: 160, color: 'green'
  }));
  board.edges = [
    {id: 'ab', from: 'a', to: 'b', label: 'supports', kind: 'branch', fromSide: 'right', toSide: 'left'},
    {id: 'bc', from: 'b', to: 'c', label: 'evidence'},
    {id: 'da', from: 'd', to: 'a', label: 'reference'},
    {id: 'cd', from: 'c', to: 'd', label: 'outside'}
  ];
  return board;
}

const ids = (board: Board, selected: string[], scope?: 'internal' | 'connected') => selectionEdges(board, new Set(selected), scope).map(edge => edge.id);

test('marquee links default to both selected endpoints; connected scope includes both directions', () => {
  const board = fixture();
  assert.deepEqual(ids(board, ['a', 'b']), ['ab']);
  assert.deepEqual(ids(board, ['a', 'b'], 'connected'), ['ab', 'bc', 'da']);
  assert.deepEqual(ids(board, ['a']), []);
  assert.deepEqual(ids(board, ['a'], 'connected'), ['ab', 'da']);
  assert.deepEqual(ids(board, [], 'connected'), []);
  assert.deepEqual(ids(board, ['deleted']), []);
});

test('candidate links exclude locked, missing and self-referencing endpoints without modifying the board', () => {
  const board = fixture();
  board.nodes[1].locked = true;
  board.edges.push({id: 'orphan', from: 'a', to: 'missing', label: ''}, {id: 'self', from: 'a', to: 'a', label: ''});
  const before = clone(board);
  assert.deepEqual(ids(board, ['a', 'b', 'missing'], 'connected'), ['da']);
  assert.deepEqual(board, before);
});

test('folded descendants and their crossing relations are omitted while visible folded roots remain editable', () => {
  const board = fixture();
  board.nodes[0].branchFolded = true;
  assert.deepEqual(ids(board, ['a', 'b', 'c', 'd']), ['da', 'cd']);
  assert.deepEqual(ids(board, ['b'], 'connected'), []);
  assert.deepEqual(ids(board, ['a'], 'connected'), ['da']);
});

test('batch patch changes only selected visual fields, preserving branches, anchors, labels and global defaults', () => {
  const board = fixture();
  board.defaultEdgeStyle = 'curve';
  const before = clone(board), selected = new Set(['ab', 'bc']);
  assert.equal(patchSelectionEdges(board, selected, {style: 'straight', direction: 'both', dashed: true, color: 'purple'}), 2);
  assert.deepEqual(board.nodes, before.nodes);
  assert.deepEqual(board.edges.slice(2), before.edges.slice(2));
  assert.equal(board.defaultEdgeStyle, 'curve');
  for (let i = 0; i < 2; i++) assert.deepEqual(board.edges[i], {...before.edges[i], style: 'straight', direction: 'both', dashed: true, color: 'purple'});
  assert.deepEqual(parseBoard(JSON.stringify(board)), board);
});

test('resetting color removes the property, preserves other styles and survives serialization', () => {
  const board = fixture();
  board.edges[0] = {...board.edges[0], color: 'rose', style: 'elbow', dashed: true};
  assert.equal(patchSelectionEdges(board, new Set(['ab']), {color: undefined}), 1);
  assert.equal(Object.hasOwn(board.edges[0], 'color'), false);
  assert.equal(board.edges[0].style, 'elbow');
  assert.equal(board.edges[0].dashed, true);
  assert.deepEqual(parseBoard(JSON.stringify(board)), board);
  assert.equal(patchSelectionEdges(board, new Set(['ab']), {color: undefined}), 0);
});

test('apply rechecks endpoints after selection rather than retaining stale node objects', () => {
  for (const change of ['locked', 'deleted', 'folded', 'edge-deleted'] as const) {
    const board = fixture(), selected = new Set(selectionEdges(board, new Set(['a', 'b'])).map(edge => edge.id));
    if (change === 'locked') board.nodes[1].locked = true;
    else if (change === 'deleted') board.nodes = board.nodes.filter(node => node.id !== 'b');
    else if (change === 'folded') board.nodes[0].branchFolded = true;
    else board.edges = board.edges.filter(edge => edge.id !== 'ab');
    const before = clone(board);
    assert.equal(patchSelectionEdges(board, selected, {color: 'red'}), 0, change);
    assert.deepEqual(board, before, change);
  }
});

test('partially stale selections still update remaining valid edges only once', () => {
  const board = fixture();
  board.nodes[1].locked = true;
  assert.equal(patchSelectionEdges(board, new Set(['ab', 'bc', 'da', 'missing']), {dashed: false}), 1);
  assert.equal(Object.hasOwn(board.edges[0], 'dashed'), false);
  assert.equal(Object.hasOwn(board.edges[1], 'dashed'), false);
  assert.equal(board.edges[2].dashed, false);
  assert.equal(Object.hasOwn(board.edges[3], 'dashed'), false);
});

test('one history entry restores the entire batch and redo, including deleted default-color fields', () => {
  const board = fixture(), history = new History();
  board.edges[0].color = 'sand';
  const before = clone(board);
  history.push(board);
  patchSelectionEdges(board, new Set(['ab', 'bc']), {color: undefined, style: 'straight', direction: 'none'});
  const after = clone(board), undone = history.undo(board)!;
  assert.deepEqual(undone, before);
  assert.deepEqual(history.redo(undone), after);
  assert.deepEqual(parseBoard(JSON.stringify(after)), after);
});

test('unchanged or empty patches do not dirty the document or migrate its version', () => {
  const board = fixture();
  board.version = 1;
  delete board.edges[0].kind;
  delete board.edges[0].fromSide;
  delete board.edges[0].toSide;
  const before = clone(board);
  assert.equal(patchSelectionEdges(board, new Set(['ab']), {}), 0);
  assert.equal(patchSelectionEdges(board, new Set(), {color: 'blue'}), 0);
  assert.equal(patchSelectionEdges(board, new Set(['ab']), {color: undefined}), 0);
  assert.deepEqual(board, before);
  assert.equal(patchSelectionEdges(board, new Set(['ab']), {color: 'blue'}), 1);
  assert.equal(board.version, 3);
  assert.equal(patchSelectionEdges(board, new Set(['ab']), {color: 'blue'}), 0);
  assert.deepEqual(parseBoard(JSON.stringify(board)), board);
});

test('unexpected structural fields never leak through a JavaScript caller', () => {
  const board = fixture(), before = clone(board);
  const patch = {color: 'cyan', id: 'rewritten', from: 'd', to: 'c', label: 'changed', kind: undefined} as SelectionEdgePatch;
  patchSelectionEdges(board, new Set(['ab']), patch);
  assert.deepEqual(board.edges[0], {...before.edges[0], color: 'cyan'});
});

test('invalid visual input rejects atomically before valid fields can be applied', () => {
  const board = fixture(), before = clone(board);
  assert.throws(() => patchSelectionEdges(board, new Set(['ab', 'bc']), {style: 'straight', color: '#bad'} as unknown as SelectionEdgePatch), /连线样式无效/);
  assert.deepEqual(board, before);
});

test('large deep folded trees stay iterative and do not modify hidden descendants', () => {
  const board = fixture();
  board.nodes = Array.from({length: 12000}, (_, i) => ({...board.nodes[0], id: String(i)}));
  board.edges = board.nodes.slice(1).map((node, i) => ({id: `e${i}`, from: String(i), to: node.id, kind: 'branch', label: ''}));
  const all = new Set(board.nodes.map(node => node.id));
  assert.equal(selectionEdges(board, all).length, 11999);
  board.nodes[1].branchFolded = true;
  assert.deepEqual(ids(board, [...all]), ['e0']);
  assert.equal(patchSelectionEdges(board, new Set(board.edges.map(edge => edge.id)), {style: 'elbow'}), 1);
  assert.equal(board.edges[1].style, undefined);
});
