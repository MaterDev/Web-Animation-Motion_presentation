// @ts-nocheck -- copied from design/techniques/webgpu/; untyped sheet code
/* SUPERCELL · the shaders (track 013). The Rock 'em Sock 'em stage "Vortex" was a hectic,
   self-driving storm: a director swinging lull → build → peak → crash, up to three tornadoes
   roaming the plain, barnyard debris flung off the funnels, torrential rain, forked lightning.
   This keeps all of that and rebuilds each part in three dimensions: the funnels, wall clouds
   and dust skirts are density fields marched along the view ray — striped, spinning, and
   see-through between the bands — and the debris is a GPU swarm composited at its own depth
   inside the march.

   World units are miles: +x east, +z north (away from the camera), +y up, ground at y = 0.
   Loops inside the march are unrolled by hand: a constant-bound loop nested in the
   uniform-bound march stalls compileShader on ANGLE/Metal. */

export const COMMON = /* wgsl */ `
struct Cam { pos: vec3f, tanHalf: f32, fwd: vec3f, aspect: f32, right: vec3f, steps: f32, up: vec3f, pxH: f32 };
struct Storm {
  t0: vec4f, t1: vec4f, t2: vec4f,             /* per tornado: x, z, top radius, strength */
  s0: vec4f, s1: vec4f, s2: vec4f,             /* per tornado: sway phase, lean, seed, breath */
  b0: vec4f, b1: vec4f, b2: vec4f, b3: vec4f,  /* per bolt: x, z, alpha, seed */
  time: f32, storm: f32, flash: f32, wind: f32,
  rain: f32, tspin: f32, base: f32, tflow: f32,
  glow: vec4f,                                 /* the colour the sky takes on in a bad storm, and how strongly */
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
fn fbm2(p: vec3f) -> f32 { return vnoise(p) * 0.64 + vnoise(p * 2.03 + vec3f(3.1, 7.7, 1.3)) * 0.36; }
fn fbm3(p: vec3f) -> f32 { return vnoise(p) * 0.53 + vnoise(p * 2.03 + vec3f(3.1, 7.7, 1.3)) * 0.30 + vnoise(p * 4.07 + vec3f(9.2, 1.4, 5.5)) * 0.17; }
`;

