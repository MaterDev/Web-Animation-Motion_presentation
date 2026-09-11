/* ── §5 · PANEL — industrial machine HMI ────────────────────────────────
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

   WHY THE FURNITURE IS DRAWN AND NOT STYLED. §5's claim is that a canvas can
   leave the main thread. If the panel were CSS, blocking the main thread
   would stall a graph inside a chassis that kept looking alive, because the
   chassis would be the compositor's problem and not the thread's. Drawn, the
   left unit's lamps stop blinking and its trace stops moving together — the
   whole instrument stalls, which is the true picture. That is not decoration
   applied to the demo; it is the difference between showing the claim and
   illustrating it.

   THE SHEET'S TWO-CANVAS RULE, AND §5'S EXEMPTION FROM IT. Everywhere else
   on this sheet chrome is a second canvas painted on resize only, so its
   per-frame cost is zero. §5 cannot do that: the worker owns exactly one
   transferred canvas and can never be handed a second. So both units here
   paint their chrome ONCE into an offscreen buffer and composite it with a
   single drawImage per frame. One drawImage, not zero — and the same shape
   on both threads, because the two units have to be visually identical for
   the comparison to mean anything.

   NO TEXT IS DRAWN BY ANY FUNCTION IN THIS FILE. Every legend on §5 is DOM
   positioned over the canvas. Drawing MAIN and WORKER into the raster would
   be easier and it would put the only copy of that information somewhere a
   screen reader cannot go. The silkscreen treatment below is applied to
   non-text marks only — window surrounds, tick rules, the E-stop ring.
   ─────────────────────────────────────────────────────────────────────── */

/* Deterministic hash → [0,1). No Math.random anywhere in this file: the boot
   parity check compares a byte-exact hash of the same render on two threads,
   and one unseeded value would make that check meaningless. */
