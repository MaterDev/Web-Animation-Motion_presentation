/* §1 · the frame inspector — 200 000 particles under a curl-noise flow, an
   integrate step, a density histogram by atomic add, one instanced draw.
   Each pass between two GPU timestamps; switch a pass off and its bar goes. */
import { $, DPR, col, storage, uniform, compute, render, bind, attach, timer, card, bytes } from './common.js';

const N = 200000, G = 96;
const WG = `struct U { n: u32, g: u32, dt: f32, time: f32, aspect: f32, flowOn: f32, pad0: f32, pad1: f32 };`;
const FLOW = WG + `
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> pos: array<vec2f>;
@group(0) @binding(2) var<storage, read_write> vel: array<vec2f>;
fn hash(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }
fn vn(p: vec2f) -> f32 { let i = floor(p); var f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2f(1, 0)), f.x), mix(hash(i + vec2f(0, 1)), hash(i + vec2f(1, 1)), f.x), f.y); }
fn pot(p: vec2f, t: f32) -> f32 { return vn(p * 3.0 + vec2f(t * 0.07, 0.0)) + 0.5 * vn(p * 6.1 + vec2f(3.0, t * 0.05)); }
@compute @workgroup_size(256) fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x; if (i >= u.n) { return; }
  let p = pos[i] * vec2f(u.aspect, 1.0); let e = 0.01;
  let dx = (pot(p + vec2f(e, 0), u.time) - pot(p - vec2f(e, 0), u.time)) / (2.0 * e);
  let dy = (pot(p + vec2f(0, e), u.time) - pot(p - vec2f(0, e), u.time)) / (2.0 * e);
  let curl = vec2f(dy, -dx) * 0.12 * u.flowOn;
  vel[i] = mix(vel[i], curl, 0.08);
}`;
const INTEGRATE = WG + `
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read_write> pos: array<vec2f>;
@group(0) @binding(2) var<storage, read> vel: array<vec2f>;
@compute @workgroup_size(256) fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x; if (i >= u.n) { return; }
  var p = pos[i] + vel[i] * u.dt * 4.0;
  p = fract(p + vec2f(1.0));
  pos[i] = p;
}`;
const DENSITY = WG + `
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> pos: array<vec2f>;
@group(0) @binding(2) var<storage, read_write> dens: array<atomic<u32>>;
@compute @workgroup_size(256) fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x; let cells = u.g * u.g;
  if (i < cells) { atomicStore(&dens[i], 0u); }
  workgroupBarrier();
  if (i >= u.n) { return; }
  let p = pos[i]; let c = vec2u(clamp(u32(p.x * f32(u.g)), 0u, u.g - 1u), clamp(u32(p.y * f32(u.g)), 0u, u.g - 1u));
  atomicAdd(&dens[c.y * u.g + c.x], 1u);
}`;
const DRAW = WG + `
struct R { res: vec2f, size: f32, dens: f32, a: vec4f, b: vec4f, bg: vec4f };
@group(0) @binding(0) var<uniform> r: R;
@group(0) @binding(1) var<storage, read> pos: array<vec2f>;
@group(0) @binding(2) var<storage, read> dens: array<u32>;
struct VO { @builtin(position) p: vec4f, @location(0) c: vec4f, @location(1) q: vec2f };
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO {
  let corner = vec2f(f32(vi & 1u), f32((vi >> 1u) & 1u)) * 2.0 - 1.0;
  let p = pos[ii]; let g = ${G}u; let c = vec2u(clamp(u32(p.x * ${G}.0), 0u, g - 1u), clamp(u32(p.y * ${G}.0), 0u, g - 1u));
  let d = f32(dens[c.y * g + c.x]) / 60.0 * r.dens;
  var o: VO; o.p = vec4f((p * 2.0 - 1.0) + corner * r.size / r.res, 0.0, 1.0); o.q = corner;
  o.c = mix(r.a, r.b, clamp(d, 0.0, 1.0)); return o;
}
@fragment fn fs(o: VO) -> @location(0) vec4f { if (dot(o.q, o.q) > 1.0) { discard; } return vec4f(o.c.rgb, 0.85); }`;

