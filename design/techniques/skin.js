/* ── skin.js · the shared construction for every world on SL-11 ─────────
   A classic script, loaded by canvas.html with <script src>. It syncs to
   static/sheets/ unchanged: scripts/sync-design.js copies the tree with no
   extension filter.

   EVERY FUNCTION HERE MUST BE CLOSURE-FREE. §5 ships its render to a worker
   by Function.prototype.toString(), and a free variable resolves fine on the
   main thread — where the closure it came from exists — and is undefined in
   the worker. That passes in development and fails on stage.

   WHAT THIS FILE IS. The five worlds on this sheet share a process, not a
   palette: an index-limited palette with a stated ordered dither, a
   different size and a different matrix in each. The palette is what makes
   them different; the process is what makes them one sheet.

   And the process is the sheet's own argument. CSS renders a smooth
   gradient effortlessly and cannot render an index-limited dithered one —
   the thing the era had to do because it had no choice is the thing the
   modern platform cannot do at all. Every pixel of every world's chrome
   arrives either through putImageData or through drawImage of a generated
   atlas at source size. That is the medium audit, and it is checkable.
   ─────────────────────────────────────────────────────────────────────── */

/* Ordered-dither matrices, generated rather than typed, so 2, 4 and 8 are
   guaranteed to be the same construction at three sizes. */
self.SKIN_BAYER = function (n) {
  var m = [[0]], size = 1, i, x, y, next;
  while (size < n) {
    next = [];
    for (y = 0; y < size * 2; y++) next.push(new Array(size * 2));
    for (y = 0; y < size; y++) {
      for (x = 0; x < size; x++) {
        i = m[y][x] * 4;
        next[y][x] = i;
        next[y][x + size] = i + 2;
        next[y + size][x] = i + 3;
        next[y + size][x + size] = i + 1;
      }
    }
    m = next; size *= 2;
  }
  return m;
};

/* A palette from a small set of anchors, interpolated then frozen to a fixed
   number of entries. The freezing is the point: a ramp with 16 steps bands,
   and the banding is the material rather than an artefact of it. */
self.SKIN_RAMP = function (anchors, steps) {
  var out = [], i, u, s, f, a, b;
  for (i = 0; i < steps; i++) {
    u = steps === 1 ? 0 : (i / (steps - 1)) * (anchors.length - 1);
    s = Math.min(anchors.length - 2, u | 0); f = u - s;
    a = anchors[s]; b = anchors[s + 1];
    out.push([
      Math.round(a[0] + (b[0] - a[0]) * f),
      Math.round(a[1] + (b[1] - a[1]) * f),
      Math.round(a[2] + (b[2] - a[2]) * f)
    ]);
  }
  return out;
};

/* Quantise a pixel buffer to a palette, in place, with an optional ordered
   dither. `n` of 0 means no dither — which §1 wants, because there the
   banding IS the look and a dither would hide the only thing worth seeing.

   Nearest entry by squared distance in sRGB. Not a perceptual metric, and
   deliberately not: the era's tools worked in sRGB and the stepping this
   produces is the stepping the register actually had. */
self.SKIN_QUANTISE = function (d, W, H, pal, n, cache) {
  var bayer = n ? self.SKIN_BAYER(n) : null;
  var nn = n * n, len = pal.length;
  var x, y, o, r, g, b, k, best, bestD, dr, dg, db, dist, jitter, key;
  for (y = 0; y < H; y++) {
    for (x = 0; x < W; x++) {
      o = (y * W + x) * 4;
      jitter = bayer ? (bayer[y % n][x % n] / nn - 0.5) * (255 / len) : 0;
      r = d[o] + jitter; g = d[o + 1] + jitter; b = d[o + 2] + jitter;
      if (r < 0) r = 0; else if (r > 255) r = 255;
      if (g < 0) g = 0; else if (g > 255) g = 255;
      if (b < 0) b = 0; else if (b > 255) b = 255;

      /* A 15-bit cache over the search, not over the maths. The nearest
         entry is a pure function of the colour, so it is computed once per
         distinct colour rather than once per pixel: a 345 600-pixel field
         against a 24-entry palette is 8.3 million distance computations a
         frame, which measured 15.9 ms and would have made the world
         unwatchable while its own readout claimed otherwise. Cached, the
         answer is identical — checked by running both and comparing the
         buffers, not by reasoning about it. */
      key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      best = cache ? cache[key] : -1;
      if (best < 0 || best === undefined) {
        best = 0; bestD = Infinity;
        for (k = 0; k < len; k++) {
          dr = r - pal[k][0]; dg = g - pal[k][1]; db = b - pal[k][2];
          dist = dr * dr + dg * dg + db * db;
          if (dist < bestD) { bestD = dist; best = k; }
        }
        if (cache) cache[key] = best;
      }
      d[o] = pal[best][0]; d[o + 1] = pal[best][1]; d[o + 2] = pal[best][2];
    }
  }
};

/* A cache for the above: one Int8Array per palette, -1 meaning "not yet
   asked". 32 768 entries, so it is 32 KB and it fills in the first frame. */
self.SKIN_CACHE = function () {
  var c = new Int8Array(32768);
  c.fill(-1);
  return c;
};

/* ── the bevel ──────────────────────────────────────────────────────────
   Four flat colours, six lines, zero interpolation. This is the depth model
   for every world's chrome.

   It does NOT simulate light, and that is the whole point. It is a notation
   for depth — the same kind of thing as a contour line on a map or
   cross-hatching in an engraving. A convention cannot be caught pretending,
   because it never claimed to be a photograph. The register this sheet
   abandoned tried to model how enamel scatters light on a surface that
   emits it, under a viewing angle the model cannot know, for viewers who
   have all touched enamel — and better execution lost the comparison more
   precisely, not less. */
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
