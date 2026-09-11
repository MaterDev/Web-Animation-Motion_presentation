/* ── §5 · TRANSPORT — two classic players ───────────────────────────────
   A classic script, loaded by canvas.html with <script src>. It syncs to
   static/sheets/ unchanged: scripts/sync-design.js copies the tree with no
   extension filter.

   EVERY FUNCTION HERE MUST BE CLOSURE-FREE. Their source text is what gets
   shipped to the worker — canvas.html assembles the worker body from
   Function.prototype.toString() and constructs a classic worker from a Blob
   URL, because new Worker('./file.js') throws a SecurityError from file://
   in Chromium and fails with an EMPTY error event in WebKit, and
   importScripts of a file:// URL from a blob worker fails in Chromium. The
   Blob path is the only one measured working in all three engines over both
   file:// and localhost. A free variable resolves fine on the main thread,
   where the closure it came from exists, and is undefined in the worker —
   it passes in development and fails on stage. So it is GUARDED: after boot
   both sides render the same t and hash the result, and the sheet prints it.

   WHAT REPLACED WHAT, AND WHY. This file used to paint a photoreal machine
   panel: two octaves of value noise lit by a perturbed surface normal, pan-
   head screws and an E-stop dome shaded per pixel with Lambert and Phong. It
   worked, it was correct, and it looked fake — because a simulated diffuse
   material on an emissive screen models how a surface scatters light on a
   surface that emits it, under a viewing angle the model cannot know, for
   viewers who have all touched enamel. Better execution loses that
   comparison more precisely, not less.

   What is here now is a blitter. Flat colours, integer rectangles, a bitmap
   font, and bevels that are four colours and six lines with no
   interpolation. A bevel does not simulate light; it is a NOTATION for
   depth, like a contour line on a map. A convention cannot be caught
   pretending, because it never claimed.

   AND IT MAKES THE PARITY GUARANTEE FREE. The old version cost the boot
   parity check 1,284 differing pixels — every one inside a lamp — on a
   healthy worker, because gradients and additive compositing are rasterised
   differently by an accelerated context and a willReadFrequently one, while
   the hand-written pixels differed on 0 of 447,200. A blitter has neither:
   integer rects, opaque fills, no scaling, no blending. There is nothing
   left for two rasterisers to disagree about.

   TEXT DRAWN HERE IS ALSO IN THE DOM, ALWAYS. The marquee and the time are
   blitted from a bitmap font because that is what a skin did, and a raster
   is somewhere a screen reader cannot go — so canvas.html carries the same
   strings in DOM beside the canvas. Drawn text is never the only copy.
   ─────────────────────────────────────────────────────────────────────── */

/* A 5 × 6 bitmap font, hand-set, one number per row, bit 4 leftmost.

   Hand-set rather than rasterised from a webfont, and that is load-bearing:
   text rendering is the least portable thing in a browser, and two threads
   drawing the same string with the same font can disagree by a pixel. The
   parity check this file exists to pass is byte-exact. A bitmap font cannot
   disagree with itself — which is also precisely why skins shipped one. */
