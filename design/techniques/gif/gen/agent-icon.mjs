/* Eight animated agent icons — SNES-era item sprites, rigged.

   Each icon declares anatomical PARTS and a 6-frame POSE timeline that
   moves those parts independently (see icon-rig.mjs for the rig and
   the shading toolkit). That separation is the point: a fin can lag
   the body, six satellites can orbit on six different phases, a check
   can draw itself on while the shield it sits on is still recoiling —
   none of which is practical when every frame is redrawn whole.

   6 frames at 700ms — a ~4.2s loop, which lands about where the
   earlier 3-frame/1.5s version did, but with twice the articulation.

   Palette layout, identical for every icon — a true tonal ramp:
     0 outline · 1 shadow · 2 dark · 3 mid · 4 light · 5 spec
     6 accent · 7 accent-light */

import {
  SIZE, C, grid, px, rectFill, disc, ring, line, tone,
  shadedDisc, shadedBand, shadedTaper, rigFrames, ease,
} from './icon-rig.mjs';

export { SIZE };
const FRAMES = 6;
/* One number to tune the whole set's pace. The action beats run at
   FRAME_MS; frame 0 (the rest pose) is held ~1.7× longer so the loop
   has a readable beat instead of cycling as a constant blur — an
   even cadence on a 6-frame loop reads as flicker, not animation. */
const FRAME_MS = 200;
const DELAYS = Array.from({ length: FRAMES }, (_, f) => (f === 0 ? Math.round(FRAME_MS * 1.7) : FRAME_MS));
const RAMP = [1, 2, 3, 4, 5];
const ICON = (pal, frames) => ({ palette: pal.map(c => [...c, 255]), delays: DELAYS, frames });

/* ═══ EXECUTOR — fire — rocket: nose leads, body follows, fins flare
   on launch, exhaust pulses on its own beat. ═══ */
const P_EXEC = [
  [40, 16, 10], [104, 40, 18], [166, 66, 26], [226, 110, 40], [255, 168, 74], [255, 240, 202],
  [255, 214, 92], [255, 252, 236],
];
const EXEC_PARTS = {
  flame: ({ len }) => {
    const g = grid();
    for (let f = 0; f < len; f++) {
      const w = Math.max(1, Math.round(7 - f * 0.4));
      for (let dx = -w; dx <= w; dx++) {
        const u = 1 - Math.abs(dx) / (w + 0.5) - f / (len + 4);
        px(g, C + dx, 34 + f, tone([2, 3, 6, 7], u, C + dx, 34 + f));
      }
    }
    return g;
  },
  finL: ({ flare }) => {
    const g = grid();
    for (let r = 0; r < 9; r++) {
      const w = 1 + Math.round(r * (0.45 + flare * 0.35));
      for (let d = 0; d < w; d++) px(g, C - 9 - d, 24 + r, tone(RAMP, 0.62 - d * 0.1, C - 9 - d, 24 + r));
    }
    return g;
  },
  finR: ({ flare }) => {
    const g = grid();
    for (let r = 0; r < 9; r++) {
      const w = 1 + Math.round(r * (0.45 + flare * 0.35));
      for (let d = 0; d < w; d++) px(g, C + 9 + d, 24 + r, tone(RAMP, 0.34 - d * 0.07, C + 9 + d, 24 + r));
    }
    return g;
  },
  body: () => { const g = grid(); shadedBand(g, C - 8, 13, 17, 21, RAMP, false); rectFill(g, C - 8, 20, 17, 1, 2); rectFill(g, C - 8, 28, 17, 1, 2); return g; },
  nose: () => { const g = grid(); shadedTaper(g, C, 5, 9, 0, 8, RAMP); return g; },
  port: () => { const g = grid(); shadedDisc(g, C, 18, 5, [1, 2, 6, 7], { boost: 0.1 }); ring(g, C, 18, 5.6, 1, 2); return g; },
};
const EXEC_ORDER = ['flame', 'finL', 'finR', 'body', 'nose', 'port'];
export const EXECUTOR = {
  name: 'executor', tag: 'fire',
  desc: 'Ships first, argues later. The one you call when the deadline was yesterday.',
  actions: ['deploy now', 'fast-track'],
  ...ICON(P_EXEC, rigFrames(EXEC_ORDER, EXEC_PARTS, (t, f) => {
    // 0-1 settle & rumble · 2 crouch · 3 launch · 4-5 climb with drag
    const seq = [0, 1, 2, 3, 4, 5][f];
    const rise = [0, 0, 2, -6, -11, -15][seq];
    const drag = [0, 0, 1, 2, 1, 0][seq];        // body lags the nose
    const flare = [0, 0, 0, 1, 0.6, 0.3][seq];
    const len = [4, 5, 2, 16, 13, 9][seq];
    return {
      flame: { dy: rise + drag, len },
      finL: { dy: rise + drag, flare }, finR: { dy: rise + drag, flare },
      body: { dy: rise + drag },
      nose: { dy: rise },
      port: { dy: rise + drag * 0.5 },
    };
  }, FRAMES)),
};

