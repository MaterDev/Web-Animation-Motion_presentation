/* §6 · HALCYON — a sneaker drop staged inside a fractal. Everything in the
   frame is one ray march: a kaleidoscopic IFS carved into a chamber, a
   frosted plinth, the shoe as a handful of signed-distance primitives; soft
   shadows, ambient occlusion, a reflection bounce, rim light and a
   colourway that recolours the fractal as well as the shoe. The camera has
   its own choreography until a hand takes it. */
import { uniform, render, bind, timer, FSQ_VS } from './common.js';
import { ICONS, MONO } from './ui.js';

const WAYS = [
  { id: 'obsidian', name: 'Obsidian / Brass', upper: [0.05, 0.05, 0.06], sole: [0.86, 0.80, 0.66], acc: [0.95, 0.72, 0.25], a: [0.16, 0.10, 0.06], b: [0.95, 0.72, 0.30], key: [1.0, 0.92, 0.80], rim: [1.0, 0.65, 0.25], fog: [0.02, 0.015, 0.01] },
  { id: 'reef', name: 'Reef / Coral', upper: [0.06, 0.34, 0.36], sole: [0.96, 0.94, 0.90], acc: [1.0, 0.36, 0.30], a: [0.05, 0.22, 0.30], b: [1.0, 0.45, 0.40], key: [0.95, 0.98, 1.0], rim: [1.0, 0.40, 0.35], fog: [0.01, 0.03, 0.04] },
  { id: 'glacier', name: 'Glacier / Ice', upper: [0.92, 0.94, 0.96], sole: [0.70, 0.82, 0.92], acc: [0.30, 0.55, 1.0], a: [0.35, 0.50, 0.70], b: [0.85, 0.95, 1.0], key: [1.0, 1.0, 1.0], rim: [0.45, 0.70, 1.0], fog: [0.03, 0.04, 0.06] },
];

