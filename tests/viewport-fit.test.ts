import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyBoard, fitViewport } from '../src/model';
import type { Card } from '../src/model';
import { fitViewportInSafeArea } from '../src/viewport-fit';
import type { ViewportInsets } from '../src/viewport-fit';

const card = (overrides: Partial<Card> = {}): Card => ({
  id: 'text', kind: 'text', text: 'Fit me', color: 'sand', x: -120, y: -80, width: 300, height: 180, ...overrides,
});
const nodes = [card(), card({ id: 'second', x: 460, y: 220, width: 240, height: 200 })];
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test('explicit fit clears measured top, side and bottom controls on narrow and large stages', () => {
  const cases: { width: number; height: number; insets: ViewportInsets }[] = [
    { width: 640, height: 480, insets: { left: 64, top: 138, right: 16, bottom: 62 } },
    { width: 1024, height: 720, insets: { left: 72, top: 112, right: 18, bottom: 70 } },
    { width: 2400, height: 1600, insets: { left: 84, top: 128, right: 24, bottom: 82 } },
  ];
  for (const { width, height, insets } of cases) {
    const viewport = fitViewportInSafeArea(nodes, width, height, insets);
    for (const node of nodes) {
      assert.ok(node.x * viewport.zoom + viewport.x >= insets.left + 50 - 1e-8);
      assert.ok(node.y * viewport.zoom + viewport.y >= insets.top + 50 - 1e-8);
      assert.ok((node.x + node.width) * viewport.zoom + viewport.x <= width - insets.right - 50 + 1e-8);
      assert.ok((node.y + node.height) * viewport.zoom + viewport.y <= height - insets.bottom - 50 + 1e-8);
    }
    close(((-120 + 700) / 2) * viewport.zoom + viewport.x, (insets.left + width - insets.right) / 2);
    close(((-80 + 420) / 2) * viewport.zoom + viewport.y, (insets.top + height - insets.bottom) / 2);
  }
});

test('zero insets preserve existing fit behavior and asymmetric insets offset the camera', () => {
  assert.deepEqual(fitViewportInSafeArea(nodes, 1000, 700), fitViewport(nodes, 1000, 700));
  const viewport = fitViewportInSafeArea(nodes, 1000, 700, { left: 90, top: 150, right: 10, bottom: 50 });
  const local = fitViewport(nodes, 900, 500);
  assert.deepEqual(viewport, { x: local.x + 90, y: local.y + 150, zoom: local.zoom });
});

test('invalid inset values are ignored and invalid stage sizes return a finite default view', () => {
  for (const invalid of [-10, NaN, Infinity, -Infinity]) {
    assert.deepEqual(fitViewportInSafeArea(nodes, 1000, 700, { left: invalid, top: invalid, right: invalid, bottom: invalid }), fitViewport(nodes, 1000, 700));
  }
  for (const invalid of [-10, 0, NaN, Infinity, -Infinity]) {
    assert.deepEqual(fitViewportInSafeArea(nodes, invalid, 700, { top: 120 }), emptyBoard().viewport);
    assert.deepEqual(fitViewportInSafeArea(nodes, 1000, invalid, { top: 120 }), emptyBoard().viewport);
  }
});

test('oversized chrome on a tiny stage retains a usable center without invalid camera values', () => {
  const one = card({ x: 0, y: 0, width: 100, height: 100 });
  for (const size of [0.5, 1, 8, 60]) {
    const viewport = fitViewportInSafeArea([one], size, size, { left: Number.MAX_VALUE, right: Number.MAX_VALUE, top: Number.MAX_VALUE, bottom: Number.MAX_VALUE });
    assert.ok(Object.values(viewport).every(Number.isFinite));
    assert.equal(viewport.zoom, .15);
    close(50 * viewport.zoom + viewport.x, size / 2);
    close(50 * viewport.zoom + viewport.y, size / 2);
  }
  const asymmetric = fitViewportInSafeArea([], 101, 101, { left: 80, right: 40, top: 40, bottom: 80 });
  close(asymmetric.x, 100 * 2 / 3 + .5);
  close(asymmetric.y, 100 / 3 + .5);
});

test('empty and entirely invalid boards place the default origin inside the safe area', () => {
  assert.deepEqual(fitViewportInSafeArea([], 1000, 700), { x: 60, y: 60, zoom: 1 });
  assert.deepEqual(fitViewportInSafeArea([], 1000, 700, { left: 70, top: 130 }), { x: 130, y: 190, zoom: 1 });
  const empty = fitViewportInSafeArea([], 20, 10, { left: 5, top: 3 });
  assert.deepEqual(empty, { x: 12.5, y: 6.5, zoom: 1 });
  assert.deepEqual(fitViewportInSafeArea([card({ width: -10 }), card({ height: NaN })], 20, 10, { left: 5, top: 3 }), empty);
});

test('bad geometry cannot hide valid cards and no node or input collection is mutated', () => {
  const good = Object.freeze(card());
  const bad = [card({ x: Infinity }), card({ width: -1 }), card({ y: NaN }), card({ x: Number.MAX_VALUE, width: Number.MAX_VALUE })];
  const frozen = Object.freeze([good, ...bad.map(node => Object.freeze(node))]);
  const before = structuredClone(frozen);
  const insets = Object.freeze({ top: 140, left: 70 });
  assert.deepEqual(fitViewportInSafeArea(frozen, 900, 700, insets), fitViewportInSafeArea([good], 900, 700, insets));
  assert.deepEqual(frozen, before);
  assert.deepEqual(insets, { top: 140, left: 70 });
});

test('fit preserves zoom limits and centers boards that cannot fit at minimum zoom', () => {
  assert.equal(fitViewportInSafeArea([card()], 4000, 3000, { top: 140 }).zoom, 1.3);
  const huge = card({ x: -50000, y: -40000, width: 100000, height: 80000 });
  const viewport = fitViewportInSafeArea([huge], 800, 600, { left: 70, top: 140, right: 10, bottom: 60 });
  assert.equal(viewport.zoom, .15);
  close(viewport.x, 430);
  close(viewport.y, 340);
});

test('extreme finite coordinate spans and stage measurements never produce NaN or infinity', () => {
  const distant = [card({ x: -Number.MAX_VALUE, y: -Number.MAX_VALUE }), card({ x: Number.MAX_VALUE, y: Number.MAX_VALUE })];
  for (const width of [1, 800, Number.MAX_VALUE]) {
    const viewport = fitViewportInSafeArea(distant, width, width, { left: Number.MAX_VALUE, top: Number.MAX_VALUE, right: Number.MAX_VALUE, bottom: Number.MAX_VALUE });
    assert.ok(Object.values(viewport).every(Number.isFinite));
    assert.ok(viewport.zoom >= .15 && viewport.zoom <= 1.3);
  }
});
