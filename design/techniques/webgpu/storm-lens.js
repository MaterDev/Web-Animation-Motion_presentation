/* SUPERCELL · water on the lens. Deliberately not in the style of the rest of the scene: the
   storm is stylised, the glass in front of it is real, and the contrast is the point.

   How water behaves on glass, and what each part of this does about it:
   · Contact-line pinning. A drop sits where it lands, held by the glass's microscopic
     imperfections, until its weight beats that hold. The hold varies across the glass (a
     noise field) and from drop to drop, so drops release at different sizes, not all at once.
   · Wet paths are slippery. A drop that runs leaves a thin film. The film lowers the hold
     where it lies, so later drops find the old paths and follow them, and runs become rivulets.
   · Stick-slip. A running drop crosses patches that hold harder; it slows, sometimes stops,
     gathers what lands on it, and lurches on. Its path wanders sideways toward wetter glass.
   · Shape. A still drop is a slightly irregular dome. A running one is a teardrop: a heavy,
     rounded head leading, and a tail that thins behind it. Its film breaks up into beads
     (a thin thread of water is unstable), left behind at irregular spacing.
   · Coalescence. Drops that touch become one, and the volume is kept (area here, since a drop
     is a thin puddle on glass). The new drop is lopsided, then wobbles and relaxes round —
     and because every drop is drawn as a smooth field that is summed, neighbours already
     bridge and neck into each other before they merge.
   · Optics. The water surface is the level set of that field, so its edge is crisp and merged
     shapes are true outlines. Its normals come from the field's slope: steep rims bend light
     away and read dark, the dome inverts and magnifies what is behind it, and the glassy top
     catches a sharp highlight from the sky and from lightning.

   Units: x across 0–aspect, y down 0–1 (screen height = 1). Mass is area, radius = √mass. */

export const MAX_DROPS = 1400, MAX_SEGS = 400;
const G = 2.2, GRID_W = 64, GRID_H = 40;

