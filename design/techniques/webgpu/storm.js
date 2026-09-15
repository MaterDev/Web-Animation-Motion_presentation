/* SUPERCELL · a tornado simulator, brought over from the Rock 'em Sock 'em
   stage "Vortex · snes-retro" (src/stages/vortex/snes-retro/Background.tsx
   in that repo — three.js WebGPU + TSL) and rebuilt here in raw WGSL so it
   stands alone: a storm DIRECTOR swings from lull to build to peak to crash;
   up to three tornado AGENTS roam a Mode-7 storm plain (wall cloud → funnel →
   ground dust), forked lightning fires on the storm's cadence, rain scales
   from drizzle to torrential, and four thousand pieces of barnyard debris are
   lofted by a wind field that reaches well past each funnel — the debris
   physics is the original's, moved from a JS loop into a compute kernel. */
import { TAU, storage, uniform, compute, render, bind, FSQ_VS } from './common.js';
import { ICONS, MONO } from './ui.js';

const HY = 0.5, K = 0.16, HSCALE = 0.12, SPRITE0 = 0.085, TORN = 3, BOLTS = 4, ND = 4096;
const rnd = (a, b) => a + Math.random() * (b - a), lerp = (a, b, f) => a + (b - a) * f, clampN = (v, a, b) => v < a ? a : v > b ? b : v, sstep = (e0, e1, x) => { const t = clampN((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const halfW = (wz, aspect) => 0.5 * wz * aspect;

const U_STRUCT = `struct U { res: vec2f, time: f32, storm: f32, flash: f32, wind: f32, aspect: f32, rain: f32, shake: vec2f, tspin: f32, tflow: f32, tors: array<vec4f, 3>, torsB: array<vec4f, 3>, bolts: array<vec4f, 4> };`;
const NOISE = `
fn hash(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }
fn vn(p: vec2f) -> f32 { let i = floor(p); var f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2f(1, 0)), f.x), mix(hash(i + vec2f(0, 1)), hash(i + vec2f(1, 1)), f.x), f.y); }
fn fbm(p0: vec2f) -> f32 { var p = p0; var a = 0.5; var s = 0.0; for (var i = 0; i < 4; i++) { s += a * vn(p); a *= 0.5; p = p * 2.03 + vec2f(1.7, 9.2); } return s; }`;
/* the plain, the sky, the funnels, the bolts and the rain, in one pass */
const STORM = FSQ_VS + U_STRUCT + NOISE + `
@group(0) @binding(0) var<uniform> u: U;
@fragment fn fs(o: VO) -> @location(0) vec4f { let p = vec2f(o.uv.x, 1.0 - o.uv.y) + u.shake; let T = u.time;
  /* ground: Mode-7 — depth from the row, a field texture from noise; the storm darkens it */
  let hd = max(HY_ - p.y, 0.0009); let depth = K_ / hd; let wx = (p.x - 0.5) * depth * u.aspect;
  let f1 = fbm(vec2f(wx * 2.2, depth * 2.2)); let rows = smoothstep(0.35, 0.65, fract(depth * 3.0 + f1 * 0.6)) * 0.12; let stubble = vn(vec2f(wx * 40.0, depth * 40.0)) * 0.08;
  var ground = mix(vec3f(0.30, 0.34, 0.20), vec3f(0.48, 0.44, 0.24), f1) * (0.85 - rows + stubble) * (0.9 - u.storm * 0.4); ground = mix(ground, vec3f(0.34, 0.38, 0.32), smoothstep(0.6, 2.6, depth));
  /* sky: three bands, scudding clouds, a slow mesocyclone overhead, a dark ceiling that grows with the storm */
  let skyT = clamp((p.y - HY_) / (1.0 - HY_), 0.0, 1.0); var sky = mix(vec3f(0.29, 0.38, 0.35), vec3f(0.17, 0.19, 0.38), smoothstep(0.0, 0.55, skyT)); sky = mix(sky, vec3f(0.07, 0.06, 0.18), smoothstep(0.45, 1.0, skyT));
  sky += vec3f(0.78, 0.82, 0.63) * smoothstep(0.22, 0.0, abs(p.y - HY_)) * 0.12;
  let cl1 = fbm(vec2f(p.x * 2.2 + T * 0.14, p.y * 1.5 - T * 0.05)); let cl2 = fbm(vec2f(p.x * 4.6 - T * 0.26, p.y * 3.0 + T * 0.08)); let clouds = smoothstep(0.42, 0.72, cl1 * 0.6 + cl2 * 0.4) * skyT * (0.3 + u.storm * 0.65); sky = mix(sky, vec3f(0.15, 0.14, 0.18), clouds);
  let cc = vec2f((p.x - 0.5) * u.aspect, p.y - 1.04); let ang = atan2(cc.y, cc.x); let rad = length(cc); let meso = fbm(vec2f(ang * 2.0 + T * 0.5 + rad * 3.0, rad * 2.5 - T * 0.2)); sky = mix(sky, vec3f(0.09, 0.08, 0.13), smoothstep(0.42, 0.7, meso) * smoothstep(1.05, 0.35, rad) * skyT * (0.25 + u.storm * 0.6));
  sky = mix(sky, vec3f(0.09, 0.08, 0.13), smoothstep(0.66, 1.0, skyT) * (0.3 + u.storm * 0.5));
  let bump = fbm(vec2f(p.x * 9.0, 0.0)); let trees = step(HY_, p.y) * step(p.y, HY_ + 0.012 + bump * 0.03); sky = mix(sky, vec3f(0.09, 0.14, 0.11), trees);
  var col = select(sky, ground, p.y < HY_);
  /* the tornadoes, back to front: a wall cloud, a swirling funnel that thins to the ground, a skirt of dust */
  for (var i = 0; i < 3; i++) { let tr = u.tors[i]; let tb = u.torsB[i]; let str = tr.w; if (str < 0.02) { continue; } let wz = tr.y; let ux = 0.5 + tr.x / (wz * u.aspect); let fy = HY_ - K_ / wz; let top = 0.81; let rw = tr.z;
    let t = clamp((p.y - fy) / (top - fy), 0.0, 1.0); let lean = u.wind * 0.06 * t * t + sin(tb.x + t * 5.0) * 0.018 * (1.0 - t) * t; let cx = ux + lean; let hw = (0.22 + 0.78 * pow(t, 0.75)) * (rw * 1.3 + 0.04) / (wz * u.aspect); let dx = (p.x - cx) / max(hw, 1e-4);
    if (p.y > fy - 0.02 && p.y < top + 0.02 && abs(dx) < 1.15) { let swirl = fbm(vec2f(dx * 2.2 + T * u.tspin * 0.5 + t * 9.0, t * 14.0 - T * u.tflow * 1.6 + f32(i) * 3.1)); let stripes = 0.5 + 0.5 * sin((dx * 1.5 + t * 16.0 - T * u.tspin * 0.8) * 3.0 + swirl * 4.0); let edge = smoothstep(1.05, 0.8, abs(dx)); let shade = 1.0 - 0.7 * dx * dx; let body = mix(vec3f(0.16, 0.15, 0.19), vec3f(0.70, 0.68, 0.64), (0.35 * swirl + 0.65 * stripes * swirl) * shade); let a = edge * str * 0.95 * smoothstep(fy - 0.02, fy + 0.02, p.y); col = mix(col, body, a); }
    let wc = vec2f((p.x - cx - lean * 0.3) / ((rw + 0.30) / (wz * u.aspect)), (p.y - (top + 0.04)) / 0.09); let wl = length(wc); let wn = fbm(vec2f(wc.x * 2.5 + T * 0.05, wc.y * 2.0 - T * 0.02 + f32(i))); let wall = smoothstep(1.0, 0.3, wl + (wn - 0.5) * 0.6) * str; col = mix(col, vec3f(0.15, 0.14, 0.18) * (0.6 + 0.6 * wn), wall);
    let bc = vec2f((p.x - ux) / (rw * 2.2 / (wz * u.aspect) + 1e-4), (p.y - fy - 0.006) / max(0.022 / wz, 0.01)); let bl = length(bc); let bn = fbm(vec2f(bc.x * 3.0 - T * 1.2, bc.y * 2.0 + T * 0.4 + f32(i))); let dust = smoothstep(1.0, 0.2, bl + (bn - 0.5) * 0.5) * str * 0.85; col = mix(col, vec3f(0.71, 0.66, 0.56) * (0.7 + 0.5 * bn), dust); }
  /* forked lightning: a jagged channel and a branch, per bolt */
  for (var i = 0; i < 4; i++) { let b = u.bolts[i]; if (b.y < 0.01) { continue; } let q = vec2f(p.x - b.x, (p.y - 0.15) / 0.8); if (q.y < 0.0 || q.y > 1.0) { continue; } let seg = floor(q.y * 11.0); let jag = (hash(vec2f(seg * 12.9 + b.z, 1.0)) - 0.5) * 0.09; let dx = abs(q.x - jag);
    let main = smoothstep(0.006, 0.0, dx); let glow = smoothstep(0.05, 0.0, dx) * 0.4; let bj = jag + (q.y - 0.6) * 0.18; let branch = smoothstep(0.004, 0.0, abs(q.x - bj)) * step(q.y, 0.62) * step(0.28, q.y);
    col += (mix(vec3f(0.7, 0.85, 1.0), vec3f(1.0), main) * (main + branch * 0.8 + glow)) * b.y * 1.4; }
  /* rain: columns of streaks, slanted by the wind, counted by the storm */
  let rx = p.x + (1.0 - p.y) * u.wind * 0.12; let colId = floor(rx * 320.0); let ph = hash(vec2f(colId, 3.0)); let sp = 2.6 + ph * 1.8; let ry = fract(p.y * 3.0 + T * sp * 0.6 + ph * 7.0); let on = step(hash(vec2f(colId, 5.0)), u.rain); let streak = smoothstep(0.80, 0.86, ry) * smoothstep(0.99, 0.95, ry) * smoothstep(0.3, 0.1, abs(fract(rx * 320.0) - 0.5)) * on;
  col = mix(col, vec3f(0.75, 0.8, 0.9), streak * 0.35);
  col = mix(col, vec3f(0.85, 0.9, 1.0), u.flash);
  return vec4f(col, 1.0); }`.replace(/HY_/g, HY.toFixed(3)).replace(/K_/g, K.toFixed(3));

/* debris: the original's wind-influence field — inward pull, a swirl that tightens toward the core, lift while in the column, gravity otherwise — one kernel */
const DEBRIS_K = U_STRUCT + `
struct D { wx: f32, wz: f32, h: f32, ang: f32, vx: f32, vz: f32, vy: f32, kind: f32 };
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read_write> ds: array<D>;
fn h1(n: u32) -> f32 { var x = n * 747796405u + 2891336453u; x = ((x >> ((x >> 28u) + 4u)) ^ x) * 277803737u; x = (x >> 22u) ^ x; return f32(x) / 4294967295.0; }
@compute @workgroup_size(256) fn main(@builtin(global_invocation_id) id: vec3u) { let i = id.x; if (i >= ${ND}u) { return; } var d = ds[i]; let dt = u.shake.x; let seed = u32(u.time * 60.0) + i * 7u;
  var lift = 0.0; for (var k = 0; k < 3; k++) { let t = u.tors[k]; if (t.w < 0.25) { continue; } let dwx = t.x - d.wx; let dwz = t.y - d.wz; let dd = sqrt(dwx * dwx + dwz * dwz) + 1e-3; let infR = t.z * 7.0 + 0.32;
    if (dd < infR) { let w = 1.0 - dd / infR; let ww = w * w * min(1.3, t.w); let nx = dwx / dd; let nz = dwz / dd; let swirl = 5.5 * (0.35 + w); let pull = 2.6; d.vx += (nx * pull - nz * swirl) * ww * dt; d.vz += (nz * pull + nx * swirl) * ww * dt; lift = max(lift, ww); } }
  if (lift > 0.04 && d.h < 2.0) { d.vy += (4.6 * lift - d.h * 0.5) * dt; } else { d.vy -= 4.4 * dt; }
  if (d.h >= 2.0 && d.vy > 0.0) { let a = h1(seed) * 6.2831853; let pw = 1.6 + 1.6 * h1(seed + 1u); d.vx = cos(a) * pw; d.vz = sin(a) * pw * 0.5; d.vy = -abs(d.vy) * 0.2; }
  d.vx += u.wind * 0.35 * dt; d.vx *= 1.0 - dt * 0.4; d.vz *= 1.0 - dt * 0.4; if (d.h < 0.04 && lift < 0.08) { d.vx *= 1.0 - dt * 2.4; d.vz *= 1.0 - dt * 2.4; }
  d.wx += d.vx * dt; d.wz += d.vz * dt; d.h += d.vy * dt; d.ang += select(-dt * 0.9 * d.ang * 0.0 + (d.vx + d.vz) * 2.0 * dt, 20.0 * dt, lift > 0.05);
  if (d.h <= 0.0) { d.h = 0.0; if (d.vy < -0.3) { d.vy *= -0.3; } else { d.vy = 0.0; } }
  let hw = 0.5 * d.wz * u.aspect; if (d.wz < 0.45 || d.wz > 2.0 || abs(d.wx) > hw * 1.3) { d.wz = 0.5 + 1.4 * h1(seed + 2u); d.wx = (h1(seed + 3u) * 2.0 - 1.0) * 0.5 * d.wz * u.aspect * 0.9; d.h = 0.0; d.vx = 0.0; d.vz = 0.0; d.vy = 0.0; d.ang = 0.0; }
  ds[i] = d; }`;
const DEBRIS_D = U_STRUCT + `
struct D { wx: f32, wz: f32, h: f32, ang: f32, vx: f32, vz: f32, vy: f32, kind: f32 };
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> ds: array<D>;
struct VO { @builtin(position) p: vec4f, @location(0) q: vec2f, @location(1) c: vec4f };
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO { let d = ds[ii]; let corner = vec2f(f32(vi & 1u), f32((vi >> 1u) & 1u)) * 2.0 - 1.0; let z = max(0.08, d.wz);
  let sy = ${HY} - ${K} / z + d.h * ${HSCALE} / z; let ox = 2.0 * d.wx / z / u.aspect; let oy = sy * 2.0 - 1.0; let kind = u32(d.kind); let sc = ${SPRITE0} / z * select(select(0.55, 0.9, kind == 1u), 0.45, kind == 2u) * 0.13;
  let ca = cos(d.ang); let sa = sin(d.ang); let sh = select(vec2f(1.0, 0.35), vec2f(1.0, 1.0), kind == 2u); let r = vec2f(corner.x * ca - corner.y * sa, corner.x * sa + corner.y * ca) * sh;
  var o: VO; o.p = vec4f(ox + r.x * sc, oy + r.y * sc * u.aspect, 0.0, 1.0); o.q = corner; let lit = 0.8 + 0.2 * clamp(d.h, 0.0, 1.0);
  o.c = select(select(vec4f(0.76, 0.62, 0.30, 0.95), vec4f(0.45, 0.30, 0.18, 0.95), kind == 1u), vec4f(0.72, 0.68, 0.58, 0.35), kind == 2u) * vec4f(vec3f(lit), 1.0); return o; }
@fragment fn fs(o: VO) -> @location(0) vec4f { if (dot(o.q, o.q) > 1.0) { discard; } return o.c; }`;

export function stormApp() {
  let dev = null, ui = null, s = null, hover = null, aspect = 890 / 626;
  const S = { storm: 0.4, stormTgt: 0.4, dir: { phase: 'lull', t: 0, dur: 4 }, wind: 0, windT: 0, flash: 0, shake: 0, lightT: 2, bolts: Array.from({ length: BOLTS }, () => ({ x: 0, a: 0, seed: 0 })), tors: Array.from({ length: TORN }, () => ({ active: false, str: 0, strTgt: 0, baseLx: 0, tgtLx: 0, lx: 0, wx: 0, wz: 1, rw: 0.09, swayPh: rnd(0, TAU), breathPh: rnd(0, TAU), wzPh: rnd(0, TAU), retT: rnd(2, 5) })), boltCount: 0 };
  const C = { ink: [0.95, 0.94, 0.90, 1], dim: [0.70, 0.70, 0.74, 1], glass: [0.08, 0.07, 0.12, 0.5], cell: [1, 1, 1, 0.1], cellHi: [1, 1, 1, 0.2], warn: [1.0, 0.82, 0.30, 1], bolt: [0.75, 0.86, 1.0, 1] };
  const fireBolt = (x, str) => { const b = S.bolts.reduce((m, b2) => (b2.a < m.a ? b2 : m), S.bolts[0]); b.x = x; b.a = 1; b.seed = Math.random() * 100; S.flash = Math.max(S.flash, 0.1 + 0.22 * str); S.shake = Math.max(S.shake, 0.18 + 0.2 * str); S.boltCount++; };
  const stir = () => { S.stormTgt = Math.min(1, S.stormTgt + 0.35); if (S.dir.phase === 'lull' || S.dir.phase === 'crash') { S.dir.phase = 'build'; S.dir.t = 0; S.dir.dur = rnd(2, 3.5); } fireBolt(rnd(0.15, 0.85), 1); };
  const draw = (now) => { const T = now / 1000; const nAct = S.tors.filter((t) => t.str > 0.3).length; const PH = { lull: 'Lull', build: 'Building', peak: 'Peak', crash: 'Crashing' };
    ui.text(24, 22, 'SUPERCELL', 14, C.ink, { weight: 800, track: 0.34 }); ui.text(24, 42, 'a storm that runs itself · three tornadoes at most · from the Rock ’em Sock ’em stage, rebuilt in raw WGSL', 10.5, C.dim);
    ui.glass(24, 70, 236, 112, C.glass, 20, 0.12); ui.text(42, 84, 'STORM DIRECTOR', 9, C.dim, { weight: 600, track: 0.18 }); ui.text(42, 98, PH[S.dir.phase], 22, S.storm > 0.66 ? C.warn : C.ink, { weight: 800, track: -0.02 });
    ui.rect(42, 134, 200, 4, [1, 1, 1, 0.14], 2); ui.rect(42, 134, 200 * clampN(S.storm, 0, 1), 4, S.storm > 0.66 ? C.warn : C.bolt, 2); ui.text(42, 146, `${Math.round(S.storm * 100)} % · ${nAct} tornado${nAct === 1 ? '' : 'es'} · wind ${S.wind >= 0 ? '→' : '←'} ${Math.abs(S.wind).toFixed(1)}`, 9.5, C.dim, { family: MONO }); ui.text(42, 162, `${S.boltCount} bolts so far`, 9.5, C.dim, { family: MONO });
    [['bolt', 'Fire a bolt', ICONS.spark], ['stir', 'Stir it up', ICONS.up]].forEach(([id, lab, ic], i) => { const x = 24 + i * 124; const hot = hover === id; ui.glass(x, 196, 116, 34, hot ? C.cellHi : C.glass, 17, 0.1); ui.icon('st' + id, x + 12, 205, 16, C.ink, ic); ui.text(x + 34, 205, lab, 11.5, C.ink, { weight: 600 }); ui.hit(id, x, 196, 116, 34); });
    ui.text(24, 598, 'THE DIRECTOR SWINGS LULL → BUILD → PEAK → CRASH ON ITS OWN', 8.5, C.dim, { weight: 600, track: 0.12, op: 0.8 }); };
  return { init(d, host) { dev = d; ui = host.ui; const u = uniform(224), uR = uniform(224), pS = render(STORM), pK = compute(DEBRIS_K), pD = render(DEBRIS_D, { blend: true, topology: 'triangle-strip' }); const buf = storage(ND * 32);
      const d0 = new Float32Array(ND * 8); for (let i = 0; i < ND; i++) { const wz = rnd(0.5, 1.9); d0[i * 8] = rnd(-1, 1) * halfW(wz, aspect) * 0.9; d0[i * 8 + 1] = wz; d0[i * 8 + 7] = i < ND * 0.45 ? 0 : i < ND * 0.65 ? 1 : 2; } dev.queue.writeBuffer(buf, 0, d0);
      s = { u, uR, pS, pK, pD, buf, gS: bind(pS, [uR]), gK: bind(pK, [u, buf]), gD: bind(pD, [uR, buf]) }; },
    move(p, hov) { hover = hov; }, up(p, id, same) { if (same && id === 'bolt') fireBolt(rnd(0.15, 0.85), Math.max(0.5, S.storm)); if (same && id === 'stir') stir(); }, leave() { hover = null; },
    destroy() { s.u.destroy(); s.uR.destroy(); s.buf.destroy(); s = null; },
    frame(t, dt, now, hov) { if (!s) return; hover = hov; const T = now / 1000; const tgt = ui.prepare(0.7); aspect = tgt.w / tgt.h;
      /* §3 the director */
      const D = S.dir; D.t += dt; if (D.t >= D.dur) { D.t = 0; if (D.phase === 'lull') { D.phase = 'build'; D.dur = rnd(2.5, 4.5); S.stormTgt = 0.98; } else if (D.phase === 'build') { D.phase = 'peak'; D.dur = rnd(3.5, 6.5); S.stormTgt = 1; } else if (D.phase === 'peak') { D.phase = 'crash'; D.dur = rnd(1.5, 2.8); S.stormTgt = 0.12; } else { D.phase = 'lull'; D.dur = rnd(3.5, 6); S.stormTgt = rnd(0.15, 0.32); } }
      S.storm += (S.stormTgt - S.storm) * Math.min(1, dt * (S.stormTgt < S.storm ? 1.1 : 0.6)); S.flash = Math.max(0, S.flash - dt * 2.4); S.shake = Math.max(0, S.shake - dt * 2.2);
      /* §6 wind */ S.windT -= dt; if (S.windT <= 0) { S.windT = rnd(2.5, 5); S.wind = clampN(S.wind + rnd(-0.6, 0.6) * (0.5 + S.storm), -1.6, 1.6); } S.wind *= 1 - dt * 0.3;
      /* §1 the agents */
      const nActive = S.storm > 0.66 ? 3 : S.storm > 0.32 ? 2 : 1;
      S.tors.forEach((tr, i) => { const want = i < nActive; if (want && !tr.active && tr.str < 0.05) { tr.active = true; tr.baseLx = rnd(-0.4, 0.4); tr.tgtLx = tr.baseLx; tr.wzPh = rnd(0, TAU); tr.lx = tr.baseLx; } tr.strTgt = want ? 1 : 0; tr.str += (tr.strTgt - tr.str) * Math.min(1, dt * 0.8); if (!want && tr.str < 0.03) tr.active = false;
        tr.retT -= dt; if (tr.retT <= 0) { tr.retT = rnd(4, 7); tr.tgtLx = rnd(-0.45, 0.45); } tr.baseLx += (tr.tgtLx - tr.baseLx) * Math.min(1, dt * 0.4); tr.swayPh += dt * 0.55; tr.breathPh += dt * 0.5; tr.wzPh += dt * 0.16;
        tr.lx = clampN(tr.baseLx + Math.sin(tr.swayPh) * 0.4, -0.9, 0.9); tr.wz = 0.9 + Math.sin(tr.wzPh + i * 2.1) * 0.28; tr.wx = tr.lx * halfW(tr.wz, aspect); tr.rw = 0.09 * (1 + 0.28 * Math.sin(tr.breathPh) + S.storm * 0.2) * clampN(tr.str, 0, 1.4); });
      /* ⚡ the cadence */ S.lightT -= dt; if (S.lightT <= 0) { S.lightT = lerp(4.5, 0.22, clampN(S.storm, 0, 1)) * rnd(0.6, 1.4); if (S.storm > 0.25) { fireBolt(rnd(0.1, 0.9), S.storm); if (S.storm > 0.7 && Math.random() < 0.6) fireBolt(rnd(0.1, 0.9), S.storm); } }
      S.bolts.forEach((b) => { b.a = Math.max(0, b.a - dt * 7); });
      const shake = S.shake > 0 ? [(Math.random() - 0.5) * 0.012 * S.shake * 4, (Math.random() - 0.5) * 0.012 * S.shake * 4] : [0, 0];
      const U = new Float32Array(56); U.set([tgt.w, tgt.h, T, S.storm, S.flash, S.wind, aspect, lerp(0.05, 0.75, sstep(0.05, 0.85, S.storm)), shake[0], shake[1], 2.2 + S.storm * 1.4, 0.9 + S.storm * 0.6]);
      const order = S.tors.map((_, i) => i).sort((a, b) => S.tors[b].wz - S.tors[a].wz); order.forEach((k, j) => { const tr = S.tors[k]; U.set([tr.wx, tr.wz, tr.rw, clampN(tr.str, 0, 1)], 12 + j * 4); U.set([tr.swayPh, 0, 0, 0], 24 + j * 4); });
      S.bolts.forEach((b, i) => U.set([b.x, b.a, b.seed, 0], 36 + i * 4));
      dev.queue.writeBuffer(s.uR, 0, U);
      /* the kernel reads the same struct with dt in the shake slot */
      const UK = new Float32Array(U); UK[8] = Math.min(dt, 1 / 30); dev.queue.writeBuffer(s.u, 0, UK);
      const enc = dev.createCommandEncoder(); const cp = enc.beginComputePass(); cp.setPipeline(s.pK); cp.setBindGroup(0, s.gK); cp.dispatchWorkgroups(Math.ceil(ND / 256)); cp.end();
      const rp = enc.beginRenderPass({ colorAttachments: [{ view: tgt.view, loadOp: 'clear', storeOp: 'store' }] }); rp.setPipeline(s.pS); rp.setBindGroup(0, s.gS); rp.draw(3); rp.setPipeline(s.pD); rp.setBindGroup(0, s.gD); rp.draw(4, ND); rp.end();
      draw(now); ui.compose(enc); dev.queue.submit([enc.finish()]); } };
}
