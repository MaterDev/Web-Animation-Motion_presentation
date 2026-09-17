// @ts-nocheck -- copied from src/lib/demos/webgpu/device/duo.js (itself from design/techniques/webgpu/duo.js); untyped sheet code
/* The fPhone Duo for the finale. The hardware is the device demo's, unchanged:
   signed-distance geometry, sphere traced, the inner display a plane each ray
   tests analytically, BODY accumulating jittered samples while the pose holds.

   What changed for the finale:
   · the camera takes a zoom: at z = 0 it sits so close that the inner display
     fills the canvas edge to edge (the credits "slide"), at z = 1 it is the
     device demo's open, frontal framing. Frontal throughout, so the display is
     an axis-aligned rect on the canvas and rectAt(z) is exact.
   · COMPOSITE no longer samples an OS texture. The display's content is the
     screen ground (the LCD gradient) and a field of fine particles, computed
     per pixel in display space, so they scale with the screen. Everything
     else on the screen is page elements positioned over this canvas.

   Dimensions in SPECS, each labelled verified / derived / constructed. */
import { uniform, render, FSQ_VS } from './common.js';

/* centimetres. Apple: open 164.6 × 117.8 × 5.2 mm, closed 84.1 × 117.8 × 11.3 mm; inner 1878 × 2670 @ 430 ppi → 110.93 × 157.72 mm,
   so the open bezel is 3.44 mm all round; outer 1398 × 2034 @ 460 ppi → 3.46 mm sides, 2.75 mm ends. The hinge axis sits (11.3 − 5.2) / 2 = 3.05 mm in front of each leaf's centre plane. No radius or crease width is published. */
export const SPECS = {
  leafW: { v: 8.23, src: 'verified' }, leafH: { v: 11.78, src: 'verified' }, leafT: { v: 0.52, src: 'verified' }, closedT: { v: 1.13, src: 'verified' },
  bezel: { v: 0.344, src: 'derived' }, outerBezelSide: { v: 0.346, src: 'derived' }, outerBezelEnd: { v: 0.275, src: 'derived' },
  cornerR: { v: 1.05, src: 'constructed' }, hingeAxis: { v: 0.305, src: 'derived' },
};
const WAY = { frame: [0.30, 0.33, 0.40], back: [0.08, 0.10, 0.16], hinge: [0.34, 0.36, 0.42] }; /* Night Sky */

/* the wallpaper: soft, out-of-focus colour fields under a dusk gradient, a fine grain so it never bands.
   Shared by the Lock Screen on the outer display and the Home Screen. */
export const WALLPAPER = `
fn hash(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }
fn vn(p: vec2f) -> f32 { let i = floor(p); var f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2f(1, 0)), f.x), mix(hash(i + vec2f(0, 1)), hash(i + vec2f(1, 1)), f.x), f.y); }
fn blob(q: vec2f, c: vec2f, r: vec2f) -> f32 { let d = (q - c) / r; return exp(-dot(d, d)); }
fn wallpaper(u: vec2f, ar: f32) -> vec3f { let q = vec2f(u.x * ar, u.y);
  let w = vec2f(vn(q * 1.6 + 3.1), vn(q * 1.6 + 7.7)) - 0.5; let s = q + w * 0.18;
  var c = mix(vec3f(0.10, 0.11, 0.24), vec3f(0.20, 0.17, 0.36), smoothstep(0.0, 1.0, u.y));
  c = mix(c, vec3f(0.93, 0.56, 0.50), blob(s, vec2f(0.25 * ar, 0.18), vec2f(0.55, 0.42)) * 0.85);
  c = mix(c, vec3f(0.56, 0.42, 0.86), blob(s, vec2f(0.72 * ar, 0.78), vec2f(0.70, 0.45)) * 0.80);
  c = mix(c, vec3f(0.30, 0.62, 0.78), blob(s, vec2f(0.95 * ar, 0.20), vec2f(0.45, 0.35)) * 0.65);
  c = mix(c, vec3f(0.98, 0.78, 0.62), blob(s, vec2f(0.45 * ar, 0.55), vec2f(0.30, 0.22)) * 0.35);
  c += (hash(u * 913.0) - 0.5) * 0.012;
  return c; }`;

