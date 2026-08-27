/* Four slime species, one shared rig. Each species is a distinct
   silhouette (body mask + attached anatomy) and a distinct face, but
   all run through the same fill/shade/outline pipeline and the same
   keyframe-timeline builder — so they read as one family of
   characters, not four unrelated drawings.

   SIZE 40 (up from an earlier 24) — the anatomy (ears, antenna,
   bubbles) needs more cells to read at a glance than a plain round
   body did. */

import { blankGrid, ellipse, circle as circlePred, dot, ease } from './pixel-grid.mjs';

export const SIZE = 40;

export const PALETTE = [
  [126, 224, 176, 255], // 0 body — jelly mint
  [64, 168, 128, 255],  // 1 body shade — lower band
  [24, 48, 40, 255],    // 2 ink — outline, closed-eye line, mouth line
  [255, 255, 255, 255], // 3 eye white
  [22, 22, 26, 255],    // 4 pupil / open-mouth interior
  [255, 158, 186, 190], // 5 blush
  [255, 255, 255, 235], // 6 sparkle
  [222, 196, 130, 255], // 7 pellet (food)
  [196, 224, 96, 255],  // 8 leaf / antenna bud
  [206, 240, 240, 235], // 9 bubble fill
];

const REST = { cx: SIZE/2, cy: SIZE/2 + 2, rx: 13, ry: 11.5 };

/** Volume-preserving squash/stretch: as ry shrinks, rx grows to match, like a real gel blob. */
function squash(ry, baseRx = REST.rx, baseRy = REST.ry) {
  const rx = baseRx * (baseRy / ry) ** 0.5;
  return { rx, ry };
}

// ── species silhouettes — each returns a boolean mask, main body
//    dimensions included, so attached anatomy (ears, teardrop taper)
//    shares the outline with the body rather than floating over it ──
const SILHOUETTE = {
  puddle(mask, cx, cy, rx, ry) {
    ellipse(mask, SIZE, cx, cy, rx, ry, true);
    // stub feet — small nubs peeking below the main mass
    circlePred(mask, SIZE, cx - rx * 0.42, cy + ry * 0.88, rx * 0.22, true);
    circlePred(mask, SIZE, cx + rx * 0.42, cy + ry * 0.88, rx * 0.22, true);
  },
  sprout(mask, cx, cy, rx, ry) {
    // teardrop: main mass plus a narrower hump so the head tapers to
    // a point the antenna can sit on
    ellipse(mask, SIZE, cx, cy + ry * 0.12, rx * 0.94, ry * 0.9, true);
    ellipse(mask, SIZE, cx, cy - ry * 0.5, rx * 0.4, ry * 0.42, true);
  },
  bubble(mask, cx, cy, rx, ry) {
    ellipse(mask, SIZE, cx, cy, rx * 1.04, ry * 1.02, true); // slightly rounder/plumper
  },
  luna(mask, cx, cy, rx, ry) {
    ellipse(mask, SIZE, cx, cy, rx, ry, true);
    // long floppy ears — anchored at the top-outer edge, hanging well
    // past the body's own silhouette so they read as ears, not a bulge
    ellipse(mask, SIZE, cx - rx * 1.08, cy - ry * 0.28, rx * 0.22, ry * 0.85, true);
    ellipse(mask, SIZE, cx + rx * 1.08, cy - ry * 0.28, rx * 0.22, ry * 0.85, true);
  },
};

function buildBody(species, cx, cy, rx, ry) {
  const mask = blankGrid(SIZE, false);
  SILHOUETTE[species](mask, cx, cy, rx, ry);

  const g = blankGrid(SIZE);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    if (!mask[y][x]) continue;
    g[y][x] = (y > cy + ry * 0.3) ? 1 : 0;
  }
  // outline — any body cell adjacent to empty becomes ink
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    if (g[y][x] < 0) continue;
    const edge = [[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy]) => {
      const nx = x+dx, ny = y+dy;
      return nx<0||ny<0||nx>=SIZE||ny>=SIZE||g[ny][nx]<0;
    });
    if (edge) g[y][x] = 2;
  }
  return g;
}

/** A filled circle with a 1px ink halo — cheap "outline" for small
    isolated accessories (bubbles, antenna bud) that sit outside the
    main silhouette and so never pass through the edge-detect pass. */
