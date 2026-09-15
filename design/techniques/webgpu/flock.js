/* ROOST · a game that plays itself. The murmuration from the research figure
   (atomics to bin, a scan and scatter to sort by cell, a k-nearest query
   per bird per frame) becomes the player: 131 072 starlings on the rank
   rule, an autopilot that steers the flock's centroid to whichever roost
   is lit and away from the hawk that stoops every so often. Roosts reached
   score; birds the hawk takes come off. The HUD is glass and glyphs from
   the same instance buffer as every other app. Drag on the sky to steer. */
import { TAU, hash2, storage, uniform, readback, compute, render, bind, timer, FSQ_VS } from './common.js';
import { WG, COMMON, CLEAR, BIN, SCAN, SCATTER, QUERY, RSTRUCT, PRED } from './population.js';

/* a dusk worth flying in: a low sun, lit cloud bands, a reed line and a lake that mirrors it */
const DUSK = FSQ_VS + RSTRUCT + `
@group(0) @binding(0) var<uniform> r: R;
fn hash2f(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }
fn vn(p: vec2f) -> f32 { let i = floor(p); var f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash2f(i), hash2f(i + vec2f(1, 0)), f.x), mix(hash2f(i + vec2f(0, 1)), hash2f(i + vec2f(1, 1)), f.x), f.y); }
fn fbm(p0: vec2f) -> f32 { var p = p0; var a = 0.5; var s = 0.0; for (var i = 0; i < 4; i++) { s += a * vn(p); a *= 0.5; p = p * 2.03 + vec2f(1.7, 9.2); } return s; }
fn skyAt(u: vec2f, T: f32) -> vec3f { let ar = r.world.x / r.world.y; var c = mix(vec3f(0.97, 0.76, 0.50), vec3f(0.80, 0.48, 0.46), smoothstep(0.0, 0.42, u.y)); c = mix(c, vec3f(0.30, 0.22, 0.42), smoothstep(0.35, 1.0, u.y)); c = mix(c, vec3f(0.16, 0.12, 0.28), smoothstep(0.75, 1.0, u.y));
  let sun = vec2f(0.68, 0.24); let d = length((u - sun) * vec2f(ar, 1.0)); c += vec3f(1.0, 0.85, 0.60) * (smoothstep(0.06, 0.045, d) * 1.2 + exp(-d * 6.0) * 0.55 + exp(-d * 1.6) * 0.18);
  let cl = fbm(vec2f(u.x * 3.0 * ar + T * 0.012, u.y * 14.0)); let band = smoothstep(0.50, 0.66, cl) * smoothstep(0.05, 0.2, u.y) * smoothstep(0.7, 0.35, u.y); let lit = smoothstep(0.66, 0.5, cl); c = mix(c, mix(vec3f(0.42, 0.28, 0.40), vec3f(1.0, 0.72, 0.55), lit * (1.0 - u.y)), band * 0.85);
  return c; }
@fragment fn fs(o: VO) -> @location(0) vec4f { let u = vec2f(o.uv.x, 1.0 - o.uv.y); let T = r.time; var c = skyAt(u, T);
  /* the lake at the foot: the sky upside down, dimmed and rippled; reeds on the near bank */
  let waterline = 0.11; if (u.y < waterline) { let ru = vec2f(u.x + 0.004 * sin(u.y * 180.0 + T * 1.3), waterline + (waterline - u.y) * 1.6); c = skyAt(ru, T) * 0.55 * (0.85 + 0.15 * vn(vec2f(u.x * 300.0, u.y * 60.0 - T * 2.0))); }
  let reeds = smoothstep(0.0, 0.004, (waterline - 0.005 + 0.02 * fbm(vec2f(u.x * 60.0, 0.0)) + 0.012 * step(0.6, hash2f(vec2f(floor(u.x * 400.0), 1.0))) * smoothstep(0.5, 0.0, abs(fract(u.x * 400.0) - 0.5))) - u.y) * step(waterline - 0.045, u.y); c = mix(c, vec3f(0.10, 0.07, 0.10), reeds);
  let far = smoothstep(0.0, 0.003, (waterline + 0.025 + 0.02 * fbm(vec2f(u.x * 9.0, 3.0))) - u.y) * step(waterline, u.y); c = mix(c, vec3f(0.26, 0.17, 0.28), far * 0.9);
  let px = vec2u(u32(o.p.x) % 4u, u32(o.p.y) % 4u); let bayer = array<f32, 16>(0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.); let dth = (bayer[px.y * 4u + px.x] + 0.5) / 16.0 - 0.5; c = floor(c * 64.0 + dth) / 64.0;
  return vec4f(c, 1.0); }`;
