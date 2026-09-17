// @ts-nocheck -- copied from design/techniques/webgpu/; untyped sheet code
/* §5 · TESSERA — one grown world, five places in it. The heights come from
   a compute chain (biome-blended noise → flow routing → stream-power carving)
   and the picture is a ray march through that height buffer: sun, soft
   shadow, water, height fog, per-biome air. The map is the same march from
   high up; a click flies the camera down into a place and a field guide
   slides over it. Going somewhere on this site is travelling. */
import { storage, uniform, readback, compute, render, bind, timer, FSQ_VS } from './common.js';
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
const MARCH = FSQ_VS + COMMON + `
struct R { camPos: vec3f, fov: f32, camF: vec3f, sea: f32, camR: vec3f, time: f32, camU: vec3f, aspect: f32,
  sun: vec3f, focus: f32, sunC: vec3f, place: f32, fog: vec3f, wet: f32, sky: vec3f, pad0: f32, seaC: vec3f, pad1: f32 };
@group(0) @binding(0) var<uniform> r: R;
@group(0) @binding(1) var<storage, read> height: array<f32>;
@group(0) @binding(2) var<storage, read> flow: array<f32>;
const HS = ${HS}.0; const MW = ${W}.0; const MH = ${H}.0;
fn H2(x: i32, y: i32) -> f32 { if (x < 0 || y < 0 || x >= ${W} || y >= ${H}) { return -0.2; } return height[u32(y) * ${W}u + u32(x)]; }
fn hgt(p: vec2f) -> f32 { let f = floor(p); let t = p - f; let x = i32(f.x); let y = i32(f.y);
  return mix(mix(H2(x, y), H2(x + 1, y), t.x), mix(H2(x, y + 1), H2(x + 1, y + 1), t.x), t.y) * HS; }
fn flw(p: vec2f) -> f32 { let x = clamp(i32(p.x), 0, ${W - 1}); let y = clamp(i32(p.y), 0, ${H - 1}); return flow[u32(y) * ${W}u + u32(x)]; }
fn hash(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }
fn vn(p: vec2f) -> f32 { let i = floor(p); var f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2f(1, 0)), f.x), mix(hash(i + vec2f(0, 1)), hash(i + vec2f(1, 1)), f.x), f.y); }
fn fbm3(p0: vec2f) -> f32 { var p = p0; var a = 0.5; var s = 0.0; for (var i = 0; i < 4; i++) { s += a * vn(p); a *= 0.5; p = p * 2.1 + 1.7; } return s; }
fn normalAt(p: vec2f) -> vec3f { let e = 1.0; let dx = hgt(p + vec2f(e, 0.0)) - hgt(p - vec2f(e, 0.0)); let dz = hgt(p + vec2f(0.0, e)) - hgt(p - vec2f(0.0, e)); return normalize(vec3f(-dx, 2.0 * e, -dz)); }
/* march the height field: coarse steps that grow with distance, then bisect */
fn march(ro: vec3f, rd: vec3f, tmax: f32) -> f32 { var t = 1.0; var lt = 1.0;
  for (var i = 0; i < 300; i++) { let p = ro + rd * t; if (p.y > HS * 1.6 && rd.y > 0.0) { return -1.0; } let h = hgt(p.xz);
    if (p.y < h) { /* bisect between the last clear sample and this one */ var a = lt; var b = t; for (var j = 0; j < 6; j++) { let m = 0.5 * (a + b); let q = ro + rd * m; if (q.y < hgt(q.xz)) { b = m; } else { a = m; } } return 0.5 * (a + b); }
    lt = t; t += max(0.5, t * 0.025); if (t > tmax) { break; } } return -1.0; }
/* soft shadow: walk toward the sun and keep the smallest clearance over the
   ground, skipping the first few units so a slope does not shadow itself */
fn shadow(ro: vec3f, rd: vec3f) -> f32 { var t = 6.0; var s = 1.0; for (var i = 0; i < 28; i++) { let p = ro + rd * t; if (p.y > HS * 1.2) { break; } let h = hgt(p.xz); s = min(s, 6.0 * (p.y - h) / t); if (s < 0.0) { return 0.0; } t += clamp(p.y - h, 1.5, 14.0); } return clamp(s, 0.0, 1.0); }
fn skyCol(rd: vec3f) -> vec3f { let up = clamp(rd.y, 0.0, 1.0); var c = mix(r.fog * 1.15, r.sky, pow(up, 0.45)); let sd = max(dot(rd, r.sun), 0.0); c += r.sunC * (pow(sd, 6.0) * 0.22 + pow(sd, 400.0) * 2.0);
  /* a cloud deck, lit from above, thinning toward the horizon */
  if (rd.y > 0.015) { let t = (520.0 - r.camPos.y) / rd.y; if (t > 0.0) { let cp = r.camPos + rd * t; let d = smoothstep(0.48, 0.72, fbm3(cp.xz * 0.0035 + vec2f(r.time * 0.012, 0.0)) + 0.25 * fbm3(cp.xz * 0.012)); let lit = mix(r.fog * 0.8, vec3f(1.0), 0.5 + 0.5 * max(dot(vec3f(0.0, 1.0, 0.0), r.sun), 0.0)); c = mix(c, lit * r.sunC, d * smoothstep(0.015, 0.12, rd.y) * 0.85); } }
  return c; }
@fragment fn fs(o: VO) -> @location(0) vec4f {
  let ndc = vec2f(o.uv.x * 2.0 - 1.0, 1.0 - o.uv.y * 2.0); let tf = tan(r.fov * 0.5);
  let rd = normalize(r.camF + r.camR * ndc.x * tf * r.aspect + r.camU * ndc.y * tf); let ro = r.camPos;
  let seaY = r.sea * HS; var col: vec3f; var dist = 4000.0;
  let tg = march(ro, rd, 4000.0);
  var tw = -1.0; if (rd.y < 0.0) { tw = (seaY - ro.y) / rd.y; }
  let hitWater = tw > 0.0 && (tg < 0.0 || tw < tg);
  if (hitWater) { dist = tw; let p = ro + rd * tw;
    /* water: a little wave normal, depth colour, fresnel to the sky, sun glint */
    let wf = 1.0 / (1.0 + tw * 0.02); /* waves fade with distance, or they alias into glitter */
    let wn = normalize(vec3f((fbm3(p.xz * 0.5 + r.time * 0.6) - 0.5) * wf + (fbm3(p.xz * 0.08 + r.time * 0.15) - 0.5) * 1.2, 2.6, (fbm3(p.xz * 0.5 - r.time * 0.5 + 9.0) - 0.5) * wf + (fbm3(p.xz * 0.08 - r.time * 0.12) - 0.5) * 1.2));
    let depth = clamp((seaY - hgt(p.xz)) / 30.0, 0.0, 1.0);
    let base = mix(r.seaC * 6.0 + vec3f(0.02, 0.05, 0.04), r.seaC * 1.4, depth); let fr = pow(1.0 - max(dot(-rd, wn), 0.0), 4.0);
    let refl = skyCol(reflect(rd, wn)); let spec = pow(max(dot(reflect(-r.sun, wn), -rd), 0.0), 180.0) * 1.6 * wf;
    let sh = shadow(p + vec3f(0.0, 1.0, 0.0), r.sun);
    col = mix(base * (0.5 + 0.5 * sh), refl, 0.12 + 0.75 * fr) + r.sunC * spec * sh;
    /* shallows: the land shows through */
    if (depth < 0.35 && tg > 0.0) { col = mix(col, r.seaC * 3.0 + vec3f(0.25, 0.22, 0.15), (1.0 - depth / 0.35) * 0.45); }
  } else if (tg > 0.0) { dist = tg; let p = ro + rd * tg; var n = normalAt(p.xz); let uv = p.xz / vec2f(MW, MH);
    /* a fine bump so rock reads as rock up close */
    let bump = vec3f(fbm3(p.xz * 0.9) - 0.5, 0.0, fbm3(p.xz * 0.9 + 31.0) - 0.5) * 0.35 * smoothstep(0.15, 0.5, 1.0 - n.y); n = normalize(n + bump);
    let w = biomeW(uv, fbm3(uv * 6.0) - 0.5); let hh = p.y / HS; let a = clamp((hh - r.sea) / max(1e-3, 1.0 - r.sea), 0.0, 1.0); let steep = 1.0 - n.y; let f = flw(p.xz);
    let gr = fbm3(p.xz * 0.35); let fine = fbm3(p.xz * 2.0);
    /* materials per biome, then blended by the weights under this point */
    var arch = mix(vec3f(0.36, 0.52, 0.24), vec3f(0.52, 0.60, 0.32), gr); arch = mix(arch, vec3f(0.60, 0.54, 0.46), smoothstep(0.25, 0.55, steep)); arch = mix(vec3f(0.78, 0.72, 0.54), arch, smoothstep(0.0, 0.05, a));
    var cany = mix(vec3f(0.74, 0.40, 0.22), vec3f(0.92, 0.64, 0.40), fract(hh * 14.0) * 0.5 + fine * 0.5); cany = mix(cany, vec3f(0.48, 0.30, 0.22), smoothstep(0.5, 0.8, steep));
    var ice = mix(vec3f(0.94, 0.96, 0.99), vec3f(0.72, 0.84, 0.95), fine * 0.6); ice = mix(ice, vec3f(0.42, 0.46, 0.52), smoothstep(0.55, 0.85, steep));
    var volc = mix(vec3f(0.14, 0.13, 0.12), vec3f(0.30, 0.27, 0.25), fine); let glow = smoothstep(0.66, 0.78, hh) * (0.6 + 0.4 * sin(r.time * 2.0 + fine * 9.0)); volc = mix(volc, vec3f(0.22, 0.44, 0.22), smoothstep(0.35, 0.6, gr) * (1.0 - steep) * 0.6); volc += vec3f(1.2, 0.30, 0.04) * glow * (1.0 - smoothstep(0.0, 0.5, steep));
    var jung = mix(vec3f(0.16, 0.36, 0.14), vec3f(0.36, 0.58, 0.22), gr); jung = mix(jung, vec3f(0.42, 0.40, 0.34), smoothstep(0.55, 0.85, steep)); jung = mix(jung, vec3f(0.92, 0.94, 0.96), smoothstep(0.80, 0.94, hh));
    var alb = arch * w[0] + cany * w[1] + ice * w[2] + volc * w[3] + jung * w[4]; alb = alb * alb; /* display → linear */
    if (f > 26.0) { alb = mix(alb, r.seaC * 2.5, clamp((f - 26.0) / 60.0, 0.0, 0.8) * (1.0 - w[2]) * (1.0 - w[1] * 0.7)); }
    let sh = shadow(p + vec3f(0.0, 1.5, 0.0), r.sun); let nd = max(dot(n, r.sun), 0.0);
    /* cloud shadow drifting over everything */
    let cl = smoothstep(0.45, 0.7, fbm3(p.xz * 0.012 + r.time * 0.015));
    let light = r.sunC * nd * sh * (1.0 - cl * 0.55) * 1.4 + r.sky * (0.45 + 0.55 * n.y) * 0.35 + r.fog * 0.06;
    col = alb * light;
    if (w[3] > 0.5) { col += vec3f(1.2, 0.30, 0.04) * glow * w[3] * 0.4; }
  } else { col = skyCol(rd); }
  /* fog: thin with distance, thick where the ray runs low over the water */
  let hitY = select(ro.y + rd.y * dist, seaY, hitWater); let low = exp(-max(hitY, 0.0) / 70.0) * 0.6 + 0.4;
  let fa = 1.0 - exp(-dist * (0.00007 + r.wet * 0.0003) * low); let sd = max(dot(rd, r.sun), 0.0);
  let fogc = mix(r.fog, r.sunC, pow(sd, 8.0) * 0.5);
  if (dist < 3999.0) { col = mix(col, fogc, fa); }
  col = col / (1.0 + col * 0.35) * 1.12; /* soft shoulder */
  col = pow(max(col, vec3f(0.0)), vec3f(1.0 / 2.2));
  let vig = 1.0 - 0.25 * dot(ndc * vec2f(0.8, 1.0), ndc * vec2f(0.8, 1.0));
  return vec4f(col * vig, 1.0);
}`;

