/* §2 · WALLET — a phone wallet holding eight business cards, one for each of
   the eight largest companies on the Fortune list, each carrying the company's
   own mark. Tap a card and it rises out of the stack; on the open card the
   mark comes alive — as particles rebuilt from the logo's pixels, or as a
   surface the logo shades (liquid metal, letterpress, a ripple, oil). Every
   face is one WebGPU canvas: the stock, the grain, the holographic sheen that
   follows the hand like a tilted phone, and the mark. The people are invented;
   the marks are the companies' own. */
import { $, DPR, TAU, storage, uniform, compute, render, bind, attach, card, pointer, hash2, FSQ_VS } from './common.js';

const N = 28000;
const CARDS = [
  { id: 'walmart', mode: 0, stock: [0.02, 0.32, 0.75], ink: [1, 1, 1], dim: [0.72, 0.82, 0.95], box: [0.07, 0.10, 0.50, 0.24], name: 'Dana Whitfield', title: 'VP, Store Experience', mail: 'dana.whitfield@walmart.com', tel: '+1 479 273 4000', site: 'walmart.com', burst: 'rays' },
  { id: 'amazon', mode: 5, stock: [0.13, 0.18, 0.24], ink: [1, 1, 1], dim: [0.70, 0.75, 0.80], box: [0.07, 0.10, 0.44, 0.22], name: 'Raj Menon', title: 'Principal Motion Designer', mail: 'rajm@amazon.com', tel: '+1 206 266 1000', site: 'amazon.com' },
  { id: 'apple', mode: 1, stock: [0.06, 0.06, 0.07], ink: [0.96, 0.96, 0.97], dim: [0.6, 0.6, 0.62], box: [0.07, 0.09, 0.16, 0.30], name: 'Ines Marlow', title: 'Design Lead, Interaction', mail: 'imarlow@apple.com', tel: '+1 408 996 1010', site: 'apple.com' },
  { id: 'unitedhealth', mode: 3, stock: [0.98, 0.98, 0.99], ink: [0.08, 0.16, 0.30], dim: [0.45, 0.52, 0.62], box: [0.07, 0.11, 0.56, 0.16], name: 'Dr Amara Cole', title: 'Chief Digital Officer', mail: 'amara.cole@uhg.com', tel: '+1 952 936 1300', site: 'unitedhealthgroup.com' },
  { id: 'berkshire', mode: 2, stock: [0.95, 0.93, 0.87], ink: [0.18, 0.16, 0.14], dim: [0.50, 0.46, 0.40], box: [0.07, 0.12, 0.60, 0.14], name: 'Thomas Reade', title: 'Investment Associate', mail: 'treade@berkshirehathaway.com', tel: '+1 402 346 1400', site: 'berkshirehathaway.com' },
  { id: 'cvs', mode: 0, stock: [1, 1, 1], ink: [0.12, 0.10, 0.10], dim: [0.52, 0.48, 0.48], box: [0.07, 0.10, 0.50, 0.22], name: 'Marisol Vega', title: 'Director, Pharmacy Innovation', mail: 'marisol.vega@cvshealth.com', tel: '+1 401 765 1500', site: 'cvshealth.com', burst: 'beat' },
  { id: 'exxon', mode: 4, stock: [0.97, 0.97, 0.98], ink: [0.12, 0.12, 0.16], dim: [0.50, 0.50, 0.55], box: [0.07, 0.11, 0.50, 0.18], name: 'Owen Hartley', title: 'Brand & Motion', mail: 'owen.hartley@exxonmobil.com', tel: '+1 972 940 6000', site: 'exxonmobil.com' },
  { id: 'alphabet', mode: 0, stock: [1, 1, 1], ink: [0.13, 0.13, 0.13], dim: [0.50, 0.50, 0.50], box: [0.07, 0.12, 0.46, 0.20], name: 'Kenji Sato', title: 'Creative Technologist', mail: 'kenjis@abc.xyz', tel: '+1 650 253 0000', site: 'abc.xyz', burst: 'cloud' },
];

