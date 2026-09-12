/* §3 · fluids — three solvers, three products.
   TINTA  a 2-D stable fluid on paper; the ink writes its own name, then the hand.
   FUME   a 3-D grid (64 × 96 × 64) advected on the GPU and ray-marched with
          single scattering: a perfume that exhales its notes.
   POUR   smoothed-particle hydrodynamics in a glass, splatted to a density
          grid and shaded as a liquid surface with refraction. */
import { $, DPR, col, storage, uniform, compute, render, bind, attach, timer, card, pointer, hash2, FSQ_VS } from './common.js';

/* ─────────────────────────────────────────────────────────────────────────
   TINTA
   ───────────────────────────────────────────────────────────────────────── */
const FW = 384, FH = 240, PRESS_ITERS = 24, STAMPS = 24;
const F_COMMON = `
struct U { w: u32, h: u32, nStamp: u32, pad0: u32, dt: f32, ptrOn: f32, ptr: vec2f, force: vec2f, dissipation: f32, pad1: f32, dye: vec4f };
@group(0) @binding(0) var<uniform> u: U;
fn idx(x: i32, y: i32) -> u32 { return u32(clamp(y, 0, i32(u.h) - 1)) * u.w + u32(clamp(x, 0, i32(u.w) - 1)); }`;
const F_ADVECT = F_COMMON + `
@group(0) @binding(1) var<storage, read> vel: array<vec2f>;
@group(0) @binding(2) var<storage, read_write> velOut: array<vec2f>;
@group(0) @binding(3) var<storage, read> dye: array<vec4f>;
@group(0) @binding(4) var<storage, read_write> dyeOut: array<vec4f>;
@group(0) @binding(5) var<storage, read> stamps: array<vec4f>;
fn sampleV(p: vec2f) -> vec2f { let x = i32(floor(p.x)); let y = i32(floor(p.y)); let f = fract(p); return mix(mix(vel[idx(x, y)], vel[idx(x + 1, y)], f.x), mix(vel[idx(x, y + 1)], vel[idx(x + 1, y + 1)], f.x), f.y); }
fn sampleD(p: vec2f) -> vec4f { let x = i32(floor(p.x)); let y = i32(floor(p.y)); let f = fract(p); return mix(mix(dye[idx(x, y)], dye[idx(x + 1, y)], f.x), mix(dye[idx(x, y + 1)], dye[idx(x + 1, y + 1)], f.x), f.y); }
@compute @workgroup_size(16, 16) fn main(@builtin(global_invocation_id) id: vec3u) {
  let x = i32(id.x); let y = i32(id.y); if (x >= i32(u.w) || y >= i32(u.h)) { return; }
  let p = vec2f(f32(x), f32(y)); let v = vel[idx(x, y)]; let back = p - v * u.dt;
  var nv = sampleV(back) * 0.995; var nd = sampleD(back) * u.dissipation;
  if (u.ptrOn > 0.5) { let d = p - u.ptr; let g = exp(-dot(d, d) / 90.0); nv += u.force * g; nd += u.dye * g * 0.6; }
  /* the pen: each stamp is a point of the letterform being written this frame */
  for (var i = 0u; i < u.nStamp; i++) { let st = stamps[i]; let d = p - st.xy; let dd = dot(d, d); if (dd < 20.0) { let g = exp(-dd / 5.0); nd += u.dye * g * st.z; nv += vec2f(st.w, 0.15) * g * 0.05; } }
  if (x == 0 || y == 0 || x == i32(u.w) - 1 || y == i32(u.h) - 1) { nv = vec2f(0.0); }
  velOut[idx(x, y)] = nv; dyeOut[idx(x, y)] = min(nd, vec4f(1.0));
}`;
const F_DIV = F_COMMON + `
@group(0) @binding(1) var<storage, read> vel: array<vec2f>;
@group(0) @binding(2) var<storage, read_write> div: array<f32>;
@group(0) @binding(3) var<storage, read_write> pres: array<f32>;
@compute @workgroup_size(16, 16) fn main(@builtin(global_invocation_id) id: vec3u) {
  let x = i32(id.x); let y = i32(id.y); if (x >= i32(u.w) || y >= i32(u.h)) { return; }
  div[idx(x, y)] = 0.5 * (vel[idx(x + 1, y)].x - vel[idx(x - 1, y)].x + vel[idx(x, y + 1)].y - vel[idx(x, y - 1)].y); pres[idx(x, y)] = 0.0;
}`;
const F_JACOBI = F_COMMON + `
@group(0) @binding(1) var<storage, read> div: array<f32>;
@group(0) @binding(2) var<storage, read> p0: array<f32>;
@group(0) @binding(3) var<storage, read_write> p1: array<f32>;
@compute @workgroup_size(16, 16) fn main(@builtin(global_invocation_id) id: vec3u) {
  let x = i32(id.x); let y = i32(id.y); if (x >= i32(u.w) || y >= i32(u.h)) { return; }
  p1[idx(x, y)] = (p0[idx(x - 1, y)] + p0[idx(x + 1, y)] + p0[idx(x, y - 1)] + p0[idx(x, y + 1)] - div[idx(x, y)]) * 0.25;
}`;
const F_PROJECT = F_COMMON + `
@group(0) @binding(1) var<storage, read> pres: array<f32>;
@group(0) @binding(2) var<storage, read_write> vel: array<vec2f>;
@compute @workgroup_size(16, 16) fn main(@builtin(global_invocation_id) id: vec3u) {
  let x = i32(id.x); let y = i32(id.y); if (x >= i32(u.w) || y >= i32(u.h)) { return; }
  vel[idx(x, y)] -= 0.5 * vec2f(pres[idx(x + 1, y)] - pres[idx(x - 1, y)], pres[idx(x, y + 1)] - pres[idx(x, y - 1)]);
}`;
const F_DRAW = FSQ_VS + `
struct R { w: u32, h: u32, pad0: u32, pad1: u32, paper: vec4f };
@group(0) @binding(0) var<uniform> r: R;
@group(0) @binding(1) var<storage, read> dye: array<vec4f>;
fn hash(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }
@fragment fn fs(o: VO) -> @location(0) vec4f {
  let fx = o.uv.x * f32(r.w) - 0.5; let fy = o.uv.y * f32(r.h) - 0.5; let x = i32(floor(fx)); let y = i32(floor(fy)); let f = vec2f(fract(fx), fract(fy));
  let i = u32(clamp(y, 0, i32(r.h) - 1)) * r.w; let i2 = u32(clamp(y + 1, 0, i32(r.h) - 1)) * r.w;
  let x0 = u32(clamp(x, 0, i32(r.w) - 1)); let x1 = u32(clamp(x + 1, 0, i32(r.w) - 1));
  let d = mix(mix(dye[i + x0], dye[i + x1], f.x), mix(dye[i2 + x0], dye[i2 + x1], f.x), f.y);
  /* paper grain, then ink as a subtractive layer with a sheen where it pools */
  let grain = 0.97 + 0.03 * hash(floor(vec2f(fx, fy) * 2.0));
  let amount = smoothstep(0.0, 1.0, d.a * 1.6); let ink = d.rgb / max(d.a, 1e-3);
  /* ink is subtractive: the paper shows through thin ink, thick ink goes to the ink's own colour and a little darker */
  var c = r.paper.rgb * grain * mix(vec3f(1.0), ink * 0.85, amount);
  c += vec3f(0.10, 0.04, 0.02) * smoothstep(0.85, 1.0, d.a);
  return vec4f(c, 1.0);
}`;
const INKS = [
  { rgb: [0.42, 0.05, 0.10], name: 'Nº 07 — Oxblood', note: '30 ml · iron-gall · shading, sheen', word: 'Oxblood' },
  { rgb: [0.10, 0.12, 0.42], name: 'Nº 12 — Ultramarine', note: '30 ml · pigment · lightfast, wet', word: 'Ultramarine' },
  { rgb: [0.07, 0.32, 0.22], name: 'Nº 03 — Verdigris', note: '30 ml · dye · shading, quick-dry', word: 'Verdigris' },
  { rgb: [0.12, 0.10, 0.08], name: 'Nº 01 — Sepia', note: '30 ml · iron-gall · archival', word: 'Sepia' },
];
/* the letterforms as a pen path: pixels of the word, ordered left to right so
   injecting them in sequence writes */