const SHADER = FSQ_VS + `
struct R { camPos: vec3f, time: f32, camF: vec3f, aspect: f32, camR: vec3f, morph: f32, camU: vec3f, beat: f32,
  upper: vec3f, pad0: f32, sole: vec3f, pad1: f32, acc: vec3f, pad2: f32, ca: vec3f, pad3: f32, cb: vec3f, pad4: f32, key: vec3f, pad5: f32, rim: vec3f, pad6: f32, fog: vec3f, pad7: f32 };
@group(0) @binding(0) var<uniform> r: R;
fn rotX(p: vec3f, a: f32) -> vec3f { let c = cos(a); let s = sin(a); return vec3f(p.x, c * p.y - s * p.z, s * p.y + c * p.z); }
fn rotY(p: vec3f, a: f32) -> vec3f { let c = cos(a); let s = sin(a); return vec3f(c * p.x + s * p.z, p.y, -s * p.x + c * p.z); }
fn rotZ(p: vec3f, a: f32) -> vec3f { let c = cos(a); let s = sin(a); return vec3f(c * p.x - s * p.y, s * p.x + c * p.y, p.z); }
fn sdBox(p: vec3f, b: vec3f) -> f32 { let q = abs(p) - b; return length(max(q, vec3f(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0); }
fn sdEll(p: vec3f, e: vec3f) -> f32 { let k0 = length(p / e); let k1 = length(p / (e * e)); return k0 * (k0 - 1.0) / k1; }
fn sdCyl(p: vec3f, h: f32, rad: f32) -> f32 { let d = abs(vec2f(length(p.xz), p.y)) - vec2f(rad, h); return min(max(d.x, d.y), 0.0) + length(max(d, vec2f(0.0))); }
fn sdSeg(p: vec3f, a: vec3f, b: vec3f, rad: f32) -> f32 { let pa = p - a; let ba = b - a; let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - rad; }
fn smin(a: f32, b: f32, k: f32) -> f32 { let h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
fn smax(a: f32, b: f32, k: f32) -> f32 { return -smin(-a, -b, k); }
/* the chamber: a kaleidoscopic IFS, folded and rotated a little more each
   beat, with a sphere carved out of it for the diorama to sit in */
var<private> trap: f32;
fn kifs(p0: vec3f) -> f32 { /* a Menger sponge, each level twisted a little more; the morph turns the twist */
  var p = rotY(p0, 0.4) / 6.5; var d = sdBox(p, vec3f(1.0)); var s = 1.0; trap = 1e9;
  for (var i = 0; i < 4; i++) { let q = rotY(rotX(p * s, r.morph * 0.05 * f32(i)), r.morph * 0.04 * f32(i)); let a = q - 2.0 * floor(q / 2.0) - 1.0; s *= 3.0; let rr = abs(1.0 - 3.0 * abs(a)); trap = min(trap, length(a) * (0.9 - 0.12 * f32(i)));
    let da = max(rr.x, rr.y); let db = max(rr.y, rr.z); let dc = max(rr.z, rr.x); let c = (min(da, min(db, dc)) - 1.0) / s; d = max(d, c); }
  return d * 6.5; }
fn sdTorus(p: vec3f, t: vec2f) -> f32 { let q = vec2f(length(p.xz) - t.x, p.y); return length(q) - t.y; }
fn shoe(q0: vec3f) -> vec2f {
  /* toe toward -x, heel at +x, resting on the plinth top (y = 0.56): a loaf of
     three ellipsoids, a hole for the foot, a padded collar, a tongue, laces */
  let q = q0 - vec3f(0.05, 0.56, 0.0);
  let wide = 0.80 + 0.20 * smoothstep(-0.9, 0.2, q.x);
  let qs = vec3f(q.x, q.y, q.z / wide);
  let sole = sdBox(qs - vec3f(0.0, 0.10, 0.0), vec3f(0.92, 0.06, 0.30)) - 0.08;
  let midsole = sdBox(qs - vec3f(0.05, 0.19, 0.0), vec3f(0.86, 0.02, 0.30)) - 0.05;
  let toe = sdEll(qs - vec3f(-0.60, 0.27, 0.0), vec3f(0.42, 0.17, 0.28));
  let vamp = sdEll(qs - vec3f(-0.08, 0.32, 0.0), vec3f(0.52, 0.24, 0.31));
  let heel = sdEll(qs - vec3f(0.56, 0.42, 0.0), vec3f(0.40, 0.36, 0.29));
  var up = smin(smin(toe, vamp, 0.14), heel, 0.14);
  let hole = sdSeg(qs, vec3f(0.46, 0.46, 0.0), vec3f(0.46, 1.4, 0.0), 0.21); up = smax(up, -hole, 0.03);
  var collar = sdTorus(qs - vec3f(0.46, 0.70, 0.0), vec2f(0.22, 0.05));
  let tongue = sdBox(rotZ(qs - vec3f(0.06, 0.62, 0.0), -0.5), vec3f(0.20, 0.02, 0.10)) - 0.03;
  var body = smin(up, collar, 0.05); body = smin(body, tongue, 0.04);
  var laces = 1e9; for (var i = 0; i < 4; i++) { let x = -0.34 + f32(i) * 0.14; let y = 0.50 + f32(i) * 0.035 + 0.24 * sqrt(max(0.0, 1.0 - pow((x + 0.08) / 0.52, 2.0))) * 0.98 - 0.18; laces = min(laces, sdSeg(qs, vec3f(x, y, -0.12), vec3f(x + 0.03, y, 0.12), 0.016)); }
  let band = abs(qs.y - 0.30 - 0.07 * sin(qs.x * 2.6 + 0.4)) - 0.04;
  var m = 4.0; var d = body; if (band < 0.0 && abs(qs.z) > 0.17 && qs.x > -0.66 && qs.x < 0.70) { m = 5.0; }
  if (qs.x < -0.72 && qs.y < 0.36) { m = 5.0; } /* toe cap */
  if (laces < d) { d = laces; m = 3.0; }
  if (midsole < d) { d = midsole; m = 5.0; }
  if (sole < d) { d = sole; m = 3.0; }
  return vec2f(d * min(wide, 1.0), m); }
fn map(p: vec3f) -> vec2f {
  let plinth = sdCyl(p - vec3f(0.0, 0.25, 0.0), 0.25, 1.30) - 0.06;
  let sh = shoe(p);
  let cave = max(kifs(p), 4.4 - length(p * vec3f(1.0, 0.75, 1.0)));
  var d = plinth; var m = 2.0; if (sh.x < d) { d = sh.x; m = sh.y; } if (cave < d) { d = cave; m = 1.0; }
  return vec2f(d, m); }
fn normal(p: vec3f) -> vec3f { let e = vec2f(0.0015, 0.0); return normalize(vec3f(map(p + e.xyy).x - map(p - e.xyy).x, map(p + e.yxy).x - map(p - e.yxy).x, map(p + e.yyx).x - map(p - e.yyx).x)); }
fn march(ro: vec3f, rd: vec3f, steps: i32) -> vec2f { var t = 0.02; var m = 0.0; for (var i = 0; i < steps; i++) { let h = map(ro + rd * t); m = h.y; if (h.x < 0.0008 * t + 0.0004) { return vec2f(t, m); } t += h.x * 0.85; if (t > 16.0) { break; } } return vec2f(-1.0, 0.0); }
fn shadow(ro: vec3f, rd: vec3f, k: f32) -> f32 { var s = 1.0; var t = 0.02; for (var i = 0; i < 36; i++) { let h = map(ro + rd * t).x; s = min(s, k * h / t); if (s < 0.005) { return 0.0; } t += clamp(h, 0.01, 0.25); if (t > 6.0) { break; } } return clamp(s, 0.0, 1.0); }
fn ao(p: vec3f, n: vec3f) -> f32 { var occ = 0.0; var sca = 1.0; for (var i = 0; i < 5; i++) { let h = 0.02 + 0.12 * f32(i); let d = map(p + n * h).x; occ += (h - d) * sca; sca *= 0.7; } return clamp(1.0 - 2.2 * occ, 0.0, 1.0); }
fn palette(t: f32) -> vec3f { return mix(r.ca, r.cb, smoothstep(0.0, 1.0, t)); }
fn shade(p: vec3f, n: vec3f, rd: vec3f, m: f32, tr: f32) -> vec3f {
  var alb: vec3f; var rough = 0.5; var spec = 0.04;
  if (m < 1.5) { alb = palette(clamp(tr * 1.4, 0.0, 1.0)) * 0.9; rough = 0.35; spec = 0.08; }
  else if (m < 2.5) { alb = vec3f(0.92, 0.92, 0.94); rough = 0.12; spec = 0.10; }
  else if (m < 3.5) { alb = r.sole; rough = 0.55; spec = 0.03; }
  else if (m < 4.5) { alb = r.upper; rough = 0.45; spec = 0.05; }
  else { alb = r.acc; rough = 0.30; spec = 0.08; }
  alb = alb * alb; /* display → linear */
  let key = normalize(vec3f(-0.6, 1.4, 0.9)); let rimL = normalize(vec3f(1.2, 0.5, -1.0));
  let sh = shadow(p + n * 0.01, key, 10.0); let occ = ao(p, n);
  let nd = max(dot(n, key), 0.0); let hv = normalize(key - rd); let ph = pow(max(dot(n, hv), 0.0), mix(160.0, 8.0, rough)) * (1.0 - rough) * 2.0;
  let fr = pow(1.0 - max(dot(n, -rd), 0.0), 5.0);
  let rimd = pow(max(dot(n, rimL), 0.0), 3.0) * (0.4 + 0.6 * fr);
  var col = alb * (r.key * r.key * nd * sh * 2.2 + palette(0.5) * palette(0.5) * 0.25 * occ + vec3f(0.06) * occ);
  col += r.key * r.key * ph * sh * (spec * 6.0 + fr) + r.rim * r.rim * rimd * 0.9 * occ;
  return col; }
@fragment fn fs(o: VO) -> @location(0) vec4f {
  let ndc = vec2f(o.uv.x * 2.0 - 1.0, 1.0 - o.uv.y * 2.0); let tf = tan(0.5 * 0.62);
  let rd = normalize(r.camF + r.camR * ndc.x * tf * r.aspect + r.camU * ndc.y * tf); let ro = r.camPos;
  let h = march(ro, rd, 140); var col = r.fog * r.fog; var dist = 14.0;
  if (h.x > 0.0) { dist = h.x; let p = ro + rd * h.x; let tr = trap; let n = normal(p); col = shade(p, n, rd, h.y, tr);
    /* the plinth is glass-smooth: one bounce shows the shoe and the chamber in it */
    if (h.y > 1.5 && h.y < 2.5) { let rr = reflect(rd, n); let h2 = march(p + n * 0.01, rr, 70); if (h2.x > 0.0) { let p2 = p + n * 0.01 + rr * h2.x; let tr2 = trap; let n2 = normal(p2); let c2 = shade(p2, n2, rr, h2.y, tr2); let fr = 0.04 + 0.96 * pow(1.0 - max(dot(n, -rd), 0.0), 5.0); col = mix(col, c2, 0.25 + 0.6 * fr); } }
    /* the shoe and sole pick up the chamber's colour from below */
    if (h.y > 2.5) { let rr = reflect(rd, n); let h2 = march(p + n * 0.01, rr, 40); if (h2.x > 0.0) { let tr2 = trap; let fr = pow(1.0 - max(dot(n, -rd), 0.0), 4.0); col += palette(clamp(tr2 * 1.4, 0.0, 1.0)) * 0.25 * (0.15 + fr); } }
  }
  /* a little haze in the chamber, and the glow of the beat */
  let fa = 1.0 - exp(-dist * 0.09); col = mix(col, r.fog * r.fog * 3.0 + r.rim * r.rim * 0.02 * r.beat, fa);
  col = col / (1.0 + col * 0.6) * 1.35;
  col = pow(max(col, vec3f(0.0)), vec3f(1.0 / 2.2));
  let vig = 1.0 - 0.3 * dot(ndc * vec2f(0.75, 1.0), ndc * vec2f(0.75, 1.0));
  return vec4f(col * vig, 1.0);
}`;

