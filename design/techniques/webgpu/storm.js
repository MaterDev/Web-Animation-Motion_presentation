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
import { SCENE, DEBRIS_KERNEL, DEBRIS_DRAW } from './storm-wgsl.js';
import { spriteAtlas, SPRITE_PX, SPRITE_FRAMES } from './storm-sprites.js';

const CHIPS = 8192, SPRITES = 160, SCENERY = [[9, -1.15, 4.1], [10, 0.95, 4.25], [11, -1.7, 3.8]];
const ND = CHIPS + SPRITES + SCENERY.length;
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v), mix = (a, b, t) => a + (b - a) * t, sstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
const hash = (n) => { let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };

/* ── §1 the director ─────────────────────────────────────────────────── */
const PHASE = { lull: 'Lull', build: 'Building', peak: 'Peak', crash: 'Crashing' };
const phases = []; /* grown on demand: { id, t0, dur, tgt, s0 } */
function phaseAt(T) {
  if (!phases.length) phases.push({ id: 'lull', t0: 0, dur: 4, tgt: 0.25, s0: 0.4 });
  while (phases[phases.length - 1].t0 + phases[phases.length - 1].dur <= T) {
    const p = phases[phases.length - 1], k = phases.length, h = hash(k * 31 + 7);
    const rate = p.tgt < p.s0 ? 1.1 : 0.6, s1 = p.tgt + (p.s0 - p.tgt) * Math.exp(-p.dur * rate);
    const next = { lull: ['build', 2.5 + 2 * h, 0.98], build: ['peak', 3.5 + 3 * h, 1], peak: ['crash', 1.5 + 1.3 * h, 0.12], crash: ['lull', 3.5 + 2.5 * h, 0.15 + 0.17 * hash(k * 17 + 3)] }[p.id];
    phases.push({ id: next[0], t0: p.t0 + p.dur, dur: next[1], tgt: next[2], s0: s1 });
  }
  let lo = 0, hi = phases.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (phases[m].t0 <= T) lo = m; else hi = m - 1; }
  return phases[lo];
}
export function stormAt(T) { T = Math.max(0, T); const p = phaseAt(T), rate = p.tgt < p.s0 ? 1.1 : 0.6; return p.tgt + (p.s0 - p.tgt) * Math.exp(-(T - p.t0) * rate); }

export function director(T, aspect = 1.42, tanHalf = 0.42) {
  const storm = stormAt(T), lag = stormAt(T - 1.2), p = phaseAt(Math.max(0, T));
  const wind = (0.9 * Math.sin(T * 0.23) + 0.5 * Math.sin(T * 0.61 + 1)) * (0.5 + storm) * 0.9;
  const tors = [0, 1, 2].map((i) => {
    const th = [0, 0.32, 0.66][i], str = i === 0 ? 1 : sstep(th - 0.06, th + 0.1, lag);
    const z = 1.3 + i * 0.45 + 0.3 * Math.sin(T * 0.09 + i * 2.1);
    const lx = clamp(0.55 * Math.sin(T * 0.13 * (1 + 0.37 * i) + 1.7 * i) + 0.4 * Math.sin(T * 0.41 + 4.1 * i), -0.9, 0.9);
    const x = lx * z * tanHalf * aspect * 0.85;
    const r = 0.25 * (1 + 0.2 * Math.sin(T * 0.5 + i * 1.3) + 0.22 * storm);
    return { x, z, r, str, sway: T * 0.55 + i * 2, lean: wind * 0.1, seed: 0.11 + i * 0.37, breath: T * 0.5 + i };
  });
  return { T, storm, phase: p.id, wind, tors, rain: mix(0.05, 0.75, sstep(0.05, 0.85, storm)), tspin: 2.2 + storm * 1.4, tflow: 0.9 + storm * 0.6 };
}