self.PANEL_HASH2 = function (x, y, seed) {
  var h = (x * 374761393 + y * 668265263 + seed * 2246822519) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = (h * 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/* Value noise, bilinear, smoothstep-interpolated. Two octaves of this is the
   orange peel in the enamel. */
self.PANEL_NOISE = function (x, y, freq, seed) {
  var fx = x * freq, fy = y * freq;
  var ix = Math.floor(fx), iy = Math.floor(fy);
  var tx = fx - ix, ty = fy - iy;
  var sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  var h = self.PANEL_HASH2;
  var a = h(ix, iy, seed), b = h(ix + 1, iy, seed);
  var c = h(ix, iy + 1, seed), d = h(ix + 1, iy + 1, seed);
  return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
};

/* ── the static panel ───────────────────────────────────────────────────
   Pure function of size and ink. Painted once per unit, into a buffer.
   `ink` is an object of [r,g,b] arrays resolved from the --p5-* tokens on
   the main thread and shipped to the worker in init, so neither side
   hardcodes a colour and the token stays the single source. */
self.PANEL_CHROME = function (ctx, W, H, ink) {
  var img = ctx.createImageData(W, H), d = img.data;
  var NOISE = self.PANEL_NOISE;
  var x, y, o, n1, n2, hgt, hx, hy, lam, l, base, col, i;

  /* Geometry, in backing-store pixels. Integer-aligned throughout: the two
     threads do not share a rasteriser, and a fractional edge resolves
     differently on each — measured, ±1 per channel on every blended edge,
     which is enough to fail a byte-exact parity check on a healthy worker. */
  var pad = Math.round(W * 0.055);
  var winX = pad, winY = Math.round(H * 0.20);
  var winW = W - pad * 2, winH = Math.round(H * 0.50);
  var subY = winY + winH + Math.round(H * 0.06);

  /* LIGHT. One vector for the whole panel — the enamel, the screws and the
     E-stop are lit by the same lamp, which is most of why they read as one
     moulded object rather than three sprites. */
  var LX = -0.5, LY = -0.8, LZ = 0.33;
  var LL = Math.sqrt(LX * LX + LY * LY + LZ * LZ);
  LX /= LL; LY /= LL; LZ /= LL;

  function shade(r, g, b, k) {
    return [Math.max(0, Math.min(255, r * k)),
            Math.max(0, Math.min(255, g * k)),
            Math.max(0, Math.min(255, b * k))];
  }

  /* 1 · ENAMEL, LIT. Two octaves of value noise become a height field; the
     surface normal is perturbed by its gradient and Lambert-shaded. A noise
     overlay WITHOUT the lighting term reads as dirt — orange peel is a lit
     texture, and that is exactly why it cannot be a CSS gradient.

     The height field is built ONCE into a Float32Array at half resolution
     and then sampled, rather than calling the noise function six times per
     pixel — twice for the height and four more for the two gradient
     neighbours. The first version did exactly that and cost 56 ms on the
     main thread and 201 ms in the worker, against a 25 ms budget this
     sheet prints on itself. Half resolution rather than fewer octaves,
     because the second octave is what makes the surface read as paint and
     its period is still four samples wide here; dropping it would have
     bought the same time and cost the material. */
  var hw = (W >> 1) + 2, hh = (H >> 1) + 2;
  var field = new Float32Array(hw * hh);
  for (y = 0; y < hh; y++) {
    for (x = 0; x < hw; x++) {
      field[y * hw + x] = NOISE(x * 2, y * 2, 0.045, 11) * 0.68
                        + NOISE(x * 2, y * 2, 0.110, 29) * 0.32;
    }
  }
  for (y = 0; y < H; y++) {
    var fy = y * 0.5, iy2 = fy | 0, ty2 = fy - iy2, row = iy2 * hw;
    var inWinRow = y >= winY && y < winY + winH;
    for (x = 0; x < W; x++) {
      o = (y * W + x) * 4;

      /* Every pixel inside the window is painted over by the recess a few
         lines down, so shading the enamel under it is 44% of this loop
         spent on pixels nobody sees. Skipping it is the single largest
         saving in the panel and it changes no output byte. */
      if (inWinRow && x >= winX && x < winX + winW) {
        d[o] = ink.win[0]; d[o + 1] = ink.win[1]; d[o + 2] = ink.win[2]; d[o + 3] = 255;
        continue;
      }
      base = (y > subY) ? ink.panelLo : ink.panel;

      var fx = x * 0.5, ix2 = fx | 0, tx2 = fx - ix2;
      var a0 = field[row + ix2], b0 = field[row + ix2 + 1];
      var c0 = field[row + hw + ix2], d0 = field[row + hw + ix2 + 1];
      hgt = (a0 + (b0 - a0) * tx2) + ((c0 + (d0 - c0) * tx2) - (a0 + (b0 - a0) * tx2)) * ty2;

      /* gradient straight off the field, in field units — half the spatial
         step, so the amplitude term below is halved to match */
      hx = (b0 - a0);
      hy = (c0 - a0);

      /* normal = normalize(-dh/dx, -dh/dy, 1), amplitude tuned so the peel
         is felt at arm's length and invisible at projection distance */
      var nx = -hx * 13, ny = -hy * 13, nz = 1;
      var nl = Math.sqrt(nx * nx + ny * ny + 1);
      lam = (nx * LX + ny * LY + nz * LZ) / nl;
      l = 0.86 + lam * 0.30 + (hgt - 0.5) * 0.03;

      /* inlined rather than calling shade(): that helper allocates a
         three-element array, and at 447 200 pixels the allocation was a
         measurable slice of the paint budget this sheet prints on itself */
      var r0 = base[0] * l, g0 = base[1] * l, b0 = base[2] * l;
      d[o] = r0 > 255 ? 255 : r0;
      d[o + 1] = g0 > 255 ? 255 : g0;
      d[o + 2] = b0 > 255 ? 255 : b0;
      d[o + 3] = 255;
    }
  }

  /* 2 · THE FOLDED EDGE. A steel panel is bent, not cut: one bright line
     where the fold catches the lamp, one dark line in its shadow. */
  for (x = 0; x < W; x++) {
    for (i = 0; i < 3; i++) {
      o = (i * W + x) * 4;
      col = shade(ink.panel[0], ink.panel[1], ink.panel[2], i === 0 ? 1.24 : 1.10 - i * 0.06);
      d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2];
      o = ((H - 1 - i) * W + x) * 4;
      col = shade(ink.edge[0], ink.edge[1], ink.edge[2], 1 - i * 0.12);
      d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2];
    }
  }
  for (y = 0; y < H; y++) {
    for (i = 0; i < 2; i++) {
      o = (y * W + i) * 4;
      col = shade(ink.panel[0], ink.panel[1], ink.panel[2], 1.14);
      d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2];
      o = (y * W + (W - 1 - i)) * 4;
      col = shade(ink.edge[0], ink.edge[1], ink.edge[2], 1.05);
      d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2];
    }
  }

  /* 3 · THE DISPLAY WINDOW, recessed. The bezel is shaded from the same
     light vector, so the top and left inner faces are in shadow and the
     bottom and right catch the lamp — which is what a routed recess does
     and what a symmetric box-shadow cannot express. */
  var BEV = 4;
  for (y = winY - BEV; y < winY + winH + BEV; y++) {
    if (y < 0 || y >= H) continue;
    for (x = winX - BEV; x < winX + winW + BEV; x++) {
      if (x < 0 || x >= W) continue;
      o = (y * W + x) * 4;
      var inX = x >= winX && x < winX + winW, inY = y >= winY && y < winY + winH;
      if (inX && inY) {
        d[o] = ink.win[0]; d[o + 1] = ink.win[1]; d[o + 2] = ink.win[2];
      } else {
        /* which face of the bevel is this pixel on */
        var dxl = winX - x, dxr = x - (winX + winW - 1);
        var dyt = winY - y, dyb = y - (winY + winH - 1);
        var face = Math.max(dxl, dxr, dyt, dyb);
        var k = (dyt === face || dxl === face) ? 0.74 : 1.22;
        var t2 = 1 - face / BEV;
        col = shade(ink.edge[0], ink.edge[1], ink.edge[2], k * (0.7 + 0.5 * t2));
        d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2];
      }
    }
  }

  ctx.putImageData(img, 0, 0);

  /* 4 · SILKSCREEN — non-text marks only. Screen-printed ink has a soft
     edge because it bleeds into the substrate: the mark is drawn into a
     scratch buffer, eroded by a pixel, and laid back at 0.35 alpha with the
     hard core on top. Morphological erosion over a pixel buffer is a
     canvas-only move; there is no CSS that does it. */
  var sil = ctx.createImageData(W, H), s = sil.data;
  function silRect(rx, ry, rw, rh, th) {
    var px, py;
    for (py = ry; py < ry + rh; py++) {
      for (px = rx; px < rx + rw; px++) {
        if (px < 0 || py < 0 || px >= W || py >= H) continue;
        if (px >= rx + th && px < rx + rw - th && py >= ry + th && py < ry + rh - th) continue;
        o = (py * W + px) * 4;
        s[o] = ink.ink[0]; s[o + 1] = ink.ink[1]; s[o + 2] = ink.ink[2]; s[o + 3] = 255;
      }
    }
  }
  silRect(winX - BEV - 4, winY - BEV - 4, winW + BEV * 2 + 8, winH + BEV * 2 + 8, 1);
  /* tick rule under the window — a scale, not a label */
  for (i = 0; i <= 10; i++) {
    silRect(winX + Math.round((i / 10) * (winW - 2)), winY + winH + BEV + 4, 2, i % 5 === 0 ? 7 : 4, 2);
  }

  /* spread pass: anything adjacent to ink gets 0.35 alpha of it */
  var spread = ctx.createImageData(W, H), sp = spread.data;
  for (y = 1; y < H - 1; y++) {
    for (x = 1; x < W - 1; x++) {
      o = (y * W + x) * 4;
      if (s[o + 3]) { sp[o] = s[o]; sp[o + 1] = s[o + 1]; sp[o + 2] = s[o + 2]; sp[o + 3] = 255; continue; }
      if (s[o - 4 + 3] || s[o + 4 + 3] || s[o - W * 4 + 3] || s[o + W * 4 + 3]) {
        sp[o] = ink.ink[0]; sp[o + 1] = ink.ink[1]; sp[o + 2] = ink.ink[2]; sp[o + 3] = 89;
      }
    }
  }
  self.PANEL_COMPOSITE(d, sp, W, H);

  /* 5 · FASTENERS. Four M4 pan heads, per-pixel shaded from the same light
     vector, each slot at a DIFFERENT angle — a real panel's screws are not
     aligned, and aligning them is the single clearest tell that a surface
     was styled rather than built. */
  var R = Math.max(5, Math.round(W * 0.016));
  var SCREWS = [
    [pad - Math.round(W * 0.022), Math.round(H * 0.085), 0.62],
    [W - pad + Math.round(W * 0.022), Math.round(H * 0.085), 2.31],
    [pad - Math.round(W * 0.022), H - Math.round(H * 0.085), 1.44],
    [W - pad + Math.round(W * 0.022), H - Math.round(H * 0.085), 0.18]
  ];
  var hd = d;
  for (i = 0; i < SCREWS.length; i++) {
    var cx = SCREWS[i][0], cy = SCREWS[i][1], ang = SCREWS[i][2];
    var ca = Math.cos(ang), sa = Math.sin(ang);
    for (y = cy - R - 2; y <= cy + R + 2; y++) {
      if (y < 0 || y >= H) continue;
      for (x = cx - R - 2; x <= cx + R + 2; x++) {
        if (x < 0 || x >= W) continue;
        var dx = x - cx, dy = y - cy, dist = Math.sqrt(dx * dx + dy * dy);
        o = (y * W + x) * 4;
        if (dist > R + 1.6) continue;
        if (dist > R) {                      /* the seat shadow */
          col = shade(hd[o], hd[o + 1], hd[o + 2], 0.72);
          hd[o] = col[0]; hd[o + 1] = col[1]; hd[o + 2] = col[2];
          continue;
        }
        /* pan head: a shallow spherical cap, Lambert + a tight specular */
        var zz = Math.sqrt(Math.max(0, R * R - dist * dist)) / R * 0.55;
        var nnl = Math.sqrt(dx * dx + dy * dy + (zz * R) * (zz * R)) || 1;
        var snx = dx / nnl, sny = dy / nnl, snz = (zz * R) / nnl;
        lam = snx * LX + sny * LY + snz * LZ;
        var spec = Math.pow(Math.max(0, lam), 22);
        /* the slot, rotated per screw */
        var u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
        var inSlot = Math.abs(v) < R * 0.16 && Math.abs(u) < R * 0.78;
        var bright = inSlot ? 0.44 : (0.72 + Math.max(0, lam) * 0.62 + spec * 0.9);
        col = shade(ink.edge[0] * 1.7, ink.edge[1] * 1.7, ink.edge[2] * 1.7, bright);
        hd[o] = col[0]; hd[o + 1] = col[1]; hd[o + 2] = col[2]; hd[o + 3] = 255;
      }
    }
  }
  var geom = {
    winX: winX, winY: winY, winW: winW, winH: winH, subY: subY, pad: pad, R: R,
    /* lamp housings and the E-stop live on the sub-panel, below the window */
    lamps: [
      { x: pad + Math.round(W * 0.06), y: subY + Math.round(H * 0.10), r: Math.max(6, Math.round(W * 0.022)), key: 'run' },
      { x: pad + Math.round(W * 0.17), y: subY + Math.round(H * 0.10), r: Math.max(6, Math.round(W * 0.022)), key: 'warn' }
    ],
    stop: { x: W - pad - Math.round(W * 0.085), y: subY + Math.round(H * 0.10), r: Math.max(13, Math.round(W * 0.052)) }
  };
  self.PANEL_FIXTURES(d, W, H, ink, geom, LX, LY, LZ);
  self.PANEL_LAMPS(d, W, H, ink, geom);
  ctx.putImageData(img, 0, 0);
  return geom;
};

