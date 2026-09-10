/* Bakes the TD-VIDEO product loop to real .mp4 files — a 16:9 and a
   9:16 cut of the same six seconds.

   Run: bun run design/techniques/video/gen/bake-video.mjs

   SUBJECT — the NOVA-7, a fictional handheld console, on a light
   studio backdrop. The loop is a product reveal with beats: hold on
   the assembled unit, separate into its layers, hold open so the
   internals can actually be read, reassemble, settle. It earns its place on SL-04 better than a
   flat 2D loop would, because continuous tone, soft shadow falloff
   and specular rolloff are precisely the content a 256-colour palette
   destroys. The asset argues the page's video-vs-GIF case by existing.

   WHY A SOFTWARE RASTERISER RATHER THAN THREE.JS
   No Playwright here, and standing up a browser plus a frame-capture
   bridge to render a stack of boxes is a lot of machinery. Every
   surface in the model is a convex quad, so a painter's-algorithm
   rasteriser covers it — deterministic, no GPU, re-bakes unattended.

   MATERIALS — the thing that makes it read as a render rather than as
   shaded cardboard. Per pixel, not per face:
     · the view vector is recovered by intersecting the pixel's camera
       ray with the face's plane, so V varies across a surface the way
       it actually does under perspective
     · Schlick Fresnel, so glass and metal go reflective at grazing
       angles — the single biggest "looks real" lever there is
     · a procedural studio environment (softbox + sky + floor) sampled
       along the reflection vector, so reflections carry the room
     · metals tint their specular by albedo; dielectrics keep it white
     · the midframe is brushed: anisotropic streaks modulate its
       roughness along the extrusion axis
     · screen-space distance-to-edge drives a chamfer highlight, which
       is what stops flat quads reading as paper

   WHY THE LOOP IS EXACT — both motion channels are periodic on the 6s
   runtime: one 360° turn, one explode-and-close. Every post artefact
   is a pure function of (x, y, frame). Frame 179 hands to frame 0 with
   nothing to hide, and a re-bake is byte-identical. */

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'assets');
const TMP = process.env.SCRATCH || join(HERE, '.frames');
const FPS = 30, DUR = 6, NF = FPS * DUR;
const SS = Number(process.env.SSAA || 3);            // supersample factor

/* ── 5×7 bitmap font for the overlay ──────────────────────── */
const F = {
  '0':['01110','10001','10011','10101','11001','10001','01110'],'1':['00100','01100','00100','00100','00100','00100','01110'],
  '2':['01110','10001','00001','00110','01000','10000','11111'],'3':['11111','00010','00100','00010','00001','10001','01110'],
  '4':['00010','00110','01010','10010','11111','00010','00010'],'5':['11111','10000','11110','00001','00001','10001','01110'],
  '6':['00110','01000','10000','11110','10001','10001','01110'],'7':['11111','00001','00010','00100','01000','01000','01000'],
  '8':['01110','10001','10001','01110','10001','10001','01110'],'9':['01110','10001','10001','01111','00001','00010','01100'],
  'A':['01110','10001','10001','11111','10001','10001','10001'],'B':['11110','10001','10001','11110','10001','10001','11110'],
  'C':['01110','10001','10000','10000','10000','10001','01110'],'D':['11100','10010','10001','10001','10001','10010','11100'],
  'E':['11111','10000','10000','11110','10000','10000','11111'],'F':['11111','10000','10000','11110','10000','10000','10000'],
  'G':['01110','10001','10000','10111','10001','10001','01111'],'H':['10001','10001','10001','11111','10001','10001','10001'],
  'I':['01110','00100','00100','00100','00100','00100','01110'],'J':['00111','00010','00010','00010','00010','10010','01100'],
  'K':['10001','10010','10100','11000','10100','10010','10001'],'L':['10000','10000','10000','10000','10000','10000','11111'],
  'M':['10001','11011','10101','10101','10001','10001','10001'],'N':['10001','11001','10101','10011','10001','10001','10001'],
  'O':['01110','10001','10001','10001','10001','10001','01110'],'P':['11110','10001','10001','11110','10000','10000','10000'],
  'Q':['01110','10001','10001','10001','10101','10010','01101'],'R':['11110','10001','10001','11110','10100','10010','10001'],
  'S':['01111','10000','10000','01110','00001','00001','11110'],'T':['11111','00100','00100','00100','00100','00100','00100'],
  'U':['10001','10001','10001','10001','10001','10001','01110'],'V':['10001','10001','10001','10001','10001','01010','00100'],
  'W':['10001','10001','10001','10101','10101','11011','10001'],'X':['10001','10001','01010','00100','01010','10001','10001'],
  'Y':['10001','10001','01010','00100','00100','00100','00100'],'Z':['11111','00001','00010','00100','01000','10000','11111'],
  ':':['00000','00100','00100','00000','00100','00100','00000'],'-':['00000','00000','00000','01110','00000','00000','00000'],
  '.':['00000','00000','00000','00000','00000','01100','01100'],'/':['00001','00010','00010','00100','01000','01000','10000'],
  ' ':['00000','00000','00000','00000','00000','00000','00000'],
};

