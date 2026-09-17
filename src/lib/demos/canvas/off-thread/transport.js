// @ts-nocheck -- copied from design/techniques/transport.js and skin.js (classic scripts), untyped sheet code
/* ── EXTRACTION: why `self` is a module-local object here ───────────────
   On the sheet these functions were `self.X` globals, and §5 ships their
   SOURCE TEXT to a worker with Function.prototype.toString(). Every
   function refers to its siblings as `self.T5_TEXT`, `self.SKIN_BEVEL`…

   To keep that text working without writing window globals, `self` below
   is a module-scoped namespace object that shadows the global. On the main
   thread `self.T5_TEXT` resolves to this object; in the worker the same
   text runs inside a wrapper whose parameter carries the worker's global.

   A bundler may RENAME this binding (Rollup deconflicts it, a minifier
   shortens it), and the renamed identifier is what toString() returns. So
   the worker wrapper does not assume the name `self`: it reads the name
   back out of nsName()'s own source — see index.js — and uses that as its
   parameter. The function bodies are otherwise the sheet's, unchanged. */
/* ── §5 · TRANSPORT — a classic player and its visualizer, off-thread ──
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

const self = {};

/* from skin.js — the two helpers §5 uses */
self.SKIN_BEVEL = function (ctx, x, y, w, h, sunken, c) {
  var HI = sunken ? c.dk : c.hi, LT = sunken ? c.sh : c.lt;
  var DK = sunken ? c.hi : c.dk, SH = sunken ? c.lt : c.sh;
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  if (c.face) { ctx.fillStyle = c.face; ctx.fillRect(x, y, w, h); }
  ctx.fillStyle = HI; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y, 1, h);
  ctx.fillStyle = LT; ctx.fillRect(x + 1, y + 1, w - 2, 1); ctx.fillRect(x + 1, y + 1, 1, h - 2);
  ctx.fillStyle = DK; ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x + w - 1, y, 1, h);
  ctx.fillStyle = SH; ctx.fillRect(x + 1, y + h - 2, w - 2, 1); ctx.fillRect(x + w - 2, y + 1, 1, h - 2);
};