/* ── the lamp sprites ───────────────────────────────────────────────────
   A lit lamp has to tint the textured paint AROUND it — that is what light
   does to a material, and it is exactly what a box-shadow cannot express,
   because the shadow of a box is not light falling on a surface. So the
   bloom is computed PER PIXEL over the enamel that is actually underneath
   it, in both states, once, at chrome time; the live layer blits the state
   it wants. putImageData replaces rather than blends, so there is nothing
   left for two rasterisers to disagree about — and it is also the fastest
   way to put pixels on a canvas, which §2's own table says on this sheet. */
self.PANEL_LAMPS = function (d, W, H, ink, geom) {
  var i, s, x, y, o, dx, dy, dist, k, c, sprite, data, sx, sy, sw, sh, bo;
  geom.sprites = [];
  for (i = 0; i < geom.lamps.length; i++) {
    var L = geom.lamps[i];
    var reach = Math.round(L.r * 3.4);
    sx = Math.max(0, L.x - reach); sy = Math.max(0, L.y - reach);
    sw = Math.min(W, L.x + reach) - sx; sh = Math.min(H, L.y + reach) - sy;
    c = L.key === 'run' ? ink.run : ink.warn;
    var pair = { x: sx, y: sy, on: null, off: null };
    for (s = 0; s < 2; s++) {
      sprite = new ImageData(sw, sh);
      data = sprite.data;
      for (y = 0; y < sh; y++) {
        for (x = 0; x < sw; x++) {
          o = (y * sw + x) * 4;
          dx = (sx + x) - L.x; dy = (sy + y) - L.y;
          dist = Math.sqrt(dx * dx + dy * dy);
          data[o + 3] = 255;
          if (dist <= L.r) {
            var u = dist / L.r;
            if (s) {
              /* lit: a hot core falling off to the rim of the lens */
              var hot = Math.max(0, 1 - u / 0.35), dim = 1 - u * 0.58;
              data[o] = (c[0] + (255 - c[0]) * hot) * dim;
              data[o + 1] = (c[1] + (255 - c[1]) * hot) * dim;
              data[o + 2] = (c[2] + (255 - c[2]) * hot) * dim;
            } else {
              /* dark: the lens colour is still there, unlit */
              var dk = 0.30 - u * 0.14;
              data[o] = c[0] * dk; data[o + 1] = c[1] * dk; data[o + 2] = c[2] * dk;
            }
          } else {
            bo = ((sy + y) * W + (sx + x)) * 4;
            var b0 = d[bo], b1 = d[bo + 1], b2 = d[bo + 2];
            if (s && dist < reach) {
              k = 1 - (dist - L.r) / (reach - L.r);
              k = k * k * 0.42;
              b0 += c[0] * k; b1 += c[1] * k; b2 += c[2] * k;
            }
            data[o] = b0 > 255 ? 255 : b0;
            data[o + 1] = b1 > 255 ? 255 : b1;
            data[o + 2] = b2 > 255 ? 255 : b2;
          }
        }
      }
      if (s) pair.on = sprite; else pair.off = sprite;
    }
    geom.sprites.push(pair);
  }
};

