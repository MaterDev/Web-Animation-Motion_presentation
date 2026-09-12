/* §3 · things that depend on the cell next door — a falling-sand toy, a
   reaction-diffusion card, a fluid ink product page. Each is a grid in a
   storage buffer stepped by a compute pass that reads neighbours from one
   buffer and writes the next state to another. */
import { $, col, storage, uniform, compute, render, bind, attach, card, pointer, FSQ_VS } from './common.js';

/* ── GRAINS · a cellular automaton ────────────────────────────────────── */
const GW = 256, GH = 160, GSTEPS = 6;
const GRAINS_STEP = `
struct U { w: u32, h: u32, parity: u32, frame: u32, brush: vec2f, brushR: f32, brushM: u32, paint: u32, pad0: u32, pad1: u32, pad2: u32 };
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> src: array<u32>;
@group(0) @binding(2) var<storage, read_write> dst: array<u32>;
fn hash(n: u32) -> u32 { var x = n * 747796405u + 2891336453u; x = ((x >> ((x >> 28u) + 4u)) ^ x) * 277803737u; return (x >> 22u) ^ x; }
fn cell(x: i32, y: i32) -> u32 { if (x < 0 || y < 0 || x >= i32(u.w) || y >= i32(u.h)) { return 5u; } return src[u32(y) * u.w + u32(x)]; }
fn liquid(m: u32) -> bool { return m == 2u || m == 3u; }
/* materials: 0 empty · 1 sand · 2 water · 3 oil · 4 fire · 5 wall · 6 steam · 7 ash.
   Each 2×2 block is resolved by one thread (a Margolus neighbourhood), the
   block offset alternating with parity, so every cell is written once per
   step and no two threads contend. y grows downward. */
@compute @workgroup_size(16, 16) fn main(@builtin(global_invocation_id) id: vec3u) {
  let bx = i32(id.x) * 2 - i32(u.parity & 1u); let by = i32(id.y) * 2 - i32((u.parity >> 1u) & 1u);
  if (bx >= i32(u.w) || by >= i32(u.h)) { return; }
  var c: array<u32, 4>; c[0] = cell(bx, by); c[1] = cell(bx + 1, by); c[2] = cell(bx, by + 1); c[3] = cell(bx + 1, by + 1);
  let r = hash(u32(bx + 2) * 7919u + u32(by + 2) * 104729u + u.frame * 31u);
  /* fire */
  for (var i = 0u; i < 4u; i++) { if (c[i] == 4u) {
    for (var j = 0u; j < 4u; j++) { if (c[j] == 3u && ((r >> (i + j)) & 1u) == 0u) { c[j] = 4u; } if (c[j] == 2u && ((r >> (i + j + 3u)) & 7u) == 0u) { c[j] = 6u; } }
    if (((r >> (9u + i)) & 7u) == 0u) { c[i] = select(0u, 7u, ((r >> 14u) & 3u) == 0u); } } }
  /* gravity in each column of the block: denser sinks through lighter */
  let dens = array<u32, 8>(0u, 6u, 4u, 3u, 0u, 9u, 0u, 5u);
  for (var k = 0u; k < 2u; k++) { let top = k; let bot = k + 2u; let a = c[top]; let b = c[bot];
    if (a == 5u || b == 5u) { continue; }
    if (a != 0u && a != 4u && dens[a] > dens[b] && b != 4u) { c[top] = b; c[bot] = a; }
    else if (b == 6u && a != 5u && a != 6u && (r & 2u) == 0u) { c[bot] = a; c[top] = 6u; }
  }
  /* sand slides into a diagonal hole; liquids spread */
  let flip = (r & 4u) != 0u;
  let L = select(0u, 1u, flip); let R = select(1u, 0u, flip); let LB = L + 2u; let RB = R + 2u;
  if (c[L] == 1u && c[RB] == 0u && c[LB] != 0u) { c[RB] = 1u; c[L] = 0u; }
  else if (c[R] == 1u && c[LB] == 0u && c[RB] != 0u) { c[LB] = 1u; c[R] = 0u; }
  if (liquid(c[LB]) && c[RB] == 0u) { c[RB] = c[LB]; c[LB] = 0u; } else if (liquid(c[RB]) && c[LB] == 0u) { c[LB] = c[RB]; c[RB] = 0u; }
  if (liquid(c[L]) && c[R] == 0u && c[LB] != 0u && (r & 8u) != 0u) { c[R] = c[L]; c[L] = 0u; }
  /* oil floats: an oil under water swaps up */
  for (var k = 0u; k < 2u; k++) { if (c[k] == 2u && c[k + 2u] == 3u) { c[k] = 3u; c[k + 2u] = 2u; } }
  /* steam condenses now and then */
  for (var i = 0u; i < 4u; i++) { if (c[i] == 6u && ((r >> (16u + i)) & 127u) == 0u) { c[i] = 2u; } }
  /* the brush */
  if (u.paint == 1u) { for (var i = 0u; i < 4u; i++) { let px = f32(bx + i32(i & 1u)) + 0.5; let py = f32(by + i32(i >> 1u)) + 0.5;
    if (length(vec2f(px, py) - u.brush) < u.brushR) { if (u.brushM == 0u) { c[i] = 0u; } else if (c[i] == 0u || u.brushM == 4u) { c[i] = u.brushM; } } } }
  if (bx >= 0 && by >= 0) { dst[u32(by) * u.w + u32(bx)] = c[0]; }
  if (bx + 1 < i32(u.w) && by >= 0) { dst[u32(by) * u.w + u32(bx + 1)] = c[1]; }
  if (bx >= 0 && by + 1 < i32(u.h)) { dst[u32(by + 1) * u.w + u32(bx)] = c[2]; }
  if (bx + 1 < i32(u.w) && by + 1 < i32(u.h)) { dst[u32(by + 1) * u.w + u32(bx + 1)] = c[3]; }
}`;
const GRAINS_DRAW = FSQ_VS + `
struct R { w: u32, h: u32, frame: u32, pad: u32, bg: vec4f };
@group(0) @binding(0) var<uniform> r: R;
@group(0) @binding(1) var<storage, read> cells: array<u32>;
fn hash(n: u32) -> f32 { var x = n * 747796405u + 2891336453u; x = ((x >> ((x >> 28u) + 4u)) ^ x) * 277803737u; x = (x >> 22u) ^ x; return f32(x) / 4294967295.0; }
@fragment fn fs(o: VO) -> @location(0) vec4f {
  let x = u32(o.uv.x * f32(r.w)); let y = u32(o.uv.y * f32(r.h)); let m = cells[min(y, r.h - 1u) * r.w + min(x, r.w - 1u)];
  let n = hash(x * 131u + y * 7u) * 0.16 - 0.08;
  var c = r.bg.rgb;
  if (m == 1u) { c = vec3f(0.85, 0.66, 0.36) + n; } else if (m == 2u) { c = vec3f(0.29, 0.56, 0.84) + n * 0.5; } else if (m == 3u) { c = vec3f(0.42, 0.29, 0.16) + n; }
  else if (m == 4u) { let f = hash(x * 3u + y * 5u + r.frame); c = mix(vec3f(0.95, 0.35, 0.15), vec3f(1.0, 0.85, 0.3), f); } else if (m == 5u) { c = vec3f(0.33, 0.32, 0.31) + n; } else if (m == 6u) { c = vec3f(0.88, 0.9, 0.93); } else if (m == 7u) { c = vec3f(0.5, 0.48, 0.46) + n; }
  return vec4f(c, 1.0);
}`;
function grainsCard() {
  const el = $('gr-card'), stage = $('gr-stage'), canvas = $('gr-canvas'); let s = null, brush = [-99, -99], painting = false, mat = 1;
  document.querySelectorAll('.gr-el').forEach((b) => b.addEventListener('click', () => { mat = +b.dataset.m; document.querySelectorAll('.gr-el').forEach((o) => o.classList.toggle('gr-on', o === b)); }));
  const at = (p) => [p.x * GW, p.y * GH];
  pointer(stage, (p) => { brush = at(p); }, () => { painting = false; }, (p) => { painting = true; brush = at(p); }, () => { painting = false; });
  return card({ name: 'grains', el, init() {
    const dev = this.__dev, { ctx, fit } = attach(canvas);
    const bufs = [storage(GW * GH * 4), storage(GW * GH * 4)];
    const init = new Uint32Array(GW * GH);
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { let m = 0; if (y === GH - 1) m = 5; if (y > 112 && y < 116 && x > 36 && x < 140) m = 5; if (Math.hypot(x - 72, y - 60) < 18) m = 1; if (y > 136 && x > 158 && x < 246) m = 2; if (y > 128 && y <= 136 && x > 168 && x < 236) m = 3; init[y * GW + x] = m; }
    dev.queue.writeBuffer(bufs[0], 0, init);
    const pStep = compute(GRAINS_STEP), pDraw = render(GRAINS_DRAW), ru = uniform(32);
    const unis = [], groups = [];
    for (let k = 0; k < GSTEPS; k++) { const u = uniform(48); unis.push(u); groups.push([bind(pStep, [u, bufs[0], bufs[1]]), bind(pStep, [u, bufs[1], bufs[0]])]); }
    const draws = [bind(pDraw, [ru, bufs[0]]), bind(pDraw, [ru, bufs[1]])];
    s = { ctx, fit, ru, pStep, pDraw, unis, groups, draws, cur: 0, frame: 0, bg: col(el, '--gr-bg') }; $('gr-count').textContent = `${GW} × ${GH} cells`;
  }, frame() {
    if (!s) return; s.fit(); const dev = this.__dev;
    const enc = dev.createCommandEncoder();
    for (let k = 0; k < GSTEPS; k++) {
      s.frame++; const U = new ArrayBuffer(48), Ui = new Uint32Array(U), Uf = new Float32Array(U);
      Ui[0] = GW; Ui[1] = GH; Ui[2] = s.frame & 3; Ui[3] = s.frame; Uf[4] = brush[0]; Uf[5] = brush[1]; Uf[6] = mat === 5 ? 2.2 : 4.5; Ui[7] = mat; Ui[8] = painting && k === 0 ? 1 : 0;
      dev.queue.writeBuffer(s.unis[k], 0, U);
      const pass = enc.beginComputePass(); pass.setPipeline(s.pStep); pass.setBindGroup(0, s.groups[k][s.cur]); pass.dispatchWorkgroups(Math.ceil((GW / 2 + 1) / 16), Math.ceil((GH / 2 + 1) / 16)); pass.end();
      s.cur ^= 1;
    }
    dev.queue.writeBuffer(s.ru, 0, new Uint32Array([GW, GH, s.frame, 0])); dev.queue.writeBuffer(s.ru, 16, new Float32Array(s.bg));
    const rp = enc.beginRenderPass({ colorAttachments: [{ view: s.ctx.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store' }] });
    rp.setPipeline(s.pDraw); rp.setBindGroup(0, s.draws[s.cur]); rp.draw(3); rp.end();
    dev.queue.submit([enc.finish()]);
  } });
}

/* ── REEF · Gray–Scott reaction-diffusion on a membership card ─────────── */
const RW = 320, RH = 202;
const RD_STEP = `
struct U { w: u32, h: u32, pad0: u32, pad1: u32, touch: vec2f, touchOn: f32, feed: f32, kill: f32, pad2: vec3f };
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> src: array<vec2f>;
@group(0) @binding(2) var<storage, read_write> dst: array<vec2f>;
fn at(x: i32, y: i32) -> vec2f { let xx = (x + i32(u.w)) % i32(u.w); let yy = (y + i32(u.h)) % i32(u.h); return src[u32(yy) * u.w + u32(xx)]; }
@compute @workgroup_size(16, 16) fn main(@builtin(global_invocation_id) id: vec3u) {
  let x = i32(id.x); let y = i32(id.y); if (x >= i32(u.w) || y >= i32(u.h)) { return; }
  let c = at(x, y);
  let lap = (at(x - 1, y) + at(x + 1, y) + at(x, y - 1) + at(x, y + 1)) * 0.2 + (at(x - 1, y - 1) + at(x + 1, y - 1) + at(x - 1, y + 1) + at(x + 1, y + 1)) * 0.05 - c;
  let a = c.x; let b = c.y; let abb = a * b * b;
  var na = a + (1.0 * lap.x - abb + u.feed * (1.0 - a)); var nb = b + (0.5 * lap.y + abb - (u.feed + u.kill) * b);
  if (u.touchOn > 0.5) { let d = length(vec2f(f32(x), f32(y)) - u.touch); if (d < 5.0) { nb = max(nb, 0.6); } }
  dst[u32(y) * u.w + u32(x)] = vec2f(clamp(na, 0.0, 1.0), clamp(nb, 0.0, 1.0));
}`;
const RD_DRAW = FSQ_VS + `
struct R { w: u32, h: u32, pad0: u32, pad1: u32, deep: vec4f, mid: vec4f, coral: vec4f, tip: vec4f };
@group(0) @binding(0) var<uniform> r: R;
@group(0) @binding(1) var<storage, read> cells: array<vec2f>;
@fragment fn fs(o: VO) -> @location(0) vec4f {
  let x = u32(o.uv.x * f32(r.w)); let y = u32(o.uv.y * f32(r.h)); let c = cells[min(y, r.h - 1u) * r.w + min(x, r.w - 1u)];
  let b = smoothstep(0.08, 0.32, c.y);
  let xr = u32(min(x + 1u, r.w - 1u)); let yd = u32(min(y + 1u, r.h - 1u)); let g = cells[y * r.w + xr].y - c.y + cells[yd * r.w + x].y - c.y;
  var col = mix(r.deep.rgb, r.mid.rgb, (1.0 - o.uv.y) * 0.6 + 0.2);
  col = mix(col, mix(r.coral.rgb, r.tip.rgb, smoothstep(0.32, 0.5, c.y)), b);
  col += g * 1.2 * b;
  return vec4f(col, 1.0);
}`;
function reefCard() {
  const el = $('rf-card'), stage = $('rf-stage'), canvas = $('rf-canvas'); let s = null, touch = [-9, -9], touching = false;
  pointer(stage, (p) => { touch = [p.x * RW, p.y * RH]; touching = true; }, () => { touching = false; }, (p) => { touch = [p.x * RW, p.y * RH]; touching = true; });
  return card({ name: 'reef', el, init() {
    const dev = this.__dev, { ctx, fit } = attach(canvas);
    const bufs = [storage(RW * RH * 8), storage(RW * RH * 8)];
    const init = new Float32Array(RW * RH * 2); for (let i = 0; i < RW * RH; i++) { init[i * 2] = 1; init[i * 2 + 1] = 0; }
    for (let k = 0; k < 9; k++) { const cx = 30 + Math.floor(Math.random() * (RW - 60)), cy = 30 + Math.floor(Math.random() * (RH - 60)); for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) init[((cy + y) * RW + cx + x) * 2 + 1] = 0.5; }
    dev.queue.writeBuffer(bufs[0], 0, init);
    const pStep = compute(RD_STEP), pDraw = render(RD_DRAW), ru = uniform(80);
    const STEPS = 12, unis = [], groups = [];
    for (let k = 0; k < STEPS; k++) { const u = uniform(64); unis.push(u); groups.push([bind(pStep, [u, bufs[0], bufs[1]]), bind(pStep, [u, bufs[1], bufs[0]])]); }
    const draws = [bind(pDraw, [ru, bufs[0]]), bind(pDraw, [ru, bufs[1]])];
    dev.queue.writeBuffer(ru, 0, new Uint32Array([RW, RH, 0, 0])); dev.queue.writeBuffer(ru, 16, new Float32Array([...col(el, '--rf-bg'), 0.20, 0.09, 0.22, 1, ...col(el, '--rf-coral'), ...col(el, '--rf-ink')]));
    s = { ctx, fit, ru, pStep, pDraw, unis, groups, draws, STEPS, cur: 0 };
  }, frame(t, dt, now) {
    if (!s) return; s.fit(); const dev = this.__dev; const enc = dev.createCommandEncoder();
    /* feed and kill drift slowly around the coral regime so the pattern keeps changing */
    const T = now / 1000, feed = 0.037 + 0.004 * Math.sin(T * 0.05), kill = 0.060 + 0.002 * Math.sin(T * 0.037 + 1);
    for (let k = 0; k < s.STEPS; k++) {
      const U = new ArrayBuffer(64), Ui = new Uint32Array(U), Uf = new Float32Array(U); Ui[0] = RW; Ui[1] = RH; Uf[4] = touch[0]; Uf[5] = touch[1]; Uf[6] = touching && k === 0 ? 1 : 0; Uf[7] = feed; Uf[8] = kill;
      dev.queue.writeBuffer(s.unis[k], 0, U);
      const pass = enc.beginComputePass(); pass.setPipeline(s.pStep); pass.setBindGroup(0, s.groups[k][s.cur]); pass.dispatchWorkgroups(Math.ceil(RW / 16), Math.ceil(RH / 16)); pass.end(); s.cur ^= 1;
    }
    const rp = enc.beginRenderPass({ colorAttachments: [{ view: s.ctx.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store' }] });
    rp.setPipeline(s.pDraw); rp.setBindGroup(0, s.draws[s.cur]); rp.draw(3); rp.end(); dev.queue.submit([enc.finish()]);
  } });
}

/* ── TINTA · a stable fluid with dye, on paper ─────────────────────────── */
const FW = 384, FH = 240, PRESS_ITERS = 24;
const FLUID_COMMON = `
struct U { w: u32, h: u32, stage: u32, pad0: u32, dt: f32, ptrOn: f32, ptr: vec2f, force: vec2f, dissipation: f32, pad1: f32, dye: vec4f };
@group(0) @binding(0) var<uniform> u: U;
fn idx(x: i32, y: i32) -> u32 { return u32(clamp(y, 0, i32(u.h) - 1)) * u.w + u32(clamp(x, 0, i32(u.w) - 1)); }`;
/* stage 0: advect velocity + dye, inject; stage 1: divergence; stage 2: pressure jacobi (read p0 → write p1); stage 3: project */
const FLUID_ADVECT = FLUID_COMMON + `
@group(0) @binding(1) var<storage, read> vel: array<vec2f>;
@group(0) @binding(2) var<storage, read_write> velOut: array<vec2f>;
@group(0) @binding(3) var<storage, read> dye: array<vec4f>;
@group(0) @binding(4) var<storage, read_write> dyeOut: array<vec4f>;
fn sampleV(p: vec2f) -> vec2f { let x = i32(floor(p.x)); let y = i32(floor(p.y)); let f = fract(p); return mix(mix(vel[idx(x, y)], vel[idx(x + 1, y)], f.x), mix(vel[idx(x, y + 1)], vel[idx(x + 1, y + 1)], f.x), f.y); }
fn sampleD(p: vec2f) -> vec4f { let x = i32(floor(p.x)); let y = i32(floor(p.y)); let f = fract(p); return mix(mix(dye[idx(x, y)], dye[idx(x + 1, y)], f.x), mix(dye[idx(x, y + 1)], dye[idx(x + 1, y + 1)], f.x), f.y); }
@compute @workgroup_size(16, 16) fn main(@builtin(global_invocation_id) id: vec3u) {
  let x = i32(id.x); let y = i32(id.y); if (x >= i32(u.w) || y >= i32(u.h)) { return; }
  let p = vec2f(f32(x), f32(y)); let v = vel[idx(x, y)]; let back = p - v * u.dt;
  var nv = sampleV(back) * 0.995; var nd = sampleD(back) * u.dissipation;
  if (u.ptrOn > 0.5) { let d = p - u.ptr; let dd = dot(d, d); let g = exp(-dd / 90.0); nv += u.force * g; nd += u.dye * g * 0.6; }
  if (x == 0 || y == 0 || x == i32(u.w) - 1 || y == i32(u.h) - 1) { nv = vec2f(0.0); }
  velOut[idx(x, y)] = nv; dyeOut[idx(x, y)] = min(nd, vec4f(1.0));
}`;
const FLUID_DIV = FLUID_COMMON + `
@group(0) @binding(1) var<storage, read> vel: array<vec2f>;
@group(0) @binding(2) var<storage, read_write> div: array<f32>;
@group(0) @binding(3) var<storage, read_write> pres: array<f32>;
@compute @workgroup_size(16, 16) fn main(@builtin(global_invocation_id) id: vec3u) {
  let x = i32(id.x); let y = i32(id.y); if (x >= i32(u.w) || y >= i32(u.h)) { return; }
  div[idx(x, y)] = 0.5 * (vel[idx(x + 1, y)].x - vel[idx(x - 1, y)].x + vel[idx(x, y + 1)].y - vel[idx(x, y - 1)].y); pres[idx(x, y)] = 0.0;
}`;
const FLUID_JACOBI = FLUID_COMMON + `
@group(0) @binding(1) var<storage, read> div: array<f32>;
@group(0) @binding(2) var<storage, read> p0: array<f32>;
@group(0) @binding(3) var<storage, read_write> p1: array<f32>;
@compute @workgroup_size(16, 16) fn main(@builtin(global_invocation_id) id: vec3u) {
  let x = i32(id.x); let y = i32(id.y); if (x >= i32(u.w) || y >= i32(u.h)) { return; }
  p1[idx(x, y)] = (p0[idx(x - 1, y)] + p0[idx(x + 1, y)] + p0[idx(x, y - 1)] + p0[idx(x, y + 1)] - div[idx(x, y)]) * 0.25;
}`;
const FLUID_PROJECT = FLUID_COMMON + `
@group(0) @binding(1) var<storage, read> pres: array<f32>;
@group(0) @binding(2) var<storage, read_write> vel: array<vec2f>;
@compute @workgroup_size(16, 16) fn main(@builtin(global_invocation_id) id: vec3u) {
  let x = i32(id.x); let y = i32(id.y); if (x >= i32(u.w) || y >= i32(u.h)) { return; }
  vel[idx(x, y)] -= 0.5 * vec2f(pres[idx(x + 1, y)] - pres[idx(x - 1, y)], pres[idx(x, y + 1)] - pres[idx(x, y - 1)]);
}`;
const FLUID_DRAW = FSQ_VS + `
struct R { w: u32, h: u32, pad0: u32, pad1: u32, paper: vec4f };
@group(0) @binding(0) var<uniform> r: R;
@group(0) @binding(1) var<storage, read> dye: array<vec4f>;
@fragment fn fs(o: VO) -> @location(0) vec4f {
  let fx = o.uv.x * f32(r.w) - 0.5; let fy = o.uv.y * f32(r.h) - 0.5; let x = i32(floor(fx)); let y = i32(floor(fy)); let f = vec2f(fract(fx), fract(fy));
  let i = u32(clamp(y, 0, i32(r.h) - 1)) * r.w; let i2 = u32(clamp(y + 1, 0, i32(r.h) - 1)) * r.w;
  let x0 = u32(clamp(x, 0, i32(r.w) - 1)); let x1 = u32(clamp(x + 1, 0, i32(r.w) - 1));
  let d = mix(mix(dye[i + x0], dye[i + x1], f.x), mix(dye[i2 + x0], dye[i2 + x1], f.x), f.y);
  /* ink: subtractive over paper, with a little sheen where it is thick */
  let ink = d.rgb; let amount = d.a;
  var c = r.paper.rgb * (1.0 - amount * (1.0 - ink));
  c += vec3f(0.06, 0.02, 0.0) * smoothstep(0.7, 1.0, amount);
  return vec4f(c, 1.0);
}`;
function tintaCard() {
  const el = $('tn-card'), stage = $('tn-stage'), canvas = $('tn-canvas'); let s = null, ptr = [-9, -9], last = null, force = [0, 0], on = false;
  const INKS = [[0.42, 0.05, 0.10], [0.10, 0.12, 0.42], [0.07, 0.32, 0.22], [0.12, 0.10, 0.08]]; let inkIx = 0;
  const NAMES = [['Nº 07 — Oxblood', '30 ml · iron-gall · shading, sheen'], ['Nº 12 — Ultramarine', '30 ml · pigment · lightfast, wet'], ['Nº 03 — Verdigris', '30 ml · dye · shading, quick-dry'], ['Nº 01 — Sepia', '30 ml · iron-gall · archival']];
  document.querySelectorAll('.tn-sw').forEach((b) => b.addEventListener('click', () => { inkIx = +b.dataset.c; document.querySelectorAll('.tn-sw').forEach((o) => o.classList.toggle('tn-on', o === b)); $('tn-name').textContent = NAMES[inkIx][0]; $('tn-note').textContent = NAMES[inkIx][1]; }));
  pointer(stage, (p) => { const np = [p.x * FW, p.y * FH]; if (last) force = [(np[0] - last[0]) * 3.0, (np[1] - last[1]) * 3.0]; last = np; ptr = np; on = true; }, () => { on = false; last = null; });
  return card({ name: 'tinta', el, init() {
    const dev = this.__dev, { ctx, fit } = attach(canvas), N = FW * FH;
    const vel = [storage(N * 8), storage(N * 8)], dye = [storage(N * 16), storage(N * 16)], div = storage(N * 4), pres = [storage(N * 4), storage(N * 4)];
    const u = uniform(64), ru = uniform(32);
    const pA = compute(FLUID_ADVECT), pD = compute(FLUID_DIV), pJ = compute(FLUID_JACOBI), pP = compute(FLUID_PROJECT), pDraw = render(FLUID_DRAW);
    const gA = [bind(pA, [u, vel[0], vel[1], dye[0], dye[1]]), bind(pA, [u, vel[1], vel[0], dye[1], dye[0]])];
    const gD = [bind(pD, [u, vel[1], div, pres[0]]), bind(pD, [u, vel[0], div, pres[0]])];
    const gJ = [bind(pJ, [u, div, pres[0], pres[1]]), bind(pJ, [u, div, pres[1], pres[0]])];
    const gP = [bind(pP, [u, pres[0], vel[1]]), bind(pP, [u, pres[0], vel[0]])];
    const draws = [bind(pDraw, [ru, dye[1]]), bind(pDraw, [ru, dye[0]])];
    dev.queue.writeBuffer(ru, 0, new Uint32Array([FW, FH, 0, 0])); dev.queue.writeBuffer(ru, 16, new Float32Array(col(el, '--tn-bg')));
    s = { ctx, fit, u, pA, pD, pJ, pP, pDraw, gA, gD, gJ, gP, draws, cur: 0 };
  }, frame(t, dt, now) {
    if (!s) return; s.fit(); const dev = this.__dev;
    /* a slow authored current when the hand is away, so the page is never still */
    const T = now / 1000; let P = ptr, F = force, ON = on ? 1 : 0;
    if (!on) { P = [FW * (0.5 + 0.3 * Math.sin(T * 0.23)), FH * (0.5 + 0.3 * Math.sin(T * 0.31 + 1.2))]; F = [Math.cos(T * 0.23) * 3.2, Math.cos(T * 0.31 + 1.2) * 3.2]; ON = 1; }
    const U = new ArrayBuffer(64), Ui = new Uint32Array(U), Uf = new Float32Array(U); Ui[0] = FW; Ui[1] = FH; Uf[4] = 1.0; Uf[5] = ON; Uf[6] = P[0]; Uf[7] = P[1]; Uf[8] = F[0]; Uf[9] = F[1]; Uf[10] = 0.997; const ink = INKS[inkIx]; Uf[12] = ink[0]; Uf[13] = ink[1]; Uf[14] = ink[2]; Uf[15] = on ? 1.4 : 0.55;
    dev.queue.writeBuffer(s.u, 0, U); force = [force[0] * 0.5, force[1] * 0.5];
    const enc = dev.createCommandEncoder(); const gx = Math.ceil(FW / 16), gy = Math.ceil(FH / 16);
    let pass = enc.beginComputePass(); pass.setPipeline(s.pA); pass.setBindGroup(0, s.gA[s.cur]); pass.dispatchWorkgroups(gx, gy);
    pass.setPipeline(s.pD); pass.setBindGroup(0, s.gD[s.cur]); pass.dispatchWorkgroups(gx, gy);
    pass.setPipeline(s.pJ); for (let k = 0; k < PRESS_ITERS; k++) { pass.setBindGroup(0, s.gJ[k & 1]); pass.dispatchWorkgroups(gx, gy); }
    pass.setPipeline(s.pP); pass.setBindGroup(0, s.gP[s.cur]); pass.dispatchWorkgroups(gx, gy); pass.end();
    const rp = enc.beginRenderPass({ colorAttachments: [{ view: s.ctx.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store' }] });
    rp.setPipeline(s.pDraw); rp.setBindGroup(0, s.draws[s.cur]); rp.draw(3); rp.end(); dev.queue.submit([enc.finish()]);
    s.cur ^= 1;
  } });
}

export function neighbourCards() { return [grainsCard(), reefCard(), tintaCard()]; }
