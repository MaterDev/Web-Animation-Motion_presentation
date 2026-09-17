// @ts-nocheck -- untyped sheet code, extracted from design/techniques/canvas.html §1 (lines 1018–1351)
import { stage } from '../../_kit/stage.js';
import { createWAM } from '../../_kit/wam.js';
import { disposer } from '../../_kit/disposer.js';
import css from './demo.css?raw';
import html from './demo.html?raw';
import { SKIN_RAMP, SKIN_CACHE, SKIN_QUANTISE, SKIN_BEVEL, SKIN_CSS } from './skin.js';
import { TAU, median, atFloor, ms, resolveRGB, createTokens } from './helpers.js';

/* ════════════════════════════════════════════════════════════════════════
   §1 · TRAILS — persistence
   ════════════════════════════════════════════════════════════════════════ */
export function mount(host) {
  'use strict';
  const { root, body, $ } = stage(host, { css, html });
  const WAM = createWAM({ root });
  const dsp = disposer();
  dsp.add(() => WAM.dispose());
  const tokens = createTokens(host, body, 'v1');
  dsp.add(tokens.dispose);
  const token = tokens.token;

  var W = 960, H = 420;
  var cv = $('v1-canvas'), ctx = cv.getContext('2d', { willReadFrequently: true });
  cv.width = W; cv.height = H;

  var PAL_ANCHORS = ['--v1-a0', '--v1-a1', '--v1-a2', '--v1-a3', '--v1-a4'].map(function (n) { return resolveRGB(token(n)); });
  var SCOPE_ANCHORS = [resolveRGB(token('--v1-o0')), resolveRGB(token('--v1-o4'))];
  var VOID = resolveRGB(token('--v1-void'));
  var GRID = resolveRGB(token('--v1-grid'));
  var PEAK = resolveRGB(token('--v1-peak'));

  /* 24 entries: 1 void + 1 grid + 16 analyser steps + 5 oscilloscope + 1 peak.
     Frozen, and the freezing is the subject — a 16-step ramp bands, and a
     dither here would hide the only thing worth looking at. */
  var PALETTE = [VOID, GRID]
    .concat(SKIN_RAMP(PAL_ANCHORS, 16))
    .concat(SKIN_RAMP(SCOPE_ANCHORS, 5))
    .concat([PEAK]);

  var BEVEL = {
    hi: token('--v1-hi'), lt: token('--v1-lt'),
    sh: token('--v1-sh'), dk: token('--v1-dk'), face: token('--v1-face')
  };
  var FRAME = 14, STRIP = 16;                       /* chrome, in backing px */
  var FX = FRAME, FY = FRAME, FW = W - FRAME * 2, FH = H - FRAME * 2 - STRIP - 6;

  var DECAY = { analyser: 0.055, scope: 0.042 };
  var FEEDBACK = 1.006;
  var STEPS = 40;                                   /* reconstruction depth */
  var mode = 'analyser', quantise = true, frames = 0, lastT = -1, qCost = [];
  var QCACHE = SKIN_CACHE();

  $('v1-palette').textContent = PALETTE.length + ' entries';
  $('v1-instr-pal').textContent = PALETTE.length;
  $('v1-steps').textContent = STEPS;
  $('v1-decay').textContent = (DECAY[mode] * 100).toFixed(1) + '%';

  /* The field lives on its own buffer so the chrome is never fed back into
     itself — a bevel that decayed and drifted would be very pretty and would
     stop being chrome. Chrome is painted once, over the field, every frame:
     the sheet's two-canvas rule collapsed into one canvas because there is
     only one surface here and the field has to sit under the frame. */
  var field = document.createElement('canvas');
  field.width = FW; field.height = FH;
  var fx = field.getContext('2d', { willReadFrequently: true });
  var scratch = document.createElement('canvas');
  scratch.width = FW; scratch.height = FH;
  var sx = scratch.getContext('2d');

  /* The field is TRANSPARENT-backed, not filled with the void colour, and
     that is load-bearing rather than tidy. Fading works by removing alpha —
     `destination-out` subtracts, which is the only operation that actually
     erases — and an opaque buffer has no alpha to remove. The void is
     painted underneath at compose time instead. */
  function clearField() { fx.globalCompositeOperation = 'source-over'; fx.clearRect(0, 0, FW, FH); }
  clearField();

  /* ── one step of the world ────────────────────────────────────────────
     Three operations on a surface that keeps what it is given, and not one
     of them has an equivalent outside canvas. */
  function step(t) {
    /* 1 · DECAY AND FEEDBACK, in one pass. The previous frame is taken,
       and the field is REPLACED by a faded copy of it scaled 1.006 about
       the centre — so the trail drifts outward as it dims. The canvas is
       reading its own output, which is the one place on this sheet a
       scaled drawImage is permitted, because here it is content rather
       than chrome.

       `copy` rather than `source-over` is the whole trick. Drawing the
       previous frame back over itself ADDS a second copy, so the field
       gains brightness every frame and saturates to white inside a
       second — which is exactly what the first version of this did, and
       it looked like a bug in the maths rather than in the compositing
       mode. Replacing cannot run away. */
    sx.globalCompositeOperation = 'copy';
    sx.drawImage(field, 0, 0);
    fx.globalCompositeOperation = 'copy';
    fx.globalAlpha = 1 - DECAY[mode];
    fx.drawImage(scratch,
      -(FW * (FEEDBACK - 1)) / 2, -(FH * (FEEDBACK - 1)) / 2,
      FW * FEEDBACK, FH * FEEDBACK);
    fx.globalAlpha = 1;

    /* 2 · THE NEW MARKS. The analyser's bars are solid and replace — a
       bar is an object, and its trail comes from the pass above. The
       scope's line is composited with `lighter` at partial alpha, so
       where the trace crosses its own history the two brighten instead
       of one hiding the other. */
    if (mode === 'analyser') {
      fx.globalCompositeOperation = 'source-over';
      analyser(t);
    } else {
      fx.globalCompositeOperation = 'lighter';
      fx.globalAlpha = 0.55;
      scope(t);
      fx.globalAlpha = 1;
    }
    fx.globalCompositeOperation = 'source-over';
  }

  /* Programme material is a STATED MATHEMATICAL CONSTRUCTION, not a
     recording: three detuned partials under a slow envelope, plus a
     deterministic per-band offset. Nothing here decodes or plays audio. */
  function band(i, n, t) {
    var u = i / n;
    var v = 0.46
      + 0.30 * Math.sin(t * TAU * 2 + u * 9.1)
      + 0.17 * Math.sin(t * TAU * 7 + u * 23.7)
      + 0.11 * Math.sin(t * TAU * 13 + u * 4.3);
    v *= Math.pow(1 - u, 0.7) * (0.55 + 0.45 * Math.sin(t * TAU + 0.9));
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }

  function analyser(t) {
    var N = 48, gap = 2, bw = Math.max(1, Math.floor((FW - gap * (N - 1)) / N));
    var i, v, h, x, y, idx;
    for (i = 0; i < N; i++) {
      v = band(i, N, t);
      h = Math.round(v * (FH - 8));
      x = i * (bw + gap);
      y = FH - h;
      /* the colour comes from the bar's own height, which is how every
         analyser of the era coloured itself: the ramp IS the scale */
      idx = Math.min(15, Math.floor(v * 16));
      fx.fillStyle = SKIN_CSS(PALETTE[2 + idx]);
      fx.fillRect(x, y, bw, h);
      /* peak cap, grey, as it was */
      fx.fillStyle = SKIN_CSS(PEAK);
      fx.fillRect(x, Math.max(0, y - 3), bw, 2);
    }
  }

  function scope(t) {
    var i, N = FW, x, y, v;
    fx.strokeStyle = SKIN_CSS(PALETTE[18]);
    fx.lineWidth = 2;
    fx.beginPath();
    for (i = 0; i <= N; i += 2) {
      x = i;
      v = Math.sin(i * 0.021 + t * TAU * 2) * 0.5
        + Math.sin(i * 0.0072 + t * TAU * 3) * 0.32
        + Math.sin(i * 0.041 + t * TAU) * 0.18;
      y = FH / 2 + v * (FH * 0.36) * (0.45 + 0.55 * Math.sin(t * TAU + 0.9));
      if (i === 0) fx.moveTo(x, y); else fx.lineTo(x, y);
    }
    fx.stroke();
  }

  /* ── chrome ───────────────────────────────────────────────────────────
     A frame, a sunken bevel, and the palette the field was frozen to. Each
     world shows the sheet it was cut from: the construction is furniture,
     which is the sheet's "measured, not claimed" discipline applied to its
     own making rather than only to its numbers. */
  /* Chrome is painted in TWO passes, under and over the field, and the
     first version was one pass after it — which filled the whole canvas
     with the frame's face colour and painted the field out entirely on
     every frame. The world rendered a perfect black rectangle and its own
     frame counter went on climbing beside it, which is the failure mode
     this sheet exists to warn about: an instrument reporting that it is
     working while showing nothing. */
  function chromeUnder() {
    ctx.fillStyle = BEVEL.face;
    ctx.fillRect(0, 0, W, H);
  }
  function chromeOver() {
    var EDGE = { hi: BEVEL.hi, lt: BEVEL.lt, sh: BEVEL.sh, dk: BEVEL.dk };
    SKIN_BEVEL(ctx, 0, 0, W, H, false, EDGE);
    SKIN_BEVEL(ctx, FX - 2, FY - 2, FW + 4, FH + 4, true, EDGE);
    var i, cw = Math.floor((FW - 2) / PALETTE.length);
    for (i = 0; i < PALETTE.length; i++) {
      ctx.fillStyle = SKIN_CSS(PALETTE[i]);
      ctx.fillRect(FX + i * cw, FY + FH + 6, cw - 1, STRIP);
    }
    SKIN_BEVEL(ctx, FX - 1, FY + FH + 5, cw * PALETTE.length + 1, STRIP + 2, true, EDGE);
  }

  function compose() {
    var px, t0;
    chromeUnder();
    ctx.fillStyle = SKIN_CSS(VOID);
    ctx.fillRect(FX, FY, FW, FH);
    ctx.drawImage(field, FX, FY);
    if (quantise) {
      t0 = performance.now();
      px = ctx.getImageData(FX, FY, FW, FH);
      SKIN_QUANTISE(px.data, FW, FH, PALETTE, 0, QCACHE);
      ctx.putImageData(px, FX, FY);
      qCost.push(performance.now() - t0);
      if (qCost.length > 20) qCost.shift();
      $('v1-qcost').innerHTML = ms(median(qCost)) + ' ms' + atFloor(median(qCost));
    } else {
      $('v1-qcost').textContent = 'off';
    }
    chromeOver();
  }

  /* ── render(t) ────────────────────────────────────────────────────────
     This is the one demo on the sheet that is path-dependent by
     construction, and the sheet has to answer that rather than hide it.
     render(t) is supposed to give the same picture at the same t from any
     prior frame; a framebuffer that accumulates cannot.

     So it does both, and which one runs is decided by the size of the jump.
     A small step forward accumulates — that is the real thing, and it is
     what you watch. A jump (a scrub, the poster frame, the QC pass that
     calls t=0.42 from t=0.1 and from t=0.9) rebuilds the field from empty by
     running a fixed number of steps up to t. Reconstruction is
     deterministic, so idempotency holds exactly where it is checked, and
     the accumulation stays honest exactly where it is watched. */
  var demo = WAM.clock('v1-stage', {
    el: $('v1-world'), dur: 11000, poster: 0.62,
    render: function (t) {
      /* The wrap is not a jump. t going from 0.998 to 0.002 is two
         thousandths of a cycle forward, not 0.996 backward — and reading it
         as a jump made the field reconstruct from empty at the seam, which
         is the flash that made the loop visibly restart. */
      var dt = Math.abs(t - lastT);
      if (dt > 0.5) dt = 1 - dt;
      var jump = lastT < 0 || dt > 0.02;
      if (jump) {
        clearField();
        for (var i = 1; i <= STEPS; i++) step(t * (i / STEPS));
      } else {
        step(t);
      }
      lastT = t;
      frames++;
      $('v1-frame').textContent = frames.toLocaleString();
      compose();
    }
  });

  /* ── the explanatory graphic, in this world's own language ──────────
     Not a pane in the deck's harness beside the world — that is what made
     every section open in presentation chrome. It is drawn on the same
     palette, with the same bevel, inside the same frame, because an
     explanation of a world belongs to it. */
  (function () {
    var EW = 960, EH = 172;
    var ec = $('v1-explain'), ex = ec.getContext('2d');
    ec.width = EW; ec.height = EH;
    var GENS = 9;

    WAM.clock('v1-explain-stage', {
      el: $('v1-explain-stage'), dur: 11000, poster: 0.5,
      render: function (t) {
        ex.fillStyle = BEVEL.face; ex.fillRect(0, 0, EW, EH);
        var EDGE = { hi: BEVEL.hi, lt: BEVEL.lt, sh: BEVEL.sh, dk: BEVEL.dk };
        SKIN_BEVEL(ex, 0, 0, EW, EH, false, EDGE);

        var padX = 16, padY = 16, innerW = EW - padX * 2, innerH = EH - padY * 2;
        ex.fillStyle = SKIN_CSS(VOID);
        ex.fillRect(padX, padY, innerW, innerH);
        SKIN_BEVEL(ex, padX - 2, padY - 2, innerW + 4, innerH + 4, true, EDGE);

        var mono = '10px ' + (token('--mono') || 'monospace');
        ex.font = mono;

        /* left: one mark, nine generations, six frames apart. The radius is
           the TRUE feedback scale — 1.006 per frame, so 1.33x over 48 — and
           not an exaggeration of it. The first version compounded 46 frames
           per step instead of 6 and drew a final disc nine times the size,
           which looked more like the idea and was a picture of a number
           nobody measured. */
        var i, cy = padY + innerH * 0.44, r, lvl, idx;
        var GEN_STEP = 6;
        var pitch = (innerW * 0.60) / GENS;
        for (i = 0; i < GENS; i++) {
          lvl = Math.pow(1 - DECAY[mode], i * GEN_STEP);
          r = 13 * Math.pow(FEEDBACK, i * GEN_STEP);
          idx = Math.max(0, Math.min(15, Math.round(lvl * 15)));
          var cx = padX + 34 + i * pitch;
          ex.fillStyle = SKIN_CSS(PALETTE[2 + idx]);
          ex.beginPath(); ex.arc(cx, cy, r, 0, TAU); ex.fill();
          ex.fillStyle = SKIN_CSS(PALETTE[1]);
          ex.fillText(i === 0 ? 'NOW' : '\u2212' + (i * GEN_STEP), cx - 9, padY + innerH - 12);
        }
        ex.fillStyle = SKIN_CSS(PALETTE[23]);
        ex.fillText('ONE MARK, EVERY SIXTH FRAME \u2014 DIMMED BY DECAY, GROWN BY FEEDBACK', padX + 14, padY + 18);
        ex.fillStyle = SKIN_CSS(PALETTE[1]);
        ex.fillText('\u00d7' + Math.pow(FEEDBACK, 48).toFixed(2) + ' OVER 48 FRAMES', padX + 14, padY + 34);

        /* right: the same fade twice. Smooth on top, and quantised to the
           palette's sixteen steps below it — so the banding is not asserted,
           it is the visible difference between two strips. */
        var gx0 = padX + innerW * 0.66, gw = innerW * 0.30, bh = 22, n = 46, j, u, v2;
        ex.fillStyle = SKIN_CSS(PALETTE[23]);
        ex.fillText('SMOOTH', gx0, padY + 18);
        for (j = 0; j < n; j++) {
          u = j / (n - 1);
          v2 = Math.pow(1 - DECAY[mode], u * 54);
          ex.fillStyle = 'rgb(' + Math.round(PALETTE[17][0] * v2 + PALETTE[0][0] * (1 - v2)) + ',' +
                                  Math.round(PALETTE[17][1] * v2 + PALETTE[0][1] * (1 - v2)) + ',' +
                                  Math.round(PALETTE[17][2] * v2 + PALETTE[0][2] * (1 - v2)) + ')';
          ex.fillRect(gx0 + u * (gw - gw / n), padY + 26, gw / n + 1, bh);
        }
        ex.fillStyle = SKIN_CSS(PALETTE[23]);
        ex.fillText('QUANTISED \u2014 16 STEPS, NO DITHER', gx0, padY + 26 + bh + 18);
        for (j = 0; j < n; j++) {
          u = j / (n - 1);
          v2 = Math.pow(1 - DECAY[mode], u * 54);
          idx = Math.max(0, Math.min(15, Math.round(v2 * 15)));
          ex.fillStyle = SKIN_CSS(PALETTE[2 + idx]);
          ex.fillRect(gx0 + u * (gw - gw / n), padY + 26 + bh + 24, gw / n + 1, bh);
        }
        ex.fillStyle = SKIN_CSS(PALETTE[1]);
        ex.fillText('0', gx0, padY + 26 + bh * 2 + 60);
        ex.fillText('54 FRAMES', gx0 + gw - 56, padY + 26 + bh * 2 + 60);
      }
    });
  })();

  dsp.on($('v1-bar'), 'click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.mode) {
      mode = b.dataset.mode;
      [].forEach.call(this.querySelectorAll('[data-mode]'), function (x) { x.classList.toggle('v1-on', x === b); });
      $('v1-decay').textContent = (DECAY[mode] * 100).toFixed(1) + '%';
      lastT = -1;
      demo.render(demo.t);
    } else if (b === $('v1-clear')) {
      /* Clearing is a decision. Making it a button is the section's whole
         argument put under the reader's finger — and the field comes back,
         because nothing here was ever stored. */
      clearField();
      compose();
    } else if (b === $('v1-quantise')) {
      quantise = !quantise;
      b.textContent = 'quantise: ' + (quantise ? 'on' : 'off');
      b.classList.toggle('v1-on', !quantise);
      demo.render(demo.t);
    }
  });

  tokens.reportTokenMisses();
  return function dispose() { dsp.run(); };
}