/* ── framebuffer ──────────────────────────────────────────── */
function buf(W, H) { return { W, H, d: new Float32Array(W * H * 3) }; }
function set(b, x, y, r, g, bl, a = 1) {
  x |= 0; y |= 0;
  if (x < 0 || y < 0 || x >= b.W || y >= b.H) return;
  const i = (y * b.W + x) * 3;
  if (a >= 1) { b.d[i] = r; b.d[i+1] = g; b.d[i+2] = bl; return; }
  b.d[i] += (r - b.d[i]) * a; b.d[i+1] += (g - b.d[i+1]) * a; b.d[i+2] += (bl - b.d[i+2]) * a;
}
const rect = (b,x,y,w,h,c,a=1) => { for (let j=0;j<h;j++) for (let i=0;i<w;i++) set(b,x+i,y+j,c[0],c[1],c[2],a); };
function text(b, x, y, s, c, sc = 1, a = 1) {
  let cx = x;
  for (const ch of s.toUpperCase()) {
    const gl = F[ch] || F[' '];
    for (let r = 0; r < 7; r++) for (let col = 0; col < 5; col++)
      if (gl[r][col] === '1') rect(b, cx + col*sc, y + r*sc, sc, sc, c, a);
    cx += 6 * sc;
  }
}

/* ── vec / camera ─────────────────────────────────────────── */
const sub = (a,b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const dot = (a,b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
const norm = v => { const l = Math.hypot(v[0],v[1],v[2]) || 1; return [v[0]/l, v[1]/l, v[2]/l]; };
const rotY = (p,a) => { const c=Math.cos(a), s=Math.sin(a); return [p[0]*c+p[2]*s, p[1], -p[0]*s+p[2]*c]; };
const rotX = (p,a) => { const c=Math.cos(a), s=Math.sin(a); return [p[0], p[1]*c-p[2]*s, p[1]*s+p[2]*c]; };

const CAM_Z = 158, FOV = 205;   // tighter framing — the assembly should own the frame
let PK = 1;                                           // FOV*(H/100), set per frame
const project = (p, W, H) => {
  const k = PK / Math.max(1, CAM_Z - p[2]);
  return [W/2 + p[0]*k, H/2 - p[1]*k, p[2]];
};

/* ── procedural studio environment ────────────────────────────
   A big softbox up-left, a weaker fill right, sky above, floor below.
   Sampled along the reflection vector — this is what puts the room
   into the glass and the metal. */
function envSample(r) {
  const y = r[1];
  let c;
  if (y > 0) { const k = Math.min(1, y); c = [236 + k*18, 238 + k*17, 242 + k*13]; }
  else { const k = Math.min(1, -y); c = [214 - k*46, 214 - k*46, 218 - k*44]; }
  const key = Math.max(0, dot(r, norm([-0.42, 0.72, 0.55])));
  const box = Math.pow(key, 22) * 255 + Math.pow(key, 5) * 42;
  const fill = Math.pow(Math.max(0, dot(r, norm([0.75, 0.15, 0.55]))), 12) * 60;
  return [Math.min(255, c[0] + box + fill), Math.min(255, c[1] + box + fill), Math.min(255, c[2] + box*1.02 + fill)];
}

const KEY = norm([-0.42, 0.72, 0.55]);
const FILL = norm([0.75, 0.15, 0.55]);
const schlick = (f0, c) => f0 + (1 - f0) * Math.pow(1 - c, 5);

function hash(x, y, f) {
  let n = (x * 374761393 + y * 668265263 + f * 1442695041) | 0;
  n = (n ^ (n >>> 13)) * 1274126177 | 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

/* ── materials ────────────────────────────────────────────── */
const M = {
  glass:  { col:[24,28,37],    rough:0.035, f0:0.075, metal:0, edge:1.6 },
  panel:  { col:[13,15,20],    rough:0.30,  f0:0.045, metal:0, edge:0.7 },
  alu:    { col:[196,199,206], rough:0.24,  f0:0.92,  metal:1, edge:1.9, brush:1 },
  batt:   { col:[62,66,76],    rough:0.62,  f0:0.05,  metal:0, edge:0.6 },
  pcb:    { col:[34,84,58],    rough:0.52,  f0:0.06,  metal:0, edge:0.6 },
  back:   { col:[233,234,238], rough:0.10,  f0:0.06,  metal:0, edge:1.4 },
  lens:   { col:[12,14,22],    rough:0.03,  f0:0.09,  metal:0, edge:2.2 },
  copper: { col:[190,132,78],  rough:0.35,  f0:0.90,  metal:1, edge:1.2 },
  shell:  { col:[86,91,100],   rough:0.44,  f0:0.05,  metal:0, edge:1.3 },
  shell2: { col:[58,62,70],    rough:0.52,  f0:0.05,  metal:0, edge:1.2 },
  rubber: { col:[32,35,42],    rough:0.80,  f0:0.04,  metal:0, edge:0.9 },
  btnA:   { col:[196,64,72],   rough:0.34,  f0:0.06,  metal:0, edge:1.2 },
  btnB:   { col:[62,104,190],  rough:0.34,  f0:0.06,  metal:0, edge:1.2 },
  chip:   { col:[30,32,38],    rough:0.44,  f0:0.05,  metal:0, edge:0.9 },
};

/* ── the model: NOVA-7, a fictional handheld console ──────────
   Local axes: X right, Y up, Z toward camera. The stack separates
   along Z, because an exploded view only reads as one if it comes
   apart the way the object is actually assembled — front shell off
   the front, back shell off the back, boards in between.

   The front shell is built as four bars around a screen aperture
   rather than one slab with a hole, because a solid-quad rasteriser
   has no way to punch a hole — and modelling the bezel as real
   frame members is what lets the LCD sit *inside* it rather than
   floating in front. Everything else is boxes and cylinders. */
const box = (x, y, z, w, h, d, m, ex) => ({ k:'b', x, y, z, w, h, d, m, ex });
const cyl = (x, y, z, r, d, m, ex, seg = 18) => ({ k:'c', x, y, z, r, d, m, ex, seg });

const SCR_W = 26, SCR_H = 20;          // screen aperture
const SHELL_W = 62, SHELL_H = 32;

const PARTS = [
  // ── front shell: four bars framing the aperture ──
  box(0,  13.0,  2.2, SHELL_W, 6.0, 2.6, M.shell,  13),
  box(0, -13.0,  2.2, SHELL_W, 6.0, 2.6, M.shell,  13),
  box(-22.0, 0,  2.2, 18.0, SCR_H, 2.6, M.shell,   13),
  box( 22.0, 0,  2.2, 18.0, SCR_H, 2.6, M.shell,   13),
  // ── display stack ──
  box(0, 0,  2.5, SCR_W, SCR_H, 0.35, M.glass, 10.0),
  box(0, 0,  1.5, SCR_W - 1.6, SCR_H - 1.6, 0.9, M.panel, 7.4),
  // ── controls, proud of the shell ──
  box(-21, -0.5, 3.9, 10.5, 3.4, 1.5, M.rubber, 16.5),   // d-pad horizontal
  box(-21, -0.5, 3.9, 3.4, 10.5, 1.5, M.rubber, 16.5),   // d-pad vertical
  cyl( 21.0,  4.6, 4.1, 2.5, 1.7, M.btnA, 16.5),
  cyl( 21.0, -5.6, 4.1, 2.5, 1.7, M.btnB, 16.5),
  cyl( 15.9, -0.5, 4.1, 2.5, 1.7, M.btnB, 16.5),
  cyl( 26.1, -0.5, 4.1, 2.5, 1.7, M.btnA, 16.5),
  box(-4.5, -12.0, 3.8, 6.0, 1.8, 1.1, M.rubber, 16.5),  // select
  box( 4.5, -12.0, 3.8, 6.0, 1.8, 1.1, M.rubber, 16.5),  // start
  box(-24, 15.6, 1.6, 12, 3.0, 3.0, M.shell, 15),        // shoulder L
  box( 24, 15.6, 1.6, 12, 3.0, 3.0, M.shell, 15),        // shoulder R
  // ── membrane + board ──
  box(0, 0, 0.5, SHELL_W - 6, SHELL_H - 5, 0.35, M.rubber, 4.0),
  box(0, -1.0, -0.7, SHELL_W - 8, SHELL_H - 8, 0.8, M.pcb, -1.0),
  // ── shielding, power, cartridge, speakers ──
  box(-12, 2.0, -1.7, 15, 11, 1.1, M.alu, -5.0),
  box( 16, -2.0, -2.2, 20, 12, 2.2, M.batt, -6.5),
  box(0, 13.0, -2.0, 22, 5.0, 2.6, M.alu, -6.5),         // cartridge slot
  cyl(-26.5, -11.0, -1.6, 3.4, 1.6, M.alu, -5.0),
  cyl( 26.5, -11.0, -1.6, 3.4, 1.6, M.alu, -5.0),
  // ── back shell ──
  box(0, 0, -4.2, SHELL_W, SHELL_H, 2.6, M.shell2, -13),
];

/* board furniture — chips, connectors, a copper coil. Small parts are
   most of what makes an exploded view read as "intricate"; they cost
   almost nothing and they travel with the board they sit on. */
const CHIPS = [
  [-14, 3.0, 7.5, 5.5, M.chip], [-5.5, 3.5, 6.0, 6.0, M.chip],
  [ 3.5, 4.0, 5.0, 4.0, M.chip], [ 12, 2.0, 6.5, 3.0, M.chip],
  [-16, -6.0, 9.0, 2.4, M.copper], [-4, -7.0, 7.0, 2.0, M.copper],
  [ 9, -6.5, 5.0, 2.2, M.copper], [ 17, 5.5, 3.0, 3.0, M.copper],
];

function boxFaces(x, y, z, w, h, d, m, out) {
  const hw=w/2, hh=h/2, hd=d/2;
  const V = [
    [x-hw,y-hh,z-hd],[x+hw,y-hh,z-hd],[x+hw,y+hh,z-hd],[x-hw,y+hh,z-hd],
    [x-hw,y-hh,z+hd],[x+hw,y-hh,z+hd],[x+hw,y+hh,z+hd],[x-hw,y+hh,z+hd],
  ];
  for (const q of [[4,5,6,7],[1,0,3,2],[5,1,2,6],[0,4,7,3],[3,7,6,2],[4,0,1,5]])
    out.push({ v: q.map(i => V[i]), m });
}
function cylFaces(x, y, z, r, d, m, seg, out) {
  const z0 = z - d/2, z1 = z + d/2, ring = [];
  for (let i = 0; i < seg; i++) {
    const a = (i/seg)*Math.PI*2;
    ring.push([x + Math.cos(a)*r, y + Math.sin(a)*r]);
  }
  out.push({ v: ring.map(([px,py]) => [px,py,z1]), m });                 // cap front
  out.push({ v: ring.slice().reverse().map(([px,py]) => [px,py,z0]), m }); // cap back
  for (let i = 0; i < seg; i++) {                                         // wall
    const p0 = ring[i], p1 = ring[(i+1)%seg];
    out.push({ v: [[p0[0],p0[1],z0],[p1[0],p1[1],z0],[p1[0],p1[1],z1],[p0[0],p0[1],z1]], m });
  }
}
function buildFaces(ex) {
  const out = [];
  for (const p of PARTS) {
    const z = p.z + p.ex * ex;
    if (p.k === 'b') boxFaces(p.x, p.y, z, p.w, p.h, p.d, p.m, out);
    else cylFaces(p.x, p.y, z, p.r, p.d, p.m, p.seg, out);
  }
  const boardZ = -0.7 + (-1.0) * ex;      // chips ride the board they sit on
  for (const [cx, cy, cw, ch, m] of CHIPS)
    boxFaces(cx, cy - 1.0, boardZ + 0.75, cw, ch, 0.7, m, out);
  return out;
}

/* The reveal has beats, not a continuous oscillation: the earlier sine
   never actually rested on the assembled product, so you never got to
   see the thing before it came apart. Hold assembled → separate → hold
   open → reassemble → hold. Both holds sit at a stationary value, so
   the wrap from frame 179 to 0 is not just continuous but motionless —
   which is the cleanest possible loop seam. */
function explodeArc(t) {
  const seg = (a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
  const smooth = x => x * x * (3 - 2 * x);
  if (t < 0.14) return 0;                       // establish the product
  if (t < 0.40) return smooth(seg(0.14, 0.40)); // come apart
  if (t < 0.62) return 1;                       // hold open — read the internals
  if (t < 0.88) return 1 - smooth(seg(0.62, 0.88));
  return 0;                                     // settled again
}

/* ── shading ──────────────────────────────────────────────── */
const MARK = [88, 94, 102], SIGNAL = [214, 58, 48];

function renderFrame(W, H, f, label) {
  const w = W*SS, h = H*SS;
  PK = FOV * (Math.min(w, h) / 100);
  const b = buf(w, h);
  const zb = new Float32Array(w * h).fill(-1e9);
  const t = f / NF;
  /* Base yaw keeps the turn passing through three-quarter views rather
     than through a dead-on front, and the explode cycle is phase-shifted
     a quarter turn so frame 0 — which is also the poster — lands on a
     half-separated stack instead of a closed black slab. Both are still
     periodic on the loop, so exactness is untouched. */
  /* A full 360 turntable was the wrong choice for an exploded view: it
     necessarily passes through front-on, where a stack that separates
     along Z collapses to nothing and the front glass occludes every
     part behind it. Oscillating inside a flattering three-quarter arc
     keeps all six plates legible for the whole loop — and a sine sweep
     is still exactly periodic, so the loop stays seamless. */
  const spin = -0.76 + 0.32 * Math.sin(t * Math.PI * 2);
  const ex = explodeArc(t);
  const tilt = -0.30 + Math.sin(t * Math.PI * 2) * 0.05;

  // studio backdrop — soft falloff plus a broad key bloom
  for (let y = 0; y < h; y++) {
    const v = y / h, base = 250 - v*34;
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const key = Math.exp(-(((u-0.33)**2)/0.11 + ((v-0.20)**2)/0.17)) * 13;
      const g = base + key;
      set(b, x, y, g+1, g, g-3);
    }
  }
  // pooled contact shadow
  /* falls to zero at the ellipse boundary — the previous version still
     had ~0.11 alpha at the rim and then hard-cut, which read as a grey
     rectangle rather than a pooled shadow */
  const shY = h*0.82, shR = w*0.34, shH = h*0.075*(1 + ex*0.3);
  for (let y = -shH; y <= shH; y++) for (let x = -shR; x <= shR; x++) {
    const d = (x/shR)**2 + (y/shH)**2;
    if (d >= 1) continue;
    set(b, w/2 + x, shY + y, 100, 102, 112, 0.40 * Math.pow(1 - d, 1.7));
  }

  const faces = [];
  for (const fc of buildFaces(ex)) {
    const world = fc.v.map(p => rotX(rotY(p, spin), tilt));
    const n = norm(cross(sub(world[1], world[0]), sub(world[2], world[0])));
    if (n[2] <= 0.015) continue;
    faces.push({ w: world, s: world.map(p => project(p, w, h)), n, m: fc.m,
                 zc: world.reduce((s,p) => s + p[2], 0) / world.length });
  }
  faces.sort((a, b2) => a.zc - b2.zc);

  for (const fa of faces) paintFace(b, zb, w, h, fa);

  drawOverlay(b, w, h, f, label, Math.max(1, Math.round(SS)));
  const out = downsample(b, W, H);
  videoPass(out, W, H, f);
  return out;
}

function paintFace(b, zb, W, H, fa) {
  const { s: pts, n, m } = fa;
  const pd = dot(n, fa.w[0]);                          // plane constant
  let minY = Infinity, maxY = -Infinity;
  for (const p of pts) { if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1]; }
  const y0 = Math.max(0, Math.ceil(minY)), y1 = Math.min(H-1, Math.floor(maxY));
  const spec0 = m.metal ? m.col.map(c => c/255) : [m.f0, m.f0, m.f0];
  const shine = Math.max(2, 2 / (m.rough*m.rough) );

  for (let y = y0; y <= y1; y++) {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], c = pts[(i+1) % pts.length];
      if ((a[1] <= y && c[1] > y) || (c[1] <= y && a[1] > y)) {
        const t2 = (y - a[1]) / (c[1] - a[1]);
        const x = a[0] + (c[0]-a[0])*t2;
        if (x < lo) lo = x; if (x > hi) hi = x;
      }
    }
    if (lo > hi) continue;
    const x0 = Math.max(0, Math.ceil(lo)), x1 = Math.min(W-1, Math.floor(hi));
    for (let x = x0; x <= x1; x++) {
      // camera ray → plane: gives the true world point, so V is per-pixel
      const dir = norm([(x - W/2)/PK, (H/2 - y)/PK, -1]);
      const den = dot(n, dir);
      if (Math.abs(den) < 1e-6) continue;
      const dist = (pd - dot(n, [0,0,CAM_Z])) / den;
      const P = [dir[0]*dist, dir[1]*dist, CAM_Z + dir[2]*dist];
      const zi = y*W + x;
      if (P[2] <= zb[zi]) continue;               // occluded — depth test
      zb[zi] = P[2];
      const V = norm(sub([0,0,CAM_Z], P));
      const nv = Math.max(1e-4, dot(n, V));

      // brushed anisotropy: streaks along the extrusion axis
      let rough = m.rough;
      if (m.brush) rough *= 0.72 + 0.62 * hash(Math.round(P[1]*7), 0, 0);

      const F = schlick(0, nv);
      const R = norm([2*nv*n[0] - V[0], 2*nv*n[1] - V[1], 2*nv*n[2] - V[2]]);
      const env = envSample(R);
      const envK = (m.metal ? 0.88 : 0.16 + 1.05 * F) * (1 - rough*0.5);

      /* Diffuse and specular are kept in separate accumulators on
         purpose. Folding specular into the diffuse term — as an earlier
         pass did — means it gets multiplied by albedo and by kd, so a
         highlight of 0.5 arrives as 0.5·255·albedo·0.62 and saturates
         the whole lit face. That is what turned a graphite shell white.
         Albedo modulates diffuse only; specular and environment are
         added afterwards as light, tinted by albedo for metals alone. */
      let dl = 0, sr = 0, sg = 0, sb = 0;
      for (const [Ld, amt] of [[KEY, 1.0], [FILL, 0.34]]) {
        dl += Math.max(0, dot(n, Ld)) * amt;
        const Hv = norm([Ld[0]+V[0], Ld[1]+V[1], Ld[2]+V[2]]);
        const sp = Math.pow(Math.max(0, dot(n, Hv)), Math.max(2, shine * (m.brush ? 0.5 : 1))) * amt;
        const fs = schlick(spec0[0], nv) * sp * 190;
        sr += fs * (m.metal ? m.col[0]/255 : 1);
        sg += fs * (m.metal ? m.col[1]/255 : 1);
        sb += fs * (m.metal ? m.col[2]/255 : 1);
      }
      // chamfer: brighten a hair near the silhouette so quads read as solids
      let ed = Infinity;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], c = pts[(i+1) % pts.length];
        const ex2 = c[0]-a[0], ey2 = c[1]-a[1], ll = Math.hypot(ex2, ey2) || 1;
        ed = Math.min(ed, Math.abs((x-a[0])*ey2 - (y-a[1])*ex2) / ll);
      }
      const bev = Math.exp(-ed / (1.6 * SS)) * (m.edge || 1) * 26;

      const kd = m.metal ? 0.06 : 0.62;
      const amb = 0.30;
      const i2 = (y*W + x)*3;
      b.d[i2]   = Math.min(255, m.col[0]*(amb + kd*dl) + sr + env[0]*envK + bev);
      b.d[i2+1] = Math.min(255, m.col[1]*(amb + kd*dl) + sg + env[1]*envK + bev);
      b.d[i2+2] = Math.min(255, m.col[2]*(amb + kd*dl) + sb + env[2]*envK + bev);
    }
  }
}

