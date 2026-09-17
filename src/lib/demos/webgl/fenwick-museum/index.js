// @ts-nocheck -- sheet code from design/techniques/webgl.html §1, never typed
/* ════════════════════════════════════════════════════════════════════════
   The Fenwick · object in the round — §1 of SL-12 (webgl), the museum
   experience on its own.

   On the sheet four experiences share one stage and one renderer; this is
   the museum's program extracted with the code it runs, unchanged where it
   could be: buildMuseum, the eight-photograph comparison, the overlay's
   leads and anchors, the render-area control and the drag-to-turn hand.
   Everything visible is still a pure render(t) on a WAM clock. See NOTES.md
   for exactly what extraction changed.
   ════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { stage as makeStage } from '../../_kit/stage.js';
import { createWAM } from '../../_kit/wam.js';
import { disposer } from '../../_kit/disposer.js';
import css from './demo.css?raw';
import html from './demo.html?raw';
import gltfUrl from './assets/bust/marble_bust_01_1k.gltf?url';
import binUrl from './assets/bust/marble_bust_01.bin?url';
import diffUrl from './assets/bust/textures/marble_bust_01_diff_1k.jpg?url';
import norUrl from './assets/bust/textures/marble_bust_01_nor_gl_1k.jpg?url';
import roughUrl from './assets/bust/textures/marble_bust_01_rough_1k.jpg?url';

/* the glTF names its buffer and images relative to itself; a built app
   hashes every file, so each request is mapped to its own imported URL */
const ASSET_URLS = { 'marble_bust_01.bin': binUrl, 'marble_bust_01_diff_1k.jpg': diffUrl, 'marble_bust_01_nor_gl_1k.jpg': norUrl, 'marble_bust_01_rough_1k.jpg': roughUrl };

