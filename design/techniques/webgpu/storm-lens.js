/* SUPERCELL · water on the lens, simulated as a fluid. Deliberately real against a stylised storm.

   The water is a thin film on the glass, stepped on the GPU as depth-averaged flow, the model
   used for rivulets and drops on a window. Per cell: h (how thick the water is) and a velocity.
   The forces are the ones that decide how water moves on glass:

   · Surface tension. Pressure is -γ∇²h: water is pushed out of bulges and into hollows, so
     drops round up, necks pull tight, and two drops that touch pull into one pool and ring.
   · Disjoining pressure, Π(h). Glass is covered in a film only molecules thick; below a
     certain thickness water is pushed off rather than drawn in. That is what gives a drop its
     contact angle and why a trail left by a running drop breaks up into beads on its own
     (a thin film on glass is unstable) instead of fading away.
   · Gravity, down the glass, and the wind pushing across it.
   · Viscous drag against the glass. The thinner the water the harder the glass holds it back
     (lubrication: drag ∝ 1/h²), so a fat drop runs and a thin film barely creeps.
   · Contact-line pinning. Glass is never clean. Near the water's edge a static friction holds
     the drop until the push beats it, and the hold varies across the glass, so drops sit, then
     release at different sizes, slide in fits and starts, and take the wet paths others left.

   The grid is staggered (height at cell centres, velocity on faces), fluxes are upwinded and
   limited so no cell goes below the molecular film, and the whole thing runs a few substeps a
   frame in two compute kernels. Rain lands as caps of water. The lens pass then reads the height
   field through a smooth cubic filter: its level set is the water's edge, its slope the surface
   normal, and the scene is refracted, darkened at the rims and lit with highlights through it. */

export const MAX_HITS = 16;

const STRUCT = /* wgsl */ `
struct Water {
  dt: f32, g: f32, gamma: f32, drag: f32,
  hs: f32, B: f32, pin: f32, wind: f32,
  count: f32, reset: f32, time: f32, maxH: f32,
  hits: array<vec4f, ${MAX_HITS}>,
};
@group(0) @binding(0) var<uniform> w: Water;
@group(0) @binding(1) var src: texture_2d<f32>;
@group(0) @binding(2) var dst: texture_storage_2d<rgba16float, write>;
fn at(p: vec2i) -> vec4f { let s = vec2i(textureDimensions(src)); return textureLoad(src, clamp(p, vec2i(0), s - vec2i(1)), 0); }
fn hh(p: vec2i) -> f32 { return max(at(p).r, w.hs); }
fn h2(p: vec2i) -> f32 { var v = vec2u(p + vec2i(4096)); v = v * 1664525u + 1013904223u; v.x += v.y * 747796405u; v = v ^ (v >> vec2u(15u)); v = v * 2891336453u; return f32((v.x ^ v.y) & 0xffffu) / 65535.0; }
/* how hard the glass holds water here: smooth patches, with specks that grip harder */
fn grip(p: vec2i) -> f32 {
  let q = vec2f(p) * 0.06; let i = vec2i(floor(q)); let f = fract(q); let u = f * f * (3.0 - 2.0 * f);
  let n = mix(mix(h2(i), h2(i + vec2i(1, 0)), u.x), mix(h2(i + vec2i(0, 1)), h2(i + vec2i(1, 1)), u.x), u.y);
  let speck = step(0.985, h2(p * 3 + vec2i(17, 5)));
  return 0.45 + 1.1 * n + speck * 1.5;
}
`;

/* substep, part one: velocities on the faces from pressure, gravity, wind, drag and pinning */
export const WATER_FORCE = STRUCT + /* wgsl */ `
fn pressure(p: vec2i) -> f32 {
  let h = hh(p);
  let lap = hh(p + vec2i(1, 0)) + hh(p - vec2i(1, 0)) + hh(p + vec2i(0, 1)) + hh(p - vec2i(0, 1)) - 4.0 * h;
  let r = w.hs / h;
  return -w.gamma * lap - w.B * (r * r * r - r * r);
}
@compute @workgroup_size(8, 8) fn cs_main(@builtin(global_invocation_id) id: vec3u) {
  let size = vec2u(textureDimensions(src)); if (id.x >= size.x || id.y >= size.y) { return; }
  let c = vec2i(id.xy);
  if (w.reset > 0.5) { textureStore(dst, c, vec4f(w.hs, 0.0, 0.0, 0.0)); return; }
  let s = at(c); let h = max(s.r, w.hs);
  var u = s.gb;                                      /* x on the right face, y on the bottom face */
  let pc = pressure(c);
  let hx = 0.5 * (h + hh(c + vec2i(1, 0))); let hy = 0.5 * (h + hh(c + vec2i(0, 1)));
  u.x += w.dt * (-(pressure(c + vec2i(1, 0)) - pc) + w.wind);
  u.y += w.dt * (-(pressure(c + vec2i(0, 1)) - pc) + w.g);
  /* drag against the glass, taken implicitly so thin water is held without blowing up */
  u.x /= 1.0 + w.dt * w.drag / (hx * hx + 0.02);
  u.y /= 1.0 + w.dt * w.drag / (hy * hy + 0.02);
  /* pinning: near the edge of the water static friction takes a fixed bite out of the speed */
  let edge = 1.0 - smoothstep(0.15, 0.9, min(min(hh(c + vec2i(1, 0)), hh(c - vec2i(1, 0))), min(hh(c + vec2i(0, 1)), hh(c - vec2i(0, 1)))));
  let bite = w.pin * grip(c) * (0.7 + 0.3 * edge) * w.dt;
  let sp = length(u);
  u *= max(sp - bite, 0.0) / max(sp, 1e-6);
  let lim = 0.5 / w.dt; let sp2 = length(u); if (sp2 > lim) { u *= lim / sp2; }
  textureStore(dst, c, vec4f(h, u, 0.0));
}
`;

