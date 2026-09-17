// @ts-nocheck -- copied from design/techniques/webgpu/; untyped sheet code
/* SUPERCELL · water on the lens. Deliberately real against a stylised storm.

   Built from how water on glass behaves, and from the two effects known to read as real:
   Lucas Bebber's Codrops RainEffect (2015) and Martijn Steinrucken's "Heartfelt" (2017).

   What is on real wet glass, and what this does about each:
   · A dense scatter of tiny droplets, well under a millimetre, and only a sparse set of larger drops.
     → Two layers. A micro-droplet layer lives in a texture at full resolution; splats accumulate in it
       and slowly dry. Larger drops are particles (Codrops: droplets 2–4 px against drops 10–40 px).
   · A drop stays put until its weight beats the hold of its contact line (contact-angle hysteresis);
     the critical size on vertical glass is a few millimetres, near water's capillary length of 2.7 mm.
     → Each drop has a hold that varies across the glass and from drop to drop, lower where the glass is
       already wet. Past it, the unheld share of its weight drives it, against drag.
   · A sliding drop is a teardrop and sheds smaller droplets from its tail, losing water as it goes; the thread it leaves breaks
     into elongated beads (the Rayleigh–Plateau instability), so a trail is dashes, not a smear. On dry
     glass the path wanders; on wet glass it runs nearly straight.
     → Runners stretch with speed, shed beads at 0.18–0.53 of their radius at irregular spacing (1.2 radii plus an
       exponential tail) until they fall below their hold and stop,
       steer toward wetter glass, and wander on dry glass.
   · A running drop sweeps up the droplets in its path, leaving a clean channel.
     → Runners erase the micro layer along their path and gain a little area for it.
   · Drops that touch merge, and the volume is kept.
     → Area-conserving merges; the merged drop is lopsided, then rings back round.
   · Where water comes from on a camera in a storm: spray, gusts that throw more of it, heavier drops,
     and water that gathers at the top of the hood and drips.
     → Spray lands one droplet at a time anywhere on the glass; a gust raises the rate for under a second
       and leans it toward a broad area, never a burst. Every few seconds a bolder drop lands with a few
       tiny impact satellites and runs. Drips are beads released from slowly wandering places along the top.

   Units: x across 0–aspect, y down 0–1 (the screen's height is 1). Radius is the visible radius. */

export const MAX_DROPS = 400, MAX_DEW = 1536, MAX_WIPE = 400;
const R_CRIT = 0.0065;          /* typical release radius: about 8 px on a 1200 px tall screen */
const G = 3.0, DRAG = 4.2;