export function clockCard() {
  const el = $('ck-card'), stage = $('ck-stage'), canvas = $('ck-canvas'), status = $('ck-status');
  const on = [true, true, true, true];
  [0, 1, 2].forEach((i) => $('ck-p' + i).addEventListener('change', (e) => { on[i] = e.target.checked; }));
  let s = null;
  const c = card({ name: 'clock', el, init() {
    const { ctx, fit } = attach(canvas);
    const pos = storage(N * 8), vel = storage(N * 8), dens = storage(G * G * 4);
    const seed = new Float32Array(N * 2); let h = 3; const rnd = () => { h = (h * 1664525 + 1013904223) >>> 0; return h / 4294967296; };
    for (let i = 0; i < N * 2; i++) seed[i] = rnd(); this.__dev.queue.writeBuffer(pos, 0, seed);
    const u = uniform(32), ru = uniform(80);
    const pFlow = compute(FLOW), pInt = compute(INTEGRATE), pDen = compute(DENSITY), pDraw = render(DRAW, { blend: true });
    const bFlow = bind(pFlow, [u, pos, vel]), bInt = bind(pInt, [u, pos, vel]), bDen = bind(pDen, [u, pos, dens]), bDraw = bind(pDraw, [ru, pos, dens]);
    const tm = timer(['flow', 'integrate', 'density', 'render']);
    const A = col(el, '--ck-dim'), B = col(el, '--ck-acc'), BG = col(el, '--ck-bg');
    s = { ctx, fit, u, ru, pFlow, pInt, pDen, pDraw, bFlow, bInt, bDen, bDraw, tm, A, B, BG, dens };
    status.hidden = true;
  }, frame(t, dt, now) {
    if (!s) return; s.fit(); const dev = this.__dev;
    const aspect = canvas.width / canvas.height;
    dev.queue.writeBuffer(s.u, 0, new Float32Array([0, 0, dt, now / 1000, aspect, on[0] ? 1 : 0, 0, 0])); dev.queue.writeBuffer(s.u, 0, new Uint32Array([N, G]));
    dev.queue.writeBuffer(s.ru, 0, new Float32Array([canvas.width, canvas.height, 2.2 * DPR, on[2] ? 1 : 0, ...s.A, ...s.B, ...s.BG]));
    const enc = dev.createCommandEncoder();
    let pass = enc.beginComputePass(s.tm.begin(0)); if (on[0]) { pass.setPipeline(s.pFlow); pass.setBindGroup(0, s.bFlow); pass.dispatchWorkgroups(Math.ceil(N / 256)); } pass.end();
    pass = enc.beginComputePass(s.tm.begin(1)); if (on[1]) { pass.setPipeline(s.pInt); pass.setBindGroup(0, s.bInt); pass.dispatchWorkgroups(Math.ceil(N / 256)); } pass.end();
    pass = enc.beginComputePass(s.tm.begin(2)); if (on[2]) { pass.setPipeline(s.pDen); pass.setBindGroup(0, s.bDen); pass.dispatchWorkgroups(Math.ceil(Math.max(N, G * G) / 256)); } pass.end();
    const rp = enc.beginRenderPass({ colorAttachments: [{ view: s.ctx.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: s.BG[0], g: s.BG[1], b: s.BG[2], a: 1 } }], ...s.tm.begin(3) });
    rp.setPipeline(s.pDraw); rp.setBindGroup(0, s.bDraw); rp.draw(4, N); rp.end();
    s.tm.resolve(enc); dev.queue.submit([enc.finish()]);
    const r = s.tm.read(); let total = 0, max = 0.01; s.tm.names.forEach((n) => { if (r[n] !== undefined) { total += r[n]; max = Math.max(max, r[n]); } });
    s.tm.names.forEach((n, i) => { const v = r[n]; $('ck-ms-' + i).textContent = v === undefined ? (s.tm.available ? '—' : 'n/a') : v.toFixed(3) + ' ms'; $('ck-bar-' + i).style.width = v === undefined ? '0' : Math.min(100, v / max * 100) + '%'; });
    $('ck-total').textContent = s.tm.available ? total.toFixed(3) + ' ms' : 'timestamp-query unavailable';
    $('ck-bytes').textContent = (bytes.frameState + bytes.frameUni) + ' B · uniforms only';
  } });
  return c;
}
