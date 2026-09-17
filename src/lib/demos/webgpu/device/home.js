// @ts-nocheck -- written for the slide; untyped like the sheet code it sits beside
/* The fPhone Duo's OS layer: a boot screen and a Home Screen, drawn with ui.js
   the way every app on this device draws itself — glyphs from the atlas,
   signed-distance panels, glass over a blurred copy of the wallpaper.
   Coordinates are points on the 890 × 626 inner display. The layout follows
   what Apple has said of iOS 27 on a book-style foldable: Today View widgets on
   the left, a Home Screen page on the right, the Dock down the right edge, the
   status bar a round system in the top-right corner. Sizes and positions are
   constructed. Only the three apps built for this deck are on it; the meeting,
   the song and the weather are invented. */
import { render, bind, uniform, FSQ_VS } from './common.js';
import { WALLPAPER } from './duo.js';

const BG = FSQ_VS + WALLPAPER + `
@group(0) @binding(0) var<uniform> k: vec4f; /* aspect, dim, —, — */
@fragment fn fs(o: VO) -> @location(0) vec4f { let u = vec2f(o.uv.x, 1.0 - o.uv.y); let c = wallpaper(u, k.x) * k.y; return vec4f(c, 1.0); }`;

const WHITE = [1, 1, 1, 1], SOFT = [1, 1, 1, 0.62], FAINT = [1, 1, 1, 0.22], GLASS = [1, 1, 1, 0.1], RED = [1, 0.42, 0.40, 1];
const SVG = {
  flock: 'M3 13c3-4 6-4 9 0 3-4 6-4 9 0M6 17.5c2-2.5 4-2.5 6 0 2-2.5 4-2.5 6 0',
  tessera: 'M2.5 19L9 7l4.5 8 2.5-4 5.5 8z',
  storm: 'M3 5h18M5 9h14M8 13h9M10 17h5M12 21h1',
};
const svgIcon = (d, extra) => (x) => { x.save(); x.translate(0.5, 0.5); x.scale(1 / 26, 1 / 26); x.translate(-12, -12); x.lineWidth = 1.8; x.stroke(new Path2D(d)); if (extra) extra(x); x.restore(); };
export const REAL = {
  flock: { name: 'Roost', c: [[0.99, 0.66, 0.50, 1], [0.44, 0.30, 0.68, 1]], draw: svgIcon(SVG.flock) },
  tessera: { name: 'Tessera', c: [[0.46, 0.86, 0.74, 1], [0.08, 0.40, 0.44, 1]], draw: svgIcon(SVG.tessera, (x) => { x.beginPath(); x.arc(17.5, 6, 1.8, 0, 7); x.stroke(); }) },
  storm: { name: 'Supercell', c: [[0.50, 0.55, 0.74, 1], [0.12, 0.13, 0.28, 1]], draw: svgIcon(SVG.storm) },
};
const ORDER = ['flock', 'tessera', 'storm'];
const glyph = {
  pin: (x) => { x.beginPath(); x.moveTo(0.2, 0.45); x.lineTo(0.85, 0.15); x.lineTo(0.55, 0.8); x.lineTo(0.47, 0.53); x.closePath(); x.fill(); },
  sun: (x) => { x.lineWidth = 0.07; x.beginPath(); x.arc(0.42, 0.42, 0.14, 0, 7); x.stroke(); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; x.beginPath(); x.moveTo(0.42 + Math.cos(a) * 0.22, 0.42 + Math.sin(a) * 0.22); x.lineTo(0.42 + Math.cos(a) * 0.3, 0.42 + Math.sin(a) * 0.3); x.stroke(); }
    x.fillStyle = '#fff'; x.beginPath(); x.ellipse(0.62, 0.7, 0.26, 0.13, 0, 0, 7); x.fill(); },
  prev: (x) => { x.beginPath(); x.moveTo(0.8, 0.22); x.lineTo(0.48, 0.5); x.lineTo(0.8, 0.78); x.closePath(); x.moveTo(0.48, 0.22); x.lineTo(0.16, 0.5); x.lineTo(0.48, 0.78); x.closePath(); x.fill(); },
  next: (x) => { x.beginPath(); x.moveTo(0.2, 0.22); x.lineTo(0.52, 0.5); x.lineTo(0.2, 0.78); x.closePath(); x.moveTo(0.52, 0.22); x.lineTo(0.84, 0.5); x.lineTo(0.52, 0.78); x.closePath(); x.fill(); },
  radios: (x) => { x.lineWidth = 0.1; x.beginPath(); x.arc(0.5, 0.78, 0.44, Math.PI * 1.22, Math.PI * 1.78); x.stroke(); x.beginPath(); x.arc(0.5, 0.78, 0.25, Math.PI * 1.2, Math.PI * 1.8); x.stroke(); x.beginPath(); x.arc(0.5, 0.78, 0.06, 0, Math.PI * 2); x.fill(); },
};

