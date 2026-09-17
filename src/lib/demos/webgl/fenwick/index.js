// @ts-nocheck -- sheet code from design/techniques/webgl.html §1, never typed
/* ════════════════════════════════════════════════════════════════════════
   The Fenwick · object in the round — SL-12 (webgl), the homepage hero's
   points and the museum page's lit mesh as ONE experience (2026-09-17).

   The scan arrives as 320 000 fine points that gather out of drifting dust
   in 2.2 s. A warm scan line then rises through the cloud: below it the
   points give way to the PBR mesh (normal + roughness maps, room
   environment, three light rigs) with a crisp silhouette outline. The bust
   turns slowly, holds, and the line falls again so the object dissolves
   back to points and the points let go. One renderer, one scene, one
   camera: the points are sampled on the very mesh they hand over to, in
   the same normalised space, so they register exactly.

   Everything visible is a pure render(t) on a WAM clock; a note, a light
   or a drag holds the object resolved until "Replay the scan".
   ════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js';
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

/* the one count: sampled, drawn, and printed in the phase readout */
const COUNT = 320000;

/* the cycle, in seconds:
   gather 0–2.2 · points settle to 2.6 · scan line rises to 4.2 (points → object)
   · outline in over 0.5 · lit mesh turns until 19 · line falls to 20.4
   · points let go to 22.4 · drift to 23.4 */
const GATHER = 2.2, SETTLE = 2.6, REVEAL_END = 4.2, OUTLINE_IN = 0.5, HOLD_END = 19, UNREVEAL_END = 20.4, LET_GO_END = 22.4, CYCLE = 23.4;
const RESOLVED = REVEAL_END + OUTLINE_IN + 0.1;
/* the scan line's travel: the bust is normalised to 1 unit tall about 0 */
const LINE_LO = -0.6, LINE_HI = 0.6;

/* the camera: orbit radius, field of view, seconds per slow turn */
const RR = 2.1, FOV = 30, TURN = 40;
/* seconds a note takes to turn the bust to its pose */
const TURN_S = 1.2;
/* outline width in CSS px, and its colour: a light warm stroke */
const OUTLINE_PX = 1.8, OUTLINE_COL = 0xf1dcb4;