const NAMES = ['Ashmere', 'Corvane', 'Isle of Dunmar', 'Sellith', 'Harrowgate', 'Vell', 'Tarn Morrow', 'Oskerry', 'Brindle Reach', 'Yarrowfell', 'Calder', 'Nethe'];
const lerp = (a, b, t) => a + (b - a) * t, ease = (t) => t * t * (3 - 2 * t), v3lerp = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/* word-wrap for the field guide */
function wrap(ui, text, size, width, o) { const words = text.split(' '), lines = []; let line = ''; for (const w of words) { const t = line ? line + ' ' + w : w; if (ui.measure(t, size, o) > width && line) { lines.push(line); line = w; } else line = t; } if (line) lines.push(line); return lines; }

export function tesseraApp() {
  let dev = null, ui = null, s = null, seed = 412, sea = 0.42, erosion = 24, dirty = true, hover = null, sliding = null;
  let at = -1, from = -1, flightT = 1, flightDur = 3.2, lastTouch = 0, orbit = 0, heights = [0.5, 0.5, 0.5, 0.5, 0.5], pinsOn = [], worldName = '—', rd = {};
  const OVERVIEW = { sun: [-0.35, 0.6, 0.35], sunC: [1.0, 0.94, 0.86], fog: [0.72, 0.76, 0.80], sky: [0.50, 0.64, 0.82], sea: [0.06, 0.16, 0.22], wet: 0.0 };
  const C = { ink: [0.95, 0.95, 0.92, 1], dim: [0.70, 0.72, 0.74, 1], acc: [0.55, 0.85, 0.80, 1], glass: [0.06, 0.07, 0.09, 0.55], cell: [1, 1, 1, 0.1], cellHi: [1, 1, 1, 0.2] };
  const PX = 560, PW = 268, TRK = [PX + 22, PW - 44];
  const goTo = (k, user) => { if (k === at || flightT < 1) return; from = at; at = k; flightT = 0; if (user) lastTouch = performance.now(); };
  const poseOf = (k, T) => { if (k < 0) { return { pos: [W * 0.5, 820, H * 1.18], tgt: [W * 0.5, 0, H * 0.44], fov: 0.78 }; }
    const p = PLACES[k], cx = p.u * W, cz = p.v * H, cy = Math.max(sea, heights[k]) * HS; const a = orbit + k * 1.3;
    return { pos: [cx + Math.cos(a) * 210, cy + 70 + 18 * Math.sin(T * 0.11 + k), cz + Math.sin(a) * 210], tgt: [cx, cy + 14, cz], fov: 0.95 }; };
  const atmoOf = (k) => k < 0 ? OVERVIEW : { ...PLACES[k], wet: [0.5, 0.08, 0.25, 0.5, 0.8][k] };
  const slider = (y, label, val, id, fmt) => { ui.text(PX + 22, y, label, 9.5, C.dim, { weight: 600, track: 0.16 }); ui.text(PX + PW - 22, y, fmt, 10.5, C.ink, { align: 'right', family: MONO }); y += 22;
    ui.rect(TRK[0], y + 5, TRK[1], 3, [1, 1, 1, 0.15], 1.5); const kx = TRK[0] + val * TRK[1]; ui.rect(TRK[0], y + 5, kx - TRK[0], 3, C.acc, 1.5); ui.disc(kx, y + 6.5, 8, [1, 1, 1, 1]); ui.hit(id, TRK[0] - 10, y - 8, TRK[1] + 20, 30); return y + 34; };
  const draw = (now) => { const T = now / 1000;
    ui.text(24, 22, 'TESSERA', 14, C.ink, { weight: 800, track: 0.30 }); ui.text(24, 42, worldName + ' · seed ' + seed, 10.5, C.dim, { family: MONO });
    /* pins, on the map */
    if (at < 0 && flightT >= 1) PLACES.forEach((p, k) => { const q = pinsOn[k]; if (!q) return; const hot = hover === 'pin' + k; ui.disc(q[0], q[1], 5, C.acc); ui.ring(q[0], q[1], 9 + 3 * Math.sin(T * 3 + k), [...C.acc.slice(0, 3), 0.5], 1.5);
      const w = ui.measure(p.name, 11, { weight: 600 }) + 20; ui.glass(q[0] - w / 2, q[1] + 14, w, 24, hot ? [0.1, 0.12, 0.14, 0.85] : C.glass, 12, 0.1); ui.text(q[0], q[1] + 19, p.name, 11, C.ink, { align: 'center', weight: 600 }); ui.hit('pin' + k, q[0] - w / 2, q[1] - 12, w, 50); });
    /* the field guide, at a place */
    if (at >= 0) { const p = PLACES[at]; const k = Math.min(1, flightT * 1.6), op = k, yo = (1 - k) * 14; const gx = 24, gy = 292 + yo, gw = 400; ui.glass(gx, gy, gw, 310, C.glass, 22, 0.12, op);
      ui.text(gx + 22, gy + 20, `${at + 1} / 5`, 9.5, C.dim, { weight: 600, track: 0.16, family: MONO, op }); ui.text(gx + gw - 22, gy + 20, 'FIELD GUIDE', 9.5, C.dim, { weight: 600, track: 0.16, align: 'right', op });
      ui.text(gx + 22, gy + 40, p.name, 24, C.ink, { weight: 800, track: -0.02, op }); ui.text(gx + 22, gy + 74, p.kind.toUpperCase(), 9.5, C.acc, { weight: 600, track: 0.14, op }); ui.text(gx + 22, gy + 92, p.clim, 10.5, C.dim, { family: MONO, op });
      let y = gy + 116; wrap(ui, p.text, 12, gw - 44, {}).forEach((ln) => { ui.text(gx + 22, y, ln, 12, C.ink, { op }); y += 17; }); y += 8;
      let x = gx + 22; p.species.forEach((sp) => { const w = ui.measure(sp.toUpperCase(), 8.5, { weight: 600, track: 0.1 }) + 18; if (x + w > gx + gw - 22) { x = gx + 22; y += 26; } ui.stroke(x, y, w, 20, [1, 1, 1, 0.3], 10, 1, op); ui.text(x + 9, y + 5, sp.toUpperCase(), 8.5, C.ink, { weight: 600, track: 0.1, op }); x += w + 6; }); y += 34;
      const bw = (gw - 44 - 8) / 2; ui.rect(gx + 22, gy + 262, bw, 32, hover === 'back' ? C.cellHi : C.cell, 16, op); ui.text(gx + 22 + bw / 2, gy + 271, '← Back to the map', 11, C.ink, { align: 'center', weight: 600, op }); ui.hit('back', gx + 22, gy + 262, bw, 32);
      ui.rect(gx + 30 + bw, gy + 262, bw, 32, hover === 'next' ? C.cellHi : C.cell, 16, op); ui.text(gx + 30 + bw + bw / 2, gy + 271, 'Next place →', 11, C.ink, { align: 'center', weight: 600, op }); ui.hit('next', gx + 30 + bw, gy + 262, bw, 32); }
    /* the panel */
    ui.glass(PX, 60, PW, 350, C.glass, 24, 0.12); let y = 84; ui.text(PX + 22, y, 'A WORLD INSTEAD OF A WEBSITE', 9.5, C.dim, { weight: 600, track: 0.16 }); y += 18; ui.text(PX + 22, y, 'Click a place to travel there.', 12, C.ink); y += 30;
    ui.rect(PX + 22, y, PW - 44, 36, hover === 'grow' ? [0.55, 0.85, 0.80, 1] : C.acc, 18); ui.text(PX + PW / 2, y + 10, 'Grow another world', 12, [0.05, 0.08, 0.09, 1], { align: 'center', weight: 700 }); ui.hit('grow', PX + 22, y, PW - 44, 36); y += 54;
    y = slider(y, 'SEA LEVEL', (sea - 0.2) / 0.45, 'sea', sea.toFixed(2)); y = slider(y, 'EROSION', erosion / 64, 'ero', erosion + ' passes');
    ui.rect(PX + 22, y, PW - 44, 1, [1, 1, 1, 0.1]); y += 10; ui.text(PX + 22, y, '1024 × 640 HEIGHTS · ON GROW', 8.5, C.dim, { weight: 600, track: 0.12, family: MONO }); y += 16;
    [['noise', 'noise'], ['flow', 'flow'], ['carve', 'carve'], ['march', 'march · every frame']].forEach(([k, lab]) => { ui.text(PX + 22, y, lab, 9, C.dim, { family: MONO }); ui.text(PX + PW - 22, y, rd[k] !== undefined ? rd[k].toFixed(2) + ' ms' : '—', 9, C.ink, { align: 'right', family: MONO }); y += 14; });
    y += 6; ui.text(PX + 22, y, 'Five places in one grown world. Left alone, it tours them.', 10, C.dim); };
  const setSlider = (id, px) => { const v = Math.max(0, Math.min(1, (px - TRK[0]) / TRK[1])); if (id === 'sea') sea = 0.2 + v * 0.45; else erosion = Math.round(v * 64); dirty = true; lastTouch = performance.now(); };
  const act = (id) => { if (!id) return; if (id.startsWith('pin')) goTo(+id.slice(3), true); if (id === 'back') goTo(-1, true); if (id === 'next') goTo((at + 1) % 5, true); if (id === 'grow') { seed = Math.floor(Math.random() * 100000); dirty = true; lastTouch = performance.now(); } };
  return { init(d, host) { dev = d; ui = host.ui; const cells = W * H;
      const height = storage(cells * 4), flow = [storage(cells * 4), storage(cells * 4)]; const u = uniform(32), ru = uniform(160);
      const pN = compute(NOISE), pF = compute(FLOW), pC = compute(CARVE), pM = render(MARCH);
      const gN = bind(pN, [u, height]), gF = [bind(pF, [u, height, flow[0], flow[1]]), bind(pF, [u, height, flow[1], flow[0]])], gC = [bind(pC, [u, flow[1], height]), bind(pC, [u, flow[0], height])], gM = [bind(pM, [ru, height, flow[0]]), bind(pM, [ru, height, flow[1]])];
      const tm = timer(['noise', 'flow', 'carve', 'march'], 4); const hRead = readback(64);
      s = { u, ru, pN, pF, pC, pM, gN, gF, gC, gM, tm, height, flow, hRead, cur: 0, reading: false }; dirty = true; lastTouch = performance.now(); },
    down(p, id) { if (id === 'sea' || id === 'ero') { sliding = id; setSlider(id, p.x); } lastTouch = performance.now(); },
    move(p, hov) { hover = hov; if (sliding) setSlider(sliding, p.x); }, up(p, id, same) { sliding = null; if (same) act(id); }, leave() { sliding = null; hover = null; },
    destroy() { s.height.destroy(); s.flow.forEach((b) => b.destroy()); s.u.destroy(); s.ru.destroy(); s.hRead.destroy(); s = null; },
    frame(t, dt, now, hov) { if (!s) return; hover = hov; const T = now / 1000, gx = Math.ceil(W / 16), gy = Math.ceil(H / 16); const tgt = ui.prepare(0.6);
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
      const idle = (now - lastTouch) / 1000; if (flightT >= 1 && idle > 14) { lastTouch = now - 2000; goTo(at < 0 ? 0 : at === 4 ? -1 : at + 1, false); }
      const k = ease(flightT), A = poseOf(from, T), B = poseOf(at, T);
      const pos = v3lerp(A.pos, B.pos, k), tg = v3lerp(A.tgt, B.tgt, k), fov = lerp(A.fov, B.fov, k);
      if (from >= 0 && at >= 0) pos[1] += Math.sin(k * Math.PI) * 260;
      const F = norm([tg[0] - pos[0], tg[1] - pos[1], tg[2] - pos[2]]), Rt = norm(cross(F, [0, 1, 0])), Up = cross(Rt, F);
      const aa = atmoOf(from), ab = atmoOf(at), mixA = (key) => v3lerp(aa[key], ab[key], k).map((c) => Math.pow(c, 2.2));
      const RB = new ArrayBuffer(160), Rf = new Float32Array(RB); const aspect = tgt.w / tgt.h;
      Rf.set(pos, 0); Rf[3] = fov; Rf.set(F, 4); Rf[7] = sea; Rf.set(Rt, 8); Rf[11] = T; Rf.set(Up, 12); Rf[15] = aspect;
      Rf.set(norm(v3lerp(aa.sun, ab.sun, k)), 16); Rf[19] = k; Rf.set(mixA('sunC'), 20); Rf[23] = at; Rf.set(mixA('fog'), 24); Rf[27] = lerp(aa.wet, ab.wet, k); Rf.set(mixA('sky'), 28); Rf.set(mixA('sea'), 32);
      dev.queue.writeBuffer(s.ru, 0, RB);
      const rp = enc.beginRenderPass({ colorAttachments: [{ view: tgt.view, loadOp: 'clear', storeOp: 'store' }], ...s.tm.begin(3) });
      rp.setPipeline(s.pM); rp.setBindGroup(0, s.gM[s.cur]); rp.draw(3); rp.end(); s.tm.resolve(enc);
      /* project the five places to points for the pins */
      const tf = Math.tan(fov / 2);
      pinsOn = PLACES.map((p, i) => { const wp = [p.u * W, Math.max(sea, heights[i]) * HS, p.v * H], v = [wp[0] - pos[0], wp[1] - pos[1], wp[2] - pos[2]]; const z = v[0] * F[0] + v[1] * F[1] + v[2] * F[2]; const x = (v[0] * Rt[0] + v[1] * Rt[1] + v[2] * Rt[2]) / (z * tf * aspect), y = (v[0] * Up[0] + v[1] * Up[1] + v[2] * Up[2]) / (z * tf);
        return z > 0 && Math.abs(x) < 1 && Math.abs(y) < 1 ? [(x + 1) * 0.5 * 890, (1 - y) * 0.5 * 626] : null; });
      const r = s.tm.read(); Object.keys(r).forEach((k2) => { rd[k2] = r[k2]; });
      draw(now); ui.compose(enc); dev.queue.submit([enc.finish()]);
      if (s.reading && !s.mapping) { s.mapping = true; s.hRead.mapAsync(GPUMapMode.READ).then(() => { if (!s) return; heights = Array.from(new Float32Array(s.hRead.getMappedRange().slice(0, 20))); s.hRead.unmap(); s.reading = false; s.mapping = false; }).catch(() => { if (s) { s.reading = false; s.mapping = false; } }); } } };
}