/* ═══ DEBUGGER — volt — magnifier: the whole glass sweeps on the
   handle's pivot, then the bolt strikes inside it. ═══ */
const P_DEBUG = [
  [34, 24, 10], [92, 66, 16], [148, 110, 24], [206, 160, 40], [250, 208, 80], [255, 250, 214],
  [116, 62, 232], [206, 178, 255],
];
const DEBUG_PARTS = {
  handle: () => {
    const g = grid();
    for (let s = 0; s <= 20; s++) {
      const x = 29 + s * 0.62, y = 29 + s * 0.62;
      for (let o = -2; o <= 2; o++) px(g, x + o, y - o * 0.35, tone(RAMP, 0.72 - Math.abs(o + 0.6) * 0.22, x + o, y));
    }
    for (let k = 0; k < 3; k++) line(g, 33 + k * 4, 33 + k * 4, 35 + k * 4, 35 + k * 4, 5, 2);
    return g;
  },
  rim: () => { const g = grid(); shadedDisc(g, 20, 19, 14, RAMP, { spec: false }); disc(g, 20, 19, 10.5, -1); return g; },
  glass: ({ hot }) => {
    const g = grid();
    shadedDisc(g, 20, 19, 10.5, hot ? [1, 6, 6, 7] : [1, 2, 3, 4], { boost: hot ? 0.15 : 0.05 });
    line(g, 12, 16, 17, 11, 2, 5); line(g, 14, 23, 16, 21, 1, 5);
    return g;
  },
  bug: ({ hide }) => {
    if (hide) return null;
    const g = grid();
    for (const [x, y] of [[15, 14], [25, 17], [18, 25]]) { disc(g, x, y, 2, 2); px(g, x, y, 1); }
    return g;
  },
  boltMark: ({ hide }) => {
    if (hide) return null;
    const g = grid();
    line(g, 24, 9, 18, 19, 3, 7); line(g, 18, 19, 24, 19, 3, 7); line(g, 24, 19, 15, 31, 3, 7);
    line(g, 23, 11, 19, 18, 1, 5);
    return g;
  },
  sparks: ({ n }) => {
    if (!n) return null;
    const g = grid();
    const pts = [[5, 8], [42, 10], [7, 38], [44, 31], [24, 3], [3, 24]];
    for (let i = 0; i < n; i++) { const [x, y] = pts[i]; disc(g, x, y, 2, 6); px(g, x, y, 7); }
    return g;
  },
};
const DEBUG_ORDER = ['handle', 'rim', 'glass', 'bug', 'boltMark', 'sparks'];
export const DEBUGGER = {
  name: 'debugger', tag: 'volt',
  desc: 'Finds the one bad line in ten thousand. Does not sleep, technically cannot.',
  actions: ['run trace', 'zap bug'],
  ...ICON(P_DEBUG, rigFrames(DEBUG_ORDER, DEBUG_PARTS, (t, f) => {
    // 0-2 sweep the lens across looking · 3 lock on, bolt fires · 4-5 cool off
    const sweep = [-7, 0, 7, 2, 0, -3][f];
    const tilt = [-0.16, 0, 0.16, 0.05, 0, -0.07][f];
    const hot = f === 3 || f === 4;
    return {
      handle: { rot: tilt, ox: 40, oy: 40 },
      rim: { dx: sweep, rot: tilt, ox: 40, oy: 40 },
      glass: { dx: sweep, rot: tilt, ox: 40, oy: 40, hot },
      bug: { dx: sweep, rot: tilt, ox: 40, oy: 40, hide: hot },
      boltMark: { dx: sweep, rot: tilt, ox: 40, oy: 40, hide: !hot },
      sparks: { n: [0, 0, 0, 6, 3, 1][f] },
    };
  }, FRAMES)),
};