/* birds with a size and a depth of their own; the flock also leaves ink in a persistence buffer, so its turns smoke */
const GAME_BIRDS = RSTRUCT + `
@group(0) @binding(0) var<uniform> r: R;
@group(0) @binding(1) var<storage, read> pos: array<vec2f>;
@group(0) @binding(2) var<storage, read> vel: array<vec2f>;
@group(0) @binding(3) var<storage, read> ident: array<u32>;
struct VO { @builtin(position) p: vec4f, @location(0) c: vec4f };
fn hash(n: u32) -> f32 { var x = n * 747796405u + 2891336453u; x = ((x >> ((x >> 28u) + 4u)) ^ x) * 277803737u; x = (x >> 22u) ^ x; return f32(x) / 4294967295.0; }
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO {
  let p = pos[ii]; let v = vel[ii]; let id = ident[ii]; let dir = normalize(v + vec2f(1e-5, 0.0)); let side = vec2f(-dir.y, dir.x); let depth = hash(id + 3u);
  let flap = 0.45 + 0.55 * sin(r.time / 0.7 * 6.2831853 + hash(id) * 6.2831853); let s = 0.0026 * r.world.y * (0.55 + 0.9 * depth) * r.pad.x; var q = p;
  if (vi == 0u) { q = p + dir * s * 1.5; } else if (vi == 1u) { q = p - dir * s * 0.7 + side * s * 1.5 * flap; } else { q = p - dir * s * 0.7 - side * s * 1.5 * flap; }
  var o: VO; o.p = vec4f(q.x / r.world.x * 2.0 - 1.0, q.y / r.world.y * 2.0 - 1.0, 0.0, 1.0); o.c = vec4f(mix(r.bird.rgb, r.bird.rgb + vec3f(0.12, 0.06, 0.02), depth), mix(0.18, 0.75, depth) * r.pad.y); return o; }
@fragment fn fs(o: VO) -> @location(0) vec4f { return o.c; }`;
const DECAY = FSQ_VS + `
@group(0) @binding(0) var smp: sampler; @group(0) @binding(1) var src: texture_2d<f32>;
@fragment fn fs(o: VO) -> @location(0) vec4f { let c = textureSampleLevel(src, smp, o.uv + vec2f(0.0, 0.0005), 0.0); return vec4f(c.rgb, c.a * 0.90); }`;
const INK = FSQ_VS + `
@group(0) @binding(0) var smp: sampler; @group(0) @binding(1) var src: texture_2d<f32>;
@fragment fn fs(o: VO) -> @location(0) vec4f { let c = textureSampleLevel(src, smp, o.uv, 0.0); return vec4f(c.rgb, min(c.a * 0.85, 0.85)); }`;
import { ICONS, MONO } from './ui.js';

/* the roost pulls where the game says, not the world's centre; a stoop counts what it takes */
const GAME_COMMON = COMMON.replace('world: vec2f, pad1: vec2f };', 'world: vec2f, roost: vec2f };');
const GAME_QUERY = QUERY.replace(COMMON, GAME_COMMON).replace('let cp = u.world * 0.5 - p;', 'let cp = (u.roost - p) * 0.55;')
  .replace('if (dd < u.predR) { acc += d / (dd + 1e-4) * u.predF * (1.0 - dd / u.predR); } }', 'if (dd < u.predR) { acc += d / (dd + 1e-4) * u.predF * (1.0 - dd / u.predR); } if (u.pad0 == 1u && dd < u.predR * 0.22) { atomicAdd(&stats[1025u], 1u); } }');
const N = 131072, GRID = 128, WORLD = [890 / 626, 1], STATS_LEN = 1028 + 18;
const P = { k: 7, radius: 2.6 * 0.9 / Math.sqrt(N), sepR: 0.9 / Math.sqrt(N), align: 1.0, cohere: 1.5, separate: 1.6, speed: 0.24, maxForce: 1.5, predR: 0.16, predF: 6.0 };
const ROOST_MS = 1e9;

