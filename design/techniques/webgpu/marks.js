/* §2 · MARKS — eight motion business cards, one for each of the eight
   largest companies on the Fortune list. No logos, no taglines: each card
   is a palette and one piece of motion craft written as a fragment shader,
   and the hand disturbs it. The point is that a brand's motion can be a
   twelve-line program that runs on any visitor's GPU. */
import { $, DPR, uniform, render, bind, attach, card, pointer, FSQ_VS } from './common.js';

const HEAD = FSQ_VS + `
struct R { res: vec2f, time: f32, aspect: f32, ptr: vec2f, ptrOn: f32, pad: f32 };
@group(0) @binding(0) var<uniform> r: R;
fn hash(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }
fn vn(p: vec2f) -> f32 { let i = floor(p); var f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2f(1, 0)), f.x), mix(hash(i + vec2f(0, 1)), hash(i + vec2f(1, 1)), f.x), f.y); }
fn fbm(p0: vec2f) -> f32 { var p = p0; var a = 0.5; var s = 0.0; for (var i = 0; i < 5; i++) { s += a * vn(p); a *= 0.5; p = p * 2.1 + 1.7; } return s; }
fn sdSeg(p: vec2f, a: vec2f, b: vec2f) -> f32 { let pa = p - a; let ba = b - a; let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
fn aa(d: f32, w: f32) -> f32 { return 1.0 - smoothstep(0.0, w, d); }
@fragment fn fs(o: VO) -> @location(0) vec4f { let uv = vec2f(o.uv.x, 1.0 - o.uv.y); let p = (uv - 0.5) * vec2f(r.aspect, 1.0); let t = r.time; let m = (r.ptr - 0.5) * vec2f(r.aspect, 1.0);
`;
const TAIL = `  return vec4f(col, 1.0); }`;

/* each card: name, sector line, and the body of its shader. Colours are the
   companies' own broad palettes, written from memory, not sampled. */
