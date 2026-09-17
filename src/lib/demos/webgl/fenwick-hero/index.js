// @ts-nocheck -- sheet code from design/techniques/webgl.html §1, never typed
/* ════════════════════════════════════════════════════════════════════════
   The Fenwick · homepage hero — §1 of SL-12 (webgl), the points
   experience on its own.

   On the sheet four experiences share one stage and one renderer; this is
   the hero's program extracted with the code it runs, unchanged where it
   could be: buildHero (a hundred and twenty thousand points sampled on the
   scan, morphing from a cloud in the vertex shader), the pointer's wind,
   and the point-count control. Everything visible is still a pure render(t)
   on a WAM clock. See NOTES.md for exactly what extraction changed.
   ════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js';
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
  function hash2(i, j) { let n = (i * 374761393 + j * 668265263) | 0; n = (n ^ (n >>> 13)) * 1274126177 | 0; return ((n ^ (n >>> 16)) >>> 0) / 4294967296; }

  /* The points never leave the GPU: their two homes — a cloud and a place
     on the surface — are attributes, and the vertex shader decides where
     each one is this frame from t, its own seed, and the pointer's ray. */
  const POINTS_VS = `precision highp float;
in vec3 position; in vec3 normal; in vec2 uv; in float aSeed;
uniform mat4 projectionMatrix, modelViewMatrix; uniform float u_t, u_time, u_size, u_radius, u_push; uniform vec3 u_center, u_rayO, u_rayD, u_light;
out vec2 v_uv; out float v_l; out float v_a;
float h(float s, float k){ return fract(sin(s*127.1 + k*311.7)*43758.5453); }
void main(){
  vec3 cloud = u_center + (vec3(h(aSeed,1.0), h(aSeed,2.0), h(aSeed,3.0)) - 0.5)*u_radius*3.2;
  cloud += vec3(sin(u_time*0.7 + aSeed*17.0), cos(u_time*0.5 + aSeed*23.0), sin(u_time*0.9 + aSeed*7.0))*u_radius*0.08;
  float k = smoothstep(0.0, 1.0, clamp((u_t*1.35 - aSeed*0.35), 0.0, 1.0));
  vec3 p = mix(cloud, position, k);
  vec3 w = p - u_rayO; vec3 q = u_rayO + u_rayD*dot(w, u_rayD); vec3 away = p - q; float dist = length(away);
  p += normalize(away + 1e-5)*u_push*smoothstep(0.30*u_radius, 0.0, dist);
  vec4 mv = modelViewMatrix*vec4(p, 1.0); gl_Position = projectionMatrix*mv;
  gl_PointSize = u_size*(0.7 + 0.5*k)*u_radius*40.0/max(0.2, -mv.z);
  v_uv = uv; v_l = 0.55 + 0.45*max(dot(normalize(normal), normalize(u_light)), 0.0); v_a = mix(0.55, 1.0, k); }`;
  const POINTS_FS = `precision highp float; in vec2 v_uv; in float v_l; in float v_a; out vec4 o; uniform sampler2D u_tex; uniform vec3 u_tint;
void main(){ vec2 d = gl_PointCoord - 0.5; if (dot(d,d) > 0.25) discard; vec3 c = texture(u_tex, v_uv).rgb*v_l*u_tint; o = vec4(pow(c, vec3(1.0/2.2)), v_a); }`;

  /* ── the renderer ─────────────────────────────────────────────────── */
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
  const C_LIGHT = 41, C_CHAPTER = 17, C_YAW = 9, DUR_S = C_LIGHT * C_CHAPTER * C_YAW;

  /* ── state ────────────────────────────────────────────────────────── */
  const variant = 'hero';
  let pointer = null;
  const rlEl = $('rl-world'), stage = $('rl-stage');
  const mainCanvas = stage.querySelector('[data-testid="rl-canvas"]'), overlay = stage.querySelector('[data-testid="rl-overlay"]');
  const leadEl = overlay.querySelector('[data-testid="rl-lead"]'), anchorEl = overlay.querySelector('[data-testid="rl-anchor"]'), leadN = overlay.querySelector('[data-testid="rl-lead-n"]'), lampMark = overlay.querySelector('[data-testid="rl-lamp-mark"]');
  const status = stage.querySelector('[data-testid="rl-status"]'), hint = stage.querySelector('[data-testid="rl-hint"]');
  let R = null, demo = null, frameN = 0; const msSamples = [];
  const EX = {};
  const fail = (m) => { status.hidden = false; status.textContent = m; };
  const productEl = (v) => $('rl-p-' + v);
  let gltfLoaded = null;

  /* ── experience 4 · the points ────────────────────────────────────── */
  function buildHero(gltf) {
    const el = productEl('hero');
    const root3 = gltf.scene.clone(true); const box = new THREE.Box3().setFromObject(root3), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const sc = 1 / size.y; root3.scale.setScalar(sc); root3.position.set(-c.x * sc, -c.y * sc, -c.z * sc); root3.updateMatrixWorld(true);
    const MAXP = 1200000; const pos = new Float32Array(MAXP * 3), nrm = new Float32Array(MAXP * 3), uv = new Float32Array(MAXP * 2), seed = new Float32Array(MAXP);
    const p = new THREE.Vector3(), n = new THREE.Vector3(), u = new THREE.Vector2(); let k = 0;
    root3.traverse((m) => { if (!m.isMesh || k >= MAXP) return; const sampler = new MeshSurfaceSampler(m).build(); const want = MAXP - k;
      for (let i = 0; i < want; i++) { sampler.sample(p, n, null, u); p.applyMatrix4(m.matrixWorld); n.transformDirection(m.matrixWorld); pos.set([p.x, p.y, p.z], k * 3); nrm.set([n.x, n.y, n.z], k * 3); uv.set([u.x, u.y], k * 2); seed[k] = hash2(k, 77); k++; } });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    geo.setDrawRange(0, 120000);
    let baseTex = null; root3.traverse((m) => { if (m.isMesh && m.material.map && !baseTex) baseTex = m.material.map; });
    const uniforms = { u_t: { value: 1 }, u_time: { value: 0 }, u_size: { value: 1.4 * DPR }, u_radius: { value: 0.5 }, u_push: { value: 0 }, u_center: { value: new THREE.Vector3(0, 0, 0) },
      u_rayO: { value: new THREE.Vector3(0, 0, 10) }, u_rayD: { value: new THREE.Vector3(0, 0, -1) }, u_light: { value: new THREE.Vector3(1, 1.4, 1.2) }, u_tex: { value: baseTex }, u_tint: { value: tokenColor(el, '--rlp-ink') } };
    const mat = new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: POINTS_VS, fragmentShader: POINTS_FS, uniforms, transparent: true, depthWrite: true });
    const scene = new THREE.Scene(); scene.background = tokenColor(el, '--rlp-well'); const points = new THREE.Points(geo, mat); scene.add(points);
    const cam = new THREE.PerspectiveCamera(32, 16 / 9, 0.05, 40);
    return {
      kind: 'points', scene, cam, chapters: [], aspect: 'rl-a169', hint: 'pointer = wind', band: ['points', 'on the scan’s surface, drawn this frame · the one number this page turns on'],
      prog: 'THREE.Points · RawShaderMaterial morph · no per-frame upload', asset: 'Marble Bust 01 · Poly Haven · CC0 · sampled',
      state(T) { const s = {}; const ph = (T / 19) % 1; s.t = ph < 0.42 ? ph / 0.42 : ph < 0.72 ? 1 : 1 - (ph - 0.72) / 0.28; s.yaw = 20 + 40 * Math.sin(TAU * T / 29); s.time = T;
        if (reduced.matches) { s.t = 1; s.yaw = 20; s.time = 0; } s.doto = geo.drawRange.count.toLocaleString(); return s; },
      frame(s, aspect) { cam.aspect = aspect; cam.updateProjectionMatrix(); const y = s.yaw * DEG; cam.position.set(2.4 * Math.sin(y), 0.25, 2.4 * Math.cos(y)); cam.lookAt(0, 0, 0);
        uniforms.u_t.value = s.t; uniforms.u_time.value = s.time; uniforms.u_size.value = 1.4 * DPR;
        if (pointer && pointer.ndc) { const o = cam.position.clone(); const dd = new THREE.Vector3(pointer.ndc[0], pointer.ndc[1], 0.5).unproject(cam).sub(o).normalize(); uniforms.u_rayO.value.copy(o); uniforms.u_rayD.value.copy(dd); uniforms.u_push.value = 0.22; } else uniforms.u_push.value = 0; },
      compare: null,
      control: { th: 'points', rows: ['75 000', '300 000', '1 200 000'], what: (nn, i) => i === 0 ? '—' : `vertex work × ${[1, 4, 16][i]} · nothing uploaded — the points live on the GPU`, points: [75000, 300000, 1200000], geo }
    };
  }

  /* ── assembling the stage ─────────────────────────────────────────── */
  function ensure() {
    if (EX.hero) return Promise.resolve(EX.hero);
    return loadGLTF().then(() => { if (gone) throw new Error('disposed'); EX.hero = buildHero(gltfLoaded); return EX.hero; });
  }
  function loadGLTF() {
    if (gltfLoaded) return Promise.resolve(gltfLoaded); status.hidden = false; status.textContent = 'loading the scan…';
    const manager = new THREE.LoadingManager();
    manager.setURLModifier((url) => { const name = url.split(/[?#]/)[0].split('/').pop(); return ASSET_URLS[name] || url; });
    return new Promise((res, rej) => new GLTFLoader(manager).load(gltfUrl, (g) => { gltfLoaded = g; res(g); }, undefined, rej));
  }

  function openVariant() {
    pointer = null;
    ensure().then((ex) => {
      if (gone) return;
      stage.className = 'rl-stage ' + ex.aspect + (ex.kind === 'mesh' ? ' rl-grab' : ''); hint.textContent = ex.hint;
      $('rl-band-l').innerHTML = `<b>${ex.band[0]}</b> · ${ex.band[1]}`; $('rl-prog').textContent = ex.prog; $('rl-asset').textContent = ex.asset;
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
  function renderOverlay() {
    const r = stage.getBoundingClientRect();
    overlay.setAttribute('viewBox', `0 0 ${r.width} ${r.height}`);
    /* the hero has no chapters: the sheet's overlay clears every mark */
    leadEl.setAttribute('points', ''); anchorEl.setAttribute('r', 0); leadN.textContent = ''; lampMark.setAttribute('r', 0);
  }
  const azDot = $('rl-azimuth-dot'), msEl = $('rl-ms'); let lastDoto = '';
  function render(t) {
    const ex = EX[variant]; if (!ex || gone) return;
    const s = stateFor(ex, t); frameN++;
    const bracket = (frameN % 12 === 0) || reduced.matches;
    const ms = renderMain(ex, s, bracket);
    if (ms >= 0) { msSamples.push(ms); if (msSamples.length > 8) msSamples.shift(); msEl.textContent = fmtMs(median(msSamples)) + (msSamples.length < 8 ? ' ·' : ''); }
    renderOverlay(ex, s);
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
      c.geo.setDrawRange(0, c.points[i]); ex.frame(s0, w / h, { w, h });
      const draw = () => { R.setViewport(0, 0, w, h); R.render(ex.scene, ex.cam); };
      for (let k = 0; k < 3; k++) { draw(); sync(R); }
      const xs = []; for (let k = 0; k < 9; k++) { const t0 = performance.now(); draw(); sync(R); xs.push(performance.now() - t0); }
      res.push(median(xs));
    });
    c.geo.setDrawRange(0, 120000);
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
  function stagePoint(e) { const r = stage.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, w: r.width, h: r.height }; }
  d.on(stage, 'pointermove', (e) => {
    const ex = EX[variant]; if (!ex) return; const p = stagePoint(e);
    pointer = { ndc: [p.x * 2 - 1, 1 - p.y * 2] };
    if (demo && !demo.playing) demo.render(demo.t);
  });
  d.on(stage, 'pointerleave', () => { pointer = null; if (demo && !demo.playing) demo.render(demo.t); });
  {
    const b = $('rl-hero-cta'), was = b.textContent;
    d.on(b, 'click', () => { b.classList.toggle('rl-on'); b.textContent = b.classList.contains('rl-on') ? was.replace(/^(Explore the collection)$/, () => 'Loading the collection…') : was; });
  }
  d.on(runBtn, 'click', runControl);
  d.on(reduced, 'change', () => demo && demo.render(demo.t));

  /* ── boot ─────────────────────────────────────────────────────────── */
  function boot() {
    if (gone) return;
    try { R = makeRenderer(mainCanvas); } catch (e) { fail('WebGL is not available here — ' + e.message); return; }
    instrumentPlate();
    d.on(mainCanvas, 'webglcontextlost', (e) => { e.preventDefault(); fail('WebGL context lost — the GPU took the surface back'); });
    const ro = new ResizeObserver(() => { demo && !demo.playing && demo.render(demo.t); });
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
    const freeScene = (scene) => scene && scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      mats.forEach((m) => { Object.values(m).forEach((v) => { if (v && v.isTexture) v.dispose(); }); if (m.uniforms) Object.values(m.uniforms).forEach((un) => { if (un.value && un.value.isTexture) un.value.dispose(); }); m.dispose(); });
    });
    if (EX.hero) freeScene(EX.hero.scene);
    if (gltfLoaded) freeScene(gltfLoaded.scene);
    if (R) { R.dispose(); R.forceContextLoss(); R = null; }
  };
}