/* ═══ GUARDIAN — stone — shield: rears back, slams, three rings
   expand on staggered phases, check engraves last. ═══ */
const P_GUARD = [
  [28, 22, 14], [74, 62, 46], [118, 100, 78], [162, 142, 116], [206, 190, 164], [248, 242, 228],
  [255, 186, 78], [214, 246, 252],
];
function shieldCells(inset) {
  const cells = [], x0 = 9 + inset, x1 = 39 - inset, top = 6 + inset;
  for (let y = top; y < 26 - inset * 0.4; y++) for (let x = x0; x < x1; x++) cells.push([x, y]);
  const h = 17 - inset;
  for (let r = 0; r < h; r++) {
    const u = r / h, w = Math.round((x1 - x0) / 2 * (1 - u * u * 0.92));
    for (let x = C - w; x < C + w; x++) cells.push([x, Math.round(26 - inset * 0.4) + r]);
  }
  return cells;
}
const GUARD_PARTS = {
  rings: ({ k }) => {
    if (k <= 0) return null;
    const g = grid();
    for (let i = 0; i < 3; i++) {
      const r = 14 + (k * 3 - i) * 7;
      if (r < 14 || r > 34) continue;
      ring(g, C, 24, r, 1, i % 2 ? 7 : 6);
    }
    return g;
  },
  face: ({ lit }) => {
    const g = grid();
    for (const [x, y] of shieldCells(0)) px(g, x, y, tone(RAMP, 0.92 - (x - 9) / 30 * 0.5 - (y - 6) / 36 * 0.34, x, y));
    for (const [x, y] of shieldCells(4)) px(g, x, y, tone(RAMP, lit ? 0.74 : 0.42, x, y));
    for (const [x, y] of shieldCells(7)) px(g, x, y, tone(RAMP, (lit ? 0.86 : 0.52) - Math.abs((x - 16) / 16 - 0.3) * 0.3, x, y));
    return g;
  },
  boss: () => { const g = grid(); shadedDisc(g, C, 22, 5, RAMP, { boost: 0.12 }); return g; },
  rivets: () => { const g = grid(); for (const [x, y] of [[14, 11], [34, 11], [14, 19], [34, 19]]) shadedDisc(g, x, y, 2.2, RAMP, { spec: false, boost: 0.2 }); return g; },
  check: ({ k }) => {
    if (k <= 0) return null;
    const g = grid();
    const p = [[16, 24], [22, 32], [33, 15]];
    const k1 = Math.min(1, k * 2);
    line(g, p[0][0], p[0][1], p[0][0] + (p[1][0] - p[0][0]) * k1, p[0][1] + (p[1][1] - p[0][1]) * k1, 4, 0);
    line(g, p[0][0], p[0][1], p[0][0] + (p[1][0] - p[0][0]) * k1, p[0][1] + (p[1][1] - p[0][1]) * k1, 2, 6);
    if (k > 0.5) {
      const k2 = (k - 0.5) * 2;
      line(g, p[1][0], p[1][1], p[1][0] + (p[2][0] - p[1][0]) * k2, p[1][1] + (p[2][1] - p[1][1]) * k2, 4, 0);
      line(g, p[1][0], p[1][1], p[1][0] + (p[2][0] - p[1][0]) * k2, p[1][1] + (p[2][1] - p[1][1]) * k2, 2, 6);
    }
    return g;
  },
};
const GUARD_ORDER = ['rings', 'face', 'boss', 'rivets', 'check'];
export const GUARDIAN = {
  name: 'guardian', tag: 'stone',
  desc: 'Reviews the PR nobody else wants to touch. Immovable on anything security-shaped.',
  actions: ['lock down', 'audit'],
  ...ICON(P_GUARD, rigFrames(GUARD_ORDER, GUARD_PARTS, (t, f) => {
    const dy = [0, -3, 2, 1, 0, 0][f];       // rear back, slam, settle
    const rot = [0, -0.1, 0.05, 0.02, 0, 0][f];
    const lit = f >= 2;
    return {
      rings: { k: [0, 0, 0.34, 0.67, 1, 0][f] },
      face: { dy, rot, lit }, boss: { dy, rot }, rivets: { dy, rot },
      check: { dy, rot, k: [0, 0, 0, 0, 0.5, 1][f] },
    };
  }, FRAMES)),
};