const MARKS = [
  { id: 'walmart', name: 'Walmart', line: 'Retail · Bentonville', body: `
    /* a sunrise sweep: yellow light rakes across a field of blue, and rows of
       goods (dots) light as it passes — the aisle at opening time */
    var col = vec3f(0.0, 0.32, 0.72);
    let sweep = fract(t * 0.12); let sx = sweep * 2.4 - 1.2; let band = exp(-pow((p.x - sx) * 3.0, 2.0));
    col += vec3f(1.0, 0.76, 0.12) * band * 0.9;
    let g = fract(p * 7.0) - 0.5; let cell = floor(p * 7.0); let lit = smoothstep(0.35, 0.0, length(g)) * (0.25 + 0.75 * band) * step(0.3, hash(cell));
    col = mix(col, vec3f(1.0, 0.85, 0.35), lit * 0.85);
    let hand = exp(-length(p - m) * 6.0) * r.ptrOn; col += vec3f(1.0, 0.8, 0.2) * hand * 0.5;` },
  { id: 'amazon', name: 'Amazon', line: 'Commerce · cloud · Seattle', body: `
    /* parcels on a belt: a stream of rounded boxes moving right, one of them
       always turning gold as it passes the centre; the hand is a gate */
    var col = vec3f(0.08, 0.09, 0.11);
    for (var i = 0; i < 7; i++) { let fi = f32(i); let x = fract(t * 0.16 + fi * 0.143) * 2.6 - 1.3; let y = -0.22 + 0.12 * sin(fi * 2.1); let q = p - vec2f(x, y); let d = length(max(abs(q) - vec2f(0.10, 0.07), vec2f(0.0))) - 0.02; let near = exp(-pow(x * 3.5, 2.0)); let c = mix(vec3f(0.52, 0.42, 0.30), vec3f(1.0, 0.60, 0.0), near); col = mix(col, c, aa(d, 0.01)); col += c * 0.12 * aa(d - 0.03, 0.06); }
    let belt = aa(abs(p.y + 0.36) - 0.01, 0.01); col = mix(col, vec3f(0.30), belt);
    /* a dotted arc travels over the belt, the route the parcel takes */
    let ac = vec2f(0.0, 0.95); let ad = abs(length(p - ac) - 0.78); let along = atan2(p.x, -(p.y - ac.y)); let dots = smoothstep(0.35, 0.0, abs(fract(along * 4.0 - t * 0.8) - 0.5)); col += vec3f(1.0, 0.60, 0.0) * aa(ad - 0.006, 0.008) * dots * step(p.y, 0.3);
    let hand = exp(-length(p - m) * 5.0) * r.ptrOn; col += vec3f(1.0, 0.6, 0.0) * hand * 0.4;` },
  { id: 'apple', name: 'Apple', line: 'Devices · Cupertino', body: `
    /* brushed metal, a single light sweep, and the hand leaves a fingerprint
       of warmth that fades: restraint as the brand */
    let brush = fbm(vec2f(p.x * 3.0, p.y * 90.0)) * 0.06; var col = vec3f(0.86, 0.87, 0.89) + brush;
    let sw = p.x + p.y * 0.4 - (fract(t * 0.07) * 3.0 - 1.5); col += vec3f(0.14) * exp(-sw * sw * 18.0);
    col -= vec3f(0.05) * smoothstep(0.3, 0.9, length(p * vec2f(0.8, 1.2)));
    let hand = exp(-length(p - m) * 7.0) * r.ptrOn; col = mix(col, vec3f(0.98, 0.96, 0.93), hand * 0.6);` },
  { id: 'unitedhealth', name: 'UnitedHealth Group', line: 'Health · Minnetonka', body: `
    /* a pulse that keeps time: an ECG trace drawn left to right and a soft
       blue glow that breathes with it; the hand raises the heart rate */
    var col = vec3f(0.97, 0.98, 1.0);
    let rate = 1.0 + r.ptrOn * 0.8; let ph = fract(p.x * 0.7 + t * 0.25 * rate); var y = 0.0;
    y += exp(-pow((ph - 0.42) * 40.0, 2.0)) * 0.30 - exp(-pow((ph - 0.47) * 40.0, 2.0)) * 0.12 + exp(-pow((ph - 0.36) * 60.0, 2.0)) * 0.05 + exp(-pow((ph - 0.62) * 25.0, 2.0)) * 0.06;
    let d = abs(p.y + 0.05 - y); let head = fract(t * 0.25 * rate); let ahead = smoothstep(0.0, 0.02, head - uv.x);
    col = mix(col, vec3f(0.0, 0.36, 0.70), aa(d - 0.006, 0.008) * (1.0 - ahead * 0.85));
    col = mix(col, vec3f(0.0, 0.50, 0.85), aa(length(vec2f(uv.x - head, p.y + 0.05 - y)) - 0.012, 0.012));
    let beat = pow(0.5 + 0.5 * sin(t * 2.0 * rate), 8.0); col -= vec3f(0.10, 0.04, 0.0) * beat * smoothstep(0.7, 0.0, length(p));` },
  { id: 'berkshire', name: 'Berkshire Hathaway', line: 'Holding · Omaha', body: `
    /* patience as motion: a price line that only ever climbs, redrawn from
       the left every minute, on a navy ground the colour of a ledger */
    var col = vec3f(0.06, 0.10, 0.22);
    let grid = step(0.97, fract(p.x * 8.0)) + step(0.97, fract(p.y * 8.0)); col += vec3f(0.06) * grid;
    let T = fract(t * 0.016); let x = uv.x; var y = -0.32;
    for (var i = 0; i < 30; i++) { let fi = f32(i); let step_ = fi / 30.0; if (step_ < x) { y += 0.02 * (0.5 + hash(vec2f(fi, 3.0))) * 1.3 - 0.01 * hash(vec2f(fi, 7.0)); } }
    let reveal = smoothstep(0.0, 0.01, T - x);
    let d = abs(p.y - y); col = mix(col, vec3f(0.85, 0.75, 0.45), aa(d - 0.006, 0.008) * reveal);
    col += vec3f(0.85, 0.75, 0.45) * 0.25 * smoothstep(0.0, 0.5, y - p.y) * step(p.y, y) * reveal * 0.5;
    let hand = exp(-length(p - m) * 6.0) * r.ptrOn; col += vec3f(0.85, 0.75, 0.45) * hand * 0.25;` },
  { id: 'cvs', name: 'CVS Health', line: 'Pharmacy · Woonsocket', body: `
    /* a heart that breathes at resting pulse; a field of red pills that lean
       toward the hand like it is the counter */
    var col = vec3f(0.99, 0.97, 0.97);
    let beat = pow(0.5 + 0.5 * sin(t * 1.9), 3.0); let s = 1.0 + 0.08 * beat; var q = p / (0.22 * s); q.y += 0.45; q.y -= 0.0;
    let a = q.x * q.x + q.y * q.y - 1.0; let heart = a * a * a - q.x * q.x * q.y * q.y * q.y;
    let hd = smoothstep(0.02, -0.02, heart); col = mix(col, vec3f(0.80, 0.0, 0.05), hd * 0.95); col -= vec3f(0.0, 0.12, 0.12) * exp(-length(p) * 3.0) * beat * 0.3;
    let cell = floor(p * 9.0); let g = fract(p * 9.0) - 0.5; let toward = normalize(m - (cell + 0.5) / 9.0 + 1e-4) * 0.2 * r.ptrOn; let pill = length(max(abs(g - toward) - vec2f(0.12, 0.05), vec2f(0.0))) - 0.05;
    col = mix(col, vec3f(0.80, 0.0, 0.05), aa(pill, 0.02) * 0.35 * step(0.25, length(p)) * step(0.55, hash(cell)));` },
  { id: 'exxon', name: 'ExxonMobil', line: 'Energy · Spring, Texas', body: `
    /* refraction through something viscous: two hues of a slow fluid,
       lit from above, and the hand stirs it */
    let w = fbm(p * 2.5 + vec2f(t * 0.05, -t * 0.03)) + 0.35 * fbm(p * 6.0 - vec2f(0.0, t * 0.08)); let stir = exp(-length(p - m) * 4.0) * r.ptrOn;
    let h = w + stir * 0.6; let n = normalize(vec3f(dpdx(h) * 40.0, dpdy(h) * 40.0, 1.0));
    var col = mix(vec3f(0.85, 0.05, 0.10), vec3f(0.05, 0.20, 0.60), smoothstep(0.35, 0.65, h));
    col *= 0.6 + 0.6 * max(dot(n, normalize(vec3f(0.3, 0.6, 0.7))), 0.0); col += vec3f(1.0) * pow(max(dot(reflect(vec3f(0.0, 0.0, -1.0), n), normalize(vec3f(0.3, 0.6, 0.7))), 0.0), 40.0) * 0.5;` },
  { id: 'alphabet', name: 'Alphabet', line: 'Search · Mountain View', body: `
    /* four colours that keep sorting themselves: dots orbit, swap places on
       the beat, and settle into a row; the hand scatters them */
    var col = vec3f(0.99);
    let cols = array<vec3f, 4>(vec3f(0.26, 0.52, 0.96), vec3f(0.92, 0.26, 0.21), vec3f(0.98, 0.74, 0.02), vec3f(0.20, 0.66, 0.33));
    let beat = fract(t * 0.25); let settle = smoothstep(0.5, 0.9, beat);
    for (var i = 0; i < 4; i++) { let fi = f32(i); let ang = t * 1.2 + fi * 1.5708; let orbit = vec2f(cos(ang), sin(ang)) * 0.22; let row = vec2f(-0.33 + fi * 0.22, 0.0); var c = mix(orbit, row, settle); let away = c - m; c += normalize(away + 1e-4) * exp(-length(away) * 4.0) * 0.2 * r.ptrOn;
      let d = length(p - c) - 0.055; col = mix(col, cols[i], aa(d, 0.006)); col = mix(col, cols[i], aa(d - 0.03, 0.06) * 0.2); }` },
];

