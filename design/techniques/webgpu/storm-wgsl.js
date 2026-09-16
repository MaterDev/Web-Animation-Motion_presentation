/* SUPERCELL · the shaders (track 013). World units are MILES, axes are geographic:
   +x east, +z north, +y up, ground at y = 0. Shader space is centred on the
   mesocyclone's ground point; the ground pattern adds `origin` (the meso's true
   position, wrapped at 64 mi, which is the period of every hash below).

   One scene effect does it all per pixel: a ray from the camera, a march through
   the storm's volumes (funnel, wall cloud, debris cloud, precipitation core, RFD
   curtain, inflow band), the cloud base as a surface above, the Plains below, and
   the debris particles composited at their own distance inside the march. */

export const COMMON = /* wgsl */ `
struct Cam { pos: vec3f, tanHalf: f32, fwd: vec3f, aspect: f32, right: vec3f, steps: f32, up: vec3f, coarse: f32, pxH: f32, _c0: f32, _c1: f32, _c2: f32 };
struct Storm {
  tor: vec3f, torR: f32,
  sun: vec3f, flash: f32,
  bolt: vec3f, boltOn: f32,
  tilt: vec2f, topR: f32, flare: f32,
  descend: f32, rope: f32, ragged: f32, spin: f32,
  wall: f32, slot: f32, core: f32, dust: f32,
  dustR: f32, base: f32, origin: vec2f,
  time: f32, broken: f32, wedge: f32, seed: f32,
  poleX: f32, _s0: f32, _s1: f32, _s2: f32,
};
fn h3(p: vec3i) -> f32 {
  var v = vec3u(p + vec3i(8192));
  v = v * 1664525u + 1013904223u; v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v = v ^ (v >> vec3u(16u)); v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return f32(v.x & 0xffffffu) / 16777215.0;
}
fn vnoise(p: vec3f) -> f32 {
  let i = vec3i(floor(p)); let f = fract(p); let w = f * f * (3.0 - 2.0 * f);
  let a = mix(h3(i), h3(i + vec3i(1, 0, 0)), w.x); let b = mix(h3(i + vec3i(0, 1, 0)), h3(i + vec3i(1, 1, 0)), w.x);
  let c = mix(h3(i + vec3i(0, 0, 1)), h3(i + vec3i(1, 0, 1)), w.x); let d = mix(h3(i + vec3i(0, 1, 1)), h3(i + vec3i(1, 1, 1)), w.x);
  return mix(mix(a, b, w.y), mix(c, d, w.y), w.z);
}
/* fbm unrolled by hand: constant-bound loops nested in the uniform-bound march stall compileShader on ANGLE/Metal */
fn fbm2(p: vec3f) -> f32 { return vnoise(p) * 0.64 + vnoise(p * 2.03 + vec3f(3.1, 7.7, 1.3)) * 0.36; }
fn fbm3(p: vec3f) -> f32 { return vnoise(p) * 0.53 + vnoise(p * 2.03 + vec3f(3.1, 7.7, 1.3)) * 0.30 + vnoise(p * 4.07 + vec3f(9.2, 1.4, 5.5)) * 0.17; }
`;