/* ═══ ORCHESTRATOR — storm — hub: six satellites each on their own
   orbital phase, spokes extending in sequence, core pulsing. ═══ */
const P_ORCH = [
  [18, 22, 36], [46, 56, 78], [82, 98, 126], [124, 146, 178], [176, 198, 224], [242, 250, 255],
  [255, 255, 255], [198, 224, 255],
];
function orchNodes(rot, spread) {
  return Array.from({ length: 6 }, (_, a) => {
    const ang = (a / 6) * Math.PI * 2 + rot + a * 0.05;   // slight per-node phase drift
    const r = 17 * spread;
    return [C + Math.cos(ang) * r, C + Math.sin(ang) * r, a];
  });
}
const ORCH_PARTS = {
  spokes: ({ rot, spread, lit, reach }) => {
    const g = grid();
    orchNodes(rot, spread).forEach(([x, y, k]) => {
      const seg = Math.min(1, Math.max(0, reach * 6 - k));   // extend one after another
      if (seg <= 0) return;
      const ex = C + (x - C) * seg, ey = C + (y - C) * seg;
      line(g, C, C, ex, ey, 4, 1);
      line(g, C, C, ex, ey, 2, lit && k % 2 === 0 ? 6 : 3);
    });
    return g;
  },
  sats: ({ rot, spread, lit }) => {
    const g = grid();
    orchNodes(rot, spread).forEach(([x, y, k]) =>
      shadedDisc(g, x, y, lit ? 4.4 : 3.6, RAMP, { boost: lit && k % 2 === 0 ? 0.3 : 0 }));
    return g;
  },
  core: ({ pulse }) => {
    const g = grid();
    shadedDisc(g, C, C, 8 + pulse * 2, RAMP, { boost: pulse * 0.3 });
    ring(g, C, C, 10.6 + pulse * 2, 1, pulse > 0.5 ? 5 : 2);
    return g;
  },
};
const ORCH_ORDER = ['spokes', 'sats', 'core'];
export const ORCHESTRATOR = {
  name: 'orchestrator', tag: 'storm',
  desc: 'Keeps the other seven pointed the same direction. Talks to everyone, owns nothing.',
  actions: ['sync all', 'reroute'],
  ...ICON(P_ORCH, rigFrames(ORCH_ORDER, ORCH_PARTS, (t, f) => {
    const rot = t * Math.PI * 0.55;
    const spread = [0.72, 0.82, 0.94, 1.05, 1, 0.9][f];
    const reach = [0.34, 0.55, 0.8, 1, 1, 0.72][f];
    const lit = f >= 2 && f <= 4;
    const pulse = [0, 0.2, 0.6, 1, 0.55, 0.15][f];
    return { spokes: { rot, spread, lit, reach }, sats: { rot, spread, lit }, core: { pulse } };
  }, FRAMES)),
};

/* ═══ REVIEWER — frost — scroll: unrolls, seal pops, check strokes
   on in two passes, glint last. ═══ */