/* the face: stock, grain, a sheen that follows the tilt, and the mark in its box */
const FACE = FSQ_VS + `
struct R { res: vec2f, time: f32, mode: f32, tilt: vec2f, open: f32, beat: f32, stock: vec4f, box: vec4f, ptr: vec2f, ptrOn: f32, pad: f32 };
@group(0) @binding(0) var<uniform> r: R;
@group(0) @binding(1) var tex: texture_2d<f32>;
@group(0) @binding(2) var smp: sampler;
fn hash(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }
fn vn(p: vec2f) -> f32 { let i = floor(p); var f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2f(1, 0)), f.x), mix(hash(i + vec2f(0, 1)), hash(i + vec2f(1, 1)), f.x), f.y); }
fn fbm(p0: vec2f) -> f32 { var p = p0; var a = 0.5; var s = 0.0; for (var i = 0; i < 4; i++) { s += a * vn(p); a *= 0.5; p = p * 2.1 + 1.7; } return s; }
fn mark(uv: vec2f) -> vec4f { if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) { return vec4f(0.0); } return textureSampleLevel(tex, smp, uv, 0.0); }
fn markH(uv: vec2f) -> f32 { var a = 0.0; for (var y = -2; y <= 2; y++) { for (var x = -2; x <= 2; x++) { a += mark(uv + vec2f(f32(x), f32(y)) * 0.004).a; } } return a / 25.0; }
fn spectrum(t: f32) -> vec3f { return 0.5 + 0.5 * cos(6.2831853 * (t + vec3f(0.0, 0.33, 0.67))); }
@fragment fn fs(o: VO) -> @location(0) vec4f {
  let uv = o.uv; let asp = r.res.x / r.res.y; let p = (uv - 0.5) * vec2f(asp, 1.0);
  /* the stock, with paper grain and a rounded edge shadow */
  var col = r.stock.rgb * (0.985 + 0.03 * hash(floor(uv * r.res * 0.5)));
  let edge = smoothstep(0.0, 0.03, min(min(uv.x, 1.0 - uv.x) * asp, min(uv.y, 1.0 - uv.y)));
  col *= 0.94 + 0.06 * edge;
  /* the holographic sheen: a band whose position follows the tilt, coloured by angle */
  let ang = (p.x * 0.7 + p.y * 0.4) + r.tilt.x * 0.9 + r.tilt.y * 0.5; let band = exp(-pow((ang - 0.15) * 2.4, 2.0));
  let hol = spectrum(ang * 1.4 + r.time * 0.05) * band * 0.10 * r.open; col += hol;
  let lum = dot(r.stock.rgb, vec3f(0.33)); let light = select(0.05, 0.10, lum > 0.5) * band * r.open; col += vec3f(light);
  /* the mark, in its box, mapped to the letterboxed texture */
  let b = r.box; let bu = (uv - b.xy) / b.zw; let tu = vec2f(bu.x, bu.y);
  var m = mark(tu); let inside = f32(bu.x >= 0.0 && bu.y >= 0.0 && bu.x <= 1.0 && bu.y <= 1.0);
  if (r.mode < 0.5) { /* particle cards: the face only */ }
  else if (r.mode < 1.5) { /* liquid metal: the mark as a height field, lit by a sweeping key and a sky */
    let h = markH(tu); let e = 0.006; let n = normalize(vec3f((markH(tu + vec2f(e, 0.0)) - markH(tu - vec2f(e, 0.0))) * 6.0, (markH(tu + vec2f(0.0, e)) - markH(tu - vec2f(0.0, e))) * 6.0, 1.0));
    let L = normalize(vec3f(cos(r.time * 0.7) * 0.8 + r.tilt.x, 0.6 + r.tilt.y * 0.5, 0.7)); let V = vec3f(0.0, 0.0, 1.0); let H = normalize(L + V);
    let sky = mix(vec3f(0.35, 0.36, 0.40), vec3f(0.95, 0.96, 1.0), 0.5 + 0.5 * n.y); let spec = pow(max(dot(n, H), 0.0), 60.0) * 1.2; let fr = pow(1.0 - max(dot(n, V), 0.0), 3.0);
    let metal = sky * (0.55 + 0.45 * max(dot(n, L), 0.0)) + vec3f(spec) + fr * 0.4;
    col = mix(col, metal, smoothstep(0.35, 0.6, h) * inside);
  } else if (r.mode < 2.5) { /* letterpress: the mark pressed into the stock, a raking light that turns */
    let e = 0.004; let gx = markH(tu + vec2f(e, 0.0)) - markH(tu - vec2f(e, 0.0)); let gy = markH(tu + vec2f(0.0, e)) - markH(tu - vec2f(0.0, e));
    let la = r.time * 0.35 + r.tilt.x * 2.0; let L = vec2f(cos(la), sin(la)); let rake = (gx * L.x + gy * L.y) * 9.0;
    let ink = mix(col, m.rgb * 0.9 * col / max(r.stock.rgb, vec3f(0.2)), m.a * 0.9);
    col = mix(col, ink, inside) * (1.0 - 0.35 * max(rake, 0.0) * inside) + vec3f(0.5) * max(-rake, 0.0) * 0.35 * inside;
  } else if (r.mode < 3.5) { /* a pulse: a refractive ring expands from the mark every two seconds */
    let c = vec2f(0.5, 0.5); let d = length((bu - c) * vec2f(b.z / b.w, 1.0)); let ph = fract(r.time * 0.42); let ring = exp(-pow((d - ph * 1.6) * 6.0, 2.0)) * (1.0 - ph);
    let dir = normalize(bu - c + 1e-4); let m2 = mark(tu + dir * ring * 0.03);
    col = mix(col, m2.rgb, m2.a * inside); col += vec3f(0.0, 0.35, 0.75) * ring * 0.18 * inside;
    let glow = exp(-length(p - (b.xy + b.zw * 0.5 - 0.5) * vec2f(asp, 1.0)) * 3.0) * pow(1.0 - ph, 3.0); col -= vec3f(0.06, 0.02, 0.0) * glow;
  } else if (r.mode < 4.5) { /* oil: the mark seen through a slow, viscous warp with an iridescent film */
    let w = vec2f(fbm(bu * 3.0 + vec2f(r.time * 0.06, 0.0)), fbm(bu * 3.0 + vec2f(7.0, r.time * 0.05))) - 0.5; let stir = exp(-length(uv - r.ptr) * 6.0) * r.ptrOn;
    let m2 = mark(tu + w * (0.05 + stir * 0.12)); let film = spectrum(fbm(bu * 2.0 - r.time * 0.03) * 2.0 + r.tilt.x) * 0.10;
    col = mix(col, m2.rgb, m2.a * inside); col += film * inside * (0.5 + 0.5 * m2.a);
  } else { /* a glint that runs along the arrow */
    let g = fract(r.time * 0.25); let gl = exp(-pow((bu.x - g * 1.4 + 0.2) * 5.0, 2.0)); let orange = smoothstep(0.3, 0.6, m.r - m.b);
    col = mix(col, m.rgb, m.a * inside); col += vec3f(1.0, 0.85, 0.5) * gl * orange * m.a * inside * 0.9;
  }
  return vec4f(col, 1.0);
}`;