function haloDot(g, cx, cy, r, fillIdx) {
  circlePred(g, SIZE, cx, cy, r + 0.75, 2);
  circlePred(g, SIZE, cx, cy, r, fillIdx);
}

function drawFace(g, species, cx, cy, rx, ry, p) {
  const eyeDX = rx * (species === 'bubble' ? 0.32 : 0.34);
  const eyeY = cy - ry * 0.16;
  const eyeR = species === 'bubble' ? 2.7 : 2.0;

  for (const sx of [-1, 1]) {
    const ex = cx + sx * eyeDX;
    if (species === 'luna') {
      // always a contented sleepy crescent, never open
      for (const [dxp, dyp] of [[-1.6,0],[0,-0.7],[1.6,0]]) dot(g, SIZE, ex + dxp, eyeY + dyp, 2);
    } else if (p.eyeOpen > 0.05) {
      ellipse(g, SIZE, ex, eyeY, eyeR * 0.75, eyeR * p.eyeOpen + 0.4, 3);
      dot(g, SIZE, ex, eyeY + (1 - p.eyeOpen) * 0.5, 4);
      if (p.eyeOpen > 0.6) dot(g, SIZE, ex - 0.6, eyeY - 0.6, 3); // catch-light
    } else {
      for (let dxp = -1.8; dxp <= 1.8; dxp += 0.9) dot(g, SIZE, ex + dxp, eyeY, 2);
    }
  }

  const my = cy + ry * 0.28;
  if (p.mouth === 'dot') dot(g, SIZE, cx, my, 2);
  else if (p.mouth === 'flat') { for (let dxp = -1.4; dxp <= 1.4; dxp += 1.4) dot(g, SIZE, cx + dxp, my, 2); }
  else if (p.mouth === 'smile') { for (let dxp = -2.6; dxp <= 2.6; dxp += 1) dot(g, SIZE, cx + dxp, my + Math.cos(dxp * 0.55) * 1.3 - 1.3, 2); }
  else if (p.mouth === 'o') ellipse(g, SIZE, cx, my, 1.6 + p.mouthOpen * 1.8, 1.6 + p.mouthOpen * 2.8, 4);

  if (p.blush) for (const sx of [-1, 1]) ellipse(g, SIZE, cx + sx * rx * 0.68, cy + ry * 0.14, 2.1, 1.3, 5);
}

function drawAccessories(g, species, cx, cy, rx, ry, t, p) {
  if (species === 'sprout') {
    // curling stem from the head's point, up and to the right, capped with a bud
    const stemBase = { x: cx, y: cy - ry * 0.92 };
    const pts = [[0,0],[0.6,-1.6],[1.8,-2.8],[2.2,-4.4],[1.4,-5.8]];
    for (const [dx, dy] of pts) dot(g, SIZE, stemBase.x + dx, stemBase.y + dy, 2);
    haloDot(g, stemBase.x + 1.4, stemBase.y - 6.6, 1.7, 8);
  }
  if (species === 'bubble') {
    // three foam bubbles beside the head, drifting gently with t
    const drift = Math.sin(t * Math.PI * 2) * 0.6;
    haloDot(g, cx + rx * 0.95, cy - ry * 0.75 + drift, 1.9, 9);
    haloDot(g, cx + rx * 1.35, cy - ry * 0.3 - drift * 0.6, 1.3, 9);
    haloDot(g, cx + rx * 0.85, cy - ry * 1.25 - drift * 0.4, 1.0, 9);
  }
  if (p.sparkle > 0.05) {
    // deterministic staggered twinkle — three points on offset phases,
    // NOT Math.random(): a baked-once random roll produced a stray
    // white fleck on whichever frames happened to land >0.5, which
    // read as a glitch rather than an animation.
    const positions = [[cx - rx*0.95, cy - ry*1.7], [cx + rx*1.05, cy - ry*1.5], [cx + rx*0.15, cy - ry*2.1]];
    positions.forEach(([x, y], i) => {
      const phase = (t * 2 + i / 3) % 1;
      if (phase < 0.4) dot(g, SIZE, x, y, 6);
    });
  }
  if (p.pelletY != null) ellipse(g, SIZE, cx, p.pelletY, 1.5, 1.5, 7);
}

/** Draw one frame for a given species + pose. */
export function drawSlime(species, p) {
  const { cx, cy, rx, ry } = p;
  const g = buildBody(species, cx, cy, rx, ry);
  drawFace(g, species, cx, cy, rx, ry, p);
  drawAccessories(g, species, cx, cy, rx, ry, p.t ?? 0, p);
  return g;
}

