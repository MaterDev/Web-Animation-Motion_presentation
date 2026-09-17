// @ts-nocheck -- sheet code from design/techniques/webgl.html §1, never typed
/* ════════════════════════════════════════════════════════════════════════
   The Fenwick · homepage hero — §1 of SL-12 (webgl), the points
   experience on its own, recomposed for the slide (2026-09-17).

   A fine point cloud sampled on the scan: 320 000 points gather out of a
   drifting nebula into the bust in about two seconds, hold, and let go
   again. All of it runs in the vertex shader from t, a per-point seed and
   the pointer's ray, so nothing is uploaded per frame. Everything visible
   is a pure render(t) on a WAM clock. See NOTES.md for what changed.
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

/* the one count: drawn, sampled, and printed in the copy */
const COUNT = 320000;

/* the cycle, in seconds: gather (ease-out), hold, let go (ease-in), drift */
const CYCLE = 16, GATHER = 2.2, LET_GO = 13, SCATTERED = 15;

/* the camera: distance, sway, and how far right of centre the bust sits */
const CAM_D = 2.85, SWAY = 32, SWAY_S = 29, SHIFT = 0.16;

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
  /* point size in DEVICE pixels, not CSS: fine grain on a 2× display too */
  const PX = 1.0;

  function hash2(i, j) { let n = (i * 374761393 + j * 668265263) | 0; n = (n ^ (n >>> 13)) * 1274126177 | 0; return ((n ^ (n >>> 16)) >>> 0) / 4294967296; }

  /* The points never leave the GPU: their two homes — a place in the
     nebula and a place on the surface — are attributes, and the vertex
     shader decides where each one is this frame. Size and brightness fall
     off with depth, so the cloud reads as a volume, not a silhouette. */
  const POINTS_VS = `precision highp float;
in vec3 position; in vec3 normal; in vec2 uv; in float aSeed;
uniform mat4 projectionMatrix, modelViewMatrix;
uniform float u_t, u_time, u_px, u_push, u_camD;
uniform vec3 u_rayO, u_rayD, u_light, u_eye;
out vec2 v_uv; out vec3 v_c; out float v_a;
float h(float s, float k){ return fract(sin(s*127.1 + k*311.7)*43758.5453); }
void main(){
  /* the nebula: a soft sphere, slowly turning, each point on its own orbit */
  float th = h(aSeed,1.0)*6.2831853, ph = acos(2.0*h(aSeed,2.0) - 1.0), r = 0.22 + 0.62*pow(h(aSeed,3.0), 0.9);
  float spin = u_time*0.06 + (1.0 - r)*0.4;
  vec3 cloud = r*vec3(sin(ph)*cos(th + spin), cos(ph)*0.5, sin(ph)*sin(th + spin));
  cloud += 0.03*vec3(sin(u_time*0.7 + aSeed*17.0), cos(u_time*0.5 + aSeed*23.0), sin(u_time*0.9 + aSeed*7.0));
  /* gather: a short per-point stagger, then a cubic ease-out */
  float g = clamp(u_t*1.25 - aSeed*0.25, 0.0, 1.0); float k = 1.0 - pow(1.0 - g, 3.0);
  /* the flight curls a quarter-turn about the vertical as it lands */
  float a = (1.0 - k)*1.6; float ca = cos(a), sa = sin(a);
  vec3 from = vec3(ca*cloud.x - sa*cloud.z, cloud.y, sa*cloud.x + ca*cloud.z);
  vec3 p = mix(from, position, k);
  /* wind: points near the pointer's ray are blown off it */
  vec3 w = p - u_rayO; vec3 q = u_rayO + u_rayD*dot(w, u_rayD); vec3 away = p - q; float dist = length(away);
  p += normalize(away + 1e-5)*u_push*smoothstep(0.16, 0.0, dist);
  vec4 mv = modelViewMatrix*vec4(p, 1.0); gl_Position = projectionMatrix*mv;
  float depth = -mv.z;
  float near = clamp((u_camD + 0.45 - depth)/0.9, 0.0, 1.0);           /* 1 at the front, 0 at the back */
  gl_PointSize = max(1.0, u_px*(u_camD/depth)*mix(0.8, 1.25, near)*mix(1.0, 1.0, k));
  /* light: warm key, cool fill from below, a rim from behind the eye line */
  vec3 n = normalize(normal); vec3 V = normalize(u_eye - p);
  float key = max(dot(n, normalize(u_light)), 0.0);
  float fill = 0.5 + 0.5*n.y;
  float rim = pow(1.0 - max(dot(n, V), 0.0), 3.0);
  vec3 warm = vec3(1.00, 0.86, 0.66), cool = vec3(0.42, 0.55, 0.85);
  vec3 lit = warm*(0.12 + 1.55*key) + cool*0.30*(1.0 - fill) + vec3(0.55, 0.72, 1.0)*1.1*rim;
  vec3 nebula = mix(vec3(0.55, 0.68, 1.0), vec3(1.0, 0.82, 0.6), h(aSeed, 5.0));
  v_c = mix(nebula*1.3, lit, k)*mix(0.35, 1.25, near);
  v_c *= 0.72 + 0.56*h(aSeed, 7.0);                                  /* per-point grain */
  v_uv = uv; v_a = mix(step(h(aSeed, 9.0), 0.22)*0.9, 1.0, k); }   /* scattered, only a fifth of the points show: dust, not a sheet */`;
  const POINTS_FS = `precision highp float; in vec2 v_uv; in vec3 v_c; in float v_a; out vec4 o; uniform sampler2D u_tex; uniform float u_hasTex;
void main(){ if (v_a < 0.02) discard; vec3 base = mix(vec3(0.85), texture(u_tex, v_uv).rgb, u_hasTex); vec3 c = base*v_c; o = vec4(pow(c, vec3(1.0/2.2)), v_a); }`;

  /* ── the renderer ─────────────────────────────────────────────────── */
  function makeRenderer(canvas) {
    const r = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    r.setPixelRatio(DPR); r.outputColorSpace = THREE.SRGBColorSpace; r.setClearColor(0x000000, 0); r.autoClear = true;
    return r;
  }
  function fit(renderer, el) {
    const b = el.getBoundingClientRect(), w = Math.max(1, Math.round(b.width)), h = Math.max(1, Math.round(b.height));
    const c = renderer.domElement; const changed = c.width !== Math.round(w * DPR) || c.height !== Math.round(h * DPR);
    if (changed) renderer.setSize(w, h, false);
    return { w: c.width, h: c.height, changed };
  }

  /* ── state ────────────────────────────────────────────────────────── */
  let pointer = null;
  const rlEl = $('rl-world'), stage = $('rl-stage');
  const mainCanvas = stage.querySelector('[data-testid="rl-canvas"]');
  const status = $('rl-status');
  let R = null, demo = null, hero = null, gltfLoaded = null;
  const fail = (m) => { status.hidden = false; status.textContent = m; };
  $('rl-hero-count').textContent = COUNT.toLocaleString('en-US');

  /* ── the points ───────────────────────────────────────────────────── */
  function buildHero(gltf) {
    const root3 = gltf.scene.clone(true); const box = new THREE.Box3().setFromObject(root3), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const sc = 1 / size.y; root3.scale.setScalar(sc); root3.position.set(-c.x * sc, -c.y * sc, -c.z * sc); root3.updateMatrixWorld(true);
    const pos = new Float32Array(COUNT * 3), nrm = new Float32Array(COUNT * 3), uv = new Float32Array(COUNT * 2), seed = new Float32Array(COUNT);
    const p = new THREE.Vector3(), n = new THREE.Vector3(), u = new THREE.Vector2(); let k = 0;
    root3.traverse((m) => { if (!m.isMesh || k >= COUNT) return; const sampler = new MeshSurfaceSampler(m).build(); const want = COUNT - k;
      for (let i = 0; i < want; i++) { sampler.sample(p, n, null, u); p.applyMatrix4(m.matrixWorld); n.transformDirection(m.matrixWorld); pos.set([p.x, p.y, p.z], k * 3); nrm.set([n.x, n.y, n.z], k * 3); uv.set([u.x, u.y], k * 2); seed[k] = hash2(k, 77); k++; } });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    let baseTex = null; root3.traverse((m) => { if (m.isMesh && m.material.map && !baseTex) baseTex = m.material.map; });
    const uniforms = { u_t: { value: 1 }, u_time: { value: 0 }, u_px: { value: PX }, u_push: { value: 0 }, u_camD: { value: CAM_D },
      u_rayO: { value: new THREE.Vector3(0, 0, 10) }, u_rayD: { value: new THREE.Vector3(0, 0, -1) }, u_light: { value: new THREE.Vector3(-1.1, 1.3, 1.2) }, u_eye: { value: new THREE.Vector3() },
      u_tex: { value: baseTex }, u_hasTex: { value: baseTex ? 1 : 0 } };
    const mat = new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: POINTS_VS, fragmentShader: POINTS_FS, uniforms, transparent: true, depthWrite: true });
    const scene = new THREE.Scene(); const points = new THREE.Points(geo, mat); points.frustumCulled = false; scene.add(points);
    const cam = new THREE.PerspectiveCamera(32, 16 / 9, 0.05, 40);
    return {
      scene, cam,
      state(T) {
        const s = {}, c = T % CYCLE;
        /* u_t runs 0→1 over the gather (the shader eases it out), holds at 1, and
           runs back down over the let-go, where the same curve reads as an ease-in */
        s.t = c < GATHER ? c / GATHER : c < LET_GO ? 1 : c < SCATTERED ? 1 - (c - LET_GO) / (SCATTERED - LET_GO) : 0;
        s.yaw = 18 + SWAY * Math.sin(TAU * T / SWAY_S); s.time = T;
        if (reduced.matches) { s.t = 1; s.yaw = 18; s.time = 0; }
        return s;
      },
      frame(s, aspect, o) {
        cam.aspect = aspect;
        /* the bust sits right of centre, clear of the headline on the left */
        if (o && o.w) cam.setViewOffset(o.w, o.h, -Math.round(o.w * SHIFT), -Math.round(o.h * 0.025), o.w, o.h);
        cam.updateProjectionMatrix();
        const y = s.yaw * DEG; cam.position.set(CAM_D * Math.sin(y), 0.18, CAM_D * Math.cos(y)); cam.lookAt(0, 0, 0);
        uniforms.u_t.value = s.t; uniforms.u_time.value = s.time; uniforms.u_px.value = PX; uniforms.u_eye.value.copy(cam.position);
        /* the key light rides with the camera: above, and 50° to the viewer's left */
        const ly = y - 0.9; uniforms.u_light.value.set(Math.sin(ly), 1.1, Math.cos(ly));
        if (pointer && pointer.ndc) { const o2 = cam.position.clone(); const dd = new THREE.Vector3(pointer.ndc[0], pointer.ndc[1], 0.5).unproject(cam).sub(o2).normalize(); uniforms.u_rayO.value.copy(o2); uniforms.u_rayD.value.copy(dd); uniforms.u_push.value = 0.12; } else uniforms.u_push.value = 0;
      }
    };
  }

  /* ── assembling the stage ─────────────────────────────────────────── */
  function loadGLTF() {
    if (gltfLoaded) return Promise.resolve(gltfLoaded); status.hidden = false; status.textContent = 'loading the scan…';
    const manager = new THREE.LoadingManager();
    manager.setURLModifier((url) => { const name = url.split(/[?#]/)[0].split('/').pop(); return ASSET_URLS[name] || url; });
    return new Promise((res, rej) => new GLTFLoader(manager).load(gltfUrl, (g) => { gltfLoaded = g; res(g); }, undefined, rej));
  }
  function open() {
    loadGLTF().then(() => {
      if (gone) return;
      hero = buildHero(gltfLoaded);
      status.hidden = true;
      /* the scan has just arrived: start the gather from the cloud, now */
      if (demo) { if (!reduced.matches) { demo.seek(0); demo.play(); } else demo.render(demo.t); }
    }).catch((e) => { if (!gone) fail('could not load: ' + e.message); });
  }

  function render(t) {
    if (!hero || gone || !R) return;
    const s = hero.state((((t % 1) + 1) % 1) * DUR_S);
    const { w, h } = fit(R, stage);
    hero.frame(s, w / h, { w, h }); R.setViewport(0, 0, w, h);
    R.render(hero.scene, hero.cam);
  }
  const DUR_S = 41 * 17 * 9;

  /* ── the viewer's hand ────────────────────────────────────────────── */
  function stagePoint(e) { const r = stage.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }; }
  d.on(rlEl, 'pointermove', (e) => {
    if (!hero) return; const p = stagePoint(e);
    pointer = { ndc: [p.x * 2 - 1, 1 - p.y * 2] };
    if (demo && !demo.playing) demo.render(demo.t);
  });
  d.on(rlEl, 'pointerleave', () => { pointer = null; if (demo && !demo.playing) demo.render(demo.t); });
  {
    const b = $('rl-hero-cta'), was = b.textContent;
    d.on(b, 'click', () => { b.classList.toggle('rl-on'); b.textContent = b.classList.contains('rl-on') ? 'Loading the collection…' : was; });
  }
  root.querySelectorAll('.rlh-nav button').forEach((b) => d.on(b, 'click', () => {
    root.querySelectorAll('.rlh-nav button').forEach((o) => o.classList.toggle('rl-on', o === b));
  }));
  d.on(reduced, 'change', () => demo && demo.render(demo.t));

  /* ── boot ─────────────────────────────────────────────────────────── */
  function boot() {
    if (gone) return;
    try { R = makeRenderer(mainCanvas); } catch (e) { fail('WebGL is not available here — ' + e.message); return; }
    d.on(mainCanvas, 'webglcontextlost', (e) => { e.preventDefault(); fail('WebGL context lost — the GPU took the surface back'); });
    const ro = new ResizeObserver(() => { demo && !demo.playing && demo.render(demo.t); });
    ro.observe(stage); d.observer(ro);
    demo = WAM.clock('rl-stage', { render, el: rlEl, dur: DUR_S * 1000, poster: 5 / DUR_S });
    open();
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
    if (hero) freeScene(hero.scene);
    if (gltfLoaded) freeScene(gltfLoaded.scene);
    hero = null;
    if (R) { R.dispose(); R.forceContextLoss(); R = null; }
  };
}