function penPath(word) {
  const W = 512, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d', { willReadFrequently: true });
  x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `italic 500 ${word.length > 8 ? 118 : 150}px "Snell Roundhand", "Apple Chancery", "Brush Script MT", "Segoe Script", cursive`;
  const tw = x.measureText(word).width; if (tw > W * 0.9) x.font = x.font.replace(/\d+px/, Math.floor((word.length > 8 ? 118 : 150) * W * 0.9 / tw) + 'px');
  x.fillText(word, W / 2, H / 2);
  const d = x.getImageData(0, 0, W, H).data, pts = [];
  for (let j = 0; j < H; j += 3) for (let i = 0; i < W; i += 3) if (d[(j * W + i) * 4 + 3] > 128) pts.push([i / W, j / H]);
  pts.sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
  return pts;
}
function tintaCard() {
  const el = $('tn-card'), stage = $('tn-stage'), canvas = $('tn-canvas'); let s = null, ptr = [-9, -9], last = null, force = [0, 0], on = false;
  let inkIx = 0, path = [], cursor = 0, writeStart = 0, rewriteAt = 0, started = false;
  const begin = (ix) => { inkIx = ix; path = penPath(INKS[ix].word); cursor = 0; writeStart = performance.now(); $('tn-name').textContent = INKS[ix].name; $('tn-note').textContent = INKS[ix].note; };
  document.querySelectorAll('.tn-sw').forEach((b) => b.addEventListener('click', () => { document.querySelectorAll('.tn-sw').forEach((o) => o.classList.toggle('tn-on', o === b)); begin(+b.dataset.c); }));
  pointer(stage, (p) => { const np = [p.x * FW, p.y * FH]; if (last) force = [(np[0] - last[0]) * 3.0, (np[1] - last[1]) * 3.0]; last = np; ptr = np; on = true; }, () => { on = false; last = null; });
  return card({ name: 'tinta', el, init() {
    const dev = this.__dev, { ctx, fit } = attach(canvas), N = FW * FH;
    const vel = [storage(N * 8), storage(N * 8)], dye = [storage(N * 16), storage(N * 16)], div = storage(N * 4), pres = [storage(N * 4), storage(N * 4)], stamps = storage(STAMPS * 16);
    const u = uniform(64), ru = uniform(32);
    const pA = compute(F_ADVECT), pD = compute(F_DIV), pJ = compute(F_JACOBI), pP = compute(F_PROJECT), pDraw = render(F_DRAW);
    const gA = [bind(pA, [u, vel[0], vel[1], dye[0], dye[1], stamps]), bind(pA, [u, vel[1], vel[0], dye[1], dye[0], stamps])];
    const gD = [bind(pD, [u, vel[1], div, pres[0]]), bind(pD, [u, vel[0], div, pres[0]])];
    const gJ = [bind(pJ, [u, div, pres[0], pres[1]]), bind(pJ, [u, div, pres[1], pres[0]])];
    const gP = [bind(pP, [u, pres[0], vel[1]]), bind(pP, [u, pres[0], vel[0]])];
    const draws = [bind(pDraw, [ru, dye[1]]), bind(pDraw, [ru, dye[0]])];
    dev.queue.writeBuffer(ru, 0, new Uint32Array([FW, FH, 0, 0])); dev.queue.writeBuffer(ru, 16, new Float32Array(col(el, '--tn-bg')));
    const tm = timer(['solve'], 4);
    s = { ctx, fit, u, stamps, pA, pD, pJ, pP, pDraw, gA, gD, gJ, gP, draws, tm, cur: 0 }; begin(0);
  }, frame(t, dt, now) {
    if (!s) return; s.fit(); const dev = this.__dev;
    if (!started) { const rc = stage.getBoundingClientRect(); if (rc.bottom < 0 || rc.top > innerHeight) return; started = true; begin(inkIx); }
    /* the pen: how far along the word we are, at four seconds a word; a
       finished word rests, then is written again */
    const WRITE = 4200, k = Math.min(1, (now - writeStart) / WRITE), target = Math.floor(k * path.length);
    const stampData = new Float32Array(STAMPS * 4); let n = 0;
    for (; cursor < target && n < STAMPS; cursor++, n++) { const p = path[cursor]; stampData[n * 4] = 0.08 * FW + p[0] * FW * 0.84; stampData[n * 4 + 1] = 0.12 * FH + p[1] * FH * 0.62; stampData[n * 4 + 2] = 0.9; stampData[n * 4 + 3] = 0.8; }
    if (cursor < target) cursor = target;
    if (k >= 1 && !rewriteAt) rewriteAt = now + 9000; if (rewriteAt && now > rewriteAt) { rewriteAt = 0; begin(inkIx); }
    if (n) dev.queue.writeBuffer(s.stamps, 0, stampData, 0, n * 4);
    const U = new ArrayBuffer(64), Ui = new Uint32Array(U), Uf = new Float32Array(U); const ink = INKS[inkIx].rgb;
    Ui[0] = FW; Ui[1] = FH; Ui[2] = n; Uf[4] = 1.0; Uf[5] = on ? 1 : 0; Uf[6] = ptr[0]; Uf[7] = ptr[1]; Uf[8] = force[0]; Uf[9] = force[1]; Uf[10] = 0.9985; Uf[12] = ink[0]; Uf[13] = ink[1]; Uf[14] = ink[2]; Uf[15] = 1.0;
    dev.queue.writeBuffer(s.u, 0, U); force = [force[0] * 0.5, force[1] * 0.5];
    const enc = dev.createCommandEncoder(); const gx = Math.ceil(FW / 16), gy = Math.ceil(FH / 16);
    let pass = enc.beginComputePass(s.tm.begin(0)); pass.setPipeline(s.pA); pass.setBindGroup(0, s.gA[s.cur]); pass.dispatchWorkgroups(gx, gy);
    pass.setPipeline(s.pD); pass.setBindGroup(0, s.gD[s.cur]); pass.dispatchWorkgroups(gx, gy);
    pass.setPipeline(s.pJ); for (let i = 0; i < PRESS_ITERS; i++) { pass.setBindGroup(0, s.gJ[i & 1]); pass.dispatchWorkgroups(gx, gy); }
    pass.setPipeline(s.pP); pass.setBindGroup(0, s.gP[s.cur]); pass.dispatchWorkgroups(gx, gy); pass.end();
    const rp = enc.beginRenderPass({ colorAttachments: [{ view: s.ctx.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store' }] });
    rp.setPipeline(s.pDraw); rp.setBindGroup(0, s.draws[s.cur]); rp.draw(3); rp.end(); s.tm.resolve(enc); dev.queue.submit([enc.finish()]);
    s.cur ^= 1; const rd = s.tm.read(); if (rd.solve !== undefined) $('tn-t-solve').textContent = rd.solve.toFixed(2) + ' ms';
  } });
}

/* ─────────────────────────────────────────────────────────────────────────
   FUME · a 3-D volume
   ───────────────────────────────────────────────────────────────────────── */
const VX = 64, VY = 96, VZ = 64, VN = VX * VY * VZ, V_ITERS = 14;
const V_COMMON = `
struct U { dt: f32, time: f32, pulse: f32, pad0: f32, emit: vec4f, ptr: vec4f, swirl: f32, buoy: f32, pad1: f32, pad2: f32 };
@group(0) @binding(0) var<uniform> u: U;
const X = ${VX}; const Y = ${VY}; const Z = ${VZ};
fn idx(x: i32, y: i32, z: i32) -> u32 { return u32(clamp(z, 0, Z - 1)) * u32(X * Y) + u32(clamp(y, 0, Y - 1)) * u32(X) + u32(clamp(x, 0, X - 1)); }`;
const V_ADVECT = V_COMMON + `
@group(0) @binding(1) var<storage, read> vel: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> velOut: array<vec4f>;
@group(0) @binding(3) var<storage, read> dye: array<vec4f>;
@group(0) @binding(4) var<storage, read_write> dyeOut: array<vec4f>;
fn hash3(p: vec3f) -> f32 { return fract(sin(dot(p, vec3f(127.1, 311.7, 74.7))) * 43758.5453); }
fn sV(p: vec3f) -> vec3f { let f = floor(p); let t = p - f; let x = i32(f.x); let y = i32(f.y); let z = i32(f.z);
  let a = mix(mix(vel[idx(x, y, z)], vel[idx(x + 1, y, z)], t.x), mix(vel[idx(x, y + 1, z)], vel[idx(x + 1, y + 1, z)], t.x), t.y);
  let b = mix(mix(vel[idx(x, y, z + 1)], vel[idx(x + 1, y, z + 1)], t.x), mix(vel[idx(x, y + 1, z + 1)], vel[idx(x + 1, y + 1, z + 1)], t.x), t.y); return mix(a, b, t.z).xyz; }
fn sD(p: vec3f) -> vec4f { let f = floor(p); let t = p - f; let x = i32(f.x); let y = i32(f.y); let z = i32(f.z);
  let a = mix(mix(dye[idx(x, y, z)], dye[idx(x + 1, y, z)], t.x), mix(dye[idx(x, y + 1, z)], dye[idx(x + 1, y + 1, z)], t.x), t.y);
  let b = mix(mix(dye[idx(x, y, z + 1)], dye[idx(x + 1, y, z + 1)], t.x), mix(dye[idx(x, y + 1, z + 1)], dye[idx(x + 1, y + 1, z + 1)], t.x), t.y); return mix(a, b, t.z); }
@compute @workgroup_size(4, 4, 4) fn main(@builtin(global_invocation_id) id: vec3u) {
  let x = i32(id.x); let y = i32(id.y); let z = i32(id.z); if (x >= X || y >= Y || z >= Z) { return; }
  let p = vec3f(f32(x), f32(y), f32(z)); let v = vel[idx(x, y, z)].xyz; let back = p - v * u.dt;
  var nv = sV(back) * 0.992; var nd = sD(back) * 0.9965;
  /* a little turbulence so the plume curls rather than jets */
  let tb = vec3f(sin(p.y * 0.21 + u.time * 1.3 + p.z * 0.1), 0.0, cos(p.y * 0.17 - u.time * 1.1 + p.x * 0.13)) * nd.a * 1.1;
  nv += tb * u.dt;
  /* buoyancy from what is in the cell, a slow swirl about the axis, the vent at the bottle's mouth */
  nv.y += nd.a * u.buoy * u.dt; let c = p.xz - vec2f(f32(X) * 0.5, f32(Z) * 0.5); nv += vec3f(-c.y, 0.0, c.x) * u.swirl * nd.a * u.dt;
  let m = p - vec3f(f32(X) * 0.5, 4.0, f32(Z) * 0.5); let dm = dot(m, m);
  if (dm < 60.0) { let g = exp(-dm / 22.0) * u.pulse; nd += u.emit * g * u.dt * 3.5; nv += vec3f(sin(u.time * 3.1) * 0.6, 3.5 + 1.5 * sin(u.time * 2.3), cos(u.time * 2.7) * 0.6) * g * u.dt * 8.0; }
  /* the hand pushes the smoke: a force at the pointer's column */
  if (u.ptr.w > 0.5) { let d = vec3f(p.x - u.ptr.x, p.y - u.ptr.y, p.z - f32(Z) * 0.5); let dd = dot(d, d); nv += vec3f(u.ptr.z, 0.0, 0.0) * exp(-dd / 60.0) * u.dt * 10.0; }
  if (x == 0 || y == 0 || z == 0 || x == X - 1 || y == Y - 1 || z == Z - 1) { nv = vec3f(0.0); }
  velOut[idx(x, y, z)] = vec4f(nv, 0.0); dyeOut[idx(x, y, z)] = min(nd, vec4f(2.0));
}`;
const V_DIV = V_COMMON + `
@group(0) @binding(1) var<storage, read> vel: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> div: array<f32>;
@group(0) @binding(3) var<storage, read_write> pres: array<f32>;
@compute @workgroup_size(4, 4, 4) fn main(@builtin(global_invocation_id) id: vec3u) {
  let _u = u.dt; let x = i32(id.x); let y = i32(id.y); let z = i32(id.z); if (x >= X || y >= Y || z >= Z) { return; }
  div[idx(x, y, z)] = 0.5 * (vel[idx(x + 1, y, z)].x - vel[idx(x - 1, y, z)].x + vel[idx(x, y + 1, z)].y - vel[idx(x, y - 1, z)].y + vel[idx(x, y, z + 1)].z - vel[idx(x, y, z - 1)].z); pres[idx(x, y, z)] = 0.0;
}`;
const V_JACOBI = V_COMMON + `
@group(0) @binding(1) var<storage, read> div: array<f32>;
@group(0) @binding(2) var<storage, read> p0: array<f32>;
@group(0) @binding(3) var<storage, read_write> p1: array<f32>;
@compute @workgroup_size(4, 4, 4) fn main(@builtin(global_invocation_id) id: vec3u) {
  let _u = u.dt; let x = i32(id.x); let y = i32(id.y); let z = i32(id.z); if (x >= X || y >= Y || z >= Z) { return; }
  p1[idx(x, y, z)] = (p0[idx(x - 1, y, z)] + p0[idx(x + 1, y, z)] + p0[idx(x, y - 1, z)] + p0[idx(x, y + 1, z)] + p0[idx(x, y, z - 1)] + p0[idx(x, y, z + 1)] - div[idx(x, y, z)]) / 6.0;
}`;
const V_PROJECT = V_COMMON + `
@group(0) @binding(1) var<storage, read> pres: array<f32>;
@group(0) @binding(2) var<storage, read_write> vel: array<vec4f>;
@compute @workgroup_size(4, 4, 4) fn main(@builtin(global_invocation_id) id: vec3u) {
  let _u = u.dt; let x = i32(id.x); let y = i32(id.y); let z = i32(id.z); if (x >= X || y >= Y || z >= Z) { return; }
  let g = 0.5 * vec3f(pres[idx(x + 1, y, z)] - pres[idx(x - 1, y, z)], pres[idx(x, y + 1, z)] - pres[idx(x, y - 1, z)], pres[idx(x, y, z + 1)] - pres[idx(x, y, z - 1)]);
  vel[idx(x, y, z)] = vec4f(vel[idx(x, y, z)].xyz - g, 0.0);
}`;
const V_DRAW = FSQ_VS + `
struct R { camPos: vec3f, aspect: f32, camF: vec3f, time: f32, camR: vec3f, pad0: f32, camU: vec3f, pad1: f32, bg: vec4f, light: vec4f, mouth: vec4f };
const LIGHTC = vec3f(1.0, 0.92, 0.80);
@group(0) @binding(0) var<uniform> r: R;
@group(0) @binding(1) var<storage, read> dye: array<vec4f>;
const X = ${VX}; const Y = ${VY}; const Z = ${VZ};
fn idx(x: i32, y: i32, z: i32) -> u32 { return u32(clamp(z, 0, Z - 1)) * u32(X * Y) + u32(clamp(y, 0, Y - 1)) * u32(X) + u32(clamp(x, 0, X - 1)); }
fn sD(p: vec3f) -> vec4f { let f = floor(p); let t = p - f; let x = i32(f.x); let y = i32(f.y); let z = i32(f.z);
  let a = mix(mix(dye[idx(x, y, z)], dye[idx(x + 1, y, z)], t.x), mix(dye[idx(x, y + 1, z)], dye[idx(x + 1, y + 1, z)], t.x), t.y);
  let b = mix(mix(dye[idx(x, y, z + 1)], dye[idx(x + 1, y, z + 1)], t.x), mix(dye[idx(x, y + 1, z + 1)], dye[idx(x + 1, y + 1, z + 1)], t.x), t.y); return mix(a, b, t.z); }
fn dens(p: vec3f) -> f32 { return dye[idx(i32(p.x), i32(p.y), i32(p.z))].a; }
/* the box the volume lives in: world units where the grid is 1 unit per cell */
fn boxHit(ro: vec3f, rd: vec3f) -> vec2f { let b0 = vec3f(0.0); let b1 = vec3f(f32(X), f32(Y), f32(Z)); let inv = 1.0 / rd; let t0 = (b0 - ro) * inv; let t1 = (b1 - ro) * inv; let tmin = min(t0, t1); let tmax = max(t0, t1); return vec2f(max(max(tmin.x, tmin.y), tmin.z), min(min(tmax.x, tmax.y), tmax.z)); }
@fragment fn fs(o: VO) -> @location(0) vec4f {
  let ndc = vec2f(o.uv.x * 2.0 - 1.0, 1.0 - o.uv.y * 2.0); let tf = tan(0.5 * 0.55);
  let rd = normalize(r.camF + r.camR * ndc.x * tf * r.aspect + r.camU * ndc.y * tf); let ro = r.camPos;
  /* the backdrop: a dark studio sweep with the light's warmth on it */
  var bg = r.bg.rgb * (0.7 + 0.5 * smoothstep(-1.0, 1.0, ndc.y)) + LIGHTC * 0.03 * pow(max(1.0 - length(ndc - vec2f(0.3, 0.4)), 0.0), 2.0);
  let h = boxHit(ro, rd); var col = vec3f(0.0); var T = 1.0;
  if (h.y > max(h.x, 0.0)) { let t0 = max(h.x, 0.0); let n = 88; let dt = (h.y - t0) / f32(n); var t = t0 + dt * fract(sin(dot(o.uv, vec2f(12.9898, 78.233))) * 43758.5453);
    let L = normalize(r.light.xyz);
    for (var i = 0; i < n; i++) { let p = ro + rd * t; let d = sD(p); let a = d.a;
      if (a > 0.004) { /* single scatter: a short walk toward the light for shadowing inside the plume */
        var sh = 0.0; for (var j = 1; j <= 4; j++) { sh += dens(p + L * f32(j) * 3.0); } let lt = exp(-sh * 0.55);
        let c = d.rgb / max(a, 1e-3); let alpha = 1.0 - exp(-a * dt * 0.55);
        let lit = c * (LIGHTC * lt * 1.5 + r.bg.rgb * 1.0 + vec3f(0.05)); col += T * alpha * lit; T *= 1.0 - alpha; if (T < 0.01) { break; } }
      t += dt; }
  }
  col += T * bg;
  /* the bottle, drawn in the backdrop under the mouth of the plume: glass with a rim light and a label */
  let mp = vec2f((o.uv.x - r.mouth.x) * r.aspect, o.uv.y - r.mouth.y); let neck = length(max(abs(mp - vec2f(0.0, 0.035)) - vec2f(0.022, 0.035), vec2f(0.0))) - 0.006; let body = length(max(abs(mp - vec2f(0.0, 0.26)) - vec2f(0.11, 0.19), vec2f(0.0))) - 0.03; let bottle = min(neck, body);
  let glassA = 1.0 - smoothstep(0.0, 0.004, bottle); let rim = smoothstep(0.03, 0.0, abs(bottle + 0.012)) * 0.35 + smoothstep(0.012, 0.0, abs(mp.x + 0.085)) * step(0.09, mp.y) * step(mp.y, 0.43) * 0.5;
  let label = step(abs(mp.x), 0.075) * step(0.17, mp.y) * step(mp.y, 0.30); let glass = mix(r.bg.rgb * 0.5 + LIGHTC * 0.04, vec3f(0.92, 0.90, 0.86), label * 0.85) + vec3f(rim);
  col = mix(col, glass * (1.0 - 0.5 * (1.0 - T)), glassA * 0.92);
  col = pow(max(col, vec3f(0.0)), vec3f(1.0 / 2.2));
  return vec4f(col, 1.0);
}`;
const NOTES = [
  { id: 'top', name: 'Top · bergamot, pink pepper', emit: [1.0, 0.86, 0.55], swirl: 0.02, buoy: 3.0, bg: [0.06, 0.05, 0.05] },
  { id: 'heart', name: 'Heart · iris, vetiver', emit: [0.62, 0.55, 0.95], swirl: 0.045, buoy: 2.2, bg: [0.05, 0.045, 0.07] },
  { id: 'base', name: 'Base · cedar, smoke', emit: [0.85, 0.80, 0.78], swirl: 0.012, buoy: 1.4, bg: [0.05, 0.04, 0.035] },
];
const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function fumeCard() {
  const el = $('fm-card'), stage = $('fm-stage'), canvas = $('fm-canvas'), status = $('fm-status'); let s = null, note = 0, ptr = [-9, -9, 0], on = false, lastX = null, lastPulse = -9;
  document.querySelectorAll('.fm-note').forEach((b, i) => b.addEventListener('click', () => { note = i; lastPulse = -9; document.querySelectorAll('.fm-note').forEach((o) => o.classList.toggle('fm-on', o === b)); $('fm-note-name').textContent = NOTES[i].name; }));
  pointer(stage, (p) => { const x = p.x * VX, y = (1 - p.y) * VY; ptr = [x, y, lastX === null ? 0 : (x - lastX) * 2.0]; lastX = x; on = true; }, () => { on = false; lastX = null; });
  return card({ name: 'fume', el, init() {
    const dev = this.__dev, { ctx } = attach(canvas);
    const vel = [storage(VN * 16), storage(VN * 16)], dye = [storage(VN * 16), storage(VN * 16)], div = storage(VN * 4), pres = [storage(VN * 4), storage(VN * 4)];
    const u = uniform(64), ru = uniform(112);
    const pA = compute(V_ADVECT), pD = compute(V_DIV), pJ = compute(V_JACOBI), pP = compute(V_PROJECT), pDraw = render(V_DRAW);
    const gA = [bind(pA, [u, vel[0], vel[1], dye[0], dye[1]]), bind(pA, [u, vel[1], vel[0], dye[1], dye[0]])];
    const gD = [bind(pD, [u, vel[1], div, pres[0]]), bind(pD, [u, vel[0], div, pres[0]])];
    const gJ = [bind(pJ, [u, div, pres[0], pres[1]]), bind(pJ, [u, div, pres[1], pres[0]])];
    const gP = [bind(pP, [u, pres[0], vel[1]]), bind(pP, [u, pres[0], vel[0]])];
    const draws = [bind(pDraw, [ru, dye[1]]), bind(pDraw, [ru, dye[0]])];
    const tm = timer(['solve', 'march'], 4);
    s = { ctx, u, ru, pA, pD, pJ, pP, pDraw, gA, gD, gJ, gP, draws, tm, cur: 0 }; status.hidden = true;
  }, frame(t, dt, now) {
    if (!s) return; const dev = this.__dev, T = now / 1000;
    const rc = stage.getBoundingClientRect(), bw = Math.round(rc.width * Math.min(DPR, 1.5) * 0.6), bh = Math.round(rc.height * Math.min(DPR, 1.5) * 0.6);
    if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
    /* the bottle exhales every six seconds, harder when a note was just chosen */
    if (T - lastPulse > 7) lastPulse = T; const since = T - lastPulse, pulse = Math.exp(-since * 0.9) * (since < 2.6 ? 1 : 0);
    const N = NOTES[note], U = new ArrayBuffer(64), Uf = new Float32Array(U);
    Uf[0] = Math.min(dt, 1 / 30) * 30; Uf[1] = T; Uf[2] = pulse; Uf.set([...N.emit, 1.0], 4); Uf.set([ptr[0], ptr[1], ptr[2], on ? 1 : 0], 8); Uf[12] = N.swirl; Uf[13] = N.buoy;
    dev.queue.writeBuffer(s.u, 0, U); ptr[2] *= 0.6;
    const yaw = T * 0.12, pos = [VX / 2 + Math.cos(yaw) * 175, VY * 0.62, VZ / 2 + Math.sin(yaw) * 175], tgt = [VX / 2, VY * 0.42, VZ / 2];
    const F = norm([tgt[0] - pos[0], tgt[1] - pos[1], tgt[2] - pos[2]]), Rt = norm(cross(F, [0, 1, 0])), Up = cross(Rt, F);
    const R = new ArrayBuffer(112), Rf = new Float32Array(R); Rf.set(pos, 0); Rf[3] = canvas.width / canvas.height; Rf.set(F, 4); Rf[7] = T; Rf.set(Rt, 8); Rf.set(Up, 12); Rf.set([...N.bg, 1], 16); Rf.set([0.5, 0.8, -0.3, 1.0], 20);
    /* where the mouth of the bottle lands on screen, so the backdrop can draw the bottle under it */
    { const wp = [VX / 2, 3, VZ / 2], v = [wp[0] - pos[0], wp[1] - pos[1], wp[2] - pos[2]], z = v[0] * F[0] + v[1] * F[1] + v[2] * F[2], tf = Math.tan(0.275), asp = canvas.width / canvas.height; const x = (v[0] * Rt[0] + v[1] * Rt[1] + v[2] * Rt[2]) / (z * tf * asp), y = (v[0] * Up[0] + v[1] * Up[1] + v[2] * Up[2]) / (z * tf); Rf.set([(x + 1) / 2, (1 - y) / 2, 0, 0], 24); }
    dev.queue.writeBuffer(s.ru, 0, R);
    const enc = dev.createCommandEncoder(); const g = [VX / 4, VY / 4, VZ / 4];
    let pass = enc.beginComputePass(s.tm.begin(0)); pass.setPipeline(s.pA); pass.setBindGroup(0, s.gA[s.cur]); pass.dispatchWorkgroups(...g);
    pass.setPipeline(s.pD); pass.setBindGroup(0, s.gD[s.cur]); pass.dispatchWorkgroups(...g);
    pass.setPipeline(s.pJ); for (let i = 0; i < V_ITERS; i++) { pass.setBindGroup(0, s.gJ[i & 1]); pass.dispatchWorkgroups(...g); }
    pass.setPipeline(s.pP); pass.setBindGroup(0, s.gP[s.cur]); pass.dispatchWorkgroups(...g); pass.end();
    const rp = enc.beginRenderPass({ colorAttachments: [{ view: s.ctx.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store' }], ...s.tm.begin(1) });
    rp.setPipeline(s.pDraw); rp.setBindGroup(0, s.draws[s.cur]); rp.draw(3); rp.end(); s.tm.resolve(enc); dev.queue.submit([enc.finish()]); s.cur ^= 1;
    const rd = s.tm.read(); if (rd.solve !== undefined) $('fm-t').textContent = `solve ${rd.solve.toFixed(2)} ms · march ${(rd.march || 0).toFixed(2)} ms`;
  } });
}

/* ─────────────────────────────────────────────────────────────────────────
   POUR · SPH in a glass
   ───────────────────────────────────────────────────────────────────────── */
const PN = 5000, GW = 192, GH = 240;
const P_COMMON = `
struct U { n: u32, pad0: u32, pad1: u32, pad2: u32, dt: f32, gravX: f32, gravY: f32, visc: f32, h: f32, rest: f32, stiff: f32, time: f32, tint: vec4f };
@group(0) @binding(0) var<uniform> u: U;
/* the glass: a tumbler, in grid units; negative inside */
fn glass(p: vec2f) -> f32 { let c = vec2f(96.0, 118.0); let q = p - c; let w = 44.0 + 22.0 * smoothstep(-90.0, 90.0, q.y); let d = abs(vec2f(q.x, q.y)) - vec2f(w, 92.0); return min(max(d.x, d.y), 0.0) + length(max(d, vec2f(0.0))) - 6.0; }`;
/* double-density relaxation (Clavet et al.): predict, measure density and
   near-density, push pairs apart in position space, derive velocity */
const P_PREDICT = P_COMMON + `
@group(0) @binding(1) var<storage, read_write> pos: array<vec2f>;
@group(0) @binding(2) var<storage, read_write> vel: array<vec2f>;
@group(0) @binding(3) var<storage, read_write> prev: array<vec2f>;
@compute @workgroup_size(128) fn main(@builtin(global_invocation_id) id: vec3u) { let i = id.x; if (i >= u.n) { return; } var v = vel[i] + vec2f(u.gravX, u.gravY) * u.dt; let sp = length(v); if (sp > 140.0) { v = v / sp * 140.0; } prev[i] = pos[i]; pos[i] = pos[i] + v * u.dt; vel[i] = v; }`;
const P_DENSITY = P_COMMON + `
@group(0) @binding(1) var<storage, read> pos: array<vec2f>;
@group(0) @binding(2) var<storage, read_write> rho: array<vec2f>;
@compute @workgroup_size(128) fn main(@builtin(global_invocation_id) id: vec3u) { let i = id.x; if (i >= u.n) { return; } let p = pos[i]; var d = 0.0; var dn = 0.0; let h = u.h;
  for (var j = 0u; j < u.n; j++) { if (j == i) { continue; } let q = pos[j] - p; if (abs(q.x) < h && abs(q.y) < h) { let r = length(q); if (r < h) { let k = 1.0 - r / h; d += k * k; dn += k * k * k; } } } rho[i] = vec2f(d, dn); }`;
const P_RELAX = P_COMMON + `
@group(0) @binding(1) var<storage, read> pos: array<vec2f>;
@group(0) @binding(2) var<storage, read> rho: array<vec2f>;
@group(0) @binding(3) var<storage, read_write> posOut: array<vec2f>;
@compute @workgroup_size(128) fn main(@builtin(global_invocation_id) id: vec3u) { let i = id.x; if (i >= u.n) { return; } let p = pos[i]; let ri = rho[i]; let pi = u.stiff * (ri.x - u.rest); let pni = u.stiff * 4.0 * ri.y; var D = vec2f(0.0); let h = u.h;
  for (var j = 0u; j < u.n; j++) { if (j == i) { continue; } let q = pos[j] - p; if (abs(q.x) < h && abs(q.y) < h) { let r = length(q); if (r < h && r > 1e-4) { let rj = rho[j]; let pj = u.stiff * (rj.x - u.rest); let pnj = u.stiff * 4.0 * rj.y; let k = 1.0 - r / h; D -= q / r * (0.5 * (pi + pj) * k + 0.5 * (pni + pnj) * k * k) * 0.5; } } }
  let dl = length(D); if (dl > 2.0) { D = D / dl * 2.0; }
  var np = p + D;
  /* the glass wall */
  let d = glass(np); if (d > -1.5) { let e = 0.5; let n = normalize(vec2f(glass(np + vec2f(e, 0.0)) - glass(np - vec2f(e, 0.0)), glass(np + vec2f(0.0, e)) - glass(np - vec2f(0.0, e)))); np -= n * (d + 1.5); }
  posOut[i] = np; }`;
const P_FINISH = P_COMMON + `
@group(0) @binding(1) var<storage, read> pos: array<vec2f>;
@group(0) @binding(2) var<storage, read> prev: array<vec2f>;
@group(0) @binding(3) var<storage, read_write> vel: array<vec2f>;
@group(0) @binding(4) var<storage, read_write> posOut: array<vec2f>;
@compute @workgroup_size(128) fn main(@builtin(global_invocation_id) id: vec3u) { let i = id.x; if (i >= u.n) { return; } let p = pos[i]; var v = (p - prev[i]) / u.dt;
  /* viscosity as velocity smoothing over the neighbourhood */
  var dv = vec2f(0.0); var w = 0.0; let h = u.h; for (var j = 0u; j < u.n; j++) { if (j == i) { continue; } let q = pos[j] - p; if (abs(q.x) < h && abs(q.y) < h) { let r = length(q); if (r < h) { let k = 1.0 - r / h; dv += ((pos[j] - prev[j]) / u.dt - v) * k; w += k; } } }
  if (w > 0.0) { v += dv / w * u.visc; }
  let sp = length(v); if (sp > 140.0) { v = v / sp * 140.0; }
  vel[i] = v; posOut[i] = p; }`;
const P_CLEAR = P_COMMON + `
@group(0) @binding(1) var<storage, read_write> grid: array<atomic<u32>>;
@compute @workgroup_size(256) fn main(@builtin(global_invocation_id) id: vec3u) { let _u = u.n; let i = id.x; if (i < ${GW * GH}u) { atomicStore(&grid[i], 0u); } }`;
const P_SPLAT = P_COMMON + `
@group(0) @binding(1) var<storage, read> pos: array<vec2f>;
@group(0) @binding(2) var<storage, read_write> grid: array<atomic<u32>>;
@compute @workgroup_size(128) fn main(@builtin(global_invocation_id) id: vec3u) { let i = id.x; if (i >= u.n) { return; } let p = pos[i]; let cx = i32(p.x); let cy = i32(p.y);
  for (var dy = -3; dy <= 3; dy++) { for (var dx = -3; dx <= 3; dx++) { let x = cx + dx; let y = cy + dy; if (x < 0 || y < 0 || x >= ${GW} || y >= ${GH}) { continue; } let q = vec2f(f32(x) + 0.5, f32(y) + 0.5) - p; let w = max(0.0, 1.0 - dot(q, q) / 12.0); atomicAdd(&grid[u32(y) * ${GW}u + u32(x)], u32(w * w * 255.0)); } } }`;
const P_DRAW = FSQ_VS + `
struct U { n: u32, pad0: u32, pad1: u32, pad2: u32, dt: f32, gravX: f32, gravY: f32, visc: f32, h: f32, rest: f32, stiff: f32, time: f32, tint: vec4f };
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> grid: array<u32>;
fn glass(p: vec2f) -> f32 { let c = vec2f(96.0, 118.0); let q = p - c; let w = 44.0 + 22.0 * smoothstep(-90.0, 90.0, q.y); let d = abs(vec2f(q.x, q.y)) - vec2f(w, 92.0); return min(max(d.x, d.y), 0.0) + length(max(d, vec2f(0.0))) - 6.0; }
fn field(p: vec2f) -> f32 { let x = i32(p.x); let y = i32(p.y); if (x < 0 || y < 0 || x >= ${GW} || y >= ${GH}) { return 0.0; } return f32(grid[u32(y) * ${GW}u + u32(x)]) / 255.0; }
fn fieldS(p: vec2f) -> f32 { let f = floor(p - 0.5); let t = p - 0.5 - f; return mix(mix(field(f), field(f + vec2f(1.0, 0.0)), t.x), mix(field(f + vec2f(0.0, 1.0)), field(f + vec2f(1.0, 1.0)), t.x), t.y); }
fn hash(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }
@fragment fn fs(o: VO) -> @location(0) vec4f {
  let g = vec2f(o.uv.x * ${GW}.0, (1.0 - o.uv.y) * ${GH}.0);
  /* the backdrop: a warm counter and a soft window light */
  var bg = mix(vec3f(0.93, 0.90, 0.85), vec3f(0.98, 0.97, 0.95), smoothstep(0.0, 1.0, o.uv.y)); bg *= 0.85 + 0.15 * smoothstep(0.9, 0.2, length(o.uv - vec2f(0.3, 0.25)));
  let gd = glass(g);
  var col = bg;
  if (gd < 0.0) {
    let d = fieldS(g); let inside = smoothstep(0.55, 0.85, d);
    /* the surface normal from the density gradient; refract the backdrop through it */
    let e = 1.0; let n2 = normalize(vec2f(fieldS(g + vec2f(e, 0.0)) - fieldS(g - vec2f(e, 0.0)), fieldS(g + vec2f(0.0, e)) - fieldS(g - vec2f(0.0, e))) + vec2f(1e-4));
    let rim = smoothstep(0.55, 0.62, d) * (1.0 - smoothstep(0.62, 1.2, d));
    let shift = n2 * 8.0 * (1.0 - inside * 0.4);
    let uvr = o.uv + shift / vec2f(${GW}.0, ${GH}.0);
    var bgr = mix(vec3f(0.93, 0.90, 0.85), vec3f(0.98, 0.97, 0.95), smoothstep(0.0, 1.0, uvr.y));
    let tint = u.tint.rgb; let depth = clamp(d, 0.0, 1.5);
    var liquid = bgr * mix(vec3f(1.0), tint, 0.55 + 0.35 * depth); liquid = mix(liquid, tint * 0.85, 0.18 * depth);
    /* a highlight along the top surface, bubbles in the body */
    let hi = pow(max(-n2.y, 0.0), 6.0) * rim * 1.2; liquid += vec3f(hi);
    let bc = floor(g / 6.0); let bh = hash(bc + floor(u.time * 0.3)); let bub = step(0.985, bh) * smoothstep(1.6, 0.8, length(fract(g / 6.0) - 0.5) * 3.0) * inside * 0.6; liquid += vec3f(bub);
    col = mix(bg, liquid, inside); col += vec3f(0.35) * rim * 0.5;
  }
  /* the glass itself: a wall with a fresnel edge */
  let open = smoothstep(196.0, 206.0, g.y); /* the glass is open at the top */
  let wall = smoothstep(4.0, 0.0, abs(gd)) * (1.0 - open); col = mix(col, vec3f(0.85, 0.92, 0.97), wall * 0.65); col += vec3f(1.0) * smoothstep(2.0, 0.0, abs(gd + 1.0)) * 0.25 * (1.0 - open);
  if (gd > 0.0 && gd < 4.0 && open < 0.5) { col = mix(col, bg * 0.92, 0.5); }
  return vec4f(col, 1.0);
}`;
const FLAVOURS = [
  { id: 'yuzu', name: 'Yuzu & sea salt', tint: [0.96, 0.86, 0.35], visc: 0.9, price: '£3.20' },
  { id: 'hibiscus', name: 'Hibiscus & ginger', tint: [0.86, 0.15, 0.32], visc: 1.4, price: '£3.20' },
  { id: 'matcha', name: 'Matcha oat', tint: [0.55, 0.68, 0.30], visc: 3.2, price: '£3.60' },
  { id: 'cold-brew', name: 'Cold brew', tint: [0.25, 0.16, 0.10], visc: 1.0, price: '£3.40' },
];
function pourCard() {
  const el = $('pr-card'), stage = $('pr-stage'), canvas = $('pr-canvas'), status = $('pr-status'); let s = null, fl = 0, tilt = 0, ptrX = null, lastPtr = 0;
  document.querySelectorAll('.pr-fl').forEach((b, i) => b.addEventListener('click', () => { fl = i; document.querySelectorAll('.pr-fl').forEach((o) => o.classList.toggle('pr-on', o === b)); $('pr-name').textContent = FLAVOURS[i].name; $('pr-price').textContent = FLAVOURS[i].price; }));
  pointer(stage, (p) => { ptrX = p.x - 0.5; lastPtr = performance.now(); }, () => { ptrX = null; });
  return card({ name: 'pour', el, init() {
    const dev = this.__dev, { ctx, fit } = attach(canvas);
    const pos = [storage(PN * 8), storage(PN * 8)], vel = storage(PN * 8), prev = storage(PN * 8), rho = storage(PN * 8), grid = storage(GW * GH * 4), u = uniform(64);
    const p0 = new Float32Array(PN * 2); for (let i = 0; i < PN; i++) { p0[i * 2] = 60 + hash2(i, 1) * 72; p0[i * 2 + 1] = 36 + hash2(i, 2) * 120; } dev.queue.writeBuffer(pos[0], 0, p0);
    const pP = compute(P_PREDICT), pDn = compute(P_DENSITY), pR = compute(P_RELAX), pFi = compute(P_FINISH), pC = compute(P_CLEAR), pS = compute(P_SPLAT), pDraw = render(P_DRAW);
    const gP = bind(pP, [u, pos[0], vel, prev]), gDn = bind(pDn, [u, pos[0], rho]), gR = bind(pR, [u, pos[0], rho, pos[1]]), gFi = bind(pFi, [u, pos[1], prev, vel, pos[0]]), gC = bind(pC, [u, grid]), gS = bind(pS, [u, pos[0], grid]), gDraw = bind(pDraw, [u, grid]);
    const tm = timer(['sph', 'splat'], 4);
    s = { ctx, fit, u, pP, pDn, pR, pFi, pC, pS, pDraw, gP, gDn, gR, gFi, gC, gS, gDraw, tm }; status.hidden = true; $('pr-n').textContent = PN.toLocaleString();
  }, frame(t, dt, now) {
    if (!s) return; s.fit(); const dev = this.__dev, T = now / 1000;
    /* the glass tilts toward the hand, or sways on its own; gravity follows */
    const want = ptrX !== null ? ptrX * 1.2 : Math.sin(T * 0.7) * 0.35 * (now - lastPtr > 2000 ? 1 : 0); tilt += (want - tilt) * Math.min(1, dt * 3);
    const F = FLAVOURS[fl], U = new ArrayBuffer(64), Ui = new Uint32Array(U), Uf = new Float32Array(U);
    Ui[0] = PN; Uf[4] = 1 / 90; Uf[5] = Math.sin(tilt) * 700; Uf[6] = -Math.cos(tilt) * 700; Uf[7] = 0.12 * F.visc; Uf[8] = 5.5; Uf[9] = 5.0; Uf[10] = 0.06; Uf[11] = T; Uf.set([...F.tint, 1], 12);
    dev.queue.writeBuffer(s.u, 0, U);
    const enc = dev.createCommandEncoder(); const g = Math.ceil(PN / 128);
    let pass = enc.beginComputePass(s.tm.begin(0));
    for (let k = 0; k < 2; k++) { pass.setPipeline(s.pP); pass.setBindGroup(0, s.gP); pass.dispatchWorkgroups(g); pass.setPipeline(s.pDn); pass.setBindGroup(0, s.gDn); pass.dispatchWorkgroups(g); pass.setPipeline(s.pR); pass.setBindGroup(0, s.gR); pass.dispatchWorkgroups(g); pass.setPipeline(s.pFi); pass.setBindGroup(0, s.gFi); pass.dispatchWorkgroups(g); }
    pass.end();
    pass = enc.beginComputePass(s.tm.begin(1)); pass.setPipeline(s.pC); pass.setBindGroup(0, s.gC); pass.dispatchWorkgroups(Math.ceil(GW * GH / 256)); pass.setPipeline(s.pS); pass.setBindGroup(0, s.gS); pass.dispatchWorkgroups(g); pass.end();
    const rp = enc.beginRenderPass({ colorAttachments: [{ view: s.ctx.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store' }] });
    rp.setPipeline(s.pDraw); rp.setBindGroup(0, s.gDraw); rp.draw(3); rp.end(); s.tm.resolve(enc); dev.queue.submit([enc.finish()]);
    const rd = s.tm.read(); if (rd.sph !== undefined) $('pr-t').textContent = `sph ${rd.sph.toFixed(2)} ms · splat ${(rd.splat || 0).toFixed(2)} ms`;
  } });
}

export function fluidCards() { return [tintaCard(), fumeCard(), pourCard()]; }