self.T5_FONT = {
  ' ': [0, 0, 0, 0, 0, 0],
  'A': [0x0E, 0x11, 0x11, 0x1F, 0x11, 0x11], 'B': [0x1E, 0x11, 0x1E, 0x11, 0x11, 0x1E],
  'C': [0x0E, 0x11, 0x10, 0x10, 0x11, 0x0E], 'D': [0x1E, 0x11, 0x11, 0x11, 0x11, 0x1E],
  'E': [0x1F, 0x10, 0x1E, 0x10, 0x10, 0x1F], 'F': [0x1F, 0x10, 0x1E, 0x10, 0x10, 0x10],
  'G': [0x0E, 0x11, 0x10, 0x13, 0x11, 0x0F], 'H': [0x11, 0x11, 0x1F, 0x11, 0x11, 0x11],
  'I': [0x0E, 0x04, 0x04, 0x04, 0x04, 0x0E], 'J': [0x01, 0x01, 0x01, 0x01, 0x11, 0x0E],
  'K': [0x11, 0x12, 0x1C, 0x12, 0x11, 0x11], 'L': [0x10, 0x10, 0x10, 0x10, 0x10, 0x1F],
  'M': [0x11, 0x1B, 0x15, 0x11, 0x11, 0x11], 'N': [0x11, 0x19, 0x15, 0x13, 0x11, 0x11],
  'O': [0x0E, 0x11, 0x11, 0x11, 0x11, 0x0E], 'P': [0x1E, 0x11, 0x11, 0x1E, 0x10, 0x10],
  'Q': [0x0E, 0x11, 0x11, 0x15, 0x12, 0x0D], 'R': [0x1E, 0x11, 0x11, 0x1E, 0x12, 0x11],
  'S': [0x0F, 0x10, 0x0E, 0x01, 0x11, 0x0E], 'T': [0x1F, 0x04, 0x04, 0x04, 0x04, 0x04],
  'U': [0x11, 0x11, 0x11, 0x11, 0x11, 0x0E], 'V': [0x11, 0x11, 0x11, 0x11, 0x0A, 0x04],
  'W': [0x11, 0x11, 0x11, 0x15, 0x1B, 0x11], 'X': [0x11, 0x0A, 0x04, 0x04, 0x0A, 0x11],
  'Y': [0x11, 0x0A, 0x04, 0x04, 0x04, 0x04], 'Z': [0x1F, 0x01, 0x02, 0x04, 0x08, 0x1F],
  '0': [0x0E, 0x13, 0x15, 0x19, 0x11, 0x0E], '1': [0x04, 0x0C, 0x04, 0x04, 0x04, 0x0E],
  '2': [0x0E, 0x11, 0x01, 0x06, 0x08, 0x1F], '3': [0x1F, 0x02, 0x04, 0x02, 0x11, 0x0E],
  '4': [0x02, 0x06, 0x0A, 0x12, 0x1F, 0x02], '5': [0x1F, 0x10, 0x1E, 0x01, 0x11, 0x0E],
  '6': [0x06, 0x08, 0x1E, 0x11, 0x11, 0x0E], '7': [0x1F, 0x01, 0x02, 0x04, 0x08, 0x08],
  '8': [0x0E, 0x11, 0x0E, 0x11, 0x11, 0x0E], '9': [0x0E, 0x11, 0x11, 0x0F, 0x02, 0x0C],
  '-': [0, 0, 0x0E, 0, 0, 0], '.': [0, 0, 0, 0, 0, 0x04], ':': [0, 0x04, 0, 0, 0x04, 0],
  '/': [0x01, 0x02, 0x04, 0x04, 0x08, 0x10], '+': [0, 0x04, 0x0E, 0x04, 0, 0],
  '(': [0x02, 0x04, 0x04, 0x04, 0x04, 0x02], ')': [0x08, 0x04, 0x04, 0x04, 0x04, 0x08]
};

/* Blit a string. `s` is an integer scale — a pixel becomes an s × s block,
   never an interpolated one. Clipped to a box so the marquee can run off the
   edge of its well without a save/clip pair, which would be one more thing
   for two rasterisers to round differently. */
self.T5_TEXT = function (ctx, str, x, y, s, colour, clipX, clipW) {
  var i, r, c, g, row, px, py, ch;
  ctx.fillStyle = colour;
  for (i = 0; i < str.length; i++) {
    ch = str.charAt(i).toUpperCase();
    g = self.T5_FONT[ch] || self.T5_FONT[' '];
    for (r = 0; r < 6; r++) {
      row = g[r];
      if (!row) continue;
      for (c = 0; c < 5; c++) {
        if (!(row & (1 << (4 - c)))) continue;
        px = x + (i * 6 + c) * s;
        py = y + r * s;
        if (clipW !== undefined && (px + s <= clipX || px >= clipX + clipW)) continue;
        ctx.fillRect(px, py, s, s);
      }
    }
  }
};
self.T5_WIDTH = function (str, s) { return str.length * 6 * s; };

/* ── the chassis ────────────────────────────────────────────────────────
   Flat colours and six-line bevels. Painted once into a buffer; the live
   layer blits that buffer and then draws only what carries state. */