const BODY = FSQ_VS + WALLPAPER + `
struct R { camPos: vec3f, tf: f32, camF: vec3f, aspect: f32, camR: vec3f, fold: f32, camU: vec3f, frameIdx: f32,
  dims: vec4f, misc: vec4f, frame: vec4f, back: vec4f, hingeC: vec4f, mark: vec4f, pad1: vec4f, /* mark: half width (face u), half height (face v), —, on */
  res: vec4f,   /* target w, h, samples this frame, march steps */
  lock: vec4f,  /* outer display awake, shadow steps, AO steps, — */
};
@group(0) @binding(0) var<uniform> r: R;
@group(0) @binding(1) var markT: texture_2d<f32>; /* the FOLKLORE wordmark, alpha = coverage */
@group(0) @binding(2) var markS: sampler;
/* the wordmark etched into the outer glass: coverage at a face uv (u across, v up), 0 outside it */
fn markAt(uv: vec2f) -> f32 { if (r.mark.w < 0.5) { return 0.0; }
  let q = vec2f((uv.x - 0.5) / (2.0 * r.mark.x) + 0.5, 0.5 - (uv.y - 0.5) / (2.0 * r.mark.y));
  if (q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0) { return 0.0; }
  return textureSampleLevel(markT, markS, q, 0.0).a; }
fn rotY(p: vec3f, a: f32) -> vec3f { let c = cos(a); let s = sin(a); return vec3f(c * p.x + s * p.z, p.y, -s * p.x + c * p.z); }
fn sdRBox(p: vec3f, b: vec3f, rad: f32) -> f32 { let q = abs(p) - b + rad; return length(max(q, vec3f(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0) - rad; }
fn sdBox2(p: vec2f, b: vec2f, rad: f32) -> f32 { let q = abs(p) - b + rad; return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - rad; }
fn sdSeg(p: vec2f, a: vec2f, b: vec2f) -> f32 { let pa = p - a; let ba = b - a; let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
fn fillA(d: f32) -> f32 { return 1.0 - smoothstep(-0.7, 0.7, d); }
/* materials: 1 frame (polished titanium) · 2 inner display glass · 3 back glass · 4 camera lens · 5 hinge cover (micro-blasted) · 6 floor · 7 outer display (glossy glass) · 8 button */
fn leaf(p: vec3f, hasOuter: bool) -> vec2f { let W = r.dims.x; let H = r.dims.y; let T = r.dims.z; let cr = r.dims.w; let bz = r.misc.x;
  /* over the last ten degrees of travel each slab grows across the hinge into the other, so when flat the two bodies are one:
     no fillet groove, no notch in the band, nothing at the centre of the silhouette */
  let ov = 0.32 * smoothstep(0.175, 0.0, r.fold);
  let q = p.xy - vec2f(W * 0.5, 0.0); let rad = select(cr, 0.03, p.x < W * 0.5); let d2 = sdBox2(p.xy - vec2f((W - ov) * 0.5, 0.0), vec2f((W + ov) * 0.5, H * 0.5), rad);
  let e = 0.20; let w = vec2f(d2 + e, abs(p.z) - T * 0.5 + e); let body = min(max(w.x, w.y), 0.0) + length(max(w, vec2f(0.0))) - e;
  var m = 1.0; var d = body;
  let sc = max(sdBox2(p.xy - vec2f((W - ov) * 0.5, 0.0), vec2f((W + ov) * 0.5 - bz * 0.5, H * 0.5 - bz), select(max(cr - bz, 0.0), 0.0, p.x < W * 0.5)) - bz * 0.5, -p.x - ov); /* the cover glass: square and continuous at the hinge */ if (sc < 0.0 && p.z > T * 0.5 - 0.05) { m = 2.0; }
  let bk = sdBox2(q, vec2f(W * 0.5 - 0.09, H * 0.5 - 0.09), rad - 0.08); if (bk < 0.0 && p.z < -T * 0.5 + 0.05) { m = 3.0; }
  if (hasOuter) { let so = sdBox2(q, vec2f(W * 0.5 - r.misc.w, H * 0.5 - r.misc.z), max(cr - r.misc.w, 0.1)); if (so < 0.0 && p.z < -T * 0.5 + 0.05) { m = 7.0; }
    let sb = sdRBox(p - vec3f(W + 0.03, H * 0.5 - 3.9, 0.0), vec3f(0.06, 0.62, 0.11), 0.05); if (sb < d) { d = sb; m = 8.0; } }
  else { /* the camera plateau: a horizontal pill in the top outboard corner of the back, two lenses side by side, a flash toward the hinge */
    let pc = vec2f(W - 3.30, H * 0.5 - 1.65); let plateau = sdRBox(vec3f(p.x - pc.x, p.y - pc.y, p.z + T * 0.5), vec3f(2.85, 1.22, 0.10), 1.10); if (plateau < d) { d = plateau; m = 3.0; }
    /* two lenses, written out (no constant-bound loop inside the march) */
    let l0 = vec3f(W - 1.55, pc.y, -T * 0.5 - 0.10); let rq0 = vec2f(max(length((p - l0).xy) - 0.66, 0.0), max(abs(p.z - l0.z) - 0.02, 0.0)); let lens0 = length(rq0) - 0.14; if (lens0 < d) { d = lens0; m = select(4.0, 1.0, length(p.xy - l0.xy) > 0.58); }
    let l1 = vec3f(W - 3.26, pc.y, -T * 0.5 - 0.10); let rq1 = vec2f(max(length((p - l1).xy) - 0.66, 0.0), max(abs(p.z - l1.z) - 0.02, 0.0)); let lens1 = length(rq1) - 0.14; if (lens1 < d) { d = lens1; m = select(4.0, 1.0, length(p.xy - l1.xy) > 0.58); }
    let fl = length(vec3f((p.xy - vec2f(W - 4.95, pc.y + 0.30)), (p.z + T * 0.5 + 0.10) * 2.0)) - 0.16; if (fl < d) { d = fl; m = 4.0; }
    let ab = sdRBox(p - vec3f(W + 0.03, H * 0.5 - 1.35, 0.0), vec3f(0.06, 0.22, 0.10), 0.05); if (ab < d) { d = ab; m = 8.0; }
    let vb = sdRBox(p - vec3f(W + 0.03, H * 0.5 - 2.95, 0.0), vec3f(0.06, 0.92, 0.10), 0.05); if (vb < d) { d = vb; m = 8.0; } }
  return vec2f(d, m); }
fn map(p: vec3f) -> vec2f {
  let hz = r.misc.y; let rel = p - vec3f(0.0, 0.0, hz); let loc = rotY(rel, -r.fold); let pa = loc + vec3f(0.0, 0.0, hz);
  /* leaf B (the world frame) carries the cameras on its back and stays put; leaf A carries the outer display and opens like a book
     cover toward the viewer, so the inner display faces the same way the outer display did when closed */
  let a = leaf(p, false); let b = leaf(vec3f(-pa.x, pa.y, pa.z), true);
  let bis = rotY(rel, -r.fold * 0.5); let slab = sdRBox(bis - vec3f(0.0, 0.0, -0.10), vec3f(hz + r.dims.z * 0.5, r.dims.y * 0.5 - 0.14, 0.10), 0.10); let hinge = max(slab, max(p.x, -loc.x) + 0.01) + 0.6 * smoothstep(0.26, 0.0, r.fold); /* the spine retracts as the leaves reach flat */
  var d = a.x; var m = a.y; if (b.x < d) { d = b.x; m = b.y; } if (hinge < d) { d = hinge; m = 5.0; }
  let floor = p.y + r.dims.y * 0.5 + 0.11; if (floor < d) { d = floor; m = 6.0; }
  return vec2f(d, m); }
/* tetrahedral normal, a small epsilon */
fn nrm(p: vec3f) -> vec3f { let e = 0.0012; let k0 = vec3f(1.0, -1.0, -1.0); let k1 = vec3f(-1.0, -1.0, 1.0); let k2 = vec3f(-1.0, 1.0, -1.0); let k3 = vec3f(1.0, 1.0, 1.0);
  return normalize(k0 * map(p + k0 * e).x + k1 * map(p + k1 * e).x + k2 * map(p + k2 * e).x + k3 * map(p + k3 * e).x); }
/* a conservative march: the step is never relaxed past the distance, the hit epsilon grows with distance */
fn march(ro: vec3f, rd: vec3f, steps: u32) -> vec2f { var t = 0.02; for (var i = 0u; i < steps; i++) { let h = map(ro + rd * t); if (h.x < 0.00012 * t) { return vec2f(t, h.y); } t += h.x * 0.95; if (t > 90.0) { break; } } return vec2f(-1.0, 0.0); }
fn shadow(ro: vec3f, rd: vec3f) -> f32 { var s = 1.0; var t = 0.03; let n = u32(r.lock.y);
  for (var i = 0u; i < n; i++) { let h = map(ro + rd * t).x; s = min(s, 7.0 * h / t); if (s < 0.001) { break; } t += clamp(h, 0.02, 0.6); if (t > 30.0) { break; } }
  let c = clamp(s, 0.0, 1.0); return c * c * (3.0 - 2.0 * c); }
fn ao(p: vec3f, n: vec3f) -> f32 { var occ = 0.0; var sca = 1.0; let k = u32(r.lock.z); for (var i = 0u; i < k; i++) { let h = 0.03 + 0.3 * f32(i); occ += (h - map(p + n * h).x) * sca; sca *= 0.7; } return clamp(1.0 - 1.2 * occ, 0.0, 1.0); }
fn env(d: vec3f) -> vec3f { let up = clamp(d.y, -1.0, 1.0); var c = vec3f(mix(0.90, 0.97, smoothstep(0.1, 0.8, up)));
  c = mix(c, vec3f(0.22, 0.23, 0.26), smoothstep(0.35, 0.12, up) * smoothstep(-0.30, -0.08, up)); c = mix(c, vec3f(0.86, 0.86, 0.85), smoothstep(-0.25, -0.6, up));
  let sb = smoothstep(0.37, 0.33, abs(d.x + 0.45)) * smoothstep(0.22, 0.18, abs(d.y - 0.72)) * step(0.0, d.z + 0.6); c += vec3f(1.0) * sb * 0.8; let strip = smoothstep(0.08, 0.06, abs(d.x - 0.85)) * smoothstep(0.57, 0.53, abs(d.y - 0.05)); c += vec3f(0.97, 0.98, 1.0) * strip * 0.8; return c; }
fn sd941(p: vec2f, h: f32) -> f32 { let s = 0.105 * h; var d = abs(length(p - vec2f(0.25 * h, 0.76 * h)) - 0.19 * h) - s;
  d = min(d, sdSeg(p, vec2f(0.44 * h, 0.76 * h), vec2f(0.40 * h, s)) - s); d = min(d, length(p - vec2f(0.67 * h, 0.30 * h)) - s * 1.05); d = min(d, length(p - vec2f(0.67 * h, 0.66 * h)) - s * 1.05);
  d = min(d, sdSeg(p, vec2f(1.17 * h, h - s), vec2f(0.86 * h, 0.36 * h)) - s); d = min(d, sdSeg(p, vec2f(0.86 * h, 0.36 * h), vec2f(1.30 * h, 0.36 * h)) - s); d = min(d, sdSeg(p, vec2f(1.17 * h, h - s), vec2f(1.17 * h, s)) - s);
  d = min(d, sdSeg(p, vec2f(1.53 * h, h - s), vec2f(1.53 * h, s)) - s); d = min(d, sdSeg(p, vec2f(1.53 * h, h - s), vec2f(1.40 * h, 0.82 * h)) - s); return d; }
/* the Lock Screen on the outer display: the tall time, torch and camera, the home indicator, the hole-punch camera */
fn screenOuter(uv: vec2f) -> vec3f { let P = vec2f(uv.x * 466.0, uv.y * 678.0); var c = wallpaper(vec2f(uv.x * 0.6 + 0.2, uv.y), 466.0 / 678.0);
  c = mix(c, vec3f(1.0), fillA(sdBox2(P - vec2f(233.0, 633.0), vec2f(26.0, 4.0), 2.0)) * 0.9); c = mix(c, mix(vec3f(0.92), vec3f(1.0), smoothstep(490.0, 620.0, P.y)), fillA(sd941(P - vec2f(130.0, 492.0), 128.0)));
  c = mix(c, vec3f(1.0), fillA(length(P - vec2f(420.0, 630.0)) - 14.5) * 0.5);
  let t0 = vec2f(420.0, 70.0); c = mix(c, vec3f(0.12), fillA(length(P - t0) - 17.0) * 0.55); c = mix(c, vec3f(1.0), fillA(sdBox2(P - t0, vec2f(2.5, 7.0), 1.0)));
  let t1 = vec2f(420.0, 120.0); c = mix(c, vec3f(0.12), fillA(length(P - t1) - 17.0) * 0.55); c = mix(c, vec3f(1.0), fillA(sdBox2(P - t1, vec2f(7.0, 5.0), 1.5)));
  c = mix(c, vec3f(1.0), fillA(sdBox2(P - vec2f(233.0, 14.0), vec2f(60.0, 2.5), 2.5))); c = mix(c, vec3f(0.02), fillA(length(P - vec2f(56.0, 616.0)) - 6.5)); return c; }
fn shade(p: vec3f, n: vec3f, rd: vec3f, m: f32) -> vec3f { let key = normalize(vec3f(-0.35, 0.85, 0.4)); let sh = shadow(p + n * 0.01, key); let occ = ao(p, n);
  let nd = max(dot(n, key), 0.0); let hv = normalize(key - rd); let fr = pow(1.0 - max(dot(n, -rd), 0.0), 5.0); let refl = env(reflect(rd, n));
  let W = r.dims.x; let H = r.dims.y;
  if (m < 1.5) { return r.frame.rgb * (refl * 1.1 + vec3f(nd * sh * 0.15)) * (0.6 + 0.4 * occ) + vec3f(pow(max(dot(n, hv), 0.0), 260.0)) * sh * 1.4; }
  if (m < 2.5) { return vec3f(0.012) + refl * 0.05 + vec3f(pow(max(dot(n, hv), 0.0), 18.0) * 0.12) * sh + vec3f(0.03) * fr; }
  if (m < 3.5) { return r.back.rgb * (0.62 + 0.38 * nd * sh) * (0.7 + 0.3 * occ) + refl * (0.07 + 0.9 * fr) + vec3f(pow(max(dot(n, hv), 0.0), 320.0)) * sh * 0.9; }
  if (m < 4.5) { return vec3f(0.02, 0.02, 0.03) + refl * (0.05 + 0.9 * fr) + vec3f(pow(max(dot(n, hv), 0.0), 400.0)) * 1.5; }
  if (m < 5.5) { return r.hingeC.rgb * (vec3f(0.45) + vec3f(0.55) * nd * sh + refl * 0.25) * occ + vec3f(pow(max(dot(n, hv), 0.0), 10.0)) * 0.12; }
  if (m < 6.5) { return vec3f(0.97) * (0.66 + 0.34 * sh) * (0.72 + 0.28 * occ); }
  if (m < 7.5) { let pa = rotY(p - vec3f(0.0, 0.0, r.misc.y), -r.fold) + vec3f(0.0, 0.0, r.misc.y); let uv = vec2f(clamp(-pa.x / W, 0.0, 1.0), pa.y / H + 0.5); let content = screenOuter(uv) * r.lock.x;
    /* etched, not stickered: the letters are a frosted band in the glass — a pale satin base, a broad sheen from the environment and a soft highlight from the key light */
    let mk = markAt(uv); let etch = vec3f(0.20, 0.205, 0.215) * (0.55 + 0.45 * nd * sh) + refl * 0.20 + vec3f(pow(max(dot(n, hv), 0.0), 40.0)) * sh * 0.35;
    return mix(content * content * 1.2 + vec3f(0.01) + refl * (0.06 + 0.9 * fr) + vec3f(pow(max(dot(n, hv), 0.0), 320.0)) * sh, etch + refl * 0.04, mk * 0.92); }
  return r.frame.rgb * (refl * 0.9 + vec3f(nd * sh * 0.3)) * occ; }
fn tm(c: vec3f) -> vec3f { let x = max(c / (1.0 + c * 0.25) * 1.2, vec3f(0.0)); return pow(x, vec3f(1.0 / 2.2)); }
/* the inner display as a plane in one leaf's frame: returns (t, u, v, inside) */
fn displayHit(ro: vec3f, rd: vec3f) -> vec4f { let W = r.dims.x; let H = r.dims.y; let T = r.dims.z; let bz = r.misc.x; let hz = r.misc.y;
  let hw = vec2f(W - bz, H * 0.5 - bz); let rad = max(r.dims.w - bz, 0.0);
  var best = vec4f(1e9, 0.0, 0.0, 0.0);
  /* leaf B is the world frame */
  if (rd.z < 0.0) { let t = (T * 0.5 - ro.z) / rd.z; let q = ro + rd * t; let d = max(sdBox2(q.xy, hw, rad), -q.x - 0.02);
    if (t > 0.0 && d < 0.0) { best = vec4f(t, (q.x + hw.x) / (2.0 * hw.x), (hw.y - q.y) / (2.0 * hw.y), 1.0); } }
  /* leaf A: into its folded, mirrored frame */
  var la = rotY(ro - vec3f(0.0, 0.0, hz), -r.fold) + vec3f(0.0, 0.0, hz); var da = rotY(rd, -r.fold); la.x = -la.x; da.x = -da.x;
  if (da.z < 0.0) { let t = (T * 0.5 - la.z) / da.z; let q = la + da * t; let d = max(sdBox2(q.xy, hw, rad), -q.x - 0.02);
    if (t > 0.0 && d < 0.0 && t < best.x) { best = vec4f(t, (-q.x + hw.x) / (2.0 * hw.x), (hw.y - q.y) / (2.0 * hw.y), 2.0); } }
  return best; }
struct S { col: vec4f, scr: vec3f };
fn sampleRay(ro: vec3f, rd: vec3f, ndcY: f32) -> S { var o: S; o.scr = vec3f(0.0);
  let h = march(ro, rd, u32(r.res.w)); let dh = displayHit(ro, rd);
  if (dh.w > 0.0 && (h.x < 0.0 || dh.x < h.x + 0.03)) { /* the display: glass over the emissive content the composite adds */
    let p = ro + rd * dh.x; let n = select(vec3f(sin(r.fold), 0.0, cos(r.fold)), vec3f(0.0, 0.0, 1.0), dh.w < 1.5);
    o.col = vec4f(tm(shade(p, n, rd, 2.0)), 1.0); o.scr = vec3f(dh.y, dh.z, 1.0); return o; }
  if (h.x < 0.0) { o.col = vec4f(0.0); return o; } /* the slide shows through */
  let p = ro + rd * h.x; let n = nrm(p);
  if (h.y > 5.5 && h.y < 6.5) { /* the floor is the slide itself: premultiplied shadow and a faint reflection over whatever is behind */
    let key = normalize(vec3f(-0.35, 0.85, 0.4)); let sh = shadow(p + n * 0.01, key); let occ = ao(p, n); let fade = 1.0 - smoothstep(4.0, 16.0, length(p.xz));
    var c = vec4f(0.0, 0.0, 0.0, (1.0 - (0.74 + 0.26 * sh) * (0.66 + 0.34 * occ)) * fade);
    let rr = reflect(rd, n); let h2 = march(p + n * 0.02, rr, u32(r.res.w * 0.5));
    if (h2.x > 0.0 && (h2.y < 5.5 || h2.y > 6.5)) { let p2 = p + n * 0.02 + rr * h2.x; let k = 0.10 * exp(-h2.x * 0.08) * fade; c = vec4f(c.rgb * (1.0 - k) + tm(shade(p2, nrm(p2), rr, h2.y)) * k, c.a + (1.0 - c.a) * k); }
    o.col = c; return o; }
  o.col = vec4f(tm(shade(p, n, rd, h.y)), 1.0); return o; }
struct Out { @location(0) col: vec4f, @location(1) scr: vec4f };
@fragment fn fs(v: VO) -> Out { let px = v.p.xy; var col = vec4f(0.0); var scr = vec3f(0.0); let n = u32(r.res.z);
  for (var s = 0u; s < n; s++) {
    let k = r.frameIdx * r.res.z + f32(s); let j = fract(vec2f(0.5) + k * vec2f(0.7548776662, 0.5698402910)) - 0.5;
    let q = (px + j) / r.res.xy; let ndc = vec2f(q.x * 2.0 - 1.0, 1.0 - q.y * 2.0);
    let rd = normalize(r.camF + r.camR * ndc.x * r.tf * r.aspect + r.camU * ndc.y * r.tf);
    let o = sampleRay(r.camPos, rd, ndc.y); col += o.col; scr += vec3f(o.scr.xy * o.scr.z, o.scr.z); }
  col /= f32(n); scr /= f32(n);
  var out: Out; out.col = col; out.scr = vec4f(scr, 1.0); return out; }`;