function buildTimeline(frameCount, fn) {
  return Array.from({ length: frameCount }, (_, i) => fn(i / frameCount, i));
}

export const ANIMATIONS = {
  /* sprout — slow breathing, one blink near the loop point */
  idle: {
    species: 'sprout',
    delayMs: 90,
    frames: buildTimeline(28, t => {
      const breathe = Math.sin(t * Math.PI * 2);
      const ry = REST.ry + breathe * 0.5;
      const blink = t > 0.82 && t < 0.92 ? 1 - Math.min(1, (t - 0.82) / 0.05) * Math.min(1, (0.92 - t) / 0.05) * 2 : 1;
      return drawSlime('sprout', {
        cx: REST.cx, cy: REST.cy - breathe * 0.3, ...squash(ry), t,
        eyeOpen: Math.max(0.15, blink), mouth: 'dot', mouthOpen: 0, blush: false, sparkle: 0, pelletY: null,
      });
    }),
  },

  /* bubble — a pellet drops in, the mouth opens and gulps it, a happy settle */
  eat: {
    species: 'bubble',
    delayMs: 80,
    frames: buildTimeline(30, (t) => {
      const dropT = Math.min(1, t / 0.42);
      const gulpT = t >= 0.42 && t < 0.62 ? (t - 0.42) / 0.20 : (t < 0.42 ? 0 : 1);
      const settleT = t >= 0.62 ? (t - 0.62) / 0.38 : 0;

      // falls to just above the mouth (cy + ry*0.28), not to eye height —
      // it needs to visibly queue up in front of the mouth before the
      // gulp phase opens it, not hover between the eyes
      const pelletTargetY = REST.cy + REST.ry * 0.12;
      const pelletY = dropT < 1 ? 3 + ease.outBounce(dropT) * (pelletTargetY - 3) : null;
      const mouthOpen = gulpT > 0 && gulpT < 1 ? Math.sin(gulpT * Math.PI) : 0;
      const swallowSquish = settleT > 0 ? Math.sin(settleT * Math.PI) * 1.6 : (t >= 0.42 && t < 0.62 ? 1.1 : 0);
      const ry = REST.ry - swallowSquish;

      return drawSlime('bubble', {
        cx: REST.cx, cy: REST.cy + swallowSquish * 0.5, ...squash(ry), t,
        eyeOpen: mouthOpen > 0.3 ? 0.4 : 1, mouth: mouthOpen > 0.05 ? 'o' : 'smile', mouthOpen,
        blush: settleT > 0.3, sparkle: 0, pelletY,
      });
    }),
  },

  /* luna — slow low-amplitude breathing, eyes always shut, a drifting zzz */
  sleep: {
    species: 'luna',
    delayMs: 160,
    frames: buildTimeline(24, (t) => {
      const breathe = Math.sin(t * Math.PI * 2) * 0.28;
      const g = drawSlime('luna', {
        cx: REST.cx, cy: REST.cy - breathe * 0.4 + 1, ...squash(REST.ry + breathe), t,
        eyeOpen: 0, mouth: 'flat', mouthOpen: 0, blush: false, sparkle: 0, pelletY: null,
      });
      const zPositions = [[28, 9], [31, 5], [34, 1]];
      const phase = (t * 3) % 1;
      zPositions.forEach(([zx, zy], idx) => {
        const on = ((phase + idx / 3) % 1) < 0.55;
        if (on) dot(g, SIZE, zx, zy, 2);
      });
      return g;
    }),
  },

  /* puddle — an excited hop with a sparkle burst at the apex */
  happy: {
    species: 'puddle',
    delayMs: 70,
    frames: buildTimeline(22, (t) => {
      const hop = Math.sin(t * Math.PI * 2);
      const airborne = Math.max(0, hop);
      const squish = hop < -0.3 ? (-hop - 0.3) * 1.6 : 0;
      const ry = REST.ry - squish + airborne * 0.6;
      return drawSlime('puddle', {
        cx: REST.cx, cy: REST.cy - airborne * 6 + squish * 0.8, ...squash(ry), t,
        eyeOpen: 1, mouth: 'smile', mouthOpen: 0, blush: true,
        sparkle: airborne > 0.6 ? (airborne - 0.6) / 0.4 : 0, pelletY: null,
      });
    }),
  },
};