export function lensSim() {
  let drops = [], rng = 7, time = 0;
  const rnd = () => { rng = (rng * 1664525 + 1013904223) >>> 0; return rng / 4294967296; };
  const wet = new Float32Array(GRID_W * GRID_H);                       /* the film, coarse, for steering */
  const dropBuf = new Float32Array(MAX_DROPS * 8), segBuf = new Float32Array(MAX_SEGS * 8);
  let segN = 0, aspect = 1.42;
  /* the glass's hold: smooth hash noise, fixed for the life of the lens */
  const hn = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
  const holdAt = (x, y) => { const gx = x * 9, gy = y * 9, ix = Math.floor(gx), iy = Math.floor(gy), fx = gx - ix, fy = gy - iy, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = hn(ix, iy), b = hn(ix + 1, iy), c = hn(ix, iy + 1), d = hn(ix + 1, iy + 1); return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy; };
  const cell = (x, y) => { const i = Math.min(GRID_W - 1, Math.max(0, Math.floor(x / aspect * GRID_W))), j = Math.min(GRID_H - 1, Math.max(0, Math.floor(y * GRID_H))); return j * GRID_W + i; };
  const wetAt = (x, y) => (x < 0 || x > aspect || y < 0 || y > 1 ? 0 : wet[cell(x, y)]);
  function add(x, y, m) { if (drops.length >= MAX_DROPS) return; drops.push({ x, y, m, vx: 0, vy: 0, seed: rnd() * 100, hold: 0.6 + rnd() * 0.9, wob: 0, wobPh: 0, bead: 0.01 + rnd() * 0.02, px: x, py: y }); }
  const R_HOLD = 0.0085;                                                   /* a typical release radius */

  return {
    dropBuf, segBuf, get count() { return drops.length; }, get segs() { return segN; },
    get running() { return drops.filter((d) => d.vy > 0.02).length; },
    step(dt, rain, wind, asp) {
      aspect = asp; dt = Math.min(dt, 1 / 30); time += dt; segN = 0;
      for (let k = 0; k < wet.length; k++) wet[k] *= Math.exp(-dt * 0.12);
      /* rain landing: mostly fine drops, some larger, and now and then a splash of spray */
      let hits = (0.3 + rain) * 30 * dt;
      while (hits > 0) {
        if (rnd() < hits) {
          const x = rnd() * aspect, y = rnd() * 1.02 - 0.02, big = Math.pow(rnd(), 3);
          add(x, y, Math.pow(0.0026 + big * (0.014 + rain * 0.01), 2));
          if (rnd() < 0.12) for (let s = 0, n = 2 + (rnd() * 5) | 0; s < n; s++) { const a = rnd() * 6.283, rr = 0.006 + rnd() * 0.03; add(x + Math.cos(a) * rr, y + Math.sin(a) * rr, Math.pow(0.0008 + rnd() * 0.002, 2)); }
        }
        hits -= 1;
      }
      for (const d of drops) {
        d.px = d.x; d.py = d.y;
        const r = Math.sqrt(d.m);
        /* the hold here: the glass, this drop's own contact line, and how wet the path is */
        const hold = R_HOLD * d.hold * (0.55 + 0.9 * holdAt(d.x, d.y)) * (1 - 0.65 * Math.min(1, wetAt(d.x, d.y)));
        const speed = Math.hypot(d.vx, d.vy);
        if (r > hold) {
          const drive = G * (r - hold) / r;                                /* the weight the hold cannot carry */
          d.vy += (drive - d.vy * (3.2 + 6 * r)) * dt;
          /* steer toward wetter glass just below, and wander; the wind leans it */
          const look = r * 2.5 + 0.01, wl = wetAt(d.x - look, d.y + look), wr = wetAt(d.x + look, d.y + look);
          d.vx += ((wr - wl) * 0.6 + (holdAt(d.x * 3 + 5, d.y * 3 + time * 0.05) - 0.5) * 0.5 + wind * 0.08) * d.vy * dt * 6;
          d.vx *= Math.exp(-dt * 5);
        } else {
          /* pinned: a moving drop that meets a stronger hold stops hard — the stick in stick-slip */
          d.vy *= Math.exp(-dt * (speed > 0.02 ? 9 : 25)); d.vx *= Math.exp(-dt * 25);
        }
        d.x += d.vx * dt; d.y += d.vy * dt;
        const moved = Math.hypot(d.x - d.px, d.y - d.py);
        if (moved > 1e-5 && d.vy > 0.004) {
          /* the film it leaves, drawn as a segment, and marked on the grid so others follow */
          if (segN < MAX_SEGS) { const o = segN * 8; segBuf[o] = d.px; segBuf[o + 1] = d.py - r * 0.6; segBuf[o + 2] = d.x; segBuf[o + 3] = d.y - r * 0.6; segBuf[o + 4] = r * 0.42; segBuf[o + 5] = Math.min(1, dt * 20); segN++; }
          wet[cell(d.x, d.y)] = Math.min(1.5, wet[cell(d.x, d.y)] + moved * 60);
          /* and the beads its thread breaks into */
          d.bead -= moved;
          if (d.bead <= 0 && r > 0.004) { d.bead = r * (1.2 + rnd() * 3.5); const bm = d.m * (0.02 + rnd() * 0.05); d.m -= bm; add(d.x + (rnd() - 0.5) * r * 0.5, d.y - r * (1.4 + rnd()), bm); }
        }
        d.wob *= Math.exp(-dt * 3.5); d.wobPh += dt * (9 + 0.05 / Math.max(r, 0.004));
        /* the finest beads evaporate */
        if (d.m < 3e-6) d.m -= dt * 1.5e-7;
      }
      /* coalescence, via a spatial hash */
      const cs = 0.03, grid = new Map();
      drops.forEach((d, i) => { const k = Math.floor(d.x / cs) * 4096 + Math.floor(d.y / cs); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(i); });
      const dead = new Uint8Array(drops.length);
      for (let i = 0; i < drops.length; i++) {
        if (dead[i]) continue; const d = drops[i], cx = Math.floor(d.x / cs), cy = Math.floor(d.y / cs);
        for (let gx = cx - 1; gx <= cx + 1; gx++) for (let gy = cy - 1; gy <= cy + 1; gy++) {
          const a = grid.get(gx * 4096 + gy); if (!a) continue;
          for (const j of a) {
            if (j <= i || dead[j]) continue; const e = drops[j];
            const rd = Math.sqrt(d.m) + Math.sqrt(e.m), dx = d.x - e.x, dy = d.y - e.y;
            if (dx * dx + dy * dy < rd * rd * 0.42) {
              const M = d.m + e.m, big = Math.max(d.m, e.m), small = Math.min(d.m, e.m);
              d.x = (d.x * d.m + e.x * e.m) / M; d.y = (d.y * d.m + e.y * e.m) / M;
              d.vx = (d.vx * d.m + e.vx * e.m) / M; d.vy = (d.vy * d.m + e.vy * e.m) / M;
              d.wob = Math.min(0.5, d.wob + 0.6 * small / big); d.wobPh = 0; d.m = M; dead[j] = 1;
            }
          }
        }
      }
      drops = drops.filter((d, i) => !dead[i] && d.m > 0 && d.y - Math.sqrt(d.m) < 1.04);
      drops.forEach((d, i) => {
        const o = i * 8, sp = Math.hypot(d.vx, d.vy), r = Math.sqrt(d.m);
        dropBuf[o] = d.x; dropBuf[o + 1] = d.y; dropBuf[o + 2] = r; dropBuf[o + 3] = d.seed;
        dropBuf[o + 4] = sp > 1e-4 ? d.vx / sp : 0; dropBuf[o + 5] = sp > 1e-4 ? d.vy / sp : 1; dropBuf[o + 6] = Math.min(1.6, sp / (0.35 + r * 8)); dropBuf[o + 7] = d.wob * Math.sin(d.wobPh);
      });
    },
  };
}