/* the composite: body + the screen's own ground and particles, at device pixels */
const COMPOSITE = FSQ_VS + `
struct C { origin: vec2f, size: vec2f, canvas: vec2f, awake: f32, settled: f32, time: f32, grow: f32, fade: f32, pad: f32,
  top: vec4f, bot: vec4f, ink: vec4f, tint: vec4f, well: vec4f };
@group(0) @binding(0) var<uniform> c: C;
@group(0) @binding(1) var smp: sampler;
@group(0) @binding(2) var body: texture_2d<f32>;
@group(0) @binding(3) var scr: texture_2d<f32>;
fn h12(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(12.9898, 78.233))) * 43758.5453); }
fn h22(p: vec2f) -> vec2f { return vec2f(h12(p), h12(p + vec2f(19.19, 7.31))); }
/* one layer of particles: a point per cell, drifting inside a 3 × 3 neighbourhood; returns coverage.
   L is in layer px (the display is 960 px wide in its own units); ppx is device px per layer px */
fn dots(L: vec2f, cell: f32, rad: f32, ppx: f32, t: f32, speed: f32, seed: f32) -> f32 {
  let g = floor(L / cell); var a = 0.0;
  for (var j = -1; j <= 1; j++) { for (var i = -1; i <= 1; i++) {
    let id = g + vec2f(f32(i), f32(j)); let h = h22(id + seed); let ph = h12(id * 1.7 + seed) * 6.2831;
    let drift = vec2f(sin(t * speed + ph), cos(t * speed * 0.8 + ph * 1.3)) * cell * 0.45;
    let p = (id + 0.5 + (h - 0.5) * 0.5) * cell + drift;
    /* assembling: each point arrives on its own delay, and breathes */
    let arrive = smoothstep(0.0, 1.0, (t - h.x * 1.6) / 0.9); let tw = 0.55 + 0.45 * sin(t * (0.7 + h.y) + ph);
    let r = max(rad * ppx, 0.65); let d = length(L - p) * ppx;
    a = max(a, clamp(r + 0.5 - d, 0.0, 1.0) * arrive * tw * step(0.35, h.y));
  } }
  return a; }
@fragment fn fs(o: VO) -> @location(0) vec4f { let fc = o.p.xy; let buv = fc / c.canvas;
  let b = textureSampleLevel(body, smp, buv, 0.0); let sm = textureSampleLevel(scr, smp, buv, 0.0); let m = clamp(sm.b, 0.0, 1.0);
  let uvLive = sm.rg / max(sm.b, 1e-4); let uv = select(uvLive, (fc - c.origin) / c.size, c.settled > 0.5);
  let LS = vec2f(960.0, 960.0 * c.size.y / c.size.x); let L = uv * LS; let ppx = c.size.x / 960.0;
  /* the display holds the slide. At grow 0 it is the deck's 960 × 540 frame (centred, the rest off-canvas); as the camera pulls
     back, grow → 1 and the slide re-lays out to the display's own proportions, its 6 px bezel thinning to nothing (index.js does
     the same to the page layer from the same number) */
  let g = clamp(c.grow, 0.0, 1.0); let bandTop = (LS.y - 540.0) * 0.5 * (1.0 - g); let bandH = 540.0 + (LS.y - 540.0) * g; let bz = 6.0 * (1.0 - g);
  let S = vec2f(L.x, L.y - bandTop);
  let inBand = step(0.0, S.y) * step(S.y, bandH); let inLcd = step(bz, S.x) * step(S.x, 960.0 - bz) * step(bz, S.y) * step(S.y, bandH - bz);
  var col = vec3f(0.012);
  col = mix(col, c.well.rgb, inBand);
  var lcd = mix(c.top.rgb, c.bot.rgb, clamp((S.y - bz) / (bandH - 2.0 * bz), 0.0, 1.0));
  let fine = dots(S, 15.0, 0.75, ppx, c.time, 0.35, 3.0);
  let big = dots(S, 46.0, 1.5, ppx, c.time, 0.22, 11.0);
  lcd = mix(lcd, c.ink.rgb, fine * 0.26 * c.fade);
  lcd = mix(lcd, c.tint.rgb, big * 0.7 * c.fade);
  col = mix(col, lcd, inLcd);
  let k = m * c.awake; let a = max(b.a, k);
  var outc = b.rgb * (1.0 - k) + col * k;
  outc += (h12(fc) - 0.5) / 255.0 * a;
  return vec4f(outc, a); }`;

