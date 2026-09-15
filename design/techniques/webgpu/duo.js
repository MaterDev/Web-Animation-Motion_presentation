/* §7 · the iPhone Duo as a model, not a photograph — but lit like one. A
   product shot on white: the device as signed-distance geometry, sphere
   traced, with the materials Apple describes — a mirror-polished grade 5
   titanium frame, a 3-D-printed hinge cover in a contrasting micro-blasted
   finish, Ceramic Shield glass front and back, a nano-texture matte inner
   display that hides the crease, a glossy outer display — under a white
   softbox with a soft contact shadow and the floor's reflection. The screens
   are emissive and show iOS 27 the way Apple lays it out on this device: the
   Dock down the right edge, a full-height photo widget on the left leaf,
   widgets and a 4 × 4 grid on the right, the radios in a frosted disc under
   the time, an under-display camera the panel nearly hides. It opens and closes on its
   own; drag orbits; the slider takes the hinge.
   Dimensions in SPECS, each labelled verified / derived / constructed. */
import { uniform, render, bind, timer, FSQ_VS } from './common.js';
import { MONO } from './ui.js';

/* centimetres. Apple: open 164.6 × 117.8 × 5.2 mm, closed 84.1 × 117.8 × 11.3 mm; inner 1878 × 2670 @ 430 ppi → 110.93 × 157.72 mm,
   so the open bezel is 3.44 mm all round; outer 1398 × 2034 @ 460 ppi → 3.46 mm sides, 2.75 mm ends. The hinge axis sits (11.3 − 5.2) / 2 = 3.05 mm in front of each leaf's centre plane. No radius or crease width is published. */
export const SPECS = {
  leafW: { v: 8.23, src: 'verified' }, leafH: { v: 11.78, src: 'verified' }, leafT: { v: 0.52, src: 'verified' }, closedT: { v: 1.13, src: 'verified' },
  bezel: { v: 0.344, src: 'derived' }, outerBezelSide: { v: 0.346, src: 'derived' }, outerBezelEnd: { v: 0.275, src: 'derived' },
  cornerR: { v: 1.05, src: 'constructed' }, hingeAxis: { v: 0.305, src: 'derived' },
};
const COLOURWAYS = { 'night-sky': { frame: [0.30, 0.33, 0.40], back: [0.08, 0.10, 0.16], hinge: [0.34, 0.36, 0.42] }, 'star-white': { frame: [0.92, 0.91, 0.89], back: [0.93, 0.92, 0.89], hinge: [0.76, 0.75, 0.72] } };

