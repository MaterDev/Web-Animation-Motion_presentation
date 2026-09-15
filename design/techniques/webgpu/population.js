/* §4 · populations — the murmuration figure and the concourse. Both bin
   agents into a grid with atomics; the flock sorts by cell and queries
   neighbours by rank, the crowd relaxes a distance field and reads its
   gradient. Nothing about either population comes back except what is
   asked for on cue, and that asking is printed. */


/* ── MURMURATION ──────────────────────────────────────────────────────── */
const WG = 256;
const COMMON = `
struct U { n: u32, grid: u32, mode: u32, hilite: u32, cell: f32, dt: f32, time: f32, wind: f32, k: u32, pad0: u32, radius: f32, sepR: f32, align: f32, cohere: f32, separate: f32, speed: f32, maxForce: f32, predR: f32, predF: f32, predOn: f32, pred: vec2f, wander: vec2f, world: vec2f, pad1: vec2f };
fn cellOf(p: vec2f, u: U) -> vec2u { return vec2u(clamp(u32(p.x / u.cell), 0u, u.grid * 2u - 1u), clamp(u32(p.y / u.cell), 0u, u.grid - 1u)); }
fn cellIndex(c: vec2u, u: U) -> u32 { return c.y * (u.grid * 2u) + c.x; }`;
const CLEAR = COMMON + `
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read_write> cellInfo: array<atomic<u32>>;
@group(0) @binding(2) var<storage, read_write> stats: array<atomic<u32>>;
@compute @workgroup_size(${WG}) fn main(@builtin(global_invocation_id) id: vec3u) { let i = id.x; let cells = u.grid * u.grid * 2u; if (i < cells) { atomicStore(&cellInfo[i * 2u], 0u); } if (i < 1028u) { atomicStore(&stats[i], 0u); } }`;
const BIN = COMMON + `
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> pos: array<vec2f>;
@group(0) @binding(2) var<storage, read_write> cellInfo: array<atomic<u32>>;
@group(0) @binding(3) var<storage, read_write> slotCell: array<vec2u>;
@compute @workgroup_size(${WG}) fn main(@builtin(global_invocation_id) id: vec3u) { let i = id.x; if (i >= u.n) { return; } let c = cellIndex(cellOf(pos[i], u), u); slotCell[i] = vec2u(atomicAdd(&cellInfo[c * 2u], 1u), c); }`;
const SCAN = COMMON + `
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read_write> cellInfo: array<u32>;
var<workgroup> partial: array<u32, ${WG}>;
@compute @workgroup_size(${WG}) fn main(@builtin(local_invocation_id) lid: vec3u) {
  let cells = u.grid * u.grid * 2u; let per = (cells + ${WG}u - 1u) / ${WG}u; let t = lid.x; let a = t * per; let b = min(a + per, cells);
  var s = 0u; for (var i = a; i < b; i++) { s += cellInfo[i * 2u]; } partial[t] = s; workgroupBarrier();
  var off = 1u; for (var d = ${WG}u >> 1u; d > 0u; d = d >> 1u) { workgroupBarrier(); if (t < d) { let ai = off * (2u * t + 1u) - 1u; let bi = off * (2u * t + 2u) - 1u; partial[bi] += partial[ai]; } off = off << 1u; }
  if (t == 0u) { partial[${WG}u - 1u] = 0u; }
  for (var d = 1u; d < ${WG}u; d = d << 1u) { off = off >> 1u; workgroupBarrier(); if (t < d) { let ai = off * (2u * t + 1u) - 1u; let bi = off * (2u * t + 2u) - 1u; let tmp = partial[ai]; partial[ai] = partial[bi]; partial[bi] += tmp; } }
  workgroupBarrier(); var run = partial[t]; for (var i = a; i < b; i++) { cellInfo[i * 2u + 1u] = run; run += cellInfo[i * 2u]; }
}`;
const SCATTER = COMMON + `
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> pos: array<vec2f>;
@group(0) @binding(2) var<storage, read> vel: array<vec2f>;
@group(0) @binding(3) var<storage, read> ident: array<u32>;
@group(0) @binding(4) var<storage, read> slotCell: array<vec2u>;
@group(0) @binding(5) var<storage, read> cellInfo: array<u32>;
@group(0) @binding(6) var<storage, read_write> posS: array<vec2f>;
@group(0) @binding(7) var<storage, read_write> velS: array<vec2f>;
@group(0) @binding(8) var<storage, read_write> identS: array<u32>;
@compute @workgroup_size(${WG}) fn main(@builtin(global_invocation_id) id: vec3u) { let i = id.x; if (i >= u.n) { return; } let sc = slotCell[i]; let dst = cellInfo[sc.y * 2u + 1u] + sc.x; posS[dst] = pos[i]; velS[dst] = vel[i]; identS[dst] = ident[i]; }`;
const QUERY = COMMON + `
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> posS: array<vec2f>;
@group(0) @binding(2) var<storage, read> velS: array<vec2f>;
@group(0) @binding(3) var<storage, read> identS: array<u32>;
@group(0) @binding(4) var<storage, read> cellInfo: array<u32>;
@group(0) @binding(5) var<storage, read_write> pos: array<vec2f>;
@group(0) @binding(6) var<storage, read_write> vel: array<vec2f>;
@group(0) @binding(7) var<storage, read_write> ident: array<u32>;
@group(0) @binding(8) var<storage, read_write> stats: array<atomic<u32>>;
fn hash(n: u32) -> f32 { var x = n * 747796405u + 2891336453u; x = ((x >> ((x >> 28u) + 4u)) ^ x) * 277803737u; x = (x >> 22u) ^ x; return f32(x) / 4294967295.0; }
fn putInset(j: u32, q: vec2f) { atomicStore(&stats[1028u + j * 2u], bitcast<u32>(q.x)); atomicStore(&stats[1029u + j * 2u], bitcast<u32>(q.y)); }
@compute @workgroup_size(${WG}) fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x; if (i >= u.n) { return; }
  let p = posS[i]; let v = velS[i]; let me = identS[i]; let c = cellOf(p, u);
  var kd: array<f32, 8>; var kp: array<vec2f, 8>; var kv: array<vec2f, 8>; for (var j = 0u; j < 8u; j++) { kd[j] = 1e9; }
  var sumV = vec2f(0.0); var sumP = vec2f(0.0); var sep = vec2f(0.0); var nb = 0u; let r2 = u.radius * u.radius; let sr2 = u.sepR * u.sepR;
  for (var dy = -1; dy <= 1; dy++) { for (var dx = -1; dx <= 1; dx++) {
    let cx = i32(c.x) + dx; let cy = i32(c.y) + dy; if (cx < 0 || cy < 0 || cx >= i32(u.grid * 2u) || cy >= i32(u.grid)) { continue; }
    let ci = u32(cy) * (u.grid * 2u) + u32(cx); let s0 = cellInfo[ci * 2u + 1u]; let s1 = s0 + cellInfo[ci * 2u];
    for (var j = s0; j < s1; j++) { if (j == i) { continue; } let q = posS[j]; let d = q - p; let d2 = dot(d, d);
      if (d2 < sr2) { let dd = sqrt(d2); sep -= d / (dd + 1e-5) * (1.0 - dd / u.sepR); }
      if (u.mode == 0u) { if (d2 < r2) { sumV += velS[j]; sumP += q; nb++; } }
      else { if (d2 < kd[u.k - 1u]) { var m = u.k - 1u; while (m > 0u && kd[m - 1u] > d2) { kd[m] = kd[m - 1u]; kp[m] = kp[m - 1u]; kv[m] = kv[m - 1u]; m--; } kd[m] = d2; kp[m] = q; kv[m] = velS[j]; } }
    } } }
  if (u.mode == 1u) { for (var j = 0u; j < u.k; j++) { if (kd[j] < 1e8) { sumV += kv[j]; sumP += kp[j]; nb++; } } }
  var acc = vec2f(0.0);
  if (nb > 0u) { let fn_ = f32(nb); acc += (normalize(sumV / fn_ + 1e-6) * u.speed - v) * u.align + (sumP / fn_ - p) * u.cohere * 4.0; }
  let cp = u.world * 0.5 - p; acc += sep * u.separate * 0.18 + cp * 0.3 + vec2f(-cp.y, cp.x) * 0.16 + u.wander * u.wind * 0.3; /* the roost pulls, and turns: the flock circles rather than hitting walls */
  if (u.predOn > 0.5) { let d = p - u.pred; let dd = length(d); if (dd < u.predR) { acc += d / (dd + 1e-4) * u.predF * (1.0 - dd / u.predR); } }
  let m = 0.06; if (p.x < m) { acc.x += (m - p.x) * 40.0; } if (p.x > u.world.x - m) { acc.x -= (p.x - u.world.x + m) * 40.0; } if (p.y < m) { acc.y += (m - p.y) * 40.0; } if (p.y > u.world.y - m) { acc.y -= (p.y - u.world.y + m) * 40.0; }
  let al = length(acc); if (al > u.maxForce) { acc = acc / al * u.maxForce; }
  var nv = v + acc * u.dt; let sp = length(nv); let tgt = u.speed * (0.9 + 0.2 * hash(me)); nv = nv / (sp + 1e-6) * mix(sp, tgt, 0.08); if (sp > u.speed * 2.2) { nv = nv / sp * u.speed * 2.2; }
  var np = clamp(p + nv * u.dt, vec2f(0.001), u.world - vec2f(0.001));
  pos[i] = np; vel[i] = nv; ident[i] = me;
  atomicAdd(&stats[1024u], nb);
  let ox = clamp(u32(np.x / u.world.x * 32.0), 0u, 31u); let oy = clamp(u32(np.y / u.world.y * 32.0), 0u, 31u); atomicAdd(&stats[oy * 32u + ox], 1u);
  if (me == u.hilite) { putInset(0u, np); if (u.mode == 1u) { for (var j = 0u; j < 8u; j++) { putInset(1u + j, select(np, kp[j], j < u.k && kd[j] < 1e8)); } } else { var w = 0u;
    for (var dy = -1; dy <= 1 && w < 8u; dy++) { for (var dx = -1; dx <= 1 && w < 8u; dx++) { let cx = i32(c.x) + dx; let cy = i32(c.y) + dy; if (cx < 0 || cy < 0 || cx >= i32(u.grid * 2u) || cy >= i32(u.grid)) { continue; }
      let ci = u32(cy) * (u.grid * 2u) + u32(cx); let s0 = cellInfo[ci * 2u + 1u]; let s1 = s0 + cellInfo[ci * 2u]; for (var j = s0; j < s1 && w < 8u; j++) { if (j == i) { continue; } let d = posS[j] - p; if (dot(d, d) < r2) { putInset(1u + w, posS[j]); w++; } } } }
    for (var j = w; j < 8u; j++) { putInset(1u + j, np); } } }
}`;
const RSTRUCT = `struct R { world: vec2f, res: vec2f, time: f32, mode: f32, hilite: f32, predOn: f32, pred: vec2f, pad: vec2f, dusk0: vec4f, dusk1: vec4f, bird: vec4f, accent: vec4f, predc: vec4f };`;
const SKY = RSTRUCT + `
@group(0) @binding(0) var<uniform> r: R;
struct VO { @builtin(position) p: vec4f, @location(0) uv: vec2f };
@vertex fn vs(@builtin(vertex_index) i: u32) -> VO { var o: VO; let x = f32((i << 1u) & 2u); let y = f32(i & 2u); o.uv = vec2f(x, y); o.p = vec4f(x * 2.0 - 1.0, y * 2.0 - 1.0, 0.0, 1.0); return o; }
@fragment fn fs(o: VO) -> @location(0) vec4f { let t = pow(o.uv.y, 1.35); var c = mix(r.dusk0.rgb, r.dusk1.rgb, t); let px = vec2u(u32(o.p.x) % 4u, u32(o.p.y) % 4u);
  let bayer = array<f32, 16>(0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.); let d = (bayer[px.y * 4u + px.x] + 0.5) / 16.0 - 0.5; c = floor(c * 48.0 + d) / 48.0; return vec4f(c, 1.0); }`;