/* ── the fixtures that do not change: lamp housings and the E-stop ──────
   Drawn into the static buffer because they are objects, not state. Only
   the lamp LENS and its bloom are live — see PANEL_LIVE. */
self.PANEL_FIXTURES = function (d, W, H, ink, geom, LX, LY, LZ) {
  var i, x, y, o, dx, dy, dist, col, lam, nl, nx, ny, nz;

  function put(o2, r, g, b) {
    d[o2] = Math.max(0, Math.min(255, r));
    d[o2 + 1] = Math.max(0, Math.min(255, g));
    d[o2 + 2] = Math.max(0, Math.min(255, b));
    d[o2 + 3] = 255;
  }

  /* lamp bezels — a chromed ring seated in the enamel */
  for (i = 0; i < geom.lamps.length; i++) {
    var L = geom.lamps[i], ro = L.r + 4;
    for (y = L.y - ro - 2; y <= L.y + ro + 2; y++) {
      if (y < 0 || y >= H) continue;
      for (x = L.x - ro - 2; x <= L.x + ro + 2; x++) {
        if (x < 0 || x >= W) continue;
        dx = x - L.x; dy = y - L.y; dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > ro + 1.5 || dist < L.r) continue;
        o = (y * W + x) * 4;
        nl = dist || 1; nx = dx / nl; ny = dy / nl; nz = 0.55;
        lam = (nx * LX + ny * LY + nz * LZ) / Math.sqrt(nx * nx + ny * ny + nz * nz);
        var k = 0.78 + Math.max(0, lam) * 0.75;
        put(o, ink.edge[0] * 1.8 * k, ink.edge[1] * 1.8 * k, ink.edge[2] * 1.8 * k);
      }
    }
  }

  /* THE E-STOP. A red mushroom on a yellow backing plate. Per-pixel
     spherical cap — z = sqrt(r² − d²) — Lambert plus Phong at 18. Every
     part of its form comes out of that equation; there is no gradient stack
     that produces a correct highlight on a dome lit off-axis. */
  var S = geom.stop, plate = S.r + 9;
  for (y = S.y - plate - 2; y <= S.y + plate + 2; y++) {
    if (y < 0 || y >= H) continue;
    for (x = S.x - plate - 2; x <= S.x + plate + 2; x++) {
      if (x < 0 || x >= W) continue;
      dx = x - S.x; dy = y - S.y; dist = Math.sqrt(dx * dx + dy * dy);
      o = (y * W + x) * 4;
      if (dist > plate + 1.4) continue;
      if (dist > S.r) {                                 /* backing plate */
        var t3 = 1 - (dist - S.r) / (plate - S.r);
        put(o, ink.warn[0] * (0.72 + t3 * 0.30), ink.warn[1] * (0.72 + t3 * 0.30), ink.warn[2] * (0.72 + t3 * 0.30));
        continue;
      }
      var zz = Math.sqrt(Math.max(0, S.r * S.r - dist * dist));
      nl = Math.sqrt(dx * dx + dy * dy + zz * zz) || 1;
      nx = dx / nl; ny = dy / nl; nz = zz / nl;
      lam = Math.max(0, nx * LX + ny * LY + nz * LZ);
      /* Phong: reflect the light about the normal, dot with the eye (0,0,1) */
      var rz = 2 * (nx * LX + ny * LY + nz * LZ) * nz - LZ;
      var spec = Math.pow(Math.max(0, rz), 18);
      var kk = 0.42 + lam * 0.72;
      put(o, ink.stop[0] * kk + 255 * spec * 0.85,
             ink.stop[1] * kk + 255 * spec * 0.85,
             ink.stop[2] * kk + 255 * spec * 0.85);
    }
  }
};

