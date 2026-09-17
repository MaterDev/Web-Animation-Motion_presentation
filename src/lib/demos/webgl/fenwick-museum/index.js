// @ts-nocheck -- sheet code from design/techniques/webgl.html §1, never typed
/* ════════════════════════════════════════════════════════════════════════
   The Fenwick · object in the round — §1 of SL-12 (webgl), the museum
   experience on its own, recomposed for the slide (2026-09-17).

   buildMuseum is the sheet's: the scan with its normal and roughness maps,
   a room environment and three light rigs. The bust turns slowly on its
   own; drag turns it by hand; a note turns it to what the note describes.
   Nothing floats on the model. Everything visible is a pure render(t) on a
   WAM clock. See NOTES.md for what extraction and the slide fit changed.
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

/* seconds a note takes to turn the bust to its pose */
const TURN_S = 1.2;

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
  const DUR_S = 41 * 17 * 9;

  /* ── colours: oklch tokens → linear, via canvas 2D ─────────────────── */
  const pxc = document.createElement('canvas'); pxc.width = pxc.height = 1;
  const pxx = pxc.getContext('2d', { willReadFrequently: true });
  function tokenColor(el, name) {
    const v = getComputedStyle(el).getPropertyValue(name).trim() || '#ff00ff';
    pxx.fillStyle = '#000'; pxx.fillRect(0, 0, 1, 1); pxx.fillStyle = v; pxx.fillRect(0, 0, 1, 1);
    const px = pxx.getImageData(0, 0, 1, 1).data;
    return new THREE.Color().setRGB(px[0] / 255, px[1] / 255, px[2] / 255, THREE.SRGBColorSpace);
  }

  /* ── the renderer ─────────────────────────────────────────────────── */
  function makeRenderer(canvas) {
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    r.setPixelRatio(DPR); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
    return r;
  }
  function fit(renderer, el) {
    const b = el.getBoundingClientRect(), w = Math.max(1, Math.round(b.width)), h = Math.max(1, Math.round(b.height));
    const c = renderer.domElement;
    if (c.width !== Math.round(w * DPR) || c.height !== Math.round(h * DPR)) renderer.setSize(w, h, false);
    return { w: c.width, h: c.height };
  }

  /* ── state ────────────────────────────────────────────────────────── */
  /* pose: null (the slow turn), or a turn toward { yaw, pitch } that began
     at clock time T0 from { yaw0, pitch0 } — so a note's turn is still a
     function of t. A drag writes a pose that has already arrived. */
  let drag = null, pose = null, step = 0, rig = 'gallery';
  const rlEl = $('rl-world'), stage = $('rl-stage');
  const mainCanvas = stage.querySelector('[data-testid="rl-canvas"]');
  const status = $('rl-status');
  let R = null, demo = null, museum = null, envTex = null, gltfLoaded = null;
  const fail = (m) => { status.hidden = false; status.textContent = m; };

  /* ── the bust ─────────────────────────────────────────────────────── */
  function buildMuseum(gltf) {
    const el = $('rl-p-museum');
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
    /* the notes' poses: brow, chin, drapery */
    const chapters = [{ yaw: 12, pitch: 8 }, { yaw: -18, pitch: -4 }, { yaw: 55, pitch: 6 }];
    const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
    const autoPose = (T) => ({ yaw: (T / 27 % 1) * 360, pitch: 8 + 4 * Math.sin(TAU * T / 11) });
    return {
      scene, cam, chapters, autoPose,
      state(T) {
        let s;
        if (reduced.matches) s = { ...chapters[Math.min(step, 2)] };
        else if (drag) s = { yaw: drag.yaw, pitch: drag.pitch };
        else if (pose) { const k = ease(Math.max(0, Math.min(1, (T - pose.T0) / TURN_S))); const dy = ((pose.yaw - pose.yaw0) % 360 + 540) % 360 - 180; s = { yaw: pose.yaw0 + dy * k, pitch: pose.pitch0 + (pose.pitch - pose.pitch0) * k }; }
        else s = autoPose(T);
        return s;
      },
      frame(s, aspect) {
        cam.aspect = aspect; cam.updateProjectionMatrix();
        const y = s.yaw * DEG, p = s.pitch * DEG, rr = 2.15;
        cam.position.set(rr * Math.cos(p) * Math.sin(y), 0.02 + rr * Math.sin(p), rr * Math.cos(p) * Math.cos(y)); cam.lookAt(0, 0.0, 0);
        R.toneMappingExposure = applyRig(rig);
      }
    };
  }

  /* ── assembling the stage ─────────────────────────────────────────── */
  function loadGLTF() {
    status.hidden = false; status.textContent = 'loading the scan…';
    const manager = new THREE.LoadingManager();
    manager.setURLModifier((url) => { const name = url.split(/[?#]/)[0].split('/').pop(); return ASSET_URLS[name] || url; });
    return new Promise((res, rej) => new GLTFLoader(manager).load(gltfUrl, (g) => { gltfLoaded = g; res(g); }, undefined, rej));
  }
  function open() {
    loadGLTF().then(() => {
      if (gone) return;
      museum = buildMuseum(gltfLoaded);
      status.hidden = true;
      if (demo) demo.render(demo.t);
    }).catch((e) => { if (!gone) fail('could not load: ' + e.message); });
  }
  const clockT = () => (demo ? (((demo.t % 1) + 1) % 1) * DUR_S : 0);

  function render(t) {
    if (!museum || gone || !R) return;
    const s = museum.state((((t % 1) + 1) % 1) * DUR_S);
    const { w, h } = fit(R, stage);
    museum.frame(s, w / h); R.setViewport(0, 0, w, h);
    R.render(museum.scene, museum.cam);
  }
  const redraw = () => { if (demo && !demo.playing) demo.render(demo.t); };

  /* ── the viewer's hand ────────────────────────────────────────────── */
  d.on(stage, 'pointerdown', (e) => {
    if (!museum) return; const s = museum.state(clockT());
    drag = { x0: e.clientX, y0: e.clientY, yaw0: s.yaw, pitch0: s.pitch, yaw: s.yaw, pitch: s.pitch };
    stage.setPointerCapture(e.pointerId);
  });
  d.on(stage, 'pointermove', (e) => {
    if (!drag) return;
    drag.yaw = drag.yaw0 + (e.clientX - drag.x0) * 0.6; drag.pitch = Math.max(-30, Math.min(60, drag.pitch0 - (e.clientY - drag.y0) * 0.3));
    redraw();
  });
  /* letting go leaves the bust where the hand put it */
  const release = () => { if (!drag) return; pose = { yaw0: drag.yaw, pitch0: drag.pitch, yaw: drag.yaw, pitch: drag.pitch, T0: -Infinity }; drag = null; redraw(); };
  d.on(stage, 'pointerup', release);
  d.on(stage, 'pointercancel', release);

  const notes = [...root.querySelectorAll('.rl-ch')];
  notes.forEach((b) => d.on(b, 'click', () => {
    const k = +b.dataset.ch; step = k;
    notes.forEach((o) => o.classList.toggle('rl-on', o === b));
    if (!museum) return;
    const from = museum.state(clockT()), to = museum.chapters[k];
    pose = { yaw0: from.yaw, pitch0: from.pitch, yaw: to.yaw, pitch: to.pitch, T0: clockT() };
    if (demo && !reduced.matches) demo.play();
    redraw();
  }));
  root.querySelectorAll('.rlp-opts[data-opt="rig"] .rlp-opt').forEach((b, _, all) => d.on(b, 'click', () => {
    all.forEach((o) => o.classList.toggle('rl-on', o === b));
    rig = b.dataset.val; redraw();
  }));
  ['rl-museum-visit', 'rl-museum-save'].forEach((id) => {
    const b = $(id); if (!b) return; const was = b.textContent;
    const done = { 'rl-museum-visit': 'Sat 19 Sep, 11:00 ✓', 'rl-museum-save': 'Saved ✓' }[id];
    d.on(b, 'click', () => { b.classList.toggle('rl-on'); b.textContent = b.classList.contains('rl-on') ? done : was; });
  });
  d.on(reduced, 'change', () => demo && demo.render(demo.t));

  /* ── boot ─────────────────────────────────────────────────────────── */
  function boot() {
    if (gone) return;
    try { R = makeRenderer(mainCanvas); } catch (e) { fail('WebGL is not available here — ' + e.message); return; }
    d.on(mainCanvas, 'webglcontextlost', (e) => { e.preventDefault(); fail('WebGL context lost — the GPU took the surface back'); });
    const ro = new ResizeObserver(redraw);
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
      mats.forEach((m) => { Object.values(m).forEach((v) => { if (v && v.isTexture) v.dispose(); }); m.dispose(); });
    });
    if (museum) freeScene(museum.scene); else if (gltfLoaded) freeScene(gltfLoaded.scene);
    if (envTex) envTex.dispose();
    museum = null;
    if (R) { R.dispose(); R.forceContextLoss(); R = null; }
  };
}
