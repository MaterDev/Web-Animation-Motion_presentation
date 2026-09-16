/* SUPERCELL · a storm that runs itself (track 013).
   From the Rock 'em Sock 'em stage "Vortex": a storm DIRECTOR swings lull → build → peak →
   crash; up to three tornadoes roam the plain, each with its own wall cloud and dust skirt;
   forked lightning fires on the storm's cadence with a flash and a shake; rain goes from
   drizzle to torrential; debris — chips by the thousand, and cows, trees, barns, hay, fence
   and fish — is lofted by the funnels' wind field and flung off the top.

   The one app on the SL-14 device that runs on vgpu. It adopts the sheet's own GPUDevice
   (initFromDevice), renders into its own targets, and hands the scene texture to ui.js.
   §1 the director — a pure function of time, so a still, a scrub and the live loop agree
   §2 the frame — debris kernel (compute), debris draw, the scene (a marched effect)
   §3 the chrome — the director's panel, and a frame cost that names its timer */
import { initFromDevice, effect, draw, compute, storage, target, texture, sampler, frame, timer, uniforms } from '../../vendor/vgpu.module.js';
import { reduced, adapterName } from './common.js';
import { MONO } from './ui.js';
import { SCENE, DEBRIS_KERNEL, DEBRIS_DRAW, GRASS } from './storm-wgsl.js';
import { spriteAtlas, SPRITE_PX, SPRITE_FRAMES } from './storm-sprites.js';
import { lensSim, MAX_DROPS, MAX_SEGS, FIELD, FILM, FADE, LENS } from './storm-lens.js';

const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v), mix = (a, b, t) => a + (b - a) * t, sstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
const hash = (n) => { let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
const CHIPS = 16384, SPRITES = 256, BLADES = 30000;
/* static scenery [kind, x, z]: horizon buildings (9–11) and the swaying middle ground —
   12 bush, 13 poplar, 14 utility pole, 15 fence, 16 hay bale */
const SCENERY = (() => {
  const a = [[9, -1.15, 4.1], [10, 0.95, 4.25], [11, -1.7, 3.8]];
  for (let k = 0; k < 44; k++) a.push([13, -0.55 + k * 0.025 + (hash(k * 5) - 0.5) * 0.01, 0.62 + (hash(k * 7) - 0.5) * 0.03]);   /* a windbreak of poplars */
  for (let k = 0; k < 60; k++) a.push([14, 0.028, 0.03 + k * 0.057]);                                                          /* a pole line up the road */
  /* a fence that curves away through the field, with most of it already gone and what is left leaning */
  for (let k = 0; k < 70; k++) { if (hash(k * 23) < 0.55) continue; const x = -0.42 + k * 0.012; a.push([15, x + (hash(k * 29) - 0.5) * 0.004, 0.09 + 1.5 * x * x + (hash(k * 31) - 0.5) * 0.01, (hash(k * 37) - 0.5) * 0.9]); }
  for (let k = 0; k < 40; k++) { const z = 0.05 + hash(k * 11) * 0.5; a.push([12, (hash(k * 13) * 2 - 1) * (z + 0.01) * 0.62, z]); }   /* bushes */
  for (let k = 0; k < 18; k++) { const z = 0.2 + hash(k * 17) * 0.8; a.push([16, (hash(k * 19) * 2 - 1) * z * 0.6, z]); }            /* hay bales */
  return a;
})();
const ND = CHIPS + SPRITES + SCENERY.length;

/* ── §1 the director ─────────────────────────────────────────────────── */
const phases = []; /* grown on demand: { id, t0, dur, tgt, s0 } */
function phaseAt(T) {
  if (!phases.length) phases.push({ id: 'lull', t0: 0, dur: 4, tgt: 0.25, s0: 0.4 });
  while (phases[phases.length - 1].t0 + phases[phases.length - 1].dur <= T) {
    const p = phases[phases.length - 1], k = phases.length, h = hash(k * 31 + 7);
    const rate = p.tgt < p.s0 ? 1.6 : 1.1, s1 = p.tgt + (p.s0 - p.tgt) * Math.exp(-p.dur * rate);
    const next = { lull: ['build', 1.4 + 1.2 * h, 1], build: ['peak', 3.0 + 3 * h, 1], peak: ['crash', 1.0 + 0.8 * h, 0.3], crash: ['lull', 1.6 + 1.4 * h, 0.4 + 0.2 * hash(k * 17 + 3)] }[p.id];
    phases.push({ id: next[0], t0: p.t0 + p.dur, dur: next[1], tgt: next[2], s0: s1 });
  }
  let lo = 0, hi = phases.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (phases[m].t0 <= T) lo = m; else hi = m - 1; }
  return phases[lo];
}
export function stormAt(T) { T = Math.max(0, T); const p = phaseAt(T), rate = p.tgt < p.s0 ? 1.6 : 1.1; return p.tgt + (p.s0 - p.tgt) * Math.exp(-(T - p.t0) * rate); }