/* ── the live layer ─────────────────────────────────────────────────────
   Everything that carries state, and nothing that does not. The lamps are
   in here rather than in the chrome for one reason and it is the whole
   demonstration: a lamp that blinks is furniture that MOVES, so when the
   main thread stalls the left unit stops being an instrument rather than
   merely stopping its graph. */
self.PANEL_LIVE = function (ctx, W, H, ink, geom) {
  return function live(t, blinkOn, warnOn) {
    var i, x, y, v, bw, bh, gap = 2, BARS = 18;
    var wx = geom.winX, wy = geom.winY, ww = geom.winW, wh = geom.winH;

    /* the window is repainted, not the panel */
    ctx.fillStyle = 'rgb(' + ink.win[0] + ',' + ink.win[1] + ',' + ink.win[2] + ')';
    ctx.fillRect(wx, wy, ww, wh);

    /* graticule: integer rules, so both rasterisers agree exactly */
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    for (i = 1; i < 6; i++) ctx.fillRect(wx, wy + Math.round((i / 6) * wh), ww, 1);

    bw = Math.max(1, Math.floor((ww - gap * (BARS - 1)) / BARS));
    for (i = 0; i < BARS; i++) {
      /* A STATED MATHEMATICAL CONSTRUCTION, not a recording: three detuned
         partials under a slow envelope. Deterministic in t, so the poster
         frame, the scrub, the QC pass and the worker all agree. */
      v = 0.5
        + 0.34 * Math.sin(t * 6.2831853 * 2 + i * 0.47)
        + 0.18 * Math.sin(t * 6.2831853 * 7 + i * 1.13)
        + 0.11 * Math.sin(t * 6.2831853 * 13 + i * 0.27);
      v = v * (0.55 + 0.45 * Math.sin(t * 6.2831853 * 1.5 + 0.9 + i * 0.05));
      if (v < 0.03) v = 0.03;
      if (v > 1) v = 1;
      bh = Math.round(v * (wh - 6));
      x = wx + i * (bw + gap);
      y = wy + wh - bh;
      ctx.fillStyle = v > 0.9
        ? 'rgb(' + ink.stop[0] + ',' + ink.stop[1] + ',' + ink.stop[2] + ')'
        : 'rgb(' + ink.trace[0] + ',' + ink.trace[1] + ',' + ink.trace[2] + ')';
      ctx.fillRect(x, y, bw, bh);
    }
    /* cursor */
    ctx.fillStyle = 'rgb(' + ink.warn[0] + ',' + ink.warn[1] + ',' + ink.warn[2] + ')';
    ctx.fillRect(wx + Math.round(t * (ww - 2)), wy, 2, wh);

    /* LAMPS — a blitted, pre-lit sprite. See PANEL_LAMPS for why this is
       putImageData and not a radial gradient with a `lighter` bloom: the
       gradient version cost §5 its central guarantee. Gradients and
       additive compositing are rasterised differently by an accelerated
       context and a willReadFrequently one, and the boot parity check
       found 1 284 differing pixels — every one of them inside the two
       lamps — on a worker that was perfectly healthy. PANEL_CHROME, which
       writes every pixel itself, differed on 0 of 447 200 in the same run.
       The light is no less real for having been computed at chrome time;
       the enamel it falls on does not change. */
    for (i = 0; i < geom.lamps.length; i++) {
      var L = geom.lamps[i];
      /* RUN blinks off t — it says "this thread is serving frames", which
         is exactly what stops being true when the thread is blocked.
         WARN is lit while free-run is engaged. */
      var on = L.key === 'run' ? blinkOn : !!warnOn;
      var sp = geom.sprites[i];
      ctx.putImageData(on ? sp.on : sp.off, sp.x, sp.y);
    }
  };
};