function downsample(b, W, H) {
  const o = buf(W, H), n = SS*SS;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let r=0, g=0, bl=0;
    for (let j = 0; j < SS; j++) for (let i = 0; i < SS; i++) {
      const k = ((y*SS+j)*b.W + (x*SS+i))*3;
      r += b.d[k]; g += b.d[k+1]; bl += b.d[k+2];
    }
    const o1 = (y*W + x)*3;
    o.d[o1] = r/n; o.d[o1+1] = g/n; o.d[o1+2] = bl/n;
  }
  return o;
}

/* Overlay kept light — a product reel wants a corner mark and a
   timecode, not a full test card. */
function drawOverlay(b, W, H, f, label, sc) {
  const m = Math.round(Math.min(W,H)*0.045), s = Math.max(1, Math.round(Math.min(W,H)/300));
  const arm = Math.round(W*0.04), th = Math.max(1, s);
  for (const [ax, ay, dx, dy] of [[m,m,1,1],[W-m,m,-1,1],[m,H-m,1,-1],[W-m,H-m,-1,-1]]) {
    rect(b, dx > 0 ? ax : ax-arm, ay, arm, th, MARK, 0.5);
    rect(b, ax - (dx > 0 ? 0 : th), dy > 0 ? ay : ay-arm, th, arm, MARK, 0.5);
  }
  const on = (f % FPS) < FPS*0.55, rr = 3*s;
  for (let y = -rr; y <= rr; y++) for (let x = -rr; x <= rr; x++)
    if (x*x + y*y <= rr*rr) set(b, m+6*s+x, m+10*s+y, SIGNAL[0], SIGNAL[1], SIGNAL[2], on ? 1 : 0.2);
  text(b, m+12*s, m+7*s, 'REC', MARK, s, on ? 0.92 : 0.4);
  text(b, W-m-6*5*s, m+7*s, label, MARK, s, 0.88);
  text(b, m, H-m-9*s, `00:00:${String(Math.floor(f/FPS)).padStart(2,'0')}:${String(f%FPS).padStart(2,'0')}`, MARK, s, 0.88);
  text(b, W-m-6*8*s, H-m-9*s, 'TD-VIDEO', MARK, s, 0.65);
  text(b, m, H-m-20*s, 'NOVA-7 / EXPLODED VIEW / LOOP 6.00S', MARK, s, 0.5);
}

