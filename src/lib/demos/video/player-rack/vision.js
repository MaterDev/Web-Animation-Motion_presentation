// @ts-nocheck -- deck-only addition (not on the tear sheet); see NOTES.md
/* ── people on the live feed ───────────────────────────────────
   Faces and bodies detected in the browser with MediaPipe Tasks Vision,
   drawn as an animated overlay on the camera feed. Everything runs on
   this machine: the WebAssembly runtime and both models are files in
   this demo's own assets/vision folder, loaded only when the switch is
   first turned on, so nothing is fetched from the network on stage.

     · faces  — BlazeFace short-range: corner brackets that settle onto
                each face, with a confidence tag
     · bodies — Pose Landmarker lite: a 33-point skeleton whose limbs
                sweep in when a person is found; joints pulse

   Positions are eased toward each new detection so the marks glide
   rather than jitter. The loop runs only while the camera is live and
   the switch is on, and every resource is released on dispose. */
import wasmLoaderPath from './assets/vision/vision_wasm_internal.js?url';
import wasmBinaryPath from './assets/vision/vision_wasm_internal.wasm?url';
import faceModel from './assets/vision/blaze_face_short_range.tflite?url';
import poseModel from './assets/vision/pose_landmarker_lite.task?url';

const FACE = 'oklch(0.86 0.17 85)';   // amber
const BODY = 'oklch(0.80 0.14 200)';  // cyan