/* Composites the silkscreen spread over the lit enamel, IN PLACE. Every
   stage of this panel writes into one pixel buffer and the buffer reaches
   the canvas once, at the end. The first version handed each stage a
   context and let it getImageData / putImageData for itself — six
   full-canvas round trips for a 447 200-pixel surface — and that traffic,
   not the per-pixel maths, was most of what put the paint over budget in
   the worker. */
self.PANEL_COMPOSITE = function (d, v, W, H) {
  var i, a;
  for (i = 0; i < d.length; i += 4) {
    if (!v[i + 3]) continue;
    a = v[i + 3] / 255;
    d[i] = d[i] + (v[i] - d[i]) * a;
    d[i + 1] = d[i + 1] + (v[i + 1] - d[i + 1]) * a;
    d[i + 2] = d[i + 2] + (v[i + 2] - d[i + 2]) * a;
  }
};

/* Blink derived from t, never from a wall clock. A lamp whose state came
   from Date.now() would make render(t) non-idempotent, and the QC check
   calls the same t from two directions and demands identical output. */
self.PANEL_BLINK = function (t) { return ((t * 12) | 0) % 2 === 0; };

/* ── the worker ─────────────────────────────────────────────────────────
   Paints its own chrome. That is the point of §5: when the main thread
   stops, the left unit's lamps stop blinking and its bezel stops being
   repainted, while this one carries on — furniture and all. */
