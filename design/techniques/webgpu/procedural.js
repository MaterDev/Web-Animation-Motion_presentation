/* §5 · TESSERA — a world grown on the GPU: fBm heights, flow accumulation
   by repeated downhill routing, stream-power carving, hillshade and biomes.
   Every press of the button re-runs the whole chain from a seed. */
import { $, col, storage, uniform, compute, render, bind, attach, timer, card, FSQ_VS } from './common.js';

const W = 1024, H = 640;
const COMMON = `
struct U { w: u32, h: u32, seed: u32, iter: u32, sea: f32, erosion: f32, time: f32, pad: f32 };
fn idx(x: i32, y: i32, u: U) -> u32 { return u32(clamp(y, 0, i32(u.h) - 1)) * u.w + u32(clamp(x, 0, i32(u.w) - 1)); }`;
const NOISE = COMMON + `
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read_write> height: array<f32>;
fn hash(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7)) + f32(u.seed) * 0.173) * 43758.5453); }
fn vn(p: vec2f) -> f32 { let i = floor(p); var f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2f(1, 0)), f.x), mix(hash(i + vec2f(0, 1)), hash(i + vec2f(1, 1)), f.x), f.y); }
fn fbm(p0: vec2f) -> f32 { var p = p0; var a = 0.5; var s = 0.0; var w = 0.0; let R = mat2x2f(0.8, 0.6, -0.6, 0.8); for (var i = 0; i < 7; i++) { s += a * vn(p); w += a; a *= 0.5; p = R * p * 2.03 + vec2f(1.7, 9.2); } return s / w; }
fn ridged(p0: vec2f) -> f32 { var p = p0; var a = 0.5; var s = 0.0; var w = 0.0; var wt = 1.0; for (var i = 0; i < 6; i++) { var v = 1.0 - abs(2.0 * vn(p) - 1.0); v = v * v * wt; wt = clamp(v * 1.5, 0.0, 1.0); s += a * v; w += a; a *= 0.5; p = p * 2.1 + vec2f(3.1, 1.3); } return s / w; }
@compute @workgroup_size(16, 16) fn main(@builtin(global_invocation_id) id: vec3u) {
  let x = i32(id.x); let y = i32(id.y); if (x >= i32(u.w) || y >= i32(u.h)) { return; }
  let p = vec2f(f32(x) / f32(u.w), f32(y) / f32(u.h)) * vec2f(f32(u.w) / f32(u.h), 1.0);
  let warp = vec2f(fbm(p * 2.0 + vec2f(5.2, 1.3)), fbm(p * 2.0 + vec2f(8.3, 2.8))) * 0.35;
  let cont = fbm((p + warp) * 1.6);
  let mount = ridged((p + warp * 0.5) * 3.4);
  /* an island-ish falloff so coasts happen */
  let d = length((vec2f(f32(x) / f32(u.w), f32(y) / f32(u.h)) - 0.5) * vec2f(1.6, 1.0)) * 1.15;
  var h = cont * 0.62 + mount * 0.55 * smoothstep(0.35, 0.7, cont) - d * d * 0.55 + 0.12;
  height[idx(x, y, u)] = clamp(h, 0.0, 1.0);
}`;
/* flow accumulation: every cell passes its water (1 + what it received) to its lowest neighbour; repeated, water reaches the sea */
const FLOW = COMMON + `
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> height: array<f32>;
@group(0) @binding(2) var<storage, read> flowIn: array<f32>;
@group(0) @binding(3) var<storage, read_write> flowOut: array<f32>;
fn lowest(x: i32, y: i32) -> vec2i { let h0 = height[idx(x, y, u)]; var best = vec2i(x, y); var hb = h0;
  for (var dy = -1; dy <= 1; dy++) { for (var dx = -1; dx <= 1; dx++) { if (dx == 0 && dy == 0) { continue; } let h = height[idx(x + dx, y + dy, u)]; if (h < hb) { hb = h; best = vec2i(x + dx, y + dy); } } } return best; }
@compute @workgroup_size(16, 16) fn main(@builtin(global_invocation_id) id: vec3u) {
  let x = i32(id.x); let y = i32(id.y); if (x >= i32(u.w) || y >= i32(u.h)) { return; }
  /* gather: sum the flow of every neighbour whose lowest neighbour is me */
  var acc = 1.0;
  for (var dy = -1; dy <= 1; dy++) { for (var dx = -1; dx <= 1; dx++) { if (dx == 0 && dy == 0) { continue; } let nx = x + dx; let ny = y + dy; if (nx < 0 || ny < 0 || nx >= i32(u.w) || ny >= i32(u.h)) { continue; } let l = lowest(nx, ny); if (l.x == x && l.y == y) { acc += flowIn[idx(nx, ny, u)]; } } }
  flowOut[idx(x, y, u)] = acc;
}`;
const CARVE = COMMON + `
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> flow: array<f32>;
@group(0) @binding(2) var<storage, read_write> height: array<f32>;
@compute @workgroup_size(16, 16) fn main(@builtin(global_invocation_id) id: vec3u) {
  let x = i32(id.x); let y = i32(id.y); if (x >= i32(u.w) || y >= i32(u.h)) { return; }
  let h = height[idx(x, y, u)]; if (h <= u.sea) { return; }
  let f = flow[idx(x, y, u)];
  let slope = max(0.0, h - min(min(height[idx(x - 1, y, u)], height[idx(x + 1, y, u)]), min(height[idx(x, y - 1, u)], height[idx(x, y + 1, u)])));
  /* stream power: erosion ∝ discharge^0.5 · slope, plus a little smoothing (thermal) */
  let e = 0.0009 * pow(f, 0.5) * slope * u.erosion;
  let mean = (height[idx(x - 1, y, u)] + height[idx(x + 1, y, u)] + height[idx(x, y - 1, u)] + height[idx(x, y + 1, u)]) * 0.25;
  height[idx(x, y, u)] = max(u.sea - 0.02, h - e + (mean - h) * 0.03 * u.erosion);
}`;
const SHADE = FSQ_VS + `
struct R { w: u32, h: u32, pad0: u32, pad1: u32, sea: f32, time: f32, pad2: vec2f, water: vec4f, deep: vec4f, sand: vec4f, grass: vec4f, forest: vec4f, rock: vec4f, snow: vec4f };
@group(0) @binding(0) var<uniform> r: R;
@group(0) @binding(1) var<storage, read> height: array<f32>;
@group(0) @binding(2) var<storage, read> flow: array<f32>;
fn H(x: i32, y: i32) -> f32 { return height[u32(clamp(y, 0, i32(r.h) - 1)) * r.w + u32(clamp(x, 0, i32(r.w) - 1))]; }
@fragment fn fs(o: VO) -> @location(0) vec4f {
  let x = i32(o.uv.x * f32(r.w)); let y = i32(o.uv.y * f32(r.h)); let h = H(x, y); let f = flow[u32(clamp(y, 0, i32(r.h) - 1)) * r.w + u32(clamp(x, 0, i32(r.w) - 1))];
  let dx = H(x + 1, y) - H(x - 1, y); let dy = H(x, y + 1) - H(x, y - 1); let n = normalize(vec3f(-dx * 60.0, -dy * 60.0, 1.0));
  let L = normalize(vec3f(-0.5, -0.6, 0.65)); let shade = 0.55 + 0.45 * max(dot(n, L), 0.0);
  var c: vec3f;
  if (h <= r.sea) { let depth = clamp((r.sea - h) * 6.0, 0.0, 1.0); c = mix(r.water.rgb, r.deep.rgb, depth); c += 0.05 * step(0.995, sin((o.uv.x * 90.0 + r.time * 0.4 + h * 40.0))); }
  else { let a = (h - r.sea) / max(1e-3, 1.0 - r.sea);
    c = mix(r.sand.rgb, r.grass.rgb, smoothstep(0.0, 0.06, a)); c = mix(c, r.forest.rgb, smoothstep(0.08, 0.30, a) * (0.6 + 0.4 * smoothstep(1.0, 6.0, f)));
    c = mix(c, r.rock.rgb, smoothstep(0.42, 0.62, a)); c = mix(c, r.snow.rgb, smoothstep(0.66, 0.80, a)); c *= shade;
    if (f > 28.0) { c = mix(c, r.water.rgb, clamp((f - 28.0) / 60.0, 0.0, 0.85)); } }
  return vec4f(c, 1.0);
}`;
const NAMES = ['Ashmere', 'Corvane', 'Isle of Dunmar', 'Sellith', 'Harrowgate', 'Vell', 'Tarn Morrow', 'Oskerry', 'Brindle Reach', 'Yarrowfell', 'Calder', 'Nethe'];
export function proceduralCard() {
  const el = $('tw-card'), canvas = $('tw-canvas'), status = $('tw-status'); let s = null, seed = 412, sea = 0.42, erosion = 24, dirty = true;
  $('tw-generate').addEventListener('click', () => { seed = Math.floor(Math.random() * 100000); dirty = true; });
  $('tw-sea').addEventListener('input', (e) => { sea = +e.target.value; $('tw-sea-v').textContent = sea.toFixed(2); dirty = true; });
  $('tw-ero').addEventListener('input', (e) => { erosion = +e.target.value; $('tw-ero-v').textContent = erosion + ' passes'; dirty = true; });
  return card({ name: 'tessera', el, init() {
    const dev = this.__dev, { ctx, fit } = attach(canvas), cells = W * H;
    const height = storage(cells * 4), flow = [storage(cells * 4), storage(cells * 4)];
    const u = uniform(32), ru = uniform(160);
    const pN = compute(NOISE), pF = compute(FLOW), pC = compute(CARVE), pS = render(SHADE);
    const gN = bind(pN, [u, height]), gF = [bind(pF, [u, height, flow[0], flow[1]]), bind(pF, [u, height, flow[1], flow[0]])], gC = [bind(pC, [u, flow[1], height]), bind(pC, [u, flow[0], height])], gS = [bind(pS, [ru, height, flow[0]]), bind(pS, [ru, height, flow[1]])];
    const tm = timer(['noise', 'flow', 'carve', 'shade'], 4);
    const pal = ['water', 'deep', 'sand', 'grass', 'forest', 'rock', 'snow'].map((k) => ({ water: [0.30, 0.52, 0.66, 1], deep: [0.12, 0.24, 0.40, 1], sand: [0.82, 0.76, 0.58, 1], grass: [0.52, 0.62, 0.36, 1], forest: [0.24, 0.40, 0.26, 1], rock: [0.48, 0.45, 0.42, 1], snow: [0.94, 0.95, 0.96, 1] })[k]);
    s = { ctx, fit, u, ru, pN, pF, pC, pS, gN, gF, gC, gS, tm, pal, cur: 0 }; status.hidden = true;
  }, frame(t, dt, now) {
    if (!s) return; s.fit(); const dev = this.__dev; const gx = Math.ceil(W / 16), gy = Math.ceil(H / 16);
    const enc = dev.createCommandEncoder();
    if (dirty) {
      dirty = false; const U = new ArrayBuffer(32), Ui = new Uint32Array(U), Uf = new Float32Array(U); Ui[0] = W; Ui[1] = H; Ui[2] = seed; Uf[4] = sea; Uf[5] = erosion / 24; dev.queue.writeBuffer(s.u, 0, U);
      let pass = enc.beginComputePass(s.tm.begin(0)); pass.setPipeline(s.pN); pass.setBindGroup(0, s.gN); pass.dispatchWorkgroups(gx, gy); pass.end();
      /* route water, carve, route again — the rivers deepen their own beds */
      const rounds = Math.max(1, Math.round(erosion / 8)); s.cur = 0;
      for (let r = 0; r < rounds; r++) {
        pass = enc.beginComputePass(s.tm.begin(1)); pass.setPipeline(s.pF); for (let k = 0; k < 10; k++) { pass.setBindGroup(0, s.gF[s.cur]); pass.dispatchWorkgroups(gx, gy); s.cur ^= 1; } pass.end();
        if (erosion > 0) { pass = enc.beginComputePass(s.tm.begin(2)); pass.setPipeline(s.pC); for (let k = 0; k < 8; k++) { pass.setBindGroup(0, s.gC[s.cur]); pass.dispatchWorkgroups(gx, gy); } pass.end(); }
      }
      pass = enc.beginComputePass(s.tm.begin(1)); pass.setPipeline(s.pF); for (let k = 0; k < 14; k++) { pass.setBindGroup(0, s.gF[s.cur]); pass.dispatchWorkgroups(gx, gy); s.cur ^= 1; } pass.end();
      $('tw-name').firstChild.textContent = NAMES[seed % NAMES.length]; $('tw-seed').textContent = 'seed ' + seed;
    }
    const R = new ArrayBuffer(160), Ri = new Uint32Array(R), Rf = new Float32Array(R); Ri[0] = W; Ri[1] = H; Rf[4] = sea; Rf[5] = now / 1000; s.pal.forEach((c, i) => Rf.set(c, 8 + i * 4)); dev.queue.writeBuffer(s.ru, 0, R);
    const rp = enc.beginRenderPass({ colorAttachments: [{ view: s.ctx.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store' }], ...s.tm.begin(3) });
    rp.setPipeline(s.pS); rp.setBindGroup(0, s.gS[s.cur]); rp.draw(3); rp.end();
    s.tm.resolve(enc); dev.queue.submit([enc.finish()]);
    const r = s.tm.read(); ['noise', 'flow', 'carve', 'shade'].forEach((n) => { if (r[n] !== undefined) $('tw-t-' + n).textContent = r[n].toFixed(2) + ' ms'; });
  } });
}