self.T5_CHROME = function (ctx, W, H, ink) {
  var B = { hi: ink.hi, lt: ink.lt, sh: ink.sh, dk: ink.dk, face: ink.face };
  var EDGE = { hi: ink.hi, lt: ink.lt, sh: ink.sh, dk: ink.dk };

  ctx.fillStyle = ink.face;
  ctx.fillRect(0, 0, W, H);
  self.SKIN_BEVEL(ctx, 0, 0, W, H, false, B);

  /* title bar — a raised strip, the way every player of the era opened */
  var tbY = 6, tbH = 14;
  self.SKIN_BEVEL(ctx, 6, tbY, W - 12, tbH, false, EDGE);

  /* the display well: sunken, and the only dark thing on the chassis */
  var wX = 10, wY = tbY + tbH + 6, wW = W - 20, wH = 58;
  ctx.fillStyle = ink.well;
  ctx.fillRect(wX, wY, wW, wH);
  self.SKIN_BEVEL(ctx, wX - 2, wY - 2, wW + 4, wH + 4, true, EDGE);

  /* the button row: five transport caps, raised, and one wider cap */
  var bY = wY + wH + 10, bW = 22, bH = 16, bX = 12, i;
  for (i = 0; i < 5; i++) self.SKIN_BEVEL(ctx, bX + i * (bW + 3), bY, bW, bH, false, B);

  /* the small analyser well, bottom right — 19 bars in 76 × 16, the classic
     miniature visualiser, which rhymes this world back to §1 at a twentieth
     of the size */
  var aW = 76, aH = 16, aX = W - aW - 12, aY = bY;
  ctx.fillStyle = ink.well;
  ctx.fillRect(aX, aY, aW, aH);
  self.SKIN_BEVEL(ctx, aX - 2, aY - 2, aW + 4, aH + 4, true, EDGE);

  return {
    tbY: tbY, tbH: tbH,
    wX: wX, wY: wY, wW: wW, wH: wH,
    bX: bX, bY: bY, bW: bW, bH: bH,
    aX: aX, aY: aY, aW: aW, aH: aH
  };
};

/* Glyph rows for the five transport caps, drawn as marks rather than
   characters: a triangle is not a letter and the font has no business
   holding one. */
self.T5_CAPS = function (ctx, ink, g) {
  var i, x, y, r;
  ctx.fillStyle = ink.lcdDim;
  for (i = 0; i < 5; i++) {
    x = g.bX + i * (g.bW + 3) + 7;
    y = g.bY + 4;
    if (i === 0) { for (r = 0; r < 8; r++) ctx.fillRect(x + 3 - (r < 4 ? r : 7 - r), y + r, 1, 1); ctx.fillRect(x, y, 2, 8); }
    else if (i === 1) { for (r = 0; r < 8; r++) ctx.fillRect(x, y + r, 1 + (r < 4 ? r : 7 - r), 1); }
    else if (i === 2) { ctx.fillRect(x, y, 2, 8); ctx.fillRect(x + 4, y, 2, 8); }
    else if (i === 3) { ctx.fillRect(x, y, 7, 8); }
    else { for (r = 0; r < 8; r++) ctx.fillRect(x + 4 - (r < 4 ? r : 7 - r), y + r, 1 + (r < 4 ? r : 7 - r), 1); ctx.fillRect(x + 6, y, 2, 8); }
  }
};

/* ── the live layer ─────────────────────────────────────────────────────
   The marquee is the signature mark that freezes. A stalled scrolling title
   is exactly what a hung player looked like, and everyone in the room has
   seen one — which makes it the most legible possible demonstration of a
   thread that has stopped answering. */
