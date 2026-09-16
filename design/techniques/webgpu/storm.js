/* SUPERCELL · severe-weather hero graphics for a live broadcast segment (track 013).
   A fictional product. The storm is a simulation with sourced anatomy, not a real case.

   The one app on the SL-14 device that runs on vgpu: it adopts the sheet's own GPUDevice
   (initFromDevice), renders into its own targets, and hands the scene texture to ui.js,
   which draws the glass chrome over it exactly as it does for every other app.

   §1 the director — a pure function of storm time: one mesocyclone, one tornado derived
      from it, organising → mature → rope-out → dissipating, then the next cycle.
   §2 the cameras — three broadcast presets, each a slow drifting move, eased between.
   §3 the frame — debris kernel (compute), debris particles (draw), the scene (effect).
   §4 the chrome — presets, the lower third, the frame-cost readout with its instrument. */
import { initFromDevice, effect, draw, compute, storage, target, frame, timer, uniforms } from '../../vendor/vgpu.module.js';
import { reduced, adapterName } from './common.js';
import { MONO } from './ui.js';
import { SCENE, DEBRIS_KERNEL, DEBRIS_DRAW } from './storm-wgsl.js';

const ND = 4096, YD = 1760;
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v), mix = (a, b, t) => a + (b - a) * t, ease = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
const hash = (n) => { let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
const polar = (deg, r) => [Math.cos(deg * Math.PI / 180) * r, Math.sin(deg * Math.PI / 180) * r];

/* ── §1 the director ─────────────────────────────────────────────────── */
export const STAGES = [
  { id: 'organising', name: 'Organising', dur: 22, col: [0.96, 0.72, 0.28, 1] },
  { id: 'mature', name: 'Mature', dur: 34, col: [0.93, 0.30, 0.24, 1] },
  { id: 'rope-out', name: 'Rope-out', dur: 18, col: [0.95, 0.52, 0.22, 1] },
  { id: 'dissipating', name: 'Dissipating', dur: 14, col: [0.62, 0.70, 0.80, 1] },
];
export const CYCLE = STAGES.reduce((a, s) => a + s.dur, 0);
/* the storm moves north-east across the plains; the cameras move with it */
const MESO_V = polar(50, 0.06);
const SUN = (() => { const az = 288 * Math.PI / 180, el = 13 * Math.PI / 180; /* azimuth from north, clockwise: west-north-west, low */
  return [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)]; })();

export function director(T) {
  const c = Math.floor(T / CYCLE), tc = T - c * CYCLE, seed = hash(c * 7 + 3);
  const wedge = hash(c * 3 + 1) < 0.55;
  const Rg = wedge ? 0.42 + 0.1 * hash(c * 5 + 2) : 0.16 + 0.05 * hash(c * 5 + 2);
  const topM = wedge ? Rg * 1.3 + 0.05 : Rg * 1.15 + 0.05, flareM = wedge ? 1.2 : 2.2;
  let si = 0, u = tc; while (si < 3 && u >= STAGES[si].dur) { u -= STAGES[si].dur; si++; }
  const a = u / STAGES[si].dur;
  const P = { stage: si, a, cycle: c, wedge, seed, torR: 0.02, topR: 0.1, flare: 1.8, descend: 0, rope: 0, ragged: 0.95, broken: 0, wall: 0.35, slot: 0.08, core: 0.85, dust: 0, dustR: 0.12, torDeg: 135, torD: 0.5 };
  if (si === 0) {
    Object.assign(P, { wall: mix(0.35, 1, ease(a)), descend: ease((a - 0.2) / 0.8), torR: mix(0.02, 0.05, a), topR: mix(0.1, 0.22, a), dust: ease((a - 0.55) / 0.4) * 0.55, dustR: 0.12 + 0.1 * a, slot: mix(0.08, 0.3, a) });
  } else if (si === 1) {
    const g = ease(a / 0.35); const torR = mix(0.05, Rg, g);
    Object.assign(P, { wall: 1, descend: 1, torR, topR: mix(0.22, topM, g), flare: mix(1.8, flareM, g), ragged: mix(0.95, 0.35, g), dust: mix(0.55, 1, g), dustR: torR * 1.9 + 0.1, slot: mix(0.3, 0.72, a), core: 0.9, torDeg: mix(135, 145, a), torD: mix(0.5, 0.65, a) });
  } else if (si === 2) {
    const e = ease(a); const torR = mix(Rg, 0.016, ease(a / 0.6));
    Object.assign(P, { wall: mix(1, 0.7, e), descend: 1, torR, topR: mix(topM, 0.06, e), flare: mix(flareM, 4, e), rope: e, ragged: mix(0.35, 0.6, e), dust: mix(1, 0.3, e), dustR: Math.max(torR * 1.9 + 0.1, mix(Rg * 1.9 + 0.1, 0.12, e)), slot: mix(0.72, 1, e), core: 0.9, torDeg: mix(145, 170, e), torD: mix(0.65, 1.35, e) });
  } else {
    Object.assign(P, { wall: mix(0.7, 0.35, a), descend: 1 - ease((a - 0.2) / 0.6), torR: 0.016, topR: mix(0.06, 0.04, a), flare: 4, rope: 1, ragged: 0.6, broken: ease(a / 0.5), dust: 0.3 * (1 - ease(a * 1.5)), dustR: 0.12, slot: mix(1, 0.08, ease((a - 0.4) / 0.6)), core: mix(0.9, 0.85, a), torDeg: 170, torD: 1.35 });
  }
  P.tor = polar(P.torDeg, P.torD);
  P.onGround = P.descend > 0.97 && P.broken < 0.5;
  return P;
}
export const mesoAt = (T) => [MESO_V[0] * T, MESO_V[1] * T];
/* the section road the chase unit holds for a whole cycle, in world miles */
export const chaseRoad = (T) => Math.round(mesoAt(Math.floor(T / CYCLE) * CYCLE)[0] + 1.9);

