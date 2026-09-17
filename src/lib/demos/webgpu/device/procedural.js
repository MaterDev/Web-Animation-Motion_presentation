// @ts-nocheck -- copied from design/techniques/webgpu/; untyped sheet code
/* §5 · TESSERA — one grown world, five places in it. The heights come from
   a compute chain (biome-blended noise → flow routing → stream-power carving)
   and the picture is a ray march through that height buffer: sun, soft
   shadow, water, height fog, per-biome air. The map is the same march from
   high up; a click flies the camera down into a place and a field guide
   slides over it. Going somewhere on this site is travelling. */
import { storage, uniform, readback, compute, render, bind, timer, FSQ_VS, DPR } from './common.js';
import { MONO } from './ui.js';

const W = 1024, H = 640, HS = 210;
/* the five places, in map fractions; the same table lives in the shader */
const PLACES = [
  { id: 'ashmere', u: 0.17, v: 0.64, name: 'Ashmere Sound', kind: 'archipelago · temperate', clim: '11 °C · rain 220 d/yr · fog most mornings', text: 'Two hundred islands, none a day\'s row from the next. The kelp forests between them are the reason the water is so dark; the skerry-terns are the reason it is so loud.', species: ['skerry-tern', 'greyback kelp', 'tidewright crab'], sun: [-0.45, 0.35, 0.55], sunC: [1.0, 0.92, 0.80], fog: [0.72, 0.78, 0.82], sky: [0.55, 0.68, 0.84], sea: [0.06, 0.16, 0.20] },
  { id: 'corvane', u: 0.56, v: 0.74, name: 'Corvane Steps', kind: 'canyon · arid', clim: '34 °C · rain 9 d/yr · dust in the afternoons', text: 'A river that no longer exists cut the plateau into shelves. The shelves are the only shade for sixty miles, and everything that lives here lives under one.', species: ['shelf-lizard', 'redroot mesquite', 'dust owl'], sun: [0.55, 0.42, -0.30], sunC: [1.0, 0.80, 0.58], fog: [0.86, 0.66, 0.46], sky: [0.78, 0.60, 0.44], sea: [0.20, 0.16, 0.10] },
  { id: 'sellith', u: 0.22, v: 0.20, name: 'Sellith Shelf', kind: 'glacier · polar', clim: '−19 °C · no rain · ice-light all day', text: 'The shelf moves nine metres a year toward the sea and sings while it does. Nothing grows on it; the things that live here live in it, in the blue pools where the meltwater collects.', species: ['pool-lantern', 'ice-mite', 'white sleeper'], sun: [-0.62, 0.20, -0.40], sunC: [0.95, 0.96, 1.0], fog: [0.80, 0.86, 0.94], sky: [0.64, 0.74, 0.90], sea: [0.10, 0.24, 0.34] },
  { id: 'vell', u: 0.82, v: 0.42, name: 'Vell Caldera', kind: 'volcanic · active', clim: '28 °C · ash-fall · the ground is warm', text: 'The caldera vented forty years ago and the cone is still building. The slopes are black glass and the air tastes of coins; the only green is the moss that follows the steam.', species: ['vent-moss', 'cinder wren', 'glass beetle'], sun: [0.30, 0.28, 0.60], sunC: [1.0, 0.62, 0.42], fog: [0.46, 0.36, 0.34], sky: [0.44, 0.34, 0.30], sea: [0.08, 0.10, 0.10] },
  { id: 'yarrow', u: 0.50, v: 0.40, name: 'Yarrowfell', kind: 'highland jungle · wet', clim: '24 °C · rain every day · cloud below the ridges', text: 'The ridges hold the cloud and the cloud holds the forest. Rivers start as mist on a leaf here; by the valley floor they are wide enough to drown a road.', species: ['loom-fig', 'ridge gibbon', 'lantern frog'], sun: [-0.20, 0.55, 0.40], sunC: [1.0, 0.96, 0.88], fog: [0.74, 0.80, 0.74], sky: [0.60, 0.72, 0.80], sea: [0.06, 0.18, 0.14] },
];
const placeTable = PLACES.map((p) => `vec2f(${p.u}, ${p.v})`).join(', ');

const COMMON = `
struct U { w: u32, h: u32, seed: u32, iter: u32, sea: f32, erosion: f32, time: f32, pad: f32 };
fn idx(x: i32, y: i32, u: U) -> u32 { return u32(clamp(y, 0, i32(u.h) - 1)) * u.w + u32(clamp(x, 0, i32(u.w) - 1)); }
const PLACE = array<vec2f, 5>(${placeTable});
/* biome weights: a soft partition of the map around the five places, its
   borders wandered by a little noise so they read as coastlines, not circles */
fn biomeW(uv: vec2f, wob: f32) -> array<f32, 5> { var w: array<f32, 5>; var s = 0.0;
  for (var k = 0; k < 5; k++) { let d = (uv - PLACE[k]) * vec2f(1.6, 1.0); let dd = dot(d, d); w[k] = exp(-dd / (2.0 * 0.16 * 0.16) + wob * 0.9); s += w[k]; }
  for (var k = 0; k < 5; k++) { w[k] /= s; } return w; }`;