/* substep, part two: move the water through the faces, conserving it, and let rain land */
export const WATER_MOVE = STRUCT + /* wgsl */ `
fn ux(p: vec2i) -> f32 { return at(p).g; }
fn uy(p: vec2i) -> f32 { return at(p).b; }
fn outflow(p: vec2i) -> f32 {
  let h = hh(p) - w.hs;
  return w.dt * h * (max(ux(p), 0.0) + max(-ux(p - vec2i(1, 0)), 0.0) + max(uy(p), 0.0) + max(-uy(p - vec2i(0, 1)), 0.0));
}
/* a cell cannot give away more water than it has above the molecular film */
fn share(p: vec2i) -> f32 { let out = outflow(p); let h = hh(p) - w.hs; return select(1.0, clamp(h / out, 0.0, 1.0), out > h); }
fn faceX(p: vec2i) -> f32 { let u = ux(p); if (u > 0.0) { return u * (hh(p) - w.hs) * share(p); } let q = p + vec2i(1, 0); return u * (hh(q) - w.hs) * share(q); }
fn faceY(p: vec2i) -> f32 { let u = uy(p); if (u > 0.0) { return u * (hh(p) - w.hs) * share(p); } let q = p + vec2i(0, 1); return u * (hh(q) - w.hs) * share(q); }
@compute @workgroup_size(8, 8) fn cs_main(@builtin(global_invocation_id) id: vec3u) {
  let size = vec2u(textureDimensions(src)); if (id.x >= size.x || id.y >= size.y) { return; }
  let c = vec2i(id.xy);
  if (w.reset > 0.5) { textureStore(dst, c, vec4f(w.hs, 0.0, 0.0, 0.0)); return; }
  let s = at(c);
  var h = max(s.r, w.hs) - w.dt * (faceX(c) - faceX(c - vec2i(1, 0)) + faceY(c) - faceY(c - vec2i(0, 1)));
  for (var k = 0; k < i32(w.count); k++) {
    let hit = w.hits[k]; let d = length(vec2f(c) + 0.5 - hit.xy);
    if (d < hit.z) { h += hit.w * (1.0 - d * d / (hit.z * hit.z)); }
  }
  if (c.y >= i32(size.y) - 2) { h = mix(h, w.hs, 0.35); }   /* water runs off the bottom of the lens */
  /* small beads and thin films slowly dry; drops big enough to matter do not */
  h -= w.dt * 0.0012 * (1.0 - smoothstep(1.0, 2.5, h));
  h = clamp(h, w.hs, w.maxH);
  textureStore(dst, c, vec4f(h, s.g, s.b, 0.0));
}
`;

/* rain landing on the lens, in sim cells: mostly fine drops, some fat ones, and bursts of spray */
export function rainOnLens() {
  let rng = 11; const rnd = () => { rng = (rng * 1664525 + 1013904223) >>> 0; return rng / 4294967296; };
  let carry = 0;
  return (dt, rain, gust, W, H) => {
    const hits = [];
    carry += (0.3 + rain) * 26 * dt + gust * 60 * dt;
    while (carry >= 1 && hits.length < MAX_HITS) {
      carry -= 1;
      const x = rnd() * W, y = rnd() * H * 1.05 - H * 0.05, big = Math.pow(rnd(), 2.6);
      const r = 1.6 + big * 7.0 + rain * 0.8;
      hits.push([x, y, r, r * (0.42 + 0.18 * rnd())]);
      if (rnd() < 0.1) for (let k = 0, n = 2 + (rnd() * 3) | 0; k < n && hits.length < MAX_HITS; k++) { const a = rnd() * 6.283, rr = r * (1.5 + rnd() * 3); hits.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr, 0.9 + rnd() * 0.7, 0.4 + rnd() * 0.3]); }
    }
    if (carry > 3) carry = 3;
    while (hits.length < MAX_HITS) hits.push([0, 0, 0, 0]);
    return hits;
  };
}

