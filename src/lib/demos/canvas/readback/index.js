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

  /* Slide fit: the canvas fills an 864 × 384 CSS region of the 864 × 444
     slide well, with a 2× backing store so text and rules stay crisp.
     Everything below is drawn in CSS px under a scale(S) transform. */
  var S = 2, CW = 864, CH = 384, W = CW * S, H = CH * S;
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
  var readCosts = [];
  var MONO = token('--mono') || 'monospace';

  /* ── slide layout, CSS px ────────────────────────────────────────────
     Left: the scan, square, full height. Right: one 440 px column with
     histogram, LUT + fusion ramp, stack, then region + profile side by
     side. */
  var VX = 16, VY = 8, VW = 368, VH = 368;               /* the viewport */
  var RX = VX + VW + 24, RW = CW - RX - 16;
  var BOTTOM = VY + VH;

  /* The display image is mapped 1:1 with the read (SW × SH), then scaled
     onto the viewport — every read pixel reaches the screen, and the
     per-pixel loop stays at the source's size rather than the backing's. */
  var outCv = document.createElement('canvas');
  outCv.width = SW; outCv.height = SH;
  var outCtx = outCv.getContext('2d');
  var out = outCtx.createImageData(SW, SH), o32 = new Uint32Array(out.data.buffer);

  /* ROI, in source coordinates */
  var roi = { x: 190, y: 150, w: 140, h: 110 };
  var regCv = document.createElement('canvas');
  regCv.width = roi.w; regCv.height = roi.h;
  var regCtx = regCv.getContext('2d');
  var regImg = regCtx.createImageData(roi.w, roi.h);

  var demo = WAM.clock('r4-stage', {
    /* 17 400 rather than 20 000 — 15% faster. The cine loop, the window
       sweep and the overlay's own cycles are all expressed as multiples of
       t, so shortening the period speeds every one of them by the same
       factor and none of them comes into phase with any other as a result. */
    el: $('r4-world'), dur: 17400, poster: 0.4,
    render: function (t) {
      var z = cine ? t : 0.3;
      drawSlice(z);

      /* The window BREATHES. A radiographer's hands are on these two numbers
         constantly; a still window is a screenshot of a workstation, a
         moving one is somebody using it. Touch the image and it hands
         control over and stays handed over. */
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

      /* the overlay's own clock, on periods that share no small common
         multiple with the cine loop or the window sweep */
      var ft = t * 5, fs = t * 7;
      var fTab = FUSION[fusionRamp];
      var fCover = 0;
      var rot = t * TAU * 2, cosR = Math.cos(rot), sinR = Math.sin(rot);
      var rampPhase = rotate ? (t * 3) % 1 : 0;

      for (y = 0; y < SH; y++) {
        for (x = 0; x < SW; x++) {
          o = y * SW + x;
          v = s[o * 4] / 255;
          hist[Math.min(63, (v * 64) | 0)]++;
          n = (v - lo) / (hi - lo);
          n = n < 0 ? 0 : n > 1 ? 1 : n;
          var idx = (n * 255) | 0;
          var rr = table[idx * 3], gg = table[idx * 3 + 1], bb = table[idx * 3 + 2];

          if (fusion) {
            /* The functional value is DERIVED FROM THE READ: uptake-shaped,
               high where the tissue is dense and where a slow rotating
               field says it is active. Two quantities cannot share one
               grey, which is why this needs colour. */
            var u2 = x / SW - 0.5, v2b = y / SH - 0.5;
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
              /* the ramp ROTATES under the value, so a plateau shows its
                 shape as a moving band */
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
      outCtx.putImageData(out, 0, 0);

      ctx.setTransform(S, 0, 0, S, 0, 0);
      ctx.fillStyle = SKIN_CSS(VOID);
      ctx.fillRect(0, 0, CW, CH);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(outCv, VX, VY, VW, VH);

      /* viewport furniture — thin rules, nothing decorative */
      ctx.strokeStyle = RULE; ctx.lineWidth = 1;
      ctx.strokeRect(VX - 1, VY - 1, VW + 2, VH + 2);

      if (recon) {
        /* the mark, assembled out of pixels above threshold. No path data
           is authored: change the slice and the target set changes. */
        ctx.fillStyle = ANNO;
        var step = 5, cnt = 0;
        for (y = 0; y < SH; y += step) {
          for (x = 0; x < SW; x += step) {
            if (s[(y * SW + x) * 4] > 190) {
              ctx.fillRect(VX + (x / SW) * VW, VY + (y / SH) * VH, 1.5, 1.5);
              cnt++;
            }
          }
        }
        ctx.font = '11px ' + MONO;
        ctx.fillText(cnt.toLocaleString() + ' PIXELS OVER THRESHOLD', VX + 8, BOTTOM - 10);
      }

      if (roiOn) {
        ctx.strokeStyle = ROI; ctx.lineWidth = 1;
        ctx.strokeRect(VX + (roi.x / SW) * VW, VY + (roi.y / SH) * VH,
                       (roi.w / SW) * VW, (roi.h / SH) * VH);
      }

      /* the acquisition sweep — one bright row travelling the viewport */
      var sweepY = Math.round(((t * 3) % 1) * VH);
      ctx.fillStyle = 'rgba(255,255,255,0.035)';
      ctx.fillRect(VX, VY + Math.max(0, sweepY - 14), VW, Math.min(14, sweepY));
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.fillRect(VX, VY + sweepY, VW, 1);

      /* overlay annotation, the one colour allowed in */
      ctx.fillStyle = ANNO;
      ctx.font = '12px ' + MONO;
      ctx.textAlign = 'left';
      ctx.fillText('SYNTHETIC PHANTOM — NOT A PATIENT', VX + 8, VY + 18);
      ctx.fillText('W ' + Math.round(ww * 1000) + '  L ' + Math.round(wl * 1000), VX + 8, VY + 34);

      /* ── the right-hand column, all of it derived ────────────────── */
      ctx.font = '11px ' + MONO;
      ctx.fillStyle = INK;
      ctx.fillText('HISTOGRAM — COUNTED FROM THE PIXELS, EVERY FRAME', RX, VY + 10);
      var ht = VY + 18, hh = 92, hmax = 1, bw = RW / 64;
      for (x = 0; x < 64; x++) if (hist[x] > hmax) hmax = hist[x];
      for (x = 0; x < 64; x++) {
        var bh = Math.round((hist[x] / hmax) * hh);
        var inWin = (x / 64) >= lo && (x / 64) <= hi;
        /* each bar is painted in the colour that value will actually
           receive, so the histogram is a legend for the image */
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
        ctx.fillRect(RX + x * bw, ht + hh - bh, bw - 1, bh);
      }
      /* the window, drawn over the histogram it selects, clamped to its range */
      var wLo = Math.max(0, Math.min(1, lo)), wHi = Math.max(0, Math.min(1, hi));
      ctx.strokeStyle = ANNO; ctx.lineWidth = 1;
      ctx.strokeRect(RX + wLo * RW, ht, Math.max(2, (wHi - wLo) * RW), hh);

      /* the LUT it maps through, and the overlay's own ramp under it */
      var ly = ht + hh + 22;
      ctx.fillStyle = INK;
      ctx.fillText(lut === 'gsdf' ? 'LUT — GSDF GREY · 256' : 'LUT — HEAT · MONOTONE IN L', RX, ly - 6);
      for (x = 0; x < RW; x++) {
        var li = ((x / RW) * 255) | 0;
        ctx.fillStyle = 'rgb(' + table[li * 3] + ',' + table[li * 3 + 1] + ',' + table[li * 3 + 2] + ')';
        ctx.fillRect(RX + x, ly, 1, 14);
      }
      ctx.strokeStyle = RULE; ctx.strokeRect(RX, ly, RW, 14);
      if (fusion) {
        for (x = 0; x < RW; x++) {
          /* the legend rotates with the map; a static swatch beside a
             rotating overlay is a legend that lies */
          var fi2 = ((((x / RW + rampPhase) % 1) * 255) | 0) * 3;
          ctx.fillStyle = 'rgb(' + fTab[fi2] + ',' + fTab[fi2 + 1] + ',' + fTab[fi2 + 2] + ')';
          ctx.fillRect(RX + x, ly + 18, 1, 8);
        }
        ctx.fillStyle = ANNO;
        ctx.textAlign = 'right';
        ctx.fillText('FUSION — ' + fusionRamp.toUpperCase() + (rotate ? ' · ROTATING' : ''), RX + RW, ly - 6);
        ctx.textAlign = 'left';
      }

      /* the slice ladder — where in the stack we are, tinted by what the
         overlay is doing at each slice */
      var sy2 = ly + 44, lx = RX + 52, lw = RW - 52;
      ctx.fillStyle = INK;
      ctx.fillText('STACK', RX, sy2 + 9);
      for (x = 0; x < 48; x++) {
        var at = Math.abs(x / 48 - z) < 0.02;
        var act = fusion ? Math.max(0, Math.sin((x / 48) * TAU * 2 + ft * TAU)) : 0;
        var ai = ((act * 255) | 0) * 3;
        ctx.fillStyle = at ? ANNO
          : (fusion && act > 0.25 ? 'rgb(' + fTab[ai] + ',' + fTab[ai + 1] + ',' + fTab[ai + 2] + ')' : RULE);
        ctx.fillRect(lx + x * (lw / 48), at ? sy2 - 4 : sy2, lw / 48 - 2, at ? 16 : 8);
      }

      /* ── the region, read back and magnified ─────────────────────
         Nearest-neighbour on purpose: a workstation magnifies by showing
         you the pixels. It shows the STUDY, not the fusion, which is a
         display layer that only exists at the viewport's scale. */
      var dy = sy2 + 40;
      var dh = BOTTOM - dy, dw = Math.round(dh * (roi.w / roi.h));
      ctx.fillStyle = INK;
      ctx.fillText('REGION — STUDY ONLY', RX, dy - 6);
      if (roiOn) {
        var rd = regImg.data, ro;
        for (y = 0; y < roi.h; y++) {
          for (x = 0; x < roi.w; x++) {
            v = s[((roi.y + y) * SW + roi.x + x) * 4] / 255;
            n = (v - lo) / (hi - lo);
            n = n < 0 ? 0 : n > 1 ? 1 : n;
            var di = ((n * 255) | 0) * 3;
            ro = (y * roi.w + x) * 4;
            rd[ro] = table[di]; rd[ro + 1] = table[di + 1]; rd[ro + 2] = table[di + 2]; rd[ro + 3] = 255;
          }
        }
        regCtx.putImageData(regImg, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(regCv, RX, dy, dw, dh);
        ctx.imageSmoothingEnabled = true;
        ctx.strokeStyle = ROI; ctx.strokeRect(RX, dy, dw, dh);

        /* the profile through the region's middle row, also from the read */
        var px2 = RX + dw + 20, pw2 = RW - dw - 20, ph2 = dh;
        ctx.fillStyle = INK;
        ctx.fillText('PROFILE — MIDDLE ROW', px2, dy - 6);
        ctx.fillStyle = RULE;
        ctx.fillRect(px2, dy + ph2 - 1, pw2, 1);
        syi = roi.y + (roi.h >> 1);
        for (x = 0; x < pw2; x++) {
          sxi = roi.x + ((x / pw2) * roi.w) | 0;
          v = s[(syi * SW + sxi) * 4] / 255;
          /* painted in the colour the value maps to */
          var pi2 = Math.round(Math.max(0, Math.min(1, (v - lo) / (hi - lo))) * 255) * 3;
          ctx.fillStyle = fusion && v > 0.5
            ? 'rgb(' + fTab[pi2] + ',' + fTab[pi2 + 1] + ',' + fTab[pi2 + 2] + ')'
            : ANNO;
          ctx.fillRect(px2 + x, dy + (ph2 - 3) * (1 - v), 1, 2);
        }
      } else {
        ctx.fillStyle = RULE;
        ctx.fillText('REGION OFF', RX, dy + 14);
      }

      var mean = roiN ? roiSum / roiN : 0;
      var sd = roiN ? Math.sqrt(Math.max(0, roiSq / roiN - mean * mean)) : 0;
      $('r4-slice').textContent = Math.round(z * 48) + ' / 48';
      $('r4-wwwl').textContent = Math.round(ww * 1000) + ' / ' + Math.round(wl * 1000);
      $('r4-roistat').textContent = roiOn ? (mean.toFixed(1) + ' ± ' + sd.toFixed(1)) : 'off';
      $('r4-read').textContent = (SW * SH).toLocaleString();
      $('r4-readcost').innerHTML = ms(median(readCosts)) + ' ms' + atFloor(median(readCosts));
      $('r4-fusion-stat').textContent = fusion
        ? fusionRamp + ' ' + (fCover / (SW * SH) * 100).toFixed(1) + '%'
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
