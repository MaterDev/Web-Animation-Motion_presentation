// @ts-nocheck -- written for the slide; untyped like the sheet code it sits beside
/* The Duo's OS layer: a boot screen and a Home Screen that looks lived in —
   status bar, calendar, weather, now playing, batteries, an icon grid and a
   Dock — drawn with ui.js the way every app on this device draws itself:
   glyphs from the atlas, signed-distance panels, glass over a blurred copy of
   the wallpaper. Coordinates are points on the 890 × 626 inner display.
   Everything invented: the meeting, the song, the band, the weather. */
import { render, bind, uniform, FSQ_VS } from './common.js';
import { WALLPAPER } from './duo.js';

const BG = FSQ_VS + WALLPAPER + `
@group(0) @binding(0) var<uniform> k: vec4f; /* aspect, dim, —, — */
@fragment fn fs(o: VO) -> @location(0) vec4f { let u = vec2f(o.uv.x, 1.0 - o.uv.y); var c = wallpaper(u, k.x);
  c = c * k.y * (1.0 - 0.18 * smoothstep(0.35, 1.0, length((o.uv - vec2f(0.5, 0.45)) * vec2f(1.0, 1.3)))); return vec4f(c, 1.0); }`;

const SANS_W = { weight: 600 };
const INK = [0.10, 0.10, 0.12, 1], DIM = [0.10, 0.10, 0.12, 0.58], WHITE = [1, 1, 1, 1], RED = [0.92, 0.26, 0.24, 1];
const SVG = {
  flock: 'M3 13c3-4 6-4 9 0 3-4 6-4 9 0M6 17.5c2-2.5 4-2.5 6 0 2-2.5 4-2.5 6 0',
  tessera: 'M2.5 19L9 7l4.5 8 2.5-4 5.5 8z',
  storm: 'M3 5h18M5 9h14M8 13h9M10 17h5M12 21h1',
};
const svgIcon = (d, extra) => (x) => { x.save(); x.scale(1 / 24, 1 / 24); x.lineWidth = 1.9; x.stroke(new Path2D(d)); if (extra) extra(x); x.restore(); };
/* the three real apps, then the furniture of a used phone */
export const REAL = {
  flock: { name: 'Roost', c: [[0.62, 0.52, 0.86, 1], [0.36, 0.28, 0.62, 1]], draw: svgIcon(SVG.flock) },
  tessera: { name: 'Tessera', c: [[0.36, 0.80, 0.70, 1], [0.10, 0.50, 0.46, 1]], draw: svgIcon(SVG.tessera, (x) => { x.beginPath(); x.arc(17.5, 6, 1.8, 0, 7); x.stroke(); }) },
  storm: { name: 'Supercell', c: [[0.42, 0.40, 0.66, 1], [0.16, 0.14, 0.34, 1]], draw: svgIcon(SVG.storm) },
};
const FAKE = {
  photos: { name: 'Photos', c: [[1, 1, 1, 1], [0.93, 0.93, 0.95, 1]], ink: [0.95, 0.55, 0.2, 1], draw: (x) => { for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; x.beginPath(); x.ellipse(0.5 + Math.cos(a) * 0.17, 0.5 + Math.sin(a) * 0.17, 0.15, 0.08, a, 0, 7); x.fill(); } } },
  notes: { name: 'Notes', c: [[1, 0.93, 0.55, 1], [0.98, 0.80, 0.24, 1]], ink: [0.35, 0.28, 0.1, 1], draw: (x) => { x.lineWidth = 0.06; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(0.2, 0.3 + i * 0.14); x.lineTo(i === 3 ? 0.55 : 0.8, 0.3 + i * 0.14); x.stroke(); } } },
  maps: { name: 'Maps', c: [[0.62, 0.86, 0.58, 1], [0.35, 0.68, 0.42, 1]], draw: (x) => { x.lineWidth = 0.07; x.beginPath(); x.moveTo(0.1, 0.75); x.lineTo(0.9, 0.35); x.stroke(); x.beginPath(); x.arc(0.5, 0.36, 0.16, Math.PI * 0.85, Math.PI * 2.15); x.lineTo(0.5, 0.78); x.closePath(); x.fill(); } },
  music: { name: 'Music', c: [[0.99, 0.42, 0.50, 1], [0.88, 0.16, 0.32, 1]], draw: (x) => { x.lineWidth = 0.08; x.beginPath(); x.moveTo(0.4, 0.72); x.lineTo(0.4, 0.22); x.lineTo(0.76, 0.16); x.lineTo(0.76, 0.64); x.stroke(); x.beginPath(); x.ellipse(0.31, 0.73, 0.11, 0.08, -0.3, 0, 7); x.ellipse(0.67, 0.66, 0.11, 0.08, -0.3, 0, 7); x.fill(); } },
  calendar: { name: 'Calendar', c: [[1, 1, 1, 1], [0.94, 0.94, 0.95, 1]], ink: RED, draw: (x) => { x.lineWidth = 0.07; x.beginPath(); x.roundRect(0.18, 0.24, 0.64, 0.58, 0.08); x.stroke(); x.beginPath(); x.moveTo(0.18, 0.42); x.lineTo(0.82, 0.42); x.stroke(); } },
  settings: { name: 'Settings', c: [[0.72, 0.73, 0.76, 1], [0.45, 0.46, 0.50, 1]], draw: (x) => { x.lineWidth = 0.08; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; x.beginPath(); x.moveTo(0.5 + Math.cos(a) * 0.24, 0.5 + Math.sin(a) * 0.24); x.lineTo(0.5 + Math.cos(a) * 0.36, 0.5 + Math.sin(a) * 0.36); x.stroke(); } x.beginPath(); x.arc(0.5, 0.5, 0.2, 0, 7); x.stroke(); } },
  camera: { name: 'Camera', c: [[0.66, 0.67, 0.70, 1], [0.38, 0.39, 0.42, 1]], draw: (x) => { x.lineWidth = 0.07; x.beginPath(); x.roundRect(0.16, 0.3, 0.68, 0.48, 0.08); x.stroke(); x.beginPath(); x.arc(0.5, 0.54, 0.13, 0, 7); x.stroke(); } },
  files: { name: 'Files', c: [[0.45, 0.72, 1, 1], [0.16, 0.46, 0.95, 1]], draw: (x) => { x.beginPath(); x.moveTo(0.16, 0.3); x.lineTo(0.42, 0.3); x.lineTo(0.5, 0.38); x.lineTo(0.84, 0.38); x.lineTo(0.84, 0.76); x.lineTo(0.16, 0.76); x.closePath(); x.fill(); } },
  messages: { name: 'Messages', c: [[0.45, 0.92, 0.45, 1], [0.15, 0.72, 0.26, 1]], draw: (x) => { x.beginPath(); x.ellipse(0.5, 0.47, 0.32, 0.25, 0, 0, 7); x.fill(); x.beginPath(); x.moveTo(0.26, 0.6); x.lineTo(0.2, 0.8); x.lineTo(0.42, 0.68); x.fill(); } },
  safari: { name: 'Safari', c: [[1, 1, 1, 1], [0.92, 0.93, 0.95, 1]], ink: [0.16, 0.5, 0.96, 1], draw: (x) => { x.lineWidth = 0.05; x.beginPath(); x.arc(0.5, 0.5, 0.34, 0, 7); x.stroke(); x.beginPath(); x.moveTo(0.66, 0.34); x.lineTo(0.54, 0.54); x.lineTo(0.34, 0.66); x.lineTo(0.46, 0.46); x.closePath(); x.fill(); } },
  clock: { name: 'Clock', c: [[0.2, 0.2, 0.22, 1], [0.05, 0.05, 0.06, 1]], draw: (x) => { x.lineWidth = 0.06; x.beginPath(); x.arc(0.5, 0.5, 0.34, 0, 7); x.stroke(); x.beginPath(); x.moveTo(0.5, 0.26); x.lineTo(0.5, 0.52); x.lineTo(0.68, 0.6); x.stroke(); } },
  reminders: { name: 'Reminders', c: [[1, 1, 1, 1], [0.93, 0.93, 0.95, 1]], ink: [0.2, 0.5, 0.95, 1], draw: (x) => { x.lineWidth = 0.05; for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(0.26, 0.28 + i * 0.22, 0.07, 0, 7); x.stroke(); x.beginPath(); x.moveTo(0.42, 0.28 + i * 0.22); x.lineTo(0.8, 0.28 + i * 0.22); x.stroke(); } } },
  podcasts: { name: 'Podcasts', c: [[0.80, 0.50, 0.98, 1], [0.52, 0.22, 0.80, 1]], draw: (x) => { x.lineWidth = 0.07; x.beginPath(); x.arc(0.5, 0.44, 0.3, Math.PI * 0.8, Math.PI * 2.2); x.stroke(); x.beginPath(); x.arc(0.5, 0.44, 0.1, 0, 7); x.fill(); x.beginPath(); x.moveTo(0.5, 0.56); x.lineTo(0.5, 0.82); x.stroke(); } },
  books: { name: 'Books', c: [[1, 0.70, 0.30, 1], [0.96, 0.46, 0.08, 1]], draw: (x) => { x.beginPath(); x.moveTo(0.5, 0.3); x.quadraticCurveTo(0.34, 0.22, 0.16, 0.26); x.lineTo(0.16, 0.74); x.quadraticCurveTo(0.34, 0.7, 0.5, 0.78); x.quadraticCurveTo(0.66, 0.7, 0.84, 0.74); x.lineTo(0.84, 0.26); x.quadraticCurveTo(0.66, 0.22, 0.5, 0.3); x.fill(); } },
  weather: { name: 'Weather', c: [[0.45, 0.72, 1, 1], [0.18, 0.46, 0.88, 1]], draw: (x) => { x.fillStyle = '#fff'; x.beginPath(); x.arc(0.4, 0.4, 0.16, 0, 7); x.fill(); x.beginPath(); x.ellipse(0.56, 0.62, 0.26, 0.13, 0, 0, 7); x.fill(); } },
  mail: { name: 'Mail', c: [[0.40, 0.72, 1, 1], [0.12, 0.46, 0.96, 1]], draw: (x) => { x.lineWidth = 0.06; x.beginPath(); x.roundRect(0.16, 0.28, 0.68, 0.46, 0.06); x.stroke(); x.beginPath(); x.moveTo(0.18, 0.31); x.lineTo(0.5, 0.56); x.lineTo(0.82, 0.31); x.stroke(); } },
};
const GRID = [['flock', 'tessera', 'storm', 'photos'], ['notes', 'maps', 'calendar', 'camera'], ['files', 'settings', 'mail', 'clock'], ['reminders', 'podcasts', 'books', 'weather']];
const DOCK = ['flock', 'tessera', 'storm', null, 'messages', 'safari', 'music'];
const spec = (id) => REAL[id] || FAKE[id];