self.SKIN_CSS = function (c) { return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; };

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

  /* ── the equalizer window ──────────────────────────────────────────
     A second window, docked under the first, the way every player of the
     era stacked them. Ten bands and a preamp, and the sliders move — a
     graphic equalizer whose faders never move is a picture of one. */
  var eqY = bY + bH + 12, eqH = 74;
  self.SKIN_BEVEL(ctx, 0, eqY, W, eqH, false, B);
  /* slide fit: the eq well takes whatever width the eleven faders leave,
     so the faders end 12 px from the right edge at any W (192 at W = 420) */
  var fW = 12, fGap = 6, fSpan = 11 * (fW + fGap) - fGap;
  var eqWX = 10, eqWY = eqY + 8, eqWW = W - 12 - fSpan - 14 - eqWX, eqWH = eqH - 16;
  ctx.fillStyle = ink.well;
  ctx.fillRect(eqWX, eqWY, eqWW, eqWH);
  self.SKIN_BEVEL(ctx, eqWX - 2, eqWY - 2, eqWW + 4, eqWH + 4, true, EDGE);

  var fX = eqWX + eqWW + 14, fY = eqY + 8, fH = eqH - 16;
  for (i = 0; i < 11; i++) {
    ctx.fillStyle = ink.dk;
    ctx.fillRect(fX + i * (fW + fGap) + fW / 2 - 1, fY, 2, fH);
  }

  /* ── the playlist window ───────────────────────────────────────────
     The third window. A list that scrolls and a row that is current: two
     more things moving, and both of them things a player really had. */
  var plY = eqY + eqH + 12, plH = H - plY - 8;
  self.SKIN_BEVEL(ctx, 0, plY, W, plH, false, B);
  var plWX = 10, plWY = plY + 8, plWW = W - 20, plWH = plH - 16;
  ctx.fillStyle = ink.well;
  ctx.fillRect(plWX, plWY, plWW, plWH);
  self.SKIN_BEVEL(ctx, plWX - 2, plWY - 2, plWW + 4, plWH + 4, true, EDGE);

  return {
    tbY: tbY, tbH: tbH,
    wX: wX, wY: wY, wW: wW, wH: wH,
    bX: bX, bY: bY, bW: bW, bH: bH,
    aX: aX, aY: aY, aW: aW, aH: aH,
    eqWX: eqWX, eqWY: eqWY, eqWW: eqWW, eqWH: eqWH,
    fX: fX, fY: fY, fW: fW, fH: fH, fGap: fGap,
    plWX: plWX, plWY: plWY, plWW: plWW, plWH: plWH
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
/* ── the visualisers ────────────────────────────────────────────────────
   TWO DIFFERENT ONES, because two identical players is a picture of one
   player. The unit that is proving something about threads should not also
   be proving that both halves of the demo were copy-pasted — and a
   visualiser is the one component of a player everybody changed, because
   it was the one the skin format let you change.

   Both read the SAME programme material, which is what keeps the
   comparison honest: the difference between the two panels is the
   visualiser and the palette, never the signal. */
self.T5_VIS = {
  /* the spectrum analyser: bars, peak caps that fall */
  bars: function (ctx, x, y, w, h, ink, t, band) {
    var N = 19, bw = 3, gap = 1, i, v, bh, peak;
    for (i = 0; i < N; i++) {
      v = band(i, N, t);
      bh = Math.round(v * (h - 2));
      ctx.fillStyle = v > 0.86 ? ink.sig : ink.lcd;
      ctx.fillRect(x + 2 + i * (bw + gap), y + h - bh, bw, bh);
      /* the cap is the slow envelope of the bar, which is what a real one
         does — it is a peak-hold, not a decoration riding on top */
      peak = Math.max(v, band(i, N, t - 0.02), band(i, N, t - 0.05), band(i, N, t - 0.09));
      ctx.fillStyle = ink.lcdDim;
      ctx.fillRect(x + 2 + i * (bw + gap), y + h - Math.round(peak * (h - 2)) - 2, bw, 1);
    }
  },
  /* the oscilloscope: one trace, drawn as pixels rather than a stroked
     path, because that is what a skin-era visualiser could afford */
  scope: function (ctx, x, y, w, h, ink, t, band) {
    var i, v, yy, mid = y + h / 2, prev = null;
    for (i = 0; i < w - 4; i++) {
      /* slide fit: rates are integer counts per 240 s loop (x20 the old
         12 s loop), so the trace moves at the same natural speed */
      v = Math.sin(i * 0.42 + t * 6.2831853 * 40) * 0.5
        + Math.sin(i * 0.13 + t * 6.2831853 * 60) * 0.32
        + Math.sin(i * 0.71 + t * 6.2831853 * 20) * 0.18;
      v *= 0.45 + 0.55 * band(i % 19, 19, t);
      yy = Math.round(mid + v * (h / 2 - 2));
      ctx.fillStyle = Math.abs(v) > 0.88 ? ink.sig : ink.lcd;
      if (prev !== null && Math.abs(yy - prev) > 1) {
        ctx.fillRect(x + 2 + i, Math.min(yy, prev), 1, Math.abs(yy - prev));
      } else {
        ctx.fillRect(x + 2 + i, yy, 1, 1);
      }
      prev = yy;
    }
  }
};

self.T5_LIVE = function (ctx, W, H, ink, g, title, vis) {
  return function live(t, frames) {
    var i, v, bh, bw = 3, gap = 1, BARS = 19;

    /* clear only the wells — the chassis never changes */
    ctx.fillStyle = ink.well;
    ctx.fillRect(g.wX, g.wY, g.wW, g.wH);
    ctx.fillRect(g.aX, g.aY, g.aW, g.aH);

    /* time, at 2× — a pixel becomes a 2 × 2 block, never interpolated */
    /* slide fit: REAL TIME. The loop is one 4:00 track (T5_LOOP_S), so the
       clock advances one second per second; it used to run 214 s in 12. */
    var LOOP = 240;
    var total = t * LOOP, mm = (total / 60) | 0, ss = (total | 0) % 60;
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
    /* about 28 px/s, rounded to whole passes per loop so the loop is seamless */
    var passes = Math.max(1, Math.round(LOOP * 28 / span));
    var off = Math.round((t * passes * span) % span);
    self.T5_TEXT(ctx, title, g.wX + 6 + span - off, g.wY + 34, 2, ink.lcd, g.wX + 4, g.wW - 8);
    self.T5_TEXT(ctx, title, g.wX + 6 - off, g.wY + 34, 2, ink.lcd, g.wX + 4, g.wW - 8);

    /* bitrate / format, static type in the well's corner */
    self.T5_TEXT(ctx, '192 KBPS 44 KHZ STEREO', g.wX + 6, g.wY + 48, 1, ink.lcdDim);

    /* the visualiser — whichever one this unit was built with. A STATED
       MATHEMATICAL CONSTRUCTION drives both: three detuned partials under a
       slow envelope. Nothing on this sheet decodes or plays audio. */
    function band(i, n, tt) {
      var vv = 0.5
        + 0.32 * Math.sin(tt * 6.2831853 * 40 + i * 0.51)
        + 0.18 * Math.sin(tt * 6.2831853 * 140 + i * 1.13)
        + 0.11 * Math.sin(tt * 6.2831853 * 260 + i * 0.27);
      vv *= 0.55 + 0.45 * Math.sin(tt * 6.2831853 * 20 + 0.9);
      return vv < 0.04 ? 0.04 : vv > 1 ? 1 : vv;
    }
    self.T5_VIS[vis || 'bars'](ctx, g.aX, g.aY, g.aW, g.aH, ink, t, band);

    /* the frame counter, in the title bar, so the number that stops is on
       the chassis rather than only in the DOM readout */
    self.T5_TEXT(ctx, String(frames), W - 14 - self.T5_WIDTH(String(frames), 1), g.tbY + 4, 1, ink.hi);

    /* ── the equalizer ───────────────────────────────────────────────
       Eleven faders that drift, and a curve drawn from where they are.
       The curve is the payoff: it is computed from the fader positions
       every frame rather than stored, so the two are never out of step. */
    var BANDS = 11, gains = [];
    for (i = 0; i < BANDS; i++) {
      v = 0.5 + 0.34 * Math.sin(t * 6.2831853 * 14 + i * 0.62)
              + 0.14 * Math.sin(t * 6.2831853 * 38 + i * 1.7);
      if (v < 0.05) v = 0.05;
      if (v > 0.95) v = 0.95;
      gains.push(v);
      var cy = Math.round(g.fY + (1 - v) * (g.fH - 10));
      /* the cap */
      ctx.fillStyle = i === 0 ? ink.sig : ink.lcd;
      ctx.fillRect(g.fX + i * (g.fW + g.fGap), cy, g.fW, 4);
      ctx.fillStyle = ink.sh;
      ctx.fillRect(g.fX + i * (g.fW + g.fGap), cy + 4, g.fW, 2);
    }

    /* the response curve, in the eq's own little well */
    ctx.fillStyle = ink.well;
    ctx.fillRect(g.eqWX, g.eqWY, g.eqWW, g.eqWH);
    ctx.fillStyle = ink.sh;
    ctx.fillRect(g.eqWX, Math.round(g.eqWY + g.eqWH / 2), g.eqWW, 1);
    var px2 = 0, py2 = 0;
    for (i = 0; i < g.eqWW; i++) {
      var u = (i / (g.eqWW - 1)) * (BANDS - 1);
      var a = gains[u | 0], b = gains[Math.min(BANDS - 1, (u | 0) + 1)];
      var f = u - (u | 0);
      var yy = Math.round(g.eqWY + (1 - (a + (b - a) * f)) * (g.eqWH - 4) + 2);
      ctx.fillStyle = ink.lcd;
      ctx.fillRect(g.eqWX + i, yy, 1, 2);
      if (i > 0 && Math.abs(yy - py2) > 2) {
        ctx.fillRect(g.eqWX + i, Math.min(yy, py2), 1, Math.abs(yy - py2));
      }
      py2 = yy; px2 = i;
    }

    /* ── the playlist ────────────────────────────────────────────────
       Twelve rows of a much longer list, scrolling, with one row current.
       The numbers on the right are real: each row's length is derived
       from its index, so the list is a list rather than a texture. */
    /* slide fit: rows at 2× (a 12 px glyph in a 16 px row), as many as the
       well holds, so the list reads at 1:1 instead of as a 6 px texture */
    var rowH = 16, ROWS = Math.floor(g.plWH / rowH);
    /* slide fit: one track plays for the whole loop. The list does not
       scroll and the highlight does not move; the current row is the track
       in the marquee, and its length is the loop's 4:00. */
    var top = 0, cur = 2;
    for (i = 0; i < ROWS; i++) {
      var idx = (top + i) % 48;
      var isCur = i === cur;
      if (isCur) {
        ctx.fillStyle = ink.lcdDim;
        ctx.fillRect(g.plWX + 1, g.plWY + i * rowH, g.plWW - 2, rowH);
      }
      var n = (idx + 1);
      var lbl = (n < 10 ? '0' : '') + n + '. ' + (isCur ? 'UNTITLED / A-SIDE' : self.T5_ROW(idx));
      self.T5_TEXT(ctx, lbl, g.plWX + 6, g.plWY + i * rowH + 2, 2, isCur ? ink.well : ink.lcd);
      var secs = isCur ? LOOP : 121 + ((idx * 37) % 190);
      var dur = Math.floor(secs / 60) + ':' + ((secs % 60) < 10 ? '0' : '') + (secs % 60);
      self.T5_TEXT(ctx, dur, g.plWX + g.plWW - 6 - self.T5_WIDTH(dur, 2), g.plWY + i * rowH + 2, 2, isCur ? ink.well : ink.lcdDim);
    }
  };
};

/* Track titles, generated from the index so the list is deterministic and
   the same on both threads. All fictional — nothing on this sheet names a
   real artist, label or release. */
self.T5_ROW = function (i) {
  var A = ['TRANSFER', 'LACQUER', 'REFERENCE', 'MASTER', 'ACETATE', 'DUB', 'TEST', 'SAFETY'];
  var B = ['TAKE', 'PASS', 'CUT', 'ROLL', 'SIDE', 'PLATE'];
  return A[i % A.length] + ' ' + B[(i * 3) % B.length] + ' ' + (((i * 7) % 24) + 1);
};

/* ── the visualizer window (slide fit, 2026-09-17) ──────────────────────
   A 90s desktop visualizer docked to the right of the player: a bevelled
   chassis in the player's skin around a dark screen, and in the screen an
   abstract oil slick — a domain-warped noise field mapped through a
   thin-film palette (indigo base, magenta → gold → green → cyan sheens)
   that drifts slowly on its own — hypnotic, not reactive. Mode chips and
   calm L/R meters along the bottom, a mode label over the screen.

   It ships to the worker the same way as the player (Function.toString),
   so the same rule holds: closure-free. Everything is a function of t alone
   (0..1 over the 12 s cycle, every rate an integer count per cycle so the
   loop is seamless), which is what lets reduced motion freeze it on a
   poster and lets the boot parity check draw it cold on the main thread.

   The field is computed at a quarter of the screen's size into ImageData
   and drawn up with smoothing ON. That breaks the player's blitter rule on
   purpose — the blur is what makes it read as liquid — so parity hashes
   the field's BYTES (pure JS maths, identical on both threads) rather than
   the scaled raster, which two rasterisers may round differently. */

/* A cyclic 256-entry palette from the oil stops (each [r, g, b]), eased
   between stops so the bands have no hard seams. */
self.T5_OIL_LUT = function (stops) {
  var lut = new Uint8Array(256 * 3), n = stops.length, i, k, a, b, f, e;
  for (i = 0; i < 256; i++) {
    f = (i / 256) * n; k = Math.floor(f); e = f - k; e = e * e * (3 - 2 * e);
    a = stops[k % n]; b = stops[(k + 1) % n];
    lut[i * 3] = Math.round(a[0] + (b[0] - a[0]) * e);
    lut[i * 3 + 1] = Math.round(a[1] + (b[1] - a[1]) * e);
    lut[i * 3 + 2] = Math.round(a[2] + (b[2] - a[2]) * e);
  }
  return lut;
};

/* The oil field. Value noise from an integer hash (no Math.random, no
   table), two octaves, warped twice: q = fbm(p + a(t)), v = fbm(p + k·q +
   c(t)). The warp offsets travel on circles, so t = 1 lands where t = 0
   began. Film thickness picks the palette band; the field value decides how
   much sheen shows over the dark base. Not reactive: it drifts on its own
   (warp circles of 60 s and 40 s, palette bands turning once every 15 s
   over the 240 s loop). Writes RGBA into d. */
self.T5_OIL_FIELD = function (d, IW, IH, t, lut) {
  var TAU = 6.2831853;
  function hash(x, y) {
    var h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) & 0xffff) / 65535;
  }
  function noise(x, y) {
    var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), e = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + e) * u * v;
  }
  function fbm(x, y) { return 0.64 * noise(x, y) + 0.36 * noise(x * 2.07 + 17.3, y * 2.07 - 9.1); }
  var c1 = Math.cos(TAU * t * 4), s1 = Math.sin(TAU * t * 4), c2 = Math.cos(TAU * t * 6), s2 = Math.sin(TAU * t * 6);
  var ax = 1.1 * c1, ay = 1.1 * s1, bx = 5.2 - 0.9 * s2, by = 1.3 + 0.9 * c2;
  var cx = 8.3 + 1.3 * c2, cy = 2.8 - 1.3 * s1;
  var warp = 2.8, k = 4.2 / IW, lift = 0.95;
  var x, y, px, py, qx, qy, v, th, idx, s, o = 0, br, bg, bb;
  for (y = 0; y < IH; y++) {
    py = y * k;
    for (x = 0; x < IW; x++) {
      px = x * k;
      qx = fbm(px + ax, py + ay);
      qy = fbm(px + bx, py + by);
      v = fbm(px + warp * qx + cx, py + warp * qy + cy);
      th = v * 3.2 + qx * 1.4 - qy * 0.6 - t * 16;
      th = th - Math.floor(th);
      idx = ((th * 255) | 0) * 3;
      s = (v - 0.30) / 0.42; s = s < 0 ? 0 : s > 1 ? 1 : s; s = s * s * (3 - 2 * s) * lift; if (s > 1) s = 1;
      br = 6 + 14 * qy; bg = 4 + 6 * qx; bb = 14 + 26 * qy;
      d[o] = br + (lut[idx] - br) * s;
      d[o + 1] = bg + (lut[idx + 1] - bg) * s;
      d[o + 2] = bb + (lut[idx + 2] - bb) * s;
      d[o + 3] = 255;
      o += 4;
    }
  }
};