self.PANEL_WORKER = function () {
  var ctx = null, chrome = null, live = null, W = 0, H = 0, ink = null;
  var raf = 0, frames = 0, t0 = 0, dur = 12000, lastPost = 0, freeRun = false;

  function paint(t) {
    ctx.drawImage(chrome, 0, 0);
    live(t, self.PANEL_BLINK(t), freeRun);
  }

  /* FNV-1a over a stride of the backing store. Runs once at boot; its only
     job is to equal the main thread's value computed the same way. */
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
      var geom = self.PANEL_CHROME(cx, W, H, ink);
      var chromeMs = performance.now() - t1;
      live = self.PANEL_LIVE(ctx, W, H, ink, geom);
      self.postMessage({ type: 'ready', chromeMs: chromeMs });
    } else if (m.type === 'render') {
      paint(m.t);
      frames++;
      self.postMessage({ type: 'rendered', t: m.t, hash: hash(), n: frames });
    } else if (m.type === 'run') {
      if (raf) return;
      freeRun = true;
      t0 = performance.now(); frames = 0;
      (function tick(now) {
        frames++;
        paint(((now - t0) % dur) / dur);
        if (now - lastPost > 100) { lastPost = now; self.postMessage({ type: 'frame', n: frames }); }
        raf = self.requestAnimationFrame(tick);
      })(performance.now());
    } else if (m.type === 'stop') {
      self.cancelAnimationFrame(raf); raf = 0; freeRun = false;
      self.postMessage({ type: 'frame', n: frames });
    }
  };
};