const NOISE = COMMON + `
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read_write> height: array<f32>;
fn hash(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7)) + f32(u.seed) * 0.173) * 43758.5453); }
fn vn(p: vec2f) -> f32 { let i = floor(p); var f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2f(1, 0)), f.x), mix(hash(i + vec2f(0, 1)), hash(i + vec2f(1, 1)), f.x), f.y); }
fn fbm(p0: vec2f) -> f32 { var p = p0; var a = 0.5; var s = 0.0; var w = 0.0; let R = mat2x2f(0.8, 0.6, -0.6, 0.8); for (var i = 0; i < 7; i++) { s += a * vn(p); w += a; a *= 0.5; p = R * p * 2.03 + vec2f(1.7, 9.2); } return s / w; }
fn ridged(p0: vec2f) -> f32 { var p = p0; var a = 0.5; var s = 0.0; var w = 0.0; var wt = 1.0; for (var i = 0; i < 6; i++) { var v = 1.0 - abs(2.0 * vn(p) - 1.0); v = v * v * wt; wt = clamp(v * 1.5, 0.0, 1.0); s += a * v; w += a; a *= 0.5; p = p * 2.1 + vec2f(3.1, 1.3); } return s / w; }
fn terrace(x: f32, n: f32) -> f32 { let k = x * n; let f = fract(k); return (floor(k) + smoothstep(0.35, 0.65, f)) / n; }
@compute @workgroup_size(16, 16) fn main(@builtin(global_invocation_id) id: vec3u) {
  let x = i32(id.x); let y = i32(id.y); if (x >= i32(u.w) || y >= i32(u.h)) { return; }
  let uv = vec2f(f32(x) / f32(u.w), f32(y) / f32(u.h)); let p = uv * vec2f(f32(u.w) / f32(u.h), 1.0);
  let warp = vec2f(fbm(p * 2.0 + vec2f(5.2, 1.3)), fbm(p * 2.0 + vec2f(8.3, 2.8))) * 0.35;
  let q = p + warp; let cont = fbm(q * 1.6); let rid = ridged((p + warp * 0.5) * 3.4);
  let w = biomeW(uv, fbm(p * 3.0 + vec2f(2.0, 7.0)) - 0.5);
  /* five terrains, one per place, blended by where you are */
  let arch = 0.22 + cont * 0.40 + rid * 0.30 * smoothstep(0.45, 0.7, cont);
  let canyon = 0.48 + 0.42 * terrace(fbm(q * 1.4) * 0.8 + 0.1, 6.0) - 0.28 * pow(ridged(q * 2.2), 2.0);
  let ice = 0.58 + 0.30 * fbm(q * 0.9) + 0.12 * rid + 0.05 * ridged(q * 7.0);
  let dv = (uv - PLACE[3]) * vec2f(1.6, 1.0); let dd = dot(dv, dv);
  let volc = 0.34 + 0.62 * exp(-dd * 140.0) * (1.0 - 0.5 * exp(-dd * 900.0)) + 0.30 * ridged(q * 3.0) * (1.0 - exp(-dd * 140.0));
  let jung = 0.44 + 0.56 * ridged(q * 2.6) * (0.5 + 0.5 * fbm(q * 1.2));
  var h = arch * w[0] + canyon * w[1] + ice * w[2] + volc * w[3] + jung * w[4];
  /* the edge of the map is the edge of the world: it drops into the sea */
  let e = length((uv - 0.5) * vec2f(1.6, 1.0)) * 1.15; h -= smoothstep(0.55, 1.0, e) * 0.6;
  /* Tessera edits (2026-09-17): and every side of the map shelves into the sea, so no edge is a cliff */
  let eb = abs(uv - 0.5) * 2.0; h -= smoothstep(0.80, 0.97, max(eb.x, eb.y)) * 0.7;
  height[idx(x, y, u)] = clamp(h, 0.0, 1.0);
}`;
const FLOW = COMMON + `
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> height: array<f32>;
@group(0) @binding(2) var<storage, read> flowIn: array<f32>;
@group(0) @binding(3) var<storage, read_write> flowOut: array<f32>;
fn lowest(x: i32, y: i32) -> vec2i { let h0 = height[idx(x, y, u)]; var best = vec2i(x, y); var hb = h0;
  for (var dy = -1; dy <= 1; dy++) { for (var dx = -1; dx <= 1; dx++) { if (dx == 0 && dy == 0) { continue; } let h = height[idx(x + dx, y + dy, u)]; if (h < hb) { hb = h; best = vec2i(x + dx, y + dy); } } } return best; }
@compute @workgroup_size(16, 16) fn main(@builtin(global_invocation_id) id: vec3u) {
  let x = i32(id.x); let y = i32(id.y); if (x >= i32(u.w) || y >= i32(u.h)) { return; }
  var acc = 1.0;
  for (var dy = -1; dy <= 1; dy++) { for (var dx = -1; dx <= 1; dx++) { if (dx == 0 && dy == 0) { continue; } let nx = x + dx; let ny = y + dy; if (nx < 0 || ny < 0 || nx >= i32(u.w) || ny >= i32(u.h)) { continue; } let l = lowest(nx, ny); if (l.x == x && l.y == y) { acc += flowIn[idx(nx, ny, u)]; } } }
  flowOut[idx(x, y, u)] = acc;
}`;
const CARVE = COMMON + `
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> flow: array<f32>;
@group(0) @binding(2) var<storage, read_write> height: array<f32>;
@compute @workgroup_size(16, 16) fn main(@builtin(global_invocation_id) id: vec3u) {
  let x = i32(id.x); let y = i32(id.y); if (x >= i32(u.w) || y >= i32(u.h)) { return; }
  let h = height[idx(x, y, u)]; if (h <= u.sea) { return; }
  let f = flow[idx(x, y, u)];
  let slope = max(0.0, h - min(min(height[idx(x - 1, y, u)], height[idx(x + 1, y, u)]), min(height[idx(x, y - 1, u)], height[idx(x, y + 1, u)])));
  let e = 0.0009 * pow(f, 0.5) * slope * u.erosion;
  let mean = (height[idx(x - 1, y, u)] + height[idx(x + 1, y, u)] + height[idx(x, y - 1, u)] + height[idx(x, y + 1, u)]) * 0.25;
  height[idx(x, y, u)] = max(u.sea - 0.02, h - e + (mean - h) * 0.03 * u.erosion);
}`;

/* ── the march ────────────────────────────────────────────────────────── */
/* Tessera edits (2026-09-17): loops that run per pixel are bounded by uniforms
   (steps, shSteps), because constant-bound loops unroll on ANGLE/Metal and stall
   the compile. The bisection sits after the march loop, not nested inside it. */
