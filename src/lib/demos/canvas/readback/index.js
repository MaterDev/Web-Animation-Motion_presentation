// @ts-nocheck -- untyped sheet code, extracted from design/techniques/canvas.html §4 (lines 2630–3080)
import { stage } from '../../_kit/stage.js';
import { createWAM } from '../../_kit/wam.js';
import { disposer } from '../../_kit/disposer.js';
import css from './demo.css?raw';
import html from './demo.html?raw';
import { SKIN_CSS } from './skin.js';
import { TAU, median, atFloor, ms, rng, resolveRGB, createTokens } from './helpers.js';

/* ════════════════════════════════════════════════════════════════════════
   §4 · READ — readback
   ════════════════════════════════════════════════════════════════════════ */
export function mount(host) {
  const { root, body, $ } = stage(host, { css, html });
  const WAM = createWAM({ root });
  const dsp = disposer();
  dsp.add(() => WAM.dispose());
  const tokens = createTokens(host, body, 'r4');
  dsp.add(tokens.dispose);
  const token = tokens.token;

  var W = 1240, H = 640;
  var cv = $('r4-canvas'), ctx = cv.getContext('2d', { willReadFrequently: true });
  cv.width = W; cv.height = H;

  var VOID = resolveRGB(token('--r4-void'));
  var FRAME = SKIN_CSS(resolveRGB(token('--r4-frame')));
  var RULE = SKIN_CSS(resolveRGB(token('--r4-rule')));
  var INK = SKIN_CSS(resolveRGB(token('--r4-ink')));
  var ANNO = SKIN_CSS(resolveRGB(token('--r4-anno')));
  var ROI = SKIN_CSS(resolveRGB(token('--r4-roi')));

  /* Two LUTs, 256 entries each. GSDF grey is perceptually linear and
     chroma 0 — DICOM Part 14 is a real worldwide calibration, and it is why
     a reading room is colourless on purpose rather than by omission. The
     heat ramp is monotone in lightness too, so it carries a value scale
     rather than needing a colour key. */
  function lutFrom(stops) {
    var out = new Uint8Array(256 * 3), i, u, k, f, a, b;
    for (i = 0; i < 256; i++) {
      u = (i / 255) * (stops.length - 1);
      k = Math.min(stops.length - 2, u | 0); f = u - k;
      a = stops[k]; b = stops[k + 1];
      out[i * 3] = a[0] + (b[0] - a[0]) * f;
      out[i * 3 + 1] = a[1] + (b[1] - a[1]) * f;
      out[i * 3 + 2] = a[2] + (b[2] - a[2]) * f;
    }
    return out;
  }
  /* The FUSION ramp — colour as a second dimension, on its own maths and
     its own clock. A greyscale study answers "how dense"; a functional
     overlay answers a different question entirely, and every workstation
     that carries both shows them fused rather than side by side, because
     the point is where the two agree. It runs on a period deliberately
     unrelated to the cine loop and the window sweep, so the three never
     line up into one beat — three independent cycles read as an instrument
     with three things going on, and three locked cycles read as one. */
  var FUSION = {
    jet: lutFrom([resolveRGB('oklch(0.35 0.14 265)'), resolveRGB('oklch(0.60 0.15 215)'),
                  resolveRGB('oklch(0.78 0.16 155)'), resolveRGB('oklch(0.87 0.17 95)'),
                  resolveRGB('oklch(0.65 0.22 28)')]),
    ice: lutFrom([resolveRGB('oklch(0.30 0.10 300)'), resolveRGB('oklch(0.55 0.14 265)'),
                  resolveRGB('oklch(0.78 0.11 225)'), resolveRGB('oklch(0.95 0.05 200)')]),
    /* a spectral ramp, which is the one that carries the most colour per
       step and the one a functional study is most often read through */
    spectral: lutFrom([resolveRGB('oklch(0.26 0.13 292)'), resolveRGB('oklch(0.52 0.17 250)'),
                       resolveRGB('oklch(0.72 0.16 175)'), resolveRGB('oklch(0.86 0.17 118)'),
                       resolveRGB('oklch(0.84 0.18  62)'), resolveRGB('oklch(0.64 0.23  22)')])
  };
  var RAMPS = ['jet', 'ice', 'spectral'];

  var LUTS = {
    gsdf: lutFrom([[8, 8, 8], [250, 250, 250]]),
    iron: lutFrom([resolveRGB('oklch(0.060 0.010 30)'), resolveRGB('oklch(0.280 0.130 28)'),
                   resolveRGB('oklch(0.520 0.200 38)'), resolveRGB('oklch(0.720 0.180 62)'),
                   resolveRGB('oklch(0.880 0.155 92)'), resolveRGB('oklch(0.985 0.012 95)')])
  };

  /* ── the source, which is a canvas and nothing else ──────────────────
     A synthetic phantom. Nothing here is a real scan of a real person, and
     nothing is decoded from one. It is drawn into an offscreen canvas, and
     everything the workstation says about it is obtained by READING IT
     BACK — not by re-evaluating the function that drew it. */
  var SW = 520, SH = 520;
  var src = document.createElement('canvas');
  src.width = SW; src.height = SH;
  var sx2 = src.getContext('2d', { willReadFrequently: true });
  var srcImg = sx2.createImageData(SW, SH);

  function drawSlice(z) {
    var d = srcImg.data, x, y, o, u, v, r, a, val, i;
    var r0 = rng(0x5CA4 + ((z * 97) | 0));
    for (y = 0; y < SH; y++) {
      for (x = 0; x < SW; x++) {
        o = (y * SW + x) * 4;
        u = (x / SW - 0.5) * 2; v = (y / SH - 0.5) * 2;
        r = Math.sqrt(u * u * 1.18 + v * v);
        val = 0;
        if (r < 0.94) {
          val = 0.30 + 0.10 * Math.sin(u * 9 + z * 4) * Math.cos(v * 7 - z * 3);
          /* the wall */
          if (r > 0.88) val = 0.86;
          /* two structures that move through the stack */
          a = Math.exp(-(Math.pow(u + 0.32 + 0.16 * Math.sin(z * TAU), 2) * 26 + Math.pow(v + 0.12, 2) * 30));
          val += a * 0.52;
          a = Math.exp(-(Math.pow(u - 0.38, 2) * 34 + Math.pow(v - 0.24 - 0.2 * Math.cos(z * TAU), 2) * 22));
          val += a * 0.44;
          /* a dense inclusion that only appears over part of the stack */
          a = Math.exp(-(Math.pow(u - 0.04, 2) * 190 + Math.pow(v + 0.36, 2) * 190));
          val += a * (0.5 + 0.5 * Math.sin(z * TAU * 2)) * 0.95;
          val += (r0() - 0.5) * 0.05;
        }
        val = val < 0 ? 0 : val > 1 ? 1 : val;
        i = (val * 255) | 0;
        d[o] = d[o + 1] = d[o + 2] = i;
        d[o + 3] = 255;
      }
    }
    sx2.putImageData(srcImg, 0, 0);
  }

  var lut = 'gsdf', cine = true, roiOn = true, recon = false, autoWin = true;
  var fusion = true, fusionRamp = 'spectral', fusionGain = 1, rotate = true;
  var ww = 0.62, wl = 0.46, dragging = false, lastXY = null;
  var readCosts = [], out = null, o32 = null;
  var VX = 20, VY = 18, VW = 560, VH = 560;             /* the viewport */
  var RX = VX + VW + 26, RW = W - RX - 20;

  function ensureOut() {
    if (!out || out.width !== VW) { out = ctx.createImageData(VW, VH); o32 = new Uint32Array(out.data.buffer); }
  }

  /* ROI, in source coordinates */
  var roi = { x: 190, y: 150, w: 140, h: 110 };

  var demo = WAM.clock('r4-stage', {
    /* 17 400 rather than 20 000 — 15% faster. The cine loop, the window
       sweep and the overlay's own cycles are all expressed as multiples of
       t, so shortening the period speeds every one of them by the same
       factor and none of them comes into phase with any other as a result. */
    el: $('r4-world'), dur: 17400, poster: 0.4,
    render: function (t) {
      ensureOut();
      var z = cine ? t : 0.3;
      drawSlice(z);

      /* The window BREATHES. A radiographer's hands are on these two numbers
         constantly — widening to find an edge, narrowing to separate two
         tissues that sit a few levels apart, sliding the centre to follow a
         structure through the stack. A still window is a screenshot of a
         workstation; a moving one is somebody using it. Touch the image and
         it hands control over and stays handed over. */
      if (autoWin) {
        ww = 0.46 + 0.30 * Math.sin(t * TAU * 3);
        wl = 0.46 + 0.17 * Math.sin(t * TAU * 2 + 1.1);
      }

      /* THE READBACK. Everything below comes out of this one call — the
         display mapping, the histogram, the region statistics and the
         reconstruction. Not one of them re-evaluates the function that
         drew the slice. */
      var t0 = performance.now();
      var s = sx2.getImageData(0, 0, SW, SH).data;
      readCosts.push(performance.now() - t0);
      if (readCosts.length > 20) readCosts.shift();

      var table = LUTS[lut];
      var lo = wl - ww / 2, hi = wl + ww / 2;
      var hist = new Uint32Array(64);
      var x, y, sxi, syi, v, n, o;
      var roiSum = 0, roiSq = 0, roiN = 0;

      /* the overlay's own clock: 0.41 and 0.63 against the cine loop's 1
         and the window's 1.3 and 0.7 — no small common multiple, so the
         three never come into phase */
      var ft = t * 5, fs = t * 7;
      var fTab = FUSION[fusionRamp];
      var fCover = 0;
      /* the field's own rotation and the ramp's own phase, both on periods
         that share no small multiple with the cine loop or the window */
      var rot = t * TAU * 2, cosR = Math.cos(rot), sinR = Math.sin(rot);
      var rampPhase = rotate ? (t * 3) % 1 : 0;

      for (y = 0; y < VH; y++) {
        syi = ((y / VH) * SH) | 0;
        for (x = 0; x < VW; x++) {
          sxi = ((x / VW) * SW) | 0;
          v = s[(syi * SW + sxi) * 4] / 255;
          hist[Math.min(63, (v * 64) | 0)]++;
          n = (v - lo) / (hi - lo);
          n = n < 0 ? 0 : n > 1 ? 1 : n;
          o = y * VW + x;
          var idx = (n * 255) | 0;
          var rr = table[idx * 3], gg = table[idx * 3 + 1], bb = table[idx * 3 + 2];

          if (fusion) {
            /* The functional value is DERIVED FROM THE READ, not from the
               function that drew the slice — it is uptake-shaped: high where
               the tissue is dense and where a slow travelling field says it
               is active. The field is the second dimension and it is why
               this needs colour: two quantities cannot share one grey. */
            var u2 = x / VW - 0.5, v2b = y / VH - 0.5;
            /* Three spatial terms rather than two, one of them ROTATING —
               a field built only from axis-aligned sines drifts, and a
               drifting field reads as a pattern sliding behind a window
               rather than as something happening inside the subject. The
               rotation is what makes it turn. */
            var ru = u2 * cosR - v2b * sinR, rv = u2 * sinR + v2b * cosR;
            var rad = Math.sqrt(u2 * u2 + v2b * v2b);
            var f = v
              * (0.50 + 0.50 * Math.sin(ru * 6.1 + ft * TAU))
              * (0.45 + 0.55 * Math.cos(rv * 5.3 - fs * TAU))
              * (0.60 + 0.40 * Math.sin(rad * 13.0 - ft * TAU * 2));
            f = (f - 0.14) / 0.46;
            f = f < 0 ? 0 : f > 1 ? 1 : f;
            f *= fusionGain;
            if (f > 0.03) {
              fCover++;
              /* the ramp ROTATES under the value, which is a real control on
                 a real workstation — a rotating colour map makes a plateau
                 that a static one flattens into one tone show its shape as
                 a moving band. */
              var fv = rotate ? (f + rampPhase) % 1 : f;
              var fi = ((fv * 255) | 0) * 3;
              var al = 0.22 + f * 0.72;
              rr = rr + (fTab[fi] - rr) * al;
              gg = gg + (fTab[fi + 1] - gg) * al;
              bb = bb + (fTab[fi + 2] - bb) * al;
            }
          }
          o32[o] = (255 << 24) | (bb << 16) | (gg << 8) | rr;
        }
      }
      for (y = roi.y; y < roi.y + roi.h; y++) {
        for (x = roi.x; x < roi.x + roi.w; x++) {
          v = s[(y * SW + x) * 4];
          roiSum += v; roiSq += v * v; roiN++;
        }
      }

      ctx.fillStyle = SKIN_CSS(VOID);
      ctx.fillRect(0, 0, W, H);
      ctx.putImageData(out, VX, VY);

      /* viewport furniture — thin rules, nothing decorative */
      ctx.strokeStyle = RULE; ctx.lineWidth = 1;
      ctx.strokeRect(VX - 0.5, VY - 0.5, VW + 1, VH + 1);

      if (recon) {
        /* the mark, assembled out of pixels above threshold. No path data
           is authored: change the slice and the target set changes. */
        ctx.fillStyle = ANNO;
        var step = 5, cnt = 0;
        for (y = 0; y < SH; y += step) {
          for (x = 0; x < SW; x += step) {
            if (s[(y * SW + x) * 4] > 190) {
              ctx.fillRect(VX + (x / SW) * VW, VY + (y / SH) * VH, 2, 2);
              cnt++;
            }
          }
        }
        ctx.font = '11px ' + (token('--mono') || 'monospace');
        ctx.fillText(cnt.toLocaleString() + ' PIXELS OVER THRESHOLD, READ BACK', VX + 10, VY + VH - 12);
      }

      if (roiOn) {
        ctx.strokeStyle = ROI; ctx.lineWidth = 1;
        ctx.strokeRect(VX + (roi.x / SW) * VW + 0.5, VY + (roi.y / SH) * VH + 0.5,
                       (roi.w / SW) * VW, (roi.h / SH) * VH);
      }

      /* the acquisition sweep — one bright row travelling the viewport, the
         way a detector reads a frame out. Two fillRects, and the cheapest
         possible way to say "this is live". */
      var sweepY = Math.round(((t * 3) % 1) * VH);
      ctx.fillStyle = 'rgba(255,255,255,0.035)';
      ctx.fillRect(VX, VY + Math.max(0, sweepY - 26), VW, Math.min(26, sweepY));
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.fillRect(VX, VY + sweepY, VW, 2);

      /* overlay annotation, the one colour allowed in */
      ctx.fillStyle = ANNO;
      ctx.font = '12px ' + (token('--mono') || 'monospace');
      ctx.fillText('SYNTHETIC PHANTOM — NOT A PATIENT', VX + 10, VY + 22);
      ctx.fillText('W ' + Math.round(ww * 1000) + '  L ' + Math.round(wl * 1000), VX + 10, VY + 40);

      /* ── the right-hand column, all of it derived ────────────────── */
      var hy = VY + 14;
      ctx.fillStyle = INK; ctx.font = '11px ' + (token('--mono') || 'monospace');
      ctx.fillText('HISTOGRAM — COUNTED FROM THE PIXELS, EVERY FRAME', RX, hy);
      var hh = 150, hmax = 1;
      for (x = 0; x < 64; x++) if (hist[x] > hmax) hmax = hist[x];
      for (x = 0; x < 64; x++) {
        var bw = RW / 64, bh = Math.round((hist[x] / hmax) * hh);
        var inWin = (x / 64) >= lo && (x / 64) <= hi;
        /* Each bar is painted in the colour that value will actually
           receive — through the display LUT, and through the fusion ramp
           where the overlay reaches it. The histogram stops being a chart
           beside the image and becomes a legend for it: the bar you are
           looking at is the grey, or the colour, it will turn into. */
        var bi = Math.round(Math.max(0, Math.min(1, ((x / 64) - lo) / (hi - lo))) * 255) * 3;
        if (inWin) {
          var hr = table[bi], hg = table[bi + 1], hb = table[bi + 2];
          if (fusion) {
            var fw = Math.max(0, Math.min(1, ((x / 64) - 0.42) / 0.5));
            var qi = ((fw * 255) | 0) * 3;
            hr += (fTab[qi] - hr) * fw * 0.8;
            hg += (fTab[qi + 1] - hg) * fw * 0.8;
            hb += (fTab[qi + 2] - hb) * fw * 0.8;
          }
          ctx.fillStyle = 'rgb(' + (hr | 0) + ',' + (hg | 0) + ',' + (hb | 0) + ')';
        } else {
          ctx.fillStyle = RULE;
        }
        ctx.fillRect(RX + x * bw, hy + 12 + hh - bh, bw - 1, bh);
      }
      /* the window, drawn over the histogram it selects, clamped to the
         histogram's own range — an unclamped box ran off both ends and
         stopped reading as a selection */
      var wLo = Math.max(0, Math.min(1, lo)), wHi = Math.max(0, Math.min(1, hi));
      ctx.strokeStyle = ANNO; ctx.lineWidth = 1;
      ctx.strokeRect(RX + wLo * RW + 0.5, hy + 12.5, Math.max(2, (wHi - wLo) * RW), hh);

      /* the LUT it maps through */
      var ly = hy + 12 + hh + 34;
      ctx.fillStyle = INK;
      ctx.fillText(lut === 'gsdf' ? 'LUT — DICOM GSDF GREY, 256 ENTRIES' : 'LUT — HEAT, 256 ENTRIES, MONOTONE IN L', RX, ly - 10);
      for (x = 0; x < RW; x++) {
        var li = ((x / RW) * 255) | 0;
        ctx.fillStyle = 'rgb(' + table[li * 3] + ',' + table[li * 3 + 1] + ',' + table[li * 3 + 2] + ')';
        ctx.fillRect(RX + x, ly, 1, 26);
      }
      ctx.strokeStyle = RULE; ctx.strokeRect(RX - 0.5, ly - 0.5, RW + 1, 27);
      /* the overlay's own ramp, under the study's, so the two scales the
         image is carrying are both legible as scales */
      if (fusion) {
        for (x = 0; x < RW; x++) {
          /* the legend rotates with the map. A static swatch beside a
             rotating overlay is a legend that lies, and a legend that lies
             is worse than none. */
          var fi2 = ((((x / RW + rampPhase) % 1) * 255) | 0) * 3;
          ctx.fillStyle = 'rgb(' + fTab[fi2] + ',' + fTab[fi2 + 1] + ',' + fTab[fi2 + 2] + ')';
          ctx.fillRect(RX + x, ly + 31, 1, 14);
        }
        ctx.strokeStyle = RULE; ctx.strokeRect(RX - 0.5, ly + 30.5, RW + 1, 15);
        ctx.fillStyle = INK;
        ctx.fillText('FUSION — ' + fusionRamp.toUpperCase() + (rotate ? ' · ROTATING' : ''), RX, ly + 58);
      }

      /* the slice ladder — where in the stack we are */
      /* the stack sits below whatever the LUT column actually occupies —
         one bar or two. Hardcoding the offset put the fusion legend
         straight through the STACK label the moment the second ramp
         appeared. */
      var sy2 = ly + (fusion ? 92 : 62);
      ctx.fillStyle = INK;
      ctx.fillText('STACK', RX, sy2 - 10);
      for (x = 0; x < 48; x++) {
        var at = Math.abs(x / 48 - z) < 0.02;
        /* the ladder is tinted by what the overlay is doing at that slice,
           so the stack shows where the activity is rather than only where
           the reader is */
        var act = fusion ? Math.max(0, Math.sin((x / 48) * TAU * 2 + ft * TAU)) : 0;
        var ai = ((act * 255) | 0) * 3;
        ctx.fillStyle = at ? ANNO
          : (fusion && act > 0.25 ? 'rgb(' + fTab[ai] + ',' + fTab[ai + 1] + ',' + fTab[ai + 2] + ')' : RULE);
        ctx.fillRect(RX + x * (RW / 48), sy2, RW / 48 - 2, at ? 18 : 10);
      }

      /* ── the region, read back and magnified ─────────────────────
         A fourth thing derived from the same read. Nearest-neighbour on
         purpose: a workstation magnifies by showing you the pixels, not by
         inventing smoother ones between them, and the blocks are the
         honest statement of how much data is actually there. */
      var dy = sy2 + 58;
      ctx.fillStyle = INK;
      /* The region shows the STUDY, not the fusion. That is not an
         oversight: the overlay is a display layer computed from the
         viewport's own geometry, and magnifying it would mean magnifying a
         thing that only exists at one scale. The label says so rather than
         leaving the difference to be noticed. */
      ctx.fillText('REGION — THE STUDY ALONE, MAGNIFIED', RX, dy - 10);
      var dw = Math.min(RW, 300), dh = Math.round(dw * (roi.h / roi.w));
      if (roiOn) {
        for (y = 0; y < dh; y++) {
          syi = roi.y + ((y / dh) * roi.h) | 0;
          for (x = 0; x < dw; x++) {
            sxi = roi.x + ((x / dw) * roi.w) | 0;
            v = s[(syi * SW + sxi) * 4] / 255;
            n = (v - lo) / (hi - lo);
            n = n < 0 ? 0 : n > 1 ? 1 : n;
            var di = (n * 255) | 0;
            ctx.fillStyle = 'rgb(' + table[di * 3] + ',' + table[di * 3 + 1] + ',' + table[di * 3 + 2] + ')';
            ctx.fillRect(RX + x, dy + y, 1, 1);
          }
        }
        ctx.strokeStyle = ROI; ctx.strokeRect(RX - 0.5, dy - 0.5, dw + 1, dh + 1);
      } else {
        ctx.fillStyle = RULE;
        ctx.fillText('REGION OFF', RX, dy + 16);
      }

      /* the profile through the region's middle row, also from the read */
      if (roiOn) {
        var px2 = RX + dw + 24, pw2 = RW - dw - 24, ph2 = dh;
        ctx.fillStyle = INK;
        ctx.fillText('PROFILE THROUGH ITS MIDDLE ROW', px2, dy - 10);
        ctx.fillStyle = RULE;
        ctx.fillRect(px2, dy + ph2, pw2, 1);
        for (x = 0; x < pw2; x++) {
          sxi = roi.x + ((x / pw2) * roi.w) | 0;
          syi = roi.y + (roi.h >> 1);
          v = s[(syi * SW + sxi) * 4] / 255;
          /* the trace is painted in the colour the value maps to, so the
             profile is readable against the image without a key */
          var pi2 = Math.round(Math.max(0, Math.min(1, (v - lo) / (hi - lo))) * 255) * 3;
          ctx.fillStyle = fusion && v > 0.5
            ? 'rgb(' + fTab[pi2] + ',' + fTab[pi2 + 1] + ',' + fTab[pi2 + 2] + ')'
            : ANNO;
          ctx.fillRect(px2 + x, dy + ph2 - v * ph2, 1, 3);
        }
      }

      var mean = roiN ? roiSum / roiN : 0;
      var sd = roiN ? Math.sqrt(Math.max(0, roiSq / roiN - mean * mean)) : 0;
      $('r4-slice').textContent = Math.round(z * 48) + ' of 48';
      $('r4-wwwl').textContent = Math.round(ww * 1000) + ' / ' + Math.round(wl * 1000);
      $('r4-roistat').textContent = roiOn ? (mean.toFixed(1) + ' ± ' + sd.toFixed(1)) : 'off';
      $('r4-read').textContent = (SW * SH).toLocaleString();
      $('r4-readcost').innerHTML = ms(median(readCosts)) + ' ms' + atFloor(median(readCosts));
      $('r4-fusion-stat').textContent = fusion
        ? fusionRamp.toUpperCase() + ' — ' + (fCover / (VW * VH) * 100).toFixed(1) + '% of frame'
        : 'off';
    }
  });

  /* Drag for window and level — the two numbers every reading room argues
     about. Horizontal is window, vertical is level, which is the convention
     every workstation uses. */
  dsp.on(cv, 'pointerdown', function (e) { dragging = true; lastXY = [e.clientX, e.clientY]; cv.setPointerCapture(e.pointerId); });
  dsp.on(cv, 'pointerup', function (e) { dragging = false; cv.releasePointerCapture(e.pointerId); });
  dsp.on(cv, 'pointermove', function (e) {
    if (!dragging || !lastXY) return;
    /* the first drag takes the window off its automatic sweep and leaves it
       where the reader put it — a control that fights the hand on it is
       worse than no control at all */
    if (autoWin) { autoWin = false; $('r4-auto').classList.remove('r4-on'); }
    ww = Math.max(0.06, Math.min(1.4, ww + (e.clientX - lastXY[0]) * 0.003));
    wl = Math.max(0.05, Math.min(0.95, wl - (e.clientY - lastXY[1]) * 0.003));
    lastXY = [e.clientX, e.clientY];
    demo.render(demo.t);
  });

  dsp.on($('r4-bar'), 'click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.lut) {
      lut = b.dataset.lut;
      [].forEach.call(this.querySelectorAll('[data-lut]'), function (x) { x.classList.toggle('r4-on', x === b); });
    } else if (b === $('r4-cine')) { cine = !cine; b.classList.toggle('r4-on', cine); }
    else if (b === $('r4-auto')) { autoWin = !autoWin; b.classList.toggle('r4-on', autoWin); }
    else if (b === $('r4-fusion')) { fusion = !fusion; b.classList.toggle('r4-on', fusion); }
    else if (b === $('r4-ramp')) {
      fusionRamp = RAMPS[(RAMPS.indexOf(fusionRamp) + 1) % RAMPS.length];
      b.textContent = 'ramp: ' + fusionRamp;
    }
    else if (b === $('r4-rotate')) { rotate = !rotate; b.classList.toggle('r4-on', rotate); }
    else if (b === $('r4-roi')) { roiOn = !roiOn; b.classList.toggle('r4-on', roiOn); }
    else if (b === $('r4-recon')) { recon = !recon; b.classList.toggle('r4-on', recon); }
    demo.render(demo.t);
  });

  tokens.reportTokenMisses();
  return function dispose() { dsp.run(); };
}