/* ── the glass: the scene seen through the water ── */
export const LENS = /* wgsl */ `
@group(0) @binding(0) var scene: texture_2d<f32>;
@group(0) @binding(1) var water: texture_2d<f32>;
@group(0) @binding(2) var smp: sampler;
@group(0) @binding(3) var<uniform> look: vec4f;   /* flash, thickness at the water's edge, sim width, sim height */
@group(0) @binding(4) var<uniform> lab: vec4f;    /* x > 0.5: show the water against a grid, for judging the physics */
fn backdrop(uv: vec2f) -> vec3f { if (lab.x < 0.5) { return textureSampleLevel(scene, smp, uv, 0.0).rgb; } let g = abs(fract(uv * vec2f(24.0, 17.0)) - 0.5); let line = 1.0 - smoothstep(0.44, 0.48, max(g.x, g.y)); return mix(vec3f(0.85, 0.5, 0.2), vec3f(0.12, 0.2, 0.4), uv.y) * (0.75 + 0.25 * line); }
fn bw(v: f32) -> vec4f { let n = vec4f(1.0, 2.0, 3.0, 4.0) - v; let s = n * n * n; let x = s.x; let y = s.y - 4.0 * s.x; let z = s.z - 4.0 * s.y + 6.0 * s.x; return vec4f(x, y, z, 6.0 - x - y - z) / 6.0; }
/* a smooth cubic read of the height field in four bilinear taps */
fn H(uv: vec2f) -> f32 {
  let size = look.zw; var tc = uv * size - 0.5; let f = fract(tc); tc -= f;
  let xw = bw(f.x); let yw = bw(f.y);
  let cc = tc.xxyy + vec4f(-0.5, 1.5, -0.5, 1.5);
  let sw = vec4f(xw.x + xw.y, xw.z + xw.w, yw.x + yw.y, yw.z + yw.w);
  let o = (cc + vec4f(xw.y / sw.x, xw.w / sw.y, yw.y / sw.z, yw.w / sw.w)) / size.xxyy;
  let s0 = textureSampleLevel(water, smp, o.xz, 0.0).r; let s1 = textureSampleLevel(water, smp, o.yz, 0.0).r;
  let s2 = textureSampleLevel(water, smp, o.xw, 0.0).r; let s3 = textureSampleLevel(water, smp, o.yw, 0.0).r;
  let sx = sw.x / (sw.x + sw.y); let sy = sw.z / (sw.z + sw.w);
  return mix(mix(s3, s2, sx), mix(s1, s0, sx), sy);
}
@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let texel = 1.0 / look.zw;
  let h = H(uv);
  /* the slope from plain filtered taps: the cubic read sets the edge, the normal needs no more than this */
  let gx = (textureSampleLevel(water, smp, uv + vec2f(texel.x, 0.0), 0.0).r - textureSampleLevel(water, smp, uv - vec2f(texel.x, 0.0), 0.0).r) * 0.5;
  let gy = (textureSampleLevel(water, smp, uv + vec2f(0.0, texel.y), 0.0).r - textureSampleLevel(water, smp, uv - vec2f(0.0, texel.y), 0.0).r) * 0.5;
  let n = normalize(vec3f(-gx * 3.5, -gy * 3.5, 1.0));
  let base = backdrop(uv);
  let T = look.y;
  let wEdge = max(fwidth(h), 1e-4);
  let inside = smoothstep(T - wEdge, T + wEdge, h);
  var col = base;
  /* a wet film too thin to bead still smears the view a little */
  let film = smoothstep(T * 0.25, T, h) * (1.0 - inside);
  col = mix(col, backdrop(uv - n.xy * 0.01) * 1.06, film * 0.7);
  /* refraction: a drop is a small lens that turns what is behind it over and shrinks it */
  /* a drop is a small lens: the view through it is flipped and shrunk, displaced by about the drop's own size */
  let bend = n.xy * (min(h, 12.0) + 1.5) * texel.y * 4.0;
  var through = backdrop(uv - bend);
  /* its edge, where the surface meets the glass steeply, turns light away: a thin dark line */
  let slope = length(vec2f(gx, gy));
  through *= 1.0 - smoothstep(0.3, 1.2, slope) * 0.6;
  /* light gathered by the dome lands inside the lower edge as a bright crescent */
  through += vec3f(0.8, 0.85, 0.95) * smoothstep(0.2, 0.7, slope) * smoothstep(0.1, 0.8, n.y) * (1.0 - smoothstep(0.7, 1.2, slope)) * 0.3;
  /* the storm's glow on the wet surface, and a hard specular from above */
  let hv = normalize(vec3f(-0.25, -0.8, 1.0) + vec3f(0.0, 0.0, 1.0));
  let spec = pow(max(dot(n, hv), 0.0), 90.0);
  let fres = 0.03 + 0.97 * pow(1.0 - n.z, 5.0);
  let sky = backdrop(clamp(vec2f(uv.x, 0.06) + n.xy * 0.3, vec2f(0.0), vec2f(1.0)));
  through = mix(through * 1.06, sky * 1.5, fres * 0.6) + vec3f(1.0, 0.98, 0.94) * spec * (0.7 + look.x * 3.0);
  col = mix(col, through, inside);
  return vec4f(col, 1.0);
}
`;
