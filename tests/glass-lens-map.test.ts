import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGlassLensMap, type GlassLensMap } from '../src/glass-lens-map';

function pixel(map: GlassLensMap, x: number, y: number): number[] {
  const index = (y * map.mapW + x) * 4;
  return Array.from(map.data.subarray(index, index + 4));
}

test('invalid dimensions and disabled bands produce a tiny neutral map', () => {
  for (const invalid of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    for (const dimensions of [{ width: invalid, height: 60 }, { width: 120, height: invalid }]) {
      const map = createGlassLensMap(dimensions);
      assert.deepEqual({ w: map.mapW, h: map.mapH, scale: map.scale }, { w: 1, h: 1, scale: 0 });
      assert.deepEqual(Array.from(map.data), [128, 128, 128, 255]);
    }
  }
  for (const edgeBand of [0, -5]) assert.equal(createGlassLensMap({ width: 120, height: 60, edgeBand }).scale, 0);
});

test('allocation and encoded strength stay bounded for tiny, wide and enormous surfaces', () => {
  for (const [width, height] of [[0.1, 0.1], [1, 50], [80, 40], [1200, 72], [100000, 100000], [Number.MAX_VALUE, 200]]) {
    const map = createGlassLensMap({ width, height });
    assert.ok(map.mapW > 0 && map.mapW <= 128);
    assert.ok(map.mapH > 0 && map.mapH <= 128);
    assert.equal(map.data.length, map.mapW * map.mapH * 4);
    assert.ok(map.data.byteLength <= 65536);
    assert.ok(Number.isFinite(map.scale) && map.scale >= 0 && map.scale <= 8);
    for (let i = 0; i < map.data.length; i += 4) {
      assert.equal(map.data[i + 2], 128);
      assert.equal(map.data[i + 3], 255);
    }
  }
});

test('rounded glass has a readable neutral center, neutral outside corners and neutral outline', () => {
  const map = createGlassLensMap({ width: 96, height: 64, radius: 16, edgeBand: 12 });
  assert.ok(map.scale > 0);
  for (let y = 0; y < map.mapH; y++) {
    assert.deepEqual(pixel(map, 0, y), [128, 128, 128, 255]);
    assert.deepEqual(pixel(map, map.mapW - 1, y), [128, 128, 128, 255]);
  }
  for (let x = 0; x < map.mapW; x++) {
    assert.deepEqual(pixel(map, x, 0), [128, 128, 128, 255]);
    assert.deepEqual(pixel(map, x, map.mapH - 1), [128, 128, 128, 255]);
  }
  for (let y = 20; y <= 44; y++) for (let x = 24; x <= 72; x++) {
    assert.deepEqual(pixel(map, x, y), [128, 128, 128, 255]);
  }
  assert.deepEqual(pixel(map, 3, 3), [128, 128, 128, 255]);
  assert.deepEqual(pixel(map, 6, 32), [255, 128, 128, 255]);
  assert.deepEqual(pixel(map, 48, 6), [128, 255, 128, 255]);
});

test('horizontal and vertical vectors mirror exactly, including rounded corners', () => {
  for (const geometry of [
    { width: 96, height: 64, radius: 16 },
    { width: 200, height: 75, radius: 20 },
    { width: 87, height: 53, radius: 0 },
  ]) {
    const map = createGlassLensMap(geometry);
    for (let y = 0; y < map.mapH; y++) for (let x = 0; x < map.mapW; x++) {
      const p = pixel(map, x, y), horizontal = pixel(map, map.mapW - 1 - x, y), vertical = pixel(map, x, map.mapH - 1 - y);
      assert.equal(p[0] + horizontal[0], 256);
      assert.equal(p[1], horizontal[1]);
      assert.equal(p[0], vertical[0]);
      assert.equal(p[1] + vertical[1], 256);
    }
  }
});

test('edge profile eases in from the neutral outline and back to the neutral content', () => {
  const map = createGlassLensMap({ width: 96, height: 64, radius: 16, edgeBand: 12 });
  const values = Array.from({ length: 13 }, (_, x) => pixel(map, x, 32)[0] - 128);
  assert.equal(values[0], 0);
  assert.equal(values[12], 0);
  assert.ok(values[1] > 0 && values[1] < values[2] / 2);
  assert.equal(values[6], 127);
  for (let x = 0; x <= 6; x++) assert.equal(values[x], values[12 - x]);
  // A rounded corner carries both components; its direction approaches the
  // adjoining straight edge without flipping either component.
  const diagonal = pixel(map, 9, 9);
  assert.ok(diagonal[0] > 128 && diagonal[1] > 128);
  assert.equal(diagonal[0], diagonal[1]);
});

test('radius is clamped, nonfinite optional geometry is normalized, and output owns its buffer', () => {
  const geometry = { width: 60, height: 40, radius: 1000, edgeBand: 1000 };
  const result = createGlassLensMap(geometry);
  assert.deepEqual(result, createGlassLensMap({ width: 60, height: 40, radius: 20, edgeBand: 20 }));
  assert.deepEqual(createGlassLensMap({ width: 60, height: 40, radius: Number.NaN, edgeBand: Number.NaN }), createGlassLensMap({ width: 60, height: 40 }));
  const second = createGlassLensMap(geometry);
  result.data[0] = 0;
  assert.equal(second.data[0], 128);
  assert.deepEqual(geometry, { width: 60, height: 40, radius: 1000, edgeBand: 1000 });
});
