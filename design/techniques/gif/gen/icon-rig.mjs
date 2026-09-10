/* Rig + SNES shading toolkit shared by every agent icon.

   Two ideas live here, and they're separable on purpose.

   1. THE RIG. Icons are not redrawn per frame. Each is broken into
      anatomical parts (nose / body / fin / flame …), every part draws
      itself into its own transparent layer, and a per-frame POSE
      translates, rotates, scales or hides each part independently.
      Frames are then composited in a fixed z-order. This is what
      makes secondary motion cheap — a fin can lag the body, a
      satellite can orbit on its own phase — where a redraw-per-frame
      approach forces every limb to be re-derived by hand each time.

      The silhouette outline is applied AFTER compositing, so parts
      that overlap read as one solid object rather than each carrying
      its own internal outline seam.

   2. THE SHADING. What reads as "Super Nintendo" is colour depth per
      cell, not resolution: a 5-step tonal ramp per hue, volumetric
      lighting from a single consistent direction, ordered dithering
      across tone boundaries instead of hard bands, a specular hotspot
      on anything round, a rim light on the shadow side, and a
      coloured dark outline rather than pure black. */

export const SIZE = 48;
export const C = 24;
const LX = -0.55, LY = -0.72;   // one light direction, shared by all icons

export const grid = () => Array.from({ length: SIZE }, () => Array(SIZE).fill(-1));

export function px(g, x, y, i) {
  const xi = Math.round(x), yi = Math.round(y);
  if (xi >= 0 && xi < SIZE && yi >= 0 && yi < SIZE) g[yi][xi] = i;
}
export function rectFill(g, x, y, w, h, i) {
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) px(g, x + dx, y + dy, i);
}
export function disc(g, cx, cy, r, i) {
  for (let y = -Math.ceil(r); y <= Math.ceil(r); y++)
    for (let x = -Math.ceil(r); x <= Math.ceil(r); x++)
      if (x * x + y * y <= r * r + 0.5) px(g, cx + x, cy + y, i);
}
export function ring(g, cx, cy, r, t, i) {
  for (let y = -Math.ceil(r); y <= Math.ceil(r); y++)
    for (let x = -Math.ceil(r); x <= Math.ceil(r); x++) {
      const d = Math.hypot(x, y);
      if (d <= r + 0.4 && d >= r - t) px(g, cx + x, cy + y, i);
    }
}
export function line(g, x0, y0, x1, y1, t, i) {
  const n = Math.max(2, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2));
  for (let s = 0; s <= n; s++) {
    const x = x0 + (x1 - x0) * s / n, y = y0 + (y1 - y0) * s / n;
    if (t <= 1) px(g, x, y, i); else disc(g, x, y, t / 2, i);
  }
}

/* ── ordered-dither tone selection ───────────────────────────
   `t` is 0..1 lightness. The fractional remainder between ramp steps
   is resolved by a 2×2 Bayer pattern, so boundaries break into the
   checkerboard that reads as a gradient at sprite scale rather than
   as a hard band. */
const BAYER = [[0, 2], [3, 1]];
export function tone(ramp, t, x, y) {
  const s = Math.max(0, Math.min(0.999, t)) * (ramp.length - 1);
  const i = Math.floor(s), frac = s - i;
  // x/y arrive fractional from taper and line interpolation, and a
  // fractional modulo indexes BAYER out of bounds — round first.
  const bx = ((Math.round(x) % 2) + 2) % 2, by = ((Math.round(y) % 2) + 2) % 2;
  const th = (BAYER[by][bx] + 0.5) / 4;
  return ramp[Math.min(ramp.length - 1, i + (frac > th ? 1 : 0))];
}