export function makeHome(dev, ui) {
  const pipe = render(BG), ku = uniform(16), g = bind(pipe, [ku]);
  const bounce = new Map();
  const tile = (id, x, y, s, now, label) => { const a = spec(id); const b = bounce.get(id); let k = 1; if (b !== undefined) { const f = (now - b) / 380; if (f > 1) bounce.delete(id); else k = 1 - 0.12 * Math.sin(f * Math.PI); }
    const S = s * k, X = x + (s - S) / 2, Y = y + (s - S) / 2;
    ui.grad(X, Y, S, S, a.c[0], a.c[1], S * 0.225, true); ui.stroke(X, Y, S, S, [0, 0, 0, 0.08], S * 0.225, 1);
    ui.icon(id + '-' + Math.round(s), X + S * 0.18, Y + S * 0.18, S * 0.64, a.ink || WHITE, a.draw);
    if (label) ui.text(x + s / 2, y + s + 6, a.name, 17.5, WHITE, { align: 'center', weight: 500 });
    ui.hit((REAL[id] ? 'app-' : 'fake-') + id + ':' + x + ':' + y + ':' + s, x, y, s, s); };
  const clock = () => { const d = new Date(); return { hm: d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' }), dow: d.toLocaleDateString('en-GB', { weekday: 'long' }), dd: String(d.getDate()), short: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) }; };
  const bg = (enc, dim) => { const tgt = ui.prepare(1); dev.queue.writeBuffer(ku, 0, new Float32Array([890 / 626, dim, 0, 0]));
    const rp = enc.beginRenderPass({ colorAttachments: [{ view: tgt.view, loadOp: 'clear', storeOp: 'store' }] }); rp.setPipeline(pipe); rp.setBindGroup(0, g); rp.draw(3); rp.end(); };
  return {
    tap(id, now) { bounce.set(id, now); },
    /* the Home Screen, laid out the way iOS 27 does on the Duo's inner display: Today View — a vertical list of widgets —
       on the left, a Home Screen page on the right, the Dock and navigation down the right edge, the status bar a
       circular system in the top-right corner. Positions and sizes are constructed, not measured. */
    draw(now, fade = 0) { const enc = dev.createCommandEncoder(); bg(enc, 0.9); const c = clock();
      /* status: the time over the radios disc, top-right */
      ui.text(866, 9, c.hm, 17.5, WHITE, { weight: 600, align: 'right' });
      ui.glassDisc(851, 52, 17, [1, 1, 1, 0.45], 0.25);
      ui.icon('radios', 839, 40, 24, INK, (x) => { x.lineWidth = 0.1; x.beginPath(); x.arc(0.5, 0.78, 0.44, Math.PI * 1.22, Math.PI * 1.78); x.stroke(); x.beginPath(); x.arc(0.5, 0.78, 0.25, Math.PI * 1.2, Math.PI * 1.8); x.stroke(); x.beginPath(); x.arc(0.5, 0.78, 0.06, 0, Math.PI * 2); x.fill(); });
      /* Today View, left: date header, then the widgets, the last one running off the bottom as a scrolling list does */
      const L = 26, CW = 400, top = 16;
      ui.text(L + 4, top, c.short.toUpperCase(), 17.5, WHITE, { weight: 600, track: 0.06 });
      const w1 = top + 30;
      ui.glass(L, w1, 194, 176, [1, 1, 1, 0.72], 24, 0.2);
      ui.text(L + 16, w1 + 14, c.dow.toUpperCase(), 17.5, RED, { weight: 700, track: 0.04 });
      ui.text(L + 14, w1 + 32, c.dd, 50, INK, { weight: 300 });
      ui.rect(L + 16, w1 + 104, 4, 50, [0.36, 0.62, 0.98, 1], 2);
      ui.text(L + 28, w1 + 104, 'Motion review', 18, INK, { weight: 600 }); ui.text(L + 28, w1 + 128, '10:30 – 11:00', 17.5, DIM);
      const R0 = L + 206;
      ui.grad(R0, w1, 194, 176, [0.30, 0.56, 0.92, 1], [0.16, 0.34, 0.70, 1], 24);
      ui.text(R0 + 16, w1 + 14, 'Lisbon', 19, WHITE, { weight: 600 }); ui.text(R0 + 14, w1 + 34, '21°', 50, WHITE, { weight: 300 });
      ui.disc(R0 + 152, w1 + 38, 16, [1, 0.84, 0.3, 1]); ui.disc(R0 + 141, w1 + 55, 13, [1, 1, 1, 0.95]); ui.disc(R0 + 160, w1 + 53, 16, [1, 1, 1, 0.95]); ui.rect(R0 + 128, w1 + 53, 48, 16, [1, 1, 1, 0.95], 8);
      ui.text(R0 + 16, w1 + 116, 'Partly Cloudy', 17.5, WHITE, { weight: 500 }); ui.text(R0 + 16, w1 + 140, 'H:24°  L:16°', 17.5, [1, 1, 1, 0.8]);
      const np = w1 + 188;
      ui.glass(L, np, CW, 140, [1, 1, 1, 0.72], 24, 0.2);
      ui.grad(L + 14, np + 14, 112, 112, [0.98, 0.50, 0.36, 1], [0.44, 0.20, 0.62, 1], 12, true); ui.disc(L + 70, np + 70, 32, [1, 0.86, 0.5, 0.9]); ui.disc(L + 70, np + 70, 20, [0.44, 0.20, 0.62, 0.9]); ui.disc(L + 70, np + 70, 5, [1, 0.86, 0.5, 1]);
      ui.text(L + 142, np + 16, 'Low Orbit', 21, INK, { weight: 700 }); ui.text(L + 142, np + 42, 'Paper Tigers', 18, DIM);
      const prog = ((now / 1000) % 238) / 238; ui.rect(L + 142, np + 80, 236, 4, [0, 0, 0, 0.12], 2); ui.rect(L + 142, np + 80, 236 * (0.43 + prog * 0.57), 4, INK, 2);
      ui.icon('np-prev', L + 186, np + 98, 28, INK, (x) => { x.beginPath(); x.moveTo(0.8, 0.2); x.lineTo(0.45, 0.5); x.lineTo(0.8, 0.8); x.closePath(); x.moveTo(0.45, 0.2); x.lineTo(0.1, 0.5); x.lineTo(0.45, 0.8); x.closePath(); x.fill(); });
      ui.rect(L + 246, np + 100, 7, 24, INK, 2); ui.rect(L + 258, np + 100, 7, 24, INK, 2);
      ui.icon('np-next', L + 300, np + 98, 28, INK, (x) => { x.beginPath(); x.moveTo(0.2, 0.2); x.lineTo(0.55, 0.5); x.lineTo(0.2, 0.8); x.closePath(); x.moveTo(0.55, 0.2); x.lineTo(0.9, 0.5); x.lineTo(0.55, 0.8); x.closePath(); x.fill(); });
      const bt = np + 152;
      ui.glass(L, bt, CW, 104, [1, 1, 1, 0.72], 24, 0.2);
      [['Duo', 0.82], ['AirPods', 0.64], ['Pencil', 1], ['Watch', 0.47]].forEach(([nm, v], i) => { const cx = L + 54 + i * 98, cy = bt + 38;
        ui.ring(cx, cy, 22, [0, 0, 0, 0.1], 5); for (let k = 0; k < 40 * v; k++) { const a = -Math.PI / 2 + k / 40 * Math.PI * 2; ui.disc(cx + Math.cos(a) * 19.5, cy + Math.sin(a) * 19.5, 2.6, v < 0.5 ? [0.98, 0.72, 0.2, 1] : [0.22, 0.78, 0.36, 1]); }
        ui.text(cx, cy - 11, Math.round(v * 100) + '', 17.5, INK, { weight: 600, align: 'center' }); ui.text(cx, bt + 70, nm, 17.5, DIM, { align: 'center' }); });
      const rm = bt + 116;
      ui.glass(L, rm, CW, 120, [1, 1, 1, 0.72], 24, 0.2);
      ui.text(L + 16, rm + 14, 'Reminders', 18, [0.95, 0.55, 0.2, 1], { weight: 700 });
      ['Book the rehearsal room', 'Send slides to Priya'].forEach((t2, i) => { ui.ring(L + 27, rm + 52 + i * 30, 8, [0, 0, 0, 0.3], 1.5); ui.text(L + 44, rm + 41 + i * 30, t2, 17.5, INK); });
      /* a Home Screen page, right leaf, with its page dots */
      GRID.forEach((row, j) => row.forEach((id, i) => tile(id, 480 + i * 84, 40 + j * 122, 62, now, true)));
      ui.disc(634, 560, 3.5, WHITE); ui.disc(648, 560, 3.5, [1, 1, 1, 0.45]);
      /* the Dock, down the right edge */
      const ds = 50, gap = 12, n = DOCK.filter(Boolean).length, dh = n * ds + (n - 1) * gap + 16 + 28, dx = 818, dy = 313 - dh / 2 + 22;
      ui.glass(dx, dy, 68, dh, [1, 1, 1, 0.35], 30, 0.25);
      let y = dy + 14; DOCK.forEach((id) => { if (!id) { ui.rect(dx + 14, y - gap / 2 + 1, 40, 1.5, [1, 1, 1, 0.5], 1); y += 16 - gap; return; } tile(id, dx + 9, y, ds, now, false); y += ds + gap; });
      if (fade > 0) ui.rect(0, 0, 890, 626, [0, 0, 0, fade], 0);
      ui.compose(enc); dev.queue.submit([enc.finish()]); },
    /* the boot screen: the Duo's mark and a progress bar */
    boot(p) { const enc = dev.createCommandEncoder(); const tgt = ui.prepare(1);
      const rp = enc.beginRenderPass({ colorAttachments: [{ view: tgt.view, loadOp: 'clear', clearValue: [0, 0, 0, 1], storeOp: 'store' }] }); rp.end();
      ui.stroke(445 - 50, 236, 48, 68, WHITE, 10, 3); ui.stroke(445 + 2, 236, 48, 68, WHITE, 10, 3);
      ui.rect(445 - 90, 352, 180, 5, [1, 1, 1, 0.22], 2.5); ui.rect(445 - 90, 352, 180 * Math.max(0.02, Math.min(1, p)), 5, WHITE, 2.5);
      ui.compose(enc); dev.queue.submit([enc.finish()]); },
    destroy() { ku.destroy(); },
  };
}
