/* §2 · WALLET — a phone wallet holding eight payment cards from eight invented
   issuers. Direction: conductor/tracks/004-webgpu-sl-14/wallet-concepts-v2.md
   (norman-art-director). The printed block — chip, contactless, number, name,
   expiry, the SPECIE scheme mark — is identical on every card and never moves;
   the mark is drawn once, crisp, in the final pass, over the scene; each card
   runs one process in the region above the block. In the stack a card is a
   still; its process starts the moment it opens.
     ORRERY       private bank      brass rings under one sweeping key light
     ROSETTE      haematology       blood cells drifting in depth, never assembling
     VESPER LINE  sleeper rail      a night ridge; the train is only the light it leaves
     SYRINGA      pharmacy          a quatrefoil pumping violet dye at 60 bpm
     HALATION     games · streaming 30k additive points settling into volumes
     VITRINE      fragrance         a glass stopper tumbling, its caustic on the stock
     BUSBAR       energy · grid     a transmission graph; charge hops one link a tick
     MULLION      museum            a louvred wall turning in a travelling wave
   Every company, person, mark and scheme is invented; the marks are drawn in code. */
import { $, DPR, TAU, device, format, storage, uniform, compute, render, bind, attach, card, pointer, hash2, FSQ_VS } from './common.js';

/* stock and ink are display values; the mark box is (x, y, w, h) in face fractions, square in pixels at 1.586 */
const MB = [0.64 - 0.075, 0.34 - 0.119, 0.15, 0.238];
const CARDS = [
  { id: 'orrery', stock: [0.16, 0.16, 0.18], ink: [0.92, 0.88, 0.80], issuer: 'Orrery · private bank', mark: 'rings', scale: 1.7 },
  { id: 'rosette', stock: [0.95, 0.94, 0.92], ink: [0.20, 0.20, 0.24], issuer: 'Rosette Diagnostics · haematology', mark: 'rosette' },
  { id: 'vesper', stock: [0.12, 0.13, 0.24], ink: [0.94, 0.90, 0.84], issuer: 'Vesper Line · sleeper rail loyalty', mark: 'horizon' },
  { id: 'syringa', stock: [0.985, 0.985, 0.98], ink: [0.18, 0.16, 0.22], issuer: 'Syringa · pharmacy', mark: 'quatrefoil' },
  { id: 'halation', stock: [0.10, 0.10, 0.13], ink: [0.99, 0.99, 0.99], issuer: 'Halation · games and streaming', mark: 'comet' },
  { id: 'vitrine', stock: [0.90, 0.89, 0.86], ink: [0.16, 0.16, 0.15], issuer: 'Vitrine · fragrance house', mark: 'vitrine' },
  { id: 'busbar', stock: [0.12, 0.17, 0.19], ink: [0.80, 0.90, 0.94], issuer: 'Busbar · energy and grid services', mark: 'busbar' },
  { id: 'mullion', stock: [0.70, 0.68, 0.64], ink: [0.18, 0.18, 0.20], issuer: 'Mullion · museum and arts membership', mark: 'mullion' },
];

/* ── the marks, drawn from predicates on a normalised box ─────────────── */
const MW = 512;
function drawMark(kind) { const c = document.createElement('canvas'); c.width = MW; c.height = MW; const x = c.getContext('2d', { willReadFrequently: true }); x.translate(MW / 2, MW / 2); const S = MW * 0.40, sw = MW * 0.03; x.fillStyle = '#fff'; x.strokeStyle = '#fff'; x.lineWidth = sw; x.lineCap = 'round';
  const circ = (cx, cy, r, fill) => { x.beginPath(); x.arc(cx * S, cy * S, r * S, 0, TAU); if (fill) x.fill(); else x.stroke(); };
  if (kind === 'rings') { circ(0, 0, 1.0); circ(0, 0, 0.62); circ(0, 0, 0.24); circ(0.62 * Math.cos(-0.698), 0.62 * Math.sin(-0.698), 0.14, true); }
  if (kind === 'rosette') { for (let k = 0; k < 6; k++) circ(0.62 * Math.cos(k * TAU / 6), 0.62 * Math.sin(k * TAU / 6), 0.22, true); circ(0, 0, 0.26, true); }
  if (kind === 'quatrefoil') { [[0, 0], [0.34, 0], [-0.34, 0], [0, 0.34], [0, -0.34]].forEach(([a, b]) => circ(a, b, 0.30, true)); x.lineWidth = S * 0.12; [[0.34, 0], [-0.34, 0], [0, 0.34], [0, -0.34]].forEach(([a, b]) => { x.beginPath(); x.moveTo(0, 0); x.lineTo(a * S, b * S); x.stroke(); }); }
  if (kind === 'horizon') { x.fillRect(-1.0 * S, -0.05 * S, 2.0 * S, 0.10 * S); circ(-0.4, 0, 0.26, true); }
  if (kind === 'vitrine') { x.strokeRect(-0.36 * S, -0.5 * S, 0.72 * S, 1.0 * S); x.beginPath(); x.moveTo(-0.36 * S, 0.5 * S); x.lineTo(0.36 * S, -0.5 * S); x.stroke(); }
  if (kind === 'mullion') { x.strokeRect(-0.5 * S, -0.5 * S, S, S); [-0.25, 0, 0.25].forEach((u) => { x.beginPath(); x.moveTo(u * S, -0.5 * S); x.lineTo(u * S, 0.5 * S); x.stroke(); }); }
  if (kind === 'comet') { circ(0.44, 0, 0.28, true); x.beginPath(); x.moveTo(0.44 * S, -0.28 * S); x.quadraticCurveTo(-0.3 * S, -0.10 * S, -1.0 * S, -0.05 * S); x.lineTo(-1.0 * S, 0.05 * S); x.quadraticCurveTo(-0.3 * S, 0.10 * S, 0.44 * S, 0.28 * S); x.closePath(); x.fill(); }
  if (kind === 'busbar') { x.fillRect(-1.0 * S, -0.15 * S, 0.30 * S, 0.30 * S); x.fillRect(0.40 * S, -0.15 * S, 0.30 * S, 0.30 * S); x.fillRect(-0.7 * S, -0.05 * S, 1.1 * S, 0.10 * S); }
  return c; }
function edt1d(f, n, d, v, z) { let k = 0; v[0] = 0; z[0] = -1e20; z[1] = 1e20;
  for (let q = 1; q < n; q++) { let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); } k++; v[k] = q; z[k] = s; z[k + 1] = 1e20; }
  k = 0; for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; } }
function edt2d(g, w, h) { const m = Math.max(w, h), f = new Float32Array(m), d = new Float32Array(m), v = new Int32Array(m), z = new Float32Array(m + 1);
  for (let x = 0; x < w; x++) { for (let y = 0; y < h; y++) f[y] = g[y * w + x]; edt1d(f, h, d, v, z); for (let y = 0; y < h; y++) g[y * w + x] = d[y]; }
  for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) f[x] = g[y * w + x]; edt1d(f, w, d, v, z); for (let x = 0; x < w; x++) g[y * w + x] = d[x]; } }
function signedDistance(c, w, h) { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, sx = c.width / w, sy = c.height / h; const inside = new Float32Array(w * h), outside = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const a = d[((Math.floor(y * sy)) * c.width + Math.floor(x * sx)) * 4 + 3] > 127; inside[y * w + x] = a ? 1e20 : 0; outside[y * w + x] = a ? 0 : 1e20; }
  edt2d(inside, w, h); edt2d(outside, w, h); const s = new Float32Array(w * h); for (let i = 0; i < w * h; i++) s[i] = (Math.sqrt(outside[i]) - Math.sqrt(inside[i])) * sx; return s; }
