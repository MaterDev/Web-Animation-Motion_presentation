/* §4 · populations — the murmuration figure and the concourse. Both bin
   agents into a grid with atomics; the flock sorts by cell and queries
   neighbours by rank, the crowd relaxes a distance field and reads its
   gradient. Nothing about either population comes back except what is
   asked for on cue, and that asking is printed. */
import { $, DPR, TAU, col, hash2, storage, uniform, readback, compute, render, bind, attach, timer, card, pointer } from './common.js';

/* ── MURMURATION ──────────────────────────────────────────────────────── */
const WG = 256;
const COMMON = `
struct U { n: u32, grid: u32, mode: u32, hilite: u32, cell: f32, dt: f32, time: f32, wind: f32, k: u32, pad0: u32, radius: f32, sepR: f32, align: f32, cohere: f32, separate: f32, speed: f32, maxForce: f32, predR: f32, predF: f32, predOn: f32, pred: vec2f, wander: vec2f, world: vec2f, pad1: vec2f };
fn cellOf(p: vec2f, u: U) -> vec2u { return vec2u(clamp(u32(p.x / u.cell), 0u, u.grid * 2u - 1u), clamp(u32(p.y / u.cell), 0u, u.grid - 1u)); }
fn cellIndex(c: vec2u, u: U) -> u32 { return c.y * (u.grid * 2u) + c.x; }`;
const CLEAR = COMMON + `
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read_write> cellInfo: array<atomic<u32>>;
@group(0) @binding(2) var<storage, read_write> stats: array<atomic<u32>>;
@compute @workgroup_size(${WG}) fn main(@builtin(global_invocation_id) id: vec3u) { let i = id.x; let cells = u.grid * u.grid * 2u; if (i < cells) { atomicStore(&cellInfo[i * 2u], 0u); } if (i < 1028u) { atomicStore(&stats[i], 0u); } }`;
const BIN = COMMON + `
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> pos: array<vec2f>;
@group(0) @binding(2) var<storage, read_write> cellInfo: array<atomic<u32>>;
@group(0) @binding(3) var<storage, read_write> slotCell: array<vec2u>;
@compute @workgroup_size(${WG}) fn main(@builtin(global_invocation_id) id: vec3u) { let i = id.x; if (i >= u.n) { return; } let c = cellIndex(cellOf(pos[i], u), u); slotCell[i] = vec2u(atomicAdd(&cellInfo[c * 2u], 1u), c); }`;
const SCAN = COMMON + `
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read_write> cellInfo: array<u32>;
var<workgroup> partial: array<u32, ${WG}>;
@compute @workgroup_size(${WG}) fn main(@builtin(local_invocation_id) lid: vec3u) {
  let cells = u.grid * u.grid * 2u; let per = (cells + ${WG}u - 1u) / ${WG}u; let t = lid.x; let a = t * per; let b = min(a + per, cells);
  var s = 0u; for (var i = a; i < b; i++) { s += cellInfo[i * 2u]; } partial[t] = s; workgroupBarrier();
  var off = 1u; for (var d = ${WG}u >> 1u; d > 0u; d = d >> 1u) { workgroupBarrier(); if (t < d) { let ai = off * (2u * t + 1u) - 1u; let bi = off * (2u * t + 2u) - 1u; partial[bi] += partial[ai]; } off = off << 1u; }
  if (t == 0u) { partial[${WG}u - 1u] = 0u; }
  for (var d = 1u; d < ${WG}u; d = d << 1u) { off = off >> 1u; workgroupBarrier(); if (t < d) { let ai = off * (2u * t + 1u) - 1u; let bi = off * (2u * t + 2u) - 1u; let tmp = partial[ai]; partial[ai] = partial[bi]; partial[bi] += tmp; } }
  workgroupBarrier(); var run = partial[t]; for (var i = a; i < b; i++) { cellInfo[i * 2u + 1u] = run; run += cellInfo[i * 2u]; }
}`;
const SCATTER = COMMON + `
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> pos: array<vec2f>;
@group(0) @binding(2) var<storage, read> vel: array<vec2f>;
@group(0) @binding(3) var<storage, read> ident: array<u32>;
@group(0) @binding(4) var<storage, read> slotCell: array<vec2u>;
@group(0) @binding(5) var<storage, read> cellInfo: array<u32>;
@group(0) @binding(6) var<storage, read_write> posS: array<vec2f>;
@group(0) @binding(7) var<storage, read_write> velS: array<vec2f>;
@group(0) @binding(8) var<storage, read_write> identS: array<u32>;
@compute @workgroup_size(${WG}) fn main(@builtin(global_invocation_id) id: vec3u) { let i = id.x; if (i >= u.n) { return; } let sc = slotCell[i]; let dst = cellInfo[sc.y * 2u + 1u] + sc.x; posS[dst] = pos[i]; velS[dst] = vel[i]; identS[dst] = ident[i]; }`;
const QUERY = COMMON + `
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> posS: array<vec2f>;
@group(0) @binding(2) var<storage, read> velS: array<vec2f>;
@group(0) @binding(3) var<storage, read> identS: array<u32>;
@group(0) @binding(4) var<storage, read> cellInfo: array<u32>;
@group(0) @binding(5) var<storage, read_write> pos: array<vec2f>;
@group(0) @binding(6) var<storage, read_write> vel: array<vec2f>;
@group(0) @binding(7) var<storage, read_write> ident: array<u32>;
@group(0) @binding(8) var<storage, read_write> stats: array<atomic<u32>>;
fn hash(n: u32) -> f32 { var x = n * 747796405u + 2891336453u; x = ((x >> ((x >> 28u) + 4u)) ^ x) * 277803737u; x = (x >> 22u) ^ x; return f32(x) / 4294967295.0; }
fn putInset(j: u32, q: vec2f) { atomicStore(&stats[1028u + j * 2u], bitcast<u32>(q.x)); atomicStore(&stats[1029u + j * 2u], bitcast<u32>(q.y)); }
@compute @workgroup_size(${WG}) fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x; if (i >= u.n) { return; }
  let p = posS[i]; let v = velS[i]; let me = identS[i]; let c = cellOf(p, u);
  var kd: array<f32, 8>; var kp: array<vec2f, 8>; var kv: array<vec2f, 8>; for (var j = 0u; j < 8u; j++) { kd[j] = 1e9; }
  var sumV = vec2f(0.0); var sumP = vec2f(0.0); var sep = vec2f(0.0); var nb = 0u; let r2 = u.radius * u.radius; let sr2 = u.sepR * u.sepR;
  for (var dy = -1; dy <= 1; dy++) { for (var dx = -1; dx <= 1; dx++) {
    let cx = i32(c.x) + dx; let cy = i32(c.y) + dy; if (cx < 0 || cy < 0 || cx >= i32(u.grid * 2u) || cy >= i32(u.grid)) { continue; }
    let ci = u32(cy) * (u.grid * 2u) + u32(cx); let s0 = cellInfo[ci * 2u + 1u]; let s1 = s0 + cellInfo[ci * 2u];
    for (var j = s0; j < s1; j++) { if (j == i) { continue; } let q = posS[j]; let d = q - p; let d2 = dot(d, d);
      if (d2 < sr2) { let dd = sqrt(d2); sep -= d / (dd + 1e-5) * (1.0 - dd / u.sepR); }
      if (u.mode == 0u) { if (d2 < r2) { sumV += velS[j]; sumP += q; nb++; } }
      else { if (d2 < kd[u.k - 1u]) { var m = u.k - 1u; while (m > 0u && kd[m - 1u] > d2) { kd[m] = kd[m - 1u]; kp[m] = kp[m - 1u]; kv[m] = kv[m - 1u]; m--; } kd[m] = d2; kp[m] = q; kv[m] = velS[j]; } }
    } } }
  if (u.mode == 1u) { for (var j = 0u; j < u.k; j++) { if (kd[j] < 1e8) { sumV += kv[j]; sumP += kp[j]; nb++; } } }
  var acc = vec2f(0.0);
  if (nb > 0u) { let fn_ = f32(nb); acc += (normalize(sumV / fn_ + 1e-6) * u.speed - v) * u.align + (sumP / fn_ - p) * u.cohere * 4.0; }
  acc += sep * u.separate * 0.18 + (u.world * 0.5 - p) * 0.3 + u.wander * u.wind * 0.3;
  if (u.predOn > 0.5) { let d = p - u.pred; let dd = length(d); if (dd < u.predR) { acc += d / (dd + 1e-4) * u.predF * (1.0 - dd / u.predR); } }
  let m = 0.06; if (p.x < m) { acc.x += (m - p.x) * 40.0; } if (p.x > u.world.x - m) { acc.x -= (p.x - u.world.x + m) * 40.0; } if (p.y < m) { acc.y += (m - p.y) * 40.0; } if (p.y > u.world.y - m) { acc.y -= (p.y - u.world.y + m) * 40.0; }
  let al = length(acc); if (al > u.maxForce) { acc = acc / al * u.maxForce; }
  var nv = v + acc * u.dt; let sp = length(nv); let tgt = u.speed * (0.9 + 0.2 * hash(me)); nv = nv / (sp + 1e-6) * mix(sp, tgt, 0.08); if (sp > u.speed * 2.2) { nv = nv / sp * u.speed * 2.2; }
  var np = clamp(p + nv * u.dt, vec2f(0.001), u.world - vec2f(0.001));
  pos[i] = np; vel[i] = nv; ident[i] = me;
  atomicAdd(&stats[1024u], nb);
  let ox = clamp(u32(np.x / u.world.x * 32.0), 0u, 31u); let oy = clamp(u32(np.y / u.world.y * 32.0), 0u, 31u); atomicAdd(&stats[oy * 32u + ox], 1u);
  if (me == u.hilite) { putInset(0u, np); if (u.mode == 1u) { for (var j = 0u; j < 8u; j++) { putInset(1u + j, select(np, kp[j], j < u.k && kd[j] < 1e8)); } } else { var w = 0u;
    for (var dy = -1; dy <= 1 && w < 8u; dy++) { for (var dx = -1; dx <= 1 && w < 8u; dx++) { let cx = i32(c.x) + dx; let cy = i32(c.y) + dy; if (cx < 0 || cy < 0 || cx >= i32(u.grid * 2u) || cy >= i32(u.grid)) { continue; }
      let ci = u32(cy) * (u.grid * 2u) + u32(cx); let s0 = cellInfo[ci * 2u + 1u]; let s1 = s0 + cellInfo[ci * 2u]; for (var j = s0; j < s1 && w < 8u; j++) { if (j == i) { continue; } let d = posS[j] - p; if (dot(d, d) < r2) { putInset(1u + w, posS[j]); w++; } } } }
    for (var j = w; j < 8u; j++) { putInset(1u + j, np); } } }
}`;
const RSTRUCT = `struct R { world: vec2f, res: vec2f, time: f32, mode: f32, hilite: f32, predOn: f32, pred: vec2f, pad: vec2f, dusk0: vec4f, dusk1: vec4f, bird: vec4f, accent: vec4f, predc: vec4f };`;
const SKY = RSTRUCT + `
@group(0) @binding(0) var<uniform> r: R;
struct VO { @builtin(position) p: vec4f, @location(0) uv: vec2f };
@vertex fn vs(@builtin(vertex_index) i: u32) -> VO { var o: VO; let x = f32((i << 1u) & 2u); let y = f32(i & 2u); o.uv = vec2f(x, y); o.p = vec4f(x * 2.0 - 1.0, y * 2.0 - 1.0, 0.0, 1.0); return o; }
@fragment fn fs(o: VO) -> @location(0) vec4f { let t = pow(o.uv.y, 1.35); var c = mix(r.dusk0.rgb, r.dusk1.rgb, t); let px = vec2u(u32(o.p.x) % 4u, u32(o.p.y) % 4u);
  let bayer = array<f32, 16>(0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.); let d = (bayer[px.y * 4u + px.x] + 0.5) / 16.0 - 0.5; c = floor(c * 48.0 + d) / 48.0; return vec4f(c, 1.0); }`;
