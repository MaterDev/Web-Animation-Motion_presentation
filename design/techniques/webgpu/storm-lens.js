/* SUPERCELL · rain on the lens. The camera is out in it, so water lands on the glass.

   The physics, per drop: rain adds drops at a rate set by the storm. A drop clings to the glass
   while it is small, because surface tension holds it. Past a critical radius the part of its
   weight that tension cannot hold pulls it down, with drag and a wandering sideways wobble.
   A running drop sweeps up every drop it touches, conserving area (r² adds), so it grows and
   speeds up, and leaves a trail of small beads that cling behind it. Wind leans the runs.
   Positions are in screen fractions (x across 0–1, y down 0–1); radii are fractions of height.

   The drops are drawn as instanced quads into a small refraction map (offset, rim, coverage),
   and the lens pass samples the scene through it: each drop shows a flipped, magnified patch
   of what is behind it, with a dark rim and a highlight. That is how water on glass reads. */

export const MAX_DROPS = 600;
const R_CRIT = 0.0095;       /* the radius at which gravity beats surface tension */

export function lensSim() {
  const drops = []; let rng = 1;
  const rnd = () => { rng = (rng * 1664525 + 1013904223) >>> 0; return rng / 4294967296; };
  const buf = new Float32Array(MAX_DROPS * 4);
  function add(x, y, r, life) { if (drops.length < MAX_DROPS) drops.push({ x, y, r, vy: 0, wob: rnd() * 6.28, trail: 0, run: false, life }); }
  return {
    buf, get count() { return drops.length; },
    step(dt, rain, wind, aspect) {
      dt = Math.min(dt, 1 / 30);
      /* new drops land in proportion to the rain; a few big splats in a downpour */
      let n = rain * rain * 14 * dt; while (n > 0) { if (rnd() < n) add(rnd(), rnd() * 1.05 - 0.05, 0.003 + Math.pow(rnd(), 2.2) * (0.008 + rain * 0.014), 6 + rnd() * 8); n -= 1; }
      for (const d of drops) {
        /* a clinging drop slowly evaporates and is gone; a running one is fed by what it sweeps up */
        if (!d.run) { d.life -= dt; if (d.life < 1) d.r *= 1 - dt * 0.8; if (d.life <= 0 || d.r < 0.0012) d.dead = true; }
        if (d.r > R_CRIT) {
          const a = 0.9 * (d.r - R_CRIT) / d.r;              /* the weight tension cannot hold */
          d.vy += (a - d.vy * 2.6) * dt;                     /* with drag against the glass */
          d.run = d.vy > 0.004;
        } else { d.vy = Math.max(0, d.vy - dt * 0.5); d.run = d.vy > 0.004; }
        if (d.run) {
          d.wob += dt * (4 + rnd() * 3);
          d.y += d.vy * dt;
          d.x += (Math.sin(d.wob) * 0.012 + wind * 0.01) * d.vy * dt * 10 / aspect;
          /* a running drop leaves beads behind it and shrinks a little doing it */
          d.trail -= d.vy * dt;
          if (d.trail <= 0) { d.trail = 0.02 + rnd() * 0.03; const br = d.r * (0.18 + rnd() * 0.2); d.r = Math.sqrt(Math.max(1e-8, d.r * d.r - br * br * 0.6)); add(d.x + (rnd() - 0.5) * d.r * 0.4 / aspect, d.y - d.r * 1.2, br, 1.5 + rnd() * 2.5); }
        }
      }
      /* merging: a drop absorbs any smaller drop it overlaps, conserving area */
      drops.sort((p, q) => q.r - p.r);
      for (let i = 0; i < drops.length; i++) {
        const d = drops[i]; if (d.dead) continue;
        for (let j = i + 1; j < drops.length; j++) {
          const e = drops[j]; if (e.dead) continue;
          const dx = (d.x - e.x) * aspect, dy = d.y - e.y;
          if (dx * dx + dy * dy < (d.r + e.r) * (d.r + e.r) * 0.8) { d.r = Math.sqrt(d.r * d.r + e.r * e.r); d.vy = Math.max(d.vy, e.vy); e.dead = true; }
        }
      }
      for (let i = drops.length - 1; i >= 0; i--) if (drops[i].dead || drops[i].y - drops[i].r > 1.05) drops.splice(i, 1);
      drops.forEach((d, i) => { buf[i * 4] = d.x; buf[i * 4 + 1] = d.y; buf[i * 4 + 2] = d.r; buf[i * 4 + 3] = d.run ? 1 : 0; });
    },
  };
}

/* one quad per drop into the refraction map: rg is the offset to sample through, b the rim, a coverage */
export const DROPS = /* wgsl */ `
struct Lens { aspect: f32, count: f32, _a: f32, _b: f32 };
@group(0) @binding(0) var<uniform> lens: Lens;
@group(0) @binding(1) var<storage, read> drops: array<vec4f>;
struct VO { @builtin(position) p: vec4f, @location(0) q: vec2f, @location(1) run: f32 };
@vertex fn vs_main(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO {
  var o: VO; let d = drops[ii];
  let corner = vec2f(f32(vi & 1u), f32((vi >> 1u) & 1u)) * 2.0 - 1.0;
  /* a running drop is a little taller than it is wide */
  let stretch = vec2f(1.0, select(1.0, 1.35, d.w > 0.5));
  let c = vec2f(d.x * 2.0 - 1.0, 1.0 - d.y * 2.0);
  let off = corner * d.z * 2.0 * stretch * vec2f(1.0 / lens.aspect, 1.0);
  o.p = select(vec4f(0.0, 0.0, -2.0, 1.0), vec4f(c + off, 0.0, 1.0), f32(ii) < lens.count);
  o.q = corner; o.run = d.w;
  return o;
}
@fragment fn fs_main(v: VO) -> @location(0) vec4f {
  /* a drop on glass: a flattened dome, heavier toward the bottom */
  let q = vec2f(v.q.x, v.q.y * 1.1 + 0.1);
  let r2 = dot(q, q); if (r2 > 1.0) { discard; }
  let h = sqrt(1.0 - r2);
  let off = -q * (0.55 + 0.45 * h);                 /* the lens flips and magnifies what is behind it */
  let rim = smoothstep(0.55, 1.0, r2);
  return vec4f(off * 0.5 + 0.5, rim, 1.0);
}
`;

/* the lens pass: the scene through the drops */
export const LENS = /* wgsl */ `
@group(0) @binding(0) var scene: texture_2d<f32>;
@group(0) @binding(1) var dropMap: texture_2d<f32>;
@group(0) @binding(2) var smp: sampler;
@group(0) @binding(3) var<uniform> look: vec4f;   /* strength, flash, aspect, 0 */
@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let d = textureSampleLevel(dropMap, smp, uv, 0.0);
  var col = textureSampleLevel(scene, smp, uv, 0.0).rgb;
  if (d.a > 0.01) {
    let off = (d.rg - 0.5) * 2.0;
    let through = textureSampleLevel(scene, smp, uv + off * look.x * vec2f(1.0 / look.z, 1.0), 0.0).rgb;
    /* a darker rim where the glass-water edge bends light away, and a small highlight up and to the left */
    var w = through * (1.0 - d.b * 0.55) * 1.05;
    let hl = smoothstep(0.35, 0.0, length(off - vec2f(0.35, -0.45))) * (1.0 - d.b);
    w += vec3f(0.5, 0.55, 0.65) * hl * (0.35 + look.y * 0.8);
    col = mix(col, w, d.a);
  }
  return vec4f(col, 1.0);
}
`;