/* ── the water field: every drop adds a smooth bump. r is coverage (its level set is the
   water's edge), g is thickness (its slope is the surface normal). ── */
export const FIELD = /* wgsl */ `
struct Lens { aspect: f32, count: f32, segs: f32, px: f32 };
struct Drop { a: vec4f, b: vec4f };
@group(0) @binding(0) var<uniform> lens: Lens;
@group(0) @binding(1) var<storage, read> drops: array<Drop>;
struct VO { @builtin(position) p: vec4f, @location(0) q: vec2f, @location(1) @interpolate(flat) i: u32 };
@vertex fn vs_main(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO {
  var o: VO; let d = drops[ii];
  let corner = vec2f(f32(vi & 1u), f32((vi >> 1u) & 1u)) * 2.0 - 1.0;
  /* the quad covers the head and the tail behind it */
  let r = d.a.z; let reach = r * (1.6 + d.b.z * 2.6);
  let c = d.a.xy + corner * reach;
  o.p = select(vec4f(0.0, 0.0, -2.0, 1.0), vec4f(c.x / lens.aspect * 2.0 - 1.0, 1.0 - c.y * 2.0, 0.0, 1.0), f32(ii) < lens.count && r > lens.px * 0.4);
  o.q = corner * reach / r; o.i = ii;
  return o;
}
@fragment fn fs_main(v: VO) -> @location(0) vec4f {
  let d = drops[v.i]; let r = d.a.z; let seed = d.a.w;
  let dir = vec2f(d.b.x, d.b.y); let stretch = d.b.z; let wob = d.b.w;
  /* into the drop's own frame: y along its motion (down for a still drop), x across */
  let side = vec2f(dir.y, -dir.x);
  var p = vec2f(dot(v.q, side), dot(v.q, dir));
  /* a merge leaves it lopsided; it rings, then relaxes */
  p = p * vec2f(1.0 + wob, 1.0 - wob);
  /* the head leads round and heavy; the tail thins out behind it */
  let behind = max(-p.y, 0.0);
  p.y = select(p.y, p.y / (1.0 + stretch * 2.4), p.y < 0.0);
  p.x = p.x / mix(1.0, 1.0 - 0.55 * smoothstep(0.0, 2.2, behind), stretch);
  /* the contact line is never a perfect circle */
  let ang = atan2(p.y, p.x);
  let wobbly = 1.0 + 0.06 * sin(ang * 3.0 + seed) + 0.04 * sin(ang * 5.0 + seed * 1.7) + 0.03 * sin(ang * 2.0 + seed * 3.1);
  let rr = length(p) * wobbly;
  if (rr >= 1.34) { discard; }
  let k = max(0.0, 1.0 - rr * rr / 1.8);
  let cover = k * k * k;
  let thick = r * sqrt(max(0.0, 1.0 - rr * rr)) * (1.0 + 0.25 * smoothstep(0.0, 1.0, p.y));
  return vec4f(cover, thick, 0.0, 1.0);
}
`;
/* the film a running drop leaves: a thin capsule, too thin to cross the edge threshold on its own */
export const FILM = /* wgsl */ `
struct Lens { aspect: f32, count: f32, segs: f32, px: f32 };
struct Seg { a: vec4f, b: vec4f };
@group(0) @binding(0) var<uniform> lens: Lens;
@group(0) @binding(1) var<storage, read> segs: array<Seg>;
struct VO { @builtin(position) p: vec4f, @location(0) xy: vec2f, @location(1) @interpolate(flat) i: u32 };
@vertex fn vs_main(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO {
  var o: VO; let s = segs[ii];
  let corner = vec2f(f32(vi & 1u), f32((vi >> 1u) & 1u)) * 0.5 + 0.5;
  let lo = min(s.a.xy, s.a.zw) - vec2f(s.b.x * 1.5); let hi = max(s.a.xy, s.a.zw) + vec2f(s.b.x * 1.5);
  let xy = mix(lo, hi, corner);
  o.p = select(vec4f(0.0, 0.0, -2.0, 1.0), vec4f(xy.x / lens.aspect * 2.0 - 1.0, 1.0 - xy.y * 2.0, 0.0, 1.0), f32(ii) < lens.segs);
  o.xy = xy; o.i = ii; return o;
}
@fragment fn fs_main(v: VO) -> @location(0) vec4f {
  let s = segs[v.i]; let a = s.a.xy; let b = s.a.zw; let ab = b - a;
  let h = clamp(dot(v.xy - a, ab) / max(dot(ab, ab), 1e-10), 0.0, 1.0);
  let dd = length(v.xy - a - ab * h) / max(s.b.x, 1e-5);
  if (dd >= 1.0) { discard; }
  let f = (1.0 - dd * dd) * s.b.y;
  return vec4f(f * 0.14, f * s.b.x * 0.3, 0.0, 1.0);
}
`;
/* the film fades: each frame the old field, dimmed */
export const FADE = /* wgsl */ `
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(1) var<uniform> fade: vec4f;
@fragment fn fs_main(@builtin(position) fc: vec4f) -> @location(0) vec4f { let v = textureLoad(src, vec2i(fc.xy), 0); return vec4f(v.rg * fade.x, 0.0, 1.0); }
`;