const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const ease = (t) => (t = Math.max(0, Math.min(1, t)), t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const TF = Math.tan(0.23), W = SPECS.leafW.v, H = SPECS.leafH.v, T_ = SPECS.leafT.v, BZ = SPECS.bezel.v, HZ = SPECS.hingeAxis.v;
const lerp = (a, b, t) => a + (b - a) * t;
/* the display in its own units: 864 wide, and this tall */
export const LAYER_W = 960, LAYER_H = 960 * (H - 2 * BZ) / (2 * (W - BZ));
export const LAYER_RADIUS = 960 * (SPECS.cornerR.v - BZ) / (2 * (W - BZ));

/**
 * The hardware, over a premultiplied canvas: where no ray lands, the slide shows through.
 * pose p: 0 closed, 1 open and frontal. zoom z (only meaningful at p = 1): 0 display fills the canvas, 1 the whole device in frame.
 */
/** mark: optional { image (canvas), aspect (width / height) } — the wordmark for the outer face */
export function makeHardware(dev, canvas, ctx, fmt, mark) {
  const bodyMod = dev.createShaderModule({ code: BODY });
  const bodyPipe = dev.createRenderPipeline({ layout: 'auto', vertex: { module: bodyMod, entryPoint: 'vs' },
    fragment: { module: bodyMod, entryPoint: 'fs', targets: ['rgba16float', 'rgba16float'].map((format) => ({ format, blend: { color: { srcFactor: 'constant', dstFactor: 'one-minus-constant' }, alpha: { srcFactor: 'constant', dstFactor: 'one-minus-constant' } } })) },
    primitive: { topology: 'triangle-list' } });
  const compPipe = render(COMPOSITE, { format: fmt });
  const ru = uniform(208), cu = uniform(128), smp = dev.createSampler({ magFilter: 'linear', minFilter: 'linear' });
  const markW = mark ? mark.image.width : 1, markH = mark ? mark.image.height : 1;
  const markT = dev.createTexture({ size: [markW, markH], format: 'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT });
  if (mark) dev.queue.copyExternalImageToTexture({ source: mark.image }, { texture: markT }, [markW, markH]);
  /* the word spans 60% of the outer face's width, centred; its height follows the rendered word's aspect */
  const MARK_U = 0.30, MARK_V = mark ? (2 * MARK_U * W / mark.aspect) / H / 2 : 0;
  const bodyG = dev.createBindGroup({ layout: bodyPipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: ru } }, { binding: 1, resource: markT.createView() }, { binding: 2, resource: smp }] });
  let bodyT = null, scrT = null, cw = 0, ch = 0, acc = 0, lastKey = '', compG = null;
  const margin = () => Math.round(30 * (canvas.width / Math.max(1, canvas.clientWidth || canvas.width)));
  const openDist = () => { const m = margin(); return H * ch / ((ch - 2 * m) * 2 * TF); };
  /* close enough that the display's width is exactly the canvas's: the slide replica on it is the whole frame */
  const fillDist = () => (W - BZ) / (TF * (cw / ch));
  const zoomDist = (z) => lerp(fillDist(), openDist(), z);
  const camera = (p, z) => {
    const aspect = cw / ch, e = ease(p);
    const tgC = [W * 0.5, 0, HZ], tgO = [0, 0, T_ * 0.5];
    const closedDist = H / (0.86 * 2 * TF), yawC = -0.55, yawO = 0, pitchC = 0.06;
    const tg = [lerp(tgC[0], tgO[0], e), lerp(tgC[1], tgO[1], e), lerp(tgC[2], tgO[2], e)];
    const yaw = lerp(yawC, yawO, e), pitch = lerp(pitchC, 0, e), dist = lerp(closedDist, zoomDist(z), e) * (1 + 0.5 * Math.sin(Math.PI * e)); /* finale: pulled back further than the device demo, so the swinging leaf stays inside 444 px */
    const pos = [tg[0] + Math.sin(yaw) * Math.cos(pitch) * dist, tg[1] + Math.sin(pitch) * dist, tg[2] + Math.cos(yaw) * Math.cos(pitch) * dist];
    const F = norm([tg[0] - pos[0], tg[1] - pos[1], tg[2] - pos[2]]), Rt = norm(cross(F, [0, 1, 0])), Up = cross(Rt, F);
    return { pos, F, Rt, Up, aspect };
  };
  const hw = {
    get ready() { return !!bodyT; },
    resize() { cw = canvas.width; ch = canvas.height; if (bodyT) { bodyT.destroy(); scrT.destroy(); }
      const mk = () => dev.createTexture({ size: [cw, ch], format: 'rgba16float', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
      bodyT = mk(); scrT = mk(); acc = 0; lastKey = ''; compG = null; },
    /* the inner display's rect on the canvas, in device pixels, for a frontal pose at zoom z. This is the
       projection the shader does, done once for the four corners: the one source both layers are placed from */
    /* the open, frontal body's box on the canvas in device pixels (the click target once the device is out) */
    boundsOpen() { const d = openDist(), bx = W / (d * TF * (cw / ch)) * cw / 2, by = (H * 0.5) / (d * TF) * ch / 2; return { x: cw / 2 - bx, y: ch / 2 - by, w: bx * 2, h: by * 2 }; },
    rectAt(z) { const d = zoomDist(z), sx = (W - BZ) / (d * TF * (cw / ch)) * cw / 2, sy = (H * 0.5 - BZ) / (d * TF) * ch / 2;
      return { x: cw / 2 - sx, y: ch / 2 - sy, w: sx * 2, h: sy * 2 }; },
    /* march the body if the pose changed or it has not converged; returns true while it is still accumulating */
    body(enc, pose, z, fold, outerAwake, still) {
      const key = pose.toFixed(5) + '|' + z.toFixed(5) + '|' + fold.toFixed(5) + '|' + outerAwake.toFixed(3);
      if (key !== lastKey) { acc = 0; lastKey = key; }
      const maxAcc = still ? 12 : 1; if (acc >= maxAcc) return false;
      const cam = camera(pose, z), spp = still ? 2 : 1;
      const RB = new ArrayBuffer(208), Rf = new Float32Array(RB);
      Rf.set(cam.pos, 0); Rf[3] = TF; Rf.set(cam.F, 4); Rf[7] = cam.aspect; Rf.set(cam.Rt, 8); Rf[11] = fold; Rf.set(cam.Up, 12); Rf[15] = acc;
      Rf.set([W, H, T_, SPECS.cornerR.v], 16); Rf.set([BZ, HZ, SPECS.outerBezelEnd.v, SPECS.outerBezelSide.v], 20);
      Rf.set([...WAY.frame, 1], 24); Rf.set([...WAY.back, 1], 28); Rf.set([...WAY.hinge, 1], 32); Rf.set([MARK_U, MARK_V, 0, mark ? 1 : 0], 36);
      Rf.set([cw, ch, spp, still ? 200 : 140], 44); Rf.set([outerAwake, still ? 48 : 28, 5, 0], 48);
      dev.queue.writeBuffer(ru, 0, RB);
      const rp = enc.beginRenderPass({ colorAttachments: [bodyT, scrT].map((t) => ({ view: t.createView(), loadOp: acc === 0 ? 'clear' : 'load', clearValue: [0, 0, 0, 0], storeOp: 'store' })) });
      const w = 1 / (acc + 1); rp.setBlendConstant([w, w, w, w]); rp.setPipeline(bodyPipe); rp.setBindGroup(0, bodyG); rp.draw(3); rp.end(); acc++; return acc < maxAcc; },
    /* o: { rect, awake, settled, time (s), fade, colors: { top, bot, ink, tint } as [r, g, b, a] } */
    composite(enc, o) {
      if (!compG) compG = dev.createBindGroup({ layout: compPipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: cu } }, { binding: 1, resource: smp }, { binding: 2, resource: bodyT.createView() }, { binding: 3, resource: scrT.createView() }] });
      const R = o.rect, k = o.colors;
      dev.queue.writeBuffer(cu, 0, new Float32Array([R.x, R.y, R.w, R.h, cw, ch, o.awake, o.settled ? 1 : 0, o.time, o.grow || 0, o.fade, 0, ...k.top, ...k.bot, ...k.ink, ...k.tint, ...k.well]));
      const rp = enc.beginRenderPass({ colorAttachments: [{ view: ctx.getCurrentTexture().createView(), loadOp: 'clear', clearValue: [0, 0, 0, 0], storeOp: 'store' }] });
      rp.setPipeline(compPipe); rp.setBindGroup(0, compG); rp.draw(3); rp.end(); },
    destroy() { if (bodyT) { bodyT.destroy(); scrT.destroy(); } ru.destroy(); cu.destroy(); markT.destroy(); bodyT = null; },
  };
  return hw;
}