self.T5_VIS_CHROME = function (ctx, W, H, ink) {
  var B = { hi: ink.hi, lt: ink.lt, sh: ink.sh, dk: ink.dk, face: ink.face };
  var EDGE = { hi: ink.hi, lt: ink.lt, sh: ink.sh, dk: ink.dk };
  var i, x;

  ctx.fillStyle = ink.face;
  ctx.fillRect(0, 0, W, H);
  self.SKIN_BEVEL(ctx, 0, 0, W, H, false, B);

  var tbY = 6, tbH = 14;
  self.SKIN_BEVEL(ctx, 6, tbY, W - 12, tbH, false, EDGE);
  self.T5_TEXT(ctx, 'VIS / OIL SLICK', 12, tbY + 4, 1, ink.hi);

  /* the screen — a quarter-size field is scaled into exactly this box */
  var cH = 20, cY = H - 10 - cH;
  var wX = 10, wY = tbY + tbH + 6, wW = W - 20, wH = cY - 10 - wY;
  ctx.fillStyle = ink.well;
  ctx.fillRect(wX, wY, wW, wH);
  self.SKIN_BEVEL(ctx, wX - 2, wY - 2, wW + 4, wH + 4, true, EDGE);

  /* mode chips: OIL lit, the other two modes a player always had, dark */
  var CAPS = ['OIL', 'SPEC', 'SCOPE'], capW = 86;
  for (i = 0; i < CAPS.length; i++) {
    x = 12 + i * (capW + 4);
    self.SKIN_BEVEL(ctx, x, cY, capW, cH, false, B);
    ctx.fillStyle = ink.dk; ctx.fillRect(x + 7, cY + 6, 8, 8);
    ctx.fillStyle = i === 0 ? ink.hot : ink.ghost; ctx.fillRect(x + 8, cY + 7, 6, 6);
    self.T5_TEXT(ctx, CAPS[i], x + 21, cY + 4, 2, i === 0 ? ink.lcd : ink.lcdDim);
  }

  /* L/R level meters in their own small well */
  var mX = 12 + CAPS.length * (capW + 4) + 8, mW = W - 12 - mX;
  ctx.fillStyle = ink.well;
  ctx.fillRect(mX, cY, mW, cH);
  self.SKIN_BEVEL(ctx, mX - 2, cY - 2, mW + 4, cH + 4, true, EDGE);
  self.T5_TEXT(ctx, 'L', mX + 4, cY + 3, 1, ink.lcdDim);
  self.T5_TEXT(ctx, 'R', mX + 4, cY + 11, 1, ink.lcdDim);
  var mSegX = mX + 14, mSegs = Math.floor((mW - 18 + 2) / 6);
  ctx.fillStyle = ink.ghost;
  for (i = 0; i < mSegs; i++) { ctx.fillRect(mSegX + i * 6, cY + 3, 4, 6); ctx.fillRect(mSegX + i * 6, cY + 11, 4, 6); }

  return {
    tbY: tbY, wX: wX, wY: wY, wW: wW, wH: wH,
    fW: Math.ceil(wW / 4), fH: Math.ceil(wH / 4),
    cY: cY, mSegX: mSegX, mSegs: mSegs
  };
};