const SHADER = FSQ_VS + `
struct R { camPos: vec3f, time: f32, camF: vec3f, aspect: f32, camR: vec3f, fold: f32, camU: vec3f, beat: f32,
  dims: vec4f, misc: vec4f, frame: vec4f, back: vec4f, hingeC: vec4f, cards: array<vec4f, 8> };
@group(0) @binding(0) var<uniform> r: R;
fn rotY(p: vec3f, a: f32) -> vec3f { let c = cos(a); let s = sin(a); return vec3f(c * p.x + s * p.z, p.y, -s * p.x + c * p.z); }
fn sdRBox(p: vec3f, b: vec3f, rad: f32) -> f32 { let q = abs(p) - b + rad; return length(max(q, vec3f(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0) - rad; }
fn sdBox2(p: vec2f, b: vec2f, rad: f32) -> f32 { let q = abs(p) - b + rad; return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - rad; }
fn sdSeg(p: vec2f, a: vec2f, b: vec2f) -> f32 { let pa = p - a; let ba = b - a; let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
fn hash(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }
fn vn(p: vec2f) -> f32 { let i = floor(p); var f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2f(1, 0)), f.x), mix(hash(i + vec2f(0, 1)), hash(i + vec2f(1, 1)), f.x), f.y); }
fn fillA(d: f32) -> f32 { return 1.0 - smoothstep(-0.7, 0.7, d); }
/* materials: 1 frame (polished titanium) · 2 inner display (matte glass) · 3 back glass · 4 camera lens · 5 hinge cover (micro-blasted) · 6 floor · 7 outer display (glossy glass) · 8 button */
fn leaf(p: vec3f, hasOuter: bool) -> vec2f { let W = r.dims.x; let H = r.dims.y; let T = r.dims.z; let cr = r.dims.w; let bz = r.misc.x;
  /* a rounded slab: big radii outboard, small at the hinge, and a fillet round the edge that the polish rolls over */
  let q = p.xy - vec2f(W * 0.5, 0.0); let rad = select(cr, 0.14, p.x < W * 0.5); let d2 = sdBox2(q, vec2f(W * 0.5, H * 0.5), rad);
  let e = 0.20; let w = vec2f(d2 + e, abs(p.z) - T * 0.5 + e); let body = min(max(w.x, w.y), 0.0) + length(max(w, vec2f(0.0))) - e;
  var m = 1.0; var d = body;
  /* the inner display runs to the hinge with no bezel: the panel is continuous across the crease */
  let sc = max(sdBox2(p.xy - vec2f(W * 0.5, 0.0), vec2f(W * 0.5 - bz * 0.5, H * 0.5 - bz), max(cr - bz, 0.0)) - bz * 0.5, -p.x); if (sc < 0.0 && p.z > T * 0.5 - 0.05) { m = 2.0; }
  let bk = sdBox2(q, vec2f(W * 0.5 - 0.09, H * 0.5 - 0.09), rad - 0.08); if (bk < 0.0 && p.z < -T * 0.5 + 0.05) { m = 3.0; }
  if (hasOuter) { let so = sdBox2(q, vec2f(W * 0.5 - r.misc.w, H * 0.5 - r.misc.z), max(cr - r.misc.w, 0.1)); if (so < 0.0 && p.z < -T * 0.5 + 0.05) { m = 7.0; }
    /* the side button with Touch ID on the outboard edge */
    let sb = sdRBox(p - vec3f(W + 0.03, H * 0.5 - 3.9, 0.0), vec3f(0.06, 0.62, 0.11), 0.05); if (sb < d) { d = sb; m = 8.0; } }
  else { /* the camera plateau: a horizontal pill in the top outboard corner of the back, two lenses side by side, a flash toward the hinge */
    let pc = vec2f(W - 3.30, H * 0.5 - 1.65); let plateau = sdRBox(vec3f(p.x - pc.x, p.y - pc.y, p.z + T * 0.5), vec3f(2.85, 1.22, 0.10), 1.10); if (plateau < d) { d = plateau; m = 3.0; }
    for (var k = 0; k < 2; k++) { let lc = vec3f(W - 1.55 - f32(k) * 1.71, pc.y, -T * 0.5 - 0.10); let rq = vec2f(max(length((p - lc).xy) - 0.66, 0.0), max(abs(p.z - lc.z) - 0.02, 0.0)); let lens = length(rq) - 0.14; if (lens < d) { d = lens; m = select(4.0, 1.0, length(p.xy - lc.xy) > 0.58); } }
    let fl = length(vec3f((p.xy - vec2f(W - 4.95, pc.y + 0.30)), (p.z + T * 0.5 + 0.10) * 2.0)) - 0.16; if (fl < d) { d = fl; m = 4.0; }
    /* the action button and the volume rocker on the outboard edge */
    let ab = sdRBox(p - vec3f(W + 0.03, H * 0.5 - 1.35, 0.0), vec3f(0.06, 0.22, 0.10), 0.05); if (ab < d) { d = ab; m = 8.0; }
    let vb = sdRBox(p - vec3f(W + 0.03, H * 0.5 - 2.95, 0.0), vec3f(0.06, 0.92, 0.10), 0.05); if (vb < d) { d = vb; m = 8.0; } }
  return vec2f(d, m); }
fn map(p: vec3f) -> vec2f {
  /* leaf B carries the outer display; leaf A is mirrored across the hinge and folded toward +z; the hinge cover sits between them */
  let hz = r.misc.y; let rel = p - vec3f(0.0, 0.0, hz); let loc = rotY(rel, -r.fold); let pa = loc + vec3f(0.0, 0.0, hz);
  let a = leaf(p, true); let b = leaf(vec3f(-pa.x, pa.y, pa.z), false);
  /* the spine: a slab in the bisector frame, kept to the wedge outside both hinge edges — flush when open, the flat side of the D when closed */
  let bis = rotY(rel, -r.fold * 0.5); let slab = sdRBox(bis - vec3f(0.0, 0.0, -0.10), vec3f(hz + r.dims.z * 0.5, r.dims.y * 0.5 - 0.14, 0.10), 0.10); let hinge = max(slab, max(p.x, -loc.x) + 0.01);
  var d = a.x; var m = a.y; if (b.x < d) { d = b.x; m = b.y; } if (hinge < d) { d = hinge; m = 5.0; }
  let floor = p.y + r.dims.y * 0.5 + 0.11; if (floor < d) { d = floor; m = 6.0; }
  return vec2f(d, m); }
fn nrm(p: vec3f) -> vec3f { let e = vec2f(0.003, 0.0); return normalize(vec3f(map(p + e.xyy).x - map(p - e.xyy).x, map(p + e.yxy).x - map(p - e.yxy).x, map(p + e.yyx).x - map(p - e.yyx).x)); }
fn march(ro: vec3f, rd: vec3f, steps: i32) -> vec2f { var t = 0.02; var m = 0.0; for (var i = 0; i < steps; i++) { let h = map(ro + rd * t); m = h.y; if (h.x < 0.0015 * t + 0.0008) { return vec2f(t, m); } t += h.x * 0.9; if (t > 120.0) { break; } } return vec2f(-1.0, 0.0); }
fn shadow(ro: vec3f, rd: vec3f) -> f32 { var s = 1.0; var t = 0.05; for (var i = 0; i < 40; i++) { let h = map(ro + rd * t).x; s = min(s, 6.0 * h / t); if (s < 0.01) { return 0.0; } t += clamp(h, 0.03, 1.0); if (t > 40.0) { break; } } return clamp(s, 0.0, 1.0); }
fn ao(p: vec3f, n: vec3f) -> f32 { var occ = 0.0; var sca = 1.0; for (var i = 0; i < 5; i++) { let h = 0.03 + 0.3 * f32(i); occ += (h - map(p + n * h).x) * sca; sca *= 0.7; } return clamp(1.0 - 1.2 * occ, 0.0, 1.0); }
/* the studio a polished edge sees: a white ceiling of softboxes, a dark horizon band, white paper below — what makes chrome read as chrome */
fn env(d: vec3f) -> vec3f { let up = clamp(d.y, -1.0, 1.0); var c = vec3f(mix(0.90, 0.97, smoothstep(0.1, 0.8, up)));
  c = mix(c, vec3f(0.22, 0.23, 0.26), smoothstep(0.35, 0.12, up) * smoothstep(-0.30, -0.08, up)); c = mix(c, vec3f(0.86, 0.86, 0.85), smoothstep(-0.25, -0.6, up));
  let sb = step(abs(d.x + 0.45), 0.35) * step(abs(d.y - 0.72), 0.2) * step(0.0, d.z + 0.6); c += vec3f(1.0) * sb * 0.8; let strip = step(abs(d.x - 0.85), 0.07) * step(abs(d.y - 0.05), 0.55); c += vec3f(0.97, 0.98, 1.0) * strip * 0.8; return c; }
/* the wallpaper Apple ships on it: a blue sky, a mountain ridge, dunes */
fn wallpaper(u: vec2f, ar: f32) -> vec3f { var c = mix(vec3f(0.86, 0.89, 0.93), vec3f(0.44, 0.63, 0.87), smoothstep(0.46, 1.0, u.y)); c = mix(c, vec3f(0.93, 0.86, 0.74), smoothstep(0.64, 0.46, u.y) * 0.8); let x = u.x * ar;
  let m1 = 0.50 + 0.05 * vn(vec2f(x * 4.0 + 3.0, 0.5)) + 0.025 * vn(vec2f(x * 13.0, 1.5)) + 0.012 * vn(vec2f(x * 40.0, 2.5)); c = mix(c, mix(vec3f(0.52, 0.45, 0.42), vec3f(0.74, 0.66, 0.60), smoothstep(0.0, 0.10, m1 - u.y)), smoothstep(0.003, -0.003, u.y - m1));
  let m2 = 0.455 + 0.06 * vn(vec2f(x * 3.0 + 11.0, 5.5)) + 0.03 * vn(vec2f(x * 9.0 + 2.0, 6.5)) + 0.012 * vn(vec2f(x * 30.0, 7.5)); let lit = smoothstep(-0.02, 0.02, vn(vec2f(x * 9.0 + 2.0, 6.5)) - vn(vec2f(x * 9.0 + 2.1, 6.5))); c = mix(c, mix(vec3f(0.30, 0.25, 0.23), vec3f(0.50, 0.42, 0.37), lit) + 0.06 * vn(vec2f(x * 25.0, u.y * 40.0)) + vec3f(0.12, 0.10, 0.09) * smoothstep(0.0, 0.12, m2 - u.y), smoothstep(0.003, -0.003, u.y - m2));
  let d1 = 0.40 + 0.06 * sin(x * 3.1 + 0.8) + 0.035 * vn(vec2f(x * 2.5 + 1.0, 9.5)); let s1 = mix(vec3f(0.74, 0.66, 0.54), vec3f(0.90, 0.84, 0.72), smoothstep(-1.0, 1.0, cos(x * 3.1 + 0.8))); c = mix(c, s1 + 0.03 * vn(vec2f(x * 90.0, u.y * 60.0)), smoothstep(0.003, -0.003, u.y - d1));
  let d2 = 0.22 + 0.10 * sin(x * 2.2 - 1.4) + 0.03 * vn(vec2f(x * 3.0 + 4.0, 12.5)); let s2 = mix(vec3f(0.70, 0.62, 0.50), vec3f(0.93, 0.87, 0.75), smoothstep(-1.0, 1.0, -cos(x * 2.2 - 1.4))); c = mix(c, s2 + 0.03 * vn(vec2f(x * 120.0 + u.y * 30.0, u.y * 80.0)), smoothstep(0.003, -0.003, u.y - d2));
  return c; }
/* 9:41 as strokes, the tall condensed cut of the Lock Screen: height h, origin bottom-left, 1.62 h wide */
fn sd941(p: vec2f, h: f32) -> f32 { let s = 0.105 * h; var d = abs(length(p - vec2f(0.25 * h, 0.76 * h)) - 0.19 * h) - s;
  d = min(d, sdSeg(p, vec2f(0.44 * h, 0.76 * h), vec2f(0.40 * h, s)) - s); d = min(d, length(p - vec2f(0.67 * h, 0.30 * h)) - s * 1.05); d = min(d, length(p - vec2f(0.67 * h, 0.66 * h)) - s * 1.05);
  d = min(d, sdSeg(p, vec2f(1.17 * h, h - s), vec2f(0.86 * h, 0.36 * h)) - s); d = min(d, sdSeg(p, vec2f(0.86 * h, 0.36 * h), vec2f(1.30 * h, 0.36 * h)) - s); d = min(d, sdSeg(p, vec2f(1.17 * h, h - s), vec2f(1.17 * h, s)) - s);
  d = min(d, sdSeg(p, vec2f(1.53 * h, h - s), vec2f(1.53 * h, s)) - s); d = min(d, sdSeg(p, vec2f(1.53 * h, h - s), vec2f(1.40 * h, 0.82 * h)) - s); return d; }
/* seven-segment digits with rounded strokes, for the widgets */
fn sdDigit(p: vec2f, h: f32, m: u32) -> f32 { let w = 0.56 * h; let s = 0.10 * h; var d = 1e5;
  if ((m & 1u) != 0u) { d = min(d, sdSeg(p, vec2f(s, h - s), vec2f(w - s, h - s))); } if ((m & 2u) != 0u) { d = min(d, sdSeg(p, vec2f(w - s, h - s), vec2f(w - s, 0.5 * h))); }
  if ((m & 4u) != 0u) { d = min(d, sdSeg(p, vec2f(w - s, 0.5 * h), vec2f(w - s, s))); } if ((m & 8u) != 0u) { d = min(d, sdSeg(p, vec2f(s, s), vec2f(w - s, s))); }
  if ((m & 16u) != 0u) { d = min(d, sdSeg(p, vec2f(s, 0.5 * h), vec2f(s, s))); } if ((m & 32u) != 0u) { d = min(d, sdSeg(p, vec2f(s, h - s), vec2f(s, 0.5 * h))); }
  if ((m & 64u) != 0u) { d = min(d, sdSeg(p, vec2f(s, 0.5 * h), vec2f(w - s, 0.5 * h))); } return d - s * 0.75; }
/* the status glyph iOS 27 uses on the Duo: a frosted disc carrying the radios */
fn statusDisc(c: vec3f, P: vec2f, ctr: vec2f, dark: bool) -> vec3f { var o = mix(c, select(vec3f(1.0), vec3f(0.12), dark), fillA(length(P - ctr) - 14.5) * select(0.55, 0.5, dark));
  let ink = select(vec3f(1.0), vec3f(1.0), dark); let q = P - ctr; for (var k = 0; k < 3; k++) { let rr = 2.5 + f32(k) * 3.4; let arc = max(abs(length(q - vec2f(0.0, -3.0)) - rr) - 0.9, -(q.y + 3.0) - 0.1 - 1.4 * rr * 0.0); o = mix(o, ink, fillA(max(arc, -q.y - 3.0 + rr * 0.35)) * 0.9); } return o; }
var<private> ICONS = array<vec3f, 16>(vec3f(0.25, 0.80, 0.36), vec3f(0.97, 0.97, 0.97), vec3f(0.96, 0.78, 0.40), vec3f(0.42, 0.42, 0.45), vec3f(0.25, 0.55, 0.95), vec3f(0.98, 0.84, 0.32), vec3f(0.96, 0.96, 0.96), vec3f(0.50, 0.78, 0.45),
  vec3f(0.10, 0.10, 0.11), vec3f(0.94, 0.25, 0.30), vec3f(0.20, 0.55, 0.96), vec3f(0.95, 0.38, 0.32), vec3f(0.97, 0.97, 0.97), vec3f(0.13, 0.13, 0.16), vec3f(0.18, 0.18, 0.22), vec3f(0.56, 0.57, 0.60));
/* the Home Screen, laid out the way Apple shows it on this device: a full-height photo widget on the left leaf; weather and maps, a 4 × 4 grid, the Dock down the right edge, the search button and the page dots on the right leaf */
fn screenInner(uv: vec2f) -> vec3f { let P = vec2f(uv.x * 890.0, uv.y * 626.0); var c = wallpaper(uv, 890.0 / 626.0);
  let pw = sdBox2(P - vec2f(226.0, 316.0), vec2f(160.0, 246.0), 30.0); let pq = (P - vec2f(66.0, 70.0)) / vec2f(320.0, 492.0);
  let fq = (pq - vec2f(0.52, 0.56)) * vec2f(1.0, 1.54); let fr_ = length(fq); let fa = atan2(fq.y, fq.x); var photo = mix(vec3f(0.10, 0.20, 0.12), vec3f(0.25, 0.42, 0.22), smoothstep(0.0, 1.0, pq.y)) + 0.05 * vn(pq * 14.0);
  photo = mix(photo, vec3f(0.55, 0.62, 0.30), exp(-length(fq - vec2f(-0.32, -0.34)) * 4.0) * 0.6);
  let petal = fr_ - 0.33 * (0.78 + 0.22 * cos(fa * 6.0)) * (1.0 + 0.08 * vn(vec2f(fa * 3.0, 1.0))); photo = mix(photo, mix(vec3f(0.95, 0.30, 0.55), vec3f(0.98, 0.82, 0.90), smoothstep(0.32, 0.05, fr_)), 1.0 - smoothstep(-0.006, 0.006, petal));
  let petal2 = fr_ - 0.19 * (0.8 + 0.2 * cos(fa * 6.0 + 3.14)); photo = mix(photo, vec3f(0.99, 0.55, 0.72), (1.0 - smoothstep(-0.006, 0.006, petal2)) * 0.7); photo = mix(photo, vec3f(0.98, 0.85, 0.30), 1.0 - smoothstep(0.045, 0.06, fr_)); photo *= 1.0 - 0.45 * smoothstep(0.28, 0.0, pq.y);
  c = mix(c, photo, fillA(pw)); c = mix(c, vec3f(1.0), fillA(sdBox2(P - vec2f(132.0, 120.0), vec2f(46.0, 6.5), 3.0))); c = mix(c, vec3f(1.0), fillA(sdBox2(P - vec2f(114.0, 102.0), vec2f(28.0, 3.5), 2.0)) * 0.8);
  c = mix(c, vec3f(1.0), fillA(length(P - vec2f(352.0, 112.0)) - 12.0) * 0.85); c = mix(c, vec3f(0.2), fillA(length(P - vec2f(353.0, 112.0)) - 4.0));
  /* weather */
  let w1 = sdBox2(P - vec2f(565.0, 486.0), vec2f(75.0, 75.0), 24.0); let wq = (P - vec2f(490.0, 411.0)) / 150.0; c = mix(c, mix(vec3f(0.20, 0.44, 0.86), vec3f(0.42, 0.66, 0.95), wq.y), fillA(w1));
  let inW = fillA(w1); c = mix(c, vec3f(1.0), fillA(sdBox2(P - vec2f(530.0, 544.0), vec2f(30.0, 4.0), 2.0)) * inW); c = mix(c, vec3f(1.0), fillA(min(sdDigit(P - vec2f(502.0, 480.0), 44.0, 109u), sdDigit(P - vec2f(532.0, 480.0), 44.0, 102u))) * inW); c = mix(c, vec3f(1.0), fillA(abs(length(P - vec2f(566.0, 520.0)) - 3.0) - 1.2) * inW);
  c = mix(c, vec3f(1.0), fillA(sdBox2(P - vec2f(528.0, 445.0), vec2f(28.0, 3.5), 2.0)) * inW * 0.85); c = mix(c, vec3f(1.0), fillA(sdBox2(P - vec2f(524.0, 431.0), vec2f(24.0, 3.0), 2.0)) * inW * 0.6);
  /* maps */
  let w2 = sdBox2(P - vec2f(735.0, 486.0), vec2f(75.0, 75.0), 24.0); let inM = fillA(w2); var mp = vec3f(0.93, 0.94, 0.90); mp = mix(mp, vec3f(0.72, 0.82, 0.62), fillA(length((P - vec2f(700.0, 520.0)) * vec2f(1.0, 1.4)) - 32.0));
  mp = mix(mp, vec3f(1.0), fillA(sdSeg(P, vec2f(662.0, 440.0), vec2f(810.0, 500.0)) - 3.0)); mp = mix(mp, vec3f(1.0), fillA(sdSeg(P, vec2f(690.0, 415.0), vec2f(760.0, 560.0)) - 2.2)); mp = mix(mp, vec3f(0.99, 0.85, 0.55), fillA(sdSeg(P, vec2f(662.0, 470.0), vec2f(810.0, 540.0)) - 2.6));
  c = mix(c, mp, inM); c = mix(c, vec3f(0.20, 0.50, 0.95), fillA(length(P - vec2f(742.0, 505.0)) - 12.0) * inM); c = mix(c, vec3f(0.98, 0.72, 0.30), fillA(length(P - vec2f(742.0, 505.0)) - 8.0) * inM);
  c = mix(c, vec3f(0.15), fillA(sdBox2(P - vec2f(690.0, 448.0), vec2f(20.0, 4.0), 2.0)) * inM); c = mix(c, vec3f(0.55), fillA(sdBox2(P - vec2f(688.0, 434.0), vec2f(18.0, 3.0), 2.0)) * inM);
  /* the grid */
  for (var j = 0; j < 4; j++) { for (var i = 0; i < 4; i++) { let ctr = vec2f(528.0 + f32(i) * 76.0, 361.0 - f32(j) * 80.0); let k = j * 4 + i; let d = sdBox2(P - ctr, vec2f(30.0, 30.0), 13.5); let base = ICONS[k]; var col = base * (0.88 + 0.24 * (P.y - ctr.y + 30.0) / 60.0);
    let g = k % 3; let glyph = select(select(abs(length(P - ctr) - 9.0) - 3.0, sdBox2(P - ctr, vec2f(11.0, 11.0), 3.0), g == 1), length(P - ctr) - 11.0, g == 0); let ink = select(vec3f(1.0), vec3f(0.2), base.r > 0.9); col = mix(col, ink, fillA(glyph) * 0.9);
    c = mix(c, col, fillA(d)); c = mix(c, vec3f(1.0), fillA(sdBox2(P - vec2f(ctr.x, ctr.y - 42.0), vec2f(15.0, 3.0), 2.0)) * 0.85); } }
  /* the Dock down the right edge */
  let dock = sdBox2(P - vec2f(856.0, 282.0), vec2f(27.0, 106.0), 27.0); c = mix(c, vec3f(1.0), fillA(dock) * 0.42); for (var k = 0; k < 4; k++) { let ctr = vec2f(856.0, 366.0 - f32(k) * 56.0); let col = select(select(select(vec3f(0.95, 0.30, 0.32), vec3f(0.25, 0.80, 0.36), k == 2), vec3f(0.96, 0.96, 0.96), k == 1), vec3f(0.25, 0.80, 0.36), k == 0);
    var ic = col * (0.88 + 0.24 * (P.y - ctr.y + 22.0) / 44.0); ic = mix(ic, select(vec3f(1.0), vec3f(0.2, 0.5, 0.95), k == 1), fillA(length(P - ctr) - 8.0) * 0.9); c = mix(c, ic, fillA(sdBox2(P - ctr, vec2f(22.0, 22.0), 10.0))); }
  /* the search button, the page dots, the status corner, the under-display camera */
  c = mix(c, vec3f(1.0), fillA(length(P - vec2f(856.0, 44.0)) - 14.5) * 0.55); c = mix(c, vec3f(0.15), fillA(abs(length(P - vec2f(854.0, 46.0)) - 4.5) - 1.2)); c = mix(c, vec3f(0.15), fillA(sdSeg(P, vec2f(857.0, 43.0), vec2f(861.0, 39.0)) - 1.2));
  c = mix(c, vec3f(1.0), fillA(length(P - vec2f(660.0, 44.0)) - 3.2)); c = mix(c, vec3f(1.0), fillA(length(P - vec2f(674.0, 44.0)) - 3.2) * 0.5);
  c = mix(c, vec3f(1.0), fillA(sd941(P - vec2f(834.0, 590.0), 14.0))); c = statusDisc(c, P, vec2f(856.0, 556.0), false); c = mix(c, vec3f(0.05), fillA(length(P - vec2f(632.0, 582.0)) - 4.0) * 0.35);
  return c; }
/* the Lock Screen on the outer display: date, the tall time, the radios disc, torch and camera, the home indicator, the hole-punch camera in the top outboard corner */
fn screenOuter(uv: vec2f) -> vec3f { let P = vec2f(uv.x * 466.0, uv.y * 678.0); var c = wallpaper(vec2f(uv.x * 0.6 + 0.2, uv.y), 466.0 / 678.0);
  c = mix(c, vec3f(1.0), fillA(sdBox2(P - vec2f(233.0, 633.0), vec2f(26.0, 4.0), 2.0)) * 0.9); c = mix(c, mix(vec3f(0.92), vec3f(1.0), smoothstep(490.0, 620.0, P.y)), fillA(sd941(P - vec2f(130.0, 492.0), 128.0)));
  c = statusDisc(c, P, vec2f(420.0, 630.0), false);
  for (var k = 0; k < 2; k++) { let ctr = vec2f(420.0, 70.0 + f32(k) * 50.0); c = mix(c, vec3f(0.12), fillA(length(P - ctr) - 17.0) * 0.55); c = mix(c, vec3f(1.0), fillA(select(sdBox2(P - ctr, vec2f(7.0, 5.0), 1.5), sdBox2(P - ctr, vec2f(2.5, 7.0), 1.0), k == 1))); }
  c = mix(c, vec3f(1.0), fillA(sdBox2(P - vec2f(233.0, 14.0), vec2f(60.0, 2.5), 2.5))); c = mix(c, vec3f(0.02), fillA(length(P - vec2f(56.0, 616.0)) - 6.5)); return c; }
fn shade(p: vec3f, n: vec3f, rd: vec3f, m: f32) -> vec3f { let key = normalize(vec3f(-0.35, 0.85, 0.4)); let sh = shadow(p + n * 0.02, key); let occ = ao(p, n);
  let nd = max(dot(n, key), 0.0); let hv = normalize(key - rd); let fr = pow(1.0 - max(dot(n, -rd), 0.0), 5.0); let refl = env(reflect(rd, n));
  let W = r.dims.x; let H = r.dims.y;
  if (m < 1.5) { /* mirror-polished titanium: the studio, sharp, tinted by the alloy */ return r.frame.rgb * (refl * 1.1 + vec3f(nd * sh * 0.15)) * (0.6 + 0.4 * occ) + vec3f(pow(max(dot(n, hv), 0.0), 260.0)) * sh * 1.4; }
  if (m < 2.5) { /* the inner display: nano-texture — a matte, wide highlight over the emissive content; the crease a whisper */ let q = p; let uv = vec2f(clamp(q.x / W, 0.0, 1.0), q.y / H + 0.5); let pa = rotY(p - vec3f(0.0, 0.0, r.misc.y), -r.fold) + vec3f(0.0, 0.0, r.misc.y); let onA = leaf(vec3f(-pa.x, pa.y, pa.z), false).x < leaf(p, true).x;
    var uvw = vec2f(0.5 + uv.x * 0.5, uv.y); var ax = q.x; if (onA) { let qa = vec3f(-pa.x, pa.y, pa.z); uvw = vec2f(0.5 - clamp(qa.x / W, 0.0, 1.0) * 0.5, qa.y / H + 0.5); ax = qa.x; }
    let awake = smoothstep(2.75, 2.35, r.fold); let content = screenInner(uvw) * (1.0 - 0.05 * exp(-ax / 0.12)) * awake; let ph = pow(max(dot(n, hv), 0.0), 18.0) * 0.16; return content * content * 1.25 + vec3f(0.02) + refl * 0.05 + vec3f(ph) * sh + vec3f(0.03) * fr; }
  if (m < 3.5) { /* Ceramic Shield back: deep glossy glass over the colour */ return r.back.rgb * (0.62 + 0.38 * nd * sh) * (0.7 + 0.3 * occ) + refl * (0.07 + 0.9 * fr) + vec3f(pow(max(dot(n, hv), 0.0), 320.0)) * sh * 0.9; }
  if (m < 4.5) { /* a lens: near-black glass with a hard ring highlight */ return vec3f(0.02, 0.02, 0.03) + refl * (0.05 + 0.9 * fr) + vec3f(pow(max(dot(n, hv), 0.0), 400.0)) * 1.5; }
  if (m < 5.5) { /* the hinge cover: micro-blasted titanium, a broad soft highlight, no mirror */ return r.hingeC.rgb * (vec3f(0.45) + vec3f(0.55) * nd * sh + refl * 0.25) * occ + vec3f(pow(max(dot(n, hv), 0.0), 10.0)) * 0.12; }
  if (m < 6.5) { /* the paper sweep: white, a soft contact shadow */ return vec3f(0.97, 0.97, 0.96) * (0.66 + 0.34 * sh) * (0.72 + 0.28 * occ); }
  if (m < 7.5) { /* the outer display: glossy glass */ let q = p; let uv = vec2f(1.0 - clamp(q.x / W, 0.0, 1.0), q.y / H + 0.5); let content = screenOuter(uv) * smoothstep(2.35, 2.75, r.fold); return content * content * 1.2 + vec3f(0.01) + refl * (0.06 + 0.9 * fr) + vec3f(pow(max(dot(n, hv), 0.0), 320.0)) * sh; }
  return r.frame.rgb * (refl * 0.9 + vec3f(nd * sh * 0.3)) * occ; }
@fragment fn fs(o: VO) -> @location(0) vec4f { let ndc = vec2f(o.uv.x * 2.0 - 1.0, 1.0 - o.uv.y * 2.0); let tf = tan(0.5 * 0.46);
  let rd = normalize(r.camF + r.camR * ndc.x * tf * r.aspect + r.camU * ndc.y * tf); let ro = r.camPos; let paper = vec3f(0.97, 0.97, 0.96);
  var col = paper; let h = march(ro, rd, 120);
  if (h.x > 0.0) { let p = ro + rd * h.x; let n = nrm(p); col = shade(p, n, rd, h.y);
    if (h.y > 5.5 && h.y < 6.5) { let rr = reflect(rd, n); let h2 = march(p + n * 0.02, rr, 60); if (h2.x > 0.0) { let m2 = map(p + n * 0.02 + rr * h2.x).y; if (m2 < 5.5 || m2 > 6.5) { let p2 = p + n * 0.02 + rr * h2.x; col = mix(col, shade(p2, nrm(p2), rr, m2), 0.16 * exp(-h2.x * 0.08)); } }
      col = mix(col, paper, smoothstep(8.0, 30.0, length(p.xz))); } }
  col = col / (1.0 + col * 0.25) * 1.2; col = pow(max(col, vec3f(0.0)), vec3f(1.0 / 2.2)); return vec4f(col, 1.0); }`;