/* ── the scene ───────────────────────────────────────────────────────── */
export const SCENE = COMMON + /* wgsl */ `
@group(0) @binding(0) var<uniform> cam: Cam;
@group(0) @binding(1) var<uniform> st: Storm;
@group(0) @binding(2) var debrisAlbedo: texture_2d<f32>;
@group(0) @binding(3) var debrisDist: texture_2d<f32>;

const PI = 3.14159265;
const FAR = 60.0;
const CORE_C = vec2f(2.2, 4.6);      /* forward-flank precipitation core: north-northeast of the meso */
const CORE_R = vec2f(3.2, 2.6);
const RED_BED = vec3f(0.30, 0.095, 0.05);  /* linear; the hematite red of the Permian red beds */
const SUN_COL = vec3f(1.0, 0.66, 0.38) * 2.6;
const DUST_ALB = vec3f(0.46, 0.21, 0.11);  /* red-brown: lofted red-bed soil, not tan */

fn hg(c: f32, g: f32) -> f32 { let g2 = g * g; return (1.0 - g2) / pow(1.0 + g2 - 2.0 * g * c, 1.5); }
fn rot2(v: vec2f, a: f32) -> vec2f { let c = cos(a); let s = sin(a); return vec2f(v.x * c - v.y * s, v.x * s + v.y * c); }
fn bearing(xz: vec2f) -> f32 { var a = atan2(xz.y, xz.x); if (a < 0.0) { a += 2.0 * PI; } return a; }

/* ── the cloud base as a coverage field: the storm body minus the RFD clear slot ── */
fn slotMask(xz: vec2f) -> f32 {
  /* the horseshoe: from the northwest, cyclonically round through west and south; it widens and wraps as the RFD surges */
  let r = length(xz); let a = bearing(xz);
  let a0 = radians(150.0); let a1 = radians(230.0 + 100.0 * st.slot);
  let ang = smoothstep(a0 - 0.2, a0 + 0.15, a) * (1.0 - smoothstep(a1 - 0.3, a1 + 0.05, a));
  let n = vnoise(vec3f(xz * 1.1, st.seed * 7.0)) - 0.5;
  let r0 = 1.15 + n * 0.3; let r1 = 1.5 + 2.2 * st.slot + n * 0.7;
  return ang * smoothstep(r0 - 0.2, r0 + 0.25, r) * (1.0 - smoothstep(r1 - 0.5, r1 + 0.2, r)) * smoothstep(0.02, 0.25, st.slot);
}
fn bodyCover(xz: vec2f) -> f32 {
  let q = (xz - vec2f(2.5, 3.5)) / vec2f(13.0, 12.0);
  let n = vnoise(vec3f(xz * 0.3, 1.7)) * 0.6 + vnoise(vec3f(xz * 0.8, 4.1)) * 0.4;
  return 1.0 - smoothstep(0.8, 1.02, length(q) + (n - 0.5) * 0.3);
}
fn deckCover(xz: vec2f) -> f32 { return bodyCover(xz) * (1.0 - 0.85 * slotMask(xz)); }
/* the same two fields without their noise: lighting inside the march needs the shape, not the ragged edge */
fn slotLo(xz: vec2f) -> f32 {
  let r = length(xz); let a = bearing(xz);
  let a0 = radians(150.0); let a1 = radians(230.0 + 100.0 * st.slot);
  return smoothstep(a0 - 0.2, a0 + 0.15, a) * (1.0 - smoothstep(a1 - 0.3, a1 + 0.05, a)) * smoothstep(0.95, 1.4, r) * (1.0 - smoothstep(1.2 + 2.2 * st.slot, 1.8 + 2.2 * st.slot, r)) * smoothstep(0.02, 0.25, st.slot);
}
fn bodyLo(xz: vec2f) -> f32 { return 1.0 - smoothstep(0.8, 1.02, length((xz - vec2f(2.5, 3.5)) / vec2f(13.0, 12.0))); }
fn coreShape(xz: vec2f) -> f32 { return 1.0 - smoothstep(0.35, 1.0, length((xz - CORE_C) / CORE_R)); }

/* sunlight below the base: the base blocks it, the clear slot lets some through, the hail core tints what crosses it */
fn sunVis(p: vec3f) -> vec3f {
  let s = p + st.sun * max(st.base - p.y, 0.0) / max(st.sun.y, 0.05);
  /* the slot is clear of cloud, not of the rear flank's rain: sunlight through it arrives dimmed */
  let v = 1.0 - bodyLo(s.xz) * (1.0 - 0.25 * slotLo(s.xz)) * 0.97;
  let tau = (coreShape(mix(p.xz, s.xz, 0.4)) * 2.0 + coreShape(mix(p.xz, s.xz, 0.8)) * 1.2) * st.core;
  let tint = mix(vec3f(1.0), vec3f(0.62, 0.80, 0.40), clamp(tau * 0.5, 0.0, 1.0));
  return vec3f(v) * exp(-tau * 0.8) * tint;
}

/* ── the tornado ── */
fn wallBottom() -> f32 { return st.base - 0.26 * st.wall; }
fn centre(y: f32) -> vec2f {
  let h = clamp(y / max(wallBottom(), 0.05), 0.0, 1.0);
  let wig = st.rope * vec2f(sin(h * 7.0 + st.time * 0.5 + st.seed * 6.0), cos(h * 5.5 - st.time * 0.4)) * 0.09 * sin(h * PI);
  return st.tor.xz + st.tilt * pow(h, 1.5) + wig;
}
fn radiusAt(h: f32) -> f32 { return mix(st.torR, st.topR, pow(h, st.flare)); }
var<private> lodPx: f32 = 1.0;   /* world size of a pixel at the current sample, set by the march */
fn funnelDens(p: vec3f, detail: f32) -> f32 {
  let wb = wallBottom(); if (st.descend <= 0.0 || p.y > wb + 0.04) { return 0.0; }
  let h = clamp(p.y / wb, 0.0, 1.0); let tip = 1.0 - st.descend;
  if (h < tip - 0.05) { return 0.0; }
  let d = p.xz - centre(p.y); let r = length(d);
  let taper = mix(0.2, 1.0, smoothstep(tip - 0.02, tip + 0.22, h));
  let R = radiusAt(h) * taper;
  if (r > R * 1.6 + 0.015) { return 0.0; }
  let rot = rot2(d, -st.spin);
  var n = 0.5;
  if (detail > 0.5) { let fp = vec3f(rot / max(R, 0.015) * 2.2, p.y * 2.2 / max(R, 0.05) - st.time * 0.6 + st.seed * 3.0); n = fbm3(fp);
    let per = max(R, 0.015) / 2.2 / 8.0; n += (vnoise(fp * vec3f(4.1, 4.1, 2.0) + vec3f(4.0)) - 0.5) * 0.12 * (1.0 - smoothstep(per * 0.3, per, lodPx)); }
  else { n = vnoise(vec3f(rot / max(R, 0.015) * 2.2, p.y * 2.2 / max(R, 0.05) - st.time * 0.6 + st.seed * 3.0)); }
  let Rn = R * (1.0 + st.ragged * (n - 0.5) * 0.8);
  let q = r / max(Rn, 1e-3);
  /* helical striations, periodic in angle so there is no seam */
  let stri = 0.7 + 0.3 * sin(atan2(d.y, d.x) * 4.0 + p.y / max(R, 0.03) * 1.1 - st.spin * 2.0 + n * 4.0);
  let body = 1.0 - smoothstep(0.72, 1.0, q);
  let veil = (1.0 - smoothstep(1.0, 1.55, q)) * smoothstep(0.45, 0.7, n) * 0.18;
  var dens = (body * stri + veil) * smoothstep(tip - 0.05, tip + 0.05, h);
  if (st.broken > 0.0) { dens *= mix(1.0, smoothstep(0.42, 0.6, vnoise(vec3f(p.y * 16.0, st.seed * 9.0, st.time * 0.4))), st.broken); }
  /* optical depth across the diameter stays near 7 whatever the radius, so a rope is as solid as a wedge */
  return dens * 3.6 / max(R, 0.012);
}
fn wallDens(p: vec3f, detail: f32) -> f32 {
  if (st.wall <= 0.0 || p.y > st.base || p.y < st.base - 0.4) { return 0.0; }
  let r = length(p.xz) / 1.2;
  if (r > 1.3) { return 0.0; }
  let rot = rot2(p.xz, -st.spin * 0.12);
  var n = 0.5;
  if (detail > 0.5) { let fp = vec3f(rot.x * 3.2, p.y * 3.2 + st.seed * 5.0, rot.y * 3.2); n = fbm3(fp);
    n += (vnoise(fp * vec3f(9.0, 5.0, 9.0) + vec3f(2.0)) - 0.5) * 0.18 * (1.0 - smoothstep(0.01, 0.04, lodPx)); } else { n = fbm2(vec3f(rot.x * 3.2, p.y * 3.2 + st.seed * 5.0, rot.y * 3.2)); }
  let lower = 0.26 * st.wall * (1.0 - smoothstep(0.1, 1.0, r));
  let yb = st.base - lower + (n - 0.5) * 0.08;
  let v = smoothstep(yb - 0.012, yb + 0.06, p.y);
  let erode = smoothstep(0.34, 0.6, n + 0.3 * (1.0 - r) - 0.05);
  return v * erode * (1.0 - smoothstep(0.8, 1.2, r)) * 10.0;
}
fn dustDens(p: vec3f, detail: f32) -> f32 {
  if (st.dust <= 0.0) { return 0.0; }
  let d = p.xz - st.tor.xz; let r = length(d);
  let Hd = 0.03 + 0.14 * st.dust;
  if (r > st.dustR * 1.35 || p.y > Hd * 1.5) { return 0.0; }
  let rot = rot2(d, -st.spin * 1.5);
  var n = 0.5;
  if (detail > 0.5) { n = fbm3(vec3f(rot / max(st.dustR, 0.05) * 2.0, p.y * 18.0 - st.time * 1.2)); } else { n = vnoise(vec3f(rot / max(st.dustR, 0.05) * 2.0, p.y * 18.0 - st.time * 1.2)); }
  let q = r / max(st.dustR, 0.02) + (n - 0.5) * 0.5;
  let hTop = Hd * (0.55 + 0.9 * n) * (1.0 - 0.5 * q);
  return st.dust * (1.0 - smoothstep(0.6, 1.0, q)) * (1.0 - smoothstep(hTop * 0.4, hTop, p.y)) * (0.4 + n) * 11.0;
}
fn coreDens(p: vec3f) -> f32 {
  let e = length((p.xz - CORE_C) / CORE_R);
  if (e > 1.2 || p.y > st.base) { return 0.0; }
  let curt = fbm2(vec3f(p.x * 1.8, p.y * 0.6 + st.time * 0.7, p.z * 1.8));
  return st.core * 1.8 * (1.0 - smoothstep(0.3, 1.05, e + (curt - 0.5) * 0.45)) * (0.5 + curt) * (0.7 + 0.3 * smoothstep(0.0, st.base, p.y));
}
fn inflowDens(p: vec3f) -> f32 {
  let ax = vec2f(0.94, -0.34); let o = p.xz - vec2f(0.8, -0.3);
  let along = dot(o, ax); let across = dot(o, vec2f(-ax.y, ax.x));
  if (along < 0.0 || along > 7.0 || abs(across) > 0.3) { return 0.0; }
  let yc = st.base - 0.06 - along * 0.004; if (abs(p.y - yc) > 0.05) { return 0.0; }
  let n = fbm2(vec3f(along * 0.9 - st.time * 0.3, across * 10.0, p.y * 30.0));
  return (1.0 - smoothstep(0.08, 0.28, abs(across) + (n - 0.5) * 0.15)) * (1.0 - smoothstep(0.015, 0.05, abs(p.y - yc))) * (1.0 - along / 7.0) * n * 4.0 * st.wall;
}
fn rfdDens(p: vec3f) -> f32 {
  let r = length(p.xz); if (r < 1.8 || r > 5.5 || p.y > st.base) { return 0.0; }
  let a = bearing(p.xz);
  let ang = smoothstep(radians(165.0), radians(185.0), a) * (1.0 - smoothstep(radians(215.0 + 100.0 * st.slot), radians(235.0 + 100.0 * st.slot), a));
  let rr = 1.5 + 2.2 * st.slot + 0.3;
  let band = exp(-(r - rr) * (r - rr) / 0.12);
  let n = fbm2(vec3f(p.x * 2.2, p.y * 0.6 + st.time * 0.9, p.z * 2.2));
  return ang * band * smoothstep(0.35, 0.75, n) * 1.2 * st.slot;
}

fn cyl(o: vec3f, d: vec3f, c: vec2f, R: f32, y0: f32, y1: f32) -> vec2f {
  let oc = o.xz - c; let a = dot(d.xz, d.xz); let b = dot(oc, d.xz); let cc = dot(oc, oc) - R * R;
  var t0 = -1e9; var t1 = 1e9;
  if (a > 1e-8) { let disc = b * b - a * cc; if (disc < 0.0) { return vec2f(1.0, 0.0); } let s = sqrt(disc); t0 = (-b - s) / a; t1 = (-b + s) / a; }
  else if (cc > 0.0) { return vec2f(1.0, 0.0); }
  if (abs(d.y) > 1e-6) { let ta = (y0 - o.y) / d.y; let tb = (y1 - o.y) / d.y; t0 = max(t0, min(ta, tb)); t1 = min(t1, max(ta, tb)); }
  else if (o.y < y0 || o.y > y1) { return vec2f(1.0, 0.0); }
  return vec2f(max(t0, 0.0), t1);
}

fn skyColor(d: vec3f) -> vec3f {
  let h = max(d.y, 0.0);
  let toward = clamp(dot(normalize(d.xz + vec2f(1e-5)), normalize(st.sun.xz)) * 0.5 + 0.5, 0.0, 1.0);
  var c = mix(mix(vec3f(0.34, 0.26, 0.20), vec3f(0.95, 0.56, 0.24), toward * toward) * 0.9, vec3f(0.22, 0.30, 0.44) * 0.7, smoothstep(0.0, 0.35, h));
  let cs = max(dot(d, st.sun), 0.0);
  c += vec3f(1.0, 0.62, 0.30) * (pow(cs, 1200.0) * 40.0 + pow(cs, 12.0) * 0.8);
  return c;
}
fn aces(x: vec3f) -> vec3f { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), vec3f(0.0), vec3f(1.0)); }

/* the section grid: a box-filtered periodic line, exact at every distance */
fn lineCov(x: f32, w: f32, dx: f32) -> f32 {
  let fw = max(dx, 1e-6); let a = x - 0.5 * fw + 0.5 * w; let b = x + 0.5 * fw + 0.5 * w;
  return clamp(((floor(b) * w + min(fract(b), w)) - (floor(a) * w + min(fract(a), w))) / fw, 0.0, 1.0);
}
/* a detail term that fades to its mean once its period is smaller than the pixel */
fn fade(period: f32, dx: f32) -> f32 { return 1.0 - smoothstep(period * 0.25, period * 0.9, dx); }
fn groundAlbedo(xz: vec2f, dx: f32) -> vec3f {
  let w = xz + st.origin;
  /* quarter sections: each half-mile cell is one field */
  let qm = vec3i((vec2i(floor(w * 2.0)) % vec2i(128) + vec2i(128)) % vec2i(128), 11).xzy;
  /* a quarter section is often split: into two 80-acre halves, one way or the other */
  let split = h3(qm + vec3i(21, 4, 2));
  let half = select(select(0, i32(fract(w.x * 2.0) > 0.5), split > 0.55), i32(fract(w.y * 2.0) > 0.5) + 2, split > 0.8);
  let fm = qm + vec3i(half * 37, 0, half * 11);
  let kind = h3(fm); let tone = h3(fm + vec3i(3, 0, 5));
  let wheat = mix(vec3f(0.24, 0.17, 0.075), vec3f(0.31, 0.22, 0.095), tone);
  let pasture = mix(vec3f(0.14, 0.13, 0.06), vec3f(0.18, 0.155, 0.075), tone);
  let plowed = RED_BED * mix(0.8, 1.0, tone);
  var alb = select(select(wheat, pasture, kind > 0.66), plowed, kind < 0.26);
  let n1 = vnoise(vec3f(w * 6.0, 5.0)); let n2 = vnoise(vec3f(w * 30.0, 2.0)); let n3 = vnoise(vec3f(w * 150.0, 8.0));
  alb *= 0.8 + 0.4 * n1 + (0.25 * (n2 - 0.5)) * fade(1.0 / 30.0, dx) + (0.22 * (n3 - 0.5)) * fade(1.0 / 150.0, dx);
  /* drilled rows, only where they are still larger than a pixel */
  let rowDir = select(w.x, w.y, h3(fm + vec3i(7, 1, 2)) > 0.5);
  alb *= 1.0 - 0.12 * (0.5 + 0.5 * sin(rowDir * 1400.0)) * fade(1.0 / 220.0, dx) * select(1.0, 0.0, kind > 0.66);
  /* centre pivots in roughly one quarter section in six, the corners left as red soil */
  let cc = (floor(w * 2.0) + 0.5) * 0.5; let pr = length(w - cc);
  let isPivot = h3(qm + vec3i(1, 5, 9)) < 0.17;
  let inPivot = 1.0 - smoothstep(0.236 - dx * 0.5, 0.236 + dx * 0.5, pr);
  let pivot = mix(vec3f(0.11, 0.13, 0.05), vec3f(0.15, 0.16, 0.06), n1) * (1.0 - 0.15 * (0.5 + 0.5 * sin(pr * 900.0)) * fade(1.0 / 140.0, dx));
  alb = select(alb, mix(RED_BED * 0.85, pivot, inPivot), isPivot);
  /* a farm pond in some quarters */
  let pc = cc + (vec2f(h3(qm + vec3i(5, 2, 1)), h3(qm + vec3i(2, 5, 1))) - 0.5) * 0.3;
  let pond = (1.0 - smoothstep(0.012, 0.012 + dx, length(w - pc))) * step(0.7, h3(qm + vec3i(8, 8, 8))) * select(1.0, 0.0, isPivot);
  alb = mix(alb, vec3f(0.035, 0.04, 0.035), pond);
  /* creeks: meandering tree lines, the only trees on an Oklahoma section */
  let cr = abs(vnoise(vec3f(w * 0.45, 13.0)) - 0.5);
  alb = mix(alb, vec3f(0.025, 0.035, 0.018), (1.0 - smoothstep(0.006, 0.006 + dx * 1.5 + 0.004, cr)) * 0.85);
  /* section-line roads every mile on both axes: red dirt */
  let ditch = max(lineCov(w.x, 0.011, dx), lineCov(w.y, 0.011, dx));
  alb = mix(alb, alb * 0.55, ditch);
  let road = max(lineCov(w.x, 0.006, dx), lineCov(w.y, 0.006, dx));
  alb = mix(alb, vec3f(0.42, 0.27, 0.18) * (0.85 + 0.3 * n3), road);
  return alb;
}

@fragment fn fs_main(@builtin(position) fc: vec4f, @location(0) uv: vec2f) -> @location(0) vec4f {
  let ndc = vec2f(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0);
  let rd = normalize(cam.fwd + cam.right * ndc.x * cam.tanHalf * cam.aspect + cam.up * ndc.y * cam.tanHalf);
  let ro = cam.pos;
  let L = st.sun;
  /* both surface hits and their pixel footprints, computed unconditionally: derivatives need uniform control flow */
  let tg = select(1e9, -ro.y / rd.y, rd.y < -1e-5);
  let gp = ro + rd * min(tg, 400.0);
  let gdx = length(fwidth(gp.xz));
  let td = select(1e9, (st.base - ro.y) / rd.y, rd.y > 1e-5);
  let dp = ro + rd * min(td, 400.0);
  let ddx = length(fwidth(dp.xz));
  let galb = groundAlbedo(gp.xz, gdx);
  let tEnd = min(min(tg, td), FAR);
  let flashCol = vec3f(0.72, 0.78, 1.0) * st.flash * 6.0;

  /* ── what the ray ends on ── */
  var bg = vec3f(0.0);
  if (tg < td && tg < 400.0) {
    let vis = sunVis(gp);
    let open = 1.0 - bodyLo(gp.xz) * (1.0 - 0.3 * slotLo(gp.xz));
    let amb = vec3f(0.030, 0.034, 0.040) * (1.0 + 4.0 * open);
    let wet = coreShape(gp.xz) * st.core;
    let fl = flashCol * 0.05 / (1.0 + dot(gp.xz - st.bolt.xz, gp.xz - st.bolt.xz) * 0.2);
    bg = galb * (SUN_COL * vis * (L.y * 1.3 + 0.08) + amb + fl) * (1.0 - wet * 0.5);
  } else if (td < 400.0) {
    let c = bodyCover(dp.xz); let sm = slotMask(dp.xz);
    let l1 = vnoise(vec3f(dp.xz * 0.45, 3.0)); let l2 = vnoise(vec3f(dp.xz * 1.4, 6.0)); let l3 = vnoise(vec3f(dp.xz * 4.2, 9.0));
    let f2 = fade(1.0 / 1.4, ddx); let f3 = fade(1.0 / 4.2, ddx);
    let lump = 0.5 + (l1 - 0.5) * 0.9 + (l2 - 0.5) * 0.6 * f2 + (l3 - 0.5) * 0.4 * f3;
    /* relief: the slope of the lumps toward the western light, from one offset sample each */
    let ex = 0.06; let dl = normalize(L.xz);
    let lumpW = 0.5 + (vnoise(vec3f((dp.xz + dl * ex) * 0.45, 3.0)) - 0.5) * 0.9 + (vnoise(vec3f((dp.xz + dl * ex) * 1.4, 6.0)) - 0.5) * 0.6 * f2 + (vnoise(vec3f((dp.xz + dl * ex) * 4.2, 9.0)) - 0.5) * 0.4 * f3;
    let relief = clamp(0.55 + (lump - lumpW) * 9.0, 0.15, 1.6);
    let r = length(dp.xz);
    /* striated, rotating plates around the updraft — faded out at distance rather than aliased */
    let ring = (0.5 + 0.5 * sin(r * 9.0 + bearing(dp.xz) * 1.0 - st.spin * 0.05)) * exp(-r * r / 12.0) * fade(0.7, ddx);
    let far01 = smoothstep(4.0, 16.0, td);
    var under = vec3f(0.020, 0.023, 0.028) * mix(0.55 + 0.7 * lump, 0.9, far01 * 0.6) * mix(relief, 1.0, far01 * 0.5) * (0.85 + 0.4 * ring);
    under *= 1.0 + 2.5 * (1.0 - smoothstep(0.4, 1.0, c));
    under = mix(under, under * vec3f(0.8, 1.1, 0.85), coreShape(dp.xz) * st.core);
    under += vec3f(0.10, 0.06, 0.03) * 0.25 * (1.0 - c);
    under += flashCol * 0.04 / (1.0 + dot(dp.xz - st.bolt.xz, dp.xz - st.bolt.xz) * 0.3);
    /* through the clear slot: a brighter, higher base, lit from the west */
    /* toward the sun the higher cloud through the slot is lit warm; away from it, grey */
    let wlit = clamp(0.5 + 0.5 * dot(normalize(dp.xz + vec2f(1e-4)), normalize(L.xz)), 0.0, 1.0);
    let high = mix(vec3f(0.07, 0.07, 0.075), vec3f(0.20, 0.15, 0.10), wlit) * (0.6 + 0.8 * lump);
    bg = mix(skyColor(rd), under, c);
    bg = mix(bg, high, smoothstep(0.1, 0.9, sm) * c);
  } else {
    bg = select(skyColor(rd), vec3f(0.04, 0.035, 0.03), rd.y < 0.0);
  }

  /* ── the march ── */
  var T = 1.0; var acc = vec3f(0.0);
  let jit = h3(vec3i(i32(fc.x), i32(fc.y), 77));
  let pix = vec2i(fc.xy);
  let dA = textureLoad(debrisAlbedo, pix, 0); let dD = textureLoad(debrisDist, pix, 0).r;
  var debrisDone = dA.a < 0.01;
  let cosS = dot(rd, L);
  /* horizon light: the bright band under the base toward the sun, which rims everything from behind */
  let Lh = normalize(vec3f(L.x, 0.06, L.z));
  let horiz = vec3f(0.95, 0.60, 0.30) * 0.9;
  let phaseC = hg(dot(rd, Lh), 0.4); let phaseR = hg(cosS, 0.2);
  let near = cyl(ro, rd, vec2f(0.0), 2.7, 0.0, st.base);
  let far = cyl(ro, rd, vec2f(1.2, 2.2), 7.2, 0.0, st.base);
  if (far.x < far.y && far.x < tEnd) {
    let t1 = min(far.y, tEnd);
    let nearOk = near.x < near.y && near.x < t1;
    let n0 = select(1e9, near.x, nearOk); let n1 = select(-1e9, min(near.y, t1), nearOk);
    let fineDt = max((n1 - n0) / max(cam.steps, 1.0), 0.003);
    let coarseDt = max((t1 - far.x) / max(cam.coarse, 1.0), 0.04);
    var t = far.x;
    if (nearOk && t >= n0) { t = n0; }
    let maxIter = u32(cam.steps + cam.coarse + 6.0);
    var first = true;
    for (var i = 0u; i < maxIter; i++) {
      if (t >= t1 || T < 0.015) { break; }
      let inNear = nearOk && t >= n0 - 1e-4 && t < n1;
      var dt = select(coarseDt, fineDt, inNear);
      if (!inNear && t < n0 && t + dt > n0) { dt = max(n0 - t, 0.002); }
      let ts = t + dt * select(0.5, jit, first); first = false;
      if (!debrisDone && dD < t + dt) {
        let pp = ro + rd * dD;
        acc += T * dA.a * dA.rgb * (SUN_COL * sunVis(pp) * 0.08 + horiz * 0.05 + vec3f(0.02) + flashCol * 0.02);
        T *= 1.0 - dA.a; debrisDone = true;
      }
      let p = ro + rd * ts;
      lodPx = ts * cam.tanHalf * 2.0 / cam.pxH;
      var cloud = 0.0; var dust = 0.0;
      if (inNear) { cloud = funnelDens(p, 1.0) + wallDens(p, 1.0); dust = dustDens(p, 1.0); }
      let rain = coreDens(p) + rfdDens(p); let band = inflowDens(p);
      let sig = cloud + dust + rain + band;
      if (sig > 1e-3) {
        var shade = 1.0;
        if (inNear && cloud + dust > 0.3) {
          /* self-shadow toward the western horizon, three taps through the cloud that is actually there — unrolled */
          let q1 = p + Lh * 0.06; let q2 = p + Lh * 0.22; let q3 = p + Lh * 0.55;
          let od = (funnelDens(q1, 0.0) + wallDens(q1, 0.0) + dustDens(q1, 0.0)) * 0.10 + (funnelDens(q2, 0.0) + wallDens(q2, 0.0) + dustDens(q2, 0.0)) * 0.22 + (funnelDens(q3, 0.0) + wallDens(q3, 0.0) + dustDens(q3, 0.0)) * 0.40;
          shade = exp(-od * 1.1);
        }
        let vis = sunVis(p);
        let hgt = clamp(p.y / st.base, 0.0, 1.0);
        let open = 1.0 - bodyLo(p.xz) * (1.0 - 0.25 * slotLo(p.xz));
        let amb = mix(vec3f(0.028, 0.022, 0.018), vec3f(0.022, 0.026, 0.030), hgt) * (1.0 + 3.0 * open);
        let fl = flashCol / (1.0 + dot(p - st.bolt, p - st.bolt) * 1.5);
        let lightC = (SUN_COL * vis * 0.12 + horiz * 0.05) * shade * phaseC + amb * (0.55 + 0.45 * shade) + fl * 0.25;
        let lightR = SUN_COL * vis * 0.18 * phaseR + amb + fl * 0.25;
        let S = (vec3f(0.60, 0.62, 0.65) * cloud * lightC + DUST_ALB * dust * lightC + vec3f(0.50, 0.56, 0.50) * rain * lightR + vec3f(0.7) * band * lightR) / sig;
        let a = 1.0 - exp(-sig * dt);
        acc += T * a * S; T *= 1.0 - a;
      }
      t += dt;
    }
  }
  if (!debrisDone && dD < tEnd && T > 0.015) {
    let pp = ro + rd * dD;
    acc += T * dA.a * dA.rgb * (SUN_COL * sunVis(pp) * 0.08 + horiz * 0.05 + vec3f(0.02)); T *= 1.0 - dA.a;
  }
  /* utility poles every 300 ft along the chase road, with a crossarm and two sagging wires: the depth cue at ground level */
  if (abs(rd.x) > 1e-5) {
    let tp = (st.poleX - ro.x) / rd.x;
    if (tp > 0.004 && tp < min(tEnd, 6.0)) {
      let hp = ro + rd * tp; let wz = hp.z + st.origin.y;
      let sp = 0.0568; let k = floor(wz / sp + 0.5); let dz = abs(wz - k * sp);
      let px = tp * cam.tanHalf * 2.0 / cam.pxH;
      let pole = (1.0 - smoothstep(0.00012, 0.00012 + px, dz)) * step(0.0, hp.y) * step(hp.y, 0.0068);
      let arm = (1.0 - smoothstep(0.0006, 0.0006 + px, dz)) * (1.0 - smoothstep(0.00006, 0.00006 + px, abs(hp.y - 0.0062)));
      let u = fract(wz / sp + 0.5) - 0.5; let sag = 0.0006 * (1.0 - 4.0 * u * u);
      let wire = (1.0 - smoothstep(0.0, px * 0.9, abs(hp.y - (0.0059 - sag)))) * 0.6 + (1.0 - smoothstep(0.0, px * 0.9, abs(hp.y - (0.0054 - sag)))) * 0.5;
      let m = clamp(max(max(pole, arm), wire * smoothstep(0.0, 0.00025, px) * min(1.0, 0.00004 / px + 0.25)), 0.0, 1.0) * exp(-tp * 0.05);
      acc = mix(acc, vec3f(0.012, 0.011, 0.010), m * T); T *= 1.0 - m;
    }
  }
  /* a cloud-to-ground channel, when the director fires one */
  if (st.boltOn > 0.0) {
    let b = st.bolt; let o2 = ro.xz - b.xz; let d2 = rd.xz; let dd = dot(d2, d2);
    let tb = select(0.0, -dot(o2, d2) / dd, dd > 1e-6);
    if (tb > 0.0 && tb < tEnd + 0.5) {
      let yb = ro.y + rd.y * tb;
      if (yb > 0.0 && yb < st.base) {
        let seg = floor(yb * 30.0); let fy = fract(yb * 30.0); let sd = i32(st.seed * 997.0);
        let jag = mix(h3(vec3i(i32(seg), sd, 5)) - 0.5, h3(vec3i(i32(seg) + 1, sd, 5)) - 0.5, fy) * 0.06;
        let side = vec2f(-d2.y, d2.x) / sqrt(max(dd, 1e-6));
        let off = abs(dot(ro.xz + d2 * tb - b.xz, side) - jag);
        let px = tb * cam.tanHalf * 2.0 / 700.0;
        acc += vec3f(0.85, 0.9, 1.0) * (smoothstep(px * 1.5, 0.0, off) * 5.0 + smoothstep(px * 25.0, 0.0, off) * 0.5) * st.boltOn;
      }
    }
  }
  /* aerial perspective: haze lit by what is above it — dim under the base, warm beyond it */
  let tf = min(tEnd, FAR);
  let fm = ro + rd * min(tf, 30.0) * 0.6;
  let toward = clamp(dot(normalize(rd.xz + vec2f(1e-5)), normalize(L.xz)), 0.0, 1.0);
  let fogCol = mix(vec3f(0.030, 0.031, 0.034), vec3f(0.55, 0.36, 0.20) * (0.35 + 0.9 * toward * toward), 1.0 - bodyLo(fm.xz));
  let fog = 1.0 - exp(-tf * 0.05);
  var col = acc + T * mix(bg, fogCol, fog);
  col += flashCol * 0.003;
  col = aces(col * 2.0);
  col = pow(col, vec3f(1.0 / 2.2));
  let vg = 1.0 - 0.18 * dot(ndc * vec2f(0.8, 1.0), ndc * vec2f(0.8, 1.0));
  return vec4f(col * vg, 1.0);
}
`;