/* the line's wobble, shared by the points and the mesh so they cut at the same place */
const WOBBLE = `float fwWobble(vec3 P){ return 0.022*sin(P.x*23.0 + P.z*17.0) + 0.014*sin(P.z*41.0 - P.x*29.0); }`;

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
  /* point size in DEVICE pixels, not CSS: fine grain on a 2× display too */
  const PX = 1.0;

  function hash2(i, j) { let n = (i * 374761393 + j * 668265263) | 0; n = (n ^ (n >>> 13)) * 1274126177 | 0; return ((n ^ (n >>> 16)) >>> 0) / 4294967296; }
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

  /* ── the points (the hero's program, wind removed, scan line added) ── */
  const POINTS_VS = `precision highp float;
in vec3 position; in vec3 normal; in vec2 uv; in float aSeed;
uniform mat4 projectionMatrix, modelViewMatrix;
uniform float u_t, u_time, u_px, u_camD, u_reveal, u_band;
uniform vec3 u_light, u_eye;
out vec2 v_uv; out vec3 v_c; out float v_a;
float h(float s, float k){ return fract(sin(s*127.1 + k*311.7)*43758.5453); }
${WOBBLE}
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
  vec4 mv = modelViewMatrix*vec4(p, 1.0); gl_Position = projectionMatrix*mv;
  float depth = -mv.z;
  float near = clamp((u_camD + 0.45 - depth)/0.9, 0.0, 1.0);           /* 1 at the front, 0 at the back */
  gl_PointSize = max(1.0, u_px*(u_camD/depth)*mix(0.8, 1.25, near));
  /* light: the rig's key, a cool fill from below, a rim from behind the eye line */
  vec3 n = normalize(normal); vec3 V = normalize(u_eye - p);
  float key = max(dot(n, normalize(u_light)), 0.0);
  float fill = 0.5 + 0.5*n.y;
  float rim = pow(1.0 - max(dot(n, V), 0.0), 3.0);
  vec3 warm = vec3(1.00, 0.86, 0.66), cool = vec3(0.42, 0.55, 0.85);
  vec3 lit = warm*(0.16 + 1.45*key) + cool*0.30*(1.0 - fill) + vec3(0.55, 0.72, 1.0)*0.8*rim;
  vec3 nebula = mix(vec3(0.55, 0.68, 1.0), vec3(1.0, 0.82, 0.6), h(aSeed, 5.0));
  v_c = mix(nebula*1.3, lit, k)*mix(0.35, 1.25, near);
  v_c *= 0.84 + 0.32*h(aSeed, 7.0);                                  /* per-point grain */
  /* the scan line: below it the mesh has taken over; at it, the points burn warm */
  float cut = p.y + fwWobble(p) - u_reveal;
  v_c += vec3(1.0, 0.78, 0.48)*2.2*u_band*(1.0 - smoothstep(0.0, 0.05, abs(cut)));
  v_uv = uv; v_a = mix(step(h(aSeed, 9.0), 0.22)*0.9, 1.0, k)*smoothstep(-0.01, 0.015, cut); }  /* scattered, a fifth show: dust, not a sheet */`;
  const POINTS_FS = `precision highp float; in vec2 v_uv; in vec3 v_c; in float v_a; out vec4 o; uniform sampler2D u_tex; uniform float u_hasTex;
void main(){ if (v_a < 0.02) discard; vec3 tx = texture(u_tex, v_uv).rgb; tx = mix(tx, vec3(dot(tx, vec3(0.2126, 0.7152, 0.0722))), 0.5)*1.15; vec3 base = mix(vec3(0.85), tx, u_hasTex); vec3 c = base*v_c; o = vec4(pow(c, vec3(1.0/2.2)), v_a); }`;

  /* ── the outline: an inverted hull, pushed out a constant number of
     screen pixels along the projected normal, and nudged back in depth so
     only the silhouette (and deep contours) show past the stone ────── */
  const OUTLINE_VS = `uniform float u_width; uniform vec2 u_res;
void main(){
  vec4 wp = modelMatrix*vec4(position, 1.0);
  vec4 clip = projectionMatrix*viewMatrix*wp;
  vec3 wn = normalize(mat3(modelMatrix)*normal);
  vec2 cn = (projectionMatrix*viewMatrix*vec4(wn, 0.0)).xy;
  vec2 dir = normalize(cn*u_res + 1e-6);
  clip.xy += dir*(u_width*2.0/u_res)*clip.w;
  clip.z += 0.002*clip.w;
  gl_Position = clip; }`;
  const OUTLINE_FS = `uniform vec3 u_col; uniform float u_op;
void main(){
  gl_FragColor = vec4(u_col, u_op);
  #include <colorspace_fragment>
}`;

  /* ── the renderer ─────────────────────────────────────────────────── */
  function makeRenderer(canvas) {
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    r.setPixelRatio(DPR); r.outputColorSpace = THREE.SRGBColorSpace; r.setClearColor(0x000000, 0);
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
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
     at clock time T0 from { yaw0, pitch0 }. hold: null (the cycle runs), or
     { base } so the phase runs from base and stops at RESOLVED. */
  let drag = null, pose = null, hold = null, step = 0, rig = 'gallery';
  const world = $('fw-world'), stage = $('fw-stage');
  const mainCanvas = stage.querySelector('[data-testid="fw-canvas"]');
  const status = $('fw-status'), phaseEl = $('fw-phase');
  let R = null, demo = null, bust = null, envTex = null, gltfLoaded = null, phaseTxt = '';
  const fail = (m) => { status.hidden = false; status.textContent = m; };
  const setPhase = (s) => { if (s !== phaseTxt) { phaseTxt = s; phaseEl.innerHTML = s; } };

  /* ── the bust: points and mesh in one normalised space ───────────── */
  function buildBust(gltf) {
    const scene = new THREE.Scene();
    const root3 = gltf.scene; scene.add(root3);
    const box = new THREE.Box3().setFromObject(root3), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const sc = 1 / size.y; root3.scale.setScalar(sc); root3.position.set(-c.x * sc, -c.y * sc, -c.z * sc); root3.updateMatrixWorld(true);

    const U = { reveal: { value: LINE_LO }, band: { value: 0 }, bandCol: { value: new THREE.Color(0xffb46a) },
      width: { value: OUTLINE_PX * DPR }, res: { value: new THREE.Vector2(1, 1) }, col: { value: new THREE.Color(OUTLINE_COL) }, op: { value: 0 } };

    const meshes = [], outlines = [];
    root3.traverse((m) => { if (m.isMesh) meshes.push(m); });
    const outlineMat = new THREE.ShaderMaterial({ vertexShader: OUTLINE_VS, fragmentShader: OUTLINE_FS, side: THREE.BackSide, transparent: true, depthWrite: false, toneMapped: false,
      uniforms: { u_width: U.width, u_res: U.res, u_col: U.col, u_op: U.op } });
    meshes.forEach((m) => {
      const mat = m.material;
      /* the reveal: the mesh exists only below the scan line, and glows at it */
      mat.onBeforeCompile = (sh) => {
        sh.uniforms.u_reveal = U.reveal; sh.uniforms.u_band = U.band; sh.uniforms.u_bandCol = U.bandCol;
        sh.vertexShader = 'varying vec3 vFwP;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n\tvFwP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        sh.fragmentShader = 'varying vec3 vFwP;\nuniform float u_reveal, u_band;\nuniform vec3 u_bandCol;\n' + WOBBLE + '\n' + sh.fragmentShader
          .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n\tfloat fwEdge = u_reveal - (vFwP.y + fwWobble(vFwP));\n\tif (fwEdge < 0.0) discard;')
          .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += u_bandCol * 1.6 * u_band * (1.0 - smoothstep(0.0, 0.03, fwEdge));');
      };
      mat.customProgramCacheKey = () => 'fw-reveal';
      mat.needsUpdate = true;
      const o = new THREE.Mesh(m.geometry, outlineMat); o.renderOrder = 1;
      m.add(o); outlines.push(o);
    });

    /* points, sampled on the same meshes after normalisation: their positions are world positions */
    const pos = new Float32Array(COUNT * 3), nrm = new Float32Array(COUNT * 3), uv = new Float32Array(COUNT * 2), seed = new Float32Array(COUNT);
    const p = new THREE.Vector3(), n = new THREE.Vector3(), u = new THREE.Vector2(); let k = 0;
    meshes.forEach((m) => { if (k >= COUNT) return; const sampler = new MeshSurfaceSampler(m).build(); const want = COUNT - k;
      for (let i = 0; i < want; i++) { sampler.sample(p, n, null, u); p.applyMatrix4(m.matrixWorld); n.transformDirection(m.matrixWorld); pos.set([p.x, p.y, p.z], k * 3); nrm.set([n.x, n.y, n.z], k * 3); uv.set([u.x, u.y], k * 2); seed[k] = hash2(k, 77); k++; } });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const baseTex = meshes.find((m) => m.material.map)?.material.map || null;
    const pu = { u_t: { value: 1 }, u_time: { value: 0 }, u_px: { value: PX }, u_camD: { value: RR }, u_reveal: U.reveal, u_band: U.band,
      u_light: { value: new THREE.Vector3(1, 1, 1) }, u_eye: { value: new THREE.Vector3() }, u_tex: { value: baseTex }, u_hasTex: { value: baseTex ? 1 : 0 } };
    const pmat = new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: POINTS_VS, fragmentShader: POINTS_FS, uniforms: pu, transparent: true, depthWrite: true });
    const points = new THREE.Points(geo, pmat); points.frustumCulled = false; points.renderOrder = 2; scene.add(points);

    /* the museum's room environment and light rigs, retuned for the dark well */
    const pm = new THREE.PMREMGenerator(R); scene.environment = envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
    const key = new THREE.DirectionalLight(0xffffff, 1), fill = new THREE.DirectionalLight(0xffffff, 1), rim = new THREE.DirectionalLight(0xffffff, 1);
    scene.add(key, fill, rim);
    const RIGS = {
      gallery: { key: [[1.4, 2.2, 1.6], 0xfff1dc, 2.4], fill: [[-2, 0.6, 1.2], 0xdfe8ff, 0.5], rim: [[0, 1.5, -2.5], 0xffffff, 1.2], env: 0.5, exp: 0.95 },
      daylight: { key: [[0.4, 3, 1.0], 0xf4f8ff, 2.4], fill: [[-2.5, 0.2, 1.5], 0xfff3e0, 0.9], rim: [[1, 0.5, -2.5], 0xffffff, 0.5], env: 0.95, exp: 0.9 },
      raking: { key: [[3, 0.3, 0.5], 0xffe6c4, 3.6], fill: [[-2, 0.5, 1.0], 0xc9d4ff, 0.12], rim: [[-1, 2, -2], 0xffffff, 0.4], env: 0.12, exp: 1.1 }
    };
    /* the rig is set relative to the viewer, turned with the camera's yaw, so
       "Raking" always rakes across the face you are looking at */
    const applyRig = (name, yaw) => { const g = RIGS[name] || RIGS.gallery, cy = Math.cos(yaw), sy = Math.sin(yaw);
      [[key, g.key], [fill, g.fill], [rim, g.rim]].forEach(([L, dd]) => { const [x, yy, z] = dd[0]; L.position.set(x * cy + z * sy, yy, -x * sy + z * cy); L.color.set(dd[1]); L.intensity = dd[2]; });
      /* three r185 ignores material.envMapIntensity for scene.environment (measured: a zero-light, zero-intensity
         render still read 145,134,115); scene.environmentIntensity is what scales it */
      scene.environmentIntensity = g.env; pu.u_light.value.copy(key.position); return g.exp; };

    const cam = new THREE.PerspectiveCamera(FOV, 4 / 3, 0.05, 40);
    /* the notes' poses: brow, chin, drapery */
    const chapters = [{ yaw: 12, pitch: 8 }, { yaw: -18, pitch: -4 }, { yaw: 55, pitch: 6 }];
    const autoPose = (T) => ({ yaw: 20 + (T / TURN % 1) * 360, pitch: 6 + 4 * Math.sin(TAU * T / 11) });

    return {
      scene, cam, chapters,
      /* the phase clock, in seconds into the cycle */
      phase(T) {
        if (reduced.matches) return RESOLVED;
        if (hold) return Math.max(0, Math.min(RESOLVED, T - hold.base));
        return ((T % CYCLE) + CYCLE) % CYCLE;
      },
      state(T) {
        let s;
        if (reduced.matches) s = { ...chapters[Math.min(step, 2)] };
        else if (drag) s = { yaw: drag.yaw, pitch: drag.pitch };
        else if (pose) { const kk = ease(clamp01((T - pose.T0) / TURN_S)); const dy = ((pose.yaw - pose.yaw0) % 360 + 540) % 360 - 180; s = { yaw: pose.yaw0 + dy * kk, pitch: pose.pitch0 + (pose.pitch - pose.pitch0) * kk }; }
        else s = autoPose(T);
        const c = this.phase(T);
        s.c = c;
        s.t = c < GATHER ? c / GATHER : c < UNREVEAL_END ? 1 : c < LET_GO_END ? 1 - (c - UNREVEAL_END) / (LET_GO_END - UNREVEAL_END) : 0;
        s.r = c < SETTLE ? 0 : c < REVEAL_END ? ease((c - SETTLE) / (REVEAL_END - SETTLE)) : c < HOLD_END ? 1 : c < UNREVEAL_END ? 1 - ease((c - HOLD_END) / (UNREVEAL_END - HOLD_END)) : 0;
        s.o = c < REVEAL_END || c > HOLD_END ? 0 : Math.min(1, (c - REVEAL_END) / OUTLINE_IN, (HOLD_END - c) / 0.4);
        s.band = s.r > 0 && s.r < 1 ? 1 : 0;
        s.time = reduced.matches ? 0 : T;
        return s;
      },
      frame(s, w, h) {
        cam.aspect = w / h; cam.updateProjectionMatrix();
        const y = s.yaw * DEG, pp = s.pitch * DEG;
        cam.position.set(RR * Math.cos(pp) * Math.sin(y), 0.02 + RR * Math.sin(pp), RR * Math.cos(pp) * Math.cos(y)); cam.lookAt(0, 0, 0);
        R.toneMappingExposure = applyRig(rig, y);
        U.reveal.value = LINE_LO + (LINE_HI - LINE_LO) * s.r; U.band.value = s.band;
        U.op.value = s.o; U.res.value.set(w, h); U.width.value = OUTLINE_PX * DPR;
        pu.u_t.value = s.t; pu.u_time.value = s.time; pu.u_eye.value.copy(cam.position);
        points.visible = s.r < 1; meshes.forEach((m) => { m.visible = s.r > 0; }); outlines.forEach((o) => { o.visible = s.o > 0; });
        /* the phase readout, for the room */
        const c = s.c, N = COUNT.toLocaleString('en-US');
        setPhase(c < GATHER ? `gathering · <b>${N}</b> points` : c < SETTLE ? `<b>${N}</b> points · the scan` : c < REVEAL_END ? 'points <b>→</b> object'
          : c <= HOLD_END ? 'lit mesh <b>·</b> outlined' : c < UNREVEAL_END ? 'object <b>→</b> points' : `letting go · <b>${N}</b> points`);
      }
    };
  }

  /* ── assembling the stage ─────────────────────────────────────────── */
  function loadGLTF() {
    setPhase('loading the scan…');
    const manager = new THREE.LoadingManager();
    manager.setURLModifier((url) => { const name = url.split(/[?#]/)[0].split('/').pop(); return ASSET_URLS[name] || url; });
    return new Promise((res, rej) => new GLTFLoader(manager).load(gltfUrl, (g) => { gltfLoaded = g; res(g); }, undefined, rej));
  }
  function open() {
    loadGLTF().then(() => {
      if (gone) return;
      bust = buildBust(gltfLoaded);
      /* the scan has just arrived: start the gather from the cloud, now */
      if (demo) { if (!reduced.matches) { demo.seek(0); demo.play(); } else demo.render(demo.t); }
    }).catch((e) => { if (!gone) fail('could not load: ' + e.message); });
  }
  const clockT = () => (demo ? (((demo.t % 1) + 1) % 1) * DUR_S : 0);

  function render(t) {
    if (!bust || gone || !R) return;
    const s = bust.state((((t % 1) + 1) % 1) * DUR_S);
    const { w, h } = fit(R, stage);
    /* setSize already set the viewport; setViewport takes CSS px and would double it at DPR 2 */
    bust.frame(s, w, h);
    R.render(bust.scene, bust.cam);
  }
  const redraw = () => { if (demo && !demo.playing) demo.render(demo.t); };

  /* any hand on the object holds it resolved: a gather in progress finishes,
     a dissolve or a drift snaps back to the lit mesh */
  function holdNow() {
    if (!bust || hold) return;
    const T = clockT(), c = bust.phase(T);
    hold = { base: T - (c > HOLD_END ? RESOLVED : c) };
  }

  /* ── the viewer's hand ────────────────────────────────────────────── */
  d.on(stage, 'pointerdown', (e) => {
    if (!bust) return; holdNow(); const s = bust.state(clockT());
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

  const notes = [...root.querySelectorAll('.fw-note')];
  notes.forEach((b) => d.on(b, 'click', () => {
    const k = +b.dataset.ch; step = k;
    notes.forEach((o) => o.classList.toggle('fw-on', o === b));
    if (!bust) return;
    holdNow();
    const from = bust.state(clockT()), to = bust.chapters[k];
    pose = { yaw0: from.yaw, pitch0: from.pitch, yaw: to.yaw, pitch: to.pitch, T0: clockT() };
    if (demo && !reduced.matches) demo.play();
    redraw();
  }));
  root.querySelectorAll('.fw-opt').forEach((b, _, all) => d.on(b, 'click', () => {
    all.forEach((o) => o.classList.toggle('fw-on', o === b));
    rig = b.dataset.val; holdNow(); redraw();
  }));
  d.on($('fw-replay'), 'click', () => {
    hold = null; pose = null; drag = null;
    if (!demo) return;
    if (reduced.matches) { demo.render(demo.t); return; }
    demo.seek(0); demo.play();
  });
  d.on(reduced, 'change', () => demo && demo.render(demo.t));

  /* ── boot ─────────────────────────────────────────────────────────── */
  function boot() {
    if (gone) return;
    try { R = makeRenderer(mainCanvas); } catch (e) { fail('WebGL is not available here — ' + e.message); return; }
    d.on(mainCanvas, 'webglcontextlost', (e) => { e.preventDefault(); if (!gone) fail('WebGL context lost — the GPU took the surface back'); });
    const ro = new ResizeObserver(redraw);
    ro.observe(stage); d.observer(ro);
    demo = WAM.clock('fw-stage', { render, el: world, dur: DUR_S * 1000, poster: 5 / DUR_S });
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
    if (bust) freeScene(bust.scene); else if (gltfLoaded) freeScene(gltfLoaded.scene);
    if (envTex) envTex.dispose();
    bust = null;
    if (R) { R.renderLists.dispose(); R.dispose(); R.forceContextLoss(); R = null; }
  };
}