/* `field` is a canvas of g.fW × g.fH the caller made (OffscreenCanvas in
   the worker, a <canvas> on the main thread). The returned function draws
   one frame; `live.data` is the field's bytes, for the parity hash. */
self.T5_VIS_LIVE = function (ctx, W, H, ink, g, field) {
  var fctx = field.getContext('2d');
  var img = fctx.createImageData(g.fW, g.fH);
  var lut = self.T5_OIL_LUT(ink.oil);
  function live(t, frames) {
    var i, TAU = 6.2831853;

    self.T5_OIL_FIELD(img.data, g.fW, g.fH, t, lut);
    fctx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(field, 0, 0, g.fW, g.fH, g.wX, g.wY, g.wW, g.wH);

    /* faint scanlines, the screen's only texture */
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = ink.well;
    for (i = g.wY + 2; i < g.wY + g.wH; i += 3) ctx.fillRect(g.wX, i, g.wW, 1);
    ctx.globalAlpha = 1;

    /* (the floating "OIL" chip over the screen was removed — Key; the
       mode chips under the screen still name the mode) */

    /* level meters: decorative and calm, slow integer-rate swells */
    var L = 0.50 + 0.10 * Math.sin(t * TAU * 90 + 0.3) + 0.05 * Math.sin(t * TAU * 233 + 1.1);
    var R = 0.48 + 0.10 * Math.sin(t * TAU * 97 + 2.0) + 0.05 * Math.sin(t * TAU * 211 + 0.4);
    L = Math.round(L * g.mSegs); R = Math.round(R * g.mSegs);
    for (i = 0; i < g.mSegs; i++) {
      ctx.fillStyle = i >= g.mSegs - 3 ? ink.sig : i >= g.mSegs * 0.62 ? ink.hot : ink.lcd;
      if (i < L) ctx.fillRect(g.mSegX + i * 6, g.cY + 3, 4, 6);
      if (i < R) ctx.fillRect(g.mSegX + i * 6, g.cY + 11, 4, 6);
    }

    /* the frame counter, in the title bar, like the player's */
    self.T5_TEXT(ctx, String(frames), W - 14 - self.T5_WIDTH(String(frames), 1), g.tbY + 4, 1, ink.hi);
  }
  live.data = img.data;
  return live;
};