export function director(T, aspect = 1.42, tanHalf = 0.42) {
  const storm = stormAt(T), lag = stormAt(T - 1.2), p = phaseAt(Math.max(0, T));
  const wind = (0.9 * Math.sin(T * 0.31) + 0.6 * Math.sin(T * 0.97 + 1) + 0.35 * Math.sin(T * 2.3 + 2)) * (0.5 + storm) * 1.1;
  const tors = [0, 1, 2].map((i) => {
    const th = [0, 0.3, 0.6][i], str = i === 0 ? 1 : sstep(th - 0.06, th + 0.1, lag);
    const z = 1.3 + i * 0.45 + 0.3 * Math.sin(T * 0.09 + i * 2.1);
    const lx = clamp(0.55 * Math.sin(T * 0.22 * (1 + 0.37 * i) + 1.7 * i) + 0.4 * Math.sin(T * 0.67 + 4.1 * i), -0.9, 0.9);
    const x = lx * z * tanHalf * aspect * 0.85;
    const r = 0.25 * (1 + 0.2 * Math.sin(T * 0.5 + i * 1.3) + 0.22 * storm);
    return { x, z, r, str, sway: T * 0.55 + i * 2, lean: wind * 0.1, seed: 0.11 + i * 0.37, breath: T * 0.5 + i };
  });
  return { T, storm, phase: p.id, wind, tors, rain: mix(0.2, 0.95, sstep(0.05, 0.85, storm)), tspin: 2.8 + storm * 2.4, tflow: 1.1 + storm * 1.0 };
}

/* lightning, pure: one chance per quarter second at a rate set by the storm; a second bolt at the height of it */
const SLOT = 0.25;
function lightning(T) {
  const bolts = [], k1 = Math.floor(T / SLOT); let flash = 0, shake = 0;
  for (let k = k1 - 3; k <= k1; k++) {
    if (k < 0) continue;
    for (let j = 0; j < 2; j++) {
      const t0 = k * SLOT + hash(k * 13 + j * 101) * 0.2, s = stormAt(t0), iv = mix(2.2, 0.16, clamp(s));
      if (s <= 0.2 || hash(k * 17 + j * 3 + 5) > SLOT / iv) continue;
      if (j === 1 && !(s > 0.6 && hash(k * 19 + 9) < 0.7)) continue;
      const dt = T - t0; if (dt < 0) continue;
      const a = Math.max(0, 1 - dt * 7);
      flash = Math.max(flash, (0.4 + s * 0.3) * Math.max(0, 1 - dt * 2.4));
      shake = Math.max(shake, (0.2 + s * 0.2) * Math.max(0, 1 - dt * 2.2));
      if (a > 0 && bolts.length < 4) { const bz = mix(1.2, 4.0, hash(k * 29 + j)); bolts.push([mix(-0.5, 0.5, hash(k * 23 + j)) * bz, bz, a, hash(k * 31 + j)]); }
    }
  }
  const live = bolts.length;
  while (bolts.length < 4) bolts.push([0, 0, 0, 0]);
  return { bolts, flash, shake, live };
}