function toHalf(v) { const f = new Float32Array(1), u = new Uint32Array(f.buffer); f[0] = v; const x = u[0], sign = (x >> 16) & 0x8000; let e = ((x >> 23) & 0xff) - 112, m = x & 0x7fffff; if (e <= 0) return sign; if (e >= 31) return sign | 0x7c00; return sign | (e << 10) | (m >> 13); }
function markTextures(dev, c) {
  const tex = dev.createTexture({ size: [c.width, c.height], format: 'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT });
  const sw = c.width / 2, sh = c.height / 2, sd = signedDistance(c, sw, sh), half = new Uint16Array(sw * sh); for (let i = 0; i < sw * sh; i++) half[i] = toHalf(sd[i]);
  const sdf = dev.createTexture({ size: [sw, sh], format: 'r16float', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
  dev.queue.writeTexture({ texture: sdf }, half, { bytesPerRow: sw * 2 }, [sw, sh]);
  return { tex, sdf, upload: async () => { const bmp = await createImageBitmap(c); dev.queue.copyExternalImageToTexture({ source: bmp }, { texture: tex }, [c.width, c.height]); bmp.close(); } }; }
function pipe3d(code, opts = {}) { const m = device.createShaderModule({ code }); const blend = opts.blend === 'add' ? { color: { srcFactor: 'src-alpha', dstFactor: 'one' }, alpha: { srcFactor: 'one', dstFactor: 'one' } } : opts.blend ? { color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' } } : undefined;
  const depth = opts.depth === 'nowrite' ? { format: 'depth24plus', depthWriteEnabled: false, depthCompare: 'always' } : opts.depth ? { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' } : undefined;
  return device.createRenderPipeline({ layout: 'auto', vertex: { module: m, entryPoint: 'vs' }, fragment: { module: m, entryPoint: 'fs', targets: [{ format, blend }] }, primitive: { topology: opts.topology || 'triangle-strip' }, depthStencil: depth }); }

/* ── the face prelude: stock, grain, one sheen for all eight ───────────── */
const PRE = FSQ_VS + `
struct R { res: vec2f, time: f32, phase: f32, tilt: vec2f, open: f32, ptrOn: f32, stock: vec4f, box: vec4f, ptr: vec2f, a: f32, b: f32, ink: vec4f };
@group(0) @binding(0) var<uniform> r: R;
@group(0) @binding(1) var tex: texture_2d<f32>;
@group(0) @binding(2) var smp: sampler;
@group(0) @binding(3) var sdfT: texture_2d<f32>;
fn hash(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }
fn vn(p: vec2f) -> f32 { let i = floor(p); var f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2f(1, 0)), f.x), mix(hash(i + vec2f(0, 1)), hash(i + vec2f(1, 1)), f.x), f.y); }
fn fbm(p0: vec2f) -> f32 { var p = p0; var a = 0.5; var s = 0.0; for (var i = 0; i < 4; i++) { s += a * vn(p); a *= 0.5; p = p * 2.1 + 1.7; } return s; }
fn mark(uv: vec2f) -> vec4f { if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) { return vec4f(0.0); } return textureSampleLevel(tex, smp, uv, 0.0); }
fn sdf(uv: vec2f) -> f32 { let c = clamp(uv, vec2f(0.0), vec2f(1.0)); return textureSampleLevel(sdfT, smp, c, 0.0).r + length((uv - c) * ${MW}.0); }
fn spectrum(t: f32) -> vec3f { return 0.5 + 0.5 * cos(6.2831853 * (t + vec3f(0.0, 0.33, 0.67))); }
fn bayer(p: vec2f) -> f32 { let x = u32(p.x) % 8u; let y = u32(p.y) % 8u; var v = 0u; let xx = x ^ y; for (var i = 0u; i < 3u; i++) { v |= ((y >> i) & 1u) << (2u * (2u - i) + 1u); v |= ((xx >> i) & 1u) << (2u * (2u - i)); } return (f32(v) + 0.5) / 64.0; }
fn face(uv: vec2f) -> vec3f { let asp = r.res.x / r.res.y; let p = (uv - 0.5) * vec2f(asp, 1.0);
  var col = r.stock.rgb * (0.985 + 0.03 * hash(floor(uv * r.res * 0.5))) + vec3f(1e-6) * (mark(vec2f(-1.0)).a + sdf(vec2f(0.5)));
  let edge = smoothstep(0.0, 0.03, min(min(uv.x, 1.0 - uv.x) * asp, min(uv.y, 1.0 - uv.y))); col *= 0.95 + 0.05 * edge;
  let ang = (p.x * 0.7 + p.y * 0.4) + r.tilt.x * 0.9 + r.tilt.y * 0.5; let band = exp(-pow((ang - 0.15) * 2.4, 2.0)); let lum = dot(r.stock.rgb, vec3f(0.33));
  col += spectrum(ang * 1.4) * band * 0.06 * r.open + vec3f(select(0.04, 0.08, lum > 0.5) * band * r.open); return col; }
fn boxUV(uv: vec2f) -> vec2f { return (uv - r.box.xy) / r.box.zw; }
fn tonemap(c: vec3f) -> vec3f { return pow(max(c / (1.0 + c * 0.4) * 1.2, vec3f(0.0)), vec3f(1.0 / 1.9)); }
`;
const END = `  return vec4f(col, 1.0); }`;
/* the mark, crisp, in the final pass, over everything */
const MARK = PRE + `@fragment fn fs(o: VO) -> @location(0) vec4f { let bu = boxUV(o.uv); let d = sdf(bu) + 1e-6 * mark(vec2f(0.5)).a; let a = 1.0 - smoothstep(-1.5, 1.5, d); return vec4f(r.ink.rgb, a * r.ink.a); }`;

/* ── ORRERY · a turned brass boss under one light ────────────────────── */
const ORRERY = PRE + `
/* the rings extruded a little from a dark floor, edges rounded, seen from straight above so the printed mark stays in register */
fn body(p: vec3f) -> f32 { let bu = vec2f(p.x, p.z) ; let d2 = sdf(bu) / ${MW}.0; let w = vec2f(d2, abs(p.y - 0.02) - 0.02); return min(max(w.x, w.y), 0.0) + length(max(w, vec2f(0.0))) - 0.012; }
fn map(p: vec3f) -> f32 { return min(body(p), p.y); }
fn nrm(p: vec3f) -> vec3f { let e = vec2f(0.0008, 0.0); return normalize(vec3f(map(p + e.xyy) - map(p - e.xyy), map(p + e.yxy) - map(p - e.yxy), map(p + e.yyx) - map(p - e.yyx))); }
fn shadow(ro: vec3f, rd: vec3f) -> f32 { var s = 1.0; var t = 0.004; for (var i = 0; i < 28; i++) { let h = body(ro + rd * t); s = min(s, 14.0 * h / t); if (s < 0.01) { return 0.0; } t += clamp(h, 0.002, 0.03); if (t > 0.6) { break; } } return clamp(s, 0.0, 1.0); }
fn ao(p: vec3f, n: vec3f) -> f32 { var occ = 0.0; var sca = 1.0; for (var i = 0; i < 5; i++) { let h = 0.004 + 0.02 * f32(i); occ += (h - map(p + n * h)) * sca; sca *= 0.75; } return clamp(1.0 - 4.0 * occ, 0.0, 1.0); }
@fragment fn fs(o: VO) -> @location(0) vec4f { let uv = o.uv; var col = face(uv); let bu = boxUV(uv); let asp = r.res.x / r.res.y;
  /* the scene lives in a disc around the mark; straight-down camera, slight lean with the tilt */
  let sc = vec2f(0.64, 0.34); let region = smoothstep(0.34, 0.20, length((uv - sc) * vec2f(asp, 1.0)));
  let ro = vec3f(bu.x, 0.6, bu.y); let rd = normalize(vec3f(r.tilt.x * 0.08, -1.0, r.tilt.y * 0.08));
  var t = 0.0; var hit = -1.0; for (var i = 0; i < 64; i++) { let h = map(ro + rd * t); if (h < 0.0004) { hit = t; break; } t += h * 0.9; if (t > 1.2) { break; } }
  let az = r.phase; let key = normalize(vec3f(cos(az) * 0.85, 0.55, sin(az) * 0.85));
  if (hit > 0.0) { let p = ro + rd * hit; let n = nrm(p); let isBody = body(p) < 0.001; let sh = shadow(p + n * 0.003, key); let occ = ao(p, n); let nd = max(dot(n, key), 0.0); let hv = normalize(key - rd);
    let spec = pow(max(dot(n, hv), 0.0), 70.0); let fr = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
    var c: vec3f; if (isBody) { c = vec3f(0.78, 0.58, 0.28) * (vec3f(1.0, 0.95, 0.85) * nd * sh * 1.6 + vec3f(0.10, 0.09, 0.08) * (0.5 + 0.5 * n.y)) * occ + vec3f(1.0, 0.92, 0.75) * spec * sh * 1.3 + vec3f(0.22, 0.16, 0.08) * fr; }
    else { c = r.stock.rgb * 0.9 * (0.55 + 0.45 * nd * sh) * occ; }
    col = mix(col, tonemap(c), region); }
` + END;

/* ── ROSETTE · blood cells in depth ──────────────────────────────────── */
const RM = 260;
const RO_K = `
struct U { n: u32, pad0: u32, pad1: u32, pad2: u32, dt: f32, time: f32, aspect: f32, pad3: f32 };
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read_write> pos: array<vec4f>;  /* xyz, kind */
@group(0) @binding(2) var<storage, read_write> vel: array<vec4f>;
fn hash(n: u32) -> f32 { var x = n * 747796405u + 2891336453u; x = ((x >> ((x >> 28u) + 4u)) ^ x) * 277803737u; x = (x >> 22u) ^ x; return f32(x) / 4294967295.0; }
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) id: vec3u) { let i = id.x; if (i >= u.n) { return; } var p = pos[i]; var v = vel[i];
  /* brownian drift and a slow uniform sink; a body that leaves the bottom re-enters at the top */
  let j = vec3f(sin(u.time * 0.7 + f32(i) * 1.3), cos(u.time * 0.5 + f32(i) * 0.7), sin(u.time * 0.4 + f32(i) * 2.1)) * 0.02;
  v = vec4f(v.xyz * 0.96 + j * u.dt + vec3f(0.0, 0.03, 0.0) * u.dt, v.w + u.dt * 0.6);
  p = vec4f(p.xyz + v.xyz * u.dt, p.w); if (p.y > 0.60) { p = vec4f(0.36 + hash(i + u32(u.time * 10.0)) * 0.62, -0.06, (hash(i + 7u + u32(u.time * 10.0)) - 0.5) * 0.5, p.w); }
  /* the printed mark keeps a clear radius */ let dm = (p.xy - vec2f(0.64, 0.34)) * vec2f(u.aspect, 1.0); let dl = length(dm); if (dl < 0.16) { p = vec4f(p.xy + dm / (dl + 1e-4) * (0.16 - dl) * 0.5, p.z, p.w); }
  pos[i] = p; vel[i] = v; }`;
const RO_D = `
struct R { res: vec2f, time: f32, pad: f32, light: vec4f, para: vec4f };
@group(0) @binding(0) var<uniform> r: R;
@group(0) @binding(1) var<storage, read> pos: array<vec4f>;
struct VO { @builtin(position) p: vec4f, @location(0) c: vec4f, @location(1) q: vec2f, @location(2) misc: vec4f };
struct FO { @location(0) c: vec4f, @builtin(frag_depth) d: f32 };
fn hash(n: u32) -> f32 { var x = n * 747796405u + 2891336453u; x = ((x >> ((x >> 28u) + 4u)) ^ x) * 277803737u; x = (x >> 22u) ^ x; return f32(x) / 4294967295.0; }
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO { let corner = vec2f(f32(vi & 1u), f32((vi >> 1u) & 1u)) * 2.0 - 1.0; let P = pos[ii]; let kind = P.w; let asp = r.res.x / r.res.y;
  /* the drag parallaxes the depth: near bodies move four times the far ones */
  let par = r.para.xy * (0.5 - P.z) * 0.12;
  let world = vec3f((P.x - 0.5) * asp + par.x, 0.5 - P.y - par.y, P.z); let zc = 1.5 + world.z; let f = 1.5 / zc;
  let base = select(select(0.024, 0.044, kind > 1.5), 0.009, kind < 0.5); let rad = base * f * (0.85 + 0.3 * hash(ii));
  var o: VO; o.p = vec4f(world.x * f / asp * 2.0 + corner.x * rad * 2.0 / asp, world.y * f * 2.0 + corner.y * rad * 2.0, 0.0, 1.0); o.q = corner;
  let blur = clamp((world.z + 0.1) * 1.4, 0.0, 0.8); /* far bodies defocus */
  let ery = vec3f(0.60, 0.12, 0.13); let leu = vec3f(0.94, 0.84, 0.60); let pla = vec3f(0.42, 0.08, 0.10); let c = select(select(ery, leu, kind > 1.5), pla, kind < 0.5);
  o.c = vec4f(c, 1.0); o.misc = vec4f(rad, zc, blur, kind); return o; }
@fragment fn fs(o: VO) -> FO { let d2 = dot(o.q, o.q); if (d2 > 1.0) { discard; } let nz = sqrt(1.0 - d2); var n = vec3f(o.q.x, o.q.y, nz); if (o.misc.w > 0.5 && o.misc.w < 1.5) { n = normalize(vec3f(o.q.x, o.q.y, nz * 0.55 + 0.25 * d2)); } /* an erythrocyte is a dimpled disc */
  let L = normalize(r.light.xyz); let nd = 0.35 + 0.65 * max(dot(n, L), 0.0); let spec = pow(max(dot(n, normalize(L + vec3f(0.0, 0.0, 1.0))), 0.0), 40.0); let rim = pow(1.0 - nz, 2.5);
  var c = o.c.rgb * nd + vec3f(spec) * 0.35 + o.c.rgb * rim * 0.5; let edge = smoothstep(1.0, 1.0 - 0.15 - o.misc.z * 0.6, d2);
  var out: FO; out.c = vec4f(mix(vec3f(0.95, 0.94, 0.92), c, 1.0 - o.misc.z * 0.45), edge * (1.0 - o.misc.z * 0.35)); out.d = clamp((o.misc.y - nz * o.misc.x) / 4.0, 0.0, 1.0); return out; }`;
const RO_BG = PRE + `@fragment fn fs(o: VO) -> @location(0) vec4f { let uv = o.uv; var col = face(uv);` + END;

/* ── VESPER LINE · a night ridge, the train as the light it leaves ───── */
const TRW = 256, TRH = 96;
const VL_STEP = `
struct U { w: u32, h: u32, nA: u32, pad: u32, decay: f32, time: f32, scroll: f32, pad2: f32, agents: array<vec4f, 2> };
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> src: array<f32>;
@group(0) @binding(2) var<storage, read_write> dst: array<f32>;
@compute @workgroup_size(16, 16) fn main(@builtin(global_invocation_id) id: vec3u) { let x = id.x; let y = id.y; if (x >= u.w || y >= u.h) { return; } let i = y * u.w + x; var v = src[i] * u.decay; let p = vec2f(f32(x) + 0.5, f32(y) + 0.5);
  for (var k = 0u; k < u.nA; k++) { let a = u.agents[k]; var d = p - a.xy; d.x = d.x - f32(u.w) * round(d.x / f32(u.w)); v += exp(-dot(d, d) / 4.0) * a.z; } dst[i] = min(v, 5.0); }`;
const VL_DRAW = PRE + `
@group(0) @binding(4) var<storage, read> trail: array<f32>;
fn trailAt(uv0: vec2f) -> f32 { let uv = vec2f(fract(uv0.x), uv0.y); if (uv.y < 0.0 || uv.y > 1.0) { return 0.0; } let p = uv * vec2f(${TRW}.0, ${TRH}.0) - 0.5; let f = floor(p); let t = p - f; let x0 = (i32(f.x) + ${TRW}) % ${TRW}; let x1 = (x0 + 1) % ${TRW}; let y0 = i32(clamp(f.y, 0.0, ${TRH - 1}.0)); let y1 = min(y0 + 1, ${TRH - 1});
  return mix(mix(trail[u32(y0 * ${TRW} + x0)], trail[u32(y0 * ${TRW} + x1)], t.x), mix(trail[u32(y1 * ${TRW} + x0)], trail[u32(y1 * ${TRW} + x1)], t.x), t.y); }
/* the ridge: periodic in x at the traverse distance, a valley floor at z ≈ 0.55 where the line runs */
fn hgt(xz: vec2f) -> f32 { let x = xz.x; let ridge = 0.16 + 0.10 * sin(x * 6.2831853 * 2.0) + 0.05 * sin(x * 6.2831853 * 5.0 + 1.3) + 0.03 * sin(x * 6.2831853 * 11.0 + 0.4); let across = smoothstep(0.40, 0.95, xz.y); return ridge * across + 0.02 * (fbm(xz * vec2f(9.0, 4.0)) - 0.5) * across; }
fn nrm(xz: vec2f) -> vec3f { let e = 0.003; return normalize(vec3f(hgt(xz - vec2f(e, 0.0)) - hgt(xz + vec2f(e, 0.0)), 2.0 * e, hgt(xz - vec2f(0.0, e)) - hgt(xz + vec2f(0.0, e)))); }
@fragment fn fs(o: VO) -> @location(0) vec4f { let uv = o.uv; let asp = r.res.x / r.res.y; var col = face(uv);
  /* the scene is the upper band; the sky is a dusk ramp indigo → amber that collapses after the body drops */
  let band = 1.0 - smoothstep(0.58, 0.64, uv.y); let ndc = vec2f(uv.x * 2.0 - 1.0, (0.31 - uv.y) * 3.2);
  let ro = vec3f(r.phase, 0.20, 0.05); let tgt = vec3f(r.phase + 0.35, 0.10, 0.75); let F = normalize(tgt - ro); let Rt = normalize(cross(F, vec3f(0.0, 1.0, 0.0))); let U = cross(Rt, F); let rd = normalize(F + Rt * ndc.x * 0.55 * asp + U * ndc.y * 0.55);
  let warm = r.a; var sky = mix(vec3f(0.10, 0.10, 0.22), vec3f(0.06, 0.05, 0.12), smoothstep(-0.05, 0.4, rd.y)); sky += vec3f(0.95, 0.55, 0.18) * exp(-max(rd.y + 0.02, 0.0) * 14.0) * 0.55 * warm;
  sky = floor((sky + (bayer(uv * r.res) - 0.5) / 28.0) * 28.0) / 28.0; var scene = sky;
  var t = 0.05; var hit = -1.0; for (var i = 0; i < 56; i++) { let p = ro + rd * t; if (p.y < hgt(p.xz)) { hit = t; break; } t += max(0.004, (p.y - hgt(p.xz)) * 0.7); if (t > 2.5) { break; } }
  if (hit > 0.0) { var a = hit - 0.012; var b = hit; for (var j = 0; j < 4; j++) { let m = 0.5 * (a + b); let q = ro + rd * m; if (q.y < hgt(q.xz)) { b = m; } else { a = m; } } let p = ro + rd * b; let n = nrm(p.xz);
    let nd = max(dot(n, normalize(vec3f(-0.3, 0.6, -0.5))), 0.0); var g = vec3f(0.06, 0.06, 0.12) + vec3f(0.14, 0.13, 0.22) * nd;
    let tr = trailAt(vec2f(p.x, p.z / 0.8)); let amber = mix(vec3f(0.6, 0.22, 0.02), vec3f(1.0, 0.62, 0.12), clamp(tr, 0.0, 1.0)); g += amber * clamp(tr, 0.0, 1.0) * 1.6 + vec3f(1.0, 0.85, 0.6) * smoothstep(1.0, 3.0, tr);
    let fog = 1.0 - exp(-b * 0.9); scene = mix(g, sky, fog * 0.7); }
  col = mix(col, scene, band);
` + END;

/* ── SYRINGA · a quatrefoil pumps dye ────────────────────────────────── */
const CW = 224, CH = 141, C_ITERS = 20;
const SY_COMMON = `
struct U { w: u32, h: u32, pad0: u32, pad1: u32, dt: f32, sys: f32, time: f32, ptrOn: f32, ptr: vec2f, force: vec2f, box: vec4f };
@group(0) @binding(0) var<uniform> u: U;
fn idx(x: i32, y: i32) -> u32 { return u32(clamp(y, 0, i32(u.h) - 1)) * u.w + u32(clamp(x, 0, i32(u.w) - 1)); }`;
const SY_ADVECT = SY_COMMON + `
@group(0) @binding(1) var<storage, read> vel: array<vec2f>;
@group(0) @binding(2) var<storage, read_write> velOut: array<vec2f>;
@group(0) @binding(3) var<storage, read> dye: array<vec4f>;
@group(0) @binding(6) var<storage, read_write> dyeOut: array<vec4f>;
@group(0) @binding(4) var sdfT: texture_2d<f32>;
@group(0) @binding(5) var smp: sampler;
fn markD(p: vec2f) -> f32 { let uv = vec2f(p.x / f32(u.w), p.y / f32(u.h)); let bu = (uv - u.box.xy) / u.box.zw; if (bu.x < 0.0 || bu.x > 1.0 || bu.y < 0.0 || bu.y > 1.0) { return 999.0; } return textureSampleLevel(sdfT, smp, bu, 0.0).r; }
fn sV(p: vec2f) -> vec2f { let x = i32(floor(p.x)); let y = i32(floor(p.y)); let f = fract(p); return mix(mix(vel[idx(x, y)], vel[idx(x + 1, y)], f.x), mix(vel[idx(x, y + 1)], vel[idx(x + 1, y + 1)], f.x), f.y); }
fn sD(p: vec2f) -> vec4f { let x = i32(floor(p.x)); let y = i32(floor(p.y)); let f = fract(p); return mix(mix(dye[idx(x, y)], dye[idx(x + 1, y)], f.x), mix(dye[idx(x, y + 1)], dye[idx(x + 1, y + 1)], f.x), f.y); }
fn curlW(x: i32, y: i32) -> f32 { return (vel[idx(x + 1, y)].y - vel[idx(x - 1, y)].y) - (vel[idx(x, y + 1)].x - vel[idx(x, y - 1)].x); }
@compute @workgroup_size(16, 16) fn main(@builtin(global_invocation_id) id: vec3u) { let x = i32(id.x); let y = i32(id.y); if (x >= i32(u.w) || y >= i32(u.h)) { return; } let p = vec2f(f32(x), f32(y)); let v = vel[idx(x, y)];
  var nv = sV(p - v * u.dt) * 0.994; var nd = sD(p - v * u.dt) * 0.9965;
  let w = curlW(x, y); let gw = vec2f(abs(curlW(x + 1, y)) - abs(curlW(x - 1, y)), abs(curlW(x, y + 1)) - abs(curlW(x, y - 1))); let gl = length(gw) + 1e-5; nv += vec2f(gw.y, -gw.x) / gl * w * 0.2 * u.dt;
  /* the emitter is the mark's own distance field: an outward impulse and a bolus of dye on the beat */
  let d = markD(p + 0.5); if (abs(d) < 14.0) { let e = 1.0; let g = normalize(vec2f(markD(p + vec2f(e, 0.5)) - markD(p + vec2f(-e, 0.5)), markD(p + vec2f(0.5, e)) - markD(p + vec2f(0.5, -e))) + 1e-4); let wgt = exp(-d * d / 40.0); nv += g * u.sys * 30.0 * wgt * u.dt; nd += vec4f(0.62, 0.10, 0.62, 1.0) * u.sys * wgt * u.dt * 3.2; }
  if (u.ptrOn > 0.5) { let dp = p - u.ptr; let g = exp(-dot(dp, dp) / 40.0); nv += u.force * g; nd += vec4f(0.45, 0.08, 0.75, 1.0) * g * 0.25 * u.dt; }
  /* the quiet zone: dye that drifts under the printed block dissolves */
  if (f32(y) > f32(u.h) * 0.60) { nd *= 0.94; }
  if (x == 0 || y == 0 || x == i32(u.w) - 1 || y == i32(u.h) - 1) { nv = vec2f(0.0); }
  velOut[idx(x, y)] = nv; dyeOut[idx(x, y)] = min(nd, vec4f(1.6)); }`;
const SY_DIV = SY_COMMON + `
@group(0) @binding(1) var<storage, read> vel: array<vec2f>;
@group(0) @binding(2) var<storage, read_write> div: array<f32>;
@group(0) @binding(3) var<storage, read_write> pres: array<f32>;
@compute @workgroup_size(16, 16) fn main(@builtin(global_invocation_id) id: vec3u) { let x = i32(id.x); let y = i32(id.y); if (x >= i32(u.w) || y >= i32(u.h)) { return; } div[idx(x, y)] = 0.5 * (vel[idx(x + 1, y)].x - vel[idx(x - 1, y)].x + vel[idx(x, y + 1)].y - vel[idx(x, y - 1)].y); pres[idx(x, y)] = 0.0; }`;
const SY_JAC = SY_COMMON + `
@group(0) @binding(1) var<storage, read> div: array<f32>;
@group(0) @binding(2) var<storage, read> p0: array<f32>;
@group(0) @binding(3) var<storage, read_write> p1: array<f32>;
@compute @workgroup_size(16, 16) fn main(@builtin(global_invocation_id) id: vec3u) { let x = i32(id.x); let y = i32(id.y); if (x >= i32(u.w) || y >= i32(u.h)) { return; } p1[idx(x, y)] = (p0[idx(x - 1, y)] + p0[idx(x + 1, y)] + p0[idx(x, y - 1)] + p0[idx(x, y + 1)] - div[idx(x, y)]) * 0.25; }`;
const SY_PROJ = SY_COMMON + `
@group(0) @binding(1) var<storage, read> pres: array<f32>;
@group(0) @binding(2) var<storage, read_write> vel: array<vec2f>;
@compute @workgroup_size(16, 16) fn main(@builtin(global_invocation_id) id: vec3u) { let x = i32(id.x); let y = i32(id.y); if (x >= i32(u.w) || y >= i32(u.h)) { return; } vel[idx(x, y)] -= 0.5 * vec2f(pres[idx(x + 1, y)] - pres[idx(x - 1, y)], pres[idx(x, y + 1)] - pres[idx(x, y - 1)]); }`;
const SY_DRAW = PRE + `
@group(0) @binding(4) var<storage, read> dye: array<vec4f>;
fn D(p: vec2f) -> vec4f { let x = i32(floor(p.x)); let y = i32(floor(p.y)); let f = fract(p); let i = u32(clamp(y, 0, ${CH - 1})) * ${CW}u; let i2 = u32(clamp(y + 1, 0, ${CH - 1})) * ${CW}u; let x0 = u32(clamp(x, 0, ${CW - 1})); let x1 = u32(clamp(x + 1, 0, ${CW - 1})); return mix(mix(dye[i + x0], dye[i + x1], f.x), mix(dye[i2 + x0], dye[i2 + x1], f.x), f.y); }
@fragment fn fs(o: VO) -> @location(0) vec4f { let uv = o.uv; var col = face(uv); let g = vec2f(uv.x * ${CW}.0 - 0.5, uv.y * ${CH}.0 - 0.5); let d = D(g);
  let amt = clamp(d.a, 0.0, 1.0); let c = d.rgb / max(d.a, 1e-3); col = col * mix(vec3f(1.0), c * 1.15, smoothstep(0.0, 0.7, amt));
` + END;

/* ── HALATION · thirty thousand points settling into volumes ─────────── */
const HN = 30000;
const HA_K = `
struct U { n: u32, setIx: u32, pad1: u32, pad2: u32, dt: f32, time: f32, ptrOn: f32, aspect: f32, ptr: vec2f, pad: vec2f };
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read_write> pos: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> vel: array<vec4f>;
@group(0) @binding(3) var<storage, read> sets: array<vec4f>;
fn curl(p: vec3f, t: f32) -> vec3f { let a = vec3f(sin(p.y * 7.0 + t * 0.8) * cos(p.z * 6.0), sin(p.z * 6.5 - t * 0.6) * cos(p.x * 5.0), sin(p.x * 6.0 + t * 0.5) * cos(p.y * 7.0)); return vec3f(a.z - a.y, a.x - a.z, a.y - a.x); }
@compute @workgroup_size(256) fn main(@builtin(global_invocation_id) id: vec3u) { let i = id.x; if (i >= u.n) { return; } var p = pos[i]; var v = vel[i].xyz; let t = sets[u.setIx * u.n + i]; let d = t.xyz - p.xyz;
  var a = d * 40.0 - v * 9.0 + curl(p.xyz * 4.0, u.time) * 0.35;
  let dp = (p.xy - u.ptr) * vec2f(u.aspect, 1.0); let dd = length(dp); if (dd < 0.2 && u.ptrOn > 0.5) { a += vec3f(dp / (dd + 1e-4) * 3.0 * (1.0 - dd / 0.2), 0.0); }
  let dm = (p.xy - vec2f(0.64, 0.34)) * vec2f(u.aspect, 1.0); let dl = length(dm); if (dl < 0.09) { a += vec3f(dm / (dl + 1e-4) * 6.0 * (1.0 - dl / 0.09), 0.0); } /* the mark stays clear */
  v += a * u.dt; p = vec4f(p.xyz + v * u.dt, 0.0); pos[i] = p; vel[i] = vec4f(v, 0.0); }`;
const HA_D = `
struct R { res: vec2f, size: f32, alpha: f32, yaw: f32, pitch: f32, pad: vec2f, col: vec4f };
@group(0) @binding(0) var<uniform> r: R;
@group(0) @binding(1) var<storage, read> pos: array<vec4f>;
struct VO { @builtin(position) p: vec4f, @location(0) c: vec4f, @location(1) q: vec2f };
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO { let corner = vec2f(f32(vi & 1u), f32((vi >> 1u) & 1u)) * 2.0 - 1.0; let P = pos[ii]; let asp = r.res.x / r.res.y;
  var q = vec3f((P.x - 0.5) * asp, 0.5 - P.y, P.z); let cy = cos(r.yaw); let sy = sin(r.yaw); q = vec3f(cy * q.x + sy * q.z, q.y, -sy * q.x + cy * q.z); let zc = 2.0 + q.z; let f = 2.0 / zc; let sz = r.size * f / 2.0;
  var o: VO; o.p = vec4f(q.x * f / asp * 2.0 + corner.x * sz / r.res.x * 2.0, q.y * f * 2.0 + corner.y * sz / r.res.y * 2.0, 0.0, 1.0); o.q = corner; o.c = vec4f(r.col.rgb, r.alpha * clamp(1.2 - (q.z + 0.3), 0.4, 1.0)); return o; }
@fragment fn fs(o: VO) -> @location(0) vec4f { if (dot(o.q, o.q) > 1.0) { discard; } return o.c; }`;
const HA_BG = PRE + `@fragment fn fs(o: VO) -> @location(0) vec4f { let uv = o.uv; var col = face(uv);` + END;
/* the three volumes, as point sets in the scene region: a torus, a shear plane, a shell */
function haloSets(n) { const cx = 0.66, cy = 0.33, out = new Float32Array(n * 4 * 3);
  for (let k = 0; k < n; k++) { const a = hash2(k, 1) * TAU, b = hash2(k, 2) * TAU, u = hash2(k, 3), v = hash2(k, 4);
    let o = k * 4; out[o] = cx + (0.16 + 0.05 * Math.cos(b)) * Math.cos(a) * 0.7; out[o + 1] = cy + (0.16 + 0.05 * Math.cos(b)) * Math.sin(a); out[o + 2] = 0.05 * Math.sin(b);
    o = (n + k) * 4; out[o] = cx + (u - 0.5) * 0.44; out[o + 1] = cy + (v - 0.5) * 0.36 + (u - 0.5) * 0.16; out[o + 2] = (u - 0.5) * 0.5;
    o = (2 * n + k) * 4; const th = Math.acos(1 - 2 * u), ph = v * TAU, rr = 0.19 + 0.012 * hash2(k, 5); out[o] = cx + rr * Math.sin(th) * Math.cos(ph) * 0.7; out[o + 1] = cy + rr * Math.sin(th) * Math.sin(ph); out[o + 2] = rr * Math.cos(th) * 0.8; }
  return out; }

/* ── VITRINE · a glass stopper and its caustic ───────────────────────── */
const VITRINE = PRE + `
fn rotY(p: vec3f, a: f32) -> vec3f { let c = cos(a); let s = sin(a); return vec3f(c * p.x + s * p.z, p.y, -s * p.x + c * p.z); }
fn rotX(p: vec3f, a: f32) -> vec3f { let c = cos(a); let s = sin(a); return vec3f(p.x, c * p.y - s * p.z, s * p.y + c * p.z); }
/* seven planar cuts on a rounded core: a stopper */
fn gem(p0: vec3f) -> f32 { let p = rotX(rotY(p0 / 2.1, r.phase * 3.14159), 0.5 + r.tilt.y * 0.3); var d = length(p) - 0.13;
  let N = array<vec3f, 7>(vec3f(0.0, 1.0, 0.0), vec3f(0.0, -1.0, 0.0), vec3f(0.9, 0.3, 0.3), vec3f(-0.9, 0.3, 0.3), vec3f(0.3, 0.3, -0.9), vec3f(-0.3, -0.2, 0.9), vec3f(0.5, -0.6, -0.6));
  let H = array<f32, 7>(0.10, 0.09, 0.10, 0.10, 0.10, 0.11, 0.105); for (var i = 0; i < 7; i++) { d = max(d, dot(p, normalize(N[i])) - H[i]); } return (d - 0.004) * 2.1; }
fn nrm(p: vec3f) -> vec3f { let e = vec2f(0.0012, 0.0); return normalize(vec3f(gem(p + e.xyy) - gem(p - e.xyy), gem(p + e.yxy) - gem(p - e.yxy), gem(p + e.yyx) - gem(p - e.yyx))); }
fn env(d: vec3f) -> vec3f { let dd = normalize(vec3f(d.x + r.tilt.x * 0.6, d.y + r.tilt.y * 0.6, d.z)); var c = mix(vec3f(0.18, 0.17, 0.16), vec3f(1.0), smoothstep(-0.5, 0.7, dd.y)); c += vec3f(1.0, 0.97, 0.9) * pow(max(dot(dd, normalize(vec3f(0.5, 0.7, 0.5))), 0.0), 16.0) * 2.0 + vec3f(0.9, 0.95, 1.0) * pow(max(dot(dd, normalize(vec3f(-0.7, 0.1, 0.4))), 0.0), 24.0) * 1.2; c += vec3f(0.25) * step(0.92, abs(fract(dd.x * 2.5 + dd.y) - 0.5) * 2.0); return c; }
fn refr(I: vec3f, N: vec3f, eta: f32) -> vec3f { let k = 1.0 - eta * eta * (1.0 - dot(N, I) * dot(N, I)); if (k < 0.0) { return reflect(I, N); } return eta * I - (eta * dot(N, I) + sqrt(k)) * N; }
fn through(ro: vec3f, rd: vec3f, eta: f32) -> f32 { let rin = refr(rd, nrm(ro), eta); var t = 0.003; var p = ro; for (var i = 0; i < 36; i++) { p = ro + rin * t; let h = -gem(p); if (h < 0.0008) { break; } t += max(h * 0.8, 0.0015); if (t > 0.6) { break; } } let rout = refr(rin, -nrm(p), 1.0 / eta); return dot(env(rout), vec3f(0.333)); }
@fragment fn fs(o: VO) -> @location(0) vec4f { let uv = o.uv; var col = face(uv); let asp = r.res.x / r.res.y;
  let sc = vec2f(0.66, 0.32); let ro = vec3f((uv.x - sc.x) * asp, sc.y - uv.y, 0.8); let rd = normalize(vec3f(-r.tilt.x * 0.1, -r.tilt.y * 0.06, -1.0));
  /* the caustic: the key light through the stopper lands on the stock, spread into a spectrum; it flares when two facets align */
  let flare = r.a; let cdir = vec2f(cos(r.phase * 3.14159 + 0.8), sin(r.phase * 3.14159 + 0.8)); let cc = vec2f(0.80, 0.30) + cdir * 0.08;
  var caus = vec3f(0.0); for (var k = 0; k < 3; k++) { let off = cdir * (f32(k) - 1.0) * (0.022 + 0.05 * flare); let d = (uv - cc - off) * vec2f(asp, 1.0); let g = exp(-dot(d, d) / (0.006 + 0.006 * flare)) * (0.9 + 2.4 * flare); caus += select(select(vec3f(0.0, 0.0, 1.0), vec3f(0.0, 1.0, 0.0), k == 1), vec3f(1.0, 0.0, 0.0), k == 0) * g; }
  col += caus * 0.9;
  var t = 0.0; var hit = -1.0; for (var i = 0; i < 60; i++) { let h = gem(ro + rd * t); if (h < 0.0006) { hit = t; break; } t += h * 0.9; if (t > 2.0) { break; } }
  if (hit > 0.0) { let p = ro + rd * hit; let n = nrm(p); let fr = 0.04 + 0.96 * pow(1.0 - max(dot(n, -rd), 0.0), 5.0);
    let tr = vec3f(through(p, rd, 1.0 / 1.46), through(p, rd, 1.0 / 1.53), through(p, rd, 1.0 / 1.62)); let refl = env(reflect(rd, n));
    var glass = mix(tr, refl, fr); let edge = pow(1.0 - abs(dot(n, -rd)), 3.0); glass += vec3f(1.0) * edge * 0.25; col = tonemap(glass * 1.05); }
  else { /* the stopper's soft shadow on the stock */ let sh = exp(-length((uv - sc - vec2f(0.03, 0.06)) * vec2f(asp, 1.0)) * 9.0); col *= 1.0 - 0.18 * sh; }
` + END;

/* ── BUSBAR · charge hops through a graph ────────────────────────────── */
const BN = 22, BL = 34;
const BB_K = `
struct U { nLinks: u32, tick: u32, pad0: u32, pad1: u32 };
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> links: array<vec2u>;
@group(0) @binding(2) var<storage, read_write> node: array<atomic<u32>>; /* the tick at which a node was energised */
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) id: vec3u) { let i = id.x; if (i >= u.nLinks) { return; } let l = links[i]; let ta = atomicLoad(&node[l.x]); let tb = atomicLoad(&node[l.y]);
  /* a hop: a node energised on the previous tick energises its neighbour on this one */
  if (ta == u.tick - 1u) { atomicMin(&node[l.y], u.tick); } if (tb == u.tick - 1u) { atomicMin(&node[l.x], u.tick); } }`;
const BB_D = `
struct R { res: vec2f, time: f32, tick: f32, cyan: vec4f, amber: vec4f };
@group(0) @binding(0) var<uniform> r: R;
@group(0) @binding(1) var<storage, read> nodes: array<vec4f>;  /* x, y, pad, pad */
@group(0) @binding(2) var<storage, read> links: array<vec2u>;
@group(0) @binding(3) var<storage, read> tickOf: array<u32>;
struct VO { @builtin(position) p: vec4f, @location(0) c: vec4f, @location(1) q: vec2f, @location(2) kind: f32 };
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO { let asp = r.res.x / r.res.y; let CC = array<vec2f, 4>(vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0), vec2f(1.0, 1.0)); let corner = CC[min(vi, 3u)]; var o: VO;
  let frac = fract(r.tick); let cur = floor(r.tick);
  if (ii < ${BL}u) { let l = links[ii]; let a = nodes[l.x].xy; let b = nodes[l.y].xy; let end = f32((vi >> 1u) & 1u); let side = f32(vi & 1u) * 2.0 - 1.0; let P = mix(a, b, end);
    let dv = (b - a) * vec2f(asp, 1.0); let n = normalize(vec2f(-dv.y, dv.x) + 1e-5); let th = 2.6 / r.res.y; let pos = vec2f((P.x - 0.5) * asp + n.x * side * th, 0.5 - P.y + n.y * side * th);
    o.p = vec4f(pos.x / asp * 2.0, pos.y * 2.0, 0.0, 1.0); o.q = vec2f(side, 0.0);
    /* a link lights amber for 400 ms as charge crosses it, then cools to cyan */
    let ta = f32(tickOf[l.x]); let tb = f32(tickOf[l.y]); let crossed = abs(ta - tb) == 1.0 && max(ta, tb) <= cur; let since = (cur - max(ta, tb)) + frac; let hot = select(0.0, exp(-since * 2.4), crossed);
    o.c = vec4f(mix(r.cyan.rgb * 0.55, r.amber.rgb, hot), 1.0); o.kind = 0.0; }
  else { let ni = ii - ${BL}u; let P = nodes[ni].xy; let sz = 5.5 / r.res.y; let pos = vec2f((P.x - 0.5) * asp + corner.x * sz, 0.5 - P.y + corner.y * sz);
    o.p = vec4f(pos.x / asp * 2.0, pos.y * 2.0, 0.0, 1.0); o.q = corner; let t = f32(tickOf[ni]); let lit = select(0.0, exp(-((cur - t) + frac) * 1.6), t <= cur);
    o.c = vec4f(mix(r.cyan.rgb, r.amber.rgb, lit) * (0.7 + 0.5 * lit), 1.0); o.kind = 1.0; }
  return o; }
@fragment fn fs(o: VO) -> @location(0) vec4f { return o.c; }`;
const BB_BG = PRE + `@fragment fn fs(o: VO) -> @location(0) vec4f { let uv = o.uv; var col = face(uv);` + END;
function busGraph() { const nodes = [], links = new Set(); let k = 0; for (let row = 0; row < 4; row++) for (let c = 0; c < 6; c++) { if ((row === 0 && c === 5) || (row === 3 && c === 0)) continue; nodes.push([0.37 + c * 0.112 + (hash2(k, 1) - 0.5) * 0.04, 0.09 + row * 0.15 + (hash2(k, 2) - 0.5) * 0.05]); k++; }
  const n = nodes.length; for (let i = 0; i < n; i++) { const d = nodes.map((p, j) => [Math.hypot((p[0] - nodes[i][0]) * 1.586, p[1] - nodes[i][1]), j]).sort((a, b) => a[0] - b[0]); for (let m = 1; m <= 2 && links.size < BL; m++) { const j = d[m][1]; links.add(i < j ? i + ',' + j : j + ',' + i); } }
  let extra = 0; while (links.size < BL) { const i = Math.floor(hash2(extra, 9) * n), j = Math.floor(hash2(extra, 11) * n); extra++; if (i !== j) links.add(i < j ? i + ',' + j : j + ',' + i); }
  return { nodes, links: [...links].slice(0, BL).map((s) => s.split(',').map(Number)) }; }

/* ── MULLION · a louvred wall ────────────────────────────────────────── */
const SL = 34;
const MU_D = `
struct R { res: vec2f, time: f32, phase: f32, stone: vec4f, blue: vec4f, light: vec4f };
@group(0) @binding(0) var<uniform> r: R;
struct VO { @builtin(position) p: vec4f, @location(0) c: vec3f, @location(1) q: vec2f };
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO { let asp = r.res.x / r.res.y; let corner = vec2f(f32(vi & 1u), f32((vi >> 1u) & 1u)) * 2.0 - 1.0; let fi = f32(ii);
  /* slat ii rotates about its own vertical axis; the wave passes left to right */
  let ang = 1.75 * sin(r.phase - fi * 0.13); let x0 = 0.36 + (fi + 0.5) / ${SL}.0 * 0.60; let hw = 0.60 / ${SL}.0 * 0.46; let ca = cos(ang); let sa = sin(ang);
  let x = x0 + corner.x * hw * ca; let z = corner.x * hw * sa; let y = 0.33 + corner.y * 0.26; let persp = 1.0 + z * 1.6; let pos = vec2f((x - 0.5) * asp / persp, (0.5 - y) / persp);
  var o: VO; o.p = vec4f(pos.x / asp * 2.0, pos.y * 2.0, 0.0, 1.0); o.q = corner;
  let n = vec3f(sa, 0.0, ca); let L = normalize(r.light.xyz); let facing = dot(n, vec3f(0.0, 0.0, 1.0)); let front = facing > 0.0; let nd = 0.35 + 0.65 * abs(dot(n, L)); let spec = pow(abs(dot(n, normalize(L + vec3f(0.0, 0.0, 1.0)))), 30.0) * 0.25;
  o.c = select(r.blue.rgb, r.stone.rgb, front) * nd + vec3f(spec); return o; }
@fragment fn fs(o: VO) -> @location(0) vec4f { let e = smoothstep(1.0, 0.8, abs(o.q.x)); return vec4f(o.c * (0.75 + 0.25 * e), 1.0); }`;
const MU_BG = PRE + `@fragment fn fs(o: VO) -> @location(0) vec4f { let uv = o.uv; var col = face(uv); let asp = r.res.x / r.res.y;
  /* the darker ground the wall stands in front of */
  let inside = step(0.34, uv.x) * step(uv.x, 0.98) * step(0.05, uv.y) * step(uv.y, 0.61); col = mix(col, r.stock.rgb * 0.62, inside);` + END;

const posterT = { orrery: 4.2, rosette: 6.0, vesper: 9.5, syringa: 3.4, halation: 6.4, vitrine: 9.3, busbar: 3.5, mullion: 2.1 };

/* ── the wallet ───────────────────────────────────────────────────────── */
export function walletCards() {
  const wallet = $('wl-card'), phone = $('wl-phone'), stack = $('wl-stack'), detail = $('wl-detail'); let open = -1, lastTouch = 0, openedAt = 0;
  const els = CARDS.map((c) => $('wl-' + c.id));
  const layout = () => { const H = stack.clientHeight, cardH = els[0].offsetHeight, step = Math.min(44, (H - cardH - 12) / (CARDS.length - 1));
    els.forEach((el, i) => { if (open < 0) { el.style.transform = `translateY(${i * step}px)`; el.style.zIndex = i + 1; el.classList.remove('wl-on', 'wl-peek'); }
      else if (i === open) { el.style.transform = 'translateY(0px)'; el.style.zIndex = 20; el.classList.add('wl-on'); el.classList.remove('wl-peek'); }
      else { const j = i < open ? i : i - 1; el.style.transform = `translateY(${H - 46 + j * 5}px) scale(${1 - (CARDS.length - 2 - j) * 0.012})`; el.style.zIndex = 8 - j; el.classList.add('wl-peek'); el.classList.remove('wl-on'); } });
    detail.hidden = open < 0; if (open >= 0) { const c = CARDS[open]; detail.style.top = (cardH + 18) + 'px'; $('wl-d-name').textContent = $('wl-' + c.id).querySelector('.wl-name').textContent; $('wl-d-title').textContent = c.issuer; $('wl-d-mail').textContent = c.issuer.split(' · ')[0]; $('wl-d-tel').textContent = $('wl-' + c.id).querySelector('.wl-pan').textContent; }
    wallet.classList.toggle('wl-is-open', open >= 0); phone.scrollTop = 0; stack.scrollTop = 0; };
  const setOpen = (i) => { open = i; openedAt = performance.now(); layout(); };
  let auto = true, busy = false;
  const goto = (i) => { if (busy) return; busy = true; if (open >= 0) { setOpen(-1); setTimeout(() => { setOpen(i); busy = false; }, 950); } else { setOpen(i); busy = false; } };
  els.forEach((el, i) => { el.addEventListener('click', () => { if (open === i) return; lastTouch = performance.now(); goto(i); }); el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); lastTouch = performance.now(); goto(i); } }); });
  $('wl-close').addEventListener('click', () => { lastTouch = performance.now(); setOpen(-1); });
  new ResizeObserver(layout).observe(stack); requestAnimationFrame(layout);
  const step = (d) => { const cur = open < 0 ? (d > 0 ? -1 : 0) : open; goto((cur + d + CARDS.length) % CARDS.length); };
  $('wl-prev').addEventListener('click', () => { lastTouch = performance.now(); step(-1); }); $('wl-next').addEventListener('click', () => { lastTouch = performance.now(); step(1); });
  $('wl-auto').addEventListener('click', () => { auto = !auto; $('wl-auto').classList.toggle('wl-auto-on', auto); $('wl-auto').textContent = auto ? 'auto · on' : 'auto · off'; lastTouch = performance.now(); });
  let tourAt = 0; setInterval(() => { if (!auto || busy || performance.now() - lastTouch < 6000) return; if (open < 0) { goto(tourAt % CARDS.length); tourAt++; } else if (performance.now() - openedAt > 14000) { goto((open + 1) % CARDS.length); tourAt = open + 2; } }, 500);
  lastTouch = performance.now() - 4000;

  return CARDS.map((c, ci) => {
    const el = els[ci], stage = $('wl-' + c.id + '-stage'), canvas = $('wl-' + c.id + '-canvas'); let s = null, ptr = [-9, -9], on = 0, tilt = [0, 0], last = null, force = [0, 0], drag = [0, 0];
    pointer(stage, (p) => { ptr = [p.x, p.y]; on = 1; if (last) { force = [(p.x - last[0]) * 60, (p.y - last[1]) * 60]; drag = [drag[0] + (p.x - last[0]), drag[1] + (p.y - last[1])]; } last = [p.x, p.y]; }, () => { on = 0; last = null; });
    const isOpen = () => open === ci;
    return card({ name: 'wallet-' + c.id, el, init() {
      const dev = this.__dev, { ctx, fit } = attach(canvas); const ru = uniform(112), smp = dev.createSampler({ magFilter: 'linear', minFilter: 'linear' });
      const mc = drawMark(c.mark), mt = markTextures(dev, mc); s = { ctx, fit, ru, smp, mt, ready: false };
      mt.upload().then(() => {
        const faceBind = (pipe, extra = []) => dev.createBindGroup({ layout: pipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: ru } }, { binding: 1, resource: mt.tex.createView() }, { binding: 2, resource: smp }, { binding: 3, resource: mt.sdf.createView() }, ...extra] });
        const pm = render(MARK, { blend: true }); s.mark = { pm, gm: faceBind(pm) };
        if (c.id === 'orrery') { const pf = render(ORRERY); s.face = { pf, gf: faceBind(pf) }; }
        else if (c.id === 'rosette') { const p0 = new Float32Array(RM * 4), v0 = new Float32Array(RM * 4); for (let k = 0; k < RM; k++) { const kind = hash2(k, 1) < 0.72 ? 1 : hash2(k, 1) < 0.94 ? 0 : 2; p0[k * 4] = 0.36 + hash2(k, 2) * 0.62; p0[k * 4 + 1] = hash2(k, 3) * 0.58; p0[k * 4 + 2] = (hash2(k, 4) - 0.5) * 0.5; p0[k * 4 + 3] = kind; }
          const pos = storage(RM * 16), vel = storage(RM * 16), u = uniform(32), pr = uniform(48); dev.queue.writeBuffer(pos, 0, p0); dev.queue.writeBuffer(vel, 0, v0);
          const pk = compute(RO_K), pd = pipe3d(RO_D, { depth: true, blend: true }), pb = pipe3d(RO_BG, { depth: 'nowrite', topology: 'triangle-list' }); s.ro = { u, pr, pk, pd, pb, gk: bind(pk, [u, pos, vel]), gd: bind(pd, [pr, pos]), gb: faceBind(pb), depth: null }; }
        else if (c.id === 'vesper') { const bufs = [storage(TRW * TRH * 4), storage(TRW * TRH * 4)], u = uniform(64), st = compute(VL_STEP), pd = render(VL_DRAW);
          s.vl = { bufs, u, st, gs: [bind(st, [u, bufs[0], bufs[1]]), bind(st, [u, bufs[1], bufs[0]])], gd: [faceBind(pd, [{ binding: 4, resource: { buffer: bufs[1] } }]), faceBind(pd, [{ binding: 4, resource: { buffer: bufs[0] } }])], pd, cur: 0 }; }
        else if (c.id === 'syringa') { const Nc = CW * CH; const vel = [storage(Nc * 8), storage(Nc * 8)], dye = [storage(Nc * 16), storage(Nc * 16)], div = storage(Nc * 4), pres = [storage(Nc * 4), storage(Nc * 4)], u = uniform(64);
          const mk = (code, bufs, tex) => { const p = compute(code); return { p, g: bufs.map((bl) => dev.createBindGroup({ layout: p.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: u } }, ...bl.map((b, i) => ({ binding: [1, 2, 3, 6][i], resource: { buffer: b } })), ...(tex ? [{ binding: 4, resource: mt.sdf.createView() }, { binding: 5, resource: smp }] : [])] })) }; };
          const A = mk(SY_ADVECT, [[vel[0], vel[1], dye[0], dye[1]], [vel[1], vel[0], dye[1], dye[0]]], true), D = mk(SY_DIV, [[vel[1], div, pres[0]], [vel[0], div, pres[0]]]), J = mk(SY_JAC, [[div, pres[0], pres[1]], [div, pres[1], pres[0]]]), P = mk(SY_PROJ, [[pres[0], vel[1]], [pres[0], vel[0]]]);
          const pd = render(SY_DRAW); s.sy = { u, A, D, J, P, pd, gd: [faceBind(pd, [{ binding: 4, resource: { buffer: dye[1] } }]), faceBind(pd, [{ binding: 4, resource: { buffer: dye[0] } }])], cur: 0 }; }
        else if (c.id === 'halation') { const sets = haloSets(HN), setsB = storage(sets.byteLength), pos = storage(HN * 16), vel = storage(HN * 16), u = uniform(48), pr = uniform(48); dev.queue.writeBuffer(setsB, 0, sets); dev.queue.writeBuffer(pos, 0, sets.subarray(0, HN * 4));
          const pk = compute(HA_K), pd = render(HA_D, { blend: 'add' }), pb = render(HA_BG); s.ha = { u, pr, pk, pd, pb, gk: bind(pk, [u, pos, vel, setsB]), gd: bind(pd, [pr, pos]), gb: faceBind(pb) }; }
        else if (c.id === 'vitrine') { const pf = render(VITRINE); s.face = { pf, gf: faceBind(pf) }; }
        else if (c.id === 'busbar') { const g = busGraph(); const nb = new Float32Array(BN * 4); g.nodes.forEach((p, i) => { nb[i * 4] = p[0]; nb[i * 4 + 1] = p[1]; }); const lb = new Uint32Array(BL * 2); g.links.forEach((l, i) => { lb[i * 2] = l[0]; lb[i * 2 + 1] = l[1]; });
          const nodes = storage(nb.byteLength), links = storage(lb.byteLength), tickB = storage(BN * 4), u = uniform(16), pr = uniform(48); dev.queue.writeBuffer(nodes, 0, nb); dev.queue.writeBuffer(links, 0, lb);
          const pk = compute(BB_K), pd = render(BB_D), pb = render(BB_BG); s.bb = { u, pr, pk, pd, pb, tickB, gk: bind(pk, [u, links, tickB]), gd: bind(pd, [pr, nodes, links, tickB]), gb: faceBind(pb), lastTick: -1, seed: 0 };
          s.bb.reset = () => { const t0 = new Uint32Array(BN).fill(0xffffffff); t0[s.bb.seed] = 0; dev.queue.writeBuffer(tickB, 0, t0); s.bb.lastTick = 0; }; s.bb.reset(); }
        else if (c.id === 'mullion') { const pr = uniform(64), pd = render(MU_D), pb = render(MU_BG); s.mu = { pr, pd, pb, gd: bind(pd, [pr]), gb: faceBind(pb) }; }
        s.ready = true; }).catch((e) => console.error('wallet', c.id, e));
    }, frame(t, dt, now) {
      if (!s) return; const resized = s.fit(); const dev = this.__dev, op = isOpen() ? 1 : 0, since = (now - openedAt) / 1000, T = op ? since : posterT[c.id]; const sc = c.scale || 1, mb = [MB[0] + MB[2] * (1 - sc) / 2, MB[1] + MB[3] * (1 - sc) / 2, MB[2] * sc, MB[3] * sc];
      if (!op) { if (s.stillDrawn && !resized) return; if (s.ready) s.stillDrawn = true; } else { s.stillDrawn = false; }
      const want = !op ? [0.15, 0.05] : on ? [(ptr[0] - 0.5) * 1.2, (ptr[1] - 0.5) * 1.2] : [0, 0];
      if (!op) tilt = [...want]; else { tilt[0] += (want[0] - tilt[0]) * Math.min(1, dt * 4); tilt[1] += (want[1] - tilt[1]) * Math.min(1, dt * 4); }
      const view = s.ctx.getCurrentTexture().createView(), enc = dev.createCommandEncoder(), asp = canvas.width / canvas.height;
      const writeR = (phase, a = 0, b = 0) => dev.queue.writeBuffer(s.ru, 0, new Float32Array([canvas.width, canvas.height, T, phase, tilt[0], tilt[1], op, on, ...c.stock, 1, ...mb, ptr[0], ptr[1], a, b, ...c.ink, 1]));
      if (!s.ready) { const rp = enc.beginRenderPass({ colorAttachments: [{ view, loadOp: 'clear', storeOp: 'store', clearValue: { r: c.stock[0], g: c.stock[1], b: c.stock[2], a: 1 } }] }); rp.end(); dev.queue.submit([enc.finish()]); return; }
      const steps = op ? 1 : 40, fdt = Math.min(dt, 1 / 30);
      const markPass = (rp) => { rp.setPipeline(s.mark.pm); rp.setBindGroup(0, s.mark.gm); rp.draw(3); };
      const simple = (phase, a = 0) => { writeR(phase, a); const rp = enc.beginRenderPass({ colorAttachments: [{ view, loadOp: 'clear', storeOp: 'store' }] }); rp.setPipeline(s.face.pf); rp.setBindGroup(0, s.face.gf); rp.draw(3); markPass(rp); rp.end(); };
      if (c.id === 'orrery') { /* one key light, −55° to +55° and back over sixteen seconds; the tilt moves it */ const az = (-0.96 + 1.92 * (0.5 - 0.5 * Math.cos((T % 16) / 16 * TAU))) + tilt[0] * 1.2; simple(az); }
      else if (c.id === 'vitrine') { /* a half turn over fourteen seconds; a flare at nine */ const tl = T % 14; const flare = Math.exp(-Math.pow((tl - 9.0) / 0.5, 2)) * (tl < 9 ? 1 : 1) * Math.max(0, 1 - Math.max(0, tl - 9.3) / 1.4); simple(tl / 14 + (on ? drag[0] * 0.8 : 0), flare); }
      else if (c.id === 'rosette') { const ro = s.ro; if (!ro.depth || ro.depth.width !== canvas.width || ro.depth.height !== canvas.height) ro.depth = dev.createTexture({ size: [canvas.width, canvas.height], format: 'depth24plus', usage: GPUTextureUsage.RENDER_ATTACHMENT });
        for (let k = 0; k < steps; k++) { const U = new ArrayBuffer(32), Ui = new Uint32Array(U), Uf = new Float32Array(U); Ui[0] = RM; Uf[4] = fdt; Uf[5] = T + k / 60; Uf[6] = asp; dev.queue.writeBuffer(ro.u, 0, U); const cp = enc.beginComputePass(); cp.setPipeline(ro.pk); cp.setBindGroup(0, ro.gk); cp.dispatchWorkgroups(Math.ceil(RM / 64)); cp.end(); }
        dev.queue.writeBuffer(ro.pr, 0, new Float32Array([canvas.width, canvas.height, T, 0, -0.4 + tilt[0], 0.7 + tilt[1], 0.7, 0, on ? drag[0] * 4 : 0, on ? drag[1] * 4 : 0, 0, 0])); writeR(0);
        const rp = enc.beginRenderPass({ colorAttachments: [{ view, loadOp: 'clear', storeOp: 'store' }], depthStencilAttachment: { view: ro.depth.createView(), depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store' } });
        rp.setPipeline(ro.pb); rp.setBindGroup(0, ro.gb); rp.draw(3); rp.setPipeline(ro.pd); rp.setBindGroup(0, ro.gd); rp.draw(4, RM); rp.end();
        const rp2 = enc.beginRenderPass({ colorAttachments: [{ view, loadOp: 'load', storeOp: 'store' }] }); markPass(rp2); rp2.end();
      } else if (c.id === 'vesper') { /* one sixteen-second traverse; the body drops behind the ridge at eleven and the warm band collapses */
        const vl = s.vl, tl = T % 16, scroll = tl / 16 + (on ? drag[0] * 0.5 : 0); const dropped = tl > 11 ? Math.min(1, (tl - 11) / 2) : 0; const agents = [];
        if (tl < 11.4) { const ax = (scroll * 1.0 + 0.55) * TRW, ay = 0.66 * TRH; agents.push([ax % TRW, ay, 2.2, 0]); }
        for (let k = 0; k < steps; k++) { const U = new ArrayBuffer(64), Ui = new Uint32Array(U), Uf = new Float32Array(U); Ui[0] = TRW; Ui[1] = TRH; Ui[2] = agents.length; Uf[4] = 0.985; Uf[5] = T; Uf[6] = scroll; agents.forEach((a, i) => Uf.set(a, 8 + i * 4)); dev.queue.writeBuffer(vl.u, 0, U); const cp = enc.beginComputePass(); cp.setPipeline(vl.st); cp.setBindGroup(0, vl.gs[vl.cur]); cp.dispatchWorkgroups(Math.ceil(TRW / 16), Math.ceil(TRH / 16)); cp.end(); vl.cur ^= 1; }
        writeR(scroll, 1 - 0.4 * dropped); const rp = enc.beginRenderPass({ colorAttachments: [{ view, loadOp: 'clear', storeOp: 'store' }] }); rp.setPipeline(vl.pd); rp.setBindGroup(0, vl.gd[vl.cur ^ 1]); rp.draw(3); markPass(rp); rp.end();
      } else if (c.id === 'syringa') { const sy = s.sy;
        for (let k = 0; k < (op ? 1 : 0); k++) { /* a cardiac profile: a 90 ms attack, a 300 ms fall, once a second */ const ph = T % 1; const sys = ph < 0.09 ? ph / 0.09 : Math.max(0, 1 - (ph - 0.09) / 0.30);
          const U = new ArrayBuffer(64), Ui = new Uint32Array(U), Uf = new Float32Array(U); Ui[0] = CW; Ui[1] = CH; Uf[4] = 1.0; Uf[5] = sys; Uf[6] = T; Uf[7] = on; Uf[8] = ptr[0] * CW; Uf[9] = ptr[1] * CH; Uf[10] = force[0]; Uf[11] = force[1]; Uf.set(mb, 12); dev.queue.writeBuffer(sy.u, 0, U); force = [force[0] * 0.5, force[1] * 0.5];
          const gx = Math.ceil(CW / 16), gy = Math.ceil(CH / 16), cp = enc.beginComputePass(); cp.setPipeline(sy.A.p); cp.setBindGroup(0, sy.A.g[sy.cur]); cp.dispatchWorkgroups(gx, gy); cp.setPipeline(sy.D.p); cp.setBindGroup(0, sy.D.g[sy.cur]); cp.dispatchWorkgroups(gx, gy); cp.setPipeline(sy.J.p); for (let i = 0; i < C_ITERS; i++) { cp.setBindGroup(0, sy.J.g[i & 1]); cp.dispatchWorkgroups(gx, gy); } cp.setPipeline(sy.P.p); cp.setBindGroup(0, sy.P.g[sy.cur]); cp.dispatchWorkgroups(gx, gy); cp.end(); sy.cur ^= 1; }
        writeR(0); const rp = enc.beginRenderPass({ colorAttachments: [{ view, loadOp: 'clear', storeOp: 'store' }] }); rp.setPipeline(sy.pd); rp.setBindGroup(0, sy.gd[sy.cur ^ 1]); rp.draw(3); markPass(rp); rp.end();
      } else if (c.id === 'halation') { /* three retargets, at 0, 5 and 10 seconds */ const ha = s.ha, setIx = Math.floor((T % 15) / 5);
        for (let k = 0; k < steps; k++) { const U = new ArrayBuffer(48), Ui = new Uint32Array(U), Uf = new Float32Array(U); Ui[0] = HN; Ui[1] = setIx; Uf[4] = fdt; Uf[5] = T + k / 60; Uf[6] = on; Uf[7] = asp; Uf[8] = ptr[0]; Uf[9] = ptr[1]; dev.queue.writeBuffer(ha.u, 0, U); const cp = enc.beginComputePass(); cp.setPipeline(ha.pk); cp.setBindGroup(0, ha.gk); cp.dispatchWorkgroups(Math.ceil(HN / 256)); cp.end(); }
        dev.queue.writeBuffer(ha.pr, 0, new Float32Array([canvas.width, canvas.height, 2.0 * DPR, 0.14, Math.sin(T * 0.2) * 0.5 + tilt[0] * 0.4, 0, 0, 0, 0.35, 0.95, 0.80, 1])); writeR(0);
        const rp = enc.beginRenderPass({ colorAttachments: [{ view, loadOp: 'clear', storeOp: 'store' }] }); rp.setPipeline(ha.pb); rp.setBindGroup(0, ha.gb); rp.draw(3); rp.setPipeline(ha.pd); rp.setBindGroup(0, ha.gd); rp.draw(4, HN); markPass(rp); rp.end();
      } else if (c.id === 'busbar') { /* twenty-eight ticks at half a second; the front returns to its seed */ const bb = s.bb, tl = T % 14, tick = Math.floor(tl / 0.5);
        if (tick < bb.lastTick) bb.reset(); for (let k = bb.lastTick + 1; k <= tick; k++) { dev.queue.writeBuffer(bb.u, 0, new Uint32Array([BL, k, 0, 0])); for (let rep = 0; rep < 2; rep++) { const cp = enc.beginComputePass(); cp.setPipeline(bb.pk); cp.setBindGroup(0, bb.gk); cp.dispatchWorkgroups(1); cp.end(); } bb.lastTick = k; }
        dev.queue.writeBuffer(bb.pr, 0, new Float32Array([canvas.width, canvas.height, T, tl / 0.5, 0.55, 0.78, 0.86, 1, 1.0, 0.70, 0.18, 1])); writeR(0);
        const rp = enc.beginRenderPass({ colorAttachments: [{ view, loadOp: 'clear', storeOp: 'store' }] }); rp.setPipeline(bb.pb); rp.setBindGroup(0, bb.gb); rp.draw(3); rp.setPipeline(bb.pd); rp.setBindGroup(0, bb.gd); rp.draw(4, BL + BN); markPass(rp); rp.end();
      } else if (c.id === 'mullion') { /* a travelling wave with a 3.5 s period; the hand sets its phase */ const mu = s.mu, phase = (on ? drag[0] * 6 : 0) + (T % 14) / 3.5 * TAU;
        dev.queue.writeBuffer(mu.pr, 0, new Float32Array([canvas.width, canvas.height, T, phase, 0.80, 0.78, 0.74, 1, 0.06, 0.14, 0.36, 1, -0.5 + tilt[0], 0.4, 0.8, 0])); writeR(0);
        const rp = enc.beginRenderPass({ colorAttachments: [{ view, loadOp: 'clear', storeOp: 'store' }] }); rp.setPipeline(mu.pb); rp.setBindGroup(0, mu.gb); rp.draw(3); rp.setPipeline(mu.pd); rp.setBindGroup(0, mu.gd); rp.draw(4, SL); markPass(rp); rp.end();
      }
      dev.queue.submit([enc.finish()]);
    } });
  });
}
export const WALLET_CARDS = CARDS;