/* lightning, also pure: one chance per 0.35 s slot, the rate set by the stage; a return stroke 90 ms after the first */
const RATE = [0.6, 1.5, 0.9, 0.35];
function lightning(T) {
  let flash = 0, bolt = [0, 0.8, 4], boltOn = 0, seed = 0;
  for (let k = Math.floor(T / 0.35) - 2; k <= Math.floor(T / 0.35); k++) {
    const t0 = k * 0.35 + hash(k * 13 + 1) * 0.3; const dt = T - t0; if (dt < 0 || dt > 0.6) continue;
    const P = director(t0); if (hash(k * 17 + 5) > RATE[P.stage] * 0.35) continue;
    const f = Math.exp(-dt / 0.06) + (dt > 0.09 ? 0.7 * Math.exp(-(dt - 0.09) / 0.07) : 0);
    if (f > flash) { flash = f; const [bx, bz] = [1.9 + (hash(k * 19) - 0.5) * 5.0, 4.2 + (hash(k * 23) - 0.5) * 4.2]; const cg = hash(k * 29 + 7) < 0.35;
      bolt = [bx, cg ? 0.4 : 1.1, bz]; boltOn = cg && dt < 0.22 ? 1 : 0; seed = hash(k * 31) ; }
  }
  return { flash: Math.min(flash, 1.4), bolt, boltOn, seed };
}

/* ── §2 the cameras ──────────────────────────────────────────────────── */
export const PRESETS = [
  { id: 'wide', name: 'Wide', at(T, P) { const b = -25 + 6 * Math.sin(T * 2 * Math.PI / 48); const [x, z] = polar(b, 8.2); return { pos: [x, 0.02 + 0.004 * Math.sin(T * 0.21), z], look: [-0.35, 0.34, 0.3], tanHalf: 0.16 }; } },
  /* the chase unit sits on a north-south section road south of the tornado, looking up the road at it;
     it keeps to one road for a whole cycle and drives north with the storm, and cuts to a new road between cycles */
  { id: 'chase', name: 'Chase', at(T, P) { const m = mesoAt(T), road = chaseRoad(T);
    const x = road - m[0], z = P.tor[1] - 3.2 - 0.25 * Math.sin(T * 2 * Math.PI / 40); return { pos: [x, 0.0028, z], look: [mix(x, P.tor[0], 0.55), 0.28, P.tor[1]], tanHalf: 0.30 }; } },
  { id: 'sky', name: 'Sky cam', at(T, P) { const b = -68 + 12 * Math.sin(T * 2 * Math.PI / 60); const [x, z] = polar(b, 6.6); return { pos: [x, 0.42, z], look: [0.0, 0.1, 0.4], tanHalf: 0.30 }; } },
];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
const crossV = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const lerp3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
function basis(v) { const fwd = norm(sub(v.look, v.pos)); const right = norm(crossV([0, 1, 0], fwd)); const up = crossV(fwd, right); return { fwd, right, up }; }

