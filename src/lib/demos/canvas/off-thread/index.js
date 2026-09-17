// @ts-nocheck -- untyped sheet code, extracted from design/techniques/canvas.html §5 (lines 3085–3377)
import { stage } from '../../_kit/stage.js';
import { createWAM } from '../../_kit/wam.js';
import { disposer } from '../../_kit/disposer.js';
import css from './demo.css?raw';
import html from './demo.html?raw';
import { T5, nsName } from './transport.js';
import { atFloor, ms, resolveRGB, createTokens } from './helpers.js';

/* ════════════════════════════════════════════════════════════════════════
   §5 · TRANSPORT — off-thread
   ════════════════════════════════════════════════════════════════════════ */
export function mount(host) {
  const { root, body: demoBody, $ } = stage(host, { css, html });
  const WAM = createWAM({ root });
  const dsp = disposer();
  const tokens = createTokens(host, demoBody, 't5');
  const token = tokens.token;

  var reduced = matchMedia('(prefers-reduced-motion: reduce)');
  /* Rule 1 of the boot order: read the setting BEFORE touching the canvas.
     Every other rule depends on this being first, because transfer is
     one-way and a reduced-motion load must never take a path it cannot
     come back from. */
  var startReduced = reduced.matches;
  var disposed = false;
  /* stop the free-run loop and the clock first, the worker (registered later) before them */
  dsp.add(function () { disposed = true; freeRun = false; cancelAnimationFrame(mainRaf); mainRaf = 0; WAM.dispose(); tokens.dispose(); });

  /* The backing store is FIXED, not fitted to the CSS width. It is sized
     once, before transfer, and can never be resized from here afterwards —
     the element no longer owns its bitmap. It is also small on purpose: a
     blitted chassis has a native size, and `image-rendering: pixelated`
     scales it by whole pixels rather than smearing it. */
  /* 560 x 124 is the content's own size — the first pass used 440 x 200 and
     left the bottom 40% of both chassis empty, which is what a backing store
     chosen before the layout looks like. A player is a wide, shallow object;
     the classic window was 275 x 116. */
  var W = 560, H = 340;
  var mainCv = $('t5-main-canvas'), wkrCv = $('t5-worker-canvas'), fbCv = $('t5-fallback-canvas');
  [mainCv, wkrCv, fbCv].forEach(function (cv) { cv.width = W; cv.height = H; });

  var TITLE = 'UNTITLED / A-SIDE — TRANSFER MASTER — 24 BIT 96 KHZ';

  function rgbOf(name) { return T5.SKIN_CSS(resolveRGB(token(name))); }
  /* Two ink sets from one helper, because unit 2 is a different SKIN — which
     is the whole reason skins existed: the player was one program and
     everybody's looked different. Two identical panels would also be a
     picture of one panel, and what this section proves is about threads, not
     about copy-paste. */
  function inkSet(p2) {
    return {
      face: rgbOf(p2 + 'face'), hi: rgbOf(p2 + 'hi'), lt: rgbOf(p2 + 'lt'),
      sh: rgbOf(p2 + 'sh'), dk: rgbOf(p2 + 'dk'), well: rgbOf(p2 + 'well'),
      lcd: rgbOf(p2 + 'lcd'), lcdDim: rgbOf(p2 + 'lcd-dim'), sig: rgbOf(p2 + 'sig')
    };
  }
  var INK = inkSet('--t5-');
  var INK_B = inkSet('--t5b-');

  var mainCtx = mainCv.getContext('2d');

  /* The sheet's two-canvas rule, and §5's exemption from it. Everywhere
     else chrome is a second canvas painted on resize only, so its per-frame
     cost is zero. §5 cannot do that: the worker owns exactly one
     transferred canvas and can never be handed a second. So both units
     paint the chassis ONCE into a buffer and composite it with a single
     drawImage per frame — the same shape on both threads, because the two
     players have to be identical for the comparison to mean anything. */
  var chromeCv = document.createElement('canvas');
  chromeCv.width = W; chromeCv.height = H;
  var chromeT0 = performance.now();
  var ccx = chromeCv.getContext('2d');
  var GEOM = T5.T5_CHROME(ccx, W, H, INK);
  T5.T5_CAPS(ccx, INK, GEOM);
  var chromeMs = performance.now() - chromeT0;

  /* unit 2's chassis, in its own inks, for the fallback path only — the
     worker paints its own when there is a worker */
  var chromeBCv = document.createElement('canvas'), GEOM_B = GEOM;
  chromeBCv.width = W; chromeBCv.height = H;
  function fbChrome() {
    var bx = chromeBCv.getContext('2d');
    GEOM_B = T5.T5_CHROME(bx, W, H, INK_B);
    T5.T5_CAPS(bx, INK_B, GEOM_B);
  }
  var mainLive = T5.T5_LIVE(mainCtx, W, H, INK, GEOM, TITLE);

  /* Once §5 has stood down it stays stood down, and this flag is what
     enforces it. Without it a LATE pong walked straight past the decision:
     the ping timed out, the fallback was shown, and then the worker
     answered, the canvas was transferred, and the worker painted happily
     underneath a blank fallback canvas that was still on top of it. Every
     readout said the worker was alive — host, parity, frame count — and the
     panel was black. A state machine with two ways into one state and no
     way to say which one it took. */
  var stoodDown = false;
  var host = 'main', worker = null, blobUrl = null;
  var mainFrames = 0, workerFrames = 0, freeRun = false, mainRaf = 0;
  var fbCtx = null, fbLive = null;
  var note = $('t5-note');

  function mainPaint(t) { mainCtx.drawImage(chromeCv, 0, 0); mainLive(t, mainFrames); }
  function fbPaint(t) { if (!fbLive) return; fbCtx.drawImage(chromeBCv, 0, 0); fbLive(t, mainFrames); }

  /* host is latched at load. Never a try/catch guard: that would turn a
     structural error — getContext on a transferred element — into a
     swallowed one. */
  function standDown(msg, expected) {
    if (stoodDown) return;
    stoodDown = true;
    host = 'main';
    fbCv.style.display = 'block';
    if (!fbCtx) { fbCtx = fbCv.getContext('2d'); fbChrome(); fbLive = T5.T5_LIVE(fbCtx, W, H, INK_B, GEOM_B, TITLE, 'scope'); }
    $('t5-host').textContent = 'main-thread fallback';
    note.hidden = false;
    note.className = expected ? 't5-note' : 't5-note t5-bad';
    note.textContent = expected
      ? 'OFF-THREAD STOOD DOWN — ' + msg + '. Both players are drawn by the main thread, which is the correct behaviour here and not a failure.'
      : 'OFF-THREAD UNAVAILABLE — ' + msg + '. Both players are now drawn by the main thread, so §5 demonstrates nothing and says so rather than looking like it worked.';
    $('t5-parity').textContent = expected ? 'not transferred' : 'fallback';
    demo.render(demo.t);
    fbPaint(demo.t);
  }

  function hashOf(ctx) {
    var d = ctx.getImageData(0, 0, W, H).data, h = 0x811c9dc5, i;
    for (i = 0; i < d.length; i += 997) { h ^= d[i]; h = (h * 0x01000193) >>> 0; }
    return h >>> 0;
  }

  var demo = WAM.clock('t5-stage', {
    el: $('t5-world'), dur: 12000, poster: 0.42,
    render: function (t) {
      mainFrames++;
      mainPaint(t);
      if (host === 'worker') worker.postMessage({ type: 'render', t: t });
      else fbPaint(t);
      $('t5-main-frames').textContent = mainFrames.toLocaleString();
      if (host !== 'worker') $('t5-worker-frames').textContent = '—';
    }
  });
  /* WAM.clock's cost meter brackets render(v) with performance.now(). For a
     proxy render that is the cost of postMessage, not the cost of drawing,
     so demo.cost is deliberately never printed for §5. */

  $('t5-chrome-ms').textContent = ms(chromeMs) + ' ms' + atFloor(chromeMs);

  if (startReduced || !('transferControlToOffscreen' in wkrCv) || typeof Worker === 'undefined') {
    standDown(startReduced
      ? 'reduced motion is on, so the canvas was never transferred — transfer is one-way, and a reduced-motion load must not take a path it cannot come back from'
      : 'this engine has no OffscreenCanvas transfer', startReduced);
  } else {
    /* EXTRACTION: the sheet's body assigned `self.X = <source>` at the
       worker's top level. The functions now live on a module namespace (see
       transport.js), and their text names that namespace by whatever the
       bundler called it, so the same assignments run inside a wrapper whose
       parameter IS that name and whose argument is the worker's global. In
       dev the name is `self` and the wrapper is a no-op. */
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
      '(' + T5.T5_WORKER + ')();\n' +
      '})(self);\n' +
      '//# sourceURL=transport-worker.js';
    blobUrl = URL.createObjectURL(new Blob([body], { type: 'text/javascript' }));
    worker = new Worker(blobUrl);                 /* classic, never {type:'module'} */
    /* EXTRACTION: the sheet never tore its worker down; the demo does. */
    dsp.add(function () { worker.terminate(); if (blobUrl) URL.revokeObjectURL(blobUrl); });
    worker.onerror = function () { standDown('the worker failed to start'); };

    var pinged = false;
    /* 2.5 s, not 750 ms. The original budget was set when this sheet booted
       one world; it now boots five, several of which write a megapixel
       before their first frame, and a worker that answers in 900 ms is a
       healthy worker on a busy thread rather than a dead one. */
    var PING_MS = 2500;
    var pingTimer = dsp.timeout(function () {
      if (!pinged) standDown('the worker did not answer a ping within ' + PING_MS + ' ms');
    }, PING_MS);

    worker.onmessage = function (e) {
      if (stoodDown) return;
      var m = e.data;
      if (m.type === 'pong') {
        pinged = true; clearTimeout(pingTimer);
        /* Ping FIRST, then transfer. Transferring into a dead worker is
           unrecoverable; pinging first is free. */
        var off = wkrCv.transferControlToOffscreen();
        host = 'worker';
        $('t5-host').textContent = 'worker · OffscreenCanvas';
        worker.postMessage({ type: 'init', canvas: off, w: W, h: H, ink: INK_B, title: TITLE, vis: 'scope' }, [off]);
      } else if (m.type === 'ready') {
        URL.revokeObjectURL(blobUrl); blobUrl = null;
        $('t5-chrome-ms').innerHTML = ms(chromeMs) + ' / ' + ms(m.chromeMs) + ' ms' + atFloor(Math.min(chromeMs, m.chromeMs));
        worker.postMessage({ type: 'render', t: 0.42 });
      } else if (m.type === 'rendered') {
        workerFrames = m.n;
        $('t5-worker-frames').textContent = workerFrames.toLocaleString();
        if (m.t === 0.42 && $('t5-parity').textContent === 'booting…') {
          /* Boot parity — the positive control for §5's central claim. The
             same chassis and the same live layer, run on a scratch canvas
             here, must hash to what the worker got. Without it, "the same
             render, off the main thread" is asserted.

             A blitter should make this free: integer rects, opaque fills,
             no scaling, no blending, so drawImage is a copy and there is
             nothing left for two rasterisers to disagree about. The
             register this replaced cost 1,284 differing pixels on a healthy
             worker for exactly the reasons a blitter does not have. */
          var scratch = document.createElement('canvas');
          scratch.width = W; scratch.height = H;
          var sctx = scratch.getContext('2d', { willReadFrequently: true });
          var sChrome = document.createElement('canvas');
          sChrome.width = W; sChrome.height = H;
          var scx = sChrome.getContext('2d');
          /* Against UNIT 2's inks and UNIT 2's visualiser, because that is
             what the worker was given. The check proves single-sourcing —
             the same function running on both threads — not that the two
             units look alike, and they deliberately do not. */
          var sGeom = T5.T5_CHROME(scx, W, H, INK_B);
          T5.T5_CAPS(scx, INK_B, sGeom);
          sctx.drawImage(sChrome, 0, 0);
          T5.T5_LIVE(sctx, W, H, INK_B, sGeom, TITLE, 'scope')(0.42, m.n);
          var mine = hashOf(sctx);
          if (mine === m.hash) {
            $('t5-parity').textContent = '✓ 0x' + m.hash.toString(16);
          } else {
            standDown('boot parity failed — worker 0x' + m.hash.toString(16) + ' vs main 0x' + mine.toString(16));
          }
        }
      } else if (m.type === 'frame') {
        workerFrames = m.n;
        $('t5-worker-frames').textContent = workerFrames.toLocaleString();
      }
    };
    worker.postMessage({ type: 'ping' });
  }

  /* Free-run: the worker drives itself off the compositor, the main unit
     off its own rAF. Mutually exclusive with the clock — otherwise two
     clocks drive one render. */
  function setFreeRun(on) {
    freeRun = on;
    $('t5-freerun').classList.toggle('t5-on', on);
    $('t5-freerun').textContent = on ? 'stop free-run' : 'free-run both';
    if (on) {
      demo.pause();
      mainFrames = 0; workerFrames = 0;
      if (host === 'worker') worker.postMessage({ type: 'run' });
      var t0 = performance.now();
      (function tick(now) {
        mainFrames++;
        var t = ((now - t0) % 12000) / 12000;
        mainPaint(t); fbPaint(t);
        $('t5-main-frames').textContent = mainFrames.toLocaleString();
        if (freeRun) mainRaf = requestAnimationFrame(tick);
      })(performance.now());
    } else {
      cancelAnimationFrame(mainRaf); mainRaf = 0;
      if (host === 'worker') worker.postMessage({ type: 'stop' });
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
      /* Read the MAIN counter here, at the instant the thread comes back.
         Waiting even 160 ms lets it serve twenty frames at 120 Hz and folds
         them into the block's own window, which understates the result by
         about half and does it in the flattering direction.

         The WORKER's counter cannot be read here, and that asymmetry is
         real rather than a nuisance: the count arrives by postMessage, and
         a blocked main thread is exactly a main thread that is not draining
         its message queue. So the worker's figure is taken after a short
         settle and the window it covers is stated as the longer one. Both
         errors that remain point the same way — against the result. */
      var dmBlock = mainFrames - m0;
      dsp.timeout(function () {
        var span = performance.now() - t0;
        var dmTotal = mainFrames - m0, dw = workerFrames - w0;
        note.hidden = false;
        note.className = 't5-note';
        note.textContent = host !== 'worker'
          ? 'Both players are on the main thread, so there is nothing to see here — which is the honest outcome, not a failure of the demo.'
          : 'Blocked the main thread for 800 ms. Unit 1 advanced ' + dmBlock + ' frame' +
            (dmBlock === 1 ? '' : 's') + ' while blocked and ' + dmTotal + ' across the whole ' +
            Math.round(span) + ' ms window — its title stopped scrolling and its clock stopped counting. ' +
            'Unit 2 advanced ' + dw + ' over that same window' +
            (dmTotal ? ', ' + (dw / dmTotal).toFixed(0) + '× as many' : '') +
            '. The worker is counted over the longer window because its count arrives by postMessage, ' +
            'and a blocked thread is precisely one that is not draining its message queue.';
        btn.disabled = false;
      }, 50);
    }); });
  });

  /* Reduced motion changing at runtime. The HOST is latched at load; the
     POSTER is not. Worker running and reduce turns on → the worker draws
     the poster. Do not try to reclaim the canvas; it throws. */
  dsp.on(reduced, 'change', function () {
    if (reduced.matches) {
      if (freeRun) setFreeRun(false);
      if (host === 'worker') { worker.postMessage({ type: 'stop' }); worker.postMessage({ type: 'render', t: 0.42 }); }
    }
  });

  tokens.reportTokenMisses();
  return function dispose() { dsp.run(); };
}
