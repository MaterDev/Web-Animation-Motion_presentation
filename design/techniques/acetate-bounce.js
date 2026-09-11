/* ── ACETATE · §5 bounce render ─────────────────────────────────────────
   A classic script, loaded by canvas.html with <script src>. It syncs to
   static/sheets/ unchanged: scripts/sync-design.js copies the tree with no
   extension filter.

   BOTH functions below MUST be closure-free. Their source text is what gets
   shipped to the worker — canvas.html assembles the worker body from
   Function.prototype.toString() and constructs a classic worker from a Blob
   URL, because new Worker('./file.js') throws a SecurityError from file://
   in Chromium and fails with an EMPTY error event in WebKit, and
   importScripts of a file:// URL from a blob worker fails in Chromium. The
   Blob path is the only one measured working in all three engines over both
   file:// and localhost.

   A free variable here resolves fine on the main thread, where the closure
   it came from exists, and is undefined in the worker. That passes in
   development and fails on stage. So it is GUARDED rather than documented:
   after boot, both sides render t = 0.42 and hash the result, and the sheet
   prints the hash. If single-sourcing broke, the two hashes differ and the
   screen says so.
   ─────────────────────────────────────────────────────────────────────── */

self.ACETATE_BOUNCE_RENDER = function (ctx, W, H, ink) {
  /* `ink` is an object of opaque 'rgb(r,g,b)' strings resolved from the
     ACETATE tokens on the main thread and shipped to the worker in the init
     message, so both sides draw from one source and no colour is hardcoded
     in two places.

     TWO RULES BELOW ARE LOAD-BEARING, not tidiness:

     1. Every coordinate is INTEGER-ALIGNED.
     2. Every fill is FULLY OPAQUE — including the ground, which is painted
        rather than left transparent, and the two colours that read as
        translucent, which arrive pre-blended.

     The boot parity check hashes this render on the main thread and in the
     worker and demands they match. Those two surfaces are not rasterised by
     the same backend. Measured, headed Chromium on an M4: an accelerated
     2D context and a willReadFrequently one, drawing the identical call
     sequence at the identical coordinates, disagree by ±1 per channel on
     360 pixels — every one of them on a blended edge. Fractional
     coordinates and alpha compositing are the only two degrees of freedom
     the backends had, and removing both makes "the same render" a
     byte-checkable statement instead of an approximate one.

     It is the same lesson §2's Table A exists to state, arriving through a
     different door. */
  return function render(t) {
    var BARS = 24, i, v, x, y, h, gap = 2;
    var bw = Math.max(1, Math.floor((W - gap * (BARS - 1)) / BARS));
    var foot = Math.round(H - 12), span = Math.round(H - 14);

    ctx.fillStyle = ink.ground;
    ctx.fillRect(0, 0, W, H);

    /* Programme material is a STATED MATHEMATICAL CONSTRUCTION, not a
       recording: three detuned partials under a slow envelope.
       Deterministic in t, so the poster frame, the scrub, the QC pass and
       the worker all agree. */
    for (i = 0; i < BARS; i++) {
      v = 0.5
        + 0.34 * Math.sin(t * 6.2831853 * 2 + i * 0.41)
        + 0.18 * Math.sin(t * 6.2831853 * 7 + i * 1.13)
        + 0.11 * Math.sin(t * 6.2831853 * 13 + i * 0.27);
      v = v * (0.55 + 0.45 * Math.sin(t * 6.2831853 + i * 0.05));
      if (v < 0.02) v = 0.02;
      if (v > 1) v = 1;

      h = Math.round(v * span);
      x = i * (bw + gap);
      y = H - h;

      /* the empty slot, so a quiet channel is still a channel */
      ctx.fillStyle = ink.slot;
      ctx.fillRect(x, 0, bw, foot);

      /* the bar — master-bus white, clip red above the over line */
      ctx.fillStyle = v > 0.88 ? ink.over : ink.bar;
      ctx.fillRect(x, y, bw, h);

      /* peak cap, held two rows above the bar */
      ctx.fillStyle = ink.cap;
      ctx.fillRect(x, Math.max(0, y - 3), bw, 2);
    }

    /* the over line at 0.88 of full scale. Chrome never animates; this is
       inside the working area, where everything is data. */
    ctx.fillStyle = ink.overline;
    ctx.fillRect(0, Math.round((1 - 0.88) * span), W, 1);

    /* transport position — one hairline sweeping the foot */
    ctx.fillStyle = ink.cap;
    ctx.fillRect(Math.round(t * (W - 2)), H - 8, 2, 8);
  };
};

self.ACETATE_BOUNCE_WORKER = function () {
  var ctx = null, render = null, W = 0, H = 0;
  var raf = 0, frames = 0, t0 = 0, dur = 12000, lastPost = 0;

  /* FNV-1a over a stride of the backing store. Stride, not every byte: this
     runs once at boot and its only job is to be equal to the main thread's
     value computed the same way. */
  function hash() {
    var d = ctx.getImageData(0, 0, W, H).data, h = 0x811c9dc5, i;
    for (i = 0; i < d.length; i += 997) { h ^= d[i]; h = (h * 0x01000193) >>> 0; }
    return h >>> 0;
  }

  self.onmessage = function (e) {
    var m = e.data;
    if (m.type === 'ping') {
      self.postMessage({ type: 'pong' });
    } else if (m.type === 'init') {
      W = m.w; H = m.h;
      ctx = m.canvas.getContext('2d');
      render = self.ACETATE_BOUNCE_RENDER(ctx, W, H, m.ink);
      self.postMessage({ type: 'ready' });
    } else if (m.type === 'render') {
      render(m.t);
      frames++;
      /* The count travels with every commanded render as well as with the
         free-run ticks. Without it the worker's counter sits at zero until
         someone presses free-run, which reads as a dead worker rather than
         as a worker nobody has asked to run yet. */
      self.postMessage({ type: 'rendered', t: m.t, hash: hash(), n: frames });
    } else if (m.type === 'run') {
      if (raf) return;
      t0 = performance.now(); frames = 0;
      (function tick(now) {
        frames++;
        render(((now - t0) % dur) / dur);
        if (now - lastPost > 100) { lastPost = now; self.postMessage({ type: 'frame', n: frames }); }
        raf = self.requestAnimationFrame(tick);
      })(performance.now());
    } else if (m.type === 'stop') {
      self.cancelAnimationFrame(raf); raf = 0;
      self.postMessage({ type: 'frame', n: frames });
    }
  };
};