export function markCards() {
  return MARKS.map((mk) => {
    const el = $('mk-' + mk.id), stage = $('mk-' + mk.id + '-stage'), canvas = $('mk-' + mk.id + '-canvas'); let s = null, ptr = [-9, -9], on = 0;
    pointer(stage, (p) => { ptr = [p.x, p.y]; on = 1; }, () => { on = 0; });
    return card({ name: 'mark-' + mk.id, el, init() {
      const { ctx, fit } = attach(canvas), ru = uniform(32), pipe = render(HEAD + mk.body + TAIL), g = bind(pipe, [ru]);
      s = { ctx, fit, ru, pipe, g };
    }, frame(t, dt, now) {
      if (!s) return; s.fit(); const dev = this.__dev;
      dev.queue.writeBuffer(s.ru, 0, new Float32Array([canvas.width, canvas.height, now / 1000, canvas.width / canvas.height, ptr[0], ptr[1], on, 0]));
      const enc = dev.createCommandEncoder(); const rp = enc.beginRenderPass({ colorAttachments: [{ view: s.ctx.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store' }] });
      rp.setPipeline(s.pipe); rp.setBindGroup(0, s.g); rp.draw(3); rp.end(); dev.queue.submit([enc.finish()]);
    } });
  });
}
export const MARK_LIST = MARKS;