const MARCH = FSQ_VS + COMMON + `
struct R { camPos: vec3f, fov: f32, camF: vec3f, sea: f32, camR: vec3f, time: f32, camU: vec3f, aspect: f32,
  sun: vec3f, focus: f32, sunC: vec3f, place: f32, fog: vec3f, wet: f32, sky: vec3f, steps: f32, seaC: vec3f, shSteps: f32,
  pxA: f32, pad1: f32, pad2: f32, pad3: f32 };
@group(0) @binding(0) var<uniform> r: R;
@group(0) @binding(1) var<storage, read> height: array<f32>;
@group(0) @binding(2) var<storage, read> flow: array<f32>;
const HS = ${HS}.0; const MW = ${W}.0; const MH = ${H}.0;
fn H2(x: i32, y: i32) -> f32 { if (x < 0 || y < 0 || x >= ${W} || y >= ${H}) { return -0.2; } return height[u32(y) * ${W}u + u32(x)]; }
fn hgt(p: vec2f) -> f32 { let f = floor(p); let t = p - f; let x = i32(f.x); let y = i32(f.y);
  return mix(mix(H2(x, y), H2(x + 1, y), t.x), mix(H2(x, y + 1), H2(x + 1, y + 1), t.x), t.y) * HS; }
/* a tent-filtered height: four bilinear taps half a cell apart, so shading does not show the bilinear creases */
fn hgtS(p: vec2f) -> f32 { return 0.25 * (hgt(p + vec2f(0.5, 0.5)) + hgt(p + vec2f(-0.5, 0.5)) + hgt(p + vec2f(0.5, -0.5)) + hgt(p + vec2f(-0.5, -0.5))); }
fn F2(x: i32, y: i32) -> f32 { return flow[u32(clamp(y, 0, ${H - 1})) * ${W}u + u32(clamp(x, 0, ${W - 1}))]; }
/* flow, bilinear, so rivers are lines up close rather than stairs of cells */
fn flw(p: vec2f) -> f32 { let q = p; let f = floor(q); let t = q - f; let x = i32(f.x); let y = i32(f.y);
  return mix(mix(F2(x, y), F2(x + 1, y), t.x), mix(F2(x, y + 1), F2(x + 1, y + 1), t.x), t.y); }
fn hash(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }
fn vn(p: vec2f) -> f32 { let i = floor(p); var f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2f(1, 0)), f.x), mix(hash(i + vec2f(0, 1)), hash(i + vec2f(1, 1)), f.x), f.y); }
fn fbm3(p0: vec2f) -> f32 { var p = p0; var a = 0.5; var s = 0.0; for (var i = 0; i < 4; i++) { s += a * vn(p); a *= 0.5; p = p * 2.1 + 1.7; } return s; }
/* the normal widens with distance so far slopes do not sparkle */
fn normalAt(p: vec2f, e: f32) -> vec3f { let dx = hgtS(p + vec2f(e, 0.0)) - hgtS(p - vec2f(e, 0.0)); let dz = hgtS(p + vec2f(0.0, e)) - hgtS(p - vec2f(0.0, e)); return normalize(vec3f(-dx, 2.0 * e, -dz)); }
/* march the height field: skip straight to the top of the world, step by a fraction of the
   clearance (fine near the ground and near the camera, long over open air), then bisect */
fn march(ro: vec3f, rd: vec3f, tmax: f32) -> f32 { let top = HS * 1.02; var t = 0.5;
  if (ro.y > top) { if (rd.y >= 0.0) { return -1.0; } t = max(t, (ro.y - top) / -rd.y); }
  var lt = t; var hit = false; let n = i32(r.steps);
  for (var i = 0; i < n; i++) { let p = ro + rd * t; if (p.y > top && rd.y >= 0.0) { return -1.0; } let c = p.y - hgt(p.xz);
    if (c < 0.0) { hit = true; break; }
    lt = t; t += clamp(c * 0.42, 0.12 + t * 0.0022, 48.0); if (t > tmax) { return -1.0; } }
  if (!hit) { return t; } /* out of steps: close enough to the horizon for the air to hide it */
  var a = lt; var b = t; for (var j = 0; j < 7; j++) { let m = 0.5 * (a + b); let q = ro + rd * m; if (q.y < hgt(q.xz)) { b = m; } else { a = m; } }
  return 0.5 * (a + b); }
/* soft shadow: the smallest clearance-over-distance toward the sun, stepped by clearance */
fn shadow(ro: vec3f, rd: vec3f, k: f32) -> f32 { var t = 1.5; var s = 1.0; let n = i32(r.shSteps);
  for (var i = 0; i < n; i++) { let p = ro + rd * t; if (p.y > HS * 1.02) { break; } let c = p.y - hgt(p.xz); s = min(s, k * c / t); if (s < 0.0) { break; } t += clamp(c * 0.5, 0.7, 26.0); if (t > 1100.0) { break; } }
  let q = clamp(s, 0.0, 1.0); return q * q * (3.0 - 2.0 * q); }
/* cavity occlusion: how much the ground around rises above this point, at two radii */
fn occ(p: vec3f) -> f32 { let h0 = p.y;
  let o1 = max(hgt(p.xz + vec2f(5.0, 0.0)) - h0, 0.0) + max(hgt(p.xz + vec2f(-5.0, 0.0)) - h0, 0.0) + max(hgt(p.xz + vec2f(0.0, 5.0)) - h0, 0.0) + max(hgt(p.xz + vec2f(0.0, -5.0)) - h0, 0.0);
  let o2 = max(hgt(p.xz + vec2f(13.0, 9.0)) - h0, 0.0) + max(hgt(p.xz + vec2f(-13.0, -9.0)) - h0, 0.0) + max(hgt(p.xz + vec2f(-9.0, 13.0)) - h0, 0.0) + max(hgt(p.xz + vec2f(9.0, -13.0)) - h0, 0.0);
  return clamp(1.0 - o1 * 0.03 - o2 * 0.011, 0.3, 1.0); }
fn skyCol(rd0: vec3f) -> vec3f { let up = clamp(rd0.y, 0.0, 1.0);
  var c = mix(r.fog * 1.18, r.sky, pow(up, 0.5)); c = mix(c, r.sky * 0.78, smoothstep(0.35, 1.0, up));
  let sd = max(dot(rd0, r.sun), 0.0); c += r.sunC * (pow(sd, 5.0) * 0.16 + pow(sd, 64.0) * 0.4 + smoothstep(0.9993, 0.9997, sd) * 10.0);
  /* a cloud deck, lit from above, silver toward the sun, thinning toward the horizon */
  if (rd0.y > 0.015) { let t = (520.0 - r.camPos.y) / rd0.y; if (t > 0.0) { let cp = r.camPos + rd0 * t; let d = smoothstep(0.48, 0.74, fbm3(cp.xz * 0.0035 + vec2f(r.time * 0.012, 0.0)) + 0.25 * fbm3(cp.xz * 0.012));
    let lit = mix(r.fog * 0.75, vec3f(1.0), 0.5 + 0.5 * max(r.sun.y, 0.0)) * r.sunC + r.sunC * pow(sd, 6.0) * 0.5; c = mix(c, lit, d * smoothstep(0.015, 0.14, rd0.y) * 0.85); } }
  return c; }
/* aerial perspective: density falls off with height and is integrated along the ray in
   closed form; blue goes first, so distance turns to the air's colour, warmed toward the sun */
fn atmo(col: vec3f, ro: vec3f, rd: vec3f, dist: f32) -> vec3f { let Hs = 90.0; let d0 = 0.00024 + r.wet * 0.0011; let y0 = max(ro.y, 0.0); let k = rd.y / Hs;
  var od = d0 * exp(-y0 / Hs) * dist; if (abs(k) > 1e-5) { od = d0 * exp(-y0 / Hs) * (1.0 - exp(-k * dist)) / k; }
  od += dist * 0.00004;
  let ext = exp(-od * vec3f(0.62, 0.84, 1.2)); let sd = max(dot(rd, r.sun), 0.0);
  let ins = mix(r.fog, r.sky, 0.22) * 1.04 + r.sunC * (0.8 * pow(sd, 10.0) + 0.2 * pow(sd, 3.0));
  return col * ext + ins * (1.0 - ext); }
fn aces(x: vec3f) -> vec3f { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), vec3f(0.0), vec3f(1.0)); }
@fragment fn fs(o: VO) -> @location(0) vec4f {
  let ndc = vec2f(o.uv.x * 2.0 - 1.0, 1.0 - o.uv.y * 2.0); let tf = tan(r.fov * 0.5);
  let rd = normalize(r.camF + r.camR * ndc.x * tf * r.aspect + r.camU * ndc.y * tf); let ro = r.camPos;
  let seaY = r.sea * HS; var col: vec3f; var dist = 4000.0; var isSky = false;
  let tg = march(ro, rd, 4000.0);
  var tw = -1.0; if (rd.y < 0.0) { tw = (seaY - ro.y) / rd.y; }
  let hitWater = tw > 0.0 && (tg < 0.0 || tw < tg);
  let hv = normalize(r.sun - rd);
  if (hitWater) { dist = tw; let p = ro + rd * tw; let T = r.time;
    /* water: two scales of wave, the small one fading once a pixel covers a wave */
    let wf = 1.0 / (1.0 + tw * r.pxA * 2.0);
    let wn = normalize(vec3f((fbm3(p.xz * 0.5 + vec2f(T * 0.6, T * 0.2)) - 0.5) * wf * 0.9 + (fbm3(p.xz * 0.07 + T * 0.12) - 0.5) * 0.8, 2.4,
      (fbm3(p.xz * 0.5 - vec2f(T * 0.5, -T * 0.3) + 9.0) - 0.5) * wf * 0.9 + (fbm3(p.xz * 0.07 - T * 0.1 + 4.0) - 0.5) * 0.8));
    /* past the map the bed keeps falling away from the last row, rather than stepping down */
    let ob = length(max(abs(p.xz - vec2f(MW, MH) * 0.5) - vec2f(MW, MH) * 0.5 + 1.0, vec2f(0.0)));
    let depth = max(seaY - hgt(clamp(p.xz, vec2f(1.0), vec2f(MW, MH) - 2.0)) + ob * 0.4, 0.0);
    let cosv = max(dot(-rd, wn), 0.0); let fr = 0.02 + 0.98 * pow(1.0 - cosv, 5.0);
    var rdir = reflect(rd, wn); rdir.y = abs(rdir.y); let refl = skyCol(rdir);
    let sh = shadow(p + vec3f(0.0, 0.6, 0.0), r.sun, 10.0);
    let lightW = r.sunC * max(r.sun.y, 0.1) * sh * 1.7 + r.sky * 0.45;
    /* the bed shows through the shallows, red absorbed first */
    let absorb = exp(-depth * vec3f(0.36, 0.15, 0.11));
    let bed = vec3f(0.34, 0.30, 0.20) * lightW; let deep = r.seaC * (1.6 + 2.2 * lightW);
    let body = mix(deep, bed, absorb);
    let nh = max(dot(wn, hv), 0.0); let spec = pow(nh, 700.0) * 16.0 * wf + pow(nh, 70.0) * 0.22;
    col = mix(body, refl, fr) + r.sunC * spec * sh;
    /* foam: a broken band along the shore that breathes with the surf */
    let fo = vn(p.xz * 0.35 + vec2f(T * 0.3, 0.0)) * 0.6 + vn(p.xz * 1.3 - T * 0.4) * 0.4;
    let band = 1.0 - smoothstep(0.0, 2.4, depth + (fo - 0.5) * 1.8);
    let surge = 0.55 + 0.45 * sin(depth * 2.6 - T * 1.8 + fo * 5.0);
    let foam = band * smoothstep(0.3, 0.72, fo * surge + band * 0.35) * smoothstep(0.0, 0.25, depth);
    col = mix(col, lightW * 0.9, clamp(foam, 0.0, 1.0) * 0.65 * clamp(wf * 1.6, 0.0, 1.0));
  } else if (tg > 0.0) { dist = tg; let p = ro + rd * tg; let lod = tg * r.pxA; var n = normalAt(p.xz, max(1.0, lod * 1.4)); let uv = p.xz / vec2f(MW, MH);
    /* a fine bump so rock reads as rock up close, gone once a pixel is wider than the bump */
    let bump = vec3f(fbm3(p.xz * 0.9) - 0.5, 0.0, fbm3(p.xz * 0.9 + 31.0) - 0.5) * 0.35 * smoothstep(0.15, 0.5, 1.0 - n.y) * (1.0 - smoothstep(0.8, 2.5, lod)); n = normalize(n + bump);
    let w = biomeW(uv, fbm3(uv * 6.0) - 0.5); let hh = p.y / HS; let a = clamp((hh - r.sea) / max(1e-3, 1.0 - r.sea), 0.0, 1.0); let steep = 1.0 - n.y; let f = flw(p.xz);
    let gr = fbm3(p.xz * 0.35); let fine = fbm3(p.xz * 2.0);
    /* materials per biome, then blended by the weights under this point */
    var arch = mix(vec3f(0.36, 0.52, 0.24), vec3f(0.52, 0.60, 0.32), gr); arch = mix(arch, vec3f(0.60, 0.54, 0.46), smoothstep(0.25, 0.55, steep)); arch = mix(vec3f(0.78, 0.72, 0.54), arch, smoothstep(0.0, 0.05, a));
    var cany = mix(vec3f(0.74, 0.40, 0.22), vec3f(0.92, 0.64, 0.40), fract(hh * 14.0) * 0.5 + fine * 0.5); cany = mix(cany, vec3f(0.48, 0.30, 0.22), smoothstep(0.5, 0.8, steep));
    var ice = mix(vec3f(0.94, 0.96, 0.99), vec3f(0.72, 0.84, 0.95), fine * 0.6); ice = mix(ice, vec3f(0.42, 0.46, 0.52), smoothstep(0.55, 0.85, steep));
    var volc = mix(vec3f(0.14, 0.13, 0.12), vec3f(0.30, 0.27, 0.25), fine); let glow = smoothstep(0.66, 0.78, hh) * (0.6 + 0.4 * sin(r.time * 2.0 + fine * 9.0)); volc = mix(volc, vec3f(0.22, 0.44, 0.22), smoothstep(0.35, 0.6, gr) * (1.0 - steep) * 0.6); volc += vec3f(1.2, 0.30, 0.04) * glow * (1.0 - smoothstep(0.0, 0.5, steep));
    var jung = mix(vec3f(0.16, 0.36, 0.14), vec3f(0.36, 0.58, 0.22), gr); jung = mix(jung, vec3f(0.42, 0.40, 0.34), smoothstep(0.55, 0.85, steep)); jung = mix(jung, vec3f(0.92, 0.94, 0.96), smoothstep(0.80, 0.94, hh));
    var alb = arch * w[0] + cany * w[1] + ice * w[2] + volc * w[3] + jung * w[4]; alb = alb * alb; /* display → linear */
    var wetS = w[2] * 0.5 + w[3] * 0.3;
    if (f > 26.0) { let rv = smoothstep(26.0, 110.0, f) * 0.7 * (1.0 - w[2]) * (1.0 - w[1] * 0.7) * smoothstep(0.0, 0.06, a); alb = mix(alb, mix(alb * 0.5, r.seaC * 3.0, 0.6), rv); wetS += rv; }
    let sh = shadow(p + n * 1.2, r.sun, 9.0); let nd = max(dot(n, r.sun), 0.0);
    /* cloud shadow drifting over everything */
    let cl = smoothstep(0.45, 0.7, fbm3(p.xz * 0.012 + r.time * 0.015));
    let ao = occ(p); let bdir = normalize(vec3f(-r.sun.x, 0.0, -r.sun.z) + vec3f(0.0, 0.001, 0.0));
    let light = r.sunC * nd * sh * (1.0 - cl * 0.55) * 1.75 + r.sky * (0.5 + 0.5 * n.y) * ao * 0.5 + alb * r.sunC * max(dot(n, bdir), 0.0) * 0.35 * ao + r.fog * 0.04 * ao;
    col = alb * light;
    /* ice, glass and rivers catch the sun */
    col += r.sunC * pow(max(dot(n, hv), 0.0), 56.0) * wetS * sh * (1.0 - cl * 0.55) * 0.45;
    if (w[3] > 0.5) { col += vec3f(1.2, 0.30, 0.04) * glow * w[3] * 0.4; }
  } else { col = skyCol(rd); isSky = true; }
  if (!isSky) { col = atmo(col, ro, rd, dist); }
  /* grade: filmic curve, a touch of saturation, cool shadows and warm highlights */
  col = aces(col * 1.05);
  let l = dot(col, vec3f(0.2126, 0.7152, 0.0722)); col = max(mix(vec3f(l), col, 1.1), vec3f(0.0));
  col += vec3f(0.014, 0.004, -0.012) * smoothstep(0.45, 1.0, l) + vec3f(-0.008, 0.0, 0.012) * (1.0 - smoothstep(0.0, 0.3, l));
  col = pow(max(col, vec3f(0.0)), vec3f(1.0 / 2.2));
  let vig = 1.0 - 0.16 * dot(ndc * vec2f(0.75, 1.0), ndc * vec2f(0.75, 1.0));
  /* dither, so the sky gradient does not band on an 8-bit target */
  let dz = (hash(o.p.xy + vec2f(fract(r.time * 7.0) * 97.0, 0.0)) - 0.5) / 255.0;
  return vec4f(col * vig + dz, 1.0);
}`;

