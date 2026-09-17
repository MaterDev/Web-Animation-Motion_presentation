// @ts-nocheck -- untyped sheet code, extracted from design/techniques/canvas.html §2 (lines 1356–1529 and 1534–1929)
import { stage } from '../../_kit/stage.js';
import { createWAM } from '../../_kit/wam.js';
import { disposer } from '../../_kit/disposer.js';
import css from './demo.css?raw';
import html from './demo.html?raw';
import { SKIN_CSS } from './skin.js';
import { TAU, sync, CLOCK_FLOOR, median, atFloor, ms, rng, resolveRGB, createTokens } from './helpers.js';

export function mount(host) {
  const { root, body, $ } = stage(host, { css, html });
  const WAM = createWAM({ root });
  const dsp = disposer();
  dsp.add(() => WAM.dispose());
  const tokens = createTokens(host, body, 'h2');
  dsp.add(tokens.dispose);
  const token = tokens.token;

/* ════════════════════════════════════════════════════════════════════════
   §2 · BATCHING
   ════════════════════════════════════════════════════════════════════════ */
var SEC2 = (function () {
  var N = 50000, MW = 900, MH = 600, REPS = 7;
  var INK = resolveRGB(token('--tint-canvas') || '#e2c23a');

  /* One mark specification for the whole of Table A: a 4×4 axis-aligned
     opaque square at integer coordinates in one resolved ink. Seeded, so
     every method draws marks in the same places and "the same picture" is
     a checkable statement rather than an assertion. */
  var XS = new Int32Array(N), YS = new Int32Array(N);
  (function () {
    var r = rng(0xC0FFEE), i;
    for (i = 0; i < N; i++) {
      XS[i] = (r() * (MW - 4)) | 0;
      YS[i] = (r() * (MH - 4)) | 0;
    }
  })();

  var mc = document.createElement('canvas');
  mc.width = MW; mc.height = MH;
  var mx = mc.getContext('2d', { willReadFrequently: true });
  var FILL = 'rgb(' + INK[0] + ',' + INK[1] + ',' + INK[2] + ')';

  var sprite = document.createElement('canvas');
  sprite.width = sprite.height = 4;
  (function () { var s = sprite.getContext('2d'); s.fillStyle = FILL; s.fillRect(0, 0, 4, 4); })();

  var buf = mx.createImageData(MW, MH);
  var b32 = new Uint32Array(buf.data.buffer);
  /* little-endian ABGR. Built from the SAME resolved ink as every other
     method — a hardcoded triple here is how one path silently stops
     tracking the token. */
  var PACK = (255 << 24) | (INK[2] << 16) | (INK[1] << 8) | INK[0];

  var METHODS = [
    { key: 'fillrect', label: 'fillRect per call', draw: function () {
        mx.fillStyle = FILL;
        for (var i = 0; i < N; i++) mx.fillRect(XS[i], YS[i], 4, 4);
      } },
    { key: 'batched', label: 'rect batched into one path', draw: function () {
        mx.fillStyle = FILL; mx.beginPath();
        for (var i = 0; i < N; i++) mx.rect(XS[i], YS[i], 4, 4);
        mx.fill();
      } },
    { key: 'sprite', label: 'drawImage sprite', draw: function () {
        for (var i = 0; i < N; i++) mx.drawImage(sprite, XS[i], YS[i]);
      } },
    { key: 'imagedata', label: 'putImageData, composed once', draw: function () {
        var i, x, y, o;
        for (i = 0; i < N; i++) {
          x = XS[i]; y = YS[i]; o = y * MW + x;
          b32[o] = PACK; b32[o + 1] = PACK; b32[o + 2] = PACK; b32[o + 3] = PACK;
          o += MW; b32[o] = PACK; b32[o + 1] = PACK; b32[o + 2] = PACK; b32[o + 3] = PACK;
          o += MW; b32[o] = PACK; b32[o + 1] = PACK; b32[o + 2] = PACK; b32[o + 3] = PACK;
          o += MW; b32[o] = PACK; b32[o + 1] = PACK; b32[o + 2] = PACK; b32[o + 3] = PACK;
        }
        mx.putImageData(buf, 0, 0);
      } }
  ];
  function clearFor(m) {
    mx.clearRect(0, 0, MW, MH);
    if (m.key === 'imagedata') b32.fill(0);
  }
  function timeOne(m) {
    clearFor(m);
    var t0 = performance.now();
    m.draw();
    sync(mx);
    return performance.now() - t0;
  }

  /* Table B changes the mark on purpose, so the pictures differ and the
     difference IS the finding. r = √(16/π) gives a disc of the same area as
     the 4×4 square — the coverage axis held while the edge treatment and
     the coordinate alignment vary. */
  var R = Math.sqrt(16 / Math.PI);
  var MARKS = [
    { label: 'square 4×4, integer coords', cov: '16 px, hard edge', draw: function () {
        mx.fillStyle = FILL;
        for (var i = 0; i < N; i++) mx.fillRect(XS[i], YS[i], 4, 4);
      } },
    { label: 'square 4×4, fractional coords', cov: '16 px + antialiased edge', draw: function () {
        mx.fillStyle = FILL;
        for (var i = 0; i < N; i++) mx.fillRect(XS[i] + 0.37, YS[i] + 0.61, 4, 4);
      } },
    { label: 'disc of equal area, integer coords', cov: '16 px, antialiased', draw: function () {
        mx.fillStyle = FILL;
        for (var i = 0; i < N; i++) { mx.beginPath(); mx.arc(XS[i] + 2, YS[i] + 2, R, 0, TAU); mx.fill(); }
      } },
    { label: 'disc of equal area, fractional coords', cov: '16 px, antialiased', draw: function () {
        mx.fillStyle = FILL;
        for (var i = 0; i < N; i++) { mx.beginPath(); mx.arc(XS[i] + 2.37, YS[i] + 2.61, R, 0, TAU); mx.fill(); }
      } }
  ];

  var RESULT = { a: [], b: [], syncCost: 0, ran: false };

  function measure() {
    var i, j, s, reps, ref = null;

    /* what the sync point costs on its own, so the reader can see it is
       not what the brackets are measuring */
    reps = [];
    for (j = 0; j < 20; j++) { s = performance.now(); sync(mx); reps.push(performance.now() - s); }
    RESULT.syncCost = median(reps);

    for (i = 0; i < METHODS.length; i++) {
      timeOne(METHODS[i]);                                  /* warm */
      reps = [];
      for (j = 0; j < REPS; j++) reps.push(timeOne(METHODS[i]));
      /* the picture this method actually produced, captured AFTER timing so
         the getImageData cost never lands inside a bracket */
      clearFor(METHODS[i]); METHODS[i].draw();
      var px = mx.getImageData(0, 0, MW, MH).data;
      var diff = 0;
      if (ref === null) ref = px;
      else { for (var k = 0; k < px.length; k += 4) if (px[k] !== ref[k] || px[k + 1] !== ref[k + 1] || px[k + 2] !== ref[k + 2] || px[k + 3] !== ref[k + 3]) diff++; }
      RESULT.a.push({ label: METHODS[i].label, ms: median(reps), diff: diff });
    }

    for (i = 0; i < MARKS.length; i++) {
      mx.clearRect(0, 0, MW, MH); MARKS[i].draw(); sync(mx);   /* warm */
      reps = [];
      for (j = 0; j < REPS; j++) {
        mx.clearRect(0, 0, MW, MH);
        s = performance.now(); MARKS[i].draw(); sync(mx); reps.push(performance.now() - s);
      }
      RESULT.b.push({ label: MARKS[i].label, cov: MARKS[i].cov, ms: median(reps) });
    }
    RESULT.ran = true;
    paint();
  }

  function paint() {
    var a = RESULT.a, b = RESULT.b, i, fastest = Infinity, slowest = 0, rows = '';
    for (i = 0; i < a.length; i++) { if (a[i].ms < fastest) fastest = a[i].ms; if (a[i].ms > slowest) slowest = a[i].ms; }
    for (i = 0; i < a.length; i++) {
      rows += '<tr' + (a[i].ms === fastest ? ' class="cv-best"' : '') + '>' +
        '<td>' + a[i].label + '</td>' +
        '<td class="cv-num">' + ms(a[i].ms) + atFloor(a[i].ms) + '</td>' +
        '<td>' + (a[i].ms / fastest).toFixed(1) + '×</td>' +
        '<td>' + (i === 0 ? 'reference' : a[i].diff.toLocaleString()) + '</td></tr>';
    }
    $('table-a-body').innerHTML = rows;

    var bad = a.filter(function (r, i2) { return i2 > 0 && r.diff > 0; });
    var guard = $('table-a-guard');
    var total = (MW * MH).toLocaleString();
    if (bad.length) {
      guard.className = 'cv-guard cv-bad';
      guard.innerHTML = '✗ output NOT identical — ' + bad.map(function (r) { return r.label + ': ' + r.diff.toLocaleString(); }).join(', ') +
        ' of ' + total + ' pixels differ. The spread above is contaminated and the sheet says so.';
    } else {
      guard.className = 'cv-guard cv-ok';
      guard.innerHTML = '✓ identical output verified — 0 of ' + total + ' pixels differ across all four methods. ' +
        'Spread fastest to slowest: <b>' + (slowest / fastest).toFixed(1) + '×</b>.';
    }

    rows = '';
    var base = b.length ? b[0].ms : 1;
    for (i = 0; i < b.length; i++) {
      rows += '<tr><td>' + b[i].label + '</td><td class="cv-num">' + ms(b[i].ms) + atFloor(b[i].ms) +
        '</td><td>' + (b[i].ms / base).toFixed(2) + '×</td><td>' + b[i].cov + '</td></tr>';
    }
    $('table-b-body').innerHTML = rows;

    $('table-floor').textContent = CLOCK_FLOOR < 1 ? (CLOCK_FLOOR * 1000).toFixed(0) + ' µs' : CLOCK_FLOOR.toFixed(2) + ' ms';
    $('table-n').textContent = N.toLocaleString() + ' per frame, ' + MW + '×' + MH;
    $('table-synccost').innerHTML = RESULT.syncCost < CLOCK_FLOOR
      ? 'below the clock floor — under ' + (CLOCK_FLOOR < 1 ? (CLOCK_FLOOR * 1000).toFixed(0) + ' µs' : CLOCK_FLOOR.toFixed(2) + ' ms')
      : ms(RESULT.syncCost) + ' ms' + atFloor(RESULT.syncCost);
  }

  return { measure: measure, RESULT: RESULT, N: N, METHODS: METHODS, INK: INK };
})();

/* ════════════════════════════════════════════════════════════════════════
   §2 · SCREEN — the console
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  /* SLIDE FIT: the sheet ran a fixed 1200×560 store. On the slide the press
     sheet is the hero and fills an 864×414 CSS region under the button
     strip, so the store is that region × devicePixelRatio (capped at 2) and
     K rescales everything the sheet specified in its 1200-wide units — the
     cell, the loupe, the view, the furniture — so the composition and the
     dot count match the sheet's. */
  var CSS_W = 864, CSS_H = 414, DPR = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  var W = Math.round(CSS_W * DPR), H = Math.round(CSS_H * DPR), K = W / 1200;
  var cv = $('h2-canvas'), ctx = cv.getContext('2d', { willReadFrequently: true });
  cv.width = W; cv.height = H;

  var STOCK = resolveRGB(token('--h2-stock'));
  var INK = {
    c: resolveRGB(token('--h2-ink-c')), m: resolveRGB(token('--h2-ink-m')),
    y: resolveRGB(token('--h2-ink-y')), k: resolveRGB(token('--h2-ink-k'))
  };
  var RULE = SKIN_CSS(resolveRGB(token('--h2-rule')));

  /* The standard process set. Only three screens can sit at mutual 30°
     separation, so yellow takes the 15° collision — it is the faintest of
     the four — and yellow runs at 108% of the others' frequency to suppress
     the residual beat it would otherwise make with cyan. The rosette that
     comes out is a controlled, least-objectionable moiré: the one place in
     this deck where moiré is the intended outcome rather than the hazard. */
  var PLATES = [
    { ch: 'y', deg: 0,  freq: 1.08 },
    { ch: 'c', deg: 15, freq: 1.00 },
    { ch: 'k', deg: 45, freq: 1.00 },
    { ch: 'm', deg: 75, freq: 1.00 }
  ];
  /* 12 device px at 20×. The first pass ran an 8px cell and put 45 456 dots
     on every frame at 44 ms, which is a quarter of a second of latency on a
     section about latency. A coarser ruling is also more legible at this
     magnification: the rosette needs its dots separable by eye, and at 8px
     they were not quite. */
  var CELL = 12 * K;
  var on = { c: true, m: true, y: true, k: true };
  var method = 'arc', gain = true, costs = [], dots = 0, locked = false;
  var proofing = true, loupeOn = true, plateCount = 4;
  var zoom = 1, ax0 = 0, ay0 = 0, cellScale = 1;

  /* ── the artwork ─────────────────────────────────────────────────────
     A HALFTONE OF NOTHING IS A TEXTURE; A HALFTONE OF SOMETHING IS AN
     IMAGE. The first version screened an abstract tone field and it was a
     moving surface with nothing to look at, because there was nothing
     underneath it to resolve into.

     So there is a job on the press now. It is drawn once, in full colour,
     to an off-screen canvas — and then READ BACK and separated into four
     plates, which is exactly the order of operations a prepress department
     works in. Nothing is decoded and no photograph is used: every mark on
     it is drawn here. */
  var AW = 900, AH = 420;
  var art = document.createElement('canvas');
  art.width = AW; art.height = AH;
  var ADATA = null;
  (function () {
    var a = art.getContext('2d', { willReadFrequently: true });
    a.fillStyle = '#efe7d2'; a.fillRect(0, 0, AW, AH);
    /* three process-ish discs, overprinted — the shape every colour chart
       on every press wall has, and the reason CMYK is legible at a glance */
    var discs = [
      [AW * 0.30, AH * 0.46, 150, 'rgba(0,160,220,0.88)'],
      [AW * 0.44, AH * 0.62, 150, 'rgba(225,0,120,0.80)'],
      [AW * 0.38, AH * 0.30, 130, 'rgba(250,205,0,0.85)']
    ];
    discs.forEach(function (d) {
      a.fillStyle = d[3];
      a.beginPath(); a.arc(d[0], d[1], d[2], 0, TAU); a.fill();
    });
    /* a tonal sweep, which is what actually exercises a screen: every
       coverage from nothing to solid, in one band */
    var g = a.createLinearGradient(AW * 0.60, 0, AW, 0);
    g.addColorStop(0, 'rgba(20,20,26,0)'); g.addColorStop(1, 'rgba(20,20,26,1)');
    a.fillStyle = g; a.fillRect(AW * 0.60, AH * 0.10, AW * 0.36, AH * 0.34);
    /* and the headline, because a press sheet has type on it */
    a.fillStyle = '#14141a';
    a.font = '900 132px ' + (token('--sans') || 'sans-serif');
    a.fillText('SL-11', AW * 0.06, AH * 0.90);
    a.font = '600 30px ' + (token('--mono') || 'monospace');
    a.fillText('FOUR COLOUR PROCESS', AW * 0.62, AH * 0.66);
    a.font = '500 19px ' + (token('--mono') || 'monospace');
    a.fillText('175 LPI · GMG PROOF · SHEET 1 OF 1', AW * 0.62, AH * 0.74);
    ADATA = a.getImageData(0, 0, AW, AH).data;
  })();

  /* RGB to CMYK, the ordinary way, with GCR pulling the common component
     into black — which is what makes four plates cheaper than three and is
     why a black plate exists at all. */
  function sample(ax, ay, ch) {
    if (ax < 0 || ay < 0 || ax >= AW || ay >= AH) return 0;
    var o = (((ay | 0) * AW) + (ax | 0)) * 4;
    var r = ADATA[o] / 255, g = ADATA[o + 1] / 255, b = ADATA[o + 2] / 255;
    var k = 1 - Math.max(r, g, b);
    if (ch === 'k') return k;
    if (k >= 0.999) return 0;
    if (ch === 'c') return (1 - r - k) / (1 - k);
    if (ch === 'm') return (1 - g - k) / (1 - k);
    return (1 - b - k) / (1 - k);
  }

  /* Ink spreads into paper. 12% at the midtone, nothing at either end —
     which is what newsprint does, and what makes a screen look printed
     rather than computed. Turn it off and the page goes pale. */
  function dotGain(c) { return gain ? Math.min(1, c + 0.12 * Math.sin(Math.PI * c)) : c; }

  var sprites = {};
  function sprite(ch, r) {
    var key = ch + '|' + Math.round(r * 4);
    if (sprites[key]) return sprites[key];
    var d = Math.max(2, Math.ceil(r * 2) + 2), c = document.createElement('canvas');
    c.width = c.height = d;
    var x = c.getContext('2d');
    x.fillStyle = SKIN_CSS(INK[ch]);
    x.beginPath(); x.arc(d / 2, d / 2, r, 0, TAU); x.fill();
    sprites[key] = c;
    return c;
  }

  /* THE SCREEN TURNS. This is the section's motion and it is also the
     section's subject: a halftone's whole character is set by the angle
     between its plates, so drifting them is not decoration applied to a
     still picture — it is the variable itself, moving. */
  function angleOf(p, t) {
    return p.deg + (locked ? 0 : 7.5 * Math.sin(t * TAU + p.deg * 0.017));
  }

  function screenPlate(p, t) {
    var deg = angleOf(p, t) * Math.PI / 180, ca = Math.cos(deg), sa = Math.sin(deg);
    /* cellScale is what makes the loupe a loupe. Magnifying the artwork
       while holding the ruling constant is a digital zoom — you get more
       picture at the same dot size, which is not what a linen tester does.
       A real one magnifies the PAPER, so the dots grow with the image and
       you see fewer of them. Scaling the cell and the view together is the
       whole difference. */
    var cell = (CELL * cellScale) / p.freq;
    /* walk the ROTATED lattice and place a dot per cell, rather than
       walking pixels and testing each one — a halftone is a set of marks,
       and this section is about what marks cost */
    /* Iterate the lattice's own bounding box, not a square big enough to
       contain every rotation of it. The first version walked
       (2·diag+1)² cells per plate and threw away nine in ten of them
       off-screen — 449 000 iterations to place 45 000 dots, and the cost
       showed up as 45 ms a frame on a section whose subject is cost.
       Un-rotating the four canvas corners gives the exact range. */
    var i, j, lx, ly, x, y, c, r, n = 0, k;
    var iMin = Infinity, iMax = -Infinity, jMin = Infinity, jMax = -Infinity;
    var corners = [[-W / 2, -H / 2], [W / 2, -H / 2], [-W / 2, H / 2], [W / 2, H / 2]];
    for (k = 0; k < 4; k++) {
      var px2 = corners[k][0], py2 = corners[k][1];
      var u = (px2 * ca + py2 * sa) / cell, v = (-px2 * sa + py2 * ca) / cell;
      if (u < iMin) iMin = u; if (u > iMax) iMax = u;
      if (v < jMin) jMin = v; if (v > jMax) jMax = v;
    }
    iMin = Math.floor(iMin) - 1; iMax = Math.ceil(iMax) + 1;
    jMin = Math.floor(jMin) - 1; jMax = Math.ceil(jMax) + 1;
    ctx.fillStyle = SKIN_CSS(INK[p.ch]);
    if (method === 'batched') ctx.beginPath();
    for (j = jMin; j <= jMax; j++) {
      for (i = iMin; i <= iMax; i++) {
        lx = i * cell; ly = j * cell;
        x = lx * ca - ly * sa + W / 2;
        y = lx * sa + ly * ca + H / 2;
        if (x < -cell || y < -cell || x > W + cell || y > H + cell) continue;
        c = dotGain(sample(ax0 + (x - W / 2) / (zoom * K), ay0 + (y - H / 2) / (zoom * K), p.ch));
        if (c < 0.02) continue;
        r = cell * 0.5 * Math.sqrt(c / 0.7854);      /* area → radius */
        if (r > cell * 0.78) r = cell * 0.78;
        n++;
        if (method === 'arc') { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
        else if (method === 'batched') { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }
        else if (method === 'sprite') { var sp = sprite(p.ch, r); ctx.drawImage(sp, x - sp.width / 2, y - sp.height / 2); }
        else { ctx.fillRect(x - r, y - r, r * 2, r * 2); }
      }
    }
    if (method === 'batched') ctx.fill();
    return n;
  }

  function trimMarks() {
    var i, L = 26 * K;
    ctx.strokeStyle = RULE; ctx.lineWidth = Math.max(1, Math.round(K));
    [[0, 0], [W, 0], [0, H], [W, H]].forEach(function (c) {
      ctx.beginPath();
      ctx.moveTo(c[0] + (c[0] ? -L : L) * 0.15, c[1] + 0.5); ctx.lineTo(c[0] + (c[0] ? -L : L), c[1] + 0.5);
      ctx.moveTo(c[0] + 0.5, c[1] + (c[1] ? -L : L) * 0.15); ctx.lineTo(c[0] + 0.5, c[1] + (c[1] ? -L : L));
      ctx.stroke();
    });
    /* the register target — four inks through one mark, which is the one
       piece of furniture that says "this came off a press" */
    var cx = W / 2, cy = 16 * K;
    ctx.beginPath(); ctx.arc(cx, cy, 9 * K, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - 14 * K, cy); ctx.lineTo(cx + 14 * K, cy);
    ctx.moveTo(cx, cy - 14 * K); ctx.lineTo(cx, cy + 14 * K); ctx.stroke();
  }

  var demo = WAM.clock('h2-stage', {
    el: $('h2-world'), dur: 16000, poster: 0.3,
    render: function (t) {
      ctx.fillStyle = SKIN_CSS(STOCK);
      ctx.fillRect(0, 0, W, H);

      /* THE PRESS RUNS AND THE LOUPE MOVES. Magnification sweeps between
         roughly 1x and 6x and the view drifts across the sheet, so the
         picture resolves out of the rosette and dissolves back into it —
         which is the one thing about halftones that has to be SEEN rather
         than explained, and it is the reason this section exists at all. */
      zoom = 1.15 + 2.6 * (0.5 - 0.5 * Math.cos(t * TAU));
      ax0 = AW * (0.42 + 0.22 * Math.sin(t * TAU));
      ay0 = AH * (0.50 + 0.16 * Math.sin(t * TAU * 2 + 1.7));

      /* the proof sequence: yellow down first, then cyan, magenta, black —
         the order a sheet actually goes through a press, and the reason a
         proof is read plate by plate rather than only at the end */
      /* Weighted, not even: one, two, three, then the full sheet for half
         the cycle. An even four-way split spends three quarters of its time
         on an incomplete proof, and the complete one is the thing worth
         looking at — the incomplete ones are how it got there. */
      if (proofing) plateCount = [1, 2, 3, 4, 4, 4][Math.floor(t * 6) % 6];

      var t0 = performance.now(), n = 0, i;
      /* MULTIPLY, because that is what ink on ink does. Subtractive
         compositing is physically correct here rather than stylistically
         preferred, and it is why the overlaps darken instead of covering. */
      ctx.globalCompositeOperation = 'multiply';
      for (i = 0; i < PLATES.length; i++) {
        if (!on[PLATES[i].ch]) continue;
        if (proofing && i >= plateCount) continue;
        n += screenPlate(PLATES[i], t);
      }
      ctx.globalCompositeOperation = 'source-over';
      sync(ctx);
      var dt = performance.now() - t0;
      costs.push(dt); if (costs.length > 20) costs.shift();
      dots = n;

      /* ── the loupe ─────────────────────────────────────────────────
         A press operator's linen tester, and the reason one is on every
         press in the world: you cannot judge register or dot shape at
         reading distance. Inside the ring the same sheet is screened at
         three times the magnification, so the image and its dots are on
         screen at once — which is the comparison the whole section is
         about. */
      if (loupeOn) {
        var lr = 118 * K;
        var lx = W * (0.5 + 0.30 * Math.sin(t * TAU * 3));
        var ly = H * (0.5 + 0.26 * Math.sin(t * TAU * 5 + 2.1));
        var keepZ = zoom, keepX = ax0, keepY = ay0;
        ctx.save();
        ctx.beginPath(); ctx.arc(lx, ly, lr, 0, TAU); ctx.clip();
        ctx.fillStyle = SKIN_CSS(STOCK);
        ctx.fillRect(lx - lr, ly - lr, lr * 2, lr * 2);
        /* re-screen the same sheet, three times closer, around the point
           the ring is actually over */
        var LOUPE = 3;
        ax0 = keepX + (lx - W / 2) / (keepZ * K);
        ay0 = keepY + (ly - H / 2) / (keepZ * K);
        zoom = keepZ * LOUPE;
        cellScale = LOUPE;
        ctx.translate(lx - W / 2, ly - H / 2);
        ctx.globalCompositeOperation = 'multiply';
        for (i = 0; i < PLATES.length; i++) {
          if (!on[PLATES[i].ch]) continue;
          if (proofing && i >= plateCount) continue;
          screenPlate(PLATES[i], t);
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();
        zoom = keepZ; ax0 = keepX; ay0 = keepY; cellScale = 1;
        /* the ring: a machined barrel, in the same flat notation as every
           other bevel on this sheet */
        ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 7 * K;
        ctx.beginPath(); ctx.arc(lx, ly, lr + 3 * K, 0, TAU); ctx.stroke();
        ctx.strokeStyle = RULE; ctx.lineWidth = 2 * K;
        ctx.beginPath(); ctx.arc(lx, ly, lr, 0, TAU); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = K;
        ctx.beginPath(); ctx.arc(lx, ly, lr + 6 * K, 0, TAU); ctx.stroke();
      }

      trimMarks();
      $('h2-dots').textContent = n.toLocaleString();
      $('h2-cost').innerHTML = ms(median(costs)) + ' ms' + atFloor(median(costs));
      $('h2-ruling').textContent = Math.round(CELL / DPR) + ' px · ' + zoom.toFixed(1) + '×'
        + (proofing ? ' · plate ' + plateCount + '/4' : '');
      $('h2-angles').textContent = locked
        ? 'Y 0 · C 15 · K 45 · M 75 — locked'
        : PLATES.map(function (p) { return p.ch.toUpperCase() + ' ' + angleOf(p, t).toFixed(1); }).join(' · ');
    }
  });

  /* ── the explanatory graphic, in this world's own language ──────────
     A press proof: the four separations, what they make together, and the
     tone ramp that says what a dot of a given size is worth. Printed on the
     same stock, in the same four inks, at the same angles as the console —
     because an explanation of a world belongs to it. */
  (function () {
    var EW = 1200, EH = 186;
    var ec = $('h2-explain'), ex = ec.getContext('2d');
    ec.width = EW; ec.height = EH;

    function patch(x, y, w, h, plates, tone, t) {
      ex.save();
      ex.beginPath(); ex.rect(x, y, w, h); ex.clip();
      ex.fillStyle = SKIN_CSS(STOCK); ex.fillRect(x, y, w, h);
      ex.globalCompositeOperation = 'multiply';
      plates.forEach(function (p) {
        var deg = p.deg * Math.PI / 180, ca = Math.cos(deg), sa = Math.sin(deg);
        var cell = CELL / p.freq, i, j, lx, ly, px2, py2, c, r;
        var reach = Math.ceil(Math.max(w, h) / cell) + 2;
        ex.fillStyle = SKIN_CSS(INK[p.ch]);
        for (j = -reach; j <= reach; j++) {
          for (i = -reach; i <= reach; i++) {
            lx = i * cell; ly = j * cell;
            px2 = lx * ca - ly * sa + x + w / 2;
            py2 = lx * sa + ly * ca + y + h / 2;
            if (px2 < x - cell || py2 < y - cell || px2 > x + w + cell || py2 > y + h + cell) continue;
            c = dotGain(tone);
            if (c < 0.02) continue;
            r = cell * 0.5 * Math.sqrt(c / 0.7854);
            if (r > cell * 0.78) r = cell * 0.78;
            ex.beginPath(); ex.arc(px2, py2, r, 0, TAU); ex.fill();
          }
        }
      });
      ex.globalCompositeOperation = 'source-over';
      ex.restore();
      ex.strokeStyle = RULE; ex.lineWidth = 1;
      ex.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    }

    WAM.clock('h2-explain-stage', {
      el: $('h2-explain-stage'), dur: 16000, poster: 0.3,
      render: function (t) {
        ex.fillStyle = SKIN_CSS(STOCK);
        ex.fillRect(0, 0, EW, EH);
        ex.font = '11px ' + (token('--mono') || 'monospace');
        ex.fillStyle = SKIN_CSS(resolveRGB(token('--h2-ink-k')));

        /* the separations, each alone, then the four together */
        var pw = 116, ph = 116, py = 34, gap = 14, x0 = 18;
        var tone = 0.52 + 0.2 * Math.sin(t * TAU);
        PLATES.forEach(function (p, i) {
          var x = x0 + i * (pw + gap);
          patch(x, py, pw, ph, [p], tone, t);
          ex.fillStyle = SKIN_CSS(resolveRGB(token('--h2-ink-k')));
          ex.fillText(p.ch.toUpperCase() + '  ' + p.deg + '°', x, py - 8);
        });
        var xc = x0 + 4 * (pw + gap) + 10;
        /* Half the tone for the four-colour patch: at 68% coverage in four
           inks a multiply stack is simply black, and the rosette — the thing
           the patch exists to show — disappears into it. */
        patch(xc, py, pw + 30, ph, PLATES, tone * 0.5, t);
        ex.fillStyle = SKIN_CSS(resolveRGB(token('--h2-ink-k')));
        ex.fillText('TOGETHER — THE ROSETTE', xc, py - 8);

        /* the tone ramp: coverage against the dot that carries it. Area,
           not width, which is the thing people get wrong about halftones. */
        var rx = xc + pw + 60, rw = EW - rx - 20, ry = py, steps = 11, i2;
        ex.fillText('COVERAGE 0 → 100%', rx, py - 8);
        for (i2 = 0; i2 < steps; i2++) {
          var c2 = i2 / (steps - 1);
          var cw = rw / steps;
          patch(rx + i2 * cw, ry, cw - 2, ph * 0.62, [PLATES[2]], c2, t);
        }
        ex.fillStyle = SKIN_CSS(resolveRGB(token('--h2-sub')));
        ex.fillText('r = cell/2 · √(coverage / π)   —   AREA, NOT WIDTH', rx, ry + ph * 0.62 + 18);
        ex.fillStyle = SKIN_CSS(resolveRGB(token('--h2-ink-k')));
        ex.fillText('TONE ' + Math.round(tone * 100) + '%', x0, py + ph + 20);
        ex.fillStyle = SKIN_CSS(resolveRGB(token('--h2-sub')));
        ex.fillText('dot gain ' + (gain ? 'ON — coverage pushed by 0.12·sin(πc)' : 'OFF — the plate, before the press has had it'), x0 + 110, py + ph + 20);
      }
    });
  })();

  dsp.on($('h2-bar'), 'click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.m) {
      method = b.dataset.m;
      costs = [];
      [].forEach.call(this.querySelectorAll('[data-m]'), function (x) { x.classList.toggle('h2-on', x === b); });
    } else if (b.dataset.ch) {
      on[b.dataset.ch] = !on[b.dataset.ch];
      b.classList.toggle('h2-on', on[b.dataset.ch]);
    } else if (b === $('h2-gain')) {
      gain = !gain;
      b.classList.toggle('h2-on', gain);
    } else if (b === $('h2-lock')) {
      locked = !locked;
      b.classList.toggle('h2-on', locked);
      b.textContent = locked ? 'release' : 'lock angles';
    } else if (b === $('h2-proof')) {
      proofing = !proofing; plateCount = 4;
      b.classList.toggle('h2-on', proofing);
    } else if (b === $('h2-loupe')) {
      loupeOn = !loupeOn;
      b.classList.toggle('h2-on', loupeOn);
    }
    demo.render(demo.t);
  });


  /* EXTRACTION: the sheet ran this through BOOT.when — held until §5's
     worker had settled (or a 4 s fallback), because the ~1 s measurement
     starved §5's ping. There is no §5 in this demo, so it runs once, a
     moment after mount, and the timer is cancelled if the demo unmounts
     first. */
  dsp.timeout(function () { SEC2.measure(); tokens.reportTokenMisses(); }, 1000);
})();

  return function dispose() { dsp.run(); };
}