export function lensSim() {
  let rng = 7; const rnd = () => { rng = (rng * 1664525 + 1013904223) >>> 0; return rng / 4294967296; };
  let drops = [], aspect = 1.42, time = 0, flingIn = 1.5, dripCarry = 0;
  const GW = 72, GH = 48, wet = new Float32Array(GW * GH);
  const dropBuf = new Float32Array(MAX_DROPS * 8), dewBuf = new Float32Array(MAX_DEW * 8), wipeBuf = new Float32Array(MAX_WIPE * 8);
  let nDew = 0, nWipe = 0;
  const spouts = Array.from({ length: 7 }, () => ({ x: rnd(), drift: (rnd() - 0.5) * 0.012 }));
  const hn = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
  /* how hard the glass holds water here: smooth patches at about a drop's scale */
  const holdAt = (x, y) => { const gx = x * 45, gy = y * 45, ix = Math.floor(gx), iy = Math.floor(gy), fx = gx - ix, fy = gy - iy, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = hn(ix, iy), b = hn(ix + 1, iy), c = hn(ix, iy + 1), d = hn(ix + 1, iy + 1); return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy; };
  const cell = (x, y) => Math.min(GH - 1, Math.max(0, Math.floor(y * GH))) * GW + Math.min(GW - 1, Math.max(0, Math.floor(x / aspect * GW)));
  const wetAt = (x, y) => (x < 0 || x > aspect || y < 0 || y > 1 ? 0 : wet[cell(x, y)]);
  const add = (x, y, r, vy = 0) => { if (drops.length < MAX_DROPS) drops.push({ x, y, r, vx: 0, vy, hold: 0.75 + rnd() * 0.5, seed: rnd() * 100, wob: 0, wobPh: 0, shed: r * (1.5 + rnd() * 3), px: x, py: y }); };
  /* a micro droplet, or a dash of trail: position, radius, stretch along a direction */
  const dew = (x, y, r, stretch = 1, dx = 0, dy = 1) => { if (nDew >= MAX_DEW) return; const o = nDew * 8; dewBuf[o] = x; dewBuf[o + 1] = y; dewBuf[o + 2] = r; dewBuf[o + 3] = stretch; dewBuf[o + 4] = dx; dewBuf[o + 5] = dy; dewBuf[o + 6] = rnd() * 100; dewBuf[o + 7] = 0; nDew++; };
  const wipe = (x0, y0, x1, y1, r) => { if (nWipe >= MAX_WIPE) return; const o = nWipe * 8; wipeBuf[o] = x0; wipeBuf[o + 1] = y0; wipeBuf[o + 2] = x1; wipeBuf[o + 3] = y1; wipeBuf[o + 4] = r; nWipe++; };

  /* spray: single droplets landing one at a time, anywhere on the glass. A gust only raises the rate for a moment
     and leans where they land toward one broad area; nothing arrives as a burst. */
  let gustT = 0, gustX = 0.5, gustY = 0.5, gustW = 0, boldIn = 3;
  const gauss = () => (rnd() + rnd() + rnd() - 1.5) / 1.5;
  function spray(dt, rain) {
    const rate = (0.15 + rain) * 30 + gustW * 180;
    let n = rate * dt; while (n > 0) {
      if (rnd() < n) {
        const inGust = gustW > 0 && rnd() < gustW * 180 / rate;
        const x = inGust ? gustX + gauss() * 0.45 * aspect : rnd() * aspect, y = inGust ? gustY + gauss() * 0.4 : rnd();
        dew(x, y, 0.0009 + Math.pow(rnd(), 2.5) * 0.0026, 1 + rnd() * 0.3, rnd() - 0.5, 1);
      }
      n -= 1;
    }
  }
  /* now and then a bolder drop lands: a few tiny satellites thrown from its impact, and it runs */
  function bold(rain) {
    const x = rnd() * aspect, y = 0.05 + rnd() * 0.75, r = 0.0085 + rnd() * 0.0055;
    add(x, y, r, 0.02);
    for (let k = 0, n = 4 + (rnd() * 7) | 0; k < n; k++) { const a = rnd() * 6.283, d = r * (1.6 + rnd() * 2.5); dew(x + Math.cos(a) * d, y + Math.sin(a) * d, 0.0006 + rnd() * 0.0012); }
  }

  const api = {
    dropBuf, dewBuf, wipeBuf, get drops() { return drops.length; }, get dews() { return nDew; }, get wipes() { return nWipe; },
    get running() { return drops.filter((d) => d.vy > 0.03).length; },
    flingNow: false, probe: null,
    step(dt, rain, wind, asp, gust) {
      aspect = asp; dt = Math.min(dt, 1 / 30); time += dt; nDew = 0; nWipe = 0;
      for (let k = 0; k < wet.length; k++) wet[k] *= Math.exp(-dt * 0.08);
      /* flings: every few seconds, sooner in heavy rain and much sooner when a tornado passes */
      flingIn -= dt * (0.35 + rain * 0.7 + gust * 5);
      if (api.flingNow || flingIn <= 0) { api.flingNow = false; flingIn = 1.5 + rnd() * 3; gustT = 0.6 + rnd() * 0.8; gustX = rnd() * aspect; gustY = 0.2 + rnd() * 0.6; }
      gustT = Math.max(0, gustT - dt); gustW = Math.min(1, gustT * 2);
      spray(dt, rain);
      boldIn -= dt * (0.4 + rain);
      if (boldIn <= 0) { boldIn = 3 + rnd() * 5; bold(rain); }
      /* drips from the top edge */
      dripCarry += (0.15 + rain) * 0.7 * dt;
      while (dripCarry >= 1) { dripCarry -= 1; const sp = spouts[(rnd() * spouts.length) | 0]; const x = (rnd() < 0.7 ? sp.x + (rnd() - 0.5) * 0.015 : rnd()) * aspect; add(x, 0.004, R_CRIT * (1.1 + rnd() * 0.5), 0.05); }
      for (const sp of spouts) { sp.x += sp.drift * dt; if (sp.x < 0.02 || sp.x > 0.98) sp.drift = -sp.drift; }
      if (api.probe) { for (const p of api.probe) add(p[0] * aspect, p[1], p[2]); api.probe = null; }

      for (const d of drops) {
        d.px = d.x; d.py = d.y;
        const hold = R_CRIT * d.hold * (0.7 + 0.6 * holdAt(d.x, d.y)) * (1 - 0.45 * Math.min(1, wetAt(d.x, d.y)));
        if (d.r > hold) {
          d.vy += (G * (d.r - hold) / d.r - d.vy * DRAG) * dt;
          /* steer toward wet glass just below; wander on dry glass; the wind leans it */
          const look = d.r * 3 + 0.004, wl = wetAt(d.x - look, d.y + look), wr = wetAt(d.x + look, d.y + look), wetHere = Math.min(1, wetAt(d.x, d.y));
          d.vx += ((wr - wl) * 1.2 + (holdAt(d.x * 1.6 + 3, d.y * 1.6 + d.seed) - 0.5) * 5.0 * (1 - 0.7 * wetHere) + wind * 0.15) * d.vy * dt * 3;
          d.vx *= Math.exp(-dt * 6);
        } else {
          /* pinned; a moving drop that meets a stronger hold stops hard */
          d.vy *= Math.exp(-dt * 22); d.vx *= Math.exp(-dt * 22);
        }
        d.x += d.vx * dt; d.y += d.vy * dt;
        const moved = Math.hypot(d.x - d.px, d.y - d.py);
        if (moved > 1e-6 && d.vy > 0.01) {
          wipe(d.px, d.py, d.x, d.y, d.r * 1.05);
          const c = cell(d.x, d.y); wet[c] = Math.min(1.5, wet[c] + moved * 90);
          d.r = Math.sqrt(d.r * d.r + moved * d.r * 0.004);              /* swept-up droplets */
          d.shed -= moved;
          if (d.shed <= 0) {
            /* the thread breaks at irregular spacing, and each bead costs the runner water */
            d.shed = d.r * (1.2 - Math.log(1 - rnd() * 0.95) * 3.2);
            const sr = d.r * (0.18 + Math.pow(rnd(), 1.5) * 0.35), sp = Math.max(d.vy, 1e-3), ux = d.vx / sp, uy = d.vy / sp, ul = Math.hypot(ux, uy) || 1;
            d.r = Math.sqrt(Math.max(1e-8, d.r * d.r - sr * sr * 0.8));
            if (sr > 0.0028) add(d.x - ux / ul * d.r * 1.8, d.y - uy / ul * d.r * 1.8, sr);
            else dew(d.x + (rnd() - 0.5) * d.r * 0.3, d.y - d.r * (1.6 + rnd()), sr, 1.6 + rnd(), ux / ul, uy / ul);
          }
        }
        d.wob *= Math.exp(-dt * 4); d.wobPh += dt * (12 + 0.04 / Math.max(d.r, 0.002));
      }
      /* merges */
      const cs = 0.03, grid = new Map();
      drops.forEach((d, i) => { const k = Math.floor(d.x / cs) * 4096 + Math.floor(d.y / cs); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(i); });
      const dead = new Uint8Array(drops.length);
      for (let i = 0; i < drops.length; i++) {
        if (dead[i]) continue; const d = drops[i], cx = Math.floor(d.x / cs), cy = Math.floor(d.y / cs);
        for (let gx = cx - 1; gx <= cx + 1; gx++) for (let gy = cy - 1; gy <= cy + 1; gy++) {
          const a = grid.get(gx * 4096 + gy); if (!a) continue;
          for (const j of a) {
            if (j <= i || dead[j]) continue; const e = drops[j], dx = d.x - e.x, dy = d.y - e.y, rr = d.r + e.r;
            if (dx * dx + dy * dy < rr * rr * 0.6) {
              const A = d.r * d.r + e.r * e.r, big = Math.max(d.r, e.r), small = Math.min(d.r, e.r);
              d.x = (d.x * d.r * d.r + e.x * e.r * e.r) / A; d.y = (d.y * d.r * d.r + e.y * e.r * e.r) / A;
              d.vy = Math.max(d.vy, e.vy); d.vx = (d.vx + e.vx) * 0.5; d.r = Math.sqrt(A);
              d.wob = Math.min(0.45, d.wob + 0.7 * (small * small) / (big * big)); d.wobPh = 0; dead[j] = 1;
            }
          }
        }
      }
      drops = drops.filter((d, i) => !dead[i] && d.y - d.r < 1.02 && d.x > -0.05 && d.x < aspect + 0.05);
      drops.forEach((d, i) => {
        const o = i * 8, sp = Math.hypot(d.vx, d.vy);
        dropBuf[o] = d.x; dropBuf[o + 1] = d.y; dropBuf[o + 2] = d.r; dropBuf[o + 3] = d.seed;
        dropBuf[o + 4] = sp > 1e-4 ? d.vx / sp : 0; dropBuf[o + 5] = sp > 1e-4 ? d.vy / sp : 1;
        dropBuf[o + 6] = Math.min(1.4, sp / 0.25); dropBuf[o + 7] = d.wob * Math.sin(d.wobPh);
      });
    },
  };
  return api;
}