export function vision(root, d) {
  const V = root.getElementById('prVideo');
  const cv = root.getElementById('fxPeopleCanvas');
  const btn = root.getElementById('fxPeople');
  const label = root.getElementById('fxPeopleLabel');
  const ctx = cv.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let live = false, on = false, dead = false, raf = 0;
  let face = null, pose = null, loading = null, CONNECTIONS = [];
  let frame = 0, lastVideoTime = -1;
  /** tracked marks, eased between detections */
  let faces = [], bodies = [];

  function setBtn() {
    btn.disabled = !live;
    btn.classList.toggle('is-on', on && live);
    btn.setAttribute('aria-checked', String(on && live));
    btn.title = live ? '' : 'turn the camera on first';
  }
  setBtn();

  async function load() {
    if (loading) return loading;
    loading = (async () => {
      label.textContent = 'loading models…';
      const mp = await import('@mediapipe/tasks-vision');
      const fileset = { wasmLoaderPath, wasmBinaryPath };
      const mk = async (Cls, opts) => {
        try { return await Cls.createFromOptions(fileset, { ...opts, baseOptions: { ...opts.baseOptions, delegate: 'GPU' } }); }
        catch { return await Cls.createFromOptions(fileset, { ...opts, baseOptions: { ...opts.baseOptions, delegate: 'CPU' } }); }
      };
      const [f, p] = await Promise.all([
        mk(mp.FaceDetector, { baseOptions: { modelAssetPath: faceModel }, runningMode: 'VIDEO', minDetectionConfidence: 0.5 }),
        mk(mp.PoseLandmarker, { baseOptions: { modelAssetPath: poseModel }, runningMode: 'VIDEO', numPoses: 3, minPoseDetectionConfidence: 0.5, minTrackingConfidence: 0.5 }),
      ]);
      CONNECTIONS = mp.PoseLandmarker.POSE_CONNECTIONS || [];
      if (dead) { f.close(); p.close(); return; }
      face = f; pose = p;
      label.textContent = 'detect people';
    })();
    return loading;
  }

  /* the video is drawn object-fit: cover — map normalised model coords
     to the element's box the same way */
  function mapper() {
    const w = cv.clientWidth, h = cv.clientHeight;
    const vw = V.videoWidth || w, vh = V.videoHeight || h;
    const s = Math.max(w / vw, h / vh);
    const ox = (w - vw * s) / 2, oy = (h - vh * s) / 2;
    return { w, h, x: (nx) => ox + nx * vw * s, y: (ny) => oy + ny * vh * s, px: (x) => ox + x * s, py: (y) => oy + y * s };
  }

  const ease = (a, b, k) => a + (b - a) * k;
  const now = () => performance.now();

  function matchInto(list, found, key) {
    // greedy nearest match so each mark keeps its identity and eases
    const next = [];
    for (const f of found) {
      let best = -1, bd = Infinity;
      list.forEach((m, i) => { if (m.used) return; const dd = Math.hypot(m[key].x - f[key].x, m[key].y - f[key].y); if (dd < bd) { bd = dd; best = i; } });
      if (best >= 0 && bd < 0.25) { const m = list[best]; m.used = true; m.target = f; m.seen = now(); next.push(m); }
      else next.push({ ...f, target: f, born: now(), seen: now() });
    }
    // keep recently lost marks briefly so they fade instead of vanishing
    for (const m of list) if (!m.used && now() - m.seen < 350) next.push(m);
    next.forEach((m) => { delete m.used; });
    return next;
  }

  function detect() {
    if (V.readyState < 2 || V.currentTime === lastVideoTime) return;
    lastVideoTime = V.currentTime;
    const t = now();
    const fr = face.detectForVideo(V, t);
    const fs = (fr.detections || []).map((det) => {
      const b = det.boundingBox, vw = V.videoWidth, vh = V.videoHeight;
      return { c: { x: (b.originX + b.width / 2) / vw, y: (b.originY + b.height / 2) / vh }, w: b.width / vw, h: b.height / vh, score: det.categories?.[0]?.score ?? 0 };
    });
    faces = matchInto(faces, fs, 'c');
    if (frame++ % 2 === 0) {
      const pr = pose.detectForVideo(V, t + 0.5);
      const bs = (pr.landmarks || []).map((lm) => {
        const xs = lm.map((p) => p.x), ys = lm.map((p) => p.y);
        return { c: { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 }, pts: lm.map((p) => ({ x: p.x, y: p.y, v: p.visibility ?? 1 })) };
      });
      bodies = matchInto(bodies, bs, 'c');
    }
  }

  function draw() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const M = mapper();
    if (cv.width !== Math.round(M.w * dpr)) { cv.width = Math.round(M.w * dpr); cv.height = Math.round(M.h * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, M.w, M.h);
    const t = now();
    const k = reduce ? 1 : 0.35;

    for (const b of bodies) {
      const lost = t - b.seen > 60;
      const alpha = lost ? Math.max(0, 1 - (t - b.seen) / 350) : 1;
      const grow = reduce ? 1 : Math.min(1, (t - b.born) / 520);
      if (!b.cur) b.cur = b.target.pts.map((p) => ({ ...p }));
      b.cur.forEach((p, i) => { const q = b.target.pts[i]; p.x = ease(p.x, q.x, k); p.y = ease(p.y, q.y, k); p.v = q.v; });
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.lineCap = 'round';
      ctx.strokeStyle = BODY; ctx.shadowColor = BODY; ctx.shadowBlur = 10;
      ctx.lineWidth = 3;
      for (const { start, end } of CONNECTIONS) {
        const a = b.cur[start], e = b.cur[end];
        if (!a || !e || a.v < 0.4 || e.v < 0.4) continue;
        const ax = M.x(a.x), ay = M.y(a.y), ex = M.x(e.x), ey = M.y(e.y);
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + (ex - ax) * grow, ay + (ey - ay) * grow); ctx.stroke();
      }
      ctx.shadowBlur = 0;
      const pulse = reduce ? 0 : (Math.sin(t / 260) + 1) / 2;
      ctx.fillStyle = 'oklch(0.97 0.02 200)';
      b.cur.forEach((p, i) => {
        if (p.v < 0.4 || i < 11 && i > 0) return; // skip the dense face points; faces get brackets
        ctx.beginPath(); ctx.arc(M.x(p.x), M.y(p.y), (3 + pulse * 1.5) * grow, 0, Math.PI * 2); ctx.fill();
      });
      ctx.restore();
    }

    for (const f of faces) {
      const lost = t - f.seen > 60;
      const alpha = lost ? Math.max(0, 1 - (t - f.seen) / 350) : 1;
      if (!f.cur) f.cur = { x: f.target.c.x, y: f.target.c.y, w: f.target.w * 1.5, h: f.target.h * 1.5 };
      f.cur.x = ease(f.cur.x, f.target.c.x, k); f.cur.y = ease(f.cur.y, f.target.c.y, k);
      f.cur.w = ease(f.cur.w, f.target.w * 1.12, k); f.cur.h = ease(f.cur.h, f.target.h * 1.12, k);
      const cx = M.x(f.cur.x), cy = M.y(f.cur.y);
      const w = f.cur.w * (M.x(1) - M.x(0)), h = f.cur.h * (M.y(1) - M.y(0));
      const x0 = cx - w / 2, y0 = cy - h / 2, x1 = cx + w / 2, y1 = cy + h / 2;
      const L = Math.min(w, h) * 0.24;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = FACE; ctx.shadowColor = FACE; ctx.shadowBlur = 12; ctx.lineWidth = 3; ctx.lineCap = 'square';
      ctx.beginPath();
      ctx.moveTo(x0, y0 + L); ctx.lineTo(x0, y0); ctx.lineTo(x0 + L, y0);
      ctx.moveTo(x1 - L, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y0 + L);
      ctx.moveTo(x1, y1 - L); ctx.lineTo(x1, y1); ctx.lineTo(x1 - L, y1);
      ctx.moveTo(x0 + L, y1); ctx.lineTo(x0, y1); ctx.lineTo(x0, y1 - L);
      ctx.stroke();
      // a scan line sweeping the box while it locks on
      const age = t - f.born;
      if (!reduce && age < 900) {
        const sy = y0 + (h * ((age % 450) / 450));
        ctx.globalAlpha = alpha * (1 - age / 900);
        ctx.beginPath(); ctx.moveTo(x0, sy); ctx.lineTo(x1, sy); ctx.lineWidth = 1.5; ctx.stroke();
        ctx.globalAlpha = alpha;
      }
      ctx.shadowBlur = 0;
      const tag = `FACE ${Math.round(f.target.score * 100)}%`;
      ctx.font = '600 11px "JetBrains Mono", ui-monospace, monospace';
      const tw = ctx.measureText(tag).width + 10;
      ctx.fillStyle = FACE; ctx.fillRect(x0, y0 - 20, tw, 17);
      ctx.fillStyle = 'oklch(0.18 0.02 85)'; ctx.fillText(tag, x0 + 5, y0 - 7);
      ctx.restore();
    }
  }

  function loop() {
    raf = 0;
    if (dead || !on || !live || !face) return;
    try { detect(); } catch (e) { console.warn('[people]', e); }
    draw();
    raf = requestAnimationFrame(loop);
  }
  function start() { if (!raf && on && live && face) raf = requestAnimationFrame(loop); }
  function stop() {
    if (raf) cancelAnimationFrame(raf); raf = 0;
    faces = []; bodies = [];
    ctx.clearRect(0, 0, cv.width, cv.height);
    cv.hidden = true;
  }

  d.on(btn, 'click', async () => {
    if (!live) return;
    on = !on; setBtn();
    if (!on) { stop(); return; }
    cv.hidden = false;
    try { await load(); } catch (e) { console.error(e); label.textContent = 'vision unavailable'; on = false; setBtn(); return; }
    start();
  });

  /* the rack tells us when the camera goes on and off */
  d.on(root, 'wam-cam', (e) => {
    live = !!e.detail?.on;
    setBtn();
    if (live && on) { cv.hidden = false; start(); } else stop();
  });

  d.add(() => {
    dead = true; stop();
    try { face?.close(); } catch {}
    try { pose?.close(); } catch {}
    face = pose = null;
  });
}
