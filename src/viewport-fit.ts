import { emptyBoard, fitViewport } from './model';
import type { Board, Card } from './model';

/** Measured screen-space areas occupied by controls at the stage edges. */
export interface ViewportInsets { left: number; top: number; right: number; bottom: number }

function fitAxis(size: number, before = 0, after = 0) {
  before = Number.isFinite(before) && before > 0 ? Math.min(before, size) : 0;
  after = Number.isFinite(after) && after > 0 ? Math.min(after, size) : 0;
  const minimum = Math.min(1, size), budget = size - minimum;
  if (before > budget - after) {
    // Normalize before adding: even two finite measurements can overflow a sum.
    const scale = Math.max(before, after), first = before / scale, last = after / scale;
    const unit = budget / (first + last);
    before = first * unit;
    after = last * unit;
  }
  return { start: before, size: Math.max(minimum, size - before - after) };
}

/**
 * Explicit fit commands center content in the unobstructed stage rectangle.
 * Keep the model's 50px padding and .15–1.3 zoom limits; a board too large at
 * minimum zoom can still overflow, but remains centered in that rectangle.
 * Hidden/invalid stage dimensions fall back to the model's empty-board view.
 */
export function fitViewportInSafeArea(
  nodes: readonly Card[], width: number, height: number, insets: Partial<ViewportInsets> = {},
): Board['viewport'] {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return emptyBoard().viewport;
  const horizontal = fitAxis(width, insets.left, insets.right);
  const vertical = fitAxis(height, insets.top, insets.bottom);
  const empty = {
    x: horizontal.start + Math.min(60, horizontal.size / 2),
    y: vertical.start + Math.min(60, vertical.size / 2),
    zoom: 1,
  };
  // Ignore malformed nodes without editing the board or poisoning valid bounds.
  const valid = nodes.filter(node =>
    [node.x, node.y, node.width, node.height, node.x + node.width, node.y + node.height].every(Number.isFinite)
    && node.width > 0 && node.height > 0,
  );
  if (!valid.length) return empty;
  const viewport = fitViewport(valid, horizontal.size, vertical.size);
  const fitted = { x: viewport.x + horizontal.start, y: viewport.y + vertical.start, zoom: viewport.zoom };
  // Extreme finite coordinates can still overflow arithmetic in the shared model.
  return Object.values(fitted).every(Number.isFinite) ? fitted : empty;
}

/** Locate one object without changing zoom, using the same chrome bounds as fit. */
export function centerViewportInSafeArea(
  node: Pick<Card, 'x' | 'y' | 'width' | 'height'>, width: number, height: number,
  zoom: number, insets: Partial<ViewportInsets> = {},
): Board['viewport'] {
  const horizontal = fitAxis(width, insets.left, insets.right);
  const vertical = fitAxis(height, insets.top, insets.bottom);
  return {
    x: horizontal.start + horizontal.size / 2 - (node.x + node.width / 2) * zoom,
    y: vertical.start + vertical.size / 2 - (node.y + node.height / 2) * zoom,
    zoom,
  };
}
