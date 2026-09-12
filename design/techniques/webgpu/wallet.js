/* §2 · WALLET — a phone wallet holding eight business cards, one for each of
   the eight largest companies on the Fortune list, each carrying the
   company's own mark. The set is a printer's sample kit (direction by
   norman-art-director, conductor/tracks/004-webgpu-sl-14/wallet-concepts.md):
   the same information block on every card, never lit and never moving, and
   one mechanism per card — the process is the only variable. In the stack a
   card is a still; its process starts the moment it opens.
     1 Walmart      the Spark held by 48k points in depth, turning into other departments
     2 Amazon       one sled down a ray-marched snow hill at dusk; its glowing track is the arrow
     3 Apple        the mark as a titanium solid in a cove: one key, a shadow, a bounce
     4 UnitedHealth a flip-tile board that sorts and clears, column by column, into the mark
     5 Berkshire    letterpress, macro: paper fibre, a raking key, a shadow in every counter
     6 CVS          the heart pumps dye into a fluid at sixty beats a minute, with bloom
     7 ExxonMobil   CO₂ molecules drifting in depth, captured into a lattice that is the roundel
     8 Alphabet     the wordmark as glass, ray-marched with refraction and dispersion
   The people are invented; the marks are the companies' own. */
import { $, DPR, TAU, device, format, storage, uniform, compute, render, bind, attach, card, pointer, hash2, FSQ_VS } from './common.js';

const CARDS = [
  { id: 'walmart', stock: [0.0, 0.42, 0.80], name: 'Dana Whitfield', title: 'VP, Store Experience', l1: 'dana.whitfield@walmart.example', l2: 'walmart.com · Bentonville' },
  { id: 'amazon', stock: [0.07, 0.10, 0.16], name: 'Raj Menon', title: 'Principal Motion Designer', l1: 'rajm@amazon.example', l2: 'amazon.com · Seattle' },
  { id: 'apple', stock: [0.04, 0.04, 0.045], name: 'Ines Marlow', title: 'Design Lead, Interaction', l1: 'imarlow@apple.example', l2: 'apple.com · Cupertino' },
  { id: 'unitedhealth', stock: [0.97, 0.975, 0.98], name: 'Dr Amara Cole', title: 'Chief Digital Officer', l1: 'amara.cole@uhg.example', l2: 'unitedhealthgroup.com' },
  { id: 'berkshire', stock: [0.93, 0.90, 0.84], name: 'Thomas Reade', title: 'Investment Associate', l1: 'treade@berkshire.example', l2: 'berkshirehathaway.com · Omaha' },
  { id: 'cvs', stock: [1, 1, 1], name: 'Marisol Vega', title: 'Director, Pharmacy Innovation', l1: 'marisol.vega@cvs.example', l2: 'cvshealth.com · Woonsocket' },
  { id: 'exxon', stock: [0.80, 0.83, 0.87], name: 'Owen Hartley', title: 'Brand & Motion', l1: 'owen.hartley@exxonmobil.example', l2: 'exxonmobil.com · Spring, TX' },
  { id: 'alphabet', stock: [0.985, 0.985, 0.985], name: 'Kenji Sato', title: 'Creative Technologist', l1: 'kenjis@abc.example', l2: 'abc.xyz · Mountain View' },
];

/* ── shared: raster, signed distance, textures, pipelines with depth ─── */
const TW = 1024, TH = 512;
function raster(img, pad = 40) { const c = document.createElement('canvas'); c.width = TW; c.height = TH; const x = c.getContext('2d', { willReadFrequently: true });
  const s = Math.min((TW - pad * 2) / img.naturalWidth, (TH - pad * 2) / img.naturalHeight), w = img.naturalWidth * s, h = img.naturalHeight * s; x.drawImage(img, (TW - w) / 2, (TH - h) / 2, w, h); return c; }
function edt1d(f, n, d, v, z) { let k = 0; v[0] = 0; z[0] = -1e20; z[1] = 1e20;
  for (let q = 1; q < n; q++) { let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); } k++; v[k] = q; z[k] = s; z[k + 1] = 1e20; }
  k = 0; for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; } }
function edt2d(g, w, h) { const m = Math.max(w, h), f = new Float32Array(m), d = new Float32Array(m), v = new Int32Array(m), z = new Float32Array(m + 1);
  for (let x = 0; x < w; x++) { for (let y = 0; y < h; y++) f[y] = g[y * w + x]; edt1d(f, h, d, v, z); for (let y = 0; y < h; y++) g[y * w + x] = d[y]; }
  for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) f[x] = g[y * w + x]; edt1d(f, w, d, v, z); for (let x = 0; x < w; x++) g[y * w + x] = d[x]; } }
/* exact signed distance (Felzenszwalb–Huttenlocher), in pixels of the full raster */
function signedDistance(c, w, h) { const d = c.getContext('2d').getImageData(0, 0, TW, TH).data, sx = TW / w, sy = TH / h; const inside = new Float32Array(w * h), outside = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const a = d[((Math.floor(y * sy)) * TW + Math.floor(x * sx)) * 4 + 3] > 127; inside[y * w + x] = a ? 1e20 : 0; outside[y * w + x] = a ? 0 : 1e20; }
  edt2d(inside, w, h); edt2d(outside, w, h); const s = new Float32Array(w * h); for (let i = 0; i < w * h; i++) s[i] = (Math.sqrt(outside[i]) - Math.sqrt(inside[i])) * sx; return s; }