/* ── debris: the old kernel's wind-influence field, in miles, around the tornado ── */
export const DEBRIS_STRUCTS = /* wgsl */ `
struct D { pos: vec3f, kind: f32, vel: vec3f, ang: f32 };
struct Sim { dt: f32, time: f32, torR: f32, strength: f32, drift: vec2f, infR: f32, maxH: f32, frame: u32, count: u32, _p0: f32, _p1: f32 };
`;
export const DEBRIS_KERNEL = DEBRIS_STRUCTS + /* wgsl */ `
@group(0) @binding(0) var<uniform> sim: Sim;
@group(0) @binding(1) var<storage, read_write> ds: array<D>;
fn h1(n: u32) -> f32 { var x = n * 747796405u + 2891336453u; x = ((x >> ((x >> 28u) + 4u)) ^ x) * 277803737u; x = (x >> 22u) ^ x; return f32(x) / 4294967295.0; }
@compute @workgroup_size(256) fn cs_main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x; if (i >= sim.count) { return; }
  var d = ds[i]; let dt = sim.dt; let seed = sim.frame * 9781u + i * 7u;
  /* the ground moves under a moving tornado: debris at rest stays where it lies */
  if (d.pos.y < 0.002) { d.pos.x -= sim.drift.x * dt; d.pos.z -= sim.drift.y * dt; }
  let dd = length(d.pos.xz) + 1e-4; var lift = 0.0;
  if (dd < sim.infR && sim.strength > 0.02) {
    let w = 1.0 - dd / sim.infR; let ww = w * w * sim.strength;
    let rh = d.pos.xz / dd; let tang = vec2f(-rh.y, rh.x);   /* cyclonic: counter-clockwise seen from above */
    let swirl = 2.4 * (0.35 + w); let pull = 1.1;
    d.vel.x += (-rh.x * pull + tang.x * swirl) * ww * dt * 3.0;
    d.vel.z += (-rh.y * pull + tang.y * swirl) * ww * dt * 3.0;
    lift = ww;
  }
  if (lift > 0.04 && d.pos.y < sim.maxH) { d.vel.y += (1.4 * lift - d.pos.y * 2.0) * dt; } else { d.vel.y -= 0.9 * dt; }
  /* flung out of the top of the column */
  if (d.pos.y >= sim.maxH && d.vel.y > 0.0) { let a = h1(seed) * 6.2831853; let pw = 0.10 + 0.12 * h1(seed + 1u); d.vel.x += cos(a) * pw; d.vel.z += sin(a) * pw; d.vel.y = -abs(d.vel.y) * 0.2; }
  let damp = 1.0 - dt * 0.6; d.vel.x *= damp; d.vel.z *= damp;
  if (d.pos.y < 0.002 && lift < 0.08) { d.vel.x *= 1.0 - dt * 3.0; d.vel.z *= 1.0 - dt * 3.0; }
  d.pos += d.vel * dt;
  d.ang += select((d.vel.x + d.vel.z) * 4.0 * dt, 18.0 * dt, lift > 0.05);
  if (d.pos.y <= 0.0) { d.pos.y = 0.0; if (d.vel.y < -0.05) { d.vel.y *= -0.25; } else { d.vel.y = 0.0; } }
  /* recycle anything that has left the tornado's neighbourhood, back onto the ground inside it */
  if (length(d.pos.xz) > sim.infR * 2.4 || d.pos.y > sim.maxH * 3.0) {
    let a = h1(seed + 2u) * 6.2831853; let r = sqrt(h1(seed + 3u)) * sim.infR * 1.6;
    d.pos = vec3f(cos(a) * r, 0.0, sin(a) * r); d.vel = vec3f(0.0); d.ang = h1(seed + 4u) * 6.28;
  }
  ds[i] = d;
}
`;
export const DEBRIS_DRAW = DEBRIS_STRUCTS + COMMON + /* wgsl */ `
@group(0) @binding(0) var<uniform> cam: Cam;
@group(0) @binding(1) var<uniform> view: vec4f;   /* tor.xz, pixel height of the target, far */
@group(0) @binding(2) var<storage, read> ds: array<D>;
struct VO { @builtin(position) p: vec4f, @location(0) q: vec2f, @location(1) alb: vec3f, @location(2) dist: f32, @location(3) a: f32 };
@vertex fn vs_main(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO {
  let d = ds[ii]; var o: VO;
  let wp = vec3f(d.pos.x + view.x, d.pos.y, d.pos.z + view.y);
  let v = wp - cam.pos; let z = dot(v, cam.fwd);
  let corner = vec2f(f32(vi & 1u), f32((vi >> 1u) & 1u)) * 2.0 - 1.0;
  let kind = u32(d.kind);
  /* chunks of 6 to 30 ft, never smaller than a pixel and a half, and hidden while they lie on the ground */
  let size = select(select(0.0010, 0.0022, kind == 1u), 0.0035, kind == 2u);
  let pxWorld = z * cam.tanHalf * 2.0 / view.z;
  let rad = max(size, pxWorld * 0.6);
  let ca = cos(d.ang); let sa = sin(d.ang); let sh = select(vec2f(1.0, 0.45), vec2f(1.0, 1.0), kind == 0u);
  let r = vec2f(corner.x * ca - corner.y * sa, corner.x * sa + corner.y * ca) * sh;
  let x = dot(v, cam.right) + r.x * rad; let y = dot(v, cam.up) + r.y * rad;
  let ok = z > 0.02 && d.pos.y > 0.009 && size > pxWorld * 0.15;
  o.p = select(vec4f(0.0, 0.0, -2.0, 1.0), vec4f(x / (z * cam.tanHalf * cam.aspect), y / (z * cam.tanHalf), clamp(z / view.w, 0.0, 1.0), 1.0), ok);
  o.q = corner; o.dist = length(v);
  let t = h3(vec3i(i32(ii), 17, 3));
  o.alb = select(select(vec3f(0.30, 0.13, 0.07) * (0.8 + 0.4 * t), vec3f(0.22, 0.15, 0.09), kind == 1u), vec3f(0.42, 0.44, 0.46) * (0.6 + 0.8 * t), kind == 2u);
  /* a particle smaller than its pixel covers only part of it */
  let cov = size / max(pxWorld * 0.75, 1e-6);
  o.a = select(1.0, clamp(cov * cov, 0.0, 1.0), rad > size);
  return o;
}
struct FO { @location(0) albedo: vec4f, @location(1) dist: vec4f };
@fragment fn fs_main(v: VO) -> FO {
  if (dot(v.q, v.q) > 1.0) { discard; }
  var o: FO; o.albedo = vec4f(v.alb, v.a); o.dist = vec4f(v.dist, 0.0, 0.0, 1.0); return o;
}
`;