const NAMES = ['Ashmere', 'Corvane', 'Isle of Dunmar', 'Sellith', 'Harrowgate', 'Vell', 'Tarn Morrow', 'Oskerry', 'Brindle Reach', 'Yarrowfell', 'Calder', 'Nethe'];
const lerp = (a, b, t) => a + (b - a) * t, ease = (t) => t * t * (3 - 2 * t), v3lerp = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/* word-wrap for the field guide */
function wrap(ui, text, size, width, o) { const words = text.split(' '), lines = []; let line = ''; for (const w of words) { const t = line ? line + ' ' + w : w; if (ui.measure(t, size, o) > width && line) { lines.push(line); line = w; } else line = t; } if (line) lines.push(line); return lines; }

/* march quality: steps are uniforms, not WGSL constants (see the MARCH note) */
const STEPS = 240, SH_STEPS = 36;
/* the scene renders at a fraction of the canvas's device pixels; the fraction follows the
   measured march pass, so the picture is as sharp as this machine can hold at frame rate */
const SCALE = { min: 0.5, max: 1.0, start: 0.8, fixed: 0.75, slow: 6.5, fast: 3.2 };

export function tesseraApp() {
  let dev = null, ui = null, s = null, seed = 412, sea = 0.42, erosion = 24, dirty = true, hover = null, sliding = null;
  let at = -1, from = -1, flightT = 1, flightDur = 3.2, lastTouch = 0, orbit = 0, heights = [0.5, 0.5, 0.5, 0.5, 0.5], pinsOn = [], worldName = '—', rd = {};
  let scale = SCALE.start, scaleAt = 0, frames = 0, sc = 1, trk = [0, 1];
  const OVERVIEW = { sun: [-0.35, 0.6, 0.35], sunC: [1.0, 0.94, 0.86], fog: [0.72, 0.76, 0.80], sky: [0.50, 0.64, 0.82], sea: [0.06, 0.16, 0.22], wet: 0.0 };
  const C = { ink: [0.96, 0.96, 0.94, 1], dim: [0.74, 0.76, 0.78, 1], acc: [0.55, 0.85, 0.80, 1], glass: [0.05, 0.06, 0.08, 0.34], glassHi: [0.05, 0.06, 0.08, 0.6], line: [1, 1, 1, 0.12], cell: [1, 1, 1, 0.08], cellHi: [1, 1, 1, 0.18] };
  /* Tessera edits (2026-09-17): the UI is laid out in CSS pixels on the slide, not in display
     points, so type and panels hold one size however the shell scales the device. P(px) → points. */
  const P = (px) => px / sc;
  const goTo = (k, user) => { if (k === at || flightT < 1) return; from = at; at = k; flightT = 0; if (user) lastTouch = performance.now(); };
  const poseOf = (k, T) => { if (k < 0) { return { pos: [W * 0.5, 820, H * 1.18], tgt: [W * 0.5, 0, H * 0.44], fov: 0.78 }; }
    const p = PLACES[k], cx = p.u * W, cz = p.v * H, cy = Math.max(sea, heights[k]) * HS; const a = orbit + k * 1.3;
    return { pos: [cx + Math.cos(a) * 210, cy + 70 + 18 * Math.sin(T * 0.11 + k), cz + Math.sin(a) * 210], tgt: [cx, cy + 14, cz], fov: 0.95 }; };
  const atmoOf = (k) => k < 0 ? OVERVIEW : { ...PLACES[k], wet: [0.5, 0.08, 0.25, 0.5, 0.8][k] };
  /* a deferred draw list, so a glass panel can be sized to its content and still sit under it */
  const panel = () => { const ops = []; return { ops, add: (f) => ops.push(f), run: () => ops.forEach((f) => f()) }; };
  const ms = (k) => rd[k] !== undefined ? rd[k].toFixed(2) : '—';
  const draw = (now) => { const T = now / 1000;
    /* pins, on the map */
    if (at < 0 && flightT >= 1) PLACES.forEach((p, k) => { const q = pinsOn[k]; if (!q) return; const hot = hover === 'pin' + k;
      ui.ring(q[0], q[1], P(5.5 + 1.2 * Math.sin(T * 3 + k)), [...C.acc.slice(0, 3), 0.55], P(1)); ui.disc(q[0], q[1], P(2.6), C.acc);
      const fz = P(10), w = ui.measure(p.name, fz, { weight: 600 }) + P(12), h = P(16), ty = q[1] + P(8);
      ui.glass(q[0] - w / 2, ty, w, h, hot ? C.glassHi : C.glass, h / 2, 0.06); ui.text(q[0], ty + (h - fz * 1.25) / 2 + P(0.5), p.name, fz, C.ink, { align: 'center', weight: 600 });
      ui.hit('pin' + k, q[0] - w / 2, q[1] - P(10), w, P(36)); });
    /* the field guide, at a place: bottom-left, sized to what it says */
    if (at >= 0) { const p = PLACES[at]; const kk = Math.min(1, flightT * 1.6), op = kk; const gw = P(330), gx = P(10), pad = P(10), L = gx + pad, Rr = gx + gw - pad;
      const g = panel(); let y = pad; let gy = 0;
            { const yy = y; g.add(() => { ui.text(L, gy + yy, p.name, P(16), C.ink, { weight: 750, track: -0.01, op }); ui.text(Rr, gy + yy + P(4), `${at + 1} / 5`, P(10), C.dim, { family: MONO, align: 'right', op }); }); } y += P(21);
      { const yy = y; g.add(() => ui.text(L, gy + yy, p.kind.toUpperCase(), P(10), C.acc, { weight: 600, track: 0.1, op })); } y += P(13);
      wrap(ui, p.clim, P(10), gw - 2 * pad, { family: MONO }).forEach((ln) => { const yy = y; g.add(() => ui.text(L, gy + yy, ln, P(10), C.dim, { family: MONO, op })); y += P(13); }); y += P(5);
      wrap(ui, p.text, P(11), gw - 2 * pad, {}).forEach((ln) => { const yy = y; g.add(() => ui.text(L, gy + yy, ln, P(11), C.ink, { op })); y += P(14); }); y += P(3);
      wrap(ui, p.species.join(' · '), P(10), gw - 2 * pad, {}).forEach((ln) => { const yy = y; g.add(() => ui.text(L, gy + yy, ln, P(10), C.acc, { op })); y += P(13); }); y += P(8);
      { const yy = y, bw = (gw - 2 * pad - P(6)) / 2, bh = P(20);
        g.add(() => { const by = gy + yy;
          ui.rect(L, by, bw, bh, hover === 'back' ? C.cellHi : C.cell, bh / 2, op); ui.text(L + bw / 2, by + (bh - P(10.5) * 1.25) / 2, '← Map', P(10.5), C.ink, { align: 'center', weight: 600, op }); ui.hit('back', L, by, bw, bh);
          ui.rect(L + bw + P(6), by, bw, bh, hover === 'next' ? C.cellHi : C.cell, bh / 2, op); ui.text(L + bw + P(6) + bw / 2, by + (bh - P(10.5) * 1.25) / 2, 'Next place →', P(10.5), C.ink, { align: 'center', weight: 600, op }); ui.hit('next', L + bw + P(6), by, bw, bh); });
        y += bh; }
      const gh = y + pad; gy = ui.H - P(10) - gh + (1 - kk) * P(8);
      ui.glass(gx, gy, gw, gh, C.glass, P(12), 0.07, op); g.run(); }
    /* the panel: top-left (Key), above the field guide — one header row, two sliders, two measured lines */
    { const pw = P(152), px = P(10), py = P(10), pad = P(9), L = px + pad, Rr = px + pw - pad, g = panel(); let y = py + pad;
      { const bh = P(16), bt = 'New world', bw = ui.measure(bt, P(10), { weight: 650 }) + P(14), bx = Rr - bw, by = y - P(1.5);
        g.add(() => { ui.text(L, py + pad, 'TESSERA', P(11), C.ink, { weight: 800, track: 0.14 });
          ui.rect(bx, by, bw, bh, [...C.acc.slice(0, 3), hover === 'grow' ? 0.36 : 0.16], bh / 2); ui.stroke(bx, by, bw, bh, [...C.acc.slice(0, 3), 0.6], bh / 2, P(1));
          ui.text(bx + bw / 2, by + (bh - P(10) * 1.25) / 2, bt, P(10), [0.82, 0.97, 0.94, 1], { align: 'center', weight: 650 }); ui.hit('grow', bx - P(4), by - P(4), bw + P(8), bh + P(8)); }); }
      y += P(16);
      { const yy = y; g.add(() => ui.text(L, yy, `${worldName} · seed ${seed}`, P(10), C.dim, { family: MONO })); } y += P(18);
      trk = [L + P(4), pw - 2 * pad - P(8)];
      const slider = (label, val, id, fmt) => { const yy = y; g.add(() => { ui.text(L, yy, label, P(10), C.dim, { weight: 600, track: 0.08 }); ui.text(Rr, yy, fmt, P(10), C.ink, { align: 'right', family: MONO });
          const ty = yy + P(16), kx = trk[0] + val * trk[1], hot = hover === id || sliding === id; ui.rect(trk[0], ty - P(0.75), trk[1], P(1.5), [1, 1, 1, 0.22], P(0.75)); ui.rect(trk[0], ty - P(0.75), kx - trk[0], P(1.5), C.acc, P(0.75));
          ui.disc(kx, ty, P(hot ? 5 : 4), [1, 1, 1, 1]); ui.hit(id, trk[0] - P(8), yy + P(4), trk[1] + P(16), P(22)); }); y += P(26); };
      slider('SEA LEVEL', (sea - 0.2) / 0.45, 'sea', sea.toFixed(2)); slider('EROSION', erosion / 64, 'ero', erosion + ' passes');
      { const yy = y; g.add(() => ui.rect(L, yy, pw - 2 * pad, P(1), C.line)); } y += P(6);
      const grow = ['noise', 'flow', 'carve'].every((k) => rd[k] !== undefined) ? (rd.noise + rd.flow + rd.carve).toFixed(2) : '—';
      [['grow', grow, C.ink], [`march ${Math.round(scale * 100)}%`, ms('march'), C.acc]].forEach(([lab, v, c]) => { const yy = y;
        g.add(() => { ui.text(L, yy, lab, P(10), C.dim, { family: MONO }); ui.text(Rr, yy, v + ' ms', P(10), c, { align: 'right', family: MONO }); }); y += P(13); });
      ui.glass(px, py, pw, y - py + pad - P(3), C.glass, P(11), 0.07); g.run(); } };
  const setSlider = (id, px) => { const v = Math.max(0, Math.min(1, (px - trk[0]) / trk[1])); if (id === 'sea') sea = 0.2 + v * 0.45; else erosion = Math.round(v * 64); dirty = true; lastTouch = performance.now(); };
  const act = (id) => { if (!id) return; if (id.startsWith('pin')) goTo(+id.slice(3), true); if (id === 'back') goTo(-1, true); if (id === 'next') goTo((at + 1) % 5, true); if (id === 'grow') { seed = Math.floor(Math.random() * 100000); dirty = true; lastTouch = performance.now(); } };
  return { init(d, host) { dev = d; ui = host.ui; const cells = W * H;
      const height = storage(cells * 4), flow = [storage(cells * 4), storage(cells * 4)]; const u = uniform(32), ru = uniform(160);
      const pN = compute(NOISE), pF = compute(FLOW), pC = compute(CARVE), pM = render(MARCH);
      const gN = bind(pN, [u, height]), gF = [bind(pF, [u, height, flow[0], flow[1]]), bind(pF, [u, height, flow[1], flow[0]])], gC = [bind(pC, [u, flow[1], height]), bind(pC, [u, flow[0], height])], gM = [bind(pM, [ru, height, flow[0]]), bind(pM, [ru, height, flow[1]])];
      const tm = timer(['noise', 'flow', 'carve', 'march'], 4); const hRead = readback(64);
      if (!tm.available) scale = SCALE.fixed;
      s = { u, ru, pN, pF, pC, pM, gN, gF, gC, gM, tm, height, flow, hRead, cur: 0, reading: false }; dirty = true; lastTouch = performance.now(); },
    down(p, id) { if (id === 'sea' || id === 'ero') { sliding = id; setSlider(id, p.x); } lastTouch = performance.now(); },
    move(p, hov) { hover = hov; if (sliding) setSlider(sliding, p.x); }, up(p, id, same) { sliding = null; if (same) act(id); }, leave() { sliding = null; hover = null; },
    destroy() { s.height.destroy(); s.flow.forEach((b) => b.destroy()); s.u.destroy(); s.ru.destroy(); s.hRead.destroy(); s = null; },
    frame(t, dt, now, hov) { if (!s) return; hover = hov; const T = now / 1000, gx = Math.ceil(W / 16), gy = Math.ceil(H / 16);
      /* CSS px per display point: the UI surface is either a canvas on the page or a texture the size
         of the display in device pixels (the sphere-traced Duo), so measure whichever it is */
      if (frames++ % 30 === 0) { const c = ui.canvas, bw = c.getBoundingClientRect ? c.getBoundingClientRect().width : c.width / DPR; sc = bw > 0 ? Math.max(0.35, bw / ui.W) : 1; }
      /* follow the measured march: coarser when it runs long, sharper when there is room */
      if (s.tm.available && rd.march !== undefined && now - scaleAt > 1200) { if (rd.march > SCALE.slow && scale > SCALE.min) { scale = Math.max(SCALE.min, scale - 0.1); scaleAt = now; } else if (rd.march < SCALE.fast && scale < SCALE.max) { scale = Math.min(SCALE.max, scale + 0.1); scaleAt = now; } }
      const tgt = ui.prepare(scale);
      const enc = dev.createCommandEncoder();
      if (dirty) {
        dirty = false; const U = new ArrayBuffer(32), Ui = new Uint32Array(U), Uf = new Float32Array(U); Ui[0] = W; Ui[1] = H; Ui[2] = seed; Uf[4] = sea; Uf[5] = erosion / 24; dev.queue.writeBuffer(s.u, 0, U);
        let pass = enc.beginComputePass(s.tm.begin(0)); pass.setPipeline(s.pN); pass.setBindGroup(0, s.gN); pass.dispatchWorkgroups(gx, gy); pass.end();
        const rounds = Math.max(1, Math.round(erosion / 8)); s.cur = 0;
        for (let k = 0; k < rounds; k++) {
          pass = enc.beginComputePass(s.tm.begin(1)); pass.setPipeline(s.pF); for (let i = 0; i < 10; i++) { pass.setBindGroup(0, s.gF[s.cur]); pass.dispatchWorkgroups(gx, gy); s.cur ^= 1; } pass.end();
          if (erosion > 0) { pass = enc.beginComputePass(s.tm.begin(2)); pass.setPipeline(s.pC); for (let i = 0; i < 8; i++) { pass.setBindGroup(0, s.gC[s.cur]); pass.dispatchWorkgroups(gx, gy); } pass.end(); }
        }
        pass = enc.beginComputePass(s.tm.begin(1)); pass.setPipeline(s.pF); for (let i = 0; i < 14; i++) { pass.setBindGroup(0, s.gF[s.cur]); pass.dispatchWorkgroups(gx, gy); s.cur ^= 1; } pass.end();
        if (!s.reading) { PLACES.forEach((p, k) => enc.copyBufferToBuffer(s.height, (Math.round(p.v * H) * W + Math.round(p.u * W)) * 4, s.hRead, k * 4, 4)); s.reading = true; }
        worldName = NAMES[seed % NAMES.length];
      }
      if (flightT < 1) flightT = Math.min(1, flightT + dt / flightDur);
      orbit += dt * 0.05;
      /* the tour starts soon after opening and dwells long enough to read (Key: less waiting) */
      const idle = (now - lastTouch) / 1000; if (flightT >= 1 && idle > (at < 0 ? 2.5 : 9)) { lastTouch = now; goTo(at < 0 ? 0 : at === 4 ? -1 : at + 1, false); }
      const k = ease(flightT), A = poseOf(from, T), B = poseOf(at, T);
      const pos = v3lerp(A.pos, B.pos, k), tg = v3lerp(A.tgt, B.tgt, k), fov = lerp(A.fov, B.fov, k);
      if (from >= 0 && at >= 0) pos[1] += Math.sin(k * Math.PI) * 260;
      const F = norm([tg[0] - pos[0], tg[1] - pos[1], tg[2] - pos[2]]), Rt = norm(cross(F, [0, 1, 0])), Up = cross(Rt, F);
      const aa = atmoOf(from), ab = atmoOf(at), mixA = (key) => v3lerp(aa[key], ab[key], k).map((c) => Math.pow(c, 2.2));
      const RB = new ArrayBuffer(160), Rf = new Float32Array(RB); const aspect = tgt.w / tgt.h;
      Rf.set(pos, 0); Rf[3] = fov; Rf.set(F, 4); Rf[7] = sea; Rf.set(Rt, 8); Rf[11] = T; Rf.set(Up, 12); Rf[15] = aspect;
      Rf.set(norm(v3lerp(aa.sun, ab.sun, k)), 16); Rf[19] = k; Rf.set(mixA('sunC'), 20); Rf[23] = at; Rf.set(mixA('fog'), 24); Rf[27] = lerp(aa.wet, ab.wet, k); Rf.set(mixA('sky'), 28); Rf[31] = STEPS; Rf.set(mixA('sea'), 32); Rf[35] = SH_STEPS;
      Rf[36] = 2 * Math.tan(fov / 2) / Math.max(1, tgt.h); /* the angle one scene pixel covers, for level of detail */
      dev.queue.writeBuffer(s.ru, 0, RB);
      const rp = enc.beginRenderPass({ colorAttachments: [{ view: tgt.view, loadOp: 'clear', storeOp: 'store' }], ...s.tm.begin(3) });
      rp.setPipeline(s.pM); rp.setBindGroup(0, s.gM[s.cur]); rp.draw(3); rp.end(); s.tm.resolve(enc);
      /* project the five places to points for the pins */
      const tf = Math.tan(fov / 2);
      pinsOn = PLACES.map((p, i) => { const wp = [p.u * W, Math.max(sea, heights[i]) * HS, p.v * H], v = [wp[0] - pos[0], wp[1] - pos[1], wp[2] - pos[2]]; const z = v[0] * F[0] + v[1] * F[1] + v[2] * F[2]; const x = (v[0] * Rt[0] + v[1] * Rt[1] + v[2] * Rt[2]) / (z * tf * aspect), y = (v[0] * Up[0] + v[1] * Up[1] + v[2] * Up[2]) / (z * tf);
        return z > 0 && Math.abs(x) < 1 && Math.abs(y) < 1 ? [(x + 1) * 0.5 * ui.W, (1 - y) * 0.5 * ui.H] : null; });
      const r = s.tm.read(); Object.keys(r).forEach((k2) => { rd[k2] = r[k2]; });
      draw(now); ui.compose(enc); dev.queue.submit([enc.finish()]);
      if (s.reading && !s.mapping) { s.mapping = true; s.hRead.mapAsync(GPUMapMode.READ).then(() => { if (!s) return; heights = Array.from(new Float32Array(s.hRead.getMappedRange().slice(0, 20))); s.hRead.unmap(); s.reading = false; s.mapping = false; }).catch(() => { if (s) { s.reading = false; s.mapping = false; } }); } } };
}