const fmt = (n) => Math.round(n).toLocaleString('en-US');

export function stormApp() {
  let dev = null, ui = null, host = null, gpu = null, s = null, dead = false, err = null, hover = null;
  let preset = 0, from = null, switchAt = -1e9, pauseAt = null, seek = 0, stepsFine = 64, stepsCoarse = 20, scale = 0.5;
  const spans = { scene: [], debris: [] }; let rafLast = 0, rafEMA = 0, stillKey = '', renders = 0;
  const C = { ink: [0.97, 0.96, 0.93, 1], dim: [0.72, 0.72, 0.74, 1], glass: [0.05, 0.05, 0.07, 0.52], cell: [1, 1, 1, 0.10], cellHi: [1, 1, 1, 0.22], red: [0.80, 0.13, 0.11, 1] };

  const q = new URLSearchParams(location.search);
  if (q.has('scale')) scale = clamp(+q.get('scale'), 0.25, 1); if (q.has('steps')) stepsFine = Math.max(4, +q.get('steps') | 0);
  /* a handle for verification: seek the storm, pin a preset, change the volume's cost */
  const api = { seek(T) { seek = T - (performance.now() / 1000); pauseAt = null; }, pause(T) { pauseAt = T; }, resume() { pauseAt = null; }, preset(id) { const i = PRESETS.findIndex((p) => p.id === id); if (i >= 0) choose(i, true); },
    steps(n) { stepsFine = n; }, coarse(n) { stepsCoarse = n; }, scale(v) { scale = v; }, spans: () => ({ scene: med(spans.scene), debris: med(spans.debris), n: spans.scene.length, scale, steps: stepsFine }), director, get ready() { return !!s; }, get renders() { return renders; } };
  globalThis.__supercell = api;
  const med = (a) => { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y); return b[b.length >> 1]; };

  const stormTime = (now) => { if (reduced.matches) { for (let c = 0; c < 12; c++) if (director(c * CYCLE).wedge) return c * CYCLE + STAGES[0].dur + STAGES[1].dur * 0.6; return STAGES[0].dur + 20; }
    return pauseAt !== null ? pauseAt : now / 1000 + seek; };
  const camAt = (T, P, now) => { const b = PRESETS[preset].at(T, P);
    if (from && !reduced.matches) { const k = ease((now - switchAt) / 2500); if (k < 1) { const a = PRESETS[from.i].at(T, P); return { pos: lerp3(a.pos, b.pos, k), look: lerp3(a.look, b.look, k), tanHalf: mix(a.tanHalf, b.tanHalf, k) }; } }
    return b; };
  function choose(i, cut) { if (i === preset) return; from = cut ? null : { i: preset }; preset = i; switchAt = performance.now(); if (host && host.invalidate) host.invalidate(); }

  function build(g) {
    gpu = g;
    const W = 64, H = 64;
    const scene = target(gpu, { size: [W, H], format: 'rgba8unorm', label: 'supercell-scene' });
    const debrisT = target(gpu, { size: [W, H], colors: [{ format: 'rgba8unorm' }, { format: 'r16float' }], depth: true, clearColor: [0, 0, 0, 0], label: 'supercell-debris' });
    const camU = uniforms(gpu, { pos: [0, 0, 0], tanHalf: 0.4, fwd: [0, 0, 1], aspect: 1, right: [1, 0, 0], steps: stepsFine, up: [0, 1, 0], coarse: stepsCoarse, pxH: 600, _c0: 0, _c1: 0, _c2: 0 });
    const particles = storage(gpu, ND * 32);
    const init = new Float32Array(ND * 8);
    for (let i = 0; i < ND; i++) { const a = hash(i * 3 + 1) * Math.PI * 2, r = Math.sqrt(hash(i * 5 + 2)) * 0.6; init[i * 8] = Math.cos(a) * r; init[i * 8 + 2] = Math.sin(a) * r; init[i * 8 + 3] = i < ND * 0.5 ? 0 : i < ND * 0.8 ? 1 : 2; }
    particles.write(init);
    const simVals = { dt: 1 / 60, time: 0, torR: 0.05, strength: 0, drift: [0, 0], infR: 0.4, maxH: 0.12, frame: 0, count: ND, _p0: 0, _p1: 0 };
    const kernel = compute(gpu, DEBRIS_KERNEL, { label: 'supercell-debris-kernel', set: { sim: simVals, ds: particles } });
    const debris = draw(gpu, { shader: DEBRIS_DRAW, label: 'supercell-debris', geometry: { vertexCount: 4, topology: 'triangle-strip' }, instances: ND, set: { cam: camU, view: [0, 0, 600, 40], ds: particles } });
    const stVals = { tor: [0, 0, 0], torR: 0.05, sun: SUN, flash: 0, bolt: [0, 1, 4], boltOn: 0, tilt: [0, 0], topR: 0.2, flare: 2, descend: 0, rope: 0, ragged: 0.9, spin: 0, wall: 0.5, slot: 0.1, core: 0.85, dust: 0, dustR: 0.1, base: 0.72, origin: [0, 0], time: 0, broken: 0, wedge: 0, seed: 0, poleX: 0, _s0: 0, _s1: 0, _s2: 0 };
    const sceneFx = effect(gpu, SCENE, { label: 'supercell-scene', set: { cam: camU, st: stVals, debrisAlbedo: debrisT.colors[0], debrisDist: debrisT.colors[1] } });
    const tm = dev.features.has('timestamp-query') ? timer(gpu) : null;
    if (tm) tm.onResults((r) => { for (const k of ['scene', 'debris']) if (r[k] !== undefined) { spans[k].push(r[k]); if (spans[k].length > 60) spans[k].shift(); } });
    gpu.onError && gpu.onError((e) => { err = e; console.error('supercell', e); });
    s = { scene, debrisT, camU, particles, kernel, debris, sceneFx, tm, simVals, stVals, frameN: 0, prevTor: null };
    if (host && host.invalidate) host.invalidate();
  }

  /* one step of the whole storm at storm time T */
  function step(T, dt, now, P) {
    const meso = mesoAt(T), L = lightning(T);
    const P2 = director(T - 0.05), m2 = mesoAt(T - 0.05);
    const drift = [((meso[0] + P.tor[0]) - (m2[0] + P2.tor[0])) / 0.05, ((meso[1] + P.tor[1]) - (m2[1] + P2.tor[1])) / 0.05];
    Object.assign(s.simVals, { dt: Math.min(dt, 1 / 30), time: T, torR: P.torR, strength: P.onGround ? P.dust : P.dust * 0.4, drift, infR: P.torR * 3 + 0.22, maxH: 0.05 + 0.12 * P.dust, frame: s.frameN++ });
    s.kernel.set({ sim: s.simVals });
    const wrap = (v) => ((v % 64) + 64) % 64;
    Object.assign(s.stVals, { tor: [P.tor[0], 0, P.tor[1]], torR: P.torR, flash: reduced.matches ? 0 : L.flash, bolt: L.bolt, boltOn: reduced.matches ? 0 : L.boltOn, tilt: [-P.tor[0] * 0.92, -P.tor[1] * 0.92], topR: P.topR, flare: P.flare,
      descend: P.descend, rope: P.rope, ragged: P.ragged, spin: T * 2.2, wall: P.wall, slot: P.slot, core: P.core, dust: P.dust, dustR: P.dustR, origin: [wrap(meso[0]), wrap(meso[1])], time: T, broken: P.broken, wedge: P.wedge ? 1 : 0, seed: P.seed, poleX: chaseRoad(T) - meso[0] + 0.0045 });
    s.sceneFx.set({ st: s.stVals });
    return { meso, L };
  }

  function chrome(P, readout) {
    const st = STAGES[P.stage];
    ui.text(24, 22, 'SUPERCELL', 14, C.ink, { weight: 800, track: 0.34 });
    ui.text(24, 42, 'severe-weather hero graphics · live segment package', 10.5, C.dim);
    ui.rect(24, 62, 84, 18, C.red, 4); ui.text(66, 64, 'SIMULATION', 9.5, C.ink, { weight: 800, track: 0.12, align: 'center' });
    ui.text(116, 64.5, 'not a live storm · anatomy after NWS spotter guides', 9, C.dim);
    /* camera presets, and a compass so north can be checked from any shot */
    const px = 596, py = 20, pw = 76;
    ui.glass(px - 4, py - 4, pw * 3 + 8, 42, C.glass, 21, 0.14);
    PRESETS.forEach((p, i) => { const x = px + i * pw; const on = i === preset; if (on || hover === p.id) ui.rect(x, py, pw, 34, on ? [1, 1, 1, 0.9] : C.cellHi, 17);
      ui.text(x + pw / 2, py + 9.5, p.name.toUpperCase(), 10.5, on ? [0.06, 0.06, 0.08, 1] : C.ink, { weight: 700, track: 0.1, align: 'center' }); ui.hit(p.id, x, py, pw, 34); });
    readout();
    /* the lower third */
    const lx = 24, ly = 500, lw = 800, lh = 100;
    ui.glass(lx, ly, lw, lh, C.glass, 16, 0.14);
    ui.rect(lx + 18, ly + 18, 4, 44, st.col, 2);
    ui.text(lx + 32, ly + 16, 'TORNADO · LIFECYCLE STAGE', 8.5, C.dim, { weight: 600, track: 0.16 });
    ui.text(lx + 32, ly + 30, st.name.toUpperCase() + (P.stage === 1 ? (P.wedge ? ' · WEDGE' : ' · STOVEPIPE') : ''), 24, C.ink, { weight: 800, track: 0.02 });
    STAGES.forEach((sg, i) => { const x = lx + 32 + i * 60; ui.rect(x, ly + 66, 54, 3, [1, 1, 1, 0.16], 1.5); const f = i < P.stage ? 1 : i === P.stage ? P.a : 0; if (f > 0) ui.rect(x, ly + 66, 54 * f, 3, i === P.stage ? st.col : [1, 1, 1, 0.55], 1.5); });
    const funnel = P.onGround ? `${fmt(P.torR * 2 * YD)} yd wide at the ground` : P.descend > 0.05 ? 'aloft · not yet on the ground' : 'no funnel';
    const dust = P.dust > 0.15 ? `${fmt(P.dustR * 2 * YD)} yd` : '—';
    ui.text(lx + 32, ly + 76, `Funnel ${funnel}   ·   debris cloud ${dust}`, 11, C.ink, { weight: 500 });
    const rx = lx + 520; ui.rect(rx - 16, ly + 16, 1, lh - 32, [1, 1, 1, 0.14]);
    ui.text(rx, ly + 16, 'FOR SCALE · WIDEST ON RECORD', 8.5, C.dim, { weight: 600, track: 0.16 });
    ui.text(rx, ly + 31, 'El Reno, Okla. · 31 May 2013', 13, C.ink, { weight: 700 });
    ui.text(rx, ly + 50, `2.6 mi · ${fmt(2.6 * YD)} yd maximum width`, 11, C.ink, { family: MONO });
    ui.text(rx, ly + 70, 'source · NWS Norman event summary', 8.5, C.dim, { family: MONO });
    ui.text(rx, ly + 82, 'one-mile section roads show the scale', 8.5, C.dim, { family: MONO });
  }

  return {
    init(d, h) { dev = d; host = h; ui = h.ui;
      initFromDevice(d).then((g) => { if (!dead) build(g); }).catch((e) => { err = e; console.error('supercell init', e); if (host.invalidate) host.invalidate(); }); },
    move(p, hov) { hover = hov; }, leave() { hover = null; },
    up(p, id, same) { if (!same || !id) return; const i = PRESETS.findIndex((x) => x.id === id); if (i >= 0) choose(i, reduced.matches); },
    destroy() { dead = true; if (globalThis.__supercell === api) delete globalThis.__supercell; if (gpu) gpu.dispose(); s = null; gpu = null; },
    frame(t, dt, now, hov) { hover = hov;
      if (!s) { const tgt = ui.prepare(scale); const enc = dev.createCommandEncoder(); const rp = enc.beginRenderPass({ colorAttachments: [{ view: tgt.view, loadOp: 'clear', clearValue: [0.06, 0.06, 0.07, 1], storeOp: 'store' }] }); rp.end();
        ui.text(24, 22, 'SUPERCELL', 14, C.ink, { weight: 800, track: 0.34 }); ui.text(24, 42, err ? 'could not start: ' + (err.message || err) : 'starting the storm…', 10.5, C.dim);
        ui.compose(enc); dev.queue.submit([enc.finish()]); return; }
      /* reduced motion: one composed still per preset, then nothing until something changes */
      const key = preset + '|' + scale;
      if (reduced.matches && stillKey === key) return;
      const T = stormTime(now), P = director(T);
      const tgt = ui.prepare(scale);
      if (s.scene.size[0] !== tgt.w || s.scene.size[1] !== tgt.h) { s.scene.resize([tgt.w, tgt.h]); s.debrisT.resize([tgt.w, tgt.h]); s.sceneFx.set({ debrisAlbedo: s.debrisT.colors[0], debrisDist: s.debrisT.colors[1] }); }
      if (reduced.matches && !s.preRolled) { const P0 = director(T); for (let i = 0; i < 360; i++) { step(T - (360 - i) / 60, 1 / 60, now, P0); s.kernel.dispatch(Math.ceil(ND / 256)); } s.preRolled = true; }
      step(T, reduced.matches ? 1 / 60 : dt, now, P);
      const v = camAt(T, P, now); const B = basis(v);
      s.camU.set({ pos: v.pos, tanHalf: v.tanHalf, fwd: B.fwd, aspect: tgt.w / tgt.h, right: B.right, steps: stepsFine, up: B.up, coarse: stepsCoarse, pxH: tgt.h, _c0: 0, _c1: 0, _c2: 0 });
      s.debris.set({ view: [P.tor[0], P.tor[1], tgt.h, 40] });
      if (!reduced.matches) s.kernel.dispatch(Math.ceil(ND / 256));
      frame(gpu, (f) => {
        f.pass(s.tm ? { target: s.debrisT, timer: s.tm.span('debris') } : s.debrisT, s.debris);
        f.pass(s.tm ? { target: s.scene, timer: s.tm.span('scene') } : s.scene, s.sceneFx);
      });
      ui.scene(s.scene.color.gpu);
      if (!reduced.matches) { if (rafLast) { const iv = now - rafLast; rafEMA = rafEMA ? rafEMA * 0.92 + iv * 0.08 : iv; } rafLast = now; }
      chrome(P, () => {
        const rx = 826; let line1, line2, frac = null;
        if (reduced.matches) { line1 = 'motion reduced · one still frame'; line2 = 'no frame loop is running'; }
        else if (s.tm) { const sc = med(spans.scene), db = med(spans.debris); if (sc !== null) { const tot = sc + (db || 0); line1 = `GPU ${tot.toFixed(2)} ms of 8.3 · scene ${sc.toFixed(2)} + debris ${(db || 0).toFixed(2)}`; frac = tot / 8.33; } else line1 = 'GPU — measuring'; line2 = `timestamp-query · ${adapterName()} · ${tgt.w}×${tgt.h}`; }
        else { line1 = `rAF interval ${rafEMA.toFixed(1)} ms — not GPU cost`; line2 = 'timestamp-query unavailable on this adapter'; }
        ui.text(rx, 66, line1, 9.5, C.ink, { family: MONO, align: 'right' }); ui.text(rx, 80, line2, 8, C.dim, { family: MONO, align: 'right' });
        if (frac !== null) { ui.rect(rx - 180, 96, 180, 3, [1, 1, 1, 0.16], 1.5); ui.rect(rx - 180, 96, 180 * clamp(frac), 3, frac > 1 ? C.red : [0.55, 0.85, 0.6, 1], 1.5); }
        const yaw = Math.atan2(B.fwd[0], B.fwd[2]); const cx = 572, cy = 37; ui.glassDisc(cx, cy, 17, C.glass, 0.18);
        /* the dial's up is the camera's forward; north sits at minus the camera's bearing */
        const nx = cx + Math.sin(-yaw) * 12, ny = cy - Math.cos(-yaw) * 12; ui.disc(nx, ny, 3, C.red); ui.text(cx, cy - 5.5, 'N', 9, C.ink, { weight: 800, align: 'center' });
      });
      const enc = dev.createCommandEncoder(); ui.compose(enc); dev.queue.submit([enc.finish()]); renders++;
      if (reduced.matches) stillKey = key;
    }
  };
}
