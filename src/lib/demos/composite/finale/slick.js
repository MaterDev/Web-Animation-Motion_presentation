// @ts-nocheck -- adapted from src/lib/demos/canvas/off-thread/transport.js (T5_OIL_LUT, T5_OIL_FIELD); untyped sheet code
/* The oil slick, on a 2D canvas: the off-thread player's visualizer field,
   a domain-warped value noise mapped through a thin-film palette, drawn into
   ImageData at low resolution and scaled up with smoothing so it reads as
   liquid. Changed for the finale: it is a pure function of seconds (not a
   12 s cycle), and it is laid over the LCD ground rather than a dark screen,
   so each pixel mixes from the ground toward the film colour by the sheen,
   and fades out toward both ends of the band through its alpha. */
const STOPS = [[40, 30, 90], [196, 60, 150], [226, 186, 90], [92, 178, 104], [90, 186, 206], [96, 70, 170]];
function lutOf(stops) {
  const lut = new Uint8Array(256 * 3), n = stops.length;
  for (let i = 0; i < 256; i++) {
    const f = (i / 256) * n, k = Math.floor(f); let e = f - k; e = e * e * (3 - 2 * e);
    const a = stops[k % n], b = stops[(k + 1) % n];
    for (let c = 0; c < 3; c++) lut[i * 3 + c] = Math.round(a[c] + (b[c] - a[c]) * e);
  }
  return lut;
}
const hash = (x, y) => { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) & 0xffff) / 65535; };
const noise = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), e = hash(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + e) * u * v; };
const fbm = (x, y) => 0.64 * noise(x, y) + 0.36 * noise(x * 2.07 + 17.3, y * 2.07 - 9.1);

/** @param {HTMLCanvasElement} canvas  backing store is the field's resolution; CSS scales it up */
export function makeSlick(canvas, ground) {
  const ctx = canvas.getContext('2d'); const IW = canvas.width, IH = canvas.height;
  const img = ctx.createImageData(IW, IH), d = img.data, lut = lutOf(STOPS);
  return function draw(sec) {
    const TAU = Math.PI * 2, t = sec / 240;
    const c1 = Math.cos(TAU * t * 4), s1 = Math.sin(TAU * t * 4), c2 = Math.cos(TAU * t * 6), s2 = Math.sin(TAU * t * 6);
    const ax = 1.1 * c1, ay = 1.1 * s1, bx = 5.2 - 0.9 * s2, by = 1.3 + 0.9 * c2, cx = 8.3 + 1.3 * c2, cy = 2.8 - 1.3 * s1;
    const k = 6.4 / IW, [gr, gg, gb] = ground; let o = 0;
    for (let y = 0; y < IH; y++) { const py = y * k, vy = 1 - Math.abs(y / (IH - 1) * 2 - 1);
      for (let x = 0; x < IW; x++) { const px = x * k;
        const qx = fbm(px + ax, py + ay), qy = fbm(px + bx, py + by), v = fbm(px + 2.8 * qx + cx, py + 2.8 * qy + cy);
        let th = v * 3.2 + qx * 1.4 - qy * 0.6 - t * 16; th -= Math.floor(th); const idx = ((th * 255) | 0) * 3;
        let s = (v - 0.26) / 0.44; s = s < 0 ? 0 : s > 1 ? 1 : s; s = s * s * (3 - 2 * s);
        const m = 0.18 + 0.42 * s, ex = x / (IW - 1), edge = Math.min(1, ex / 0.18, (1 - ex) / 0.18);
        d[o] = gr + (lut[idx] - gr) * m; d[o + 1] = gg + (lut[idx + 1] - gg) * m; d[o + 2] = gb + (lut[idx + 2] - gb) * m;
        d[o + 3] = 255 * edge * Math.min(1, vy * 2.2); o += 4; } }
    ctx.putImageData(img, 0, 0);
  };
}