export const SCENE = COMMON + /* wgsl */ `
@group(0) @binding(0) var<uniform> cam: Cam;
@group(0) @binding(1) var<uniform> st: Storm;
@group(0) @binding(2) var debrisAlbedo: texture_2d<f32>;
@group(0) @binding(3) var debrisDist: texture_2d<f32>;

/* the stage's palette, carried over */
const SKY_TOP = vec3f(0.071, 0.059, 0.180);
const SKY_MID = vec3f(0.173, 0.188, 0.376);
const HORIZON = vec3f(0.290, 0.384, 0.345);
const GLOW = vec3f(0.784, 0.816, 0.627);
const CLOUD_DARK = vec3f(0.149, 0.141, 0.180);
const CLOUD_DARK2 = vec3f(0.086, 0.078, 0.125);
const HAZE = vec3f(0.337, 0.376, 0.322);
const TREES = vec3f(0.086, 0.141, 0.110);
const T_DARK = vec3f(0.204, 0.196, 0.243);
const T_LITE = vec3f(0.776, 0.761, 0.706);
const DUST_LITE = vec3f(0.714, 0.667, 0.565);
const RED_DIRT = vec3f(0.55, 0.30, 0.20);

fn torA(i: i32) -> vec4f { return select(select(st.t2, st.t1, i == 1), st.t0, i == 0); }
fn torB(i: i32) -> vec4f { return select(select(st.s2, st.s1, i == 1), st.s0, i == 0); }
fn boltV(i: i32) -> vec4f { return select(select(select(st.b3, st.b2, i == 2), st.b1, i == 1), st.b0, i == 0); }
fn rot2(v: vec2f, a: f32) -> vec2f { let c = cos(a); let s = sin(a); return vec2f(v.x * c - v.y * s, v.x * s + v.y * c); }
fn funnelTop() -> f32 { return st.base - 0.07; }
/* the funnel's centreline: a travelling S-bend that swings most near the ground, and a lean with the wind */
fn centre(i: i32, h: f32) -> vec2f {
  let A = torA(i); let B = torB(i);
  let curve = sin(h * 2.4 + B.x) * 0.34 * (1.2 - h) * A.z;
  return vec2f(A.x + curve + B.y * (1.0 - h) * (1.0 - h), A.y);
}
fn radiusAt(i: i32, h: f32) -> f32 { let A = torA(i); return A.z * mix(0.11, 1.0, pow(h, 0.78)) * (1.0 + 0.12 * sin(torB(i).w)); }

/* density and stripe shade of one funnel: helical bands you can see between, spinning with the storm */
fn funnel(p: vec3f, i: i32, detail: f32) -> vec2f {
  let A = torA(i); if (A.w < 0.02) { return vec2f(0.0); }
  let top = funnelTop(); if (p.y > top + 0.04) { return vec2f(0.0); }
  let h = clamp(p.y / top, 0.0, 1.0);
  let R = radiusAt(i, h);
  let d = p.xz - centre(i, h); let r = length(d);
  if (r > R * 1.35 + 0.01) { return vec2f(0.0); }
  let ang = atan2(d.y, d.x);
  let seed = torB(i).z;
  var n = 0.5;
  let np = vec3f(rot2(d, -st.time * st.tspin * 0.6) / max(R, 0.02) * 1.5, p.y * 9.0 - st.time * st.tflow + seed * 7.0);
  if (detail > 0.5) { n = fbm3(np); } else { n = vnoise(np); }
  let helix = 0.5 + 0.5 * sin(h * 22.0 - st.time * st.tspin * 1.6 + ang * 2.0 + n * 2.5 + seed * 11.0);
  let shade = helix * 0.55 + n * 0.45;
  let q = r / (R * (1.0 + (n - 0.5) * 0.35));
  let body = 1.0 - smoothstep(0.86, 1.0, q);
  let env = (1.0 - smoothstep(0.9, 1.02, h)) * smoothstep(0.0, 0.035, h);
  let dens = body * (0.12 + 0.88 * smoothstep(0.3, 0.6, shade)) * env * A.w * 9.0 / max(R, 0.02);
  return vec2f(dens, shade);
}
fn billow(p: vec3f, c: vec2f, fk: f32, spin: f32, orbit: f32, size: f32, top: f32) -> vec2f {
  let ang = fk * 1.2566 + spin;
  let bc = vec3f(c.x + cos(ang) * orbit, top - 0.07 + 0.06 * sin(fk * 2.3 + st.time * 0.8), c.y + sin(ang) * orbit);
  let sz = size * (0.85 + 0.3 * sin(st.time * 1.3 + fk * 1.7));
  return vec2f(1.0 - length(p - bc) / sz, bc.y);
}
/* the crown each funnel pours out of: a cloud burst — a heavy central mass and five boiling billows
   wheeling round the top of the column, each one lumpy, bulging and churning as the storm turns.
   Returns density and a shade: billow tops catch the light, undersides go dark. */
fn wall(p: vec3f, i: i32, detail: f32) -> vec2f {
  let A = torA(i); if (A.w < 0.02 || p.y > st.base + 0.02 || p.y < st.base - 0.42) { return vec2f(0.0); }
  let c = centre(i, 1.0); let top = st.base - 0.05;
  let d = p.xz - c; let reach = A.z * 1.5 + 0.36;
  if (length(d) > reach) { return vec2f(0.0); }
  let spin = st.time * (0.35 + 0.25 * st.storm) + torB(i).z * 9.0;
  let np = vec3f(rot2(d, -spin * 0.7) * 6.0, p.y * 6.0 - st.time * 0.35 + torB(i).z * 5.0);
  var n = 0.5; if (detail > 0.5) { n = fbm3(np); } else { n = fbm2(np); }
  /* the central mass, flattened and hanging */
  let core = vec3f(c.x, top - 0.02, c.y);
  var best = 1.0 - length((p - core) / vec3f(A.z + 0.2, 0.13 + 0.06 * A.w, A.z + 0.2));
  var hiY = core.y;
  /* the billows: orbiting, breathing, each at its own height */
  let orbit = A.z * 0.95 + 0.1; let size = (A.z * 0.55 + 0.1) * (0.8 + 0.4 * A.w);
  /* unrolled: a constant-bound loop in a function the march calls stalls compileShader on Metal */
  let v0 = billow(p, c, 0.0, spin, orbit, size, top); if (v0.x > best) { best = v0.x; hiY = v0.y; }
  let v1 = billow(p, c, 1.0, spin, orbit, size, top); if (v1.x > best) { best = v1.x; hiY = v1.y; }
  let v2 = billow(p, c, 2.0, spin, orbit, size, top); if (v2.x > best) { best = v2.x; hiY = v2.y; }
  let v3 = billow(p, c, 3.0, spin, orbit, size, top); if (v3.x > best) { best = v3.x; hiY = v3.y; }
  let v4 = billow(p, c, 4.0, spin, orbit, size, top); if (v4.x > best) { best = v4.x; hiY = v4.y; }
  /* cauliflower edges: the noise eats into every boundary */
  let dens = smoothstep(0.0, 0.35, best + (n - 0.5) * 0.55) * A.w * 11.0;
  let shade = smoothstep(-0.08, 0.1, p.y - hiY) * 0.6 + n * 0.4;
  return vec2f(dens, shade);
}
fn dust(p: vec3f, i: i32, detail: f32) -> vec2f {
  let A = torA(i); if (A.w < 0.25) { return vec2f(0.0); }
  let c = centre(i, 0.0); let Rd = A.z * 0.95 + 0.06; let Hd = 0.05 + 0.07 * A.w * st.storm;
  let d = p.xz - c; let r = length(d);
  if (r > Rd * 1.3 || p.y > Hd * 1.5) { return vec2f(0.0); }
  let np = vec3f(rot2(d, -st.time * 2.5) / Rd * 2.5, p.y * 18.0 - st.time * 1.2);
  var n = 0.5; if (detail > 0.5) { n = fbm3(np); } else { n = vnoise(np); }
  let q = r / Rd + (n - 0.5) * 0.4;
  return vec2f((1.0 - smoothstep(0.55, 1.0, q)) * (1.0 - smoothstep(Hd * 0.3, Hd * (0.7 + n * 0.6), p.y)) * (0.35 + n * 0.5) * A.w * 14.0, n);
}
fn boltLight(p: vec3f) -> f32 {
  var fl = 0.0;
  let b0 = st.b0; let b1 = st.b1; let b2 = st.b2; let b3 = st.b3;
  fl += b0.z * 2.2 / (1.0 + dot(p.xz - b0.xy, p.xz - b0.xy) * 6.0);
  fl += b1.z * 2.2 / (1.0 + dot(p.xz - b1.xy, p.xz - b1.xy) * 6.0);
  fl += b2.z * 2.2 / (1.0 + dot(p.xz - b2.xy, p.xz - b2.xy) * 6.0);
  fl += b3.z * 2.2 / (1.0 + dot(p.xz - b3.xy, p.xz - b3.xy) * 6.0);
  return fl;
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
fn lineCov(x: f32, w: f32, dx: f32) -> f32 {
  let fw = max(dx, 1e-6); let a = x - 0.5 * fw + 0.5 * w; let b = x + 0.5 * fw + 0.5 * w;
  return clamp(((floor(b) * w + min(fract(b), w)) - (floor(a) * w + min(fract(a), w))) / fw, 0.0, 1.0);
}
fn fade(period: f32, dx: f32) -> f32 { return 1.0 - smoothstep(period * 0.25, period * 0.9, dx); }
fn ground(xz: vec2f, dx: f32) -> vec3f {
  let w = xz + vec2f(0.65, 17.3);
  let qm = vec3i((vec2i(floor(w * 2.0)) % vec2i(128) + vec2i(128)) % vec2i(128), 11).xzy;
  let kind = h3(qm); let tone = h3(qm + vec3i(3, 0, 5));
  let wheat = mix(vec3f(0.42, 0.40, 0.20), vec3f(0.52, 0.46, 0.24), tone);
  let grass = mix(vec3f(0.26, 0.32, 0.18), vec3f(0.33, 0.38, 0.21), tone);
  var alb = select(select(wheat, grass, kind > 0.6), RED_DIRT * mix(0.8, 1.0, tone), kind < 0.25);
  let n1 = vnoise(vec3f(w * 7.0, 5.0)); let n2 = vnoise(vec3f(w * 45.0, 2.0));
  alb *= 0.82 + 0.36 * n1 + 0.2 * (n2 - 0.5) * fade(1.0 / 45.0, dx);
  let rowDir = select(w.x, w.y, h3(qm + vec3i(7, 1, 2)) > 0.5);
  alb *= 1.0 - 0.28 * (0.5 + 0.5 * sin(rowDir * 700.0)) * fade(1.0 / 110.0, dx);
  alb *= 1.0 - 0.18 * (0.5 + 0.5 * sin(w.y * 160.0 + n1 * 3.0)) * fade(1.0 / 25.0, dx);
  let road = max(lineCov(w.x, 0.006, dx), lineCov(w.y, 0.006, dx));
  return mix(alb, vec3f(0.50, 0.40, 0.30), road);
}
fn sortSwap(a: vec2f, b: vec2f) -> array<vec2f, 2> { if (a.x > b.x) { return array<vec2f, 2>(b, a); } return array<vec2f, 2>(a, b); }
fn channel(ro: vec3f, rd: vec3f, bv: vec4f) -> f32 {
  if (bv.z <= 0.01) { return 0.0; }
  let o2 = ro.xz - bv.xy; let d2 = rd.xz; let dd = dot(d2, d2);
  let tb = -dot(o2, d2) / max(dd, 1e-6);
  if (tb <= 0.0) { return 0.0; }
  let yb = ro.y + rd.y * tb;
  if (yb <= 0.0 || yb >= st.base) { return 0.0; }
  let sd = i32(bv.w * 997.0);
  let seg = floor(yb * 22.0); let fy = fract(yb * 22.0);
  let jag = mix(h3(vec3i(i32(seg), sd, 5)) - 0.5, h3(vec3i(i32(seg) + 1, sd, 5)) - 0.5, fy) * 0.07;
  let side = vec2f(-d2.y, d2.x) / sqrt(max(dd, 1e-6));
  let lateral = dot(ro.xz + d2 * tb - bv.xy, side);
  let px = tb * cam.tanHalf * 2.0 / cam.pxH;
  let main = smoothstep(px * 1.6, 0.0, abs(lateral - jag));
  let bj = jag + (st.base * 0.55 - yb) * 0.45;
  let branch = smoothstep(px * 1.2, 0.0, abs(lateral - bj)) * step(yb, st.base * 0.55) * step(st.base * 0.2, yb);
  let glow = smoothstep(px * 40.0, 0.0, abs(lateral - jag)) * 0.35;
  return (main * 1.6 + branch + glow) * bv.z;
}

@fragment fn fs_main(@builtin(position) fc: vec4f, @location(0) uv: vec2f) -> @location(0) vec4f {
  let ndc = vec2f(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0);
  let rd = normalize(cam.fwd + cam.right * ndc.x * cam.tanHalf * cam.aspect + cam.up * ndc.y * cam.tanHalf);
  let ro = cam.pos;
  let T = st.time; let S = st.storm;
  let tg = select(1e9, -ro.y / rd.y, rd.y < -1e-5);
  let gp = ro + rd * min(tg, 300.0);
  let gdx = length(fwidth(gp.xz));
  let galb = ground(gp.xz, gdx);
  let td = select(1e9, (st.base - ro.y) / rd.y, rd.y > 1e-5);
  let dp = ro + rd * min(td, 300.0);

  /* ── the plain, the churning ceiling, the horizon ── */
  var bg = vec3f(0.0);
  if (tg < td) {
    var g = galb * (0.8 - S * 0.34);
    /* gusts rolling away across the crop: bright and dark bands running toward the horizon */
    let wave = 0.5 + 0.5 * sin(gp.z * 14.0 - T * (4.0 + S * 4.0) + gp.x * 2.2 + vnoise(vec3f(gp.xz * 3.0, T * 0.3)) * 3.0);
    g *= 0.82 + 0.34 * wave * (1.0 - smoothstep(0.5, 6.0, tg));
    bg = mix(g, HAZE * (0.9 - S * 0.3), smoothstep(1.5, 14.0, tg));
    bg += st.glow.rgb * st.glow.a * (0.08 + 0.25 * smoothstep(1.5, 14.0, tg));
  } else {
    /* fast scudding cloud over a slow-turning mesocyclone, darker as the storm builds */
    let q = dp.xz;
    let cl1 = fbm2(vec3f(q.x * 0.9 + T * 0.30, q.y * 0.9 - T * 0.10, T * 0.18));
    let cl2 = fbm2(vec3f(q.x * 2.3 - T * 0.55, q.y * 2.3 + T * 0.16, T * 0.3));
    let far01 = smoothstep(2.0, 16.0, td);
    var sky = mix(SKY_TOP, SKY_MID, far01);
    sky = mix(sky, HORIZON, smoothstep(10.0, 40.0, td));
    sky = mix(sky, CLOUD_DARK, smoothstep(0.42, 0.72, cl1 * 0.6 + cl2 * 0.4) * (0.35 + S * 0.6));
    let mc = q - vec2f(0.0, 2.6); let mr = length(mc); let ma = atan2(mc.y, mc.x);
    let meso = fbm2(vec3f(ma * 2.0 + T * 0.5 + mr * 1.6, mr * 1.4 - T * 0.2, T * 0.1));
    sky = mix(sky, CLOUD_DARK2, smoothstep(0.45, 0.75, meso) * (1.0 - smoothstep(0.5, 3.2, mr)) * (0.3 + S * 0.6));
    sky = mix(sky, CLOUD_DARK2, (1.0 - far01) * (0.3 + S * 0.45));
    sky += GLOW * smoothstep(0.08, 0.0, rd.y) * 0.14;
    /* the storm glows: green, teal, amber or magenta light soaking the base and pooling at the horizon */
    let gl = st.glow.rgb * st.glow.a;
    sky += gl * (0.45 + 0.55 * smoothstep(0.42, 0.72, cl1 * 0.6 + cl2 * 0.4)) * mix(0.8, 1.2, far01);
    sky += gl * smoothstep(0.14, 0.0, rd.y) * 1.3;
    sky += vec3f(0.5, 0.55, 0.8) * boltLight(dp) * 0.08;
    bg = sky;
  }
  let az = atan2(rd.x, rd.z);
  /* far background: a hazy line of low hills, then distant rain hanging in front of them */
  if (tg > 12.0 || rd.y > 0.0) {
    let hill = 0.006 + fbm2(vec3f(az * 5.0, 1.0, 7.0)) * 0.026;
    if (rd.y < hill && rd.y > -0.004) { bg = mix(HORIZON * 0.75, CLOUD_DARK, 0.35 + S * 0.3); }
    let curtainN = fbm2(vec3f(az * 9.0 - T * 0.08, rd.y * 4.0 + T * 0.9, 2.0));
    let curtain = smoothstep(0.5, 0.78, curtainN) * (1.0 - smoothstep(0.0, 0.09, rd.y)) * smoothstep(-0.01, 0.0, rd.y) * (0.3 + S * 0.7);
    bg = mix(bg, CLOUD_DARK2 * 1.2, curtain * 0.7);
  }
  let bump = fbm2(vec3f(az * 40.0, 0.0, 3.0));
  if (rd.y > -0.002 && rd.y < 0.004 + bump * 0.012 && tg > 20.0) { bg = TREES; }

  /* ── the march: merged intervals through each tornado's cylinder ── */
  let tEnd = min(min(tg, td), 40.0);
  var I0 = vec2f(1.0, 0.0); var I1 = vec2f(1.0, 0.0); var I2 = vec2f(1.0, 0.0);
  if (st.t0.w >= 0.02) { let iv = cyl(ro, rd, st.t0.xy, st.t0.z * 1.4 + mix(0.08, 0.5, clamp((length(st.t0.xy - ro.xz) - 0.35) / 0.8, 0.0, 1.0)), 0.0, st.base); I0 = vec2f(iv.x, min(iv.y, tEnd)); }
  if (st.t1.w >= 0.02) { let iv = cyl(ro, rd, st.t1.xy, st.t1.z * 1.4 + mix(0.08, 0.5, clamp((length(st.t1.xy - ro.xz) - 0.35) / 0.8, 0.0, 1.0)), 0.0, st.base); I1 = vec2f(iv.x, min(iv.y, tEnd)); }
  if (st.t2.w >= 0.02) { let iv = cyl(ro, rd, st.t2.xy, st.t2.z * 1.4 + mix(0.08, 0.5, clamp((length(st.t2.xy - ro.xz) - 0.35) / 0.8, 0.0, 1.0)), 0.0, st.base); I2 = vec2f(iv.x, min(iv.y, tEnd)); }
  /* empty intervals sort to the end */
  if (I0.x >= I0.y) { I0 = vec2f(1e8, 0.0); } if (I1.x >= I1.y) { I1 = vec2f(1e8, 0.0); } if (I2.x >= I2.y) { I2 = vec2f(1e8, 0.0); }
  var sw = sortSwap(I0, I1); I0 = sw[0]; I1 = sw[1];
  sw = sortSwap(I1, I2); I1 = sw[0]; I2 = sw[1];
  sw = sortSwap(I0, I1); I0 = sw[0]; I1 = sw[1];
  var total = 0.0; var nI = 0.0;
  if (I0.x < I0.y) { total += I0.y - I0.x; nI += 1.0; } if (I1.x < I1.y) { total += I1.y - I1.x; nI += 1.0; } if (I2.x < I2.y) { total += I2.y - I2.x; nI += 1.0; }
  var Tr = 1.0; var acc = vec3f(0.0);
  let pix = vec2i(fc.xy);
  let dA = textureLoad(debrisAlbedo, pix, 0); let dD = textureLoad(debrisDist, pix, 0).r;
  var debrisDone = dA.a < 0.01;
  let jit = h3(vec3i(i32(fc.x), i32(fc.y), 77));
  if (total > 0.0) {
    var dt = 0.004;
    var k = 0; var t = 0.0; var started = false;
    let maxIter = u32(cam.steps + 8.0);
    for (var it = 0u; it < maxIter; it++) {
      if (k > 2 || Tr < 0.02) { break; }
      let iv = select(select(I2, I1, k == 1), I0, k == 0);
      if (iv.x >= iv.y) { k++; started = false; continue; }
      if (!started) { t = max(iv.x, t); dt = max((iv.y - t) / max(cam.steps / nI, 1.0), 0.0012); t += dt * (0.35 + 0.3 * jit); started = true; }
      if (t >= iv.y) { k++; started = false; continue; }
      if (!debrisDone && dD < t) { acc += Tr * dA.a * dA.rgb * (0.85 + st.flash * 1.2); Tr *= 1.0 - dA.a; debrisDone = true; }
      let p = ro + rd * t;
      let f0 = funnel(p, 0, 1.0); let f1 = funnel(p, 1, 1.0); let f2 = funnel(p, 2, 1.0);
      let w0 = wall(p, 0, 1.0); let w1 = wall(p, 1, 1.0); let w2 = wall(p, 2, 1.0);
      let w = w0.x + w1.x + w2.x;
      let shadeW = (w0.x * w0.y + w1.x * w1.y + w2.x * w2.y) / max(w, 1e-4);
      let d0 = dust(p, 0, 1.0); let d1 = dust(p, 1, 1.0); let d2 = dust(p, 2, 1.0);
      let fs = f0.x + f1.x + f2.x; let ds = d0.x + d1.x + d2.x;
      let sig = fs + w + ds;
      if (sig > 1e-3) {
        let shadeF = (f0.x * f0.y + f1.x * f1.y + f2.x * f2.y) / max(fs, 1e-4);
        let shadeD = (d0.x * d0.y + d1.x * d1.y + d2.x * d2.y) / max(ds, 1e-4);
        /* self-shadow from the upper left, so each column has a lit side and a dark side */
        let q = p + vec3f(-0.08, 0.08, -0.04);
        let occ = funnel(q, 0, 0.0).x + funnel(q, 1, 0.0).x + funnel(q, 2, 0.0).x + wall(q, 0, 0.0).x + wall(q, 1, 0.0).x + wall(q, 2, 0.0).x;
        let lit = 0.55 + 0.5 * exp(-occ * 0.05);
        let colF = mix(T_DARK * 0.8, T_LITE, smoothstep(0.35, 0.85, shadeF) * 0.8);
        let colW = mix(CLOUD_DARK2, mix(T_DARK, T_LITE, 0.55), smoothstep(0.2, 0.9, shadeW));
        let colD = mix(mix(T_DARK, DUST_LITE, shadeD), RED_DIRT, 0.25);
        var c = (colF * fs + colW * w + colD * ds) / sig * lit;
        c += st.glow.rgb * st.glow.a * 0.35;
        /* lightning lights the cloud it is near, not just the frame */
        c += vec3f(0.55, 0.62, 0.85) * (boltLight(p) * 0.6 + st.flash * 0.35);
        let a = 1.0 - exp(-sig * dt);
        acc += Tr * a * c; Tr *= 1.0 - a;
      }
      t += dt;
    }
  }
  if (!debrisDone && dD < tEnd) { acc += Tr * dA.a * dA.rgb * (0.85 + st.flash * 1.2); Tr *= 1.0 - dA.a; }
  var col = acc + Tr * bg;

  /* ── forked lightning ── */
  let bolt = channel(ro, rd, st.b0) + channel(ro, rd, st.b1) + channel(ro, rd, st.b2) + channel(ro, rd, st.b3);
  col += mix(vec3f(0.7, 0.85, 1.0), vec3f(1.0), clamp(bolt - 1.0, 0.0, 1.0)) * bolt;

  /* ── rain in depth: six sheets of streaks at doubling distances along the view. Each sheet is
     anchored in the world, so the near rain is big, soft and fast across the frame and the far
     rain fine, and the camera's sway moves them against each other. Rain stops at whatever is
     nearer: the grass, a flung cow, the ground. ── */
  var hit = tEnd; if (dA.a > 0.5) { hit = min(hit, dD); }
  let pxW = cam.tanHalf * 2.0 / cam.pxH;
  for (var L = 0; L < 6; L++) {
    let dk = 0.0016 * pow(2.1, f32(L));
    if (dk < hit) {
      let P = ro + rd * dk;
      let cw = dk * 0.03;
      let fall = 0.010 + 0.012 * st.storm;
      let u = dot(P, cam.up) + T * fall * (1.0 + f32(L) * 0.15);
      let xs = dot(P, cam.right) + st.wind * 0.3 * u;
      let cid = vec2i(floor(vec2f(xs / cw, u / (cw * 7.0))));
      let f = fract(vec2f(xs / cw, u / (cw * 7.0)));
      let ox = 0.15 + 0.7 * h3(vec3i(cid.x, cid.y, 11 + L));
      let on = step(h3(vec3i(cid.x, cid.y, 31 + L)), st.rain * 0.55);
      let wid = max(dk * pxW * 1.1, cw * 0.035) / cw;
      let len = mix(0.55, 0.3, f32(L) / 5.0);
      let yph = h3(vec3i(cid.x, cid.y, 51 + L)) * (1.0 - len);
      let streak = (1.0 - smoothstep(wid * 0.5, wid, abs(f.x - ox))) * smoothstep(yph, yph + 0.05, f.y) * (1.0 - smoothstep(yph + len - 0.1, yph + len, f.y)) * on;
      let near = 1.0 - f32(L) / 6.0;
      col = mix(col, vec3f(0.62, 0.66, 0.76) + vec3f(0.3) * st.flash, streak * mix(0.10, 0.22, 1.0 - near) * (0.6 + 0.4 * st.storm));
    }
  }
  /* splashes on the ground close in: rings that open and fade, a new one per cell every so often */
  if (tg < 0.06 && tg < hit + 1e-4) {
    let sc = gp.xz / 0.0012; let sidc = vec2i(floor(sc)); let sf = fract(sc) - 0.5;
    let slot = floor(T * 3.0 + h3(vec3i(sidc.x, sidc.y, 7)) * 3.0);
    let age = fract(T * 3.0 + h3(vec3i(sidc.x, sidc.y, 7)) * 3.0);
    let pos = vec2f(h3(vec3i(sidc.x, sidc.y, i32(slot))), h3(vec3i(sidc.y, sidc.x, i32(slot)))) - 0.5;
    let ring = (1.0 - smoothstep(0.0, 0.06, abs(length(sf - pos * 0.6) - age * 0.35))) * (1.0 - age) * step(h3(vec3i(sidc.x + i32(slot), sidc.y, 3)), st.rain);
    col += vec3f(0.5, 0.55, 0.62) * ring * 0.35 * (1.0 - tg / 0.06);
  }
  col = mix(col, vec3f(0.85, 0.9, 1.0), clamp(st.flash * 0.55, 0.0, 0.8));
  /* the stage's quantised finish, kept faint */
  let dith = (h3(vec3i(i32(fc.x), i32(fc.y), 3)) - 0.5) / 63.0;
  col = floor((col + dith) * 63.0) / 63.0;
  return vec4f(col, 1.0);
}
`;