/** @param {HTMLElement} host */
export function mount(host) {
  const { root, $: q } = makeStage(host, { css, html });
  const WAM = createWAM({ root });
  const d = disposer();
  let gone = false;

  const $ = (id) => q(id);
  const TAU = Math.PI * 2, DEG = Math.PI / 180;
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const CLOCK_FLOOR = WAM.clockRes();

  /* ── colours: oklch tokens → linear, via canvas 2D ─────────────────── */
  const TOKEN_MISSES = [];
  const pxc = document.createElement('canvas'); pxc.width = pxc.height = 1;
  const pxx = pxc.getContext('2d', { willReadFrequently: true });
  function tokenColor(el, name) {
    let v = getComputedStyle(el).getPropertyValue(name).trim();
    if (!v) { TOKEN_MISSES.push(name); v = '#ff00ff'; }
    pxx.fillStyle = '#000'; pxx.fillRect(0, 0, 1, 1); pxx.fillStyle = v; pxx.fillRect(0, 0, 1, 1);
    const px = pxx.getImageData(0, 0, 1, 1).data;
    return new THREE.Color().setRGB(px[0] / 255, px[1] / 255, px[2] / 255, THREE.SRGBColorSpace);
  }
  const median = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
  const fmtMs = (ms) => ms < CLOCK_FLOOR * 2 ? `≤ ${(CLOCK_FLOOR * 2).toFixed(2)} ms †` : `${ms.toFixed(2)} ms`;

  const QUAD_VS = `precision highp float; in vec3 position; in vec2 uv; out vec2 v; void main(){ v = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
  const BLEND_FS = `precision highp float; in vec2 v; out vec4 o; uniform sampler2D u_a, u_b; uniform float u_f; void main(){ o = mix(texture(u_a, v), texture(u_b, v), u_f); }`;

  /* ── the renderer(s) ──────────────────────────────────────────────── */
  function makeRenderer(canvas) {
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    r.setPixelRatio(DPR); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0; r.autoClear = true;
    return r;
  }
  function fit(renderer, el) {
    const b = el.getBoundingClientRect(), w = Math.max(1, Math.round(b.width)), h = Math.max(1, Math.round(b.height));
    const c = renderer.domElement; const changed = c.width !== Math.round(w * DPR) || c.height !== Math.round(h * DPR);
    if (changed) renderer.setSize(w, h, false);
    return { w: c.width, h: c.height, changed };
  }
  const readPx = new Uint8Array(4);
  function sync(renderer) { const gl = renderer.getContext(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, readPx); }

  /* ── shared cycle ─────────────────────────────────────────────────── */
  const C_LIGHT = 41, C_CHAPTER = 17, C_LEAD = 2.3, C_YAW = 9, DUR_S = C_LIGHT * C_CHAPTER * C_YAW;

  /* ── state ────────────────────────────────────────────────────────── */
  const variant = 'museum';
  let drag = null, step = 0, rig = 'gallery';
  const rlEl = $('rl-world'), stage = $('rl-stage');
  const mainCanvas = stage.querySelector('[data-testid="rl-canvas"]'), overlay = stage.querySelector('[data-testid="rl-overlay"]');
  const leadEl = overlay.querySelector('[data-testid="rl-lead"]'), anchorEl = overlay.querySelector('[data-testid="rl-anchor"]'), leadN = overlay.querySelector('[data-testid="rl-lead-n"]'), lampMark = overlay.querySelector('[data-testid="rl-lamp-mark"]');
  const status = stage.querySelector('[data-testid="rl-status"]'), hint = stage.querySelector('[data-testid="rl-hint"]');
  const cmpCanvas = $('rl-cmp-canvas'), cmpShell = $('rl-compare');
  let R = null, RC = null, demo = null, frameN = 0; const msSamples = [];
  const EX = {};
  const fail = (m) => { status.hidden = false; status.textContent = m; };
  const productEl = (v) => $('rl-p-' + v);
  let envTex = null, gltfLoaded = null;

  /* ── experience 2 · the bust ──────────────────────────────────────── */
  function buildMuseum(gltf) {
    const el = productEl('museum');
    const scene = new THREE.Scene(); scene.background = tokenColor(el, '--rlp-well');
    const root3 = gltf.scene; scene.add(root3);
    const box = new THREE.Box3().setFromObject(root3), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const sc = 1 / size.y; root3.scale.setScalar(sc); root3.position.set(-c.x * sc, -c.y * sc, -c.z * sc);
    const meshes = []; root3.traverse((m) => { if (m.isMesh) { meshes.push(m); m.material.envMapIntensity = 0.6; } });
    const pm = new THREE.PMREMGenerator(R); scene.environment = envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
    const key = new THREE.DirectionalLight(0xffffff, 1), fill = new THREE.DirectionalLight(0xffffff, 1), rim = new THREE.DirectionalLight(0xffffff, 1);
    scene.add(key, fill, rim);
    const RIGS = {
      gallery: { key: [[1.4, 2.2, 1.6], 0xfff1dc, 2.6], fill: [[-2, 0.6, 1.2], 0xdfe8ff, 0.7], rim: [[0, 1.5, -2.5], 0xffffff, 0.8], env: 0.55, exp: 1.0 },
      daylight: { key: [[0.4, 3, 1.0], 0xf4f8ff, 3.4], fill: [[-2.5, 0.2, 1.5], 0xfff3e0, 1.0], rim: [[1, 0.5, -2.5], 0xffffff, 0.4], env: 1.1, exp: 1.05 },
      raking: { key: [[3, 0.35, 0.6], 0xffe6c4, 3.2], fill: [[-2, 0.5, 1.0], 0xc9d4ff, 0.12], rim: [[-1, 2, -2], 0xffffff, 0.25], env: 0.12, exp: 1.0 }
    };
    const applyRig = (name) => { const g = RIGS[name] || RIGS.gallery; [[key, g.key], [fill, g.fill], [rim, g.rim]].forEach(([L, dd]) => { L.position.set(dd[0][0], dd[0][1], dd[0][2]); L.color.set(dd[1]); L.intensity = dd[2]; }); meshes.forEach((m) => { m.material.envMapIntensity = g.env; }); return g.exp; };
    const cam = new THREE.PerspectiveCamera(30, 4 / 3, 0.05, 40);
    const b2 = new THREE.Box3().setFromObject(root3), sz = b2.getSize(new THREE.Vector3()), mn = b2.min;
    const at = (fx, fy, fz) => new THREE.Vector3(mn.x + sz.x * fx, mn.y + sz.y * fy, mn.z + sz.z * fz);
    const chapters = [{ yaw: 12, pitch: 8, anchor: at(0.5, 0.86, 0.82), label: '01' }, { yaw: -18, pitch: -4, anchor: at(0.5, 0.58, 0.9), label: '02' }, { yaw: 55, pitch: 6, anchor: at(0.28, 0.18, 0.66), label: '03' }];
    return {
      kind: 'mesh', scene, cam, chapters, aspect: '', hint: 'drag = turn', band: ['orbit', 'degrees of yaw about the object · the one number this page turns on'],
      prog: 'MeshStandardMaterial · normal + roughness maps · room environment', asset: 'Marble Bust 01 · Poly Haven · CC0 · 1k',
      state(T) { const s = {}; s.chapter = Math.floor(T / C_CHAPTER) % 3; s.lead = Math.min(1, (T % C_CHAPTER) / C_LEAD); s.yaw = (T / 27 % 1) * 360; s.pitch = 8 + 4 * Math.sin(TAU * T / 11);
        if (reduced.matches) { s.chapter = Math.min(step, 2); s.lead = 1; s.yaw = chapters[s.chapter].yaw; s.pitch = chapters[s.chapter].pitch; }
        if (drag) { s.yaw = drag.yaw; s.pitch = drag.pitch; } s.doto = `${((Math.round(s.yaw) % 360) + 360) % 360}°`; return s; },
      frame(s, aspect, o) { o = o || {}; cam.aspect = aspect; cam.updateProjectionMatrix(); const y = (o.yaw === undefined ? s.yaw : o.yaw) * DEG, p = s.pitch * DEG, rr = 2.3;
        cam.position.set(rr * Math.cos(p) * Math.sin(y), 0.02 + rr * Math.sin(p), rr * Math.cos(p) * Math.cos(y)); cam.lookAt(0, 0.02, 0); R.toneMappingExposure = applyRig(rig); },
      compare: { kind: 'eightlights', k: 'The same turn, two ways · fixed light', a: ['rendered', 'mesh · normal map · environment, this frame'], b: ['turntable', '8 photographs, cross-faded — the collection page without a shader'],
        cap: '<b>Left</b> is the scan, lit now. <b>Right</b> is the museum turntable as it has been shipped for twenty years: eight photographs and a cross-fade. Between stations the two neighbours are both on screen at once, so the profile doubles and the highlight on the brow slides rather than turns. The scan on the left costs one mesh and three maps; the turntable costs eight photographs per light rig per object.',
        prerender(i, s) { this.frame(s, 1.15 * 4 / 3, { yaw: i * 45 }); }, live(s) { this.frame(s, 1.15 * 4 / 3, {}); }, phase: (s) => s.yaw / 360 },
      control: { th: 'render area', rows: ['1×', '9×', '36×'], what: (n, i) => i === 0 ? '—' : `raster area × ${[1, 9, 36][i]} · same mesh, same maps, same lights`, area: [1, 3, 6] }
    };
  }

  /* ── assembling the stage ─────────────────────────────────────────── */
  function ensure() {
    if (EX.museum) return Promise.resolve(EX.museum);
    return loadGLTF().then(() => { if (gone) throw new Error('disposed'); EX.museum = buildMuseum(gltfLoaded); return EX.museum; });
  }
  function loadGLTF() {
    if (gltfLoaded) return Promise.resolve(gltfLoaded); status.hidden = false; status.textContent = 'loading the scan…';
    const manager = new THREE.LoadingManager();
    manager.setURLModifier((url) => { const name = url.split(/[?#]/)[0].split('/').pop(); return ASSET_URLS[name] || url; });
    return new Promise((res, rej) => new GLTFLoader(manager).load(gltfUrl, (g) => { gltfLoaded = g; res(g); }, undefined, rej));
  }

  const prerender = { targets: [], w: 0, h: 0, v: '' }, PRE_N = 8;
  function openVariant() {
    lastChapter = -1; prerender.v = '';
    ensure().then((ex) => {
      if (gone) return;
      stage.className = 'rl-stage ' + ex.aspect + (ex.kind === 'mesh' ? ' rl-grab' : ''); hint.textContent = ex.hint;
      $('rl-band-l').innerHTML = `<b>${ex.band[0]}</b> · ${ex.band[1]}`; $('rl-prog').textContent = ex.prog; $('rl-asset').textContent = ex.asset;
      cmpShell.hidden = !ex.compare;
      if (ex.compare) { $('rl-cmp-k').innerHTML = `<b>${ex.compare.k.split(' · ')[0]}</b>${ex.compare.k.includes(' · ') ? ' · ' + ex.compare.k.split(' · ')[1] : ''}`; $('rl-cmp-tag-a').innerHTML = `${ex.compare.a[0]}<i>${ex.compare.a[1]}</i>`; $('rl-cmp-tag-b').innerHTML = `${ex.compare.b[0]}<i>${ex.compare.b[1]}</i>`; $('rl-cmp-cap').innerHTML = ex.compare.cap; }
      const c = ex.control; $('rl-th').textContent = c.th; c.rows.forEach((r, i) => { $('rl-k-' + i).textContent = r; $('rl-w-' + i).textContent = c.what(r, i); $('rl-t-' + i).textContent = '—'; if (i) $('rl-r-' + i).textContent = '—'; });
      $('rl-guard').className = 'wg-guard wg-wait'; $('rl-guard').textContent = 'not yet run';
      status.hidden = true; msSamples.length = 0;
      instrumentMisses();
      if (demo) demo.render(demo.t);
    }).catch((e) => { if (!gone) fail('could not load: ' + e.message); });
  }
  function stateFor(ex, t) { const T = (((t % 1) + 1) % 1) * DUR_S; return ex.state(T); }

  function renderMain(ex, s, bracket) {
    const { w, h } = fit(R, stage);
    ex.frame(s, w / h, { w, h }); R.setViewport(0, 0, w, h); R.setScissorTest(false);
    let ms = -1; const t0 = bracket ? performance.now() : 0;
    R.render(ex.scene, ex.cam);
    if (bracket) { sync(R); ms = performance.now() - t0; }
    return ms;
  }
  let blendMat = null, blendScene = null, blendCam = null;
  function blendQuad() {
    if (blendMat) return; blendMat = new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: QUAD_VS, fragmentShader: BLEND_FS, uniforms: { u_a: { value: null }, u_b: { value: null }, u_f: { value: 0 } }, depthTest: false });
    blendScene = new THREE.Scene(); blendScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blendMat)); blendCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }
  function renderCompare(ex, s) {
    if (!ex.compare) return;
    const { w: W, h: H } = fit(RC, $('rl-cmp-stage')); const w = W >> 1, h = H; if (w < 2) return;
    const cp = ex.compare;
    blendQuad();
    if (prerender.v !== variant || prerender.w !== w || prerender.h !== h) {
      prerender.targets.forEach((t) => t.dispose()); prerender.targets = [];
      for (let i = 0; i < PRE_N; i++) { const rt = new THREE.WebGLRenderTarget(w, h, { depthBuffer: true }); cp.prerender.call(ex, i, s); RC.setRenderTarget(rt); RC.setViewport(0, 0, w, h); RC.setScissorTest(false); RC.render(ex.scene, ex.cam); prerender.targets.push(rt); }
      RC.setRenderTarget(null); prerender.v = variant; prerender.w = w; prerender.h = h;
    }
    cp.live.call(ex, s); RC.setViewport(0, 0, w, h); RC.setScissor(0, 0, w, h); RC.setScissorTest(true); RC.render(ex.scene, ex.cam);
    const u = ((cp.phase(s) % 1) + 1) % 1 * PRE_N, a = Math.floor(u) % PRE_N, b = (a + 1) % PRE_N;
    blendMat.uniforms.u_a.value = prerender.targets[a].texture; blendMat.uniforms.u_b.value = prerender.targets[b].texture; blendMat.uniforms.u_f.value = u - Math.floor(u);
    RC.setViewport(w, 0, w, h); RC.setScissor(w, 0, w, h); RC.autoClear = false; RC.render(blendScene, blendCam); RC.autoClear = true; RC.setScissorTest(false);
  }
  let lastChapter = -1;
  const v3 = new THREE.Vector3();
  function renderOverlay(ex, s) {
    const r = stage.getBoundingClientRect(), W = r.width, Hh = r.height;
    overlay.setAttribute('viewBox', `0 0 ${W} ${Hh}`);
    const ch = ex.chapters[s.chapter];
    if (!ch) { leadEl.setAttribute('points', ''); anchorEl.setAttribute('r', 0); leadN.textContent = ''; lampMark.setAttribute('r', 0); return; }
    v3.copy(ch.anchor).project(ex.cam); const ax = (v3.x * 0.5 + 0.5) * W, ay = (0.5 - v3.y * 0.5) * Hh;
    const dir = ax > W * 0.55 ? -1 : 1, lx = ax + dir * 74, ly = ay - 46, ex2 = lx + dir * 18, L = s.lead;
    const p1 = [ax + (lx - ax) * Math.min(1, L * 1.6), ay + (ly - ay) * Math.min(1, L * 1.6)];
    let pts = `${ax},${ay} ${p1[0]},${p1[1]}`; if (L > 0.625) pts += ` ${lx + (ex2 - lx) * (L - 0.625) / 0.375},${ly}`;
    leadEl.setAttribute('points', pts); anchorEl.setAttribute('cx', ax); anchorEl.setAttribute('cy', ay); anchorEl.setAttribute('r', 4 + 4 * Math.min(1, L * 3));
    leadN.setAttribute('x', dir > 0 ? ex2 + 6 : ex2 - 6); leadN.setAttribute('y', ly + 3.5); leadN.setAttribute('text-anchor', dir > 0 ? 'start' : 'end'); leadN.textContent = L >= 1 ? ch.label : '';
    lampMark.setAttribute('r', 0);
    if (s.chapter !== lastChapter) { lastChapter = s.chapter; root.querySelectorAll(`[data-chapters="${variant}"] .rl-ch`).forEach((b) => b.classList.toggle('rl-on', +b.dataset.ch === s.chapter)); }
  }
  const azDot = $('rl-azimuth-dot'), msEl = $('rl-ms'); let lastDoto = '';
  function render(t) {
    const ex = EX[variant]; if (!ex || gone) return;
    const s = stateFor(ex, t); frameN++;
    const bracket = (frameN % 12 === 0) || reduced.matches;
    const ms = renderMain(ex, s, bracket);
    if (ms >= 0) { msSamples.push(ms); if (msSamples.length > 8) msSamples.shift(); msEl.textContent = fmtMs(median(msSamples)) + (msSamples.length < 8 ? ' ·' : ''); }
    renderCompare(ex, s); renderOverlay(ex, s);
    if (s.doto !== lastDoto) { lastDoto = s.doto; azDot.textContent = s.doto; }
  }

  /* ── the control ──────────────────────────────────────────────────── */
  const guard = $('rl-guard'), runBtn = $('rl-run-control');
  function runControl() {
    const ex = EX[variant]; if (!ex) return;
    runBtn.disabled = true; guard.className = 'wg-guard wg-wait'; guard.textContent = 'running…';
    const s0 = stateFor(ex, demo ? demo.t : 0), c = ex.control, res = [];
    const { w, h } = fit(R, stage);
    c.rows.forEach((row, i) => {
      const m = c.area[i], rt = new THREE.WebGLRenderTarget(w * m, h * m, { depthBuffer: true }); ex.frame(s0, w / h, { w: w * m, h: h * m });
      const draw = () => { R.setRenderTarget(rt); R.setViewport(0, 0, w * m, h * m); R.render(ex.scene, ex.cam); R.readRenderTargetPixels(rt, 0, 0, 1, 1, readPx); R.setRenderTarget(null); };
      for (let k = 0; k < 3; k++) draw();          /* area rows sync on their target inside draw() */
      const xs = []; for (let k = 0; k < 9; k++) { const t0 = performance.now(); draw(); xs.push(performance.now() - t0); }
      res.push(median(xs)); rt.dispose();
    });
    res.forEach((ms, i) => { $('rl-t-' + i).textContent = fmtMs(ms); if (i) $('rl-r-' + i).textContent = (ms / Math.max(res[0], CLOCK_FLOOR)).toFixed(2) + '×'; });
    const moved = res[2] - res[0];
    if (res[0] < CLOCK_FLOOR * 2 && res[2] < CLOCK_FLOOR * 2) { guard.className = 'wg-guard wg-bad'; guard.textContent = 'every row is under the floor — this clock cannot see this work; the readings are bounds'; }
    else if (moved > CLOCK_FLOOR * 2 && res[2] > res[0] * 1.8) { guard.className = 'wg-guard wg-ok'; guard.textContent = `reading follows the ${c.th}: +${moved.toFixed(2)} ms at the last row — the bracket is closing on the work`; }
    else { guard.className = 'wg-guard wg-bad'; guard.textContent = `reading did not follow the ${c.th} (+${moved.toFixed(2)} ms) — the bracket is closing on submission, not work`; }
    runBtn.disabled = false;
  }
  function instrumentPlate() {
    const fl = CLOCK_FLOOR < 1 ? (CLOCK_FLOOR * 1000).toFixed(0) + ' µs' : CLOCK_FLOOR.toFixed(2) + ' ms';
    $('rl-floor').textContent = fl; $('rl-bench-floor').textContent = fl;
  }
  let missesShown = false;
  function instrumentMisses() {
    if (!TOKEN_MISSES.length || missesShown) return; missesShown = true;
    $('rl-bench-instr').insertAdjacentHTML('beforeend', ` <b style="color:var(--signal)">${TOKEN_MISSES.length} token(s) did not resolve: ${TOKEN_MISSES.join(', ')}</b>`);
  }

  /* ── the viewer's hand ────────────────────────────────────────────── */
  d.on(stage, 'pointermove', (e) => {
    const ex = EX[variant]; if (!ex) return;
    if (drag && drag.on) { drag.yaw = drag.yaw0 + (e.clientX - drag.x0) * 0.6; drag.pitch = Math.max(-30, Math.min(60, drag.pitch0 - (e.clientY - drag.y0) * 0.3)); }
    if (demo && !demo.playing) demo.render(demo.t);
  });
  d.on(stage, 'pointerdown', (e) => { const ex = EX[variant]; if (!ex) return; const s = stateFor(ex, demo ? demo.t : 0); drag = { on: true, x0: e.clientX, y0: e.clientY, yaw0: s.yaw, pitch0: s.pitch, yaw: s.yaw, pitch: s.pitch }; stage.setPointerCapture(e.pointerId); });
  d.on(stage, 'pointerup', () => { if (drag) drag.on = false; });
  d.on(stage, 'pointerleave', () => { if (drag && !drag.on) drag = null; if (demo && !demo.playing) demo.render(demo.t); });
  root.querySelectorAll('.rl-ch').forEach((b) => d.on(b, 'click', () => {
    const k = +b.dataset.ch, ex = EX[variant]; if (!ex) return;
    if (reduced.matches) { step = k; demo && demo.render(demo.t); return; }
    if (!demo) return; const nch = ex.chapters.length, T = demo.t * DUR_S, cyc = Math.floor(T / (C_CHAPTER * nch)) * C_CHAPTER * nch; let target = cyc + k * C_CHAPTER; if (target <= T) target += C_CHAPTER * nch;
    demo.seek((target % DUR_S) / DUR_S); demo.play();
  }));
  root.querySelectorAll('.rlp-opts[data-opt]').forEach((group) => group.querySelectorAll('.rlp-opt').forEach((b) => d.on(b, 'click', () => {
    group.querySelectorAll('.rlp-opt').forEach((o) => o.classList.toggle('rl-on', o === b));
    if (group.dataset.opt === 'rig') rig = b.dataset.val;
    prerender.v = ''; demo && !demo.playing && demo.render(demo.t);
  })));
  ['rl-museum-visit', 'rl-museum-save'].forEach((id) => {
    const b = $(id); if (!b) return; const was = b.textContent;
    d.on(b, 'click', () => { b.classList.toggle('rl-on'); b.textContent = b.classList.contains('rl-on') ? was.replace(/^(Plan a visit|Save to my collection)$/, (m) => ({ 'Plan a visit': 'Sat 19 Sep, 11:00 ✓', 'Save to my collection': 'Saved ✓' })[m]) : was; });
  });
  d.on(runBtn, 'click', runControl);
  d.on(reduced, 'change', () => demo && demo.render(demo.t));

  /* ── boot ─────────────────────────────────────────────────────────── */
  function boot() {
    if (gone) return;
    try { R = makeRenderer(mainCanvas); RC = makeRenderer(cmpCanvas); } catch (e) { fail('WebGL is not available here — ' + e.message); return; }
    instrumentPlate();
    d.on(mainCanvas, 'webglcontextlost', (e) => { e.preventDefault(); fail('WebGL context lost — the GPU took the surface back'); });
    const ro = new ResizeObserver(() => { prerender.v = ''; demo && !demo.playing && demo.render(demo.t); });
    ro.observe(stage); d.observer(ro);
    openVariant();
    demo = WAM.clock('rl-stage', { render, el: rlEl, dur: DUR_S * 1000, poster: 5 / DUR_S });
    if (reduced.matches) { msSamples.length = 0; demo.render(demo.t); }
  }
  const fontReady = document.fonts && document.fonts.load ? document.fonts.load('700 48px Inter') : Promise.resolve();
  fontReady.then(boot, boot);

  return function dispose() {
    gone = true;
    WAM.dispose();
    d.run();
    prerender.targets.forEach((t) => t.dispose()); prerender.targets = [];
    const freeScene = (scene) => scene && scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      mats.forEach((m) => { Object.values(m).forEach((v) => { if (v && v.isTexture) v.dispose(); }); m.dispose(); });
    });
    if (EX.museum) freeScene(EX.museum.scene); else if (gltfLoaded) freeScene(gltfLoaded.scene);
    freeScene(blendScene);
    if (envTex) envTex.dispose();
    [R, RC].forEach((r) => { if (!r) return; r.dispose(); r.forceContextLoss(); });
    R = RC = null;
  };
}