export function flockApp() {
  let dev = null, ui = null, s = null, hover = null, drag = null, wind = [0, 0], manualUntil = 0;
  let score = 0, roosts = 0, lost = 0, roost = [0.5, 0.5], roostT = 0, centroid = [WORLD[0] / 2, 0.5], stoop = { t0: -1e9, from: [0, 0], to: [0, 0], counted: false }, nextStoop = 0, flash = 0, lastRead = 0, reading = false, wave = 1;
  const C = { ink: [0.99, 0.97, 0.93, 1], dim: [0.90, 0.84, 0.82, 1], glass: [0.16, 0.08, 0.14, 0.42], acc: [0.65, 0.95, 0.88, 1], red: [1.0, 0.45, 0.35, 1] };
  const pt = (w) => [w[0] / WORLD[0] * 890, (1 - w[1] / WORLD[1]) * 626];
  const newRoost = (now) => { const a = hash2(Math.floor(now), 11) * TAU, r = 0.28 + 0.14 * hash2(Math.floor(now), 13); roost = [Math.max(0.22, Math.min(WORLD[0] - 0.30, centroid[0] + Math.cos(a) * r * 1.4)), Math.max(0.24, Math.min(0.78, centroid[1] + Math.sin(a) * r))]; roostT = now; };
  const draw = (now) => { const T = now / 1000; const auto = now > manualUntil;
    ui.text(24, 22, 'ROOST', 14, C.ink, { weight: 800, track: 0.34 }); ui.text(24, 42, 'a flock that plays itself · 131 072 starlings · rank rule, k = 7', 10.5, C.dim);
    /* the score */
    ui.glass(24, 70, 200, 96, C.glass, 20, 0.14); ui.text(42, 84, 'SCORE', 9, C.dim, { weight: 600, track: 0.18 }); ui.text(42, 98, String(score), 34, C.ink, { weight: 800, family: MONO, track: -0.03 });
    ui.text(42, 142, `ROOSTS ${roosts}`, 9, C.acc, { weight: 700, track: 0.14, family: MONO }); ui.text(132, 142, `LOST ${lost}`, 9, C.red, { weight: 700, track: 0.14, family: MONO });
    /* who is flying */
    const bw = auto ? 122 : 150; ui.glass(24, 580, bw, 26, C.glass, 13, 0.1); ui.disc(38, 593, 4, auto ? C.acc : C.red, 0.7 + 0.3 * Math.sin(T * 5)); ui.text(48, 586, auto ? 'AUTOPILOT' : "YOU'RE STEERING", 9, C.ink, { weight: 700, track: 0.16 });
    ui.text(890 - 62 - 20, 598, 'DRAG THE SKY TO STEER · LET GO TO HAND IT BACK', 8.5, C.dim, { weight: 600, track: 0.12, align: 'right', op: 0.8 });
    /* the roost, and the way there */
    const rp = pt(roost), pulse = 0.5 + 0.5 * Math.sin(T * 4); ui.ring(rp[0], rp[1], 22 + pulse * 6, [...C.acc.slice(0, 3), 0.7 - pulse * 0.4], 2); ui.ring(rp[0], rp[1], 10, C.acc, 2); ui.disc(rp[0], rp[1], 3, C.acc);
    const lw = ui.measure('ROOST', 8.5, { weight: 700, track: 0.16 }) + 16; ui.glass(rp[0] - lw / 2, rp[1] + 30, lw, 20, C.glass, 10, 0.1); ui.text(rp[0], rp[1] + 35, 'ROOST', 8.5, C.acc, { weight: 700, track: 0.16, align: 'center' });
    const cp = pt(centroid); ui.ring(cp[0], cp[1], 6, [...C.ink.slice(0, 3), 0.6], 1.2);
    /* the hawk */
    const k = (now - stoop.t0) / 2400; if (k >= 0 && k <= 1) { const w = ui.measure('HAWK', 12, { weight: 800, track: 0.3 }) + 40; ui.glass(445 - w / 2, 70, w, 34, [0.5, 0.08, 0.08, 0.6], 17, 0.12); ui.icon('hawk', 445 - w / 2 + 12, 78, 18, C.red, ICONS.spark); ui.text(445 + 8, 79, 'HAWK', 12, C.red, { weight: 800, track: 0.3, align: 'center' }); }
    if (flash > 0) { const f = flash; ui.text(cp[0], cp[1] - 40 - (1 - f) * 30, flash > 0.5 && lost && stoop.counted && now - stoop.t0 < 3000 ? '' : '', 12, C.ink); }
    if (now - roostT < 1400 && roosts > 0) { const f = 1 - (now - roostT) / 1400; ui.text(cp[0], cp[1] - 50 - (1 - f) * 40, '+100', 22, [...C.acc.slice(0, 3), f], { weight: 800, family: MONO, align: 'center' }); }
    if (stoop.counted && stoop.took > 0 && now - stoop.t0 < 4000 && now - stoop.t0 > 1300) { const f = 1 - (now - stoop.t0 - 1300) / 2700; ui.text(cp[0] + 60, cp[1] - 30 - (1 - f) * 40, '−' + stoop.took * 10, 18, [...C.red.slice(0, 3), f], { weight: 800, family: MONO, align: 'center' }); } };
  return { cursor: 'grab', init(d, host) { dev = d; ui = host.ui;
      const pipes = { clear: compute(CLEAR.replace(COMMON, GAME_COMMON)), bin: compute(BIN.replace(COMMON, GAME_COMMON)), scan: compute(SCAN.replace(COMMON, GAME_COMMON)), scatter: compute(SCATTER.replace(COMMON, GAME_COMMON)), query: compute(GAME_QUERY), sky: render(DUSK), birds: render(GAME_BIRDS, { blend: true }), ink: render(GAME_BIRDS, { blend: true }), decay: render(DECAY), blendInk: render(INK, { blend: true }), pred: render(PRED) };
      const cells = GRID * GRID * 2;
      const pos = storage(N * 8), vel = storage(N * 8), ident = storage(N * 4), posS = storage(N * 8), velS = storage(N * 8), identS = storage(N * 4), slotCell = storage(N * 8), cellInfo = storage(cells * 8), stats = storage(STATS_LEN * 4);
      const u = uniform(112), ru = uniform(128), ruInk = uniform(128); const smp = dev.createSampler({ magFilter: 'linear', minFilter: 'linear' });
      const groups = { clear: bind(pipes.clear, [u, cellInfo, stats]), bin: bind(pipes.bin, [u, pos, cellInfo, slotCell]), scan: bind(pipes.scan, [u, cellInfo]), scatter: bind(pipes.scatter, [u, pos, vel, ident, slotCell, cellInfo, posS, velS, identS]), query: bind(pipes.query, [u, posS, velS, identS, cellInfo, pos, vel, ident, stats]), sky: bind(pipes.sky, [ru]), birds: bind(pipes.birds, [ru, pos, vel, ident]), ink: bind(pipes.ink, [ruInk, pos, vel, ident]), pred: bind(pipes.pred, [ru]) };
      const p0 = new Float32Array(N * 2), v0 = new Float32Array(N * 2), id0 = new Uint32Array(N); let sd = 7; const rnd = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; };
      for (let i = 0; i < N; i++) { const a = rnd() * TAU, rr = Math.sqrt(rnd()) * 0.22; p0[i * 2] = WORLD[0] * 0.5 + Math.cos(a) * rr * 1.4; p0[i * 2 + 1] = 0.5 + Math.sin(a) * rr; const va = rnd() * TAU; v0[i * 2] = Math.cos(va) * P.speed; v0[i * 2 + 1] = Math.sin(va) * P.speed; id0[i] = i; }
      dev.queue.writeBuffer(pos, 0, p0); dev.queue.writeBuffer(vel, 0, v0); dev.queue.writeBuffer(ident, 0, id0);
      s = { pipes, groups, u, ru, ruInk, smp, trail: null, tw: 0, th: 0, bufs: [pos, vel, ident, posS, velS, identS, slotCell, cellInfo, stats, u, ru, ruInk], stats, statsRead: readback(STATS_LEN * 4), tm: timer(['bin', 'sort', 'query', 'render']) };
      const now = performance.now(); newRoost(now); nextStoop = now + 9000; },
    down(p, id) { if (!id) { drag = true; manualUntil = 1e12; } }, move(p, hov) { hover = hov; if (drag) { const w = [p.x / 890 * WORLD[0], (1 - p.y / 626)]; const d = [w[0] - centroid[0], w[1] - centroid[1]]; const l = Math.hypot(d[0], d[1]) || 1; wind = [d[0] / l, d[1] / l]; } },
    up() { if (drag) { drag = null; manualUntil = performance.now() + 2500; } }, leave() { if (drag) { drag = null; manualUntil = performance.now() + 2500; } hover = null; },
    destroy() { s.bufs.forEach((b) => b.destroy()); s.statsRead.destroy(); if (s.trail) s.trail.forEach((t) => t.destroy()); s = null; },
    frame(t, dt, now, hov) { if (!s) return; hover = hov; const T = now / 1000; const tgt = ui.prepare(0.8);
      /* the hawk: every nine seconds or so, a stoop through the flock's centroid */
      if (now > nextStoop) { const a = hash2(Math.floor(now / 100), 5) * TAU; stoop = { t0: now, from: [centroid[0] + Math.cos(a) * 0.9, centroid[1] + Math.sin(a) * 0.9], to: [centroid[0] - Math.cos(a) * 0.9, centroid[1] - Math.sin(a) * 0.9], counted: false, took: 0 }; nextStoop = now + 9000 + 4000 * hash2(Math.floor(now / 100), 9); }
      const k = (now - stoop.t0) / 2400, predOn = k >= 0 && k <= 1 ? 1 : 0, pred = predOn ? [stoop.from[0] + (stoop.to[0] - stoop.from[0]) * k, stoop.from[1] + (stoop.to[1] - stoop.from[1]) * k] : [-1, -1];
      const count = predOn && !stoop.counted && k > 0.48 ? 1 : 0;
      /* autopilot: toward the roost, away from the hawk */
      const auto = now > manualUntil; if (auto) { const d = [roost[0] - centroid[0], roost[1] - centroid[1]]; const l = Math.hypot(d[0], d[1]) || 1; let w = [d[0] / l, d[1] / l]; if (predOn) { const h = [centroid[0] - pred[0], centroid[1] - pred[1]]; const hl = Math.hypot(h[0], h[1]); if (hl < 0.3) { w = [w[0] + h[0] / hl * 2.0, w[1] + h[1] / hl * 2.0]; const wl = Math.hypot(w[0], w[1]) || 1; w = [w[0] / wl, w[1] / wl]; } } wind = w; }
      const uni = new ArrayBuffer(112), U32 = new Uint32Array(uni), F32 = new Float32Array(uni);
      U32[0] = N; U32[1] = GRID; U32[2] = 1; U32[3] = 0xffffffff; F32[4] = WORLD[1] / GRID; F32[5] = dt; F32[6] = T; F32[7] = 1.0; U32[8] = P.k; U32[9] = count; F32[10] = P.radius; F32[11] = P.sepR; F32[12] = P.align; F32[13] = P.cohere; F32[14] = P.separate; F32[15] = P.speed; F32[16] = P.maxForce; F32[17] = P.predR; F32[18] = P.predF; F32[19] = predOn; F32[20] = pred[0]; F32[21] = pred[1]; F32[22] = wind[0]; F32[23] = wind[1]; F32[24] = WORLD[0]; F32[25] = WORLD[1]; F32[26] = roost[0]; F32[27] = roost[1];
      dev.queue.writeBuffer(s.u, 0, uni);
      const runi = new ArrayBuffer(128), RF = new Float32Array(runi); RF[0] = WORLD[0]; RF[1] = WORLD[1]; RF[2] = tgt.w; RF[3] = tgt.h; RF[4] = T; RF[5] = 1; RF[6] = -1; RF[7] = predOn; RF[8] = pred[0]; RF[9] = pred[1];
      RF[10] = 1.0; RF[11] = 1.0; RF.set([0.93, 0.78, 0.62, 1], 12); RF.set([0.42, 0.36, 0.58, 1], 16); RF.set([0.10, 0.07, 0.12, 1], 20); RF.set([0.55, 0.90, 0.85, 1], 24); RF.set([1.0, 0.40, 0.35, 1], 28); dev.queue.writeBuffer(s.ru, 0, runi);
      RF[10] = 2.2; RF[11] = 0.28; RF.set([0.30, 0.16, 0.22, 1], 20); dev.queue.writeBuffer(s.ruInk, 0, runi);
      /* the persistence buffer, half the scene's size */
      const tw = Math.max(2, tgt.w >> 1), th = Math.max(2, tgt.h >> 1); if (!s.trail || s.tw !== tw || s.th !== th) { if (s.trail) s.trail.forEach((t2) => t2.destroy()); const fmt = navigator.gpu.getPreferredCanvasFormat(); s.trail = [0, 1].map(() => dev.createTexture({ size: [tw, th], format: fmt, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING })); s.tw = tw; s.th = th; s.cur = 0;
        const mk = (p, t2) => dev.createBindGroup({ layout: p.getBindGroupLayout(0), entries: [{ binding: 0, resource: s.smp }, { binding: 1, resource: t2.createView() }] }); s.gDecay = [mk(s.pipes.decay, s.trail[0]), mk(s.pipes.decay, s.trail[1])]; s.gInk = [mk(s.pipes.blendInk, s.trail[0]), mk(s.pipes.blendInk, s.trail[1])]; }
      const enc = dev.createCommandEncoder(), cells = GRID * GRID * 2, g = s.groups, pp = s.pipes, ts = (j) => s.tm.begin(j);
      let pass = enc.beginComputePass(ts(0)); pass.setPipeline(pp.clear); pass.setBindGroup(0, g.clear); pass.dispatchWorkgroups(Math.ceil(Math.max(cells, 1028) / WG)); pass.setPipeline(pp.bin); pass.setBindGroup(0, g.bin); pass.dispatchWorkgroups(Math.ceil(N / WG)); pass.end();
      pass = enc.beginComputePass(ts(1)); pass.setPipeline(pp.scan); pass.setBindGroup(0, g.scan); pass.dispatchWorkgroups(1); pass.setPipeline(pp.scatter); pass.setBindGroup(0, g.scatter); pass.dispatchWorkgroups(Math.ceil(N / WG)); pass.end();
      pass = enc.beginComputePass(ts(2)); pass.setPipeline(pp.query); pass.setBindGroup(0, g.query); pass.dispatchWorkgroups(Math.ceil(N / WG)); pass.end();
      /* ink: decay last frame's trail into the other buffer, add this frame's flock */
      const nxt = s.cur ^ 1; let tp = enc.beginRenderPass({ colorAttachments: [{ view: s.trail[nxt].createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 0 } }] }); tp.setPipeline(pp.decay); tp.setBindGroup(0, s.gDecay[s.cur]); tp.draw(3); tp.setPipeline(pp.ink); tp.setBindGroup(0, g.ink); tp.draw(3, N); tp.end(); s.cur = nxt;
      const rp = enc.beginRenderPass({ colorAttachments: [{ view: tgt.view, loadOp: 'clear', storeOp: 'store' }], ...ts(3) });
      rp.setPipeline(pp.sky); rp.setBindGroup(0, g.sky); rp.draw(3); rp.setPipeline(pp.blendInk); rp.setBindGroup(0, s.gInk[s.cur]); rp.draw(3); rp.setPipeline(pp.birds); rp.setBindGroup(0, g.birds); rp.draw(3, N); rp.setPipeline(pp.pred); rp.setBindGroup(0, g.pred); rp.draw(3); rp.end();
      s.tm.resolve(enc);
      /* the occupancy grid comes back four times a second: the centroid, and what the hawk took */
      const wantRead = (now - lastRead > 250 || count) && !reading; if (wantRead) { enc.copyBufferToBuffer(s.stats, 0, s.statsRead, 0, STATS_LEN * 4); }
      if (count) stoop.counted = true;
      draw(now); ui.compose(enc); dev.queue.submit([enc.finish()]);
      if (wantRead) { reading = true; lastRead = now; s.statsRead.mapAsync(GPUMapMode.READ).then(() => { if (!s) return; const d = new Uint32Array(s.statsRead.getMappedRange().slice(0)); s.statsRead.unmap(); reading = false;
          let sx = 0, sy = 0, n = 0; for (let i = 0; i < 1024; i++) { const c = d[i]; if (!c) continue; sx += ((i % 32) + 0.5) / 32 * WORLD[0] * c; sy += (Math.floor(i / 32) + 0.5) / 32 * WORLD[1] * c; n += c; } if (n) centroid = [sx / n, sy / n];
          if (d[1025] && count) { const took = Math.max(1, Math.round(d[1025] / 60)); stoop.took = took; lost += took; score = Math.max(0, score - took * 10); }
          if (Math.hypot(centroid[0] - roost[0], centroid[1] - roost[1]) < 0.09 && now - roostT > 1500) { roosts++; score += 100; newRoost(performance.now()); } }).catch(() => { reading = false; }); } } };
}