const BIRDS = RSTRUCT + `
@group(0) @binding(0) var<uniform> r: R;
@group(0) @binding(1) var<storage, read> pos: array<vec2f>;
@group(0) @binding(2) var<storage, read> vel: array<vec2f>;
@group(0) @binding(3) var<storage, read> ident: array<u32>;
struct VO { @builtin(position) p: vec4f, @location(0) c: vec4f };
fn hash(n: u32) -> f32 { var x = n * 747796405u + 2891336453u; x = ((x >> ((x >> 28u) + 4u)) ^ x) * 277803737u; x = (x >> 22u) ^ x; return f32(x) / 4294967295.0; }
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO {
  let p = pos[ii]; let v = vel[ii]; let id = ident[ii]; let dir = normalize(v + vec2f(1e-5, 0.0)); let side = vec2f(-dir.y, dir.x);
  let flap = 0.55 + 0.45 * sin(r.time / 0.9 * 6.2831853 + hash(id) * 6.2831853); let s = 0.0019 * r.world.y; var q = p;
  if (vi == 0u) { q = p + dir * s * 1.6; } else if (vi == 1u) { q = p - dir * s * 0.8 + side * s * 1.4 * flap; } else { q = p - dir * s * 0.8 - side * s * 1.4 * flap; }
  var o: VO; o.p = vec4f(q.x / r.world.x * 2.0 - 1.0, q.y / r.world.y * 2.0 - 1.0, 0.0, 1.0); let hi = select(0.0, 1.0, id == u32(r.hilite)); o.c = vec4f(mix(r.bird, r.accent, hi).rgb, mix(0.32, 1.0, hi)); return o; }
@fragment fn fs(o: VO) -> @location(0) vec4f { return o.c; }`;
const INSET = RSTRUCT + `
@group(0) @binding(0) var<uniform> r: R;
@group(0) @binding(1) var<storage, read> stats: array<u32>;
struct VO { @builtin(position) p: vec4f, @location(0) c: vec4f };
fn insetAt(j: u32) -> vec2f { return vec2f(bitcast<f32>(stats[1028u + j * 2u]), bitcast<f32>(stats[1029u + j * 2u])); }
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO { let q = select(insetAt(0u), insetAt(1u + ii), vi == 1u); var o: VO; o.p = vec4f(q.x / r.world.x * 2.0 - 1.0, q.y / r.world.y * 2.0 - 1.0, 0.0, 1.0); o.c = r.accent; return o; }
@fragment fn fs(o: VO) -> @location(0) vec4f { return vec4f(o.c.rgb, 0.85); }`;
const PRED = RSTRUCT + `
@group(0) @binding(0) var<uniform> r: R;
struct VO { @builtin(position) p: vec4f, @location(0) c: vec4f };
@vertex fn vs(@builtin(vertex_index) vi: u32) -> VO { let s = 0.014 * r.world.y; let a = f32(vi) * 2.0943951 + r.time * 2.0; let q = r.pred + vec2f(cos(a), sin(a)) * s; var o: VO; o.p = vec4f(q.x / r.world.x * 2.0 - 1.0, q.y / r.world.y * 2.0 - 1.0, 0.0, 1.0); o.c = vec4f(r.predc.rgb, r.predOn); return o; }
@fragment fn fs(o: VO) -> @location(0) vec4f { if (o.c.a < 0.5) { discard; } return vec4f(o.c.rgb, 1.0); }`;

export { WG, COMMON, CLEAR, BIN, SCAN, SCATTER, QUERY, RSTRUCT, SKY, BIRDS, PRED };