/* lightning, pure: one chance per quarter second at a rate set by the storm; a second bolt at the height of it */
const SLOT = 0.25;
function lightning(T) {
  const bolts = [], k1 = Math.floor(T / SLOT); let flash = 0, shake = 0;
  for (let k = k1 - 3; k <= k1; k++) {
    if (k < 0) continue;
    for (let j = 0; j < 2; j++) {
      const t0 = k * SLOT + hash(k * 13 + j * 101) * 0.2, s = stormAt(t0), iv = mix(4.5, 0.22, clamp(s));
      if (s <= 0.25 || hash(k * 17 + 5) > SLOT / iv) continue;
      if (j === 1 && !(s > 0.7 && hash(k * 19 + 9) < 0.6)) continue;
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
  let pauseAt = null, seek = 0, steps = 80, scale = 0.5, stillDone = false, renders = 0, boltCount = 0, prevLive = 0;
  const spans = { scene: [], debris: [] }; let rafLast = 0, rafEMA = 0;
  const C = { ink: [0.95, 0.94, 0.90, 1], dim: [0.70, 0.70, 0.74, 1], glass: [0.08, 0.07, 0.12, 0.5], warn: [1.0, 0.82, 0.30, 1], bolt: [0.75, 0.86, 1.0, 1], red: [0.80, 0.13, 0.11, 1] };
  const q = new URLSearchParams(location.search);
  if (q.has('scale')) scale = clamp(+q.get('scale'), 0.25, 1); if (q.has('steps')) steps = Math.max(4, +q.get('steps') | 0);
  const med = (a) => { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y); return b[b.length >> 1]; };
  /* a handle for verification: pause or seek the storm, change the march's cost, read the timer */
  const api = { seek(T) { seek = T - performance.now() / 1000; pauseAt = null; }, pause(T) { pauseAt = T; }, resume() { pauseAt = null; }, steps(n) { steps = n; }, scale(v) { scale = v; },
    spans: () => ({ scene: med(spans.scene), debris: med(spans.debris), n: spans.scene.length, scale, steps }), director: (T) => director(T), lightning: (T) => lightning(T), get renders() { return renders; } };
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
      if (i < CHIPS + SPRITES) { init[o] = (hash(i * 3 + 1) * 2 - 1) * 2.2; init[o + 2] = 0.5 + hash(i * 5 + 2) * 3.6; init[o + 3] = i < CHIPS ? Math.floor(hash(i * 7) * 3) : 3 + Math.floor(hash(i * 11) * 6); init[o + 7] = hash(i * 13) * 6.28; }
      else { const [kind, x, z] = SCENERY[i - CHIPS - SPRITES]; init[o] = x; init[o + 2] = z; init[o + 3] = kind; }
    }
    particles.write(init);
    const atlasC = spriteAtlas();
    const atlas = texture(gpu, { kind: '2d', size: [SPRITE_PX * SPRITE_FRAMES, SPRITE_PX], format: 'rgba8unorm', usage: ['texture_binding', 'copy_dst', 'render_attachment'], label: 'supercell-sprites' });
    dev.queue.copyExternalImageToTexture({ source: atlasC }, { texture: atlas.gpu }, [SPRITE_PX * SPRITE_FRAMES, SPRITE_PX]);
    const sim = { dt: 1 / 60, time: 0, wind: 0, count: ND, t0: [0, 1.4, 0.25, 1], t1: [0, 1.9, 0.25, 0], t2: [0, 2.4, 0.25, 0], storm: 0.4, maxH: 0.3, _p0: 0, _p1: 0 };
    const kernel = compute(gpu, DEBRIS_KERNEL, { label: 'supercell-debris-kernel', set: { sim, ds: particles } });
    const debris = draw(gpu, { shader: DEBRIS_DRAW, label: 'supercell-debris', geometry: { vertexCount: 4, topology: 'triangle-strip' }, instances: ND, set: { cam, ds: particles, atlas, smp: sampler(gpu, { minFilter: 'nearest', magFilter: 'nearest' }) } });
    const stV = { t0: [0, 1.4, 0.25, 1], t1: [0, 1.9, 0.25, 0], t2: [0, 2.4, 0.25, 0], s0: [0, 0, 0, 0], s1: [0, 0, 0, 0], s2: [0, 0, 0, 0], b0: [0, 0, 0, 0], b1: [0, 0, 0, 0], b2: [0, 0, 0, 0], b3: [0, 0, 0, 0], time: 0, storm: 0.4, flash: 0, wind: 0, rain: 0.2, tspin: 2.4, base: 0.62, tflow: 1 };
    const sceneFx = effect(gpu, SCENE, { label: 'supercell-scene', set: { cam, st: stV, debrisAlbedo: debrisT.colors[0], debrisDist: debrisT.colors[1] } });
    const tm = dev.features.has('timestamp-query') ? timer(gpu) : null;
    if (tm) tm.onResults((r) => { for (const k of ['scene', 'debris']) if (r[k] !== undefined) { spans[k].push(r[k]); if (spans[k].length > 60) spans[k].shift(); } });
    gpu.onError && gpu.onError((e) => { err = e; console.error('supercell', e); });
    s = { scene, debrisT, cam, particles, atlas, kernel, debris, sceneFx, tm, sim, stV, preRolled: false };
    if (host && host.invalidate) host.invalidate();
  }

  function step(T, dt, aspect) {
    const D = director(T, aspect), L = reduced.matches ? { bolts: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], flash: 0, shake: 0, live: 0 } : lightning(T);
    const tv = D.tors.map((t) => [t.x, t.z, t.r, t.str]), sv = D.tors.map((t) => [t.sway, t.lean, t.seed, t.breath]);
    Object.assign(s.sim, { dt: Math.min(dt, 1 / 30), time: T, wind: D.wind, t0: tv[0], t1: tv[1], t2: tv[2], storm: D.storm, maxH: 0.25 + D.storm * 0.2 });
    s.kernel.set({ sim: s.sim });
    Object.assign(s.stV, { t0: tv[0], t1: tv[1], t2: tv[2], s0: sv[0], s1: sv[1], s2: sv[2], b0: L.bolts[0], b1: L.bolts[1], b2: L.bolts[2], b3: L.bolts[3], time: T, storm: D.storm, flash: L.flash, wind: D.wind, rain: D.rain, tspin: D.tspin, tflow: D.tflow });
    s.sceneFx.set({ st: s.stV });
    return { D, L };
  }

  function chrome(D, readout) {
    const nAct = D.tors.filter((t) => t.str > 0.3).length, hot = D.storm > 0.66;
    ui.text(24, 22, 'SUPERCELL', 14, C.ink, { weight: 800, track: 0.34 });
    ui.text(24, 42, 'a storm that runs itself · three tornadoes at most · from the Rock ’em Sock ’em stage, rebuilt on vgpu', 10.5, C.dim);
    ui.glass(24, 70, 236, 112, C.glass, 20, 0.12);
    ui.text(42, 84, 'STORM DIRECTOR', 9, C.dim, { weight: 600, track: 0.18 });
    ui.text(42, 98, PHASE[D.phase], 22, hot ? C.warn : C.ink, { weight: 800, track: -0.02 });
    ui.rect(42, 134, 200, 4, [1, 1, 1, 0.14], 2); ui.rect(42, 134, 200 * clamp(D.storm), 4, hot ? C.warn : C.bolt, 2);
    ui.text(42, 146, `${Math.round(D.storm * 100)} % · ${nAct} tornado${nAct === 1 ? '' : 'es'} · wind ${D.wind >= 0 ? '→' : '←'} ${Math.abs(D.wind).toFixed(1)}`, 9.5, C.dim, { family: MONO });
    ui.text(42, 162, `${boltCount} bolts so far`, 9.5, C.dim, { family: MONO });
    readout();
    ui.text(24, 598, 'THE DIRECTOR SWINGS LULL → BUILD → PEAK → CRASH ON ITS OWN', 8.5, C.dim, { weight: 600, track: 0.12, op: 0.8 });
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
      if (s.scene.size[0] !== tgt.w || s.scene.size[1] !== tgt.h) { s.scene.resize([tgt.w, tgt.h]); s.debrisT.resize([tgt.w, tgt.h]); s.sceneFx.set({ debrisAlbedo: s.debrisT.colors[0], debrisDist: s.debrisT.colors[1] }); }
      if (reduced.matches && !s.preRolled) { for (let i = 0; i < 480; i++) { step(T - (480 - i) / 60, 1 / 60, aspect); s.kernel.dispatch(Math.ceil(ND / 256)); } s.preRolled = true; }
      const { D, L } = step(T, dt, aspect);
      if (L.live > prevLive) boltCount += L.live - prevLive; prevLive = L.live;
      /* the camera: a low eye on the plain, a slow drift, and a kick when lightning lands */
      const sh = L.shake, fq = Math.floor(now / 33), jx = sh > 0 ? (hash(fq) - 0.5) * sh * 0.02 : 0, jy = sh > 0 ? (hash(fq + 99) - 0.5) * sh * 0.02 : 0;
      const pos = [0.05 * Math.sin(T * 0.07) + jx, 0.0055 + jy * 0.2, -0.1], look = [0.06 * Math.sin(T * 0.05) + jx * 4, 0.16 + jy * 4, 2.3];
      const fv = [look[0] - pos[0], look[1] - pos[1], look[2] - pos[2]], fl = Math.hypot(...fv), fwd = fv.map((x) => x / fl);
      const rl = Math.hypot(fwd[2], fwd[0]), right = [fwd[2] / rl, 0, -fwd[0] / rl];
      const up = [fwd[1] * right[2] - fwd[2] * right[1], fwd[2] * right[0] - fwd[0] * right[2], fwd[0] * right[1] - fwd[1] * right[0]];
      s.cam.set({ pos, tanHalf: 0.42, fwd, aspect, right, steps, up, pxH: tgt.h });
      if (!reduced.matches) s.kernel.dispatch(Math.ceil(ND / 256));
      frame(gpu, (f) => {
        f.pass(s.tm ? { target: s.debrisT, timer: s.tm.span('debris') } : s.debrisT, s.debris);
        f.pass(s.tm ? { target: s.scene, timer: s.tm.span('scene') } : s.scene, s.sceneFx);
      });
      ui.scene(s.scene.color.gpu);
      if (!reduced.matches) { if (rafLast) { const iv = now - rafLast; rafEMA = rafEMA ? rafEMA * 0.92 + iv * 0.08 : iv; } rafLast = now; }
      chrome(D, () => {
        const rx = 826; let l1, l2, frac = null;
        if (reduced.matches) { l1 = 'motion reduced · one still frame'; l2 = 'no frame loop is running'; }
        else if (s.tm) { const sc = med(spans.scene), db = med(spans.debris); if (sc !== null) { const tot = sc + (db || 0); l1 = `GPU ${tot.toFixed(2)} ms of 8.3 · march ${sc.toFixed(2)} + debris ${(db || 0).toFixed(2)}`; frac = tot / 8.33; } else l1 = 'GPU — measuring'; l2 = `timestamp-query · ${adapterName()} · ${tgt.w}×${tgt.h}`; }
        else { l1 = `rAF interval ${rafEMA.toFixed(1)} ms — not GPU cost`; l2 = 'timestamp-query unavailable on this adapter'; }
        ui.text(rx, 22, l1, 9.5, C.ink, { family: MONO, align: 'right' }); ui.text(rx, 36, l2, 8, C.dim, { family: MONO, align: 'right' });
        if (frac !== null) { ui.rect(rx - 180, 52, 180, 3, [1, 1, 1, 0.16], 1.5); ui.rect(rx - 180, 52, 180 * clamp(frac), 3, frac > 1 ? C.red : [0.55, 0.85, 0.6, 1], 1.5); }
      });
      const enc = dev.createCommandEncoder(); ui.compose(enc); dev.queue.submit([enc.finish()]); renders++;
      if (reduced.matches) stillDone = true;
    }
  };
}
