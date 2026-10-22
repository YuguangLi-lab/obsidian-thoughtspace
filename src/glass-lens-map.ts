/** CSS-pixel geometry; this module never reads or captures page content. */
export interface GlassLensMapOptions {
  width: number;
  height: number;
  radius?: number;
  edgeBand?: number;
}

export interface GlassLensMap {
  mapW: number;
  mapH: number;
  /** RGBA bytes: R = horizontal displacement, G = vertical displacement. */
  data: Uint8ClampedArray;
  /** Pass to SVG feDisplacementMap.scale; at most 8 CSS pixels. */
  scale: number;
}

const MAX_MAP_SIDE = 128;
const NEUTRAL = 128;

function neutralMap(): GlassLensMap {
  return { mapW: 1, mapH: 1, data: new Uint8ClampedArray([NEUTRAL, NEUTRAL, NEUTRAL, 255]), scale: 0 };
}

/**
 * A small rounded-rectangle lens displacement map for an SVG image input.
 *
 * Only the inner edge band refracts. The outside, exact outline, and readable
 * center remain neutral. A quartic envelope has zero slope at both ends of the
 * band, so the sampled displacement can be smoothly interpolated into either.
 * Vectors point inward: an edge pixel samples nearer the center of the lens.
 *
 * Width/height must be positive and finite; otherwise a disabled neutral map is
 * returned. Radius defaults to 16px and is clamped to half the shorter side.
 * The band defaults to 12px; it cannot exceed half the shorter side or a nonzero
 * corner radius. A zero/negative band disables the map. No dimension can make
 * the output larger than 128 × 128 × 4 bytes (64 KiB).
 *
 * SVG's exact mathematical midpoint is 127.5, while an 8-bit map needs a byte.
 * We use the conventional neutral 128; its residual offset is at most 0.016px
 * at scale 8. Signed channel values are mirrored around this byte midpoint.
 */
export function createGlassLensMap(options: GlassLensMapOptions): GlassLensMap {
  const { width, height } = options;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return neutralMap();

  const halfW = width / 2, halfH = height / 2;
  const halfShort = Math.min(halfW, halfH);
  const requestedRadius = Number.isFinite(options.radius) ? options.radius! : 16;
  const radius = Math.max(0, Math.min(halfShort, requestedRadius));
  const requestedBand = Number.isFinite(options.edgeBand) ? options.edgeBand! : 12;
  const band = Math.min(requestedBand, halfShort, radius > 0 ? radius : halfShort);
  if (band <= 0) return neutralMap();

  const samplingStep = Math.max(1, Math.max(width, height) / (MAX_MAP_SIDE - 1));
  const mapW = Math.min(MAX_MAP_SIDE, Math.max(3, Math.ceil(width / samplingStep) + 1));
  const mapH = Math.min(MAX_MAP_SIDE, Math.max(3, Math.ceil(height / samplingStep) + 1));
  const data = new Uint8ClampedArray(mapW * mapH * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = data[i + 1] = data[i + 2] = NEUTRAL;
    data[i + 3] = 255;
  }

  let displaced = false;
  // Compute one quadrant and mirror encoded bytes, preserving exact symmetry
  // without relying on floating-point equality at opposite edges.
  for (let y = 0; y < Math.ceil(mapH / 2); y++) {
    const absY = halfH - y / (mapH - 1) * height;
    for (let x = 0; x < Math.ceil(mapW / 2); x++) {
      const absX = halfW - x / (mapW - 1) * width;
      const qx = absX - (halfW - radius), qy = absY - (halfH - radius);
      const outsideX = Math.max(qx, 0), outsideY = Math.max(qy, 0);
      const outsideLength = Math.hypot(outsideX, outsideY);
      const distance = outsideLength + Math.min(Math.max(qx, qy), 0) - radius;
      if (distance >= 0 || distance <= -band) continue;

      let nx: number, ny: number;
      if (outsideLength > 0) {
        nx = outsideX / outsideLength;
        ny = outsideY / outsideLength;
      } else {
        // A requested square corner has no unique normal at its diagonal.
        // Blend the two adjacent edge normals locally instead of introducing
        // a direction jump. Rounded corners use the exact circle normal above.
        const blendWidth = Math.max(Number.EPSILON, band / 4);
        const blend = Math.max(0, Math.min(1, 0.5 + (qx - qy) / (2 * blendWidth)));
        const horizontal = blend * blend * (3 - 2 * blend);
        const normalLength = Math.hypot(horizontal, 1 - horizontal);
        nx = horizontal / normalLength;
        ny = (1 - horizontal) / normalLength;
      }
      const t = -distance / band;
      const envelope = 16 * t * t * (1 - t) * (1 - t);
      const dx = absX === 0 ? 0 : Math.round(127 * envelope * nx);
      const dy = absY === 0 ? 0 : Math.round(127 * envelope * ny);
      if (dx === 0 && dy === 0) continue;
      displaced = true;

      const mirrorX = mapW - 1 - x, mirrorY = mapH - 1 - y;
      const upperLeft = (y * mapW + x) * 4;
      const upperRight = (y * mapW + mirrorX) * 4;
      const lowerLeft = (mirrorY * mapW + x) * 4;
      const lowerRight = (mirrorY * mapW + mirrorX) * 4;
      data[upperLeft] = data[lowerLeft] = NEUTRAL + dx;
      data[upperRight] = data[lowerRight] = NEUTRAL - dx;
      data[upperLeft + 1] = data[upperRight + 1] = NEUTRAL + dy;
      data[lowerLeft + 1] = data[lowerRight + 1] = NEUTRAL - dy;
    }
  }

  return { mapW, mapH, data, scale: displaced ? Math.min(8, band) : 0 };
}