const P_REV = [
  [22, 38, 58], [70, 104, 138], [122, 162, 194], [176, 208, 230], [224, 242, 252], [255, 255, 255],
  [42, 122, 214], [150, 206, 255],
];
const REV_PARTS = {
  sheet: ({ open }) => {
    const g = grid();
    const h = Math.round(6 + open * 30);
    shadedBand(g, 8, 24 - h / 2, 32, h, RAMP, false);
    const rows = Math.floor(open * 6);
    for (let r = 0; r < rows; r++) rectFill(g, 13, 24 - h / 2 + 5 + r * 5, [18, 22, 14, 20, 11, 19][r], 2, 2);
    return g;
  },
  rollTop: ({ open }) => { const g = grid(); const h = Math.round(6 + open * 30); shadedBand(g, 6, 24 - h / 2 - 5, 36, 5, RAMP); return g; },
  rollBot: ({ open }) => { const g = grid(); const h = Math.round(6 + open * 30); shadedBand(g, 6, 24 + h / 2, 36, 5, RAMP); return g; },
  seal: ({ pop }) => {
    if (pop <= 0) return null;
    const g = grid();
    const r = 3 + pop * 2.4;
    shadedDisc(g, 35, 35, r, [1, 6, 6, 7], { boost: 0.1 });
    ring(g, 35, 35, r + 0.6, 1, 0);
    return g;
  },
  check: ({ k }) => {
    if (k <= 0) return null;
    const g = grid();
    const p = [[13, 25], [20, 34], [34, 11]];
    const k1 = Math.min(1, k * 2);
    line(g, p[0][0], p[0][1], p[0][0] + (p[1][0] - p[0][0]) * k1, p[0][1] + (p[1][1] - p[0][1]) * k1, 5, 6);
    if (k > 0.5) {
      const k2 = (k - 0.5) * 2;
      line(g, p[1][0], p[1][1], p[1][0] + (p[2][0] - p[1][0]) * k2, p[1][1] + (p[2][1] - p[1][1]) * k2, 5, 6);
      line(g, p[1][0], p[1][1], p[1][0] + (p[2][0] - p[1][0]) * k2, p[1][1] + (p[2][1] - p[1][1]) * k2, 2, 7);
    }
    return g;
  },
  glint: ({ n }) => {
    if (!n) return null;
    const g = grid();
    const pts = [[3, 4], [44, 8], [4, 43], [45, 38]];
    for (let i = 0; i < n; i++) { const [x, y] = pts[i]; disc(g, x, y, 2, 6); px(g, x, y, 7); }
    return g;
  },
};
const REV_ORDER = ['sheet', 'rollTop', 'rollBot', 'seal', 'check', 'glint'];
export const REVIEWER = {
  name: 'reviewer', tag: 'frost',
  desc: 'Reads every line before approving one. Nothing gets past on a good mood.',
  actions: ['request changes', 'approve'],
  ...ICON(P_REV, rigFrames(REV_ORDER, REV_PARTS, (t, f) => {
    const open = [0.15, 0.55, 1, 1, 1, 1][f];
    return {
      sheet: { open }, rollTop: { open }, rollBot: { open },
      seal: { pop: [0, 0, 0.5, 1, 1, 1][f] },
      check: { k: [0, 0, 0, 0.5, 1, 1][f] },
      glint: { n: [0, 0, 0, 0, 4, 2][f] },
    };
  }, FRAMES)),
};

/* ═══ DESIGNER — bloom — palette: brush sweeps across, wells light
   in sequence behind it. ═══ */