const BIRDS = RSTRUCT + `
@group(0) @binding(0) var<uniform> r: R;
@group(0) @binding(1) var<storage, read> pos: array<vec2f>;
@group(0) @binding(2) var<storage, read> vel: array<vec2f>;
@group(0) @binding(3) var<storage, read> ident: array<u32>;
struct VO { @builtin(position) p: vec4f, @location(0) c: vec4f };
fn hash(n: u32) -> f32 { var x = n * 747796405u + 2891336453u; x = ((x >> ((x >> 28u) + 4u)) ^ x) * 277803737u; x = (x >> 22u) ^ x; return f32(x) / 4294967295.0; }
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO {
  let p = pos[ii]; let v = vel[ii]; let id = ident[ii]; let dir = normalize(v + vec2f(1e-5, 0.0)); let side = vec2f(-dir.y, dir.x);
  let flap = 0.55 + 0.45 * sin(r.time / 0.9 * 6.2831853 + hash(id) * 6.2831853); let s = 0.0019 * r.world.y; var q = p;
  if (vi == 0u) { q = p + dir * s * 1.6; } else if (vi == 1u) { q = p - dir * s * 0.8 + side * s * 1.4 * flap; } else { q = p - dir * s * 0.8 - side * s * 1.4 * flap; }
  var o: VO; o.p = vec4f(q.x / r.world.x * 2.0 - 1.0, q.y / r.world.y * 2.0 - 1.0, 0.0, 1.0); let hi = select(0.0, 1.0, id == u32(r.hilite)); o.c = vec4f(mix(r.bird, r.accent, hi).rgb, mix(0.32, 1.0, hi)); return o; }
@fragment fn fs(o: VO) -> @location(0) vec4f { return o.c; }`;
const INSET = RSTRUCT + `
@group(0) @binding(0) var<uniform> r: R;
@group(0) @binding(1) var<storage, read> stats: array<u32>;
struct VO { @builtin(position) p: vec4f, @location(0) c: vec4f };
fn insetAt(j: u32) -> vec2f { return vec2f(bitcast<f32>(stats[1028u + j * 2u]), bitcast<f32>(stats[1029u + j * 2u])); }
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO { let q = select(insetAt(0u), insetAt(1u + ii), vi == 1u); var o: VO; o.p = vec4f(q.x / r.world.x * 2.0 - 1.0, q.y / r.world.y * 2.0 - 1.0, 0.0, 1.0); o.c = r.accent; return o; }
@fragment fn fs(o: VO) -> @location(0) vec4f { return vec4f(o.c.rgb, 0.85); }`;
const PRED = RSTRUCT + `
@group(0) @binding(0) var<uniform> r: R;
struct VO { @builtin(position) p: vec4f, @location(0) c: vec4f };
@vertex fn vs(@builtin(vertex_index) vi: u32) -> VO { let s = 0.014 * r.world.y; let a = f32(vi) * 2.0943951 + r.time * 2.0; let q = r.pred + vec2f(cos(a), sin(a)) * s; var o: VO; o.p = vec4f(q.x / r.world.x * 2.0 - 1.0, q.y / r.world.y * 2.0 - 1.0, 0.0, 1.0); o.c = vec4f(r.predc.rgb, r.predOn); return o; }
@fragment fn fs(o: VO) -> @location(0) vec4f { if (o.c.a < 0.5) { discard; } return vec4f(o.c.rgb, 1.0); }`;