/* particles rebuilt from the mark's pixels, each with the pixel's colour */
const KERNEL = `
struct U { n: u32, pad0: u32, pad1: u32, pad2: u32, dt: f32, time: f32, blend: f32, beat: f32, ptr: vec2f, ptrOn: f32, aspect: f32, centre: vec2f, pad3: vec2f };
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read_write> pos: array<vec2f>;
@group(0) @binding(2) var<storage, read_write> vel: array<vec2f>;
@group(0) @binding(3) var<storage, read> tgt: array<vec2f>;
@group(0) @binding(4) var<storage, read> alt: array<vec2f>;
@group(0) @binding(5) var<storage, read> colr: array<vec4f>;
fn hash(n: u32) -> f32 { var x = n * 747796405u + 2891336453u; x = ((x >> ((x >> 28u) + 4u)) ^ x) * 277803737u; x = (x >> 22u) ^ x; return f32(x) / 4294967295.0; }
@compute @workgroup_size(256) fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x; if (i >= u.n) { return; } var p = pos[i]; var v = vel[i]; let h = hash(i);
  var t = mix(tgt[i], alt[i], u.blend);
  /* the beat scales a group of particles about a centre */
  if (colr[i].w > 0.5) { t = u.centre + (t - u.centre) * (1.0 + 0.10 * u.beat); }
  var a = (t - p) * 22.0 * (0.7 + 0.6 * h);
  let ph = u.time * (0.8 + h) + h * 6.2831853; a += vec2f(sin(ph * 1.3 + p.y * 9.0), cos(ph * 0.9 + p.x * 7.0)) * 0.004;
  let dp = (p - u.ptr) * vec2f(u.aspect, 1.0); let dd = length(dp); if (dd < 0.14 && u.ptrOn > 0.5) { a += dp / (dd + 1e-4) * 3.0 * (1.0 - dd / 0.14); }
  v = v * 0.84 + a * u.dt; p += v * u.dt; pos[i] = p; vel[i] = v;
}`;
const DRAW = `
struct R { res: vec2f, size: f32, alpha: f32 };
@group(0) @binding(0) var<uniform> r: R;
@group(0) @binding(1) var<storage, read> pos: array<vec2f>;
@group(0) @binding(2) var<storage, read> colr: array<vec4f>;
struct VO { @builtin(position) p: vec4f, @location(0) c: vec4f, @location(1) q: vec2f };
fn hash(n: u32) -> f32 { var x = n * 747796405u + 2891336453u; x = ((x >> ((x >> 28u) + 4u)) ^ x) * 277803737u; x = (x >> 22u) ^ x; return f32(x) / 4294967295.0; }
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO { let corner = vec2f(f32(vi & 1u), f32((vi >> 1u) & 1u)) * 2.0 - 1.0; let p = pos[ii]; var o: VO; let sz = r.size * (0.7 + 0.6 * hash(ii));
  o.p = vec4f((p.x * 2.0 - 1.0) + corner.x * sz / r.res.x, (1.0 - p.y * 2.0) + corner.y * sz / r.res.y, 0.0, 1.0); o.q = corner; o.c = colr[ii]; return o; }
@fragment fn fs(o: VO) -> @location(0) vec4f { if (dot(o.q, o.q) > 1.0) { discard; } return vec4f(o.c.rgb, r.alpha); }`;