self.T5_LIVE = function (ctx, W, H, ink, g, title) {
  return function live(t, frames) {
    var i, v, bh, bw = 3, gap = 1, BARS = 19;

    /* clear only the wells — the chassis never changes */
    ctx.fillStyle = ink.well;
    ctx.fillRect(g.wX, g.wY, g.wW, g.wH);
    ctx.fillRect(g.aX, g.aY, g.aW, g.aH);

    /* time, at 2× — a pixel becomes a 2 × 2 block, never interpolated */
    var total = t * 214, mm = (total / 60) | 0, ss = (total | 0) % 60;
    var cs = ((total % 1) * 100) | 0;
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    self.T5_TEXT(ctx, pad(mm) + ':' + pad(ss), g.wX + 6, g.wY + 6, 3, ink.lcd);
    self.T5_TEXT(ctx, '.' + pad(cs), g.wX + 6 + self.T5_WIDTH('00:00', 3), g.wY + 12, 2, ink.lcdDim);

    /* The scrolling marquee, clipped to the well. ONE pass of the title per
       cycle, not six: the first version scrolled at six times this rate and
       was genuinely unpleasant to look at. A marquee is ambient — it has to
       be readable at a glance and ignorable the rest of the time, and a
       ticker moving faster than reading speed is neither. */
    var span = self.T5_WIDTH(title, 2) + 40;
    var off = Math.round((t * span) % span);
    self.T5_TEXT(ctx, title, g.wX + 6 + span - off, g.wY + 34, 2, ink.lcd, g.wX + 4, g.wW - 8);
    self.T5_TEXT(ctx, title, g.wX + 6 - off, g.wY + 34, 2, ink.lcd, g.wX + 4, g.wW - 8);

    /* bitrate / format, static type in the well's corner */
    self.T5_TEXT(ctx, '192 KBPS 44 KHZ STEREO', g.wX + 6, g.wY + 48, 1, ink.lcdDim);

    /* the miniature analyser. A STATED MATHEMATICAL CONSTRUCTION, not a
       recording: three detuned partials under a slow envelope. Nothing on
       this sheet decodes or plays audio. */
    for (i = 0; i < BARS; i++) {
      v = 0.5
        + 0.32 * Math.sin(t * 6.2831853 * 2 + i * 0.51)
        + 0.18 * Math.sin(t * 6.2831853 * 7 + i * 1.13)
        + 0.11 * Math.sin(t * 6.2831853 * 13 + i * 0.27);
      v *= 0.55 + 0.45 * Math.sin(t * 6.2831853 * 1.5 + 0.9);
      if (v < 0.04) v = 0.04;
      if (v > 1) v = 1;
      bh = Math.round(v * (g.aH - 2));
      ctx.fillStyle = v > 0.86 ? ink.sig : ink.lcd;
      ctx.fillRect(g.aX + 2 + i * (bw + gap), g.aY + g.aH - bh, bw, bh);
    }

    /* the frame counter, in the title bar, so the number that stops is on
       the chassis rather than only in the DOM readout */
    self.T5_TEXT(ctx, String(frames), W - 14 - self.T5_WIDTH(String(frames), 1), g.tbY + 4, 1, ink.hi);
  };
};

/* ── the worker ─────────────────────────────────────────────────────────
   Paints its own chassis. That is §5: when the main thread stops, the left
   player's marquee freezes mid-scroll and its clock stops, while this one
   carries on. */
self.T5_WORKER = function () {
  var ctx = null, chrome = null, live = null, W = 0, H = 0, ink = null;
  var raf = 0, frames = 0, t0 = 0, dur = 12000, lastPost = 0;

  function paint(t) {
    ctx.drawImage(chrome, 0, 0);
    live(t, frames);
  }
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
      W = m.w; H = m.h; ink = m.ink;
      ctx = m.canvas.getContext('2d');
      chrome = new OffscreenCanvas(W, H);
      var cx = chrome.getContext('2d');
      var t1 = performance.now();
      var g = self.T5_CHROME(cx, W, H, ink);
      self.T5_CAPS(cx, ink, g);
      var chromeMs = performance.now() - t1;
      live = self.T5_LIVE(ctx, W, H, ink, g, m.title);
      self.postMessage({ type: 'ready', chromeMs: chromeMs });
    } else if (m.type === 'render') {
      paint(m.t);
      frames++;
      self.postMessage({ type: 'rendered', t: m.t, hash: hash(), n: frames });
    } else if (m.type === 'run') {
      if (raf) return;
      t0 = performance.now(); frames = 0;
      (function tick(now) {
        frames++;
        paint(((now - t0) % dur) / dur);
        if (now - lastPost > 100) { lastPost = now; self.postMessage({ type: 'frame', n: frames }); }
        raf = self.requestAnimationFrame(tick);
      })(performance.now());
    } else if (m.type === 'stop') {
      self.cancelAnimationFrame(raf); raf = 0;
      self.postMessage({ type: 'frame', n: frames });
    }
  };
};