function murmurationCard() {
  const el = $('mu-card'), stage = $('mu-stage'), canvas = $('mu-canvas'), status = $('mu-status');
  const N = 262144, GRID = 128, WORLD = [1, 1], STATS_LEN = 1028 + 18; const P = { k: 7, radius: 2.6 * 0.9 / Math.sqrt(N), sepR: 0.9 / Math.sqrt(N), align: 1.0, cohere: 1.5, separate: 1.6, speed: 0.22, maxForce: 1.4, predR: 0.16, predF: 6.0, wander: 0.18 };
  let s = null, wind = [0, 0], ptrPanel = -1, stoop = { t0: -1, sample: -1, done: false };
  pointer(stage, (p) => { ptrPanel = p.x < 0.5 ? 0 : 1; const lx = (p.x - (ptrPanel ? 0.5 : 0)) * 2; wind = [(lx - 0.5) * 1.2, (0.5 - p.y) * 1.2]; }, () => { ptrPanel = -1; wind = [0, 0]; });
  const stoopPath = (k) => [(0.1 + 0.8 * k) * WORLD[0], (0.95 - 0.85 * Math.sin(Math.min(1, k) * Math.PI * 0.5) - 0.25 * Math.max(0, k - 0.5)) * WORLD[1]];
  const fire = () => { stoop = { t0: performance.now(), sample: -1, done: false }; };
  $('mu-stoop-now').addEventListener('click', fire); $('mu-reset').addEventListener('click', () => s && s.reset());
  const uni = new ArrayBuffer(112), U32 = new Uint32Array(uni), F32 = new Float32Array(uni), runi = new ArrayBuffer(128), RF = new Float32Array(runi);
  return card({ name: 'murmuration', el, init() {
    const dev = this.__dev, { ctx, fit } = attach(canvas);
    const pipes = { clear: compute(CLEAR), bin: compute(BIN), scan: compute(SCAN), scatter: compute(SCATTER), query: compute(QUERY), sky: render(SKY), birds: render(BIRDS, { blend: true }), inset: render(INSET, { topology: 'line-list', blend: true }), pred: render(PRED) };
    const cells = GRID * GRID * 2;
    const makePanel = (mode) => {
      const pos = storage(N * 8), vel = storage(N * 8), ident = storage(N * 4), posS = storage(N * 8), velS = storage(N * 8), identS = storage(N * 4), slotCell = storage(N * 8), cellInfo = storage(cells * 8), stats = storage(STATS_LEN * 4);
      const u = uniform(112), ru = uniform(128);
      const groups = { clear: bind(pipes.clear, [u, cellInfo, stats]), bin: bind(pipes.bin, [u, pos, cellInfo, slotCell]), scan: bind(pipes.scan, [u, cellInfo]), scatter: bind(pipes.scatter, [u, pos, vel, ident, slotCell, cellInfo, posS, velS, identS]), query: bind(pipes.query, [u, posS, velS, identS, cellInfo, pos, vel, ident, stats]), sky: bind(pipes.sky, [ru]), birds: bind(pipes.birds, [ru, pos, vel, ident]), inset: bind(pipes.inset, [ru, stats]), pred: bind(pipes.pred, [ru]) };
      const panel = { mode, u, ru, groups, pos, vel, ident, stats, statsRead: readback(STATS_LEN * 4) };
      panel.seed = () => { const p0 = new Float32Array(N * 2), v0 = new Float32Array(N * 2), id0 = new Uint32Array(N); let sd = 7; const rnd = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; };
        for (let i = 0; i < N; i++) { const a = rnd() * TAU, rr = Math.sqrt(rnd()) * 0.28; p0[i * 2] = WORLD[0] * 0.5 + Math.cos(a) * rr * 1.6; p0[i * 2 + 1] = WORLD[1] * 0.5 + Math.sin(a) * rr; const va = rnd() * TAU; v0[i * 2] = Math.cos(va) * P.speed; v0[i * 2 + 1] = Math.sin(va) * P.speed; id0[i] = i; }
        dev.queue.writeBuffer(pos, 0, p0); dev.queue.writeBuffer(vel, 0, v0); dev.queue.writeBuffer(ident, 0, id0); };
      panel.seed(); return panel;
    };
    const panels = [makePanel(0), makePanel(1)];
    const tm = timer(['bin', 'sort', 'query', 'render'].flatMap((n) => [n + '-a', n + '-b']));
    /* a dusk photograph: warm at the horizon, violet overhead, birds as ink */
    const COL = { dusk0: [0.95, 0.82, 0.66, 1], dusk1: [0.58, 0.52, 0.70, 1], bird: [0.13, 0.10, 0.16, 1], topo: col(el, '--mu-topo'), metr: col(el, '--mu-metr'), pred: col(el, '--mu-pred') };
    s = { ctx, fit, pipes, panels, tm, COL, reset: () => panels.forEach((p) => p.seed()) };
    $('mu-r-label').textContent = P.radius.toFixed(3); status.hidden = true;
  }, frame(t, dt, now) {
    if (!s) return; s.fit(); const dev = this.__dev, T = now / 1000;
    const sinceCue = T % 29; let stoopK = sinceCue < 2.4 ? sinceCue / 2.4 : -1;
    if (stoop.t0 >= 0) { const k = (now - stoop.t0) / 2400; stoopK = k <= 1 ? k : -1; if (k > 1) stoop.t0 = -1; }
    const predOn = stoopK >= 0 ? 1 : 0, pred = predOn ? stoopPath(stoopK) : [-1, -1], hilite = 12345 + 977 * (Math.floor(T / 5) % 200), wander = [Math.cos(TAU * T / 11), Math.sin(TAU * T / 11) * 0.6];
    const enc = dev.createCommandEncoder(), view = s.ctx.getCurrentTexture().createView(), w = canvas.width >> 1, h = canvas.height;
    s.panels.forEach((panel, i) => {
      U32[0] = N; U32[1] = GRID; U32[2] = panel.mode; U32[3] = hilite; F32[4] = WORLD[1] / GRID; F32[5] = dt; F32[6] = T; F32[7] = 1; U32[8] = P.k; F32[10] = P.radius; F32[11] = P.sepR; F32[12] = P.align; F32[13] = P.cohere; F32[14] = P.separate; F32[15] = P.speed; F32[16] = P.maxForce; F32[17] = P.predR; F32[18] = P.predF; F32[19] = predOn; F32[20] = pred[0]; F32[21] = pred[1]; F32[22] = wander[0] * P.wander + (ptrPanel === i ? wind[0] : 0); F32[23] = wander[1] * P.wander + (ptrPanel === i ? wind[1] : 0); F32[24] = WORLD[0]; F32[25] = WORLD[1];
      dev.queue.writeBuffer(panel.u, 0, uni);
      RF[0] = WORLD[0]; RF[1] = WORLD[1]; RF[2] = w; RF[3] = h; RF[4] = T; RF[5] = panel.mode; RF[6] = hilite; RF[7] = predOn; RF[8] = pred[0]; RF[9] = pred[1]; RF.set(s.COL.dusk0, 12); RF.set(s.COL.dusk1, 16); RF.set(s.COL.bird, 20); RF.set(panel.mode ? s.COL.topo : s.COL.metr, 24); RF.set(s.COL.pred, 28);
      dev.queue.writeBuffer(panel.ru, 0, runi);
      const ts = (j) => s.tm.begin(j * 2 + i), cells = GRID * GRID * 2, g = panel.groups, pp = s.pipes;
      let pass = enc.beginComputePass(ts(0)); pass.setPipeline(pp.clear); pass.setBindGroup(0, g.clear); pass.dispatchWorkgroups(Math.ceil(Math.max(cells, 1028) / WG)); pass.setPipeline(pp.bin); pass.setBindGroup(0, g.bin); pass.dispatchWorkgroups(Math.ceil(N / WG)); pass.end();
      pass = enc.beginComputePass(ts(1)); pass.setPipeline(pp.scan); pass.setBindGroup(0, g.scan); pass.dispatchWorkgroups(1); pass.setPipeline(pp.scatter); pass.setBindGroup(0, g.scatter); pass.dispatchWorkgroups(Math.ceil(N / WG)); pass.end();
      pass = enc.beginComputePass(ts(2)); pass.setPipeline(pp.query); pass.setBindGroup(0, g.query); pass.dispatchWorkgroups(Math.ceil(N / WG)); pass.end();
      const rp = enc.beginRenderPass({ colorAttachments: [{ view, loadOp: i === 0 ? 'clear' : 'load', storeOp: 'store' }], ...ts(3) });
      rp.setViewport(i * w, 0, w, h, 0, 1); rp.setScissorRect(i * w, 0, w, h);
      rp.setPipeline(pp.sky); rp.setBindGroup(0, g.sky); rp.draw(3); rp.setPipeline(pp.birds); rp.setBindGroup(0, g.birds); rp.draw(3, N); rp.setPipeline(pp.inset); rp.setBindGroup(0, g.inset); rp.draw(2, 8); rp.setPipeline(pp.pred); rp.setBindGroup(0, g.pred); rp.draw(3); rp.end();
    });
    s.tm.resolve(enc); dev.queue.submit([enc.finish()]);
    const r = s.tm.read(); ['bin', 'sort', 'query', 'render'].forEach((n) => { if (r[n + '-a'] !== undefined) $('mu-p-' + n).textContent = `${r[n + '-a'].toFixed(2)} / ${(r[n + '-b'] || 0).toFixed(2)} ms`; });
    if (predOn && stoop.sample < 0 && !stoop.done) { stoop.sample = now + 3000; $('mu-cue').classList.add('mu-on'); }
    if (stoop.sample > 0 && now > stoop.sample && !stoop.done) { stoop.done = true; stoop.sample = -1; $('mu-cue').classList.remove('mu-on'); this.readFragments(); }
  }, async readFragments() {
    const dev = this.__dev, t0 = performance.now(), enc = dev.createCommandEncoder();
    s.panels.forEach((p) => enc.copyBufferToBuffer(p.stats, 0, p.statsRead, 0, STATS_LEN * 4)); dev.queue.submit([enc.finish()]);
    const res = []; for (const p of s.panels) { await p.statsRead.mapAsync(GPUMapMode.READ); res.push(new Uint32Array(p.statsRead.getMappedRange().slice(0))); p.statsRead.unmap(); }
    const ms = performance.now() - t0;
    res.forEach((d, i) => { const thr = Math.max(2, N / 1024 * 0.04), occ = new Uint8Array(1024); for (let k = 0; k < 1024; k++) occ[k] = d[k] >= thr ? 1 : 0;
      let frags = 0; const seen = new Uint8Array(1024); for (let k = 0; k < 1024; k++) { if (!occ[k] || seen[k]) continue; frags++; const st = [k]; seen[k] = 1; while (st.length) { const c = st.pop(), x = c % 32, y = (c / 32) | 0; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx > 31 || ny > 31) return; const nk = ny * 32 + nx; if (occ[nk] && !seen[nk]) { seen[nk] = 1; st.push(nk); } }); } }
      const pk = i ? 'b' : 'a'; $(`mu-frag-${pk}`).textContent = frags; $(`mu-k-${pk}`).textContent = (d[1024] / N).toFixed(1); });
    $('mu-t-rb').textContent = `${ms.toFixed(1)} ms · 2 × 4.1 KB`;
  } });
}