/* the mark rasterised: a letterboxed 1024 × 512 canvas from the SVG */
function raster(img) { const W = 1024, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d', { willReadFrequently: true });
  const s = Math.min((W - 40) / img.naturalWidth, (H - 40) / img.naturalHeight), w = img.naturalWidth * s, h = img.naturalHeight * s; x.drawImage(img, (W - w) / 2, (H - h) / 2, w, h); return c; }
function pixelTargets(c, n, box, group) { const W = c.width, H = c.height, d = c.getContext('2d').getImageData(0, 0, W, H).data, pts = [];
  for (let j = 0; j < H; j += 2) for (let i = 0; i < W; i += 2) { const k = (j * W + i) * 4; if (d[k + 3] > 100) pts.push([i / W, j / H, d[k] / 255, d[k + 1] / 255, d[k + 2] / 255]); }
  const pos = new Float32Array(n * 2), col = new Float32Array(n * 4);
  for (let k = 0; k < n; k++) { const p = pts.length ? pts[Math.floor(hash2(k, 5) * pts.length)] : [0.5, 0.5, 0, 0, 0]; pos[k * 2] = box[0] + p[0] * box[2] + (hash2(k, 9) - 0.5) * 0.003; pos[k * 2 + 1] = box[1] + p[1] * box[3] + (hash2(k, 11) - 0.5) * 0.003; col[k * 4] = p[2]; col[k * 4 + 1] = p[3]; col[k * 4 + 2] = p[4]; col[k * 4 + 3] = group ? group(p) : 0; }
  return { pos, col }; }