/* ── debris: the stage's wind-influence field, one kernel, three tornadoes ── */
export const DEBRIS_STRUCTS = /* wgsl */ `
struct Air { time: f32, wind: f32, storm: f32, flash: f32, fly: vec4f };   /* fly: x, z, strength, side of a tornado passing close */
struct D { pos: vec3f, kind: f32, vel: vec3f, ang: f32 };
struct Sim { dt: f32, time: f32, wind: f32, count: f32, t0: vec4f, t1: vec4f, t2: vec4f, storm: f32, maxH: f32, _p0: f32, _p1: f32 };
`;
export const DEBRIS_KERNEL = DEBRIS_STRUCTS + /* wgsl */ `
@group(0) @binding(0) var<uniform> sim: Sim;
@group(0) @binding(1) var<storage, read_write> ds: array<D>;
fn h1(n: u32) -> f32 { var x = n * 747796405u + 2891336453u; x = ((x >> ((x >> 28u) + 4u)) ^ x) * 277803737u; x = (x >> 22u) ^ x; return f32(x) / 4294967295.0; }
fn tor(i: u32) -> vec4f { return select(select(sim.t2, sim.t1, i == 1u), sim.t0, i == 0u); }
@compute @workgroup_size(256) fn cs_main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x; if (f32(i) >= sim.count) { return; }
  var d = ds[i];
  if (d.kind >= 20.0) {
    /* the near storm: chips and wreckage whipping across the foreground and the space between it and the middle
       ground, at every height the camera can see, tumbling, gusting, and pulled into any funnel that comes close */
    let s2 = u32(sim.time * 60.0) * 7919u + i * 13u;
    let dir = select(-1.0, 1.0, sim.wind >= 0.0);
    let fly = sim._p0;
    let gustW = 0.65 + 0.55 * sin(sim.time * 1.7 + d.pos.z * 40.0 + h1(i * 5u) * 6.0);
    let speed = (0.10 + 0.30 * sim.storm + abs(sim.wind) * 0.12 + fly * 0.5) * (0.55 + 0.9 * h1(i * 7u)) * gustW;
    var goal = vec3f(dir * speed, sin(sim.time * (2.0 + h1(i) * 3.0) + f32(i)) * 0.01 * (0.4 + sim.storm), (h1(i * 11u) - 0.5) * 0.05);
    for (var k = 0u; k < 3u; k++) {
      let t = tor(k); if (t.w < 0.25) { continue; }
      let dx = t.x - d.pos.x; let dz = t.y - d.pos.z; let dd = sqrt(dx * dx + dz * dz) + 1e-3;
      let infR = t.z * 2.2 + 0.25;
      if (dd < infR) { let w = 1.0 - dd / infR; let ww = w * w * t.w; let nx = dx / dd; let nz = dz / dd;
        goal.x += (nx * 0.6 - nz * 1.8 * (0.4 + w)) * ww; goal.z += (nz * 0.6 + nx * 1.8 * (0.4 + w)) * ww; goal.y += ww * 0.12; }
    }
    d.vel += (goal - d.vel) * min(1.0, sim.dt * 2.5);
    d.pos += d.vel * sim.dt;
    let top = 0.002 + d.pos.z * 0.62;
    if (d.pos.y < 0.0002) { d.pos.y = 0.0002; d.vel.y = abs(d.vel.y) * 0.4; }
    if (d.pos.y > top) { d.pos.y = top; d.vel.y = -abs(d.vel.y) * 0.5; }
    d.ang += (6.0 + h1(i * 3u) * 14.0) * sim.dt * dir * (1.0 + fly * 2.0);
    let halfW = 0.004 + d.pos.z * 0.8;
    if (abs(d.pos.x) > halfW * 1.1 || d.pos.z < 0.0025 || d.pos.z > 0.5) {
      let z = 0.003 + pow(h1(s2 + 5u), 1.6) * 0.4;
      d.pos = vec3f(-dir * (0.004 + z * 0.8), 0.0003 + pow(h1(s2 + 6u), 1.4) * (0.002 + z * 0.6), z);
      d.vel = vec3f(dir * speed * 0.8, 0.0, 0.0);
    }
    ds[i] = d; return;
  }
  if (d.kind >= 9.0) { return; }                       /* scenery stays put */
  let big = d.kind >= 3.0;                               /* cows, trees, barns: heavier, flung harder */
  let dt = sim.dt; let seed = u32(sim.time * 60.0) * 7919u + i * 13u;
  var lift = 0.0;
  for (var k = 0u; k < 3u; k++) {
    let t = tor(k); if (t.w < 0.25) { continue; }
    let dx = t.x - d.pos.x; let dz = t.y - d.pos.z; let dd = sqrt(dx * dx + dz * dz) + 1e-3;
    let infR = t.z * 2.6 + 0.35;                         /* the pull reaches well past the funnel */
    if (dd < infR) {
      let w = 1.0 - dd / infR; let ww = w * w * min(1.3, t.w);
      let nx = dx / dd; let nz = dz / dd;
      let swirl = 3.2 * (0.35 + w); let pull = 1.3;
      d.vel.x += (nx * pull - nz * swirl) * ww * dt;
      d.vel.z += (nz * pull + nx * swirl) * ww * dt;
      lift = max(lift, ww);
    }
  }
  let liftK = select(1.0, 0.75, big);
  if (lift > 0.04 && d.pos.y < sim.maxH) { d.vel.y += (1.8 * lift * liftK - d.pos.y * 0.9) * dt; } else { d.vel.y -= 1.6 * dt; }
  if (d.pos.y >= sim.maxH && d.vel.y > 0.0) { let a = h1(seed) * 6.2831853; let pw = select(0.7, 1.2, big) * (0.6 + h1(seed + 1u)); d.vel.x = cos(a) * pw; d.vel.z = sin(a) * pw * 0.6; d.vel.y = -abs(d.vel.y) * 0.2; }
  d.vel.x += sim.wind * 0.25 * dt;
  let damp = 1.0 - dt * 0.4; d.vel.x *= damp; d.vel.z *= damp;
  if (d.pos.y < 0.002 && lift < 0.08) { d.vel.x *= 1.0 - dt * 3.0; d.vel.z *= 1.0 - dt * 3.0; }
  d.pos += d.vel * dt;
  d.ang += select((d.vel.x + d.vel.z) * 6.0 * dt, select(14.0, 6.0, big) * dt, lift > 0.05);
  if (d.pos.y <= 0.0) { d.pos.y = 0.0; if (d.vel.y < -0.1) { d.vel.y *= -0.3; } else { d.vel.y = 0.0; } }
  /* anything that leaves the stage lands back on the plain somewhere in it */
  if (d.pos.z < 0.3 || d.pos.z > 4.4 || abs(d.pos.x) > 0.6 + d.pos.z * 0.62 || d.pos.y > 1.2) {
    d.pos = vec3f((h1(seed + 2u) * 2.0 - 1.0) * 2.4, 0.0, 0.5 + h1(seed + 3u) * 3.6); d.vel = vec3f(0.0); d.ang = h1(seed + 4u) * 6.28;
  }
  ds[i] = d;
}
`;
export const DEBRIS_DRAW = DEBRIS_STRUCTS + COMMON + /* wgsl */ `
@group(0) @binding(0) var<uniform> cam: Cam;
@group(0) @binding(1) var<storage, read> ds: array<D>;
@group(0) @binding(2) var atlas: texture_2d<f32>;
@group(0) @binding(3) var smp: sampler;
@group(0) @binding(4) var<uniform> air: Air;
const FRAMES = 12.0;
struct VO { @builtin(position) p: vec4f, @location(0) q: vec2f, @location(1) col: vec3f, @location(2) dist: f32, @location(3) @interpolate(flat) frame: f32, @location(4) a: f32, @location(5) @interpolate(flat) dim: f32 };
@vertex fn vs_main(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO {
  let d = ds[ii]; var o: VO;
  let v = d.pos - cam.pos; let z = dot(v, cam.fwd);
  let corner = vec2f(f32(vi & 1u), f32((vi >> 1u) & 1u)) * 2.0 - 1.0;
  let gale = d.kind >= 20.0;
  let kind = select(d.kind, d.kind - 20.0, gale);
  let chip = kind < 3.0; let scenery = kind >= 9.0; let rooted = kind >= 12.0;
  /* world half-size: chips of straw, board and dirt; flung sprites played up to read at a glance;
     horizon buildings; then the middle ground — bush, poplar, pole, fence, hay bale */
  var size = select(select(select(0.0028, 0.0045, kind >= 1.0), 0.0035, kind >= 2.0), select(0.028, 0.03, scenery), !chip);
  if (kind >= 12.0) { size = select(select(select(select(0.0028, 0.0014, kind >= 16.0), 0.0017, kind >= 15.0), 0.0046, kind >= 14.0), 0.0075, kind >= 13.0); if (kind < 13.0) { size = 0.0034; } }
  if (gale) { size *= select(0.075, 0.07, chip); }
  let pxWorld = z * cam.tanHalf * 2.0 / cam.pxH;
  let rad = max(size, pxWorld * 0.6);
  let ca = cos(d.ang); let sa = sin(d.ang);
  var rc = select(vec2f(corner.x * ca - corner.y * sa, corner.x * sa + corner.y * ca) * select(vec2f(1.0), vec2f(1.0, 0.5), chip), corner, scenery);
  if (kind >= 15.0 && kind < 16.0) { rc = vec2f(corner.x * ca - corner.y * sa, corner.x * sa + corner.y * ca); }   /* broken fence sections lean */
  if (rooted) {
    /* bend from the root: the top leans with the wind, shivers with the storm, and gusts roll away through the rows */
    let gust = 0.55 + 0.45 * sin(d.pos.z * 26.0 - air.time * (3.5 + air.storm * 3.0) + d.pos.x * 9.0);
    let bend = (air.wind * 0.22 + sin(air.time * (2.4 + air.storm * 3.0) + d.pos.x * 37.0 + d.pos.z * 11.0) * (0.08 + 0.2 * air.storm)) * gust * select(1.0, 0.25, kind >= 14.0);
    let up01 = corner.y * 0.5 + 0.5;
    let fd = d.pos.xz - air.fly.xy; let fw = air.fly.z * exp(-dot(fd, fd) / (0.16 * 0.16));
    let thrash = sign(fd.x + 1e-5) * fw * 1.4 + sin(air.time * 23.0 + d.pos.x * 700.0) * fw * 0.5;
    rc.x += (bend + thrash) * up01 * up01 * 2.0;
  }
  let lift = select(0.0, size, scenery);
  let x = dot(v, cam.right) + rc.x * rad; let y = dot(v, cam.up) + rc.y * rad + lift;
  /* only what is in the air is drawn; the horizon scenery always is */
  let ok = z > select(0.02, 0.0015, gale) && (d.pos.y > 0.002 || scenery || gale);
  o.p = select(vec4f(0.0, 0.0, -2.0, 1.0), vec4f(x / (z * cam.tanHalf * cam.aspect), y / (z * cam.tanHalf), clamp(z / 40.0, 0.0, 1.0), 1.0), ok);
  o.q = corner; o.dist = length(v);
  let t = h3(vec3i(i32(ii), 17, 3));
  o.col = select(select(vec3f(0.76, 0.62, 0.30), vec3f(0.45, 0.30, 0.18), kind >= 1.0), vec3f(0.62, 0.36, 0.24), kind >= 2.0) * (0.75 + 0.5 * t);
  /* what stands in the storm is in its shadow; what flies through it catches the light */
  o.dim = select(1.0, 0.5 - 0.15 * air.storm, rooted) + air.flash * 0.6;
  o.frame = select(-1.0, select(floor(kind) - 3.0, select(3.0, 4.0, kind < 16.0), kind >= 15.0), !chip);
  let cov = size / max(pxWorld * 0.6, 1e-6);
  o.a = select(1.0, clamp(cov * cov, 0.0, 1.0), rad > size);
  return o;
}
struct FO { @location(0) albedo: vec4f, @location(1) dist: vec4f };
@fragment fn fs_main(v: VO) -> FO {
  var o: FO;
  let uvq = vec2f(v.q.x * 0.5 + 0.5, 0.5 - v.q.y * 0.5);
  let s = textureSampleLevel(atlas, smp, vec2f((max(v.frame, 0.0) + uvq.x) / FRAMES, uvq.y), 0.0);
  if (v.frame < 0.0) {
    if (dot(v.q, v.q) > 1.0) { discard; }
    o.albedo = vec4f(v.col, v.a);
  } else {
    if (s.a < 0.5) { discard; }
    o.albedo = vec4f(s.rgb * v.dim, v.a);
  }
  o.dist = vec4f(v.dist, 0.0, 0.0, 1.0);
  return o;
}
`;