const P_DES = [
  [26, 48, 22], [64, 104, 52], [104, 156, 84], [148, 202, 122], [198, 240, 178], [246, 255, 236],
  [255, 132, 186], [255, 216, 238],
];
const WELLS = [[15, 14], [26, 12], [33, 20], [11, 25], [14, 36], [25, 38]];
const WELL_TONES = [[1, 6, 6, 7], [1, 2, 3, 5], [1, 6, 7, 7], [1, 3, 4, 5], [1, 6, 6, 7], [1, 2, 4, 5]];
const DES_PARTS = {
  board: () => { const g = grid(); shadedDisc(g, 22, 25, 17, RAMP, { spec: false }); disc(g, 31, 33, 5, -1); ring(g, 31, 33, 5.6, 2, 1); return g; },
  wells: ({ lit }) => {
    const g = grid();
    WELLS.forEach(([x, y], k) => {
      if (k < lit) shadedDisc(g, x, y, 3.6, WELL_TONES[k], { boost: 0.12 });
      else { disc(g, x, y, 3.6, 2); disc(g, x, y, 2.4, 1); }
      ring(g, x, y, 4, 1, 1);
    });
    return g;
  },
  brush: () => {
    const g = grid();
    for (let s = 0; s <= 16; s++) {
      const x = 4 + s * 0.8, y = 44 - s * 0.85;
      for (let o = -1; o <= 1; o++) px(g, x + o, y + o * 0.4, tone(RAMP, 0.66 - o * 0.2, x, y));
    }
    disc(g, 5, 45, 2.6, 6); px(g, 4, 44, 7);
    return g;
  },
  sparkle: ({ n }) => {
    if (!n) return null;
    const g = grid();
    const pts = [[6, 7], [42, 6], [43, 42], [7, 20]];
    for (let i = 0; i < n; i++) { const [x, y] = pts[i]; disc(g, x, y, 2.4, 6); disc(g, x, y, 1, 7); }
    return g;
  },
};
const DES_ORDER = ['board', 'wells', 'brush', 'sparkle'];
export const DESIGNER = {
  name: 'designer', tag: 'bloom',
  desc: 'Makes it beautiful, then makes it beautiful again after everyone else touches it.',
  actions: ['restyle', 'bloom preview'],
  ...ICON(P_DES, rigFrames(DES_ORDER, DES_PARTS, (t, f) => ({
    board: {},
    wells: { lit: [1, 2, 4, 6, 6, 5][f] },
    // the brush travels up-right across the palette, then lifts away
    brush: { dx: [0, 6, 13, 20, 24, 10][f], dy: [0, -4, -9, -14, -19, -6][f], rot: [0, 0.06, 0.12, 0.18, 0.3, 0.05][f], ox: 6, oy: 44 },
    sparkle: { n: [0, 0, 1, 3, 4, 1][f] },
  }), FRAMES)),
};

/* ═══ RESEARCHER — wave — flask: liquid rises, bubbles ascend on
   staggered phases, surface glints. ═══ */
const P_RES = [
  [12, 40, 42], [30, 92, 92], [52, 138, 136], [90, 186, 182], [150, 226, 222], [236, 255, 254],
  [255, 255, 255], [190, 250, 246],
];
const RES_PARTS = {
  liquid: ({ level }) => {
    if (level <= 0) return null;
    const g = grid();
    const liqTop = 42 - Math.round(level * 20);
    for (let y = liqTop; y < 42; y++) {
      const r = y - 20, w = 3 + Math.round(r * 0.72);
      for (let dx = -w; dx <= w; dx++) {
        const u = (dx + w) / (w * 2 + 1);
        px(g, C + dx, y, tone([1, 2, 3, 4, 5], 0.82 - Math.abs(u - 0.32) * 0.55 - (y - liqTop) * 0.012, C + dx, y));
      }
    }
    const wTop = 3 + Math.round((liqTop - 20) * 0.72);
    rectFill(g, C - wTop, liqTop, wTop * 2 + 1, 1, 5);
    return g;
  },
  bubbles: ({ phase, level }) => {
    const g = grid();
    const liqTop = 42 - Math.round(level * 20);
    for (let b = 0; b < 5; b++) {
      const by = 41 - ((phase + b * 4.4) % 18);
      if (by > liqTop + 1) disc(g, C - 6 + b * 3.4, by, b % 2 ? 1.6 : 1, 5);
    }
    return g;
  },
  glass: () => {
    const g = grid();
    for (let r = 0; r < 22; r++) {
      const w = 4 + Math.round(r * 0.72);
      for (let dx = -w; dx <= w; dx++) {
        const u = (dx + w) / (w * 2 + 1);
        if (Math.abs(dx) > w - 2) px(g, C + dx, 20 + r, tone(RAMP, 0.34 - Math.abs(u - 0.3) * 0.5, C + dx, 20 + r));
      }
    }
    shadedBand(g, C - 4, 8, 9, 13, RAMP, false);
    shadedBand(g, C - 6, 5, 13, 4, RAMP);
    line(g, C - 8, 30, C - 6, 40, 2, 5);
    line(g, C - 3, 12, C - 3, 18, 1, 5);
    return g;
  },
  glow: ({ n }) => {
    if (!n) return null;
    const g = grid();
    const pts = [[6, 10], [41, 14], [8, 40], [40, 38]];
    for (let i = 0; i < n; i++) { const [x, y] = pts[i]; disc(g, x, y, 2, 6); px(g, x, y, 7); }
    return g;
  },
};
const RES_ORDER = ['liquid', 'bubbles', 'glass', 'glow'];
export const RESEARCHER = {
  name: 'researcher', tag: 'wave',
  desc: 'Reads the whole ocean before writing one sentence about the tide.',
  actions: ['deep dive', 'surface findings'],
  ...ICON(P_RES, rigFrames(RES_ORDER, RES_PARTS, (t, f) => {
    const level = [0.25, 0.45, 0.7, 1, 0.92, 0.6][f];
    return { liquid: { level }, bubbles: { phase: f * 4, level }, glass: {}, glow: { n: [0, 0, 1, 4, 2, 0][f] } };
  }, FRAMES)),
};