export function walletCards() {
  const wallet = $('wl-card'), phone = $('wl-phone'), stack = $('wl-stack'), detail = $('wl-detail'); let open = -1, lastTouch = 0, autoUntil = 0;
  const els = CARDS.map((c) => $('wl-' + c.id));
  const layout = () => { const H = stack.clientHeight, cardH = els[0].offsetHeight, step = Math.min(50, (H - cardH - 12) / (CARDS.length - 1));
    els.forEach((el, i) => { if (open < 0) { el.style.transform = `translateY(${i * step}px)`; el.style.zIndex = i + 1; el.classList.remove('wl-on', 'wl-peek'); }
      else if (i === open) { el.style.transform = 'translateY(0px)'; el.style.zIndex = 20; el.classList.add('wl-on'); el.classList.remove('wl-peek'); }
      else { const j = i < open ? i : i - 1; el.style.transform = `translateY(${H - 46 + j * 5}px) scale(${1 - (CARDS.length - 2 - j) * 0.012})`; el.style.zIndex = 8 - j; el.classList.add('wl-peek'); el.classList.remove('wl-on'); } });
    detail.hidden = open < 0; if (open >= 0) { const c = CARDS[open]; detail.style.top = (cardH + 18) + 'px'; $('wl-d-name').textContent = c.name; $('wl-d-title').textContent = c.title; $('wl-d-mail').textContent = c.mail; $('wl-d-tel').textContent = c.tel; $('wl-d-site').textContent = c.site; }
    wallet.classList.toggle('wl-is-open', open >= 0); phone.scrollTop = 0; stack.scrollTop = 0; };
  const setOpen = (i, user) => { open = i; if (user) lastTouch = performance.now(); layout(); };
  els.forEach((el, i) => { el.addEventListener('click', () => setOpen(open === i ? -1 : i, true)); el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(open === i ? -1 : i, true); } }); });
  $('wl-close').addEventListener('click', () => setOpen(-1, true));
  new ResizeObserver(layout).observe(stack); requestAnimationFrame(layout);
  /* the wallet demonstrates itself: left alone it opens a card, holds it, closes it */
  const tour = { at: 0 }; setInterval(() => { const idle = performance.now() - lastTouch; if (idle < 9000) return; if (open < 0) { setOpen(tour.at % CARDS.length, false); tour.at++; setTimeout(() => { if (performance.now() - lastTouch >= 9000) setOpen(-1, false); }, 6500); } }, 1000);
  lastTouch = performance.now();

  return CARDS.map((c, ci) => {
    const el = els[ci], stage = $('wl-' + c.id + '-stage'), canvas = $('wl-' + c.id + '-canvas'); let s = null, ptr = [-9, -9], on = 0, tilt = [0, 0], burstAt = 0;
    pointer(stage, (p) => { ptr = [p.x, p.y]; on = 1; }, () => { on = 0; });
    return card({ name: 'wallet-' + c.id, el, init() {
      const dev = this.__dev, { ctx, fit } = attach(canvas);
      const img = new Image(); img.src = '../assets/marks/' + c.id + '.svg';
      const ru = uniform(96), pFace = render(FACE);
      const smp = dev.createSampler({ magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear' });
      const tex = dev.createTexture({ size: [1024, 512], format: 'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT });
      const gFace = dev.createBindGroup({ layout: pFace.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: ru } }, { binding: 1, resource: tex.createView() }, { binding: 2, resource: smp }] });
      s = { ctx, fit, ru, pFace, gFace, tex, ready: false };
      if (c.mode === 0) { const u = uniform(64), pr = uniform(16), pos = storage(N * 8), vel = storage(N * 8), tgt = storage(N * 8), alt = storage(N * 8), colr = storage(N * 16), pk = compute(KERNEL), pd = render(DRAW, { blend: true });
        s.pt = { u, pr, pos, vel, tgt, alt, colr, pk, pd, gk: bind(pk, [u, pos, vel, tgt, alt, colr]), gd: bind(pd, [pr, pos, colr]), centre: [0, 0] }; }
      img.decode().then(async () => { const rc = raster(img); const bmp = await createImageBitmap(rc); dev.queue.copyExternalImageToTexture({ source: bmp }, { texture: tex }, [1024, 512]); bmp.close();
        if (c.mode === 0) { const group = c.burst === 'beat' ? (p) => (p[2] > 0.6 && p[3] < 0.3 && p[0] < 0.42 ? 1 : 0) : null; const { pos, col } = pixelTargets(rc, N, c.box, group);
          dev.queue.writeBuffer(s.pt.tgt, 0, pos); dev.queue.writeBuffer(s.pt.pos, 0, pos); dev.queue.writeBuffer(s.pt.colr, 0, col);
          /* the alternative targets: rays from the spark, a cloud, or the same place */
          const a2 = new Float32Array(N * 2); let cx = 0, cy = 0, cn = 0; for (let k = 0; k < N; k++) if (col[k * 4 + 3] > 0.5 || c.burst === 'rays' && col[k * 4] > 0.8 && col[k * 4 + 2] < 0.4) { cx += pos[k * 2]; cy += pos[k * 2 + 1]; cn++; } if (cn) { cx /= cn; cy /= cn; } s.pt.centre = [cx, cy];
          for (let k = 0; k < N; k++) { const x = pos[k * 2], y = pos[k * 2 + 1]; if (c.burst === 'rays') { const isSpark = col[k * 4] > 0.8 && col[k * 4 + 2] < 0.4; const ang = Math.atan2(y - cy, (x - cx) * 1.75), rr = isSpark ? 0.10 + hash2(k, 21) * 0.4 : 0; a2[k * 2] = x + Math.cos(ang) * rr / 1.75 * (isSpark ? 1 : 0); a2[k * 2 + 1] = y + Math.sin(ang) * rr * (isSpark ? 1 : 0); }
            else if (c.burst === 'cloud') { a2[k * 2] = 0.04 + hash2(k, 21) * 0.6; a2[k * 2 + 1] = 0.05 + hash2(k, 23) * 0.55; } else { a2[k * 2] = x; a2[k * 2 + 1] = y; } }
          dev.queue.writeBuffer(s.pt.alt, 0, a2); }
        s.ready = true; }).catch((e) => console.error('mark', c.id, e));
    }, frame(t, dt, now) {
      if (!s) return; s.fit(); const dev = this.__dev, T = now / 1000, isOpen = open === ci ? 1 : 0;
      tilt[0] += (((on ? ptr[0] : 0.5) - 0.5) * 1.2 - tilt[0]) * Math.min(1, dt * 4); tilt[1] += (((on ? ptr[1] : 0.5) - 0.5) * 1.2 - tilt[1]) * Math.min(1, dt * 4);
      const beat = Math.pow(0.5 + 0.5 * Math.sin(T * 1.9 * TAU / 2), 3.0);
      const R = new Float32Array([canvas.width, canvas.height, T, c.mode, tilt[0], tilt[1], isOpen, beat, ...c.stock, 1, ...c.box, ptr[0], ptr[1], on, 0]);
      dev.queue.writeBuffer(s.ru, 0, R);
      const enc = dev.createCommandEncoder(); const rp = enc.beginRenderPass({ colorAttachments: [{ view: s.ctx.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store' }] });
      rp.setPipeline(s.pFace); rp.setBindGroup(0, s.gFace); rp.draw(3);
      if (c.mode === 0 && s.ready) {
        /* every seven seconds on an open card the mark bursts and comes back */
        if (isOpen && T - burstAt > 7) burstAt = T; const since = T - burstAt; const blend = isOpen && since < 1.6 ? Math.sin(Math.min(1, since / 1.6) * Math.PI) : 0;
        const U = new ArrayBuffer(64), Ui = new Uint32Array(U), Uf = new Float32Array(U); Ui[0] = N; Uf[4] = Math.min(dt, 1 / 30); Uf[5] = T; Uf[6] = c.burst === 'beat' ? 0 : blend; Uf[7] = c.burst === 'beat' ? beat : 0; Uf[8] = ptr[0]; Uf[9] = ptr[1]; Uf[10] = on; Uf[11] = canvas.width / canvas.height; Uf[12] = s.pt.centre[0]; Uf[13] = s.pt.centre[1];
        dev.queue.writeBuffer(s.pt.u, 0, U); dev.queue.writeBuffer(s.pt.pr, 0, new Float32Array([canvas.width, canvas.height, 1.5 * DPR, 0.85]));
        rp.end(); const cp = enc.beginComputePass(); cp.setPipeline(s.pt.pk); cp.setBindGroup(0, s.pt.gk); cp.dispatchWorkgroups(Math.ceil(N / 256)); cp.end();
        const rp2 = enc.beginRenderPass({ colorAttachments: [{ view: s.ctx.getCurrentTexture().createView(), loadOp: 'load', storeOp: 'store' }] }); rp2.setPipeline(s.pt.pd); rp2.setBindGroup(0, s.pt.gd); rp2.draw(4, N); rp2.end();
      } else { rp.end(); }
      dev.queue.submit([enc.finish()]);
    } });
  });
}
export const WALLET_CARDS = CARDS;