/* ── the foreground: tall prairie grass right at the lens, bending and shivering in the wind,
   with gusts rolling away through it toward the storm. Every blade is placed, sized and bent in
   the vertex stage from its instance index; nothing is stored. ── */
export const GRASS = DEBRIS_STRUCTS + COMMON + /* wgsl */ `
@group(0) @binding(0) var<uniform> cam: Cam;
@group(0) @binding(1) var<uniform> air: Air;
struct VO { @builtin(position) p: vec4f, @location(0) col: vec3f, @location(1) dist: f32 };
@vertex fn vs_main(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO {
  var o: VO;
  let a = h3(vec3i(i32(ii), 1, 7)); let b = h3(vec3i(i32(ii), 2, 7)); let c = h3(vec3i(i32(ii), 3, 7)); let e = h3(vec3i(i32(ii), 4, 7));
  /* dense at the lens, thinning into the field; spread wide enough to fill the frame as the camera drifts */
  let z = 0.0022 + pow(a, 2.4) * 0.16;
  let x = cam.pos.x + (b * 2.0 - 1.0) * (z + 0.002) * cam.tanHalf * cam.aspect * 1.35;
  let root = vec3f(x, 0.0, cam.pos.z + z);
  let height = mix(0.00025, 0.0009, c * c) * (1.0 + 0.4 * e);
  let halfW = mix(0.000025, 0.00006, e);
  /* five vertices: two at the root, two halfway, one at the tip */
  let row = f32(vi / 2u); let t = select(row * 0.5, 1.0, vi == 4u);
  let side = select(-1.0, 1.0, (vi & 1u) == 1u);
  let gust = 0.5 + 0.5 * sin(z * 150.0 - air.time * (5.0 + air.storm * 4.0) + x * 40.0);
  let fd = vec2f(x, cam.pos.z + z) - air.fly.xy; let fw = air.fly.z * exp(-dot(fd, fd) / (0.18 * 0.18));
  let bend = (air.wind * 0.4 + sin(air.time * (3.0 + air.storm * 5.0) + x * 900.0 + z * 300.0) * (0.2 + 0.5 * air.storm)) * (0.35 + 0.65 * gust) + (e - 0.5) * 0.3
    + sign(fd.x + 1e-5) * fw * 2.4 + sin(air.time * 26.0 + x * 3000.0) * fw * 0.9;
  let p = root + vec3f(bend * height * t * t + side * halfW * (1.0 - t), height * t * (1.0 - 0.25 * bend * bend * t), 0.0);
  let v = p - cam.pos; let zz = dot(v, cam.fwd);
  o.p = select(vec4f(0.0, 0.0, -2.0, 1.0), vec4f(dot(v, cam.right) / (zz * cam.tanHalf * cam.aspect), dot(v, cam.up) / (zz * cam.tanHalf), clamp(zz / 40.0, 0.0, 1.0), 1.0), zz > 0.0005);
  o.dist = length(v);
  let tip = mix(vec3f(0.10, 0.13, 0.07), vec3f(0.19, 0.19, 0.10), b);
  o.col = mix(vec3f(0.012, 0.018, 0.012), tip, t * t) * (0.7 + 0.3 * gust) * (0.9 - air.storm * 0.25) + vec3f(0.18, 0.22, 0.32) * air.flash * t * t;
  return o;
}
struct FO { @location(0) albedo: vec4f, @location(1) dist: vec4f };
@fragment fn fs_main(v: VO) -> FO { var o: FO; o.albedo = vec4f(v.col, 1.0); o.dist = vec4f(v.dist, 0.0, 0.0, 1.0); return o; }
`;
