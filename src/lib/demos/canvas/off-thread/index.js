// @ts-nocheck -- untyped sheet code, extracted from design/techniques/canvas.html §5 (lines 3085–3377)
import { stage } from '../../_kit/stage.js';
import { createWAM } from '../../_kit/wam.js';
import { disposer } from '../../_kit/disposer.js';
import css from './demo.css?raw';
import html from './demo.html?raw';
import { T5, nsName } from './transport.js';
import { resolveRGB, createTokens } from './helpers.js';

/* ════════════════════════════════════════════════════════════════════════
   §5 · TRANSPORT — off-thread
   Slide fit (2026-09-17): ONE player, drawn by a worker through a
   transferred OffscreenCanvas, with a 90s visualizer docked to its right,
   drawn by the same worker through a second transferred canvas. The
   main-thread twin is gone; the main thread's own frame counter is the
   witness for "is the page blocked".
   ════════════════════════════════════════════════════════════════════════ */
export function mount(host) {
  const { root, body: demoBody, $ } = stage(host, { css, html });
  const WAM = createWAM({ root });
  const dsp = disposer();
  const tokens = createTokens(host, demoBody, 't5');
  const token = tokens.token;

  var reduced = matchMedia('(prefers-reduced-motion: reduce)');
  /* Rule 1 of the boot order: read the setting BEFORE touching the canvas.
     Transfer is one-way, and a reduced-motion load must never take a path
     it cannot come back from. */
  var startReduced = reduced.matches;
  var disposed = false;
  dsp.add(function () { disposed = true; freeRun = false; cancelAnimationFrame(mainRaf); mainRaf = 0; WAM.dispose(); tokens.dispose(); });

  /* Backing stores are FIXED and sized before transfer — the element no
     longer owns its bitmap afterwards. Drawn at exactly 1 CSS px per backing
     pixel: 400 + 16 gutter + 448 = the slide's 864 px well. */
  /* Housed (2026-09-17): the chassis takes 16 px a side and 102 px of
     height, leaving 832 x 342 for the two units: 384 + 12 + 436. */
  var W = 384, H = 342, VW = 436, VH = 342;
  /* One 4:00 track per loop, so the player's clock runs at wall-clock rate. */
  var LOOP_MS = 240000;
  var wkrCv = $('t5-worker-canvas'), fbCv = $('t5-fallback-canvas');
  var visCv = $('t5-vis-canvas'), fbVisCv = $('t5-vis-fallback-canvas');
  wkrCv.width = fbCv.width = W; wkrCv.height = fbCv.height = H;
  visCv.width = fbVisCv.width = VW; visCv.height = fbVisCv.height = VH;

  var TITLE = 'UNTITLED / A-SIDE — TRANSFER MASTER — 24 BIT 96 KHZ';
  var POSTER = 0.42;

  function rgbOf(name) { return T5.SKIN_CSS(resolveRGB(token(name))); }
  var p = '--t5b-';
  var INK = {
    face: rgbOf(p + 'face'), hi: rgbOf(p + 'hi'), lt: rgbOf(p + 'lt'),
    sh: rgbOf(p + 'sh'), dk: rgbOf(p + 'dk'), well: rgbOf(p + 'well'),
    lcd: rgbOf(p + 'lcd'), lcdDim: rgbOf(p + 'lcd-dim'), sig: rgbOf(p + 'sig'),
    hot: rgbOf(p + 'hot'), cap: rgbOf(p + 'cap'), ghost: rgbOf(p + 'ghost'),
    /* the oil-film stops, as [r, g, b] triples for the palette LUT */
    oil: [0, 1, 2, 3, 4, 5].map(function (i) { return resolveRGB(token(p + 'oil-' + i)); })
  };

  /* Once stood down it stays stood down: a LATE pong must not transfer the
     canvas underneath a fallback that is already showing. */
  var stoodDown = false;
  var host_ = 'main', worker = null, blobUrl = null;
  var mainFrames = 0, workerFrames = 0, freeRun = false, mainRaf = 0;
  var fb = null;
  var note = $('t5-note');

  /* The fallback path only: the same chassis and live layers, on the main
     thread, into the two fallback canvases. */
  function fieldCanvas(g) { var c = document.createElement('canvas'); c.width = g.fW; c.height = g.fH; return c; }
  function fbInit() {
    if (fb) return;
    fbCv.style.display = 'block'; fbVisCv.style.display = 'block';
    var ch = document.createElement('canvas'); ch.width = W; ch.height = H;
    var vch = document.createElement('canvas'); vch.width = VW; vch.height = VH;
    var cx = ch.getContext('2d'), vcx = vch.getContext('2d');
    var g = T5.T5_CHROME(cx, W, H, INK); T5.T5_CAPS(cx, INK, g);
    var vg = T5.T5_VIS_CHROME(vcx, VW, VH, INK);
    var ctx = fbCv.getContext('2d'), vctx = fbVisCv.getContext('2d');
    fb = {
      ch: ch, vch: vch, ctx: ctx, vctx: vctx,
      live: T5.T5_LIVE(ctx, W, H, INK, g, TITLE, 'scope'),
      vlive: T5.T5_VIS_LIVE(vctx, VW, VH, INK, vg, fieldCanvas(vg))
    };
  }
  function fbPaint(t) {
    if (!fb) return;
    fb.ctx.drawImage(fb.ch, 0, 0); fb.live(t, mainFrames);
    fb.vctx.drawImage(fb.vch, 0, 0); fb.vlive(t, mainFrames);
  }

  function standDown(msg, expected) {
    if (stoodDown) return;
    stoodDown = true;
    host_ = 'main';
    fbInit();
    $('t5-host').textContent = 'main-thread fallback';
    $('t5-vis-host').textContent = 'main-thread fallback';
    $('t5-worker-frames').textContent = '—';
    $('t5-paint-ms').textContent = '—';
    note.className = expected ? 't5-note' : 't5-note t5-bad';
    note.textContent = expected
      ? 'OFF-THREAD STOOD DOWN — ' + msg + '. The player and visualizer are drawn by the main thread, which is the correct behaviour here.'
      : 'OFF-THREAD UNAVAILABLE — ' + msg + '. The player and visualizer are drawn by the main thread, so blocking it will freeze them.';
    if (!expected) console.warn('[canvas/off-thread] ' + msg);
    demo.render(demo.t);
  }

  function hashOf(d, stride, seed) {
    var hh = seed, i;
    for (i = 0; i < d.length; i += stride) { hh ^= d[i]; hh = (hh * 0x01000193) >>> 0; }
    return hh >>> 0;
  }

  function paintMsText(v) { return v < 0 ? '—' : (v < 10 ? v.toFixed(2) : v.toFixed(1)) + ' ms'; }

  var demo = WAM.clock('t5-stage', {
    el: $('t5-world'), dur: LOOP_MS, poster: POSTER,
    render: function (t) {
      mainFrames++;
      if (host_ === 'worker') worker.postMessage({ type: 'render', t: t });
      else fbPaint(t);
      $('t5-main-frames').textContent = mainFrames.toLocaleString();
    }
  });
  /* WAM.clock's cost meter would measure postMessage here, not drawing, so
     demo.cost is never printed; the worker reports its own paint cost. */

  if (startReduced || !('transferControlToOffscreen' in wkrCv) || typeof Worker === 'undefined') {
    standDown(startReduced
      ? 'reduced motion is on, so the canvases were never transferred'
      : 'this engine has no OffscreenCanvas transfer', startReduced);
  } else {
    /* The worker body is assembled from Function.prototype.toString(), inside
       a wrapper whose parameter is whatever the bundler named the namespace
       binding (read back from nsName's own source). In dev it is `self`. */
    var NS = /return\s+([\w$]+)/.exec(String(nsName))[1];
    var body =
      '(function (' + NS + ') {\n' +
      NS + '.SKIN_BEVEL = ' + T5.SKIN_BEVEL + ';\n' +
      NS + '.T5_FONT = ' + JSON.stringify(T5.T5_FONT) + ';\n' +
      NS + '.T5_TEXT = ' + T5.T5_TEXT + ';\n' +
      NS + '.T5_WIDTH = ' + T5.T5_WIDTH + ';\n' +
      NS + '.T5_CHROME = ' + T5.T5_CHROME + ';\n' +
      NS + '.T5_CAPS = ' + T5.T5_CAPS + ';\n' +
      NS + '.T5_ROW = ' + T5.T5_ROW + ';\n' +
      NS + '.T5_VIS = { bars: ' + T5.T5_VIS.bars + ', scope: ' + T5.T5_VIS.scope + ' };\n' +
      NS + '.T5_LIVE = ' + T5.T5_LIVE + ';\n' +
      NS + '.T5_OIL_LUT = ' + T5.T5_OIL_LUT + ';\n' +
      NS + '.T5_OIL_FIELD = ' + T5.T5_OIL_FIELD + ';\n' +
      NS + '.T5_VIS_CHROME = ' + T5.T5_VIS_CHROME + ';\n' +
      NS + '.T5_VIS_LIVE = ' + T5.T5_VIS_LIVE + ';\n' +
      '(' + T5.T5_WORKER + ')();\n' +
      '})(self);\n' +
      '//# sourceURL=transport-worker.js';
    blobUrl = URL.createObjectURL(new Blob([body], { type: 'text/javascript' }));
    worker = new Worker(blobUrl);                 /* classic, never {type:'module'} */
    dsp.add(function () { worker.terminate(); if (blobUrl) URL.revokeObjectURL(blobUrl); });
    worker.onerror = function () { standDown('the worker failed to start'); };

    var pinged = false, parityDone = false;
    var PING_MS = 2500;
    var pingTimer = dsp.timeout(function () {
      if (!pinged) standDown('the worker did not answer a ping within ' + PING_MS + ' ms');
    }, PING_MS);

    worker.onmessage = function (e) {
      if (stoodDown) return;
      var m = e.data;
      if (m.type === 'pong') {
        pinged = true; clearTimeout(pingTimer);
        /* Ping FIRST, then transfer: transferring into a dead worker is
           unrecoverable. */
        var off = wkrCv.transferControlToOffscreen();
        var offVis = visCv.transferControlToOffscreen();
        host_ = 'worker';
        $('t5-host').textContent = 'worker · OffscreenCanvas';
        $('t5-vis-host').textContent = 'same worker · OffscreenCanvas';
        worker.postMessage({
          type: 'init', canvas: off, visCanvas: offVis, w: W, h: H, vw: VW, vh: VH,
          ink: INK, title: TITLE, vis: 'scope', dur: LOOP_MS
        }, [off, offVis]);
      } else if (m.type === 'ready') {
        URL.revokeObjectURL(blobUrl); blobUrl = null;
        worker.postMessage({ type: 'render', t: POSTER, parity: true });
      } else if (m.type === 'rendered') {
        workerFrames = m.n;
        $('t5-worker-frames').textContent = workerFrames.toLocaleString();
        $('t5-paint-ms').textContent = paintMsText(m.paintMs);
        if (m.hash && !parityDone) {
          parityDone = true;
          /* Boot parity, kept silent: the same functions run on a scratch
             canvas here must hash to what the worker drew. It is the guard
             on the closure-free rule — a free variable works on the main
             thread and is undefined in the worker. Pass: nothing to show.
             Fail: stand down to the main-thread fallback and warn. */
          var s1 = document.createElement('canvas'); s1.width = W; s1.height = H;
          var s2 = document.createElement('canvas'); s2.width = VW; s2.height = VH;
          var c1 = s1.getContext('2d', { willReadFrequently: true });
          var c2 = s2.getContext('2d');
          var k1 = document.createElement('canvas'); k1.width = W; k1.height = H;
          var kx1 = k1.getContext('2d');
          var g = T5.T5_CHROME(kx1, W, H, INK); T5.T5_CAPS(kx1, INK, g);
          var vg = T5.T5_VIS_CHROME(c2, VW, VH, INK);
          c1.drawImage(k1, 0, 0); T5.T5_LIVE(c1, W, H, INK, g, TITLE, 'scope')(m.t, m.drawnWith);
          /* the visualizer is checked by its field BYTES, not its scaled
             raster: smoothing is allowed to round differently per context */
          var vl = T5.T5_VIS_LIVE(c2, VW, VH, INK, vg, fieldCanvas(vg));
          vl(m.t, m.drawnWith);
          var mine = hashOf(vl.data, 7, hashOf(c1.getImageData(0, 0, W, H).data, 997, 0x811c9dc5));
          host.dataset.parity = mine === m.hash ? 'ok' : 'fail';
          if (mine !== m.hash) {
            standDown('boot parity failed — worker 0x' + m.hash.toString(16) + ' vs main 0x' + mine.toString(16));
          }
        }
      } else if (m.type === 'frame') {
        workerFrames = m.n;
        $('t5-worker-frames').textContent = workerFrames.toLocaleString();
        $('t5-paint-ms').textContent = paintMsText(m.paintMs);
      }
    };
    worker.postMessage({ type: 'ping' });
  }

  /* Free-run: the worker drives itself off its own rAF instead of waiting
     for the main thread to post each frame. The main thread keeps its own
     rAF only to count — that count is the witness. Mutually exclusive with
     the clock, or two clocks drive one render. */
  function setFreeRun(on) {
    freeRun = on;
    $('t5-freerun').classList.toggle('t5-on', on);
    $('t5-freerun').textContent = on ? 'stop free-run' : 'free-run worker';
    if (on) {
      var tStart = demo.t;
      demo.pause();
      mainFrames = 0; workerFrames = 0;
      if (host_ === 'worker') worker.postMessage({ type: 'run', t: tStart });
      var t0 = performance.now() - tStart * LOOP_MS;
      (function tick(now) {
        mainFrames++;
        if (host_ !== 'worker') fbPaint(((now - t0) % LOOP_MS) / LOOP_MS);
        $('t5-main-frames').textContent = mainFrames.toLocaleString();
        if (freeRun) mainRaf = requestAnimationFrame(tick);
      })(performance.now());
    } else {
      cancelAnimationFrame(mainRaf); mainRaf = 0;
      if (host_ === 'worker') worker.postMessage({ type: 'stop' });
      if (!reduced.matches) demo.play();
    }
  }
  dsp.on($('t5-freerun'), 'click', function () { setFreeRun(!freeRun); });

  dsp.on($('t5-block'), 'click', function () {
    if (!freeRun) setFreeRun(true);
    var btn = this;
    btn.disabled = true;
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      if (disposed) return;
      var m0 = mainFrames, w0 = workerFrames;
      var t0 = performance.now(), end = t0 + 800;
      while (performance.now() < end) { /* deliberately blocking */ }
      /* Read the MAIN counter at the instant the thread comes back. The
         worker's count arrives by postMessage, which a blocked thread is not
         draining, so it is read after a short settle over the longer window.
         Both remaining errors point against the result. */
      var dmBlock = mainFrames - m0;
      dsp.timeout(function () {
        var span = performance.now() - t0;
        var dw = workerFrames - w0;
        $('t5-last-block').textContent = host_ === 'worker'
          ? dmBlock + ' / ' + dw
          : dmBlock + ' / —';
        note.className = 't5-note';
        note.textContent = host_ !== 'worker'
          ? 'The player and visualizer are on the main thread here, so they froze with it.'
          : 'Blocked the main thread for 800 ms. The page drew ' + dmBlock + ' frame' + (dmBlock === 1 ? '' : 's') +
            ' while blocked; the worker drew ' + dw + ' over the ' + Math.round(span) + ' ms window.';
        btn.disabled = false;
      }, 50);
    }); });
  });

  /* Reduced motion changing at runtime. The HOST is latched at load; the
     POSTER is not. Do not try to reclaim a transferred canvas; it throws. */
  dsp.on(reduced, 'change', function () {
    if (reduced.matches) {
      if (freeRun) setFreeRun(false);
      if (host_ === 'worker') { worker.postMessage({ type: 'stop' }); worker.postMessage({ type: 'render', t: POSTER }); }
    }
  });

  tokens.reportTokenMisses();
  return function dispose() { dsp.run(); };
}
