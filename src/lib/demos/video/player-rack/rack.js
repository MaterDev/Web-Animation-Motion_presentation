// @ts-nocheck -- sheet code, copied from design/techniques/video/index.html; it was never typed
/* ── the buffer rack ──────────────────────────────────────────
   The page's argument, made operable. A baked .mp4 is genuinely
   immutable — but the decoded frame on its way to the compositor is
   not, and neither is the clock deciding which frame that is. So the
   effects split into three honest kinds:

     buffer     — per-pixel work on the decoded frame (SVG filter
                  primitives: component transfer, convolution, channel
                  offset, turbulence + threshold)
     temporal   — the same pixels, different clock: playbackRate, or
                  driving currentTime directly
     composite  — a second decode of the same file, blended against
                  the first

   Exactly one is live at a time, and every one is fully reversible,
   because none of them has touched the file. */
/* Extraction: the sheet IIFE (809–1277) is now rack(root, d). Every
   document lookup goes through the shadow root, every listener / timer /
   frame / stream is registered on the disposer `d`, and the rack drives
   the 16:9 player (#prVideo) instead of the sheet's 9:16 #mpVideo. */
export function rack(root, d) {
  const V = root.getElementById('prVideo');
  const echo = root.getElementById('fxEcho');
  const cards = [...root.querySelectorAll('.fx-card')];
  if (!V || !cards.length) return;
  let raf = null, timer = null, gen = 0;

  const stop = () => {
    if (raf) cancelAnimationFrame(raf), raf = null;
    if (timer) clearInterval(timer), timer = null;
  };
  function reset() {
    /* Bumping the generation is what actually kills a running effect.
       clearInterval / cancelAnimationFrame only stop the NEXT tick — a
       callback already in flight still gets to run, and a curve tick
       that lands after reset writes currentTime on a paused element,
       which is how playback ended up frozen while its clock crept
       forward. Every loop checks its generation before touching
       anything, so a late tick becomes a no-op. */
    gen++;
    stop();
    V.style.filter = ''; V.style.transform = ''; V.style.mixBlendMode = '';
    V.style.visibility = ''; CV.style.display = 'none';
    V.playbackRate = 1;
    echo.style.display = 'none'; echo.style.mixBlendMode = ''; echo.pause();
    resume();
  }
  /* Temporal effects pause the element and drive currentTime by hand,
     so returning to source has to actually restart playback. A bare
     play() is not enough: called while a seek is still in flight the
     promise rejects with AbortError, and swallowing that left the video
     frozen for good. Wait out the seek, and retry once if it still
     loses the race. */
  function resume() {
    if (!V.paused) return;
    const go = () => V.play().catch(() => {});
    if (V.seeking) d.on(V, 'seeked', go, { once: true });
    else go();
    // watchdog: a play() that loses a race to an in-flight seek just
    // rejects, and nothing retries it on its own
    const g = gen;
    d.timeout(() => { if (g === gen && V.paused) V.play().catch(() => {}); }, 220);
  }
  const filt = css => () => { V.style.filter = css; };
  function startEcho(mode) {
    echo.style.display = 'block';
    echo.style.mixBlendMode = mode;
    echo.currentTime = (V.currentTime + 0.55) % (V.duration || 6);
    echo.play().catch(() => {});
    // hold the offset — the two decodes drift apart otherwise
    const g = gen;
    timer = d.interval(() => {
      if (g !== gen) return;
      const d = V.duration || 6;
      echo.currentTime = (V.currentTime + 0.55) % d;
    }, 400);
  }

  /* ── the canvas pipeline ──────────────────────────────────────
     Filters are declarative — you hand the compositor a graph and it
     runs on the GPU. Useful, but they never show that the frame is
     addressable. These do: the video is decoded into a canvas, the
     pixels (or whole past frames) are read back, rearranged, and
     written out. That is the actual claim — a baked file is immutable,
     the buffer it decodes into is not.

     Rendered at 270×480 and scaled up: a quarter of the pixels to
     touch per frame, and the chunk is honest about where the work is
     happening. */
  const CV = root.getElementById('fxCanvas');
  const cx = CV.getContext('2d', { willReadFrequently: true });
  /* 16:9 source: the sheet's 270×480 (0.375 of 720×1280) becomes 480×270
     (0.375 of 1280×720) — the same pixel count, turned landscape. */
  const CW = 480, CH = 270;
  CV.width = CW; CV.height = CH;
  const NHIST = 44;
  const hist = Array.from({ length: NHIST }, () => {
    const c = document.createElement('canvas'); c.width = CW; c.height = CH;
    return { c, x: c.getContext('2d') };
  });
  let hi = 0;
  /* How many slots actually hold a decoded frame. The buffer starts
     empty, so an effect that reaches deeper than this would sample
     blank canvases — a black wedge for the first ~0.7s after switching
     on. Reset whenever the pipeline starts. */
  let filled = 0;
  const prev = document.createElement('canvas'); prev.width = CW; prev.height = CH;
  const px = prev.getContext('2d');

  /* Mirror the element's own `object-fit: cover` when copying into the
     buffer. drawImage(V,0,0,CW,CH) stretches, which is invisible for the
     baked 720×1280 file (same aspect) and mangles a 1280×720 webcam into
     a squashed portrait the moment the camera toggle is used. */
  function drawCover(ctx, src) {
    const sw = src.videoWidth || CW, sh = src.videoHeight || CH;
    const k = Math.max(CW / sw, CH / sh);
    const dw = sw * k, dh = sh * k;
    ctx.drawImage(src, (CW - dw) / 2, (CH - dh) / 2, dw, dh);
  }

  const canvasOn = () => { CV.style.display = 'block'; V.style.visibility = 'hidden'; filled = 0; };
  const RENDER = {
    // every horizontal band samples a DIFFERENT stored frame, so the
    // vertical axis of the image becomes the time axis
    slitscan: (t) => {
      /* Two things make this read as time rather than as a smudge: the
         band is thin enough that the seams disappear, and the depth
         breathes. At a fixed shallow depth the whole frame is within a
         third of a second of itself and the effect is nearly invisible;
         swept from shallow to the full buffer it repeatedly pulls the
         image apart into a column of different moments and puts it
         back. The gamma bends the axis so the top half stays near
         'now' and the drama lives in the bottom. */
      const band = 2;
      const depth = Math.min(filled,
        (NHIST - 1) * (0.30 + 0.70 * (0.5 - 0.5 * Math.cos(t * 0.55))));
      for (let y = 0; y < CH; y += band) {
        const age = Math.round(Math.pow(y / CH, 1.45) * depth);
        const f = hist[(hi - age + NHIST) % NHIST];
        cx.drawImage(f.c, 0, y, CW, band, 0, y, CW, band);
      }
    },
    ripple: (t) => {
      /* Displacing a band sideways exposes the frame's own edge — a
         black wedge that gives the trick away. The fix is overscan:
         sample from a Z-times-zoomed inset of the source, so every band
         has (Z-1)/2 * CW px of material beyond each edge to slide in
         from. Z is chosen so that margin exceeds peak displacement. */
      const band = 2, AMP = 20, M = 30;   // M is the cover; must exceed AMP
      const Z = (CW + 2 * M) / CW;        // uniform zoom implied by that cover
      const insetY = (CH - CH / Z) / 2;   // matching vertical inset, so aspect holds
      const src = hist[hi].c;
      for (let y = 0; y < CH; y += band) {
        const swell = Math.sin(t * 0.7);
        const dx = (Math.sin(y * 0.045 + t * 3.1) * 0.7 +
                    Math.sin(y * 0.017 - t * 1.9) * 0.3) * AMP * swell;
        cx.drawImage(src,
          0, insetY + y / Z, CW, band / Z,      // full width in, vertically inset
          dx - M, y, CW + 2 * M, band);         // wider than the canvas, then displaced
      }
    },
    // hold blocks from an older frame — motion vectors without the
    // keyframe, which is what a real datamosh is
    mosh: (t) => {
      cx.drawImage(hist[hi].c, 0, 0);
      const old = hist[(hi - 9 + NHIST) % NHIST].c;
      for (let i = 0; i < 90; i++) {
        const bw = 18 + ((i * 37) % 46), bh = 12 + ((i * 53) % 34);
        const sx = (i * 97 + Math.floor(t * 40) * 13) % (CW - bw);
        const sy = (i * 131 + Math.floor(t * 17) * 29) % (CH - bh);
        cx.drawImage(old, sx, sy, bw, bh, sx, sy, bw, bh);
      }
    },
    /* The frame is drawn straight through — this is the video, not a
       replacement for it. What sits over the top is pixelation applied
       only where a moving field says so: three low-frequency sines
       summed into blobby regions that drift across the picture, and
       inside those regions each cell is flattened to the average colour
       of the pixels underneath it.

       Averaging the cell rather than sampling its centre pixel is what
       makes it read as mosaic instead of as a dot screen. Cells only
       just over the threshold are drawn at partial alpha, so a patch
       fades in at its edges rather than popping on square by square. */
    pixels: (t) => {
      const src = hist[hi].c;
      cx.drawImage(src, 0, 0);                       // the video, untouched
      const d = cx.getImageData(0, 0, CW, CH).data;
      const cell = 18;
      for (let y = 0; y < CH; y += cell) {
        const gy = y / cell, y1 = Math.min(CH, y + cell);
        for (let x = 0; x < CW; x += cell) {
          const gx = x / cell;
          /* Incommensurate spatial and temporal frequencies on purpose.
             With rounder numbers the three terms periodically fall into
             phase across the whole grid, and coverage swung 34% -> 6% —
             the patches all leaving at once. Detuned, the field always
             has somewhere high and somewhere low. */
          const field = Math.sin(gx * 0.41 + t * 0.55)
                      + Math.sin(gy * 0.29 - t * 0.83)
                      + Math.sin(gx * 0.19 - gy * 0.23 + t * 1.10);
          const over = field - 0.30;
          if (over <= 0) continue;
          let r = 0, g = 0, b = 0, n = 0;
          const x1 = Math.min(CW, x + cell);
          for (let sy = y; sy < y1; sy += 6) {
            for (let sx = x; sx < x1; sx += 6) {
              const i = (sy * CW + sx) * 4;
              r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
            }
          }
          /* A short ramp on purpose. At 1.6 the majority of covered
             cells sat part-blended and the patches read as haze over
             the picture rather than as pixelation; at 4 a cell reaches
             full opacity almost immediately and only the outermost ring
             of a patch is soft, which is the bit that stops it popping
             on square by square. */
          cx.globalAlpha = Math.min(1, over * 4);
          cx.fillStyle = `rgb(${r / n | 0},${g / n | 0},${b / n | 0})`;
          cx.fillRect(x, y, cell, cell);
        }
      }
      cx.globalAlpha = 1;
    },
    // the canvas is its own input — last frame scaled and rotated back in
    feedback: (t) => {
      cx.save();
      cx.translate(CW / 2, CH / 2);
      cx.rotate(Math.sin(t * 0.5) * 0.02);
      cx.scale(1.045, 1.045);
      cx.globalAlpha = 0.86;
      cx.drawImage(prev, -CW / 2, -CH / 2);
      cx.restore();
      cx.globalAlpha = 0.34;
      cx.drawImage(hist[hi].c, 0, 0);
      cx.globalAlpha = 1;
    },
    /* Three things the single-tier version was missing: enough wedges
       to read as a mandala rather than a pinwheel, a second tier
       turning the other way so the centre never goes static, and a
       breathing zoom so the pattern opens and closes. The inner tier
       composites with 'lighter', which is what gives the core its
       bloom where the two tiers agree. */
    kaleido: (t) => {
      const src = hist[hi].c;
      const breathe = 1 + Math.sin(t * 0.75) * 0.14;
      const wedges = (n, rot, zoom, alpha, comp, clipR) => {
        cx.save();
        cx.globalAlpha = alpha;
        cx.globalCompositeOperation = comp;
        cx.translate(CW / 2, CH / 2);
        cx.rotate(rot);
        if (clipR) { cx.beginPath(); cx.arc(0, 0, clipR, 0, 6.2832); cx.clip(); }
        for (let i = 0; i < n; i++) {
          cx.save();
          cx.rotate((i / n) * Math.PI * 2);
          if (i % 2) cx.scale(1, -1);
          cx.beginPath();
          cx.moveTo(0, 0);
          cx.arc(0, 0, CH, -Math.PI / n, Math.PI / n);
          cx.closePath();
          cx.clip();
          cx.drawImage(src, -CW * 0.34 * zoom, -CH * 0.52 * zoom, CW * 1.15 * zoom, CH * 1.15 * zoom);
          cx.restore();
        }
        cx.restore();
      };
      cx.fillStyle = '#05060a'; cx.fillRect(0, 0, CW, CH);
      wedges(10, t * 0.16, breathe, 1, 'source-over', 0);
      wedges(6, -t * 0.29, 0.55 / breathe, 0.6, 'lighter', CH * 0.30 * breathe);
    },
  };

  function startCanvas(kind) {
    canvasOn();
    const t0 = performance.now(), g = gen;
    const loop = () => {
      if (g !== gen) return;
      const t = (performance.now() - t0) / 1000;
      if (V.readyState >= 2) {
        hi = (hi + 1) % NHIST;
        drawCover(hist[hi].x, V);                     // decode → buffer
        if (filled < NHIST - 1) filled++;
      }
      cx.clearRect(0, 0, CW, CH);
      RENDER[kind](t);
      px.clearRect(0, 0, CW, CH);
      px.drawImage(CV, 0, 0);                          // keep for feedback / mosh
      raf = requestAnimationFrame(loop);
    };
    loop();
  }

  const FX = {
    none: () => {},
    slitscan: () => startCanvas('slitscan'),
    ripple:   () => startCanvas('ripple'),
    mosh:     () => startCanvas('mosh'),
    pixels:   () => startCanvas('pixels'),
    feedback: () => startCanvas('feedback'),
    kaleido:  () => startCanvas('kaleido'),
    edge:      filt('url(#fx-edge)'),
    split:     filt('url(#fx-split)'),
    bloom:     filt('blur(2px) brightness(1.22) contrast(1.4) saturate(1.15)'),
    /* One editable curve replaces the four temporal presets, because
       ramp / ping-pong / slow-mo were only ever three samples of the
       same control: a mapping from loop time to video time. Draw the
       mapping and you get all of them, plus every shape in between.

       Seeks are throttled and gated on V.seeking. Assigning currentTime
       every animation frame is what made the old ping-pong stall
       mid-clip — each assignment cancels the in-flight seek, so with a
       fast enough loop the decoder never lands on a frame at all. */
    curve: () => {
      V.pause();
      let last = -1;
      const g = gen;
      timer = d.interval(() => {
        if (g !== gen || V.seeking) return;
        const d = V.duration || 6;
        const u = (performance.now() / (d * 1000)) % 1;
        const target = Math.max(0, Math.min(0.9995, curveY(u))) * d;
        if (Math.abs(target - last) > 0.012) { V.currentTime = target; last = target; }
        headAt(u);
      }, 40);
    },
    mirror: () => { V.style.transform = 'scaleX(-1)'; },
    echo:   () => startEcho('screen'),
    diff:   () => startEcho('difference'),
  };

  /* ── the curve: cubic bezier, endpoints pinned, handles draggable ──
     Handles may leave the 0..1 box on Y, which is what produces
     backtracking — the old "ping-pong" is just a curve that goes down
     before it goes up. */
  let P = [0.25, 0.1, 0.25, 1];
  const svg = root.getElementById('curveSvg');
  const $ = id => root.getElementById(id);
  const bezX = (s2, a2, b2) => 3*(1-s2)*(1-s2)*s2*a2 + 3*(1-s2)*s2*s2*b2 + s2*s2*s2;
  const bezY = (s2, a2, b2) => 3*(1-s2)*(1-s2)*s2*a2 + 3*(1-s2)*s2*s2*b2 + s2*s2*s2;
  function curveY(t) {                       // solve x(s)=t, then read y(s)
    let lo = 0, hi = 1, s2 = t;
    for (let i = 0; i < 20; i++) {
      const x = bezX(s2, P[0], P[2]);
      if (Math.abs(x - t) < 1e-4) break;
      if (x < t) lo = s2; else hi = s2;
      s2 = (lo + hi) / 2;
    }
    return bezY(s2, P[1], P[3]);
  }
  const SX = v => v * 100, SY = v => (1 - v) * 100;
  function drawCurve() {
    $('cvPath').setAttribute('d', `M0,100 C${SX(P[0])},${SY(P[1])} ${SX(P[2])},${SY(P[3])} 100,0`);
    $('cvH1').setAttribute('cx', SX(P[0])); $('cvH1').setAttribute('cy', SY(P[1]));
    $('cvH2').setAttribute('cx', SX(P[2])); $('cvH2').setAttribute('cy', SY(P[3]));
    $('cvArm1').setAttribute('x1', 0); $('cvArm1').setAttribute('y1', 100);
    $('cvArm1').setAttribute('x2', SX(P[0])); $('cvArm1').setAttribute('y2', SY(P[1]));
    $('cvArm2').setAttribute('x1', 100); $('cvArm2').setAttribute('y1', 0);
    $('cvArm2').setAttribute('x2', SX(P[2])); $('cvArm2').setAttribute('y2', SY(P[3]));
    $('cvReadout').textContent = `cubic-bezier(${P.map(v => (+v.toFixed(2)).toString().replace(/^0\./, '.')).join(', ')})`;
  }
  function headAt(u) {
    const h = $('cvHead');
    h.setAttribute('cx', SX(u)); h.setAttribute('cy', SY(curveY(u)));
  }
  let drag = null;
  const toLocal = e => {
    const r = svg.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 128 - 14, ((e.clientY - r.top) / r.height) * 128 - 14];
  };
  d.on(svg, 'pointerdown', e => {
    const [mx, my] = toLocal(e);
    const d1 = Math.hypot(mx - SX(P[0]), my - SY(P[1]));
    const d2 = Math.hypot(mx - SX(P[2]), my - SY(P[3]));
    drag = d1 < d2 ? 1 : 2;
    svg.setPointerCapture(e.pointerId);
  });
  d.on(svg, 'pointermove', e => {
    if (!drag) return;
    const [mx, my] = toLocal(e);
    const x = Math.max(0, Math.min(1, mx / 100));
    const y = Math.max(-0.6, Math.min(1.6, 1 - my / 100));   // overshoot allowed
    if (drag === 1) { P[0] = x; P[1] = y; } else { P[2] = x; P[3] = y; }
    drawCurve();
  });
  d.on(svg, 'pointerup', e => { drag = null; svg.releasePointerCapture(e.pointerId); });
  const chips = [...root.querySelectorAll('.cv-chip')];
  function markPreset() {
    chips.forEach(ch => ch.classList.toggle('is-on',
      ch.dataset.cv.split(',').map(Number).every((v, i) => Math.abs(v - P[i]) < 0.02)));
  }
  chips.forEach(ch => d.on(ch, 'click', () => {
    P = ch.dataset.cv.split(',').map(Number); drawCurve(); markPreset();
  }));
  drawCurve(); headAt(0); markPreset();

  const resetBtn = root.getElementById('fxReset');
  const curveEl = root.getElementById('fxCurve');
  cards.forEach(c => d.on(c, 'click', () => {
    cards.forEach(o => o.classList.toggle('is-on', o === c));
    resetBtn.classList.remove('is-on');
    curveEl.classList.toggle('is-open', c.dataset.fx === 'curve');
    reset();
    (FX[c.dataset.fx] || FX.none)();
  }));
  d.on(resetBtn, 'click', () => {
    cards.forEach(o => o.classList.remove('is-on'));
    resetBtn.classList.add('is-on');
    curveEl.classList.remove('is-open');
    reset();
  });

  /* ── live camera ──────────────────────────────────────────────
     The whole rack reads from one <video>, so pointing that element at
     a MediaStream instead of a file swaps the source for every effect
     at once without touching any of them — which is the argument the
     panel is making: the effects operate on the decoded frame, and the
     frame does not care where it came from.

     Three of them do care, because they need a SEEKABLE source: the
     curve maps loop time onto video time, and echo/difference need the
     source delayed against itself. A live stream has no duration and
     cannot be sought, so those are disabled while the camera is on
     rather than left to fail silently.

     getUserMedia needs a secure context (localhost qualifies) and, in
     an iframe, an explicit allow="camera" — which the app's reference
     viewer now sets. Nothing is recorded or sent anywhere; the stream
     is decoded into the same canvas buffer as the file and the tracks
     are stopped on toggle-off, which releases the camera light. */
  const camBtn = root.getElementById('fxCam');
  const camLabel = root.getElementById('fxCamLabel');
  const NEEDS_FILE = ['curve', 'echo', 'diff'];
  let stream = null, dead = false;

  function setLive(on) {
    cards.forEach(c => {
      if (!NEEDS_FILE.includes(c.dataset.fx)) return;
      c.disabled = on;
      c.title = on ? 'needs a seekable file — not available on the live feed' : '';
    });
    const shell = root.getElementById('mplayer');
    if (shell) shell.dataset.live = on ? '1' : '0';
    camBtn.setAttribute('aria-checked', String(on));
    camLabel.textContent = 'camera';
  }

  async function camOn() {
    let s;
    try {
      s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
    } catch (err) {
      // denied, no device, or blocked by permissions policy — all land here
      // the switch never flips on a failure — it only reports why
      camBtn.classList.add('is-err');
      camLabel.textContent = err && err.name === 'NotAllowedError' ? 'denied' : 'no camera';
      d.timeout(() => { camBtn.classList.remove('is-err'); setLive(false); }, 2400);
      return;
    }
    // extraction: the demo may have unmounted while the permission prompt was open
    if (dead) { s.getTracks().forEach(t => t.stop()); return; }
    stream = s;
    const label = root.getElementById('vcutLabel');
    const track = s.getVideoTracks()[0], set = track && track.getSettings ? track.getSettings() : {};
    if (label) label.textContent = `16:9 · live camera · ${set.width || '?'}×${set.height || '?'}`;
    reset();                       // drop any effect that assumes a file
    V.srcObject = stream;
    V.loop = false;
    V.play().catch(() => {});
    setLive(true);
    root.dispatchEvent(new CustomEvent('wam-cam', { detail: { on: true } }));
  }

  function camOff() {
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = null;
    reset();
    const label = root.getElementById('vcutLabel');
    if (label) label.textContent = label.dataset.file;
    V.srcObject = null;
    V.load();                      // back to the <source> file
    V.loop = true;
    V.play().catch(() => {});
    setLive(false);
    root.dispatchEvent(new CustomEvent('wam-cam', { detail: { on: false } }));
  }

  d.on(camBtn, 'click', () => {
    if (camBtn.getAttribute('aria-checked') === 'true') camOff();
    else camOn();
  });

  /* extraction: teardown the sheet never needed. Bumping gen turns any
     late tick into a no-op, the same way reset() does. */
  d.add(() => {
    dead = true; gen++; stop();
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = null;
    for (const v of [V, echo]) { v.pause(); v.srcObject = null; v.removeAttribute('src'); v.querySelectorAll('source').forEach(s => s.remove()); v.load(); }
  });
}