/** a lit sphere — orbs, wells, rivets, lenses, pins */
export function shadedDisc(g, cx, cy, r, ramp, { rim = true, spec = true, boost = 0 } = {}) {
  for (let y = -Math.ceil(r); y <= Math.ceil(r); y++) {
    for (let x = -Math.ceil(r); x <= Math.ceil(r); x++) {
      const d = Math.hypot(x, y);
      if (d > r + 0.5) continue;
      const nx = x / r, ny = y / r;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      let t = 0.18 + (nx * LX + ny * LY + nz * 0.45) * 0.9 + boost;
      if (rim && d > r - 1.6 && (nx * -LX + ny * -LY) > 0.35) t = Math.max(t, 0.62);
      px(g, cx + x, cy + y, tone(ramp, t, cx + x, cy + y));
    }
  }
  if (spec) disc(g, cx + LX * r * 0.5, cy + LY * r * 0.5, Math.max(1, r * 0.19), ramp[ramp.length - 1]);
}

/** a lit cylinder band — bodies, slabs, rolls, banners */
export function shadedBand(g, x, y, w, h, ramp, vertical = true) {
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
    const u = vertical ? dy / Math.max(1, h - 1) : dx / Math.max(1, w - 1);
    px(g, x + dx, y + dy, tone(ramp, 1 - Math.abs(u - 0.34) * 1.75, x + dx, y + dy));
  }
}

/** a lit cone/taper — rocket noses, flasks, shield points */
export function shadedTaper(g, cx, top, h, w0, w1, ramp) {
  for (let r = 0; r < h; r++) {
    const w = Math.round(w0 + (w1 - w0) * (r / Math.max(1, h - 1)));
    for (let dx = -w; dx <= w; dx++) {
      const u = (dx + w) / Math.max(1, w * 2);
      px(g, cx + dx, top + r, tone(ramp, 0.95 - Math.abs(u - 0.3) * 1.5, cx + dx, top + r));
    }
  }
}

/* ── rig ─────────────────────────────────────────────────── */

/** copy every lit cell of `src` into `dst`, offset by (dx,dy) */
export function stamp(dst, src, dx = 0, dy = 0) {
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const v = src[y][x];
    if (v >= 0) px(dst, x + dx, y + dy, v);
  }
}

/** nearest-neighbour rotate about (ox,oy). Kept to modest angles —
    pixel art rotated far off-axis shreds, which is why most parts
    animate by translation and only deliberate ones spin. */
export function rotate(src, ang, ox = C, oy = C) {
  if (!ang) return src;
  const out = grid(), cos = Math.cos(-ang), sin = Math.sin(-ang);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const rx = x - ox, ry = y - oy;
    const sx = Math.round(ox + rx * cos - ry * sin);
    const sy = Math.round(oy + rx * sin + ry * cos);
    if (sx >= 0 && sx < SIZE && sy >= 0 && sy < SIZE) {
      const v = src[sy][sx];
      if (v >= 0) out[y][x] = v;
    }
  }
  return out;
}

/** unified silhouette outline, applied after compositing */
export function outline(g, inkIdx = 0) {
  const src = g.map(r => r.slice());
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    if (src[y][x] < 0) continue;
    const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
      const nx = x + dx, ny = y + dy;
      return nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE || src[ny][nx] < 0;
    });
    if (edge) g[y][x] = inkIdx;
  }
  return g;
}

/**
 * Build a frame set from a rig.
 * @param order  part names, back-to-front
 * @param parts  { name: (pose, t, f) => layer grid }
 * @param poseFn (t, f) => { partName: {dx,dy,rot,ox,oy,hide, ...params} }
 * @param count  frame count
 */
export function rigFrames(order, parts, poseFn, count) {
  return Array.from({ length: count }, (_, f) => {
    const t = f / count;
    const pose = poseFn(t, f) || {};
    const out = grid();
    for (const name of order) {
      const p = pose[name];
      if (!p || p.hide) continue;
      let layer = parts[name](p, t, f);
      if (!layer) continue;
      if (p.rot) layer = rotate(layer, p.rot, p.ox ?? C, p.oy ?? C);
      stamp(out, layer, Math.round(p.dx || 0), Math.round(p.dy || 0));
    }
    return outline(out, 0);
  });
}

/* easing, for pose curves */
export const ease = {
  out: t => 1 - Math.pow(1 - t, 3),
  in: t => t * t * t,
  inOut: t => -(Math.cos(Math.PI * t) - 1) / 2,
  back: t => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2),
};