function toHalf(v) { const f = new Float32Array(1), u = new Uint32Array(f.buffer); f[0] = v; const x = u[0], sign = (x >> 16) & 0x8000; let e = ((x >> 23) & 0xff) - 112, m = x & 0x7fffff; if (e <= 0) return sign; if (e >= 31) return sign | 0x7c00; return sign | (e << 10) | (m >> 13); }
function markTextures(dev, c) {
  const tex = dev.createTexture({ size: [TW, TH], format: 'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT });
  const sw = 512, sh = 256, sd = signedDistance(c, sw, sh), half = new Uint16Array(sw * sh); for (let i = 0; i < sw * sh; i++) half[i] = toHalf(sd[i]);
  const sdf = dev.createTexture({ size: [sw, sh], format: 'r16float', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
  dev.queue.writeTexture({ texture: sdf }, half, { bytesPerRow: sw * 2 }, [sw, sh]);
  return { tex, sdf, upload: async () => { const bmp = await createImageBitmap(c); dev.queue.copyExternalImageToTexture({ source: bmp }, { texture: tex }, [TW, TH]); bmp.close(); } };
}
function pixels(c, test, step = 2) { const d = c.getContext('2d').getImageData(0, 0, TW, TH).data, pts = []; for (let j = 0; j < TH; j += step) for (let i = 0; i < TW; i += step) { const k = (j * TW + i) * 4; if (d[k + 3] > 100 && test(d[k], d[k + 1], d[k + 2])) pts.push([i / TW, j / TH]); } return pts; }
function pipe3d(code, opts = {}) { const m = device.createShaderModule({ code }); const blend = opts.blend === 'add' ? { color: { srcFactor: 'src-alpha', dstFactor: 'one' }, alpha: { srcFactor: 'one', dstFactor: 'one' } } : opts.blend ? { color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' } } : undefined;
  const depth = opts.depth === 'nowrite' ? { format: 'depth24plus', depthWriteEnabled: false, depthCompare: 'always' } : opts.depth ? { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' } : undefined;
  return device.createRenderPipeline({ layout: 'auto', vertex: { module: m, entryPoint: 'vs' }, fragment: { module: m, entryPoint: 'fs', targets: [{ format, blend }] }, primitive: { topology: opts.topology || 'triangle-strip' }, depthStencil: depth }); }

/* ── the face prelude: stock, grain, a sheen that follows the tilt ─────── */
const PRE = FSQ_VS + `
struct R { res: vec2f, time: f32, phase: f32, tilt: vec2f, open: f32, ptrOn: f32, stock: vec4f, box: vec4f, ptr: vec2f, a: f32, b: f32, extra: vec4f };
@group(0) @binding(0) var<uniform> r: R;
@group(0) @binding(1) var tex: texture_2d<f32>;
@group(0) @binding(2) var smp: sampler;
@group(0) @binding(3) var sdfT: texture_2d<f32>;
fn hash(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }
fn vn(p: vec2f) -> f32 { let i = floor(p); var f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2f(1, 0)), f.x), mix(hash(i + vec2f(0, 1)), hash(i + vec2f(1, 1)), f.x), f.y); }
fn fbm(p0: vec2f) -> f32 { var p = p0; var a = 0.5; var s = 0.0; for (var i = 0; i < 4; i++) { s += a * vn(p); a *= 0.5; p = p * 2.1 + 1.7; } return s; }
fn mark(uv: vec2f) -> vec4f { if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) { return vec4f(0.0); } return textureSampleLevel(tex, smp, uv, 0.0); }
fn sdf(uv: vec2f) -> f32 { let c = clamp(uv, vec2f(0.0), vec2f(1.0)); return textureSampleLevel(sdfT, smp, c, 0.0).r + length((uv - c) * vec2f(1024.0, 512.0)); }
fn spectrum(t: f32) -> vec3f { return 0.5 + 0.5 * cos(6.2831853 * (t + vec3f(0.0, 0.33, 0.67))); }
fn bayer(p: vec2f) -> f32 { let x = u32(p.x) % 8u; let y = u32(p.y) % 8u; var v = 0u; let xx = x ^ y; for (var i = 0u; i < 3u; i++) { v |= ((y >> i) & 1u) << (2u * (2u - i) + 1u); v |= ((xx >> i) & 1u) << (2u * (2u - i)); } return (f32(v) + 0.5) / 64.0; }
fn face(uv: vec2f) -> vec3f { let asp = r.res.x / r.res.y; let p = (uv - 0.5) * vec2f(asp, 1.0);
  var col = r.stock.rgb * (0.985 + 0.03 * hash(floor(uv * r.res * 0.5))) + vec3f(1e-6) * (mark(vec2f(-1.0)).a + sdf(vec2f(0.5))); /* keeps both textures in every face's layout */
  let edge = smoothstep(0.0, 0.03, min(min(uv.x, 1.0 - uv.x) * asp, min(uv.y, 1.0 - uv.y))); col *= 0.95 + 0.05 * edge;
  let ang = (p.x * 0.7 + p.y * 0.4) + r.tilt.x * 0.9 + r.tilt.y * 0.5; let band = exp(-pow((ang - 0.15) * 2.4, 2.0)); let lum = dot(r.stock.rgb, vec3f(0.33));
  col += spectrum(ang * 1.4) * band * 0.06 * r.open + vec3f(select(0.04, 0.08, lum > 0.5) * band * r.open); return col; }
fn boxUV(uv: vec2f) -> vec2f { return (uv - r.box.xy) / r.box.zw; }
fn tonemap(c: vec3f) -> vec3f { return pow(max(c / (1.0 + c * 0.4) * 1.2, vec3f(0.0)), vec3f(1.0 / 1.9)); }
`;
const END = `  return vec4f(col, 1.0); }`;
const FLAT = PRE + `@fragment fn fs(o: VO) -> @location(0) vec4f { let uv = o.uv; var col = face(uv); let bu = boxUV(uv); let m = mark(bu); var keep = select(1.0, step(0.3, m.b - m.r), r.a > 1.5); if (r.a < 0.5) { keep = 0.0; } col = mix(col, select(m.rgb, vec3f(1.0), r.a > 1.5), m.a * keep);` + END;

/* ── 1 WALMART · the Spark in depth ─────────────────────────────────── */
const WM_K = `
struct U { n: u32, setIx: u32, nFixed: u32, nSets: u32, dt: f32, time: f32, ptrOn: f32, aspect: f32, ptr: vec2f, pad: vec2f };
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read_write> pos: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> vel: array<vec4f>;
@group(0) @binding(3) var<storage, read> sets: array<vec4f>;
fn curl(p: vec3f, t: f32) -> vec3f { let a = vec3f(sin(p.y * 9.0 + t) * cos(p.z * 7.0), sin(p.z * 8.0 - t * 0.7) * cos(p.x * 6.0), sin(p.x * 7.0 + t * 0.5) * cos(p.y * 9.0)); return vec3f(a.z - a.y, a.x - a.z, a.y - a.x); }
@compute @workgroup_size(256) fn main(@builtin(global_invocation_id) id: vec3u) { let i = id.x; if (i >= u.n) { return; } var p = pos[i]; var v = vel[i].xyz;
  let setOf = select(u.setIx, 0u, i < u.nFixed); let t = sets[setOf * u.n + i]; let d = t.xyz - p.xyz; let dist = length(d);
  var a = d * 260.0 - v * 32.0 + curl(p.xyz * 3.0, u.time) * min(1.0, dist * 5.0) * 1.6;
  let dp = (p.xy - u.ptr) * vec2f(u.aspect, 1.0); let dd = length(dp); if (dd < 0.12 && u.ptrOn > 0.5) { a += vec3f(dp / (dd + 1e-4) * 3.0 * (1.0 - dd / 0.12), 0.4); }
  v += a * u.dt; p = vec4f(p.xyz + v * u.dt, t.w); pos[i] = p; vel[i] = vec4f(v, 0.0); }`;
const WM_D = `
struct R { res: vec2f, size: f32, alpha: f32, yaw: f32, pitch: f32, pad: vec2f };
@group(0) @binding(0) var<uniform> r: R;
@group(0) @binding(1) var<storage, read> pos: array<vec4f>;
struct VO { @builtin(position) p: vec4f, @location(0) c: vec4f, @location(1) q: vec2f };
fn hash(n: u32) -> f32 { var x = n * 747796405u + 2891336453u; x = ((x >> ((x >> 28u) + 4u)) ^ x) * 277803737u; x = (x >> 22u) ^ x; return f32(x) / 4294967295.0; }
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO { let corner = vec2f(f32(vi & 1u), f32((vi >> 1u) & 1u)) * 2.0 - 1.0; let P = pos[ii]; let asp = r.res.x / r.res.y;
  var q = vec3f((P.x - 0.5) * asp, 0.5 - P.y, P.z); let cy = cos(r.yaw); let sy = sin(r.yaw); q = vec3f(cy * q.x + sy * q.z, q.y, -sy * q.x + cy * q.z); let cp = cos(r.pitch); let sp = sin(r.pitch); q = vec3f(q.x, cp * q.y - sp * q.z, sp * q.y + cp * q.z);
  let zc = 2.2 + q.z; let f = 2.0 / zc; let sz = r.size * f / 2.0 * (0.6 + 0.8 * hash(ii));
  var o: VO; o.p = vec4f(q.x * f / asp * 2.0 + corner.x * sz / r.res.x * 2.0, q.y * f * 2.0 + corner.y * sz / r.res.y * 2.0, 0.0, 1.0); o.q = corner;
  let depthFade = clamp(1.0 - (q.z + 0.3) * 0.8, 0.35, 1.0); let col = select(select(vec3f(1.0, 0.76, 0.13), vec3f(1.0), P.w > 1.5), vec3f(1.0, 0.92, 0.6), hash(ii + 9u) < 0.08 && P.w < 1.5); o.c = vec4f(col * depthFade, r.alpha * depthFade); return o; }
@fragment fn fs(o: VO) -> @location(0) vec4f { let d = dot(o.q, o.q); if (d > 1.0) { discard; } return vec4f(o.c.rgb, o.c.a * (1.0 - d * 0.5)); }`;
function silhouettes() { const out = []; const mk = (draw) => { const c = document.createElement('canvas'); c.width = TW; c.height = TH; const x = c.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#fff'; x.strokeStyle = '#fff'; x.lineCap = 'round'; x.lineJoin = 'round'; x.translate(TW / 2, TH / 2); draw(x); return pixels(c, () => true, 3); };
  out.push(mk((x) => { x.beginPath(); x.roundRect(-130, -110, 260, 220, 18); x.fill(); x.clearRect(-12, -110, 24, 220); }));
  out.push(mk((x) => { x.beginPath(); x.roundRect(-80, -60, 160, 200, 30); x.fill(); x.beginPath(); x.roundRect(-60, -130, 120, 70, 12); x.fill(); x.clearRect(-50, 0, 100, 60); }));
  out.push(mk((x) => { x.lineWidth = 64; x.beginPath(); x.arc(0, 0, 120, 0, TAU); x.stroke(); x.lineWidth = 14; for (let k = 0; k < 8; k++) { x.beginPath(); x.moveTo(Math.cos(k * TAU / 8) * 78, Math.sin(k * TAU / 8) * 78); x.lineTo(Math.cos(k * TAU / 8) * 22, Math.sin(k * TAU / 8) * 22); x.stroke(); } }));
  out.push(mk((x) => { x.lineWidth = 36; for (let k = 1; k <= 3; k++) { x.beginPath(); x.arc(0, 80, k * 66, Math.PI * 1.25, Math.PI * 1.75); x.stroke(); } x.beginPath(); x.arc(0, 80, 24, 0, TAU); x.fill(); }));
  out.push(mk((x) => { x.lineWidth = 28; x.beginPath(); x.moveTo(-180, -100); x.lineTo(-125, -100); x.lineTo(-85, 60); x.lineTo(125, 60); x.lineTo(158, -45); x.lineTo(-100, -45); x.stroke(); x.beginPath(); x.arc(-62, 115, 24, 0, TAU); x.arc(105, 115, 24, 0, TAU); x.fill(); }));
  return out; }

/* ── 2 AMAZON · a sled on a snow hill, its track is the arrow ───────── */
const TRW = 256, TRH = 144;
const AM_STEP = `
struct U { w: u32, h: u32, nA: u32, pad: u32, decay: f32, time: f32, pad2: vec2f, agents: array<vec4f, 4> };
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> src: array<f32>;
@group(0) @binding(2) var<storage, read_write> dst: array<f32>;
@compute @workgroup_size(16, 16) fn main(@builtin(global_invocation_id) id: vec3u) { let x = id.x; let y = id.y; if (x >= u.w || y >= u.h) { return; } let i = y * u.w + x; var v = src[i] * u.decay; let p = vec2f(f32(x) + 0.5, f32(y) + 0.5);
  for (var k = 0u; k < u.nA; k++) { let a = u.agents[k]; let d = p - a.xy; v += exp(-dot(d, d) / 5.0) * a.z; } dst[i] = min(v, 5.0); }`;
const AM_DRAW = PRE + `
@group(0) @binding(4) var<storage, read> trail: array<f32>;
fn trailAt(uv: vec2f) -> f32 { if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) { return 0.0; } let p = uv * vec2f(${TRW}.0, ${TRH}.0) - 0.5; let f = floor(p); let t = p - f; let x0 = i32(clamp(f.x, 0.0, ${TRW - 1}.0)); let y0 = i32(clamp(f.y, 0.0, ${TRH - 1}.0)); let x1 = min(x0 + 1, ${TRW - 1}); let y1 = min(y0 + 1, ${TRH - 1});
  return mix(mix(trail[u32(y0 * ${TRW} + x0)], trail[u32(y0 * ${TRW} + x1)], t.x), mix(trail[u32(y1 * ${TRW} + x0)], trail[u32(y1 * ${TRW} + x1)], t.x), t.y); }
/* the hill: a slope down toward the camera with two octaves of drift, in a 1 × 1 patch; the trail lives in the patch's uv */
fn hgt(xz: vec2f) -> f32 { return 0.42 - xz.y * 0.34 + 0.03 * (fbm(xz * 2.2) - 0.5) + 0.06 * exp(-dot(xz - vec2f(0.5, 0.15), xz - vec2f(0.5, 0.15)) * 20.0); }
fn nrm(xz: vec2f) -> vec3f { let e = 0.004; return normalize(vec3f(hgt(xz - vec2f(e, 0.0)) - hgt(xz + vec2f(e, 0.0)), 2.0 * e, hgt(xz - vec2f(0.0, e)) - hgt(xz + vec2f(0.0, e)))); }
@fragment fn fs(o: VO) -> @location(0) vec4f { let uv = o.uv; let asp = r.res.x / r.res.y; let ndc = vec2f(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0);
  let ro = vec3f(0.5 + r.tilt.x * 0.1, 0.62, 1.55); let tgt = vec3f(0.5, 0.16, 0.45); let F = normalize(tgt - ro); let Rt = normalize(cross(F, vec3f(0.0, 1.0, 0.0))); let U = cross(Rt, F); let rd = normalize(F + Rt * ndc.x * 0.42 * asp + U * ndc.y * 0.42);
  var col = mix(vec3f(0.24, 0.16, 0.24), vec3f(0.04, 0.06, 0.12), smoothstep(-0.1, 0.6, rd.y)) + vec3f(1e-6) * sdf(vec2f(0.5)); col = floor((col + (bayer(uv * r.res) - 0.5) / 24.0) * 24.0) / 24.0;
  let st = hash(floor(uv * vec2f(180.0, 100.0))); col += vec3f(0.8) * step(0.992, st) * smoothstep(0.0, 0.3, rd.y) * (0.5 + 0.5 * sin(r.time * 3.0 + st * 40.0));
  var t = 0.2; var hit = -1.0; for (var i = 0; i < 64; i++) { let p = ro + rd * t; if (p.y < hgt(p.xz)) { hit = t; break; } t += max(0.006, (p.y - hgt(p.xz)) * 0.6); if (t > 4.0) { break; } }
  var ds = 9.0;
  if (hit > 0.0) { var a = hit - 0.02; var b = hit; for (var j = 0; j < 5; j++) { let m = 0.5 * (a + b); let q = ro + rd * m; if (q.y < hgt(q.xz)) { b = m; } else { a = m; } } let p = ro + rd * b; let n = nrm(p.xz);
    let moon = normalize(vec3f(-0.4, 0.5, -0.5)); let snow = vec3f(0.86, 0.90, 1.0); let nd = max(dot(n, moon), 0.0); var sh = snow * (0.40 + 0.55 * nd) + vec3f(0.03, 0.04, 0.10); sh *= 0.8 + 0.2 * smoothstep(0.0, 0.3, p.y);
    let tuv = vec2f(p.x, 1.0 - p.z / 0.9); let tr = trailAt(tuv); let warm = mix(vec3f(0.55, 0.16, 0.0), vec3f(1.0, 0.62, 0.05), clamp(tr, 0.0, 1.0));
    sh += warm * clamp(tr, 0.0, 1.0) * 1.4 + vec3f(1.0, 0.9, 0.7) * smoothstep(1.0, 3.5, tr);
    ds = length(tuv - r.extra.xy); sh += vec3f(1.0, 0.7, 0.35) * exp(-ds * 30.0) * r.extra.z * 1.5;
    let fog = 1.0 - exp(-b * 0.35); col = mix(sh, col, fog * 0.6); col = mix(col, vec3f(1.0, 0.85, 0.6), exp(-ds * 60.0) * r.extra.z); }
  col += spectrum((uv.x * 0.7 + uv.y * 0.4) + r.tilt.x) * exp(-pow((uv.x * 0.7 + uv.y * 0.4 + r.tilt.x * 0.9 - 0.55) * 2.4, 2.0)) * 0.04 * r.open;
  let bu = boxUV(uv); let m = mark(bu); let white = step(m.r + m.g + m.b, 0.9); col = mix(col, vec3f(0.96), m.a * white); if (r.b > 1.5) { col = mix(col, vec3f(1.0, 0.60, 0.0), step(0.3, m.r - m.b) * m.a); }
` + END;

/* ── 3 APPLE · a titanium solid in a cove ────────────────────────────── */
const APPLE = PRE + `
fn body(p: vec3f) -> f32 { let uv = vec2f(p.x * 0.95 + 0.5, 0.96 - p.y * 1.9); let d2 = sdf(uv) / 1024.0 / 0.95; let w = vec2f(d2, abs(p.z) - 0.035); return min(max(w.x, w.y), 0.0) + length(max(w, vec2f(0.0))) - 0.012; }
fn map(p: vec3f) -> f32 { return min(body(p), p.y + 0.02); }
fn nrm(p: vec3f) -> vec3f { let e = vec2f(0.0012, 0.0); return normalize(vec3f(map(p + e.xyy) - map(p - e.xyy), map(p + e.yxy) - map(p - e.yxy), map(p + e.yyx) - map(p - e.yyx))); }
fn march(ro: vec3f, rd: vec3f) -> f32 { var t = 0.0; for (var i = 0; i < 90; i++) { let h = map(ro + rd * t); if (h < 0.0006) { return t; } t += h * 0.9; if (t > 6.0) { break; } } return -1.0; }
fn shadow(ro: vec3f, rd: vec3f) -> f32 { var s = 1.0; var t = 0.01; for (var i = 0; i < 32; i++) { let h = body(ro + rd * t); s = min(s, 10.0 * h / t); if (s < 0.01) { return 0.0; } t += clamp(h, 0.005, 0.06); if (t > 2.0) { break; } } return clamp(s, 0.0, 1.0); }
fn ao(p: vec3f, n: vec3f) -> f32 { var occ = 0.0; var sca = 1.0; for (var i = 0; i < 5; i++) { let h = 0.01 + 0.05 * f32(i); occ += (h - map(p + n * h)) * sca; sca *= 0.75; } return clamp(1.0 - 3.0 * occ, 0.0, 1.0); }
fn shade(p: vec3f, n: vec3f, rd: vec3f, key: vec3f, isBody: bool) -> vec3f { let sh = shadow(p + n * 0.003, key); let occ = ao(p, n); let nd = max(dot(n, key), 0.0); let hv = normalize(key - rd);
  let tan = normalize(cross(n, vec3f(0.0, 0.0, 1.0)) + 1e-4); let th = dot(tan, hv); let ph = pow(max(1.0 - th * th, 0.0), 12.0) * pow(max(dot(n, hv), 0.0), 8.0);
  let fr = pow(1.0 - max(dot(n, -rd), 0.0), 4.0); let hemi = mix(vec3f(0.02), vec3f(0.12, 0.12, 0.13), 0.5 + 0.5 * n.y);
  if (isBody) { return vec3f(0.42, 0.42, 0.44) * (vec3f(1.0, 0.97, 0.93) * nd * sh * 1.4 + hemi * 1.5) * occ + vec3f(ph * 1.6 * sh) + vec3f(0.18) * fr * occ; }
  return vec3f(0.16) * (vec3f(1.0, 0.97, 0.93) * nd * sh * 1.2 + hemi) * occ; }
@fragment fn fs(o: VO) -> @location(0) vec4f { let uv = o.uv; var col = face(uv);
  let ang = -0.42 + 0.36 * (0.5 - 0.5 * cos(r.phase * 6.2831853)); let ro = vec3f(sin(ang) * 1.25, 0.34, cos(ang) * 1.25); let tgt = vec3f(0.0, 0.24, 0.0);
  let F = normalize(tgt - ro); let Rt = normalize(cross(F, vec3f(0.0, 1.0, 0.0))); let U = cross(Rt, F); let asp = r.res.x / r.res.y; let ndc = vec2f(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0);
  let rd = normalize(F + Rt * ndc.x * 0.38 * asp + U * ndc.y * 0.38); let key = normalize(vec3f(-0.7 + r.tilt.x * 1.4, 0.9, 0.8 + r.tilt.y));
  let t = march(ro, rd);
  if (t > 0.0) { let p = ro + rd * t; let n = nrm(p); let isBody = body(p) < 0.0015; var c = shade(p, n, rd, key, isBody);
    if (!isBody) { let rr = reflect(rd, n); let t2 = march(p + n * 0.002, rr); if (t2 > 0.0) { let p2 = p + n * 0.002 + rr * t2; if (body(p2) < 0.0015) { c = mix(c, shade(p2, nrm(p2), rr, key, true), 0.45 * exp(-t2 * 1.5)); } }
      c = mix(c, r.stock.rgb, smoothstep(0.45, 1.3, length(p.xz))); }
    col = tonemap(c); }
` + END;

/* ── 4 UNITEDHEALTH · a tangle that combs itself straight ───────────── */
const TM = 56, TP = 18;
const TH_K = `
struct U { m: u32, p: u32, pad0: u32, pad1: u32, front: f32, time: f32, aspect: f32, pad2: f32 };
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read_write> pts: array<vec4f>;
fn hash(n: u32) -> f32 { var x = n * 747796405u + 2891336453u; x = ((x >> ((x >> 28u) + 4u)) ^ x) * 277803737u; x = (x >> 22u) ^ x; return f32(x) / 4294967295.0; }
@compute @workgroup_size(256) fn main(@builtin(global_invocation_id) id: vec3u) { let i = id.x; if (i >= u.m * u.p) { return; } let th = i / u.p; let j = i % u.p; let fj = f32(j) / f32(u.p - 1u); let ft = f32(th) / f32(u.m);
  /* straight: a row of parallel lines; tangled: the same lines thrown into knots by layered sines */
  let sx = 0.04 + fj * 0.92; let sy = 0.09 + ft * 0.40; let h1 = hash(th); let h2 = hash(th + 7u);
  let tx = sx + 0.10 * sin(fj * 9.0 + h1 * 6.28 + u.time * 0.3) * sin(fj * 3.1 + h2 * 4.0); let ty = sy + 0.12 * sin(fj * 7.0 + h2 * 6.28 - u.time * 0.25) * cos(fj * 2.3 + h1 * 5.0) + 0.05 * sin(fj * 15.0 + h1 * 9.0); let tz = 0.28 * sin(fj * 6.0 + h1 * 6.28 + u.time * 0.2) * sin(fj * 2.0 + h2 * 3.0);
  /* the comb moves left to right, and each thread straightens a little after its neighbour */
  let k = smoothstep(fj - 0.28, fj + 0.02, u.front + (h1 - 0.5) * 0.06);
  pts[i] = vec4f(mix(tx, sx, k), mix(ty, sy, k), mix(tz, 0.0, k), k); }`;
const TH_D = `
struct R { res: vec2f, time: f32, pad: f32, ink: vec4f, light: vec4f };
@group(0) @binding(0) var<uniform> r: R;
@group(0) @binding(1) var<storage, read> pts: array<vec4f>;
struct VO { @builtin(position) p: vec4f, @location(0) c: vec4f, @location(1) q: f32 };
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO { let th = ii / ${TP - 1}u; let j = ii % ${TP - 1}u; let a = pts[th * ${TP}u + j]; let b = pts[th * ${TP}u + j + 1u]; let asp = r.res.x / r.res.y;
  let end = f32((vi >> 1u) & 1u); let side = f32(vi & 1u) * 2.0 - 1.0; let P = mix(a, b, end);
  let w = vec3f((P.x - 0.5) * asp, 0.5 - P.y, P.z); let zc = 1.9 + w.z; let f = 1.9 / zc; let sx = w.x * f / asp * 2.0; let sy = w.y * f * 2.0;
  let da = vec2f((b.x - a.x) * asp, -(b.y - a.y)); let nrm = normalize(vec2f(-da.y, da.x) + 1e-5); let thick = 0.0018 * f * (1.0 + 0.5 * P.w);
  var o: VO; o.p = vec4f(sx + nrm.x * side * thick * 2.0 / asp, sy + nrm.y * side * thick * 2.0, 0.0, 1.0); o.q = side;
  let depth = clamp(1.0 - (w.z + 0.3) * 1.0, 0.45, 1.0); let straight = mix(vec3f(0.0, 0.15, 0.47), vec3f(0.0, 0.45, 0.85), P.w); let tangled = vec3f(0.10, 0.28, 0.60);
  o.c = vec4f(mix(tangled, straight, P.w) * depth + vec3f(0.06) * (1.0 - depth), 0.9 - 0.3 * (1.0 - depth)); return o; }
@fragment fn fs(o: VO) -> @location(0) vec4f { let e = 1.0 - o.q * o.q; return vec4f(o.c.rgb + vec3f(0.12) * e, o.c.a * smoothstep(0.0, 0.3, e)); }`;

/* ── 5 BERKSHIRE · sixty years, compounding, in gold ─────────────────── */
const BC = 240;
const BK_D = `
struct R { res: vec2f, time: f32, reveal: f32, light: vec4f, gold: vec4f, tilt: vec4f };
@group(0) @binding(0) var<uniform> r: R;
struct VO { @builtin(position) p: vec4f, @location(0) c: vec3f, @location(1) q: vec2f };
fn hash(n: u32) -> f32 { var x = n * 747796405u + 2891336453u; x = ((x >> ((x >> 28u) + 4u)) ^ x) * 277803737u; x = (x >> 22u) ^ x; return f32(x) / 4294967295.0; }
fn height(i: u32) -> f32 { let t = f32(i) / ${BC - 1}.0; var h = 0.02 + 0.46 * pow(t, 2.6); h *= 1.0 + 0.10 * (hash(i) - 0.5) + 0.05 * sin(t * 40.0 + hash(i + 3u)); h *= select(1.0, 0.86, t > 0.62 && t < 0.66); h *= select(1.0, 0.80, t > 0.80 && t < 0.83); return h; }
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO { let col = ii / 3u; let face = ii % 3u; let corner = vec2f(f32(vi & 1u), f32((vi >> 1u) & 1u)); let asp = r.res.x / r.res.y;
  let t = f32(col) / ${BC - 1}.0; let grown = smoothstep(t, t + 0.02, r.reveal); let h = height(col) * grown; let x0 = 0.05 + t * 0.90; let w = 0.90 / ${BC}.0; let base = 0.60; let d = 0.05 + r.tilt.y * 0.02;
  /* three faces of a bar: front, top, side, in a slight isometric lean */
  var pos: vec2f; var shade: f32;
  if (face == 0u) { pos = vec2f(x0 + corner.x * w, base - corner.y * h); shade = 1.0; }
  else if (face == 1u) { pos = vec2f(x0 + corner.x * w + corner.y * d * 0.6, base - h - corner.y * d); shade = 1.35; }
  else { pos = vec2f(x0 + w + corner.y * d * 0.6, base - corner.x * h - corner.y * d); shade = 0.62; }
  var o: VO; o.p = vec4f(pos.x * 2.0 - 1.0, 1.0 - pos.y * 2.0, 0.0, 1.0); o.q = corner;
  /* gold under a key that rakes across the chart */
  let L = normalize(r.light.xyz); let n = select(select(vec3f(0.0, 0.0, 1.0), vec3f(0.0, -1.0, 0.3), face == 1u), vec3f(1.0, 0.0, 0.2), face == 2u); let nd = 0.45 + 0.55 * max(dot(normalize(n), L), 0.0);
  let band = exp(-pow((t - fract(r.time * 0.06) * 1.3 + 0.15) * 6.0, 2.0)); var c = r.gold.rgb * nd * shade + vec3f(1.0, 0.95, 0.8) * band * 0.35 * shade;
  c = mix(c, r.gold.rgb * 0.55, smoothstep(0.0, 1.0, corner.y) * 0.35 * f32(face == 0u)); o.c = c * step(0.002, h); return o; }
@fragment fn fs(o: VO) -> @location(0) vec4f { return vec4f(o.c, 1.0); }`;
const BK_BG = PRE + `
@fragment fn fs(o: VO) -> @location(0) vec4f { let uv = o.uv; var col = face(uv); let asp = r.res.x / r.res.y;
  /* the ledger: a baseline, faint decade rules, the wordmark set above the chart */
  let base = smoothstep(0.003, 0.0, abs(uv.y - 0.602)); col = mix(col, vec3f(0.35, 0.30, 0.22), base * 0.6);
  for (var k = 0; k < 7; k++) { let x = 0.05 + f32(k) / 6.0 * 0.90; col = mix(col, vec3f(0.35, 0.30, 0.22), smoothstep(0.0015, 0.0, abs(uv.x - x)) * step(0.12, uv.y) * step(uv.y, 0.60) * 0.18); }
  let bu = boxUV(uv); let m = mark(bu); col = mix(col, vec3f(0.18, 0.16, 0.14), m.a);
` + END;

/* ── 6 CVS · the heart pumps ─────────────────────────────────────────── */
const CW = 224, CH = 160, C_ITERS = 22;
const CV_COMMON = `
struct U { w: u32, h: u32, pad0: u32, pad1: u32, dt: f32, sys: f32, time: f32, ptrOn: f32, ptr: vec2f, force: vec2f, box: vec4f };
@group(0) @binding(0) var<uniform> u: U;
fn idx(x: i32, y: i32) -> u32 { return u32(clamp(y, 0, i32(u.h) - 1)) * u.w + u32(clamp(x, 0, i32(u.w) - 1)); }`;
const CV_ADVECT = CV_COMMON + `
@group(0) @binding(1) var<storage, read> vel: array<vec2f>;
@group(0) @binding(2) var<storage, read_write> velOut: array<vec2f>;
@group(0) @binding(3) var<storage, read> dye: array<vec4f>;
@group(0) @binding(6) var<storage, read_write> dyeOut: array<vec4f>;
@group(0) @binding(4) var sdfT: texture_2d<f32>;
@group(0) @binding(5) var smp: sampler;
fn heartD(p: vec2f) -> f32 { let uv = vec2f(p.x / f32(u.w), p.y / f32(u.h)); let bu = (uv - u.box.xy) / u.box.zw; if (bu.x < 0.0 || bu.x > 0.31 || bu.y < 0.0 || bu.y > 1.0) { return 999.0; } return textureSampleLevel(sdfT, smp, bu, 0.0).r; }
fn sV(p: vec2f) -> vec2f { let x = i32(floor(p.x)); let y = i32(floor(p.y)); let f = fract(p); return mix(mix(vel[idx(x, y)], vel[idx(x + 1, y)], f.x), mix(vel[idx(x, y + 1)], vel[idx(x + 1, y + 1)], f.x), f.y); }
fn sD(p: vec2f) -> vec4f { let x = i32(floor(p.x)); let y = i32(floor(p.y)); let f = fract(p); return mix(mix(dye[idx(x, y)], dye[idx(x + 1, y)], f.x), mix(dye[idx(x, y + 1)], dye[idx(x + 1, y + 1)], f.x), f.y); }
fn curlW(x: i32, y: i32) -> f32 { return (vel[idx(x + 1, y)].y - vel[idx(x - 1, y)].y) - (vel[idx(x, y + 1)].x - vel[idx(x, y - 1)].x); }
@compute @workgroup_size(16, 16) fn main(@builtin(global_invocation_id) id: vec3u) { let x = i32(id.x); let y = i32(id.y); if (x >= i32(u.w) || y >= i32(u.h)) { return; } let p = vec2f(f32(x), f32(y)); let v = vel[idx(x, y)];
  var nv = sV(p - v * u.dt) * 0.996; var nd = sD(p - v * u.dt) * 0.993;
  let w = curlW(x, y); let gw = vec2f(abs(curlW(x + 1, y)) - abs(curlW(x - 1, y)), abs(curlW(x, y + 1)) - abs(curlW(x, y - 1))); let gl = length(gw) + 1e-5; nv += vec2f(gw.y, -gw.x) / gl * w * 0.22 * u.dt;
  let d = heartD(p + 0.5); if (abs(d) < 12.0) { let e = 1.0; let g = normalize(vec2f(heartD(p + vec2f(e, 0.5)) - heartD(p + vec2f(-e, 0.5)), heartD(p + vec2f(0.5, e)) - heartD(p + vec2f(0.5, -e))) + 1e-4); let wgt = exp(-d * d / 30.0); nv += g * u.sys * 26.0 * wgt * u.dt; nd += vec4f(0.80, 0.0, 0.05, 1.0) * u.sys * wgt * u.dt * 3.0; }
  let off = max(0.0, -sin(u.time * 6.2831853)); let s1 = vec2f(f32(u.w) * 0.94, f32(u.h) * 0.22); let s2 = vec2f(f32(u.w) * 0.08, f32(u.h) * 0.62); let d1 = p - s1; let d2 = p - s2;
  nd += vec4f(0.98, 0.50, 0.60, 1.0) * (exp(-dot(d1, d1) / 26.0) + exp(-dot(d2, d2) / 26.0)) * off * u.dt * 2.0; nv += (vec2f(-1.0, 0.3) * exp(-dot(d1, d1) / 26.0) + vec2f(1.0, -0.5) * exp(-dot(d2, d2) / 26.0)) * off * 9.0 * u.dt;
  if (u.ptrOn > 0.5) { let dp = p - u.ptr; nv += u.force * exp(-dot(dp, dp) / 40.0); }
  if (x == 0 || y == 0 || x == i32(u.w) - 1 || y == i32(u.h) - 1) { nv = vec2f(0.0); }
  velOut[idx(x, y)] = nv; dyeOut[idx(x, y)] = min(nd, vec4f(1.6)); }`;
const CV_DIV = CV_COMMON + `
@group(0) @binding(1) var<storage, read> vel: array<vec2f>;
@group(0) @binding(2) var<storage, read_write> div: array<f32>;
@group(0) @binding(3) var<storage, read_write> pres: array<f32>;
@compute @workgroup_size(16, 16) fn main(@builtin(global_invocation_id) id: vec3u) { let x = i32(id.x); let y = i32(id.y); if (x >= i32(u.w) || y >= i32(u.h)) { return; } div[idx(x, y)] = 0.5 * (vel[idx(x + 1, y)].x - vel[idx(x - 1, y)].x + vel[idx(x, y + 1)].y - vel[idx(x, y - 1)].y); pres[idx(x, y)] = 0.0; }`;
const CV_JAC = CV_COMMON + `
@group(0) @binding(1) var<storage, read> div: array<f32>;
@group(0) @binding(2) var<storage, read> p0: array<f32>;
@group(0) @binding(3) var<storage, read_write> p1: array<f32>;
@compute @workgroup_size(16, 16) fn main(@builtin(global_invocation_id) id: vec3u) { let x = i32(id.x); let y = i32(id.y); if (x >= i32(u.w) || y >= i32(u.h)) { return; } p1[idx(x, y)] = (p0[idx(x - 1, y)] + p0[idx(x + 1, y)] + p0[idx(x, y - 1)] + p0[idx(x, y + 1)] - div[idx(x, y)]) * 0.25; }`;
const CV_PROJ = CV_COMMON + `
@group(0) @binding(1) var<storage, read> pres: array<f32>;
@group(0) @binding(2) var<storage, read_write> vel: array<vec2f>;
@compute @workgroup_size(16, 16) fn main(@builtin(global_invocation_id) id: vec3u) { let x = i32(id.x); let y = i32(id.y); if (x >= i32(u.w) || y >= i32(u.h)) { return; } vel[idx(x, y)] -= 0.5 * vec2f(pres[idx(x + 1, y)] - pres[idx(x - 1, y)], pres[idx(x, y + 1)] - pres[idx(x, y - 1)]); }`;
const CV_DRAW = PRE + `
@group(0) @binding(4) var<storage, read> dye: array<vec4f>;
fn D(p: vec2f) -> vec4f { let x = i32(floor(p.x)); let y = i32(floor(p.y)); let f = fract(p); let i = u32(clamp(y, 0, ${CH - 1})) * ${CW}u; let i2 = u32(clamp(y + 1, 0, ${CH - 1})) * ${CW}u; let x0 = u32(clamp(x, 0, ${CW - 1})); let x1 = u32(clamp(x + 1, 0, ${CW - 1})); return mix(mix(dye[i + x0], dye[i + x1], f.x), mix(dye[i2 + x0], dye[i2 + x1], f.x), f.y); }
@fragment fn fs(o: VO) -> @location(0) vec4f { let uv = o.uv; var col = face(uv); let g = vec2f(uv.x * ${CW}.0 - 0.5, uv.y * ${CH}.0 - 0.5); let d = D(g);
  var bl = vec4f(0.0); for (var k = 0; k < 5; k++) { let a = f32(k) * 1.2566; bl += D(g + vec2f(cos(a), sin(a)) * 6.0); } bl /= 5.0;
  let amt = clamp(d.a, 0.0, 1.0); let c = d.rgb / max(d.a, 1e-3); col = mix(col, c, amt * 0.95); col = mix(col, bl.rgb / max(bl.a, 1e-3), clamp(bl.a, 0.0, 1.0) * 0.25 * (1.0 - amt));
  let bu = boxUV(uv); let m = mark(bu); let dark = step(m.r + m.g + m.b, 0.9); let red = step(0.35, m.r - m.g); col = mix(col, vec3f(0.80, 0.0, 0.05), m.a * red); col = mix(col, m.rgb, m.a * dark);
` + END;

/* ── 7 EXXON · molecules captured into a lattice ────────────────────── */
const EX_M = 2600;
const EX_K = `
struct U { n: u32, pad0: u32, pad1: u32, pad2: u32, dt: f32, time: f32, front: f32, aspect: f32, ptr: vec2f, ptrOn: f32, pad3: f32 };
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read_write> pos: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> vel: array<vec4f>;
@group(0) @binding(3) var<storage, read> home: array<vec4f>;
fn hash(n: u32) -> f32 { var x = n * 747796405u + 2891336453u; x = ((x >> ((x >> 28u) + 4u)) ^ x) * 277803737u; x = (x >> 22u) ^ x; return f32(x) / 4294967295.0; }
fn curl(p: vec3f, t: f32) -> vec3f { let a = vec3f(sin(p.y * 5.0 + t * 0.6) * cos(p.z * 4.0), sin(p.z * 4.5 - t * 0.5) * cos(p.x * 3.5), sin(p.x * 4.0 + t * 0.4) * cos(p.y * 5.0)); return vec3f(a.z - a.y, a.x - a.z, a.y - a.x); }
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) id: vec3u) { let i = id.x; if (i >= u.n) { return; } var p = pos[i]; var v = vel[i]; let h = home[i];
  let cap = smoothstep(h.w - 0.04, h.w + 0.04, u.front);
  var a = curl(p.xyz, u.time) * 0.35 * (1.0 - cap) + (h.xyz - p.xyz) * 60.0 * cap - v.xyz * mix(0.6, 12.0, cap);
  let boxc = clamp(p.xyz, vec3f(0.05, 0.04, -0.35), vec3f(0.95, 0.52, 0.35)); a += (boxc - p.xyz) * 6.0 * (1.0 - cap); /* a wide drift volume, not a point */
  let dp = (p.xy - u.ptr) * vec2f(u.aspect, 1.0); let dd = length(dp); if (dd < 0.14 && u.ptrOn > 0.5) { a += vec3f(dp / (dd + 1e-4) * 2.0 * (1.0 - dd / 0.14), 0.0); }
  v = vec4f(v.xyz + a * u.dt, v.w + u.dt * (1.0 - cap) * (0.5 + hash(i))); p = vec4f(p.xyz + v.xyz * u.dt, cap); pos[i] = p; vel[i] = v; }`;
const EX_D = `
struct R { res: vec2f, time: f32, pad: f32, light: vec4f, red: vec4f, blue: vec4f };
@group(0) @binding(0) var<uniform> r: R;
@group(0) @binding(1) var<storage, read> pos: array<vec4f>;
@group(0) @binding(2) var<storage, read> vel: array<vec4f>;
struct VO { @builtin(position) p: vec4f, @location(0) c: vec4f, @location(1) q: vec2f, @location(2) rad: f32, @location(3) z: f32 };
struct FO { @location(0) c: vec4f, @builtin(frag_depth) d: f32 };
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO { let m = ii / 3u; let atom = ii % 3u; let corner = vec2f(f32(vi & 1u), f32((vi >> 1u) & 1u)) * 2.0 - 1.0; let P = pos[m]; let spin = vel[m].w; let asp = r.res.x / r.res.y;
  let ax0 = normalize(vec3f(cos(spin), sin(spin * 0.7), sin(spin))); let ax = normalize(mix(ax0, vec3f(1.0, 0.0, 0.0), P.w)); let off = select(vec3f(0.0), ax * 0.017 * select(-1.0, 1.0, atom == 2u), atom != 0u);
  let world = vec3f((P.x - 0.5) * asp, 0.5 - P.y, P.z) + off; let zc = 1.6 + world.z; let f = 1.7 / zc; let rad = select(0.013, 0.010, atom != 0u) * f;
  var o: VO; o.p = vec4f(world.x * f / asp * 2.0 + corner.x * rad * 2.0 / asp, world.y * f * 2.0 + corner.y * rad * 2.0, 0.0, 1.0); o.q = corner; o.rad = rad; o.z = zc;
  let cC = mix(vec3f(0.22, 0.22, 0.24), r.blue.rgb, P.w); let cO = mix(r.red.rgb, mix(r.blue.rgb, vec3f(0.6, 0.75, 1.0), 0.5), P.w); o.c = vec4f(select(cC, cO, atom != 0u), P.w); return o; }
@fragment fn fs(o: VO) -> FO { let d2 = dot(o.q, o.q); if (d2 > 1.0) { discard; } let nz = sqrt(1.0 - d2); let n = vec3f(o.q.x, o.q.y, nz); let L = normalize(r.light.xyz);
  let nd = 0.25 + 0.75 * max(dot(n, L), 0.0); let spec = pow(max(dot(n, normalize(L + vec3f(0.0, 0.0, 1.0))), 0.0), 50.0); let rim = pow(1.0 - nz, 3.0);
  var c = o.c.rgb * nd + vec3f(spec) * 0.7 + r.blue.rgb * rim * o.c.a * 0.8; let fog = clamp((o.z - 1.2) * 0.9, 0.0, 0.7); c = mix(c, vec3f(0.80, 0.83, 0.87), fog);
  var out: FO; out.c = vec4f(c, 1.0); out.d = clamp((o.z - nz * o.rad) / 4.0, 0.0, 1.0); return out; }`;
const EX_BG = PRE + `
@fragment fn fs(o: VO) -> @location(0) vec4f { let uv = o.uv; var col = face(uv); let asp = r.res.x / r.res.y;
  col *= 0.92 + 0.10 * smoothstep(0.9, 0.0, length((uv - vec2f(0.5, 0.36)) * vec2f(asp, 1.0)));
  let frame = step(abs(min(min(uv.x, 1.0 - uv.x) * asp, min(uv.y, 1.0 - uv.y)) - 0.045), 0.002); col = mix(col, vec3f(0.45, 0.48, 0.52), frame * 0.7);
  let bu = boxUV(uv); let m = mark(bu); col = mix(col, m.rgb, m.a * r.a);
` + END;

/* ── 8 ALPHABET · a glass wordmark ───────────────────────────────────── */
const ALPHA = PRE + `
fn body(p: vec3f) -> f32 { let asp = r.res.x / r.res.y; let uv = vec2f(p.x / asp + 0.5, 0.5 - p.y); let bu = boxUV(uv); let d2 = sdf(bu) / 1024.0 * r.box.z * asp; let w = vec2f(d2, abs(p.z) - 0.06); return min(max(w.x, w.y), 0.0) + length(max(w, vec2f(0.0))) - 0.008; }
fn nrm(p: vec3f) -> vec3f { let e = vec2f(0.0015, 0.0); return normalize(vec3f(body(p + e.xyy) - body(p - e.xyy), body(p + e.yxy) - body(p - e.yxy), body(p + e.yyx) - body(p - e.yyx))); }
fn env(d: vec3f) -> vec3f { let dd = normalize(vec3f(d.x + r.tilt.x * 0.8, d.y + r.tilt.y * 0.8, d.z)); var c = mix(vec3f(0.30, 0.32, 0.36), vec3f(1.0), smoothstep(-0.35, 0.55, dd.y));
  c += vec3f(1.0, 0.85, 0.5) * pow(max(dot(dd, normalize(vec3f(0.7, 0.3, 0.5))), 0.0), 12.0) * 0.6 + vec3f(0.5, 0.75, 1.0) * pow(max(dot(dd, normalize(vec3f(-0.7, 0.2, 0.4))), 0.0), 12.0) * 0.6;
  c += vec3f(0.06) * step(0.9, abs(fract(dd.x * 3.0 + r.time * 0.02) - 0.5) * 2.0); return c; }
fn refr(I: vec3f, N: vec3f, eta: f32) -> vec3f { let k = 1.0 - eta * eta * (1.0 - dot(N, I) * dot(N, I)); if (k < 0.0) { return reflect(I, N); } return eta * I - (eta * dot(N, I) + sqrt(k)) * N; }
fn through(ro: vec3f, rd: vec3f, eta: f32) -> f32 { let rin = refr(rd, nrm(ro), eta); var t = 0.004; var p = ro; for (var i = 0; i < 40; i++) { p = ro + rin * t; let h = -body(p); if (h < 0.001) { break; } t += max(h * 0.8, 0.002); if (t > 1.0) { break; } }
  let n2 = -nrm(p); let rout = refr(rin, n2, 1.0 / eta); return dot(env(rout), vec3f(0.333)); }
@fragment fn fs(o: VO) -> @location(0) vec4f { let uv = o.uv; var col = face(uv); let asp = r.res.x / r.res.y; let ndc = vec2f(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0);
  let ro = vec3f(ndc.x * asp * 0.5 + r.tilt.x * 0.12, ndc.y * 0.5 + r.tilt.y * 0.08, 1.0); let rd = normalize(vec3f(-r.tilt.x * 0.12, -r.tilt.y * 0.08, -1.0));
  var t = 0.0; var hit = -1.0; for (var i = 0; i < 64; i++) { let h = body(ro + rd * t); if (h < 0.0008) { hit = t; break; } t += h * 0.9; if (t > 3.0) { break; } }
  if (hit > 0.0) { let p = ro + rd * hit; let n = nrm(p); let fr = 0.04 + 0.96 * pow(1.0 - max(dot(n, -rd), 0.0), 5.0);
    let tr = vec3f(through(p, rd, 1.0 / 1.50), through(p, rd, 1.0 / 1.53), through(p, rd, 1.0 / 1.57));
    let refl = env(reflect(rd, n)); var glass = mix(tr * vec3f(1.0, 0.98, 1.02), refl, fr); glass *= vec3f(0.94, 0.96, 1.0);
    let edge = pow(1.0 - abs(n.z), 2.0); glass += spectrum(edge * 1.5 + r.tilt.x * 2.0 + p.x) * edge * 0.25;
    col = tonemap(glass * 1.1); }
  else { let bu = boxUV(uv + vec2f(0.012 + r.tilt.x * 0.03, 0.025 + r.tilt.y * 0.03)); let d = sdf(bu); let inside = smoothstep(6.0, -2.0, d); col = mix(col, col * (0.86 + 0.14 * spectrum(uv.x * 2.0 + r.tilt.x * 3.0)), inside * 0.9); }
` + END;

const posterT = { walmart: 1.2, amazon: 7.5, apple: 8.4, unitedhealth: 5.4, berkshire: 0, cvs: 0, exxon: 6.5, alphabet: 0 };
const posterTilt = { walmart: [0, 0], amazon: [0, 0], apple: [0.1, 0.05], unitedhealth: [0, 0], berkshire: [0, 0], cvs: [0, 0], exxon: [0, 0], alphabet: [0.32, 0.12] };

/* ── the wallet ───────────────────────────────────────────────────────── */
export function walletCards() {
  const wallet = $('wl-card'), phone = $('wl-phone'), stack = $('wl-stack'), detail = $('wl-detail'); let open = -1, lastTouch = 0, openedAt = 0;
  const els = CARDS.map((c) => $('wl-' + c.id));
  const layout = () => { const H = stack.clientHeight, cardH = els[0].offsetHeight, step = Math.min(44, (H - cardH - 12) / (CARDS.length - 1));
    els.forEach((el, i) => { if (open < 0) { el.style.transform = `translateY(${i * step}px)`; el.style.zIndex = i + 1; el.classList.remove('wl-on', 'wl-peek'); }
      else if (i === open) { el.style.transform = 'translateY(0px)'; el.style.zIndex = 20; el.classList.add('wl-on'); el.classList.remove('wl-peek'); }
      else { const j = i < open ? i : i - 1; el.style.transform = `translateY(${H - 46 + j * 5}px) scale(${1 - (CARDS.length - 2 - j) * 0.012})`; el.style.zIndex = 8 - j; el.classList.add('wl-peek'); el.classList.remove('wl-on'); } });
    detail.hidden = open < 0; if (open >= 0) { const c = CARDS[open]; detail.style.top = (cardH + 18) + 'px'; $('wl-d-name').textContent = c.name; $('wl-d-title').textContent = c.title; $('wl-d-mail').textContent = c.l1; $('wl-d-tel').textContent = c.l2; $('wl-d-site').textContent = c.l2.split(' · ')[0]; }
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
    const el = els[ci], stage = $('wl-' + c.id + '-stage'), canvas = $('wl-' + c.id + '-canvas'); let s = null, ptr = [-9, -9], on = 0, tilt = [0, 0], last = null, force = [0, 0];
    pointer(stage, (p) => { ptr = [p.x, p.y]; on = 1; if (last) force = [(p.x - last[0]) * 60, (p.y - last[1]) * 60]; last = [p.x, p.y]; }, () => { on = 0; last = null; });
    const isOpen = () => open === ci;
    return card({ name: 'wallet-' + c.id, el, init() {
      const dev = this.__dev, { ctx, fit } = attach(canvas); const img = new Image(); img.src = '../assets/marks/' + c.id + '.svg';
      const ru = uniform(112), smp = dev.createSampler({ magFilter: 'linear', minFilter: 'linear' });
      s = { ctx, fit, ru, smp, ready: false };
      img.decode().then(async () => { const rc = raster(img); const mt = markTextures(dev, rc); await mt.upload(); s.mt = mt;
        const faceBind = (pipe, extra = []) => dev.createBindGroup({ layout: pipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: ru } }, { binding: 1, resource: mt.tex.createView() }, { binding: 2, resource: smp }, { binding: 3, resource: mt.sdf.createView() }, ...extra] });
        const box = { walmart: [0.07, 0.09, 0.50, 0.18], amazon: [0.07, 0.08, 0.46, 0.16], apple: [0, 0, 1, 1], unitedhealth: [0.05, 0.53, 0.70, 0.08], berkshire: [0.05, 0.05, 0.60, 0.09], cvs: [0.07, 0.10, 0.86, 0.26], exxon: [0.14, 0.16, 0.72, 0.22], alphabet: [0.10, 0.18, 0.80, 0.26] }[c.id]; s.box = box;
        if (c.id === 'walmart') { const nW = 9000, nS = 21000, n = nW + nS, word = pixels(rc, (r, g, b) => b > 100 && r < 120, 1), spark = pixels(rc, (r, g, b) => r > 200 && b < 120, 1), depts = silhouettes(), nSets = 6, all = new Float32Array(n * 4 * nSets);
          const wb = box, sb = [0.50, 0.10, 0.42, 0.50]; const bb = spark.reduce((a, p) => [Math.min(a[0], p[0]), Math.min(a[1], p[1]), Math.max(a[2], p[0]), Math.max(a[3], p[1])], [9, 9, -9, -9]); const bw = bb[2] - bb[0], bh = bb[3] - bb[1], bsz = Math.max(bw, bh);
          for (let si = 0; si < nSets; si++) { const pts = si === 0 ? spark : depts[si - 1]; for (let k = 0; k < n; k++) { const o = (si * n + k) * 4; if (k < nW) { const p = word[Math.floor(hash2(k, 5) * word.length)]; all[o] = wb[0] + p[0] * wb[2]; all[o + 1] = wb[1] + p[1] * wb[3]; all[o + 2] = (hash2(k, 7) - 0.5) * 0.02; all[o + 3] = 2; }
            else { const p = pts[Math.floor(hash2(k, 5 + si * 7) * pts.length)]; const cx = si === 0 ? 0.5 + (p[0] - bb[0] - bw / 2) / bsz : p[0], cy = si === 0 ? 0.5 + (p[1] - bb[1] - bh / 2) / bsz : p[1]; all[o] = sb[0] + cx * sb[2]; all[o + 1] = sb[1] + cy * sb[3]; all[o + 2] = (hash2(k, 9 + si) - 0.5) * 0.12; all[o + 3] = 0; } } }
          const setsB = storage(all.byteLength), pos = storage(n * 16), vel = storage(n * 16), u = uniform(48), pr = uniform(32); dev.queue.writeBuffer(setsB, 0, all); dev.queue.writeBuffer(pos, 0, all.subarray(0, n * 4));
          const pk = compute(WM_K), pd = render(WM_D, { blend: true }), pf = render(FLAT); s.pt = { n, nW, nSets, u, pr, pk, pd, gk: bind(pk, [u, pos, vel, setsB]), gd: bind(pd, [pr, pos]), gf: faceBind(pf), pf }; }
        else if (c.id === 'amazon') { const orange = pixels(rc, (r, g, b) => r > 200 && g > 100 && b < 80, 1); const cols = new Map(); orange.forEach(([x, y]) => { const k = Math.round(x * 300); if (!cols.has(k)) cols.set(k, []); cols.get(k).push(y); });
          const path = [...cols.keys()].sort((a, b) => a - b).map((k) => { const ys = cols.get(k); return [k / 300, ys.reduce((a, b) => a + b, 0) / ys.length]; });
          const bufs = [storage(TRW * TRH * 4), storage(TRW * TRH * 4)], u = uniform(96), st = compute(AM_STEP), pd = render(AM_DRAW);
          s.am = { path, bufs, u, st, gs: [bind(st, [u, bufs[0], bufs[1]]), bind(st, [u, bufs[1], bufs[0]])], gd: [faceBind(pd, [{ binding: 4, resource: { buffer: bufs[1] } }]), faceBind(pd, [{ binding: 4, resource: { buffer: bufs[0] } }])], pd, cur: 0 }; }
        else if (c.id === 'unitedhealth') { const pts = storage(TM * TP * 16), u = uniform(32), pr = uniform(48), pk = compute(TH_K), pd = render(TH_D, { blend: true }), pf = render(FLAT); s.uh = { u, pr, pk, pd, gk: bind(pk, [u, pts]), gd: bind(pd, [pr, pts]), gf: faceBind(pf), pf }; $('wl-uh-count').textContent = TM.toLocaleString(); }
        else if (c.id === 'berkshire') { const pr = uniform(64), pd = render(BK_D), pb = render(BK_BG); s.bk = { pr, pd, pb, gd: bind(pd, [pr]), gb: faceBind(pb) }; }
        else if (c.id === 'cvs') { const Nc = CW * CH; const vel = [storage(Nc * 8), storage(Nc * 8)], dye = [storage(Nc * 16), storage(Nc * 16)], div = storage(Nc * 4), pres = [storage(Nc * 4), storage(Nc * 4)], u = uniform(64);
          const mk = (code, bufs, tex) => { const p = compute(code); return { p, g: bufs.map((bl) => dev.createBindGroup({ layout: p.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: u } }, ...bl.map((b, i) => ({ binding: [1, 2, 3, 6][i], resource: { buffer: b } })), ...(tex ? [{ binding: 4, resource: mt.sdf.createView() }, { binding: 5, resource: smp }] : [])] })) }; };
          const A = mk(CV_ADVECT, [[vel[0], vel[1], dye[0], dye[1]], [vel[1], vel[0], dye[1], dye[0]]], true), D = mk(CV_DIV, [[vel[1], div, pres[0]], [vel[0], div, pres[0]]]), J = mk(CV_JAC, [[div, pres[0], pres[1]], [div, pres[1], pres[0]]]), P = mk(CV_PROJ, [[pres[0], vel[1]], [pres[0], vel[0]]]);
          const pd = render(CV_DRAW); s.cv = { u, A, D, J, P, pd, gd: [faceBind(pd, [{ binding: 4, resource: { buffer: dye[1] } }]), faceBind(pd, [{ binding: 4, resource: { buffer: dye[0] } }])], cur: 0 }; }
        else if (c.id === 'exxon') { const pts = pixels(rc, () => true, 3).map(([x, y]) => [box[0] + x * box[2], box[1] + y * box[3]]); const homes = new Float32Array(EX_M * 4), p0 = new Float32Array(EX_M * 4), v0 = new Float32Array(EX_M * 4);
          for (let k = 0; k < EX_M; k++) { const p = pts[Math.floor(hash2(k, 3) * pts.length)]; homes[k * 4] = p[0]; homes[k * 4 + 1] = p[1]; homes[k * 4 + 2] = (hash2(k, 5) - 0.5) * 0.03; homes[k * 4 + 3] = (p[0] - box[0]) / box[2] * 0.9 + hash2(k, 7) * 0.1; p0[k * 4] = hash2(k, 11); p0[k * 4 + 1] = 0.04 + hash2(k, 13) * 0.48; p0[k * 4 + 2] = (hash2(k, 15) - 0.5) * 0.6; v0[k * 4 + 3] = hash2(k, 17) * 6; }
          const hb = storage(homes.byteLength), pos = storage(EX_M * 16), vel = storage(EX_M * 16), u = uniform(48), pr = uniform(64); dev.queue.writeBuffer(hb, 0, homes); dev.queue.writeBuffer(pos, 0, p0); dev.queue.writeBuffer(vel, 0, v0);
          const pk = compute(EX_K), pd = pipe3d(EX_D, { depth: true }), pb = pipe3d(EX_BG, { depth: 'nowrite', topology: 'triangle-list' }); s.ex = { u, pr, pk, pd, pb, gk: bind(pk, [u, pos, vel, hb]), gd: bind(pd, [pr, pos, vel]), gb: faceBind(pb), depth: null }; }
        else { const code = { apple: APPLE, alphabet: ALPHA }[c.id]; const pf = render(code); s.face = { pf, gf: faceBind(pf) }; }
        s.ready = true; }).catch((e) => console.error('wallet', c.id, e));
    }, frame(t, dt, now) {
      if (!s) return; const resized = s.fit(); const dev = this.__dev, op = isOpen() ? 1 : 0, since = (now - openedAt) / 1000, T = op ? since : posterT[c.id];
      if (!op) { if (s.stillDrawn && !resized) return; if (s.ready) s.stillDrawn = true; } else { s.stillDrawn = false; }
      const want = !op ? posterTilt[c.id] : on ? [(ptr[0] - 0.5) * 1.2, (ptr[1] - 0.5) * 1.2] : c.id === 'alphabet' ? [Math.sin(T * TAU / 10) * 0.3, Math.sin(T * TAU / 10 + 1.2) * 0.15] : [0, 0];
      if (!op) tilt = [...want]; else { tilt[0] += (want[0] - tilt[0]) * Math.min(1, dt * 4); tilt[1] += (want[1] - tilt[1]) * Math.min(1, dt * 4); }
      const view = s.ctx.getCurrentTexture().createView(), enc = dev.createCommandEncoder(), asp = canvas.width / canvas.height;
      const writeR = (phase, a = 0, b = 0, extra = [0, 0, 0, 0]) => dev.queue.writeBuffer(s.ru, 0, new Float32Array([canvas.width, canvas.height, T, phase, tilt[0], tilt[1], op, on, ...c.stock, 1, ...(s.box || [0, 0, 1, 1]), ptr[0], ptr[1], a, b, ...extra]));
      if (!s.ready) { const rp = enc.beginRenderPass({ colorAttachments: [{ view, loadOp: 'clear', storeOp: 'store', clearValue: { r: c.stock[0], g: c.stock[1], b: c.stock[2], a: 1 } }] }); rp.end(); dev.queue.submit([enc.finish()]); return; }
      const steps = op ? 1 : 30;
      if (c.id === 'walmart') { const beat = Math.floor(Math.max(0, T - 2.0) / 2.4), set = op && T > 2.0 ? [0, 1 + (beat % 5), 0, 1 + ((beat + 2) % 5)][beat % 4] : 0;
        writeR(0, 0); for (let k = 0; k < steps; k++) { const U = new ArrayBuffer(48), Ui = new Uint32Array(U), Uf = new Float32Array(U); Ui[0] = s.pt.n; Ui[1] = set; Ui[2] = s.pt.nW; Ui[3] = s.pt.nSets; Uf[4] = Math.min(dt, 1 / 30); Uf[5] = T + k / 60; Uf[6] = on; Uf[7] = asp; Uf[8] = ptr[0]; Uf[9] = ptr[1]; dev.queue.writeBuffer(s.pt.u, 0, U); const cp = enc.beginComputePass(); cp.setPipeline(s.pt.pk); cp.setBindGroup(0, s.pt.gk); cp.dispatchWorkgroups(Math.ceil(s.pt.n / 256)); cp.end(); }
        dev.queue.writeBuffer(s.pt.pr, 0, new Float32Array([canvas.width, canvas.height, 2.2 * DPR, 0.75, Math.sin(T * 0.25) * 0.25 + tilt[0] * 0.3, -0.18 + tilt[1] * 0.2, 0, 0]));
        const rp = enc.beginRenderPass({ colorAttachments: [{ view, loadOp: 'clear', storeOp: 'store' }] }); rp.setPipeline(s.pt.pf); rp.setBindGroup(0, s.pt.gf); rp.draw(3); rp.setPipeline(s.pt.pd); rp.setBindGroup(0, s.pt.gd); rp.draw(4, s.pt.n); rp.end();
      } else if (c.id === 'amazon') { const am = s.am, tl = T % 12, k = Math.min(1, tl / 7), bx = s.box; let sled = [-1, -1, 0]; const agents = [];
        if (tl < 7) { const idx = Math.min(am.path.length - 1, Math.floor(k * (am.path.length - 1))), p = am.path[idx]; const hx = 0.08 + p[0] * 0.84, hy = 0.30 + (p[1] - 0.5) * 1.6; sled = [hx, hy, 1]; agents.push([hx * TRW, hy * TRH, 2.4, 0]); }
        if (on && last) agents.push([ptr[0] * TRW, ptr[1] * TRH, 1.2, 0]);
        for (let k2 = 0; k2 < steps; k2++) { const U = new ArrayBuffer(96), Ui = new Uint32Array(U), Uf = new Float32Array(U); Ui[0] = TRW; Ui[1] = TRH; Ui[2] = agents.length; Uf[4] = tl < 7.5 ? 0.997 : 0.985; Uf[5] = T; agents.forEach((a, i) => Uf.set(a, 8 + i * 4)); dev.queue.writeBuffer(am.u, 0, U); const cp = enc.beginComputePass(); cp.setPipeline(am.st); cp.setBindGroup(0, am.gs[am.cur]); cp.dispatchWorkgroups(Math.ceil(TRW / 16), Math.ceil(TRH / 16)); cp.end(); am.cur ^= 1; }
        writeR(0, 3, op ? 1 : 2, [sled[0], sled[1], sled[2], 0]); const rp = enc.beginRenderPass({ colorAttachments: [{ view, loadOp: 'clear', storeOp: 'store' }] }); rp.setPipeline(am.pd); rp.setBindGroup(0, am.gd[am.cur ^ 1]); rp.draw(3); rp.end();
      } else if (c.id === 'unitedhealth') { /* two seconds tangled, six combing, three held straight, one to tangle again; the hand is the comb */
        const uh = s.uh, tl = T % 12; let front; if (tl < 2) front = -0.3; else if (tl < 8) front = -0.3 + (tl - 2) / 6 * 1.6; else if (tl < 11) front = 1.3; else front = 1.3 - (tl - 11) * 1.6; if (on) front = ptr[0] * 1.6 - 0.3; if (!op) front = 0.7;
        const U = new ArrayBuffer(32), Ui = new Uint32Array(U), Uf = new Float32Array(U); Ui[0] = TM; Ui[1] = TP; Uf[4] = front; Uf[5] = T; Uf[6] = asp; dev.queue.writeBuffer(uh.u, 0, U); dev.queue.writeBuffer(uh.pr, 0, new Float32Array([canvas.width, canvas.height, T, 0, 0.0, 0.15, 0.47, 1, -0.4 + tilt[0], 0.6 + tilt[1], 0.8, 0])); writeR(0, 1);
        const cp = enc.beginComputePass(); cp.setPipeline(uh.pk); cp.setBindGroup(0, uh.gk); cp.dispatchWorkgroups(Math.ceil(TM * TP / 256)); cp.end();
        const rp = enc.beginRenderPass({ colorAttachments: [{ view, loadOp: 'clear', storeOp: 'store' }] }); rp.setPipeline(uh.pf); rp.setBindGroup(0, uh.gf); rp.draw(3); rp.setPipeline(uh.pd); rp.setBindGroup(0, uh.gd); rp.draw(4, TM * (TP - 1)); rp.end();
        $('wl-uh-tick').textContent = Math.round(Math.min(1, Math.max(0, (front + 0.3) / 1.6)) * TM).toLocaleString();
      } else if (c.id === 'berkshire') { /* the chart grows over twelve seconds and holds four; the light keeps raking */
        const bk = s.bk, tl = T % 16, reveal = op ? Math.min(1.02, tl / 12 * 1.02) : 1.02;
        dev.queue.writeBuffer(bk.pr, 0, new Float32Array([canvas.width, canvas.height, T, reveal, -0.5 + tilt[0] * 1.5, 0.7, 0.6, 0, 0.86, 0.68, 0.30, 1, tilt[0], tilt[1], 0, 0])); writeR(0);
        const rp = enc.beginRenderPass({ colorAttachments: [{ view, loadOp: 'clear', storeOp: 'store' }] }); rp.setPipeline(bk.pb); rp.setBindGroup(0, bk.gb); rp.draw(3); rp.setPipeline(bk.pd); rp.setBindGroup(0, bk.gd); rp.draw(4, BC * 3); rp.end();
      } else if (c.id === 'cvs') { const cv = s.cv;
        for (let k = 0; k < (op ? 1 : 0); k++) { const sys = Math.pow(Math.max(0, Math.sin(T * TAU)), 6); const U = new ArrayBuffer(64), Ui = new Uint32Array(U), Uf = new Float32Array(U); Ui[0] = CW; Ui[1] = CH; Uf[4] = 1.0; Uf[5] = sys; Uf[6] = T; Uf[7] = on; Uf[8] = ptr[0] * CW; Uf[9] = ptr[1] * CH; Uf[10] = force[0]; Uf[11] = force[1]; Uf.set(s.box, 12); dev.queue.writeBuffer(cv.u, 0, U); force = [force[0] * 0.5, force[1] * 0.5];
          const gx = Math.ceil(CW / 16), gy = Math.ceil(CH / 16), cp = enc.beginComputePass(); cp.setPipeline(cv.A.p); cp.setBindGroup(0, cv.A.g[cv.cur]); cp.dispatchWorkgroups(gx, gy); cp.setPipeline(cv.D.p); cp.setBindGroup(0, cv.D.g[cv.cur]); cp.dispatchWorkgroups(gx, gy); cp.setPipeline(cv.J.p); for (let i = 0; i < C_ITERS; i++) { cp.setBindGroup(0, cv.J.g[i & 1]); cp.dispatchWorkgroups(gx, gy); } cp.setPipeline(cv.P.p); cp.setBindGroup(0, cv.P.g[cv.cur]); cp.dispatchWorkgroups(gx, gy); cp.end(); cv.cur ^= 1; }
        writeR(0); const rp = enc.beginRenderPass({ colorAttachments: [{ view, loadOp: 'clear', storeOp: 'store' }] }); rp.setPipeline(cv.pd); rp.setBindGroup(0, cv.gd[cv.cur ^ 1]); rp.draw(3); rp.end();
      } else if (c.id === 'exxon') { const ex = s.ex, tl = T % 14, front = tl < 3 ? 0 : tl < 8 ? (tl - 3) / 5 : tl < 11 ? 1 : 1 - (tl - 11) / 3;
        if (!ex.depth || ex.depth.width !== canvas.width || ex.depth.height !== canvas.height) { ex.depth = dev.createTexture({ size: [canvas.width, canvas.height], format: 'depth24plus', usage: GPUTextureUsage.RENDER_ATTACHMENT }); }
        for (let k = 0; k < steps; k++) { const U = new ArrayBuffer(48), Ui = new Uint32Array(U), Uf = new Float32Array(U); Ui[0] = EX_M; Uf[4] = Math.min(dt, 1 / 30); Uf[5] = T + k / 60; Uf[6] = front; Uf[7] = asp; Uf[8] = ptr[0]; Uf[9] = ptr[1]; Uf[10] = on; dev.queue.writeBuffer(ex.u, 0, U); const cp = enc.beginComputePass(); cp.setPipeline(ex.pk); cp.setBindGroup(0, ex.gk); cp.dispatchWorkgroups(Math.ceil(EX_M / 64)); cp.end(); }
        dev.queue.writeBuffer(ex.pr, 0, new Float32Array([canvas.width, canvas.height, T, 0, -0.4 + tilt[0], 0.7 + tilt[1], 0.8, 0, 0.85, 0.14, 0.11, 1, 0.0, 0.18, 0.53, 1])); writeR(0, 0.0);
        const rp = enc.beginRenderPass({ colorAttachments: [{ view, loadOp: 'clear', storeOp: 'store' }], depthStencilAttachment: { view: ex.depth.createView(), depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store' } });
        rp.setPipeline(ex.pb); rp.setBindGroup(0, ex.gb); rp.draw(3); rp.setPipeline(ex.pd); rp.setBindGroup(0, ex.gd); rp.draw(4, EX_M * 3); rp.end();
      } else { let phase = 0;
        if (c.id === 'apple') phase = op ? (T % 24) / 24 : 0.35;
        writeR(phase); const rp = enc.beginRenderPass({ colorAttachments: [{ view, loadOp: 'clear', storeOp: 'store' }] }); rp.setPipeline(s.face.pf); rp.setBindGroup(0, s.face.gf); rp.draw(3); rp.end();
      }
      dev.queue.submit([enc.finish()]);
    } });
  });
}
export const WALLET_CARDS = CARDS;