/* ── CONCOURSE · a crowd through a station hall, kiosks you can move ──── */
const CW = 192, CH = 96, CN = 30000;
const CC_COMMON = `
struct U { w: u32, h: u32, n: u32, iter: u32, dt: f32, time: f32, pad: vec2f, kiosk: array<vec4f, 3> };
fn idx(x: i32, y: i32, u: U) -> u32 { return u32(clamp(y, 0, i32(u.h) - 1)) * u.w + u32(clamp(x, 0, i32(u.w) - 1)); }
fn blocked(p: vec2f, u: U) -> bool { if (p.y < 6.0 && (p.x < 20.0 || p.x > 172.0)) { return false; }
  if (p.x < 2.0 || p.x > f32(u.w) - 2.0 || p.y < 2.0 || p.y > f32(u.h) - 2.0) { return true; }
  for (var i = 0; i < 3; i++) { let k = u.kiosk[i]; if (abs(p.x - k.x) < k.z && abs(p.y - k.y) < k.w) { return true; } }
  /* the platform stairs are the goal: a slot at the top */
  return false; }
fn goal(p: vec2f, u: U) -> bool { return p.y > f32(u.h) - 5.0 && p.x > 70.0 && p.x < 122.0; }`;
/* the distance field: each cell = min over neighbours + 1, relaxed a few
   times per frame — Jacobi on a grid; it converges over frames, which is
   fine because the kiosks move slowly */