const LENS_STRUCT = /* wgsl */ `
struct Lens { aspect: f32, drops: f32, dews: f32, wipes: f32 };
struct Item { a: vec4f, b: vec4f };
@group(0) @binding(0) var<uniform> lens: Lens;
@group(0) @binding(1) var<storage, read> items: array<Item>;
fn clip(xy: vec2f) -> vec2f { return vec2f(xy.x / lens.aspect * 2.0 - 1.0, 1.0 - xy.y * 2.0); }
struct VO { @builtin(position) p: vec4f, @location(0) q: vec2f, @location(1) xy: vec2f, @location(2) @interpolate(flat) i: u32 };
/* a drop on glass: coverage whose 0.3 level is the visible edge at |p| = 1, and a parabolic dome for thickness */
fn dome(p: vec2f, r: f32) -> vec4f {
  let rr = length(p); if (rr >= 1.6) { discard; }
  let k = max(0.0, 1.0 - rr * rr * 0.331);
  return vec4f(k * k * k, r * max(0.0, 1.0 - rr * rr), 0.0, 1.0);
}
`;

/* the larger drops: summed, so neighbours neck into each other before they merge */
export const DROPS = LENS_STRUCT + /* wgsl */ `
@vertex fn vs_main(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO {
  var o: VO; let d = items[ii];
  let corner = vec2f(f32(vi & 1u), f32((vi >> 1u) & 1u)) * 2.0 - 1.0;
  let reach = d.a.z * (1.7 + d.b.z * 2.2);
  o.p = select(vec4f(0.0, 0.0, -2.0, 1.0), vec4f(clip(d.a.xy + corner * reach), 0.0, 1.0), f32(ii) < lens.drops);
  o.q = corner * reach / d.a.z; o.xy = vec2f(0.0); o.i = ii; return o;
}
@fragment fn fs_main(v: VO) -> @location(0) vec4f {
  let d = items[v.i]; let dir = d.b.xy; let stretch = d.b.z; let wob = d.b.w; let seed = d.a.w;
  var p = vec2f(dot(v.q, vec2f(dir.y, -dir.x)), dot(v.q, dir));
  p *= vec2f(1.0 + wob, 1.0 - wob);
  /* a teardrop: the head leads round, the tail tapers behind it, longer the faster it runs */
  let behind = max(-p.y, 0.0);
  if (p.y < 0.0) { p.y /= 1.0 + stretch * 1.8; }
  p.x /= mix(1.0, max(0.25, 1.0 - 0.6 * smoothstep(0.0, 2.4, behind)), min(stretch, 1.0));
  let ang = atan2(p.y, p.x);
  p *= 1.0 + 0.05 * sin(ang * 3.0 + seed) + 0.035 * sin(ang * 5.0 + seed * 1.7);
  return dome(p, d.a.z);
}
`;