const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const lerp = (a, b, t) => a + (b - a) * t, ease = (t) => t * t * (3 - 2 * t);

export function halcyonApp() {
  let dev = null, ui = null, s = null, way = 0, wayT = 1, prevWay = 0, drag = null, yaw = 0.6, pitch = 0.32, lastTouch = 0, sizeIx = 3, notified = 0, hover = null;
  const SIZES = ['6', '7', '8', '9', '10', '11', '12'];
  const C = { ink: [0.96, 0.94, 0.90, 1], dim: [0.66, 0.62, 0.55, 1], glass: [0.06, 0.05, 0.04, 0.55], cell: [1, 1, 1, 0.08], cellHi: [1, 1, 1, 0.16] };
  const PX = 560, PW = 268; /* the product panel, on the right leaf, clear of the Dock */
  const draw = (now, rd) => { const T = now / 1000; const wy = WAYS[way], acc = [...wy.acc, 1];
    ui.text(24, 22, 'HALCYON', 14, C.ink, { weight: 800, track: 0.34 }); ui.text(24, 42, 'drop 07 · 14 Sept · 09:00 BST', 10.5, C.dim);
    ui.text(24, 598, 'DRAG TO ORBIT · IT FILMS ITSELF WHEN YOU LET GO', 9, C.dim, { weight: 600, track: 0.14, op: 0.8 });
    ui.glass(PX, 60, PW, 506, C.glass, 24, 0.14);
    let y = 84; ui.text(PX + 22, y, 'KESTREL 07 · LIMITED', 9.5, C.dim, { weight: 600, track: 0.16 }); y += 20;
    ui.text(PX + 22, y, 'Kestrel 07', 26, C.ink, { weight: 800, track: -0.02 }); y += 34; ui.text(PX + 22, y, wy.name, 13, C.dim, { weight: 500 }); y += 30;
    ui.text(PX + 22, y, '£165', 20, C.ink, { weight: 700 }); ui.text(PX + 82, y + 7, 'free returns · 30 days', 10, C.dim); y += 40;
    ui.text(PX + 22, y, 'COLOURWAY', 9.5, C.dim, { weight: 600, track: 0.16 }); y += 20;
    WAYS.forEach((w, i) => { const cx = PX + 36 + i * 38; ui.grad(cx - 13, y, 26, 26, [...w.a, 1], [...w.b, 1], 13, true); if (i === way) ui.ring(cx, y + 13, 16, C.ink, 1.5); ui.hit('way' + i, cx - 16, y - 3, 32, 32); }); y += 46;
    ui.text(PX + 22, y, 'SIZE · UK', 9.5, C.dim, { weight: 600, track: 0.16 }); y += 20;
    SIZES.forEach((sz, i) => { const x = PX + 22 + (i % 4) * 58, yy = y + Math.floor(i / 4) * 34; const on = i === sizeIx; ui.rect(x, yy, 50, 28, on ? acc : hover === 'size' + i ? C.cellHi : C.cell, 14); ui.text(x + 25, yy + 7, sz, 12, on ? [0.05, 0.05, 0.05, 1] : C.ink, { align: 'center', weight: 600, family: MONO }); ui.hit('size' + i, x, yy, 50, 28); }); y += 82;
    const hot = hover === 'cta'; const on = now < notified; ui.rect(PX + 22, y, PW - 44, 44, on ? [0.25, 0.65, 0.40, 1] : hot ? [1, 1, 1, 0.22] : [1, 1, 1, 0.14], 22); ui.icon(on ? 'ctacheck' : 'ctabell', PX + 22 + 18, y + 13, 18, C.ink, on ? ICONS.check : ICONS.spark);
    ui.text(PX + 22 + 44, y + 13, on ? "You're on the list" : `Notify me · UK ${SIZES[sizeIx]}`, 13.5, C.ink, { weight: 600 }); ui.hit('cta', PX + 22, y, PW - 44, 44); y += 62;
    ui.rect(PX + 22, y, PW - 44, 1, [1, 1, 1, 0.1]); y += 10; ui.text(PX + 22, y, 'ONE PASS · MARCH', 8.5, C.dim, { weight: 600, track: 0.14, family: MONO }); ui.text(PX + PW - 22, y, rd, 9.5, C.ink, { align: 'right', family: MONO });
    ui.text(PX + 22, y + 16, 'kaleidoscopic IFS chamber · SDF shoe · soft shadow · AO · one bounce', 8.5, C.dim, { family: MONO }); };
  const act = (id) => { if (!id) return; if (id.startsWith('way')) { const i = +id.slice(3); if (i !== way) { prevWay = way; way = i; wayT = 0; lastTouch = performance.now(); } } if (id.startsWith('size')) sizeIx = +id.slice(4); if (id === 'cta') notified = performance.now() + 3000; };
  return { cursor: 'grab', init(d, host) { dev = d; ui = host.ui; const ru = uniform(192), pipe = render(SHADER), g = bind(pipe, [ru]), tm = timer(['march'], 4); s = { ru, pipe, g, tm, rd: '—' }; lastTouch = performance.now(); },
    down(p, id) { if (!id) { drag = { x: p.x, y: p.y, yaw, pitch }; lastTouch = performance.now(); } },
    move(p, hov) { hover = hov; if (drag) { yaw = drag.yaw + (p.x - drag.x) / 890 * 4.0; pitch = Math.max(0.05, Math.min(1.1, drag.pitch - (p.y - drag.y) / 626 * 2.5)); lastTouch = performance.now(); } },
    up(p, id, same) { drag = null; if (same) act(id); }, leave() { drag = null; hover = null; },
    destroy() { s.ru.destroy(); s = null; },
    frame(t, dt, now, hov) { if (!s) return; const T = now / 1000; hover = hov; const tgt = ui.prepare(0.6);
      const idle = (now - lastTouch) / 1000, beat = (T % 8) / 8, phase = Math.floor(T / 8) % 3;
      if (idle > 3 && !drag) { const target = [[0.6 + T * 0.08, 0.32], [-1.2 + Math.sin(T * 0.15) * 0.4, 0.62], [2.4 + T * 0.05, 0.14]][phase]; yaw = lerp(yaw, target[0], 1 - Math.pow(0.02, dt)); pitch = lerp(pitch, target[1], 1 - Math.pow(0.05, dt)); }
      const morph = 0.5 + 0.5 * Math.sin(T * 0.11) + 0.15 * ease(Math.min(1, beat * 3));
      const dist = 3.3 - 0.4 * Math.sin(T * 0.07), pos = [Math.cos(yaw) * Math.cos(pitch) * dist, 0.5 + Math.sin(pitch) * dist, Math.sin(yaw) * Math.cos(pitch) * dist], tgt0 = [0, 0.7, 0];
      const F0 = norm([tgt0[0] - pos[0], tgt0[1] - pos[1], tgt0[2] - pos[2]]), Rt0 = norm(cross(F0, [0, 1, 0]));
      /* the shoe sits left of centre so the panel has the right leaf */
      const tg = [tgt0[0] + Rt0[0] * 0.8, tgt0[1], tgt0[2] + Rt0[2] * 0.8]; const F = norm([tg[0] - pos[0], tg[1] - pos[1], tg[2] - pos[2]]), Rt = norm(cross(F, [0, 1, 0])), Up = cross(Rt, F);
      if (wayT < 1) wayT = Math.min(1, wayT + dt / 1.4); const k = ease(wayT), A = WAYS[prevWay], B = WAYS[way];
      const mix3 = (key) => [0, 1, 2].map((i) => lerp(A[key][i], B[key][i], k));
      const RB = new ArrayBuffer(192), Rf = new Float32Array(RB);
      Rf.set(pos, 0); Rf[3] = T; Rf.set(F, 4); Rf[7] = tgt.w / tgt.h; Rf.set(Rt, 8); Rf[11] = morph; Rf.set(Up, 12); Rf[15] = 1 - Math.pow(beat, 0.5);
      ['upper', 'sole', 'acc', 'a', 'b', 'key', 'rim', 'fog'].forEach((key, i) => Rf.set(mix3(key), 16 + i * 4));
      dev.queue.writeBuffer(s.ru, 0, RB);
      const enc = dev.createCommandEncoder(); const rp = enc.beginRenderPass({ colorAttachments: [{ view: tgt.view, loadOp: 'clear', storeOp: 'store' }], ...s.tm.begin(0) });
      rp.setPipeline(s.pipe); rp.setBindGroup(0, s.g); rp.draw(3); rp.end(); s.tm.resolve(enc);
      const rd = s.tm.read(); if (rd.march !== undefined) s.rd = rd.march.toFixed(2) + ' ms · ' + tgt.w + ' × ' + tgt.h;
      draw(now, s.rd); ui.compose(enc); dev.queue.submit([enc.finish()]); } };
}