export function makeHome(dev, ui) {
  const pipe = render(BG), ku = uniform(16), g = bind(pipe, [ku]);
  const tile = (id, x, y, s, label) => { const a = REAL[id], r = s * 0.225;
    ui.grad(x, y, s, s, a.c[0], a.c[1], r, true); ui.stroke(x, y, s, s, [1, 1, 1, 0.14], r, 1);
    ui.icon(id + '-' + s, x + s * 0.14, y + s * 0.14, s * 0.72, WHITE, a.draw);
    if (label) ui.text(x + s / 2, y + s + 8, a.name, 17.5, WHITE, { align: 'center', weight: 500 });
    ui.hit('app-' + id + ':' + x + ':' + y + ':' + s, x, y, s, s); };
  const clock = () => { const d = new Date(); return { hm: d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' }), dow: d.toLocaleDateString('en-GB', { weekday: 'long' }), dd: String(d.getDate()) }; };
  const bg = (enc, dim) => { const tgt = ui.prepare(1); dev.queue.writeBuffer(ku, 0, new Float32Array([890 / 626, dim, 0, 0]));
    const rp = enc.beginRenderPass({ colorAttachments: [{ view: tgt.view, loadOp: 'clear', storeOp: 'store' }] }); rp.setPipeline(pipe); rp.setBindGroup(0, g); rp.draw(3); rp.end(); };
  const panel = (x, y, w, h) => { ui.glass(x, y, w, h, GLASS, 30, 0.24); ui.stroke(x, y, w, h, [1, 1, 1, 0.16], 30, 1); };
  return {
    draw(now, fade = 0) { const enc = dev.createCommandEncoder(); bg(enc, 1); const c = clock();
      /* status: the time over the radios disc, top-right */
      ui.text(866, 10, c.hm, 17.5, WHITE, { weight: 600, align: 'right' });
      ui.glassDisc(850, 52, 16, [1, 1, 1, 0.16], 0.3); ui.icon('radios', 839, 41, 22, WHITE, glyph.radios);
      /* Today View: weather and calendar side by side, music below, from the top of the left leaf */
      const L = 40, S = 180, G = 14, top = 64; /* top-aligned with the app grid, under the status corner */
      panel(L, top, S, S);
      ui.text(L + 18, top + 16, 'Lisbon', 17.5, WHITE, { weight: 600 }); ui.icon('pin', L + 80, top + 20, 13, WHITE, glyph.pin);
      ui.text(L + 16, top + 36, '21°', 58, WHITE, { weight: 200 });
      ui.icon('sun', L + 18, top + 104, 24, WHITE, glyph.sun);
      ui.text(L + 18, top + 128, 'Partly Cloudy', 17.5, WHITE, { weight: 600 }); ui.text(L + 18, top + 150, 'H:24°  L:16°', 17.5, SOFT);
      const C0 = L + S + G; panel(C0, top, S, S);
      ui.text(C0 + 18, top + 16, c.dow.toUpperCase(), 17.5, RED, { weight: 600, track: 0.04 });
      ui.text(C0 + 16, top + 36, c.dd, 58, WHITE, { weight: 200 });
      ui.rect(C0 + 18, top + 118, 3, 48, [1, 1, 1, 0.55], 1.5);
      ui.text(C0 + 30, top + 118, 'Motion review', 17.5, WHITE, { weight: 600 }); ui.text(C0 + 30, top + 142, '10:30 – 11:00', 17.5, SOFT);
      const my = top + S + G, MW = S * 2 + G; panel(L, my, MW, 164);
      ui.grad(L + 18, my + 18, 96, 96, [0.86, 0.62, 0.64, 1], [0.34, 0.28, 0.52, 1], 16, true); ui.ring(L + 66, my + 66, 22, [1, 1, 1, 0.5], 1.5); ui.disc(L + 66, my + 66, 4, [1, 1, 1, 0.7]);
      ui.text(L + 134, my + 22, 'Low Orbit', 19, WHITE, { weight: 600 }); ui.text(L + 134, my + 46, 'Paper Tigers', 17.5, SOFT);
      const prog = 0.38 + ((now / 1000) % 212) / 212 * 0.62, bw = MW - 134 - 22;
      ui.rect(L + 134, my + 84, bw, 3, FAINT, 1.5); ui.rect(L + 134, my + 84, bw * prog, 3, WHITE, 1.5);
      const cx = L + 134 + bw / 2;
      ui.icon('prev', cx - 70, my + 106, 26, WHITE, glyph.prev); ui.rect(cx - 9, my + 107, 6, 24, WHITE, 2); ui.rect(cx + 3, my + 107, 6, 24, WHITE, 2); ui.icon('next', cx + 44, my + 106, 26, WHITE, glyph.next);
      /* the Home Screen page: the three apps */
      ORDER.forEach((id, i) => tile(id, 500 + i * 104, 64, 72, true));
      /* the Dock, down the right edge */
      const ds = 50, gap = 14, dh = ORDER.length * ds + (ORDER.length - 1) * gap + 28, dx = 815, dy = 318 - dh / 2;
      ui.glass(dx, dy, 72, dh, GLASS, 30, 0.26); ui.stroke(dx, dy, 72, dh, [1, 1, 1, 0.16], 30, 1);
      ORDER.forEach((id, i) => tile(id, dx + 11, dy + 14 + i * (ds + gap), ds, false));
      if (fade > 0) ui.rect(0, 0, 890, 626, [0, 0, 0, fade], 0);
      ui.compose(enc); dev.queue.submit([enc.finish()]); },
    /* the boot screen: an invented fold mark, the fPhone wordmark and a thin progress line */
    boot(p) { const enc = dev.createCommandEncoder(); const tgt = ui.prepare(1);
      const rp = enc.beginRenderPass({ colorAttachments: [{ view: tgt.view, loadOp: 'clear', clearValue: [0, 0, 0, 1], storeOp: 'store' }] }); rp.end();
      /* the mark: two panels meeting at a fold, and the wordmark (upright: an italic overhang bleeds into the next glyph packed in the atlas) */
      ui.stroke(445 - 33, 222, 32, 46, [1, 1, 1, 0.9], 8, 2.5); ui.stroke(445 + 1, 222, 32, 46, [1, 1, 1, 0.9], 8, 2.5);
      ui.text(445, 286, 'fPhone', 26, WHITE, { weight: 500, align: 'center', track: 0.02 });
      ui.rect(445 - 80, 354, 160, 3, FAINT, 1.5); ui.rect(445 - 80, 354, 160 * Math.max(0.02, Math.min(1, p)), 3, WHITE, 1.5);
      ui.compose(enc); dev.queue.submit([enc.finish()]); },
    destroy() { ku.destroy(); },
  };
}