/* micro droplets and trail dashes, written into the persistent layer with a max, so they stay separate beads */
export const DEW = LENS_STRUCT + /* wgsl */ `
@vertex fn vs_main(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO {
  var o: VO; let d = items[ii];
  let corner = vec2f(f32(vi & 1u), f32((vi >> 1u) & 1u)) * 2.0 - 1.0;
  let dir = d.b.xy; let side = vec2f(dir.y, -dir.x); let r = d.a.z; let s = d.a.w;
  let off = side * corner.x * r * 1.6 + dir * corner.y * r * 1.6 * s;
  o.p = select(vec4f(0.0, 0.0, -2.0, 1.0), vec4f(clip(d.a.xy + off), 0.0, 1.0), f32(ii) < lens.dews);
  o.q = corner * 1.6; o.xy = vec2f(0.0); o.i = ii; return o;
}
@fragment fn fs_main(v: VO) -> @location(0) vec4f {
  let d = items[v.i]; let seed = d.b.z;
  let ang = atan2(v.q.y, v.q.x);
  let p = v.q * (1.0 + 0.08 * sin(ang * 2.0 + seed) + 0.05 * sin(ang * 3.0 + seed * 2.3));
  return dome(p, d.a.z);
}
`;

/* a runner clears its path through the micro layer */
export const WIPE = LENS_STRUCT + /* wgsl */ `
@vertex fn vs_main(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO {
  var o: VO; let s = items[ii];
  let corner = vec2f(f32(vi & 1u), f32((vi >> 1u) & 1u));
  let lo = min(s.a.xy, s.a.zw) - vec2f(s.b.x); let hi = max(s.a.xy, s.a.zw) + vec2f(s.b.x);
  let xy = mix(lo, hi, corner);
  o.p = select(vec4f(0.0, 0.0, -2.0, 1.0), vec4f(clip(xy), 0.0, 1.0), f32(ii) < lens.wipes);
  o.q = vec2f(0.0); o.xy = xy; o.i = ii; return o;
}
@fragment fn fs_main(v: VO) -> @location(0) vec4f {
  let s = items[v.i]; let a = s.a.xy; let ab = s.a.zw - a;
  let h = clamp(dot(v.xy - a, ab) / max(dot(ab, ab), 1e-12), 0.0, 1.0);
  let dd = length(v.xy - a - ab * h) / s.b.x;
  if (dd >= 1.0) { discard; }
  return vec4f(0.0, 0.0, 0.0, 1.0 - smoothstep(0.7, 1.0, dd));
}
`;