/* ── the worker ─────────────────────────────────────────────────────────
   Owns both transferred canvases, player and visualizer, and paints both
   chassis itself. When the main thread stops, this carries on — provided
   it is driving itself ('run'); in clock mode it only draws when the main
   thread posts a 'render', which is exactly the dependency free-run cuts. */
self.T5_WORKER = function () {
  var ctx = null, vctx = null, chrome = null, vchrome = null, live = null, vlive = null;
  var W = 0, H = 0, VW = 0, VH = 0;
  var raf = 0, frames = 0, t0 = 0, dur = 240000, lastPost = 0, costs = [], paintMs = -1;

  /* Paint cost, sampled every 15th frame and closed with a 1 px readback on
     each canvas: 2D commands are recorded and rasterised later, so a bracket
     without a sync point measures submission, not drawing. Not every frame,
     because the readback is itself a stall. */
  function paint(t) {
    var sample = frames % 15 === 0, a = sample ? performance.now() : 0, s;
    ctx.drawImage(chrome, 0, 0);
    live(t, frames);
    vctx.drawImage(vchrome, 0, 0);
    vlive(t, frames);
    if (sample) {
      ctx.getImageData(0, 0, 1, 1); vctx.getImageData(0, 0, 1, 1);
      costs.push(performance.now() - a);
      if (costs.length > 9) costs.shift();
      s = costs.slice().sort(function (x, y) { return x - y; });
      paintMs = s[(s.length - 1) >> 1];
    }
  }
  function hashOf(d, stride, seed) {
    var hh = seed, i;
    for (i = 0; i < d.length; i += stride) { hh ^= d[i]; hh = (hh * 0x01000193) >>> 0; }
    return hh >>> 0;
  }

  self.onmessage = function (e) {
    var m = e.data;
    if (m.type === 'ping') {
      self.postMessage({ type: 'pong' });
    } else if (m.type === 'init') {
      W = m.w; H = m.h; VW = m.vw; VH = m.vh; dur = m.dur || dur;
      ctx = m.canvas.getContext('2d');
      vctx = m.visCanvas.getContext('2d');
      chrome = new OffscreenCanvas(W, H);
      vchrome = new OffscreenCanvas(VW, VH);
      var cx = chrome.getContext('2d'), vcx = vchrome.getContext('2d');
      var g = self.T5_CHROME(cx, W, H, m.ink);
      self.T5_CAPS(cx, m.ink, g);
      var vg = self.T5_VIS_CHROME(vcx, VW, VH, m.ink);
      live = self.T5_LIVE(ctx, W, H, m.ink, g, m.title, m.vis);
      vlive = self.T5_VIS_LIVE(vctx, VW, VH, m.ink, vg, new OffscreenCanvas(vg.fW, vg.fH));
      self.postMessage({ type: 'ready' });
    } else if (m.type === 'render') {
      var drawnWith = frames;
      paint(m.t);
      frames++;
      self.postMessage({
        type: 'rendered', t: m.t, n: frames, drawnWith: drawnWith, paintMs: paintMs,
        hash: m.parity ? hashOf(vlive.data, 7, hashOf(ctx.getImageData(0, 0, W, H).data, 997, 0x811c9dc5)) : 0
      });
    } else if (m.type === 'run') {
      if (raf) return;
      t0 = performance.now() - (m.t || 0) * dur; frames = 0;
      (function tick(now) {
        frames++;
        paint((((now - t0) % dur) + dur) % dur / dur);
        if (now - lastPost > 100) { lastPost = now; self.postMessage({ type: 'frame', n: frames, paintMs: paintMs }); }
        raf = self.requestAnimationFrame(tick);
      })(performance.now());
    } else if (m.type === 'stop') {
      self.cancelAnimationFrame(raf); raf = 0;
      self.postMessage({ type: 'frame', n: frames, paintMs: paintMs });
    }
  };
};

/* the namespace, for callers on the main thread */
export const T5 = self;
/* Returns the namespace binding. Its own source text is the one reliable
   place to read what the binding is called after bundling. */
export function nsName() { return self; }