/* ── video pass: glare, grain, gate weave, occasional tear ─── */
const BURSTS = [21, 68, 112, 155];
function videoPass(b, W, H, f) {
  const src = Float32Array.from(b.d);
  const burst = BURSTS.includes(f);
  const ph = (f/NF)*Math.PI*2;
  const glareC = 0.34 + 0.22*Math.sin(ph);
  for (let y = 0; y < H; y++) {
    let shift = 0;
    if (burst) {
      const band = Math.floor(y / Math.max(6, H/20)), r = hash(band*7, band*13, f);
      if (r > 0.72) shift = Math.round((r-0.72)*36) * (r > 0.88 ? -1 : 1);
    }
    const weave = Math.sin(y*0.03 + ph*2)*0.7 + Math.sin(ph)*0.5;
    for (let x = 0; x < W; x++) {
      const i = (y*W + x)*3;
      const sx = Math.max(0, Math.min(W-1, Math.round(x + shift + weave)));
      const off = burst && shift ? 3 : 1;
      const rx = Math.max(0, Math.min(W-1, sx+off)), bx = Math.max(0, Math.min(W-1, sx-off));
      const r = src[(y*W+rx)*3], g = src[(y*W+sx)*3+1], bl = src[(y*W+bx)*3+2];
      const gd = ((x/W)*0.72 + (y/H)*0.28) - glareC;
      const glare = Math.exp(-(gd*gd)/0.007)*22;
      const n = (hash(x>>1, y>>1, f>>1) - 0.5)*5;
      const dx = (x/W-0.5)*2, dy = (y/H-0.5)*2;
      const vig = 1 - Math.min(1, (dx*dx + dy*dy)*0.15);
      b.d[i]   = Math.max(0, Math.min(255, r*vig + glare + n));
      b.d[i+1] = Math.max(0, Math.min(255, g*vig + glare + n));
      b.d[i+2] = Math.max(0, Math.min(255, bl*vig + glare*1.04 + n));
    }
  }
}