/* the micro layer slowly dries: every frame it keeps a fraction of itself */
export const DRY = /* wgsl */ `
@group(0) @binding(0) var<uniform> dry: vec4f;
@fragment fn fs_main() -> @location(0) vec4f { return vec4f(0.0, 0.0, 0.0, dry.x); }
`;

/* ── the glass: the scene seen through the water ── */
export const LENS = /* wgsl */ `
@group(0) @binding(0) var scene: texture_2d<f32>;
@group(0) @binding(1) var drops: texture_2d<f32>;
@group(0) @binding(2) var dew: texture_2d<f32>;
@group(0) @binding(3) var smp: sampler;
@group(0) @binding(4) var<uniform> look: vec4f;   /* flash, aspect, canvas width, canvas height */
@group(0) @binding(5) var<uniform> lab: vec4f;    /* x > 0.5: show the water against a grid, for judging it */
fn backdrop(uv: vec2f) -> vec3f { if (lab.x < 0.5) { return textureSampleLevel(scene, smp, uv, 0.0).rgb; } let g = abs(fract(uv * vec2f(24.0, 17.0)) - 0.5); let line = 1.0 - smoothstep(0.44, 0.48, max(g.x, g.y)); return mix(vec3f(0.85, 0.5, 0.2), vec3f(0.12, 0.2, 0.4), uv.y) * (0.75 + 0.25 * line); }
fn water(uv: vec2f) -> vec2f { return textureSampleLevel(drops, smp, uv, 0.0).rg + textureSampleLevel(dew, smp, uv, 0.0).rg; }
@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let px = vec2f(1.0 / look.z, 1.0 / look.w);
  let F = water(uv);
  /* the slope of the water's thickness, in screen heights per screen height */
  let gx = (water(uv + vec2f(px.x, 0.0)).g - water(uv - vec2f(px.x, 0.0)).g) / (2.0 * px.x * look.y);
  let gy = (water(uv + vec2f(0.0, px.y)).g - water(uv - vec2f(0.0, px.y)).g) / (2.0 * px.y);
  let n = normalize(vec3f(-gx, -gy, 1.0));
  let T = 0.3; let w = max(fwidth(F.r), 1e-4);
  let inside = smoothstep(T - w, T + w, F.r);
  var col = backdrop(uv);
  /* a drop is a small lens: the view through it is turned over and shrunk, displaced by about its own size */
  let bend = n.xy * (F.g * 1.4 + 0.004);
  var through = backdrop(uv - bend * vec2f(1.0 / look.y, 1.0));
  /* the rim bends light away: a thin dark edge. Inside the lower edge the dome gathers light into a crescent */
  let slope = length(n.xy);
  through *= 1.0 - smoothstep(0.55, 0.9, slope) * 0.55;
  through += vec3f(0.85, 0.9, 1.0) * smoothstep(0.45, 0.75, slope) * smoothstep(0.2, 0.8, n.y) * 0.18;
  /* a small hard highlight from the sky, brighter in a flash */
  let hv = normalize(vec3f(-0.3, -0.7, 1.0) + vec3f(0.0, 0.0, 1.0));
  through += vec3f(1.0, 0.98, 0.95) * pow(max(dot(n, hv), 0.0), 60.0) * (0.55 + look.x * 2.5);
  col = mix(col, through * 1.04, inside);
  return vec4f(col, 1.0);
}
`;