/* ── the glass: the scene seen through the water ── */
export const LENS = /* wgsl */ `
@group(0) @binding(0) var scene: texture_2d<f32>;
@group(0) @binding(1) var drops: texture_2d<f32>;
@group(0) @binding(2) var film: texture_2d<f32>;
@group(0) @binding(3) var smp: sampler;
@group(0) @binding(4) var<uniform> look: vec4f;   /* flash, aspect, texel width, texel height */
fn field(uv: vec2f) -> vec2f { let a = textureSampleLevel(drops, smp, uv, 0.0).rg; let b = textureSampleLevel(film, smp, uv, 0.0).rg; return a + b; }
@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let tx = vec2f(look.z, look.w);
  let F = field(uv);
  let fl = fwidth(F.r);
  let base = textureSampleLevel(scene, smp, uv, 0.0).rgb;
  /* the surface normal from the thickness slope (thickness is in screen heights) */
  let gx = field(uv + vec2f(tx.x, 0.0)).g - field(uv - vec2f(tx.x, 0.0)).g;
  let gy = field(uv + vec2f(0.0, tx.y)).g - field(uv - vec2f(0.0, tx.y)).g;
  let grad = vec2f(gx / (2.0 * tx.x * look.y), gy / (2.0 * tx.y));
  let n = normalize(vec3f(-grad * 1.6, 1.0));
  /* the water's edge: a crisp level set, antialiased to one pixel */
  let T = 0.3; let w = max(fl, 1e-4);
  let inside = smoothstep(T - w, T + w, F.r);
  var col = base;
  /* the film on its own: a faint smear of refraction where drops have run */
  let filmOnly = clamp(F.r / T, 0.0, 1.0) * (1.0 - inside);
  col = mix(col, textureSampleLevel(scene, smp, uv - n.xy * 0.012, 0.0).rgb * 1.12, filmOnly * 0.8);
  /* refraction: a dome turns what is behind it upside down and shrinks it into itself */
  let bend = n.xy * (0.06 + F.g * 9.0);
  var through = textureSampleLevel(scene, smp, uv - bend, 0.0).rgb;
  /* the rim, where the surface meets the glass steeply, sends light away and reads as a thin dark line;
     just inside it on the lower side, light gathered by the dome makes a bright crescent */
  let rim = 1.0 - smoothstep(T, T + 0.22, F.r);
  through *= 1.0 - rim * 0.75;
  let crescent = smoothstep(T + 0.05, T + 0.2, F.r) * (1.0 - smoothstep(T + 0.2, T + 0.5, F.r)) * smoothstep(0.1, 0.7, n.y);
  through = through * 1.08 + vec3f(0.75, 0.8, 0.9) * crescent * 0.25;
  /* the sky and the lightning in its glassy top */
  let hvec = normalize(normalize(vec3f(-0.35, -0.75, 0.55)) + vec3f(0.0, 0.0, 1.0));
  let spec = pow(max(dot(n, hvec), 0.0), 140.0);
  let fres = 0.04 + 0.96 * pow(1.0 - n.z, 5.0);
  let sky = textureSampleLevel(scene, smp, vec2f(uv.x, 0.08) + n.xy * 0.25, 0.0).rgb;
  /* a second, broad sheen: the storm's glow on the wet dome, strongest on the side facing up */
  let sheen = pow(max(dot(n, normalize(vec3f(0.0, -0.6, 0.8))), 0.0), 12.0);
  through = mix(through, sky * 1.6 + vec3f(0.05, 0.06, 0.08), fres * 0.7) + vec3f(1.0, 0.98, 0.95) * spec * (1.4 + look.x * 3.0) + vec3f(0.35, 0.38, 0.5) * sheen * 0.25;
  col = mix(col, through, inside);
  return vec4f(col, 1.0);
}
`;
