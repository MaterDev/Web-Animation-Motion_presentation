/* Boolean/palette-index grid predicates, ported from
   design/graphic-language/index.html's icon system (circle/rect/line
   composed on a fixed grid, painted a cell at a time) — same reasoning
   applies to sprite frames as to icons: a hand-typed bitmap comes out
   lopsided, math doesn't. Extended here from boolean (on/off) cells to
   palette-index cells, since a sprite needs more than one ink color. */

export function blankGrid(size, fill = -1) {
  return Array.from({ length: size }, () => Array(size).fill(fill));
}

export function circle(g, size, cx, cy, r, idx) {
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++)
    if (Math.hypot(x - cx, y - cy) <= r) g[y][x] = idx;
  return g;
}

export function ellipse(g, size, cx, cy, rx, ry, idx) {
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (x - cx) / rx, dy = (y - cy) / ry;
    if (dx * dx + dy * dy <= 1) g[y][x] = idx;
  }
  return g;
}

export function rect(g, size, x0, y0, w, h, idx) {
  for (let y = Math.round(y0); y < Math.round(y0 + h); y++)
    for (let x = Math.round(x0); x < Math.round(x0 + w); x++)
      if (x >= 0 && x < size && y >= 0 && y < size) g[y][x] = idx;
  return g;
}

export function dot(g, size, x, y, idx) {
  const xi = Math.round(x), yi = Math.round(y);
  if (xi >= 0 && xi < size && yi >= 0 && yi < size) g[yi][xi] = idx;
  return g;
}

/** Render a palette-index grid to a flat RGBA Uint8Array (top-left origin). */
export function toRGBA(grid, size, palette, bg = [0, 0, 0, 0]) {
  const out = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const idx = grid[y][x];
    const [r, g, b, a] = idx >= 0 ? palette[idx] : bg;
    const o = (y * size + x) * 4;
    out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = a;
  }
  return out;
}

/** Nearest-neighbour upscale of an RGBA buffer — keeps pixel edges crisp. */
export function upscale(rgba, size, scale) {
  const outSize = size * scale;
  const out = new Uint8Array(outSize * outSize * 4);
  for (let y = 0; y < outSize; y++) for (let x = 0; x < outSize; x++) {
    const sx = (x / scale) | 0, sy = (y / scale) | 0;
    const si = (sy * size + sx) * 4, di = (y * outSize + x) * 4;
    out[di] = rgba[si]; out[di + 1] = rgba[si + 1]; out[di + 2] = rgba[si + 2]; out[di + 3] = rgba[si + 3];
  }
  return out;
}

/* ── frame framing ──────────────────────────────────────────
   Shared by the GIF bake AND the in-browser frame previewer, so what
   the preview shows is what the bake writes. Defined here rather than
   in the bake script precisely because two copies would drift. */

/** Tightest box containing lit cells across EVERY frame. Union, not
    per-frame: cropping each frame to its own bounds would make the
    character jitter and rescale as its own effects fire. */
export function unionBounds(frames, size) {
  let minX = size, minY = size, maxX = -1, maxY = -1;
  for (const g of frames) {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (g[y][x] < 0) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return { minX, minY, maxX, maxY };
}

/** Side length of the square canvas a cropped frame set lands in. */
export function cropSide(b, margin) {
  return Math.max(b.maxX - b.minX + 1, b.maxY - b.minY + 1) + margin * 2;
}

/** Crop one frame to `b` and re-centre it in a `side`×`side` square. */
export function cropToSquare(grid, b, side) {
  const w = b.maxX - b.minX + 1, h = b.maxY - b.minY + 1;
  const offX = Math.round((side - w) / 2), offY = Math.round((side - h) / 2);
  const out = Array.from({ length: side }, () => Array(side).fill(-1));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = grid[b.minY + y][b.minX + x];
    if (v >= 0) out[offY + y][offX + x] = v;
  }
  return out;
}

/** Ease helpers for keyframing sprite motion across a frame count. */
export const ease = {
  linear: t => t,
  inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  outBounce: t => {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};