const CC_FIELD = CC_COMMON + `
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> src: array<f32>;
@group(0) @binding(2) var<storage, read_write> dst: array<f32>;
@compute @workgroup_size(16, 16) fn main(@builtin(global_invocation_id) id: vec3u) {
  let x = i32(id.x); let y = i32(id.y); if (x >= i32(u.w) || y >= i32(u.h)) { return; }
  let p = vec2f(f32(x) + 0.5, f32(y) + 0.5);
  if (goal(p, u)) { dst[idx(x, y, u)] = 0.0; return; }
  if (blocked(p, u)) { dst[idx(x, y, u)] = 1e5; return; }
  var m = 1e5; m = min(m, src[idx(x - 1, y, u)] + 1.0); m = min(m, src[idx(x + 1, y, u)] + 1.0); m = min(m, src[idx(x, y - 1, u)] + 1.0); m = min(m, src[idx(x, y + 1, u)] + 1.0);
  m = min(m, src[idx(x - 1, y - 1, u)] + 1.414); m = min(m, src[idx(x + 1, y - 1, u)] + 1.414); m = min(m, src[idx(x - 1, y + 1, u)] + 1.414); m = min(m, src[idx(x + 1, y + 1, u)] + 1.414);
  dst[idx(x, y, u)] = min(m, src[idx(x, y, u)]);
}`;
const CC_CLEAR = CC_COMMON + `
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read_write> dens: array<atomic<u32>>;
@compute @workgroup_size(256) fn main(@builtin(global_invocation_id) id: vec3u) { let i = id.x; if (i < u.w * u.h) { atomicStore(&dens[i], 0u); } if (i < 4u) { atomicStore(&dens[u.w * u.h + i], 0u); } }`;
const CC_STEP = CC_COMMON + `
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> field: array<f32>;
@group(0) @binding(2) var<storage, read_write> pos: array<vec2f>;
@group(0) @binding(3) var<storage, read_write> vel: array<vec2f>;
@group(0) @binding(4) var<storage, read> densIn: array<u32>;
@group(0) @binding(5) var<storage, read_write> dens: array<atomic<u32>>;
@group(0) @binding(6) var<storage, read_write> life: array<f32>;
fn hash(n: u32) -> f32 { var x = n * 747796405u + 2891336453u; x = ((x >> ((x >> 28u) + 4u)) ^ x) * 277803737u; x = (x >> 22u) ^ x; return f32(x) / 4294967295.0; }
fn F(p: vec2f) -> f32 { return field[idx(i32(p.x), i32(p.y), u)]; }
@compute @workgroup_size(256) fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x; if (i >= u.n) { return; }
  var p = pos[i]; var v = vel[i]; var L = life[i];
  /* downhill on the distance field, plus a push away from crowded cells */
  let gx = F(p + vec2f(1.0, 0.0)) - F(p - vec2f(1.0, 0.0)); let gy = F(p + vec2f(0.0, 1.0)) - F(p - vec2f(0.0, 1.0));
  var dir = -vec2f(gx, gy); let gl = length(dir); if (gl > 1e-3) { dir = dir / gl; }
  let dl = f32(densIn[idx(i32(p.x) - 1, i32(p.y), u)]); let dr = f32(densIn[idx(i32(p.x) + 1, i32(p.y), u)]); let dd = f32(densIn[idx(i32(p.x), i32(p.y) - 1, u)]); let du = f32(densIn[idx(i32(p.x), i32(p.y) + 1, u)]);
  let push = vec2f(dl - dr, dd - du) * 0.12 + vec2f(hash(i + u32(u.time * 7.0)) - 0.5, hash(i + 11u + u32(u.time * 7.0)) - 0.5) * 0.35; let here = f32(densIn[idx(i32(p.x), i32(p.y), u)]);
  let sp = (0.9 + 0.5 * hash(i)) * 12.0 / (1.0 + here * 0.12);
  v = mix(v, (dir + push) * sp, 0.25);
  var np = p + v * u.dt;
  if (blocked(np, u)) { np = p; v = -v * 0.3 + vec2f(hash(i + 3u) - 0.5, hash(i + 9u) - 0.5) * 6.0; }
  L += u.dt;
  if (goal(np, u) || L > 80.0) { /* arrived: respawn at an entrance, record the trip */
    atomicAdd(&dens[u.w * u.h], 1u); atomicAdd(&dens[u.w * u.h + 1u], u32(L * 10.0)); L = 0.0;
    let side = hash(i + u32(u.time * 60.0)) < 0.5; np = vec2f(select(180.0 + hash(i + 5u) * 8.0, 4.0 + hash(i + 5u) * 12.0, side), 2.0 + hash(i + 7u) * 3.0); v = vec2f(0.0); }
  pos[i] = np; vel[i] = v; life[i] = L;
  atomicAdd(&dens[idx(i32(np.x), i32(np.y), u)], 1u);
  atomicMax(&dens[u.w * u.h + 2u], u32(here));
}`;
const CC_DRAW = `
struct R { w: u32, h: u32, n: u32, pad: u32, res: vec2f, pad2: vec2f, paper: vec4f, line: vec4f, hot: vec4f, kiosk: array<vec4f, 3> };
@group(0) @binding(0) var<uniform> r: R;
@group(0) @binding(1) var<storage, read> dens: array<u32>;
struct VO { @builtin(position) p: vec4f, @location(0) uv: vec2f };
@vertex fn vs(@builtin(vertex_index) i: u32) -> VO { var o: VO; let x = f32((i << 1u) & 2u); let y = f32(i & 2u); o.uv = vec2f(x, y); o.p = vec4f(x * 2.0 - 1.0, y * 2.0 - 1.0, 0.0, 1.0); return o; }
@fragment fn fs(o: VO) -> @location(0) vec4f {
  let g = o.uv * vec2f(f32(r.w), f32(r.h)); let x = u32(g.x); let y = u32(g.y); let d = f32(dens[min(y, r.h - 1u) * r.w + min(x, r.w - 1u)]);
  var c = r.paper.rgb;
  /* the plan: hairline grid, the stair slot, the kiosks */
  let gridl = step(0.94, fract(g.x / 8.0)) + step(0.94, fract(g.y / 8.0)); c = mix(c, r.line.rgb, gridl * 0.12);
  for (var i = 0; i < 3; i++) { let k = r.kiosk[i]; if (abs(g.x - k.x) < k.z && abs(g.y - k.y) < k.w) { c = mix(c, r.line.rgb, 0.85); } }
  if (g.y > f32(r.h) - 5.0 && g.x > 70.0 && g.x < 122.0) { c = mix(c, r.line.rgb, 0.35); }
  /* the crowd as density: cool at a few, hot at many */
  let k = clamp(d / 18.0, 0.0, 1.0); let crowd = mix(vec3f(0.35, 0.45, 0.62), r.hot.rgb, smoothstep(0.35, 1.0, k));
  c = mix(c, crowd, smoothstep(0.0, 0.25, k) * 0.95);
  return vec4f(c, 1.0);
}`;
const CC_DOTS = `
struct R { w: u32, h: u32, n: u32, pad: u32, res: vec2f, pad2: vec2f, paper: vec4f, line: vec4f, hot: vec4f, kiosk: array<vec4f, 3> };
@group(0) @binding(0) var<uniform> r: R;
@group(0) @binding(1) var<storage, read> pos: array<vec2f>;
struct VO { @builtin(position) p: vec4f, @location(0) q: vec2f };
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO { let corner = vec2f(f32(vi & 1u), f32((vi >> 1u) & 1u)) * 2.0 - 1.0; let p = pos[ii] / vec2f(f32(r.w), f32(r.h)); var o: VO; o.p = vec4f((p * 2.0 - 1.0) + corner * 1.1 / r.res, 0.0, 1.0); o.q = corner; return o; }
@fragment fn fs(o: VO) -> @location(0) vec4f { if (dot(o.q, o.q) > 1.0) { discard; } return vec4f(0.10, 0.12, 0.18, 0.35); }`;
function concourseCard() {
  const el = $('cc-card'), stage = $('cc-stage'), canvas = $('cc-canvas'), status = $('cc-status'); let s = null;
  const kiosks = [[60, 40, 8, 6], [120, 62, 10, 5], [96, 24, 6, 6]]; let drag = null;
  pointer(stage, (p) => { if (drag !== null) { kiosks[drag][0] = Math.max(12, Math.min(CW - 12, p.x * CW)); kiosks[drag][1] = Math.max(10, Math.min(CH - 12, p.y * CH)); } }, () => { drag = null; }, (p) => { const gx = p.x * CW, gy = p.y * CH; drag = null; kiosks.forEach((k, i) => { if (Math.abs(gx - k[0]) < k[2] + 3 && Math.abs(gy - k[1]) < k[3] + 3) drag = i; }); }, () => { drag = null; });
  return card({ name: 'concourse', el, init() {
    const dev = this.__dev, { ctx, fit } = attach(canvas), cells = CW * CH;
    const field = [storage(cells * 4), storage(cells * 4)], dens = [storage((cells + 4) * 4), storage((cells + 4) * 4)], pos = storage(CN * 8), vel = storage(CN * 8), life = storage(CN * 4);
    const f0 = new Float32Array(cells).fill(1e5); dev.queue.writeBuffer(field[0], 0, f0); dev.queue.writeBuffer(field[1], 0, f0);
    const p0 = new Float32Array(CN * 2), l0 = new Float32Array(CN); for (let i = 0; i < CN; i++) { p0[i * 2] = 4 + hash2(i, 1) * (CW - 8); p0[i * 2 + 1] = 4 + hash2(i, 2) * (CH - 12); l0[i] = hash2(i, 3) * 20; } dev.queue.writeBuffer(pos, 0, p0); dev.queue.writeBuffer(life, 0, l0);
    const u = uniform(80), ru = uniform(128);
    const pF = compute(CC_FIELD), pC = compute(CC_CLEAR), pS = compute(CC_STEP), pD = render(CC_DRAW), pDots = render(CC_DOTS, { blend: true });
    const gF = [bind(pF, [u, field[0], field[1]]), bind(pF, [u, field[1], field[0]])], gC = [bind(pC, [u, dens[0]]), bind(pC, [u, dens[1]])], gS = [bind(pS, [u, field[0], pos, vel, dens[1], dens[0], life]), bind(pS, [u, field[0], pos, vel, dens[0], dens[1], life])];
    const gD = [bind(pD, [ru, dens[0]]), bind(pD, [ru, dens[1]])], gDots = bind(pDots, [ru, pos]);
    const tripRead = readback(16);
    s = { ctx, fit, u, ru, pF, pC, pS, pD, pDots, gF, gC, gS, gD, gDots, dens, tripRead, cur: 0, fcur: 0, frame: 0, paper: col(el, '--cc-bg'), line: col(el, '--cc-ink'), hot: col(el, '--cc-hot'), reading: false, trips: 0, tripTime: 0 };
    status.hidden = true; $('cc-n').textContent = CN.toLocaleString();
  }, frame(t, dt, now) {
    if (!s) return; s.fit(); const dev = this.__dev; s.frame++;
    const U = new ArrayBuffer(80), Ui = new Uint32Array(U), Uf = new Float32Array(U); Ui[0] = CW; Ui[1] = CH; Ui[2] = CN; Ui[3] = 0; Uf[4] = Math.min(dt, 1 / 30); Uf[5] = now / 1000; kiosks.forEach((k, i) => Uf.set(k, 8 + i * 4)); dev.queue.writeBuffer(s.u, 0, U);
    const R = new ArrayBuffer(128), Ri = new Uint32Array(R), Rf = new Float32Array(R); Ri[0] = CW; Ri[1] = CH; Ri[2] = CN; Rf[4] = canvas.width; Rf[5] = canvas.height; Rf.set(s.paper, 8); Rf.set(s.line, 12); Rf.set(s.hot, 16); kiosks.forEach((k, i) => Rf.set(k, 20 + i * 4)); dev.queue.writeBuffer(s.ru, 0, R);
    const enc = dev.createCommandEncoder(); let pass = enc.beginComputePass();
    pass.setPipeline(s.pF); for (let k = 0; k < 6; k++) { pass.setBindGroup(0, s.gF[s.fcur]); pass.dispatchWorkgroups(Math.ceil(CW / 16), Math.ceil(CH / 16)); s.fcur ^= 1; }
    /* the step reads field[0]; keep the latest relaxed field there */
    if (s.fcur === 1) { pass.setBindGroup(0, s.gF[1]); pass.dispatchWorkgroups(Math.ceil(CW / 16), Math.ceil(CH / 16)); s.fcur = 0; }
    pass.setPipeline(s.pC); pass.setBindGroup(0, s.gC[s.cur]); pass.dispatchWorkgroups(Math.ceil((CW * CH + 4) / 256));
    pass.setPipeline(s.pS); pass.setBindGroup(0, s.gS[s.cur]); pass.dispatchWorkgroups(Math.ceil(CN / 256)); pass.end();
    if (s.frame % 45 === 0 && !s.reading) { enc.copyBufferToBuffer(s.dens[s.cur], CW * CH * 4, s.tripRead, 0, 16); s.reading = true; }
    const rp = enc.beginRenderPass({ colorAttachments: [{ view: s.ctx.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store' }] });
    rp.setPipeline(s.pD); rp.setBindGroup(0, s.gD[s.cur]); rp.draw(3); rp.setPipeline(s.pDots); rp.setBindGroup(0, s.gDots); rp.draw(4, CN); rp.end();
    dev.queue.submit([enc.finish()]);
    if (s.frame % 45 === 0 && s.reading) { s.tripRead.mapAsync(GPUMapMode.READ).then(() => { const d = new Uint32Array(s.tripRead.getMappedRange().slice(0)); s.tripRead.unmap(); s.reading = false; if (d[0] > 0) { $('cc-time').textContent = (d[1] / 10 / d[0]).toFixed(1) + ' s'; } const crush = d[2]; const el2 = $('cc-crush'); el2.textContent = crush + ' / cell'; el2.classList.toggle('cc-bad', crush > 45); }).catch(() => { s.reading = false; }); }
    s.cur ^= 1;
  } });
}

export function populationCards() { return [murmurationCard(), concourseCard()]; }