/* ── bake ─────────────────────────────────────────────────── */
function ppm(b) {
  const px = Buffer.alloc(b.W*b.H*3);
  for (let i = 0; i < px.length; i++) px[i] = Math.max(0, Math.min(255, Math.round(b.d[i])));
  return Buffer.concat([Buffer.from(`P6\n${b.W} ${b.H}\n255\n`, 'ascii'), px]);
}
const CUTS = [
  { name: 'nova7-explode-16x9', W: 1280, H: 720, label: '16:9' },
  { name: 'nova7-explode-9x16', W: 720,  H: 1280, label: '9:16' },
];

mkdirSync(OUT, { recursive: true });
for (const cut of CUTS) {
  const dir = join(TMP, cut.name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const t0 = Date.now();
  for (let f = 0; f < NF; f++)
    writeFileSync(join(dir, `f_${String(f).padStart(4,'0')}.ppm`), ppm(renderFrame(cut.W, cut.H, f, cut.label)));

  const mp4 = join(OUT, `${cut.name}.mp4`);
  const enc = spawnSync('ffmpeg', ['-y','-hide_banner','-loglevel','error',
    '-framerate', String(FPS), '-i', join(dir,'f_%04d.ppm'),
    '-c:v','libx264','-pix_fmt','yuv420p','-crf','20','-preset','slow',
    '-movflags','+faststart', mp4], { encoding: 'utf8' });
  if (enc.status !== 0) { console.error(enc.stderr || enc.error); process.exit(1); }
  spawnSync('ffmpeg', ['-y','-hide_banner','-loglevel','error','-i', join(dir,'f_0000.ppm'),
    join(OUT, `${cut.name}-poster.png`)], { encoding: 'utf8' });
  rmSync(dir, { recursive: true, force: true });
  const kb = existsSync(mp4) ? (statSync(mp4).size/1024).toFixed(1) : '?';
  console.log(`bake-video: ${cut.name.padEnd(21)} ${cut.W}x${cut.H} @${SS}x SSAA  ${NF}f  ${kb} KB  ${((Date.now()-t0)/1000).toFixed(0)}s`);
}