export function stormApp() {
  let dev = null, ui = null, host = null, gpu = null, s = null, dead = false, err = null;
  let lensOff = false, pauseAt = null, seek = 0, steps = 64, scale = 0.5, stillDone = false, renders = 0;
  const spans = { scene: [], debris: [], drops: [], lens: [], frame: [] }; let workPending = false; let rafLast = 0, rafEMA = 0;
  const C = { ink: [0.95, 0.94, 0.90, 1], dim: [0.70, 0.70, 0.74, 1], glass: [0.08, 0.07, 0.12, 0.5], warn: [1.0, 0.82, 0.30, 1], bolt: [0.75, 0.86, 1.0, 1], red: [0.80, 0.13, 0.11, 1] };
  const q = new URLSearchParams(location.search);
  if (q.has('scale')) scale = clamp(+q.get('scale'), 0.25, 1); if (q.has('steps')) steps = Math.max(4, +q.get('steps') | 0);
  const med = (a) => { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y); return b[b.length >> 1]; };
  /* a handle for verification: pause or seek the storm, change the march's cost, read the timer */
  const api = { seek(T) { seek = T - performance.now() / 1000; pauseAt = null; }, pause(T) { pauseAt = T; }, resume() { pauseAt = null; }, steps(n) { steps = n; }, scale(v) { scale = v; }, lensOff(v) { lensOff = v; },
    spans: () => ({ frame: med(spans.frame), scene: med(spans.scene), debris: med(spans.debris), drops: med(spans.drops), lens: med(spans.lens), n: spans.scene.length, scale, steps, wet: s ? s.lens.count : 0, running: s ? s.lens.running : 0 }), director: (T) => director(T), lightning: (T) => lightning(T), get renders() { return renders; } };
  globalThis.__supercell = api;

  /* the reduced-motion still: halfway through the first peak */
  const stillT = () => { for (let T = 0; T < 600; T += 0.5) { const p = phaseAt(T); if (p.id === 'peak') return p.t0 + p.dur * 0.5; } return 30; };

  function build(g) {
    gpu = g;
    const scene = target(gpu, { size: [64, 64], format: 'rgba8unorm', label: 'supercell-scene' });
    const debrisT = target(gpu, { size: [64, 64], colors: [{ format: 'rgba8unorm' }, { format: 'r16float' }], depth: true, clearColor: [0, 0, 0, 0], label: 'supercell-debris' });
    const cam = uniforms(gpu, { pos: [0, 0.0055, -0.1], tanHalf: 0.42, fwd: [0, 0, 1], aspect: 1.42, right: [1, 0, 0], steps, up: [0, 1, 0], pxH: 600 });
    const particles = storage(gpu, ND * 32);
    const init = new Float32Array(ND * 8);
    for (let i = 0; i < ND; i++) {
      const o = i * 8;
      if (i < CHIPS + SPRITES) { init[o] = (hash(i * 3 + 1) * 2 - 1) * 2.2; init[o + 2] = 0.5 + hash(i * 5 + 2) * 3.6; init[o + 3] = i < CHIPS ? Math.floor(hash(i * 7) * 3) : 3 + Math.floor(hash(i * 11) * 6); init[o + 7] = hash(i * 13) * 6.28;
        const gale = (i >= CHIPS - 3000 && i < CHIPS) || i >= CHIPS + SPRITES - 64;
        if (gale) { const z = 0.004 + Math.pow(hash(i * 17), 1.8) * 0.45; init[o] = (hash(i * 19) * 2 - 1) * (0.02 + z * 0.8); init[o + 1] = 0.0004 + hash(i * 23) * (0.002 + z * 0.04); init[o + 2] = z; init[o + 3] += 20; } }
      else { const [kind, x, z, tilt = 0] = SCENERY[i - CHIPS - SPRITES]; init[o] = x; init[o + 2] = z; init[o + 3] = kind; init[o + 7] = tilt; }
    }
    particles.write(init);
    const atlasC = spriteAtlas();
    const atlas = texture(gpu, { kind: '2d', size: [SPRITE_PX * SPRITE_FRAMES, SPRITE_PX], format: 'rgba8unorm', usage: ['texture_binding', 'copy_dst', 'render_attachment'], label: 'supercell-sprites' });
    dev.queue.copyExternalImageToTexture({ source: atlasC }, { texture: atlas.gpu }, [SPRITE_PX * SPRITE_FRAMES, SPRITE_PX]);
    const simU = { dt: 1 / 60, time: 0, wind: 0, count: ND, t0: [0, 1.4, 0.25, 1], t1: [0, 1.9, 0.25, 0], t2: [0, 2.4, 0.25, 0], storm: 0.4, maxH: 0.3, _p0: 0, _p1: 0 };
    const kernel = compute(gpu, DEBRIS_KERNEL, { label: 'supercell-debris-kernel', set: { sim: simU, ds: particles } });
    const air = uniforms(gpu, { time: 0, wind: 0, storm: 0.4, flash: 0 });
    const grass = draw(gpu, { shader: GRASS, label: 'supercell-grass', geometry: { vertexCount: 5, topology: 'triangle-strip' }, instances: BLADES, set: { cam, air } });
    const debris = draw(gpu, { shader: DEBRIS_DRAW, label: 'supercell-debris', geometry: { vertexCount: 4, topology: 'triangle-strip' }, instances: ND, set: { cam, ds: particles, atlas, smp: sampler(gpu, { minFilter: 'nearest', magFilter: 'nearest' }), air } });
    const stV = { t0: [0, 1.4, 0.25, 1], t1: [0, 1.9, 0.25, 0], t2: [0, 2.4, 0.25, 0], s0: [0, 0, 0, 0], s1: [0, 0, 0, 0], s2: [0, 0, 0, 0], b0: [0, 0, 0, 0], b1: [0, 0, 0, 0], b2: [0, 0, 0, 0], b3: [0, 0, 0, 0], time: 0, storm: 0.4, flash: 0, wind: 0, rain: 0.2, tspin: 2.4, base: 0.62, tflow: 1 };
    const sceneFx = effect(gpu, SCENE, { label: 'supercell-scene', set: { cam, st: stV, debrisAlbedo: debrisT.colors[0], debrisDist: debrisT.colors[1] } });
    /* water on the lens, at the canvas's own resolution so its edges are crisp: a field of drops, a fading
       film of the trails they leave, and the scene seen through both */
    const fieldT = target(gpu, { size: [64, 64], format: 'rgba16float', clearColor: [0, 0, 0, 0], label: 'supercell-water' });
    const filmA = target(gpu, { size: [64, 64], format: 'rgba16float', clearColor: [0, 0, 0, 0], label: 'supercell-film-a' });
    const filmB = target(gpu, { size: [64, 64], format: 'rgba16float', clearColor: [0, 0, 0, 0], label: 'supercell-film-b' });
    const lensT = target(gpu, { size: [64, 64], format: 'rgba8unorm', label: 'supercell-lens' });
    const dropBuf = storage(gpu, MAX_DROPS * 32), segBuf = storage(gpu, MAX_SEGS * 32);
    const lensU = uniforms(gpu, { aspect: 1.42, count: 0, segs: 0, px: 0.001 });
    const add = { color: { src: 'one', dst: 'one' } };
    const fieldDraw = draw(gpu, { shader: FIELD, label: 'supercell-water-field', blend: add, geometry: { vertexCount: 4, topology: 'triangle-strip' }, instances: MAX_DROPS, set: { lens: lensU, drops: dropBuf } });
    const filmDraw = draw(gpu, { shader: FILM, label: 'supercell-water-film', blend: add, geometry: { vertexCount: 4, topology: 'triangle-strip' }, instances: MAX_SEGS, set: { lens: lensU, segs: segBuf } });
    const fadeFx = effect(gpu, FADE, { label: 'supercell-film-fade', set: { src: filmA, fade: [0.99, 0, 0, 0] } });
    const lin = sampler(gpu, { minFilter: 'linear', magFilter: 'linear' });
    const lensFx = effect(gpu, LENS, { label: 'supercell-lens', set: { scene, drops: fieldT, film: filmA, smp: lin, look: [0, 1.42, 0.001, 0.001] } });
    const sim = lensSim();
    const tm = dev.features.has('timestamp-query') ? timer(gpu) : null;
    if (tm) tm.onResults((r) => { for (const k of ['scene', 'debris', 'drops', 'lens']) if (r[k] !== undefined) { spans[k].push(r[k]); if (spans[k].length > 60) spans[k].shift(); } });
    gpu.onError && gpu.onError((e) => { err = e; console.error('supercell', e); });
    s = { scene, debrisT, fieldT, film: [filmA, filmB], lensT, dropBuf, segBuf, lensU, fieldDraw, filmDraw, fadeFx, lensFx, lens: sim, cam, air, particles, atlas, kernel, debris, grass, sceneFx, tm, sim: simU, stV, preRolled: false };
    if (host && host.invalidate) host.invalidate();
  }

  function step(T, dt, aspect) {
    const D = director(T, aspect), L = reduced.matches ? { bolts: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], flash: 0, shake: 0, live: 0 } : lightning(T);
    const tv = D.tors.map((t) => [t.x, t.z, t.r, t.str]), sv = D.tors.map((t) => [t.sway, t.lean, t.seed, t.breath]);
    Object.assign(s.sim, { dt: Math.min(dt, 1 / 30), time: T, wind: D.wind, t0: tv[0], t1: tv[1], t2: tv[2], storm: D.storm, maxH: 0.25 + D.storm * 0.2 });
    s.kernel.set({ sim: s.sim });
    Object.assign(s.stV, { t0: tv[0], t1: tv[1], t2: tv[2], s0: sv[0], s1: sv[1], s2: sv[2], b0: L.bolts[0], b1: L.bolts[1], b2: L.bolts[2], b3: L.bolts[3], time: T, storm: D.storm, flash: L.flash, wind: D.wind, rain: D.rain, tspin: D.tspin, tflow: D.tflow });
    s.sceneFx.set({ st: s.stV });
    s.air.set({ time: T, wind: D.wind, storm: D.storm, flash: L.flash });
    return { D, L };
  }

  /* the alert: a strobing banner, a ticker that never stops, and the edge of the screen pulsing red — faster as the storm peaks */
  const TICKER = 'TORNADO EMERGENCY · MULTIPLE LARGE AND EXTREMELY DANGEROUS TORNADOES ON THE GROUND · TAKE COVER NOW · MOVE TO A BASEMENT OR AN INTERIOR ROOM ON THE LOWEST FLOOR · FLYING DEBRIS WILL BE DEADLY TO THOSE CAUGHT WITHOUT SHELTER · MOBILE HOMES WILL BE DESTROYED · DO NOT WAIT · THIS IS A PARTICULARLY DANGEROUS SITUATION · SIMULATED ALERT ·   ';
  function chrome(D, readout, now, flash) {
    const T = now / 1000, rate = 1.6 + D.storm * 3.2, beat = Math.sin(T * Math.PI * 2 * rate), on = beat > 0;
    ui.text(24, 18, 'SUPERCELL', 14, C.ink, { weight: 800, track: 0.34, op: 0.9 });
    /* the red edge */
    const pulse = 0.35 + 0.65 * Math.max(0, beat);
    ui.stroke(3, 3, ui.W - 6, ui.H - 6, [1, 0.08, 0.06, 0.55 * pulse], 22, 6);
    ui.stroke(10, 10, ui.W - 20, ui.H - 20, [1, 0.1, 0.08, 0.25 * pulse], 18, 3);
    /* the banner: hazard stripes either side of the headline, strobing red on black */
    const bx = 24, by = 42, bw = 560, bh = 34;
    ui.rect(bx, by, bw, bh, on ? [0.86, 0.06, 0.05, 0.96] : [0.12, 0.02, 0.02, 0.92], 6);
    ui.clip([bx, by, 46, bh]); for (let k = -2; k < 6; k++) ui.rect(bx - 20 + k * 14 + ((T * 40) % 14), by, 7, bh, on ? [0.06, 0.02, 0.02, 1] : [1, 0.82, 0.1, 1], 0); ui.clip(null);
    ui.clip([bx + bw - 46, by, 46, bh]); for (let k = -2; k < 6; k++) ui.rect(bx + bw - 66 + k * 14 - ((T * 40) % 14), by, 7, bh, on ? [0.06, 0.02, 0.02, 1] : [1, 0.82, 0.1, 1], 0); ui.clip(null);
    ui.text(bx + bw / 2, by + 7.5, '⚠  TORNADO EMERGENCY  ·  TAKE COVER NOW  ⚠', 15, on ? [1, 1, 1, 1] : [1, 0.18, 0.12, 1], { weight: 900, track: 0.06, align: 'center' });
    /* the ticker */
    const ty = by + bh + 4, th = 20;
    ui.rect(bx, ty, bw, th, [0.03, 0.03, 0.05, 0.85], 4);
    ui.clip([bx + 6, ty, bw - 12, th]);
    const tw = ui.measure(TICKER, 10.5, { weight: 700, track: 0.04, family: MONO }), off = (T * 70) % tw;
    for (let k = 0; k < 3; k++) ui.text(bx + 6 - off + k * tw, ty + 4, TICKER, 10.5, [1, 0.86, 0.3, 1], { weight: 700, track: 0.04, family: MONO });
    ui.clip(null);
    if (flash > 0.3) ui.rect(bx, by, bw, bh, [1, 1, 1, 0.35 * flash], 6);
    readout();
  }

  return {
    init(d, h) { dev = d; host = h; ui = h.ui;
      initFromDevice(d).then((g) => { if (!dead) build(g); }).catch((e) => { err = e; console.error('supercell init', e); if (host.invalidate) host.invalidate(); }); },
    destroy() { dead = true; if (globalThis.__supercell === api) delete globalThis.__supercell; if (gpu) gpu.dispose(); s = null; gpu = null; },
    frame(t, dt, now) {
      if (!s) { const tgt = ui.prepare(scale); const enc = dev.createCommandEncoder(); const rp = enc.beginRenderPass({ colorAttachments: [{ view: tgt.view, loadOp: 'clear', clearValue: [0.07, 0.06, 0.18, 1], storeOp: 'store' }] }); rp.end();
        ui.text(24, 22, 'SUPERCELL', 14, C.ink, { weight: 800, track: 0.34 }); ui.text(24, 42, err ? 'could not start: ' + (err.message || err) : 'brewing…', 10.5, C.dim);
        ui.compose(enc); dev.queue.submit([enc.finish()]); return; }
      if (reduced.matches && stillDone) return;
      const T = reduced.matches ? stillT() : pauseAt !== null ? pauseAt : now / 1000 + seek;
      const tgt = ui.prepare(scale), aspect = tgt.w / tgt.h;
      if (s.scene.size[0] !== tgt.w || s.scene.size[1] !== tgt.h) { s.scene.resize([tgt.w, tgt.h]); s.debrisT.resize([tgt.w, tgt.h]); s.sceneFx.set({ debrisAlbedo: s.debrisT.colors[0], debrisDist: s.debrisT.colors[1] }); s.lensFx.set({ scene: s.scene }); }
      const full = [ui.canvas.width, ui.canvas.height];
      if (s.fieldT.size[0] !== full[0] || s.fieldT.size[1] !== full[1]) { for (const t of [s.fieldT, s.lensT, ...s.film]) t.resize(full); s.lensFx.set({ drops: s.fieldT }); }
      if (reduced.matches && !s.preRolled) { for (let i = 0; i < 480; i++) { step(T - (480 - i) / 60, 1 / 60, aspect); s.kernel.dispatch(Math.ceil(ND / 256)); } s.preRolled = true; }
      const { D, L } = step(T, dt, aspect);
      /* the camera: out in it — a low handheld eye in the grass, looking up at the funnels, rolling with
         the gusts, never still, and knocked sideways when lightning lands */
      const sh = L.shake, fq = Math.floor(now / 33), jx = sh > 0 ? (hash(fq) - 0.5) * sh * 0.004 : 0, jy = sh > 0 ? (hash(fq + 99) - 0.5) * sh * 0.004 : 0;
      const hand = (f, p) => Math.sin(T * f + p) * 0.6 + Math.sin(T * f * 2.37 + p * 1.7) * 0.3 + Math.sin(T * f * 5.11 + p * 2.3) * 0.1;
      const shakeAmp = 0.35 + D.storm * 0.9;
      const pos = [0.012 * Math.sin(T * 0.11) + hand(0.9, 1) * 0.00012 * shakeAmp + jx, 0.0011 + hand(1.3, 2) * 0.00008 * shakeAmp, -0.1 + 0.01 * Math.sin(T * 0.05)];
      const look = [0.05 * Math.sin(T * 0.07) + hand(0.7, 3) * 0.012 * shakeAmp + jx * 60, 0.24 + hand(0.8, 4) * 0.01 * shakeAmp + jy * 60, 2.3];
      const fv = [look[0] - pos[0], look[1] - pos[1], look[2] - pos[2]], fl = Math.hypot(...fv), fwd = fv.map((x) => x / fl);
      const rl = Math.hypot(fwd[2], fwd[0]), right0 = [fwd[2] / rl, 0, -fwd[0] / rl];
      const up0 = [fwd[1] * right0[2] - fwd[2] * right0[1], fwd[2] * right0[0] - fwd[0] * right0[2], fwd[0] * right0[1] - fwd[1] * right0[0]];
      const roll = D.wind * 0.035 + hand(0.5, 5) * 0.03 * shakeAmp + jx * 8, cr = Math.cos(roll), sr = Math.sin(roll);
      const right = right0.map((v, k) => v * cr + up0[k] * sr), up = up0.map((v, k) => v * cr - right0[k] * sr);
      s.cam.set({ pos, tanHalf: 0.5, fwd, aspect, right, steps, up, pxH: tgt.h });
      /* the drops on the lens run on wall-clock time, however the storm is scrubbed */
      if (!reduced.matches || !s.lensWet) { const n = reduced.matches ? 360 : 1; for (let i = 0; i < n; i++) s.lens.step(reduced.matches ? 1 / 30 : dt, D.rain, D.wind, aspect); s.lensWet = true; }
      s.dropBuf.write(s.lens.dropBuf); s.segBuf.write(s.lens.segBuf); s.lensU.set({ aspect, count: s.lens.count, segs: s.lens.segs, px: 1 / full[1] });
      const [filmRead, filmWrite] = s.film; s.fadeFx.set({ src: filmRead, fade: [Math.exp(-(reduced.matches ? 0 : dt) * 0.35), 0, 0, 0] });
      const frameStart = performance.now();
      if (!reduced.matches) s.kernel.dispatch(Math.ceil(ND / 256));
      frame(gpu, (f) => {
        f.pass(s.tm ? { target: s.debrisT, timer: s.tm.span('debris') } : s.debrisT, (p) => { p.draw(s.debris); p.draw(s.grass); });
        f.pass(s.tm ? { target: s.scene, timer: s.tm.span('scene') } : s.scene, s.sceneFx);
        if (!lensOff) {
          f.pass(filmWrite, (p) => { p.draw(s.fadeFx); p.draw(s.filmDraw, { instances: s.lens.segs }); });
          f.pass(s.tm ? { target: s.fieldT, timer: s.tm.span('drops') } : s.fieldT, (p) => p.draw(s.fieldDraw, { instances: s.lens.count }));
          f.pass(s.lensT, (p) => { s.lensFx.set({ film: filmWrite, look: [L.flash, aspect, 1 / full[0], 1 / full[1]] }); p.draw(s.lensFx); });
        }
      });
      if (!lensOff) s.film.reverse();
      ui.scene(lensOff ? s.scene.color.gpu : s.lensT.color.gpu);
      if (!reduced.matches) { if (rafLast) { const iv = now - rafLast; rafEMA = rafEMA ? rafEMA * 0.92 + iv * 0.08 : iv; } rafLast = now; }
      chrome(D, () => {
        const rx = 826; let l1, l2, frac = null;
        if (reduced.matches) { l1 = 'motion reduced · one still frame'; l2 = 'no frame loop is running'; }
        else if (med(spans.frame) !== null) { const fr = med(spans.frame); l1 = `GPU frame ${fr.toFixed(2)} ms of 8.3 · first submit → work done`; frac = fr / 8.33;
          l2 = s.tm && med(spans.scene) !== null ? `timestamp spans overlap on Metal · march ${med(spans.scene).toFixed(2)} · ${adapterName()} · ${tgt.w}×${tgt.h}` : `${adapterName()} · ${tgt.w}×${tgt.h}`; }
        else { l1 = `rAF interval ${rafEMA.toFixed(1)} ms — not GPU cost`; l2 = 'timestamp-query unavailable on this adapter'; }
        ui.text(rx, 22, l1, 9.5, C.ink, { family: MONO, align: 'right' }); ui.text(rx, 36, l2, 8, C.dim, { family: MONO, align: 'right' });
        if (frac !== null) { ui.rect(rx - 180, 52, 180, 3, [1, 1, 1, 0.16], 1.5); ui.rect(rx - 180, 52, 180 * clamp(frac), 3, frac > 1 ? C.red : [0.55, 0.85, 0.6, 1], 1.5); }
      }, now, L.flash);
      const enc = dev.createCommandEncoder(); ui.compose(enc); dev.queue.submit([enc.finish()]); renders++;
      /* the whole frame on the GPU: from the first submit to the queue reporting that work done. Per-pass timestamp spans
         cannot be summed on Metal — the pass after a heavy one inherits its time — so this is the number that counts. */
      if (!workPending && !reduced.matches) { workPending = true; dev.queue.onSubmittedWorkDone().then(() => { spans.frame.push(performance.now() - frameStart); if (spans.frame.length > 60) spans.frame.shift(); workPending = false; }); }
      if (reduced.matches) stillDone = true;
    }
  };
}