const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const lerp = (a, b, t) => a + (b - a) * t, ease = (t) => t * t * (3 - 2 * t);

export function duoApp() {
  let dev = null, ui = null, s = null, drag = null, yaw = 0.7, pitch = 0.22, lastTouch = -1e9, manual = false, foldDeg = 0, way = 'night-sky', sliding = false, hover = null, running = true;
  const C = { ink: [0.14, 0.14, 0.16, 1], dim: [0.50, 0.50, 0.54, 1], glass: [1, 1, 1, 0.55], cell: [0, 0, 0, 0.06], cellHi: [0, 0, 0, 0.12], acc: [0.15, 0.45, 0.95, 1] };
  const PX = 560, PW = 268, TRK = [PX + 22, PW - 44];
  const draw = (now, rd) => { const wy = COLOURWAYS[way];
    ui.text(24, 22, 'IPHONE DUO', 14, C.ink, { weight: 800, track: 0.30 }); ui.text(24, 42, 'the device, as a model rather than a photograph', 10.5, C.dim);
    ui.text(24, 598, 'DRAG TO ORBIT · THE HINGE RUNS ITSELF', 9, C.dim, { weight: 600, track: 0.14, op: 0.8 });
    ui.glass(PX, 60, PW, 506, C.glass, 24, 0.18);
    let y = 84; ui.text(PX + 22, y, 'IPHONE DUO · MODEL', 9.5, C.dim, { weight: 600, track: 0.16 }); y += 20; ui.text(PX + 22, y, 'Titanium, glass, one hinge', 20, C.ink, { weight: 700, track: -0.02 }); y += 40;
    ui.text(PX + 22, y, 'HINGE', 9.5, C.dim, { weight: 600, track: 0.16 }); ui.text(PX + PW - 22, y, foldDeg + '°', 11, C.ink, { align: 'right', family: MONO, weight: 600 }); y += 22;
    ui.rect(TRK[0], y + 5, TRK[1], 3, [0, 0, 0, 0.12], 1.5); const kx = TRK[0] + foldDeg / 180 * TRK[1]; ui.rect(TRK[0], y + 5, kx - TRK[0], 3, C.acc, 1.5); ui.disc(kx, y + 6.5, 9, [1, 1, 1, 1]); ui.ring(kx, y + 6.5, 9, [0, 0, 0, 0.15], 1); ui.hit('fold', TRK[0] - 10, y - 8, TRK[1] + 20, 30); y += 34;
    ui.text(PX + 22, y, 'COLOURWAY', 9.5, C.dim, { weight: 600, track: 0.16 }); y += 20;
    [['night-sky', 'Night Sky'], ['star-white', 'Star White']].forEach(([id, nm], i) => { const x = PX + 22 + i * 116, on = way === id; ui.rect(x, y, 108, 30, on ? C.ink : hover === 'way-' + id ? C.cellHi : C.cell, 15); ui.disc(x + 18, y + 15, 7, [...COLOURWAYS[id].back, 1]); ui.ring(x + 18, y + 15, 7, [...COLOURWAYS[id].frame, 1], 1.5); ui.text(x + 32, y + 8, nm, 11.5, on ? [1, 1, 1, 1] : C.ink, { weight: 600 }); ui.hit('way-' + id, x, y, 108, 30); }); y += 46;
    const hot = hover === 'auto'; ui.rect(PX + 22, y, PW - 44, 36, running ? (hot ? C.cellHi : C.cell) : C.acc, 18); ui.text(PX + PW / 2, y + 10, running ? 'Running itself' : 'Let it run', 12, running ? C.ink : [1, 1, 1, 1], { align: 'center', weight: 600 }); ui.hit('auto', PX + 22, y, PW - 44, 36); y += 52;
    ui.rect(PX + 22, y, PW - 44, 1, [0, 0, 0, 0.1]); y += 10;
    Object.entries(SPECS).forEach(([k, v]) => { ui.text(PX + 22, y, k.replace(/([A-Z])/g, ' $1').toLowerCase(), 9, C.dim, { family: MONO }); ui.text(PX + PW - 22, y, (v.v * 10).toFixed(2) + ' mm', 9, C.ink, { align: 'right', family: MONO, weight: 500 }); ui.text(PX + PW - 82, y + 1, v.src.toUpperCase(), 7, v.src === 'verified' ? [0.15, 0.55, 0.35, 1] : v.src === 'derived' ? C.acc : [0.75, 0.45, 0.10, 1], { align: 'right', weight: 700, track: 0.1 }); y += 15; });
    y += 6; ui.rect(PX + 22, y, PW - 44, 1, [0, 0, 0, 0.1]); y += 10; ui.text(PX + 22, y, 'ONE PASS · MARCH', 8.5, C.dim, { weight: 600, track: 0.14, family: MONO }); ui.text(PX + PW - 22, y, rd, 9.5, C.ink, { align: 'right', family: MONO }); };
  const setFold = (px) => { foldDeg = Math.round(Math.max(0, Math.min(180, (px - TRK[0]) / TRK[1] * 180))); manual = true; running = false; lastTouch = performance.now(); };
  return { cursor: 'grab', init(d, host) { dev = d; ui = host.ui; const ru = uniform(64 + 80 + 128), pipe = render(SHADER), g = bind(pipe, [ru]), tm = timer(['march'], 4); s = { ru, pipe, g, tm, rd: '—' }; },
    down(p, id) { if (id === 'fold') { sliding = true; setFold(p.x); } else if (!id) { drag = { x: p.x, y: p.y, yaw, pitch }; lastTouch = performance.now(); } },
    move(p, hov) { hover = hov; if (sliding) setFold(p.x); else if (drag) { yaw = drag.yaw + (p.x - drag.x) / 890 * 4.0; pitch = Math.max(-0.1, Math.min(1.0, drag.pitch - (p.y - drag.y) / 626 * 2.5)); lastTouch = performance.now(); } },
    up(p, id, same) { drag = null; sliding = false; if (same && id && id.startsWith('way-')) way = id.slice(4); if (same && id === 'auto') { manual = false; running = true; lastTouch = -1e9; } }, leave() { drag = null; sliding = false; hover = null; },
    destroy() { s.ru.destroy(); s = null; },
    frame(t, dt, now, hov) { if (!s) return; const T = now / 1000; hover = hov; const tgt = ui.prepare(0.6);
      const tl = T % 20; let fold = tl < 2.5 ? 0 : tl < 8 ? ease((tl - 2.5) / 5.5) : tl < 14 ? 1 : tl < 18.5 ? 1 - ease((tl - 14) / 4.5) : 0;
      if (manual) fold = foldDeg / 180; else { foldDeg = Math.round(fold * 180); running = true; }
      const idle = (now - lastTouch) / 1000; if (idle > 4 && !drag) { yaw = lerp(yaw, 0.7 + 0.45 * Math.sin(T * 0.09), 1 - Math.pow(0.05, dt)); pitch = lerp(pitch, 0.2 + 0.1 * Math.sin(T * 0.06), 1 - Math.pow(0.05, dt)); }
      const W = SPECS.leafW.v, H = SPECS.leafH.v, T_ = SPECS.leafT.v, dist = 30, tg0 = [W * 0.5 * (fold - 0.5) * 0.8, 0.3, 0.5 + (1 - fold) * 0.3];
      const pos0 = [tg0[0] + Math.sin(yaw) * Math.cos(pitch) * dist, tg0[1] + Math.sin(pitch) * dist, tg0[2] + Math.cos(yaw) * Math.cos(pitch) * dist];
      const F0 = norm([tg0[0] - pos0[0], tg0[1] - pos0[1], tg0[2] - pos0[2]]), Rt0 = norm(cross(F0, [0, 1, 0]));
      /* the phone sits left of centre; the panel has the right leaf */
      const tg = [tg0[0] + Rt0[0] * 4.2, tg0[1], tg0[2] + Rt0[2] * 4.2], pos = pos0; const F = norm([tg[0] - pos[0], tg[1] - pos[1], tg[2] - pos[2]]), Rt = norm(cross(F, [0, 1, 0])), Up = cross(Rt, F);
      const cw = COLOURWAYS[way], RB = new ArrayBuffer(272), Rf = new Float32Array(RB);
      Rf.set(pos, 0); Rf[3] = T; Rf.set(F, 4); Rf[7] = tgt.w / tgt.h; Rf.set(Rt, 8); Rf[11] = Math.PI - fold * Math.PI; Rf.set(Up, 12); Rf[15] = 0;
      Rf.set([W, H, T_, SPECS.cornerR.v], 16); Rf.set([SPECS.bezel.v, SPECS.hingeAxis.v, SPECS.outerBezelEnd.v, SPECS.outerBezelSide.v], 20); Rf.set([...cw.frame, 1], 24); Rf.set([...cw.back, 1], 28); Rf.set([...cw.hinge, 1], 32);
      dev.queue.writeBuffer(s.ru, 0, RB);
      const enc = dev.createCommandEncoder(); const rp = enc.beginRenderPass({ colorAttachments: [{ view: tgt.view, loadOp: 'clear', storeOp: 'store' }], ...s.tm.begin(0) });
      rp.setPipeline(s.pipe); rp.setBindGroup(0, s.g); rp.draw(3); rp.end(); s.tm.resolve(enc);
      const rd = s.tm.read(); if (rd.march !== undefined) s.rd = rd.march.toFixed(2) + ' ms · ' + tgt.w + ' × ' + tgt.h;
      draw(now, s.rd); ui.compose(enc); dev.queue.submit([enc.finish()]); } };
}