/* ═══ PLANNER — cosmic — map: pins light in sequence, route draws
   between them, compass star swings in at the end. ═══ */
const P_PLAN = [
  [30, 20, 50], [70, 52, 108], [110, 88, 158], [156, 132, 206], [206, 188, 242], [250, 244, 255],
  [255, 216, 130], [255, 250, 220],
];
const PINS = [[11, 36], [20, 24], [30, 30], [37, 12]];
const PLAN_PARTS = {
  sheet: () => {
    const g = grid();
    shadedBand(g, 5, 6, 38, 36, RAMP, false);
    for (let x = 5; x < 43; x += 4) for (let y = 6; y < 42; y += 4) px(g, x, y, 2);
    return g;
  },
  route: ({ k }) => {
    if (k <= 0) return null;
    const g = grid();
    for (let i = 0; i < PINS.length - 1; i++) {
      const seg = Math.min(1, Math.max(0, k * 3 - i));
      if (seg <= 0) continue;
      const ex = PINS[i][0] + (PINS[i + 1][0] - PINS[i][0]) * seg;
      const ey = PINS[i][1] + (PINS[i + 1][1] - PINS[i][1]) * seg;
      line(g, PINS[i][0], PINS[i][1], ex, ey, 4, 1);
      line(g, PINS[i][0], PINS[i][1], ex, ey, 2, 6);
    }
    return g;
  },
  pins: ({ lit }) => {
    const g = grid();
    PINS.forEach(([x, y], k) => {
      const on = k < lit;
      shadedDisc(g, x, y, 3.4, on ? [1, 6, 6, 7] : [1, 2, 3, 4], { boost: 0.1 });
      ring(g, x, y, 3.8, 1, 0);
    });
    return g;
  },
  star: ({ s }) => {
    if (s <= 0) return null;
    const g = grid();
    for (const [dx, dy, len] of [[0, -1, 9], [0, 1, 9], [-1, 0, 7], [1, 0, 7]])
      line(g, 38, 8, 38 + dx * len * s, 8 + dy * len * s, 2, 6);
    shadedDisc(g, 38, 8, 3 * Math.min(1, s), [1, 6, 7, 7], { boost: 0.2 });
    return g;
  },
};
const PLAN_ORDER = ['sheet', 'route', 'pins', 'star'];
export const PLANNER = {
  name: 'planner', tag: 'cosmic',
  desc: 'Already knows what the next four moves are. Rarely says so unless asked.',
  actions: ['map roadmap', 'forecast'],
  ...ICON(P_PLAN, rigFrames(PLAN_ORDER, PLAN_PARTS, (t, f) => ({
    sheet: {},
    route: { k: [0, 0.22, 0.5, 0.78, 1, 1][f] },
    pins: { lit: [1, 2, 3, 4, 4, 4][f] },
    // star spins in on the last two beats
    star: { s: [0, 0, 0, 0.4, 1, 0.85][f], rot: [0, 0, 0, -0.5, 0, 0.2][f], ox: 38, oy: 8 },
  }), FRAMES)),
};

export const AGENTS = {
  executor: EXECUTOR, debugger: DEBUGGER, guardian: GUARDIAN, orchestrator: ORCHESTRATOR,
  reviewer: REVIEWER, designer: DESIGNER, researcher: RESEARCHER, planner: PLANNER,
};
