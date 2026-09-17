// @ts-nocheck -- copied from design/techniques/webgpu/; untyped sheet code
/* a small UI toolkit that draws with WebGPU only — so a fictive app can be
   entirely WebGPU, with the phone around it left to CSS. Text is glyphs
   rasterised once each into an atlas (Canvas 2D is the rasteriser, the
   way every GPU text stack does it) and drawn as instanced quads; panels,
   pills, discs and cells are rounded-rect signed distances; glass samples
   a blurred copy of whatever the app drew behind it, so the frosting is
   real. Everything the app draws in a frame is one instance buffer and one
   draw call over the app's own background pass.
   Coordinates are points: the Duo's inner display is 890 × 626. */
import { device, uniform, storage, render, FSQ_VS } from './common.js';

const AS = 2048, SS = 2, STRIDE = 20; /* floats per instance */
export const SANS = '-apple-system, "SF Pro Text", Inter, system-ui, sans-serif';
export const MONO = '"SF Mono", ui-monospace, Menlo, monospace';
export const SERIF = 'Georgia, "Times New Roman", serif';

const UI_SHADER = `
struct U { res: vec2f, ppp: f32, time: f32 };
struct Inst { a: vec4f, b: vec4f, c: vec4f, d: vec4f, e: vec4f };
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> inst: array<Inst>;
@group(0) @binding(2) var smp: sampler;
@group(0) @binding(3) var atlas: texture_2d<f32>;
@group(0) @binding(4) var blurred: texture_2d<f32>;
struct VO { @builtin(position) p: vec4f, @location(0) l: vec2f, @location(1) @interpolate(flat) ii: u32 };
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO {
  let I = inst[ii]; let corner = vec2f(f32(vi & 1u), f32((vi >> 1u) & 1u)); let pt = I.a.xy + corner * I.a.zw;
  var o: VO; o.p = vec4f(pt.x / u.res.x * 2.0 - 1.0, 1.0 - pt.y / u.res.y * 2.0, 0.0, 1.0); o.l = corner * I.a.zw; o.ii = ii; return o; }
fn sdBox(p: vec2f, b: vec2f, r: f32) -> f32 { let q = abs(p) - b + r; return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - r; }
@fragment fn fs(o: VO) -> @location(0) vec4f { let I = inst[o.ii]; let hw = I.a.zw * 0.5; let p = o.l - hw; let kind = I.b.y; let pt = I.a.xy + o.l;
  /* clip rect, for lists */
  if (I.d.z > 0.0 && (pt.x < I.d.x || pt.y < I.d.y || pt.x > I.d.x + I.d.z || pt.y > I.d.y + I.d.w)) { discard; }
  let aa = 0.7 / u.ppp; let d = sdBox(p, hw, min(I.b.x, min(hw.x, hw.y))); var cov = 1.0 - smoothstep(-aa, aa, d);
  var col = I.c;
  if (kind == 1.0) { /* text: atlas coverage */ let uv = mix(I.e.xy, I.e.zw, o.l / I.a.zw); let a = textureSampleLevel(atlas, smp, uv, 0.0).a; return vec4f(col.rgb, a * col.a * I.b.w); }
  if (kind == 4.0) { /* image from the atlas */ let uv = mix(I.e.xy, I.e.zw, o.l / I.a.zw); let s = textureSampleLevel(atlas, smp, uv, 0.0); return vec4f(s.rgb * col.rgb, s.a * col.a * I.b.w * cov); }
  if (kind == 2.0) { /* glass: the blurred background, tinted, with a lit rim */ let suv = pt / u.res; let bg = textureSampleLevel(blurred, smp, suv, 0.0).rgb; let rim = 1.0 - smoothstep(0.0, 1.6 / u.ppp, -d); let lit = rim * (0.35 + 0.25 * clamp(-p.y / max(hw.y, 1.0), -1.0, 1.0));
    var g = mix(bg, col.rgb, col.a); g = g + vec3f(lit * I.e.x); return vec4f(g, cov * I.b.w); }
  if (kind == 3.0) { /* stroke */ let sw = I.b.z * 0.5; cov = 1.0 - smoothstep(-aa, aa, abs(d) - sw); return vec4f(col.rgb, col.a * cov * I.b.w); }
  if (kind == 5.0) { /* vertical gradient */ col = mix(I.c, I.e, clamp(o.l.y / I.a.w, 0.0, 1.0)); }
  if (kind == 6.0) { /* diagonal gradient, an icon tile */ col = mix(I.c, I.e, clamp((o.l.x + o.l.y) / (I.a.z + I.a.w), 0.0, 1.0)); }
  return vec4f(col.rgb, col.a * cov * I.b.w); }`;

const BLUR = FSQ_VS + `
struct B { dir: vec2f, res: vec2f };
@group(0) @binding(0) var<uniform> b: B; @group(0) @binding(1) var smp: sampler; @group(0) @binding(2) var src: texture_2d<f32>;
@fragment fn fs(o: VO) -> @location(0) vec4f { var c = vec4f(0.0); var wsum = 0.0;
  for (var i = -8; i <= 8; i++) { let w = exp(-f32(i * i) / 22.0); c += textureSample(src, smp, o.uv + b.dir * f32(i) / b.res) * w; wsum += w; } return c / wsum; }`;
const IMG = `
struct U { res: vec2f, ppp: f32, time: f32 };
struct Im { a: vec4f, b: vec4f };
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> ims: array<Im>;
@group(0) @binding(2) var smp: sampler;
@group(0) @binding(3) var tex: texture_2d<f32>;
struct VO { @builtin(position) p: vec4f, @location(0) l: vec2f, @location(1) @interpolate(flat) ii: u32 };
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO { let I = ims[ii]; let corner = vec2f(f32(vi & 1u), f32((vi >> 1u) & 1u)); let pt = I.a.xy + corner * I.a.zw;
  var o: VO; o.p = vec4f(pt.x / u.res.x * 2.0 - 1.0, 1.0 - pt.y / u.res.y * 2.0, 0.0, 1.0); o.l = corner * I.a.zw; o.ii = ii; return o; }
fn sdBox(p: vec2f, b: vec2f, r: f32) -> f32 { let q = abs(p) - b + r; return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - r; }
@fragment fn fs(o: VO) -> @location(0) vec4f { let I = ims[o.ii]; let hw = I.a.zw * 0.5; let d = sdBox(o.l - hw, hw, I.b.x); let aa = 0.7 / u.ppp; let cov = 1.0 - smoothstep(-aa, aa, d);
  let c = textureSampleLevel(tex, smp, o.l / I.a.zw, 0.0); return vec4f(c.rgb, cov * I.b.y); }`;
const BLIT = FSQ_VS + `
@group(0) @binding(0) var smp: sampler; @group(0) @binding(1) var src: texture_2d<f32>;
@fragment fn fs(o: VO) -> @location(0) vec4f { return textureSample(src, smp, o.uv); }`;

/* slide fit: the UI draws into a surface — { width, height, view() } — rather than a canvas's swap chain, so the OS layer
   can hand it the Home Screen's or an app's texture and the hardware composites that onto the device's display */
export function makeUI(canvas, W, H) {
  const dev = device, fit = () => {};
  const fmt = navigator.gpu.getPreferredCanvasFormat();
  /* the atlas: one shelf-packed rgba8 texture of glyphs and icons, rasterised at 2 px per pt */
  const ac = document.createElement('canvas'); ac.width = ac.height = AS; const ax = ac.getContext('2d', { willReadFrequently: false });
  const atlas = dev.createTexture({ size: [AS, AS], format: 'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT });
  let sx = 1, sy = 1, sh = 0; const cache = new Map(); const pending = [];
  const pack = (w, h) => { if (sx + w + 1 > AS) { sx = 1; sy += sh + 1; sh = 0; } if (sy + h + 1 > AS) { cache.clear(); ax.clearRect(0, 0, AS, AS); sx = 1; sy = 1; sh = 0; } const r = { x: sx, y: sy, w, h }; sx += w + 1; sh = Math.max(sh, h); pending.push(r); return r; };
  const glyph = (ch, size, weight, family, italic) => { const key = `${family}|${weight}|${italic ? 'i' : ''}|${size}|${ch}`; let g = cache.get(key); if (g) return g;
    const px = size * SS; ax.font = `${italic ? 'italic ' : ''}${weight} ${px}px ${family}`; const m = ax.measureText(ch); const adv = m.width; const w = Math.ceil(adv + px * 0.3), h = Math.ceil(px * 1.35);
    const r = pack(w, h); ax.fillStyle = '#fff'; ax.textBaseline = 'alphabetic'; ax.textAlign = 'left'; ax.fillText(ch, r.x + px * 0.15, r.y + px * 1.02);
    g = { u0: r.x / AS, v0: r.y / AS, u1: (r.x + w) / AS, v1: (r.y + h) / AS, w: w / SS, h: h / SS, adv: adv / SS, off: px * 0.15 / SS }; cache.set(key, g); return g; };
  /* icons: a named 2-D drawing, rasterised once at the size asked for */
  const icon = (name, size, draw) => { const key = `icon|${name}|${size}`; let g = cache.get(key); if (g) return g; const px = Math.ceil(size * SS); const r = pack(px + 2, px + 2);
    ax.save(); ax.translate(r.x + 1, r.y + 1); ax.scale(px, px); ax.strokeStyle = '#fff'; ax.fillStyle = '#fff'; ax.lineCap = 'round'; ax.lineJoin = 'round'; ax.lineWidth = 0.09; draw(ax); ax.restore();
    g = { u0: r.x / AS, v0: r.y / AS, u1: (r.x + px + 2) / AS, v1: (r.y + px + 2) / AS, w: (px + 2) / SS, h: (px + 2) / SS }; cache.set(key, g); return g; };
  const flushAtlas = () => { if (!pending.length) return; for (const r of pending) dev.queue.copyExternalImageToTexture({ source: ac, origin: { x: r.x, y: r.y } }, { texture: atlas, origin: { x: r.x, y: r.y } }, [r.w, r.h]); pending.length = 0; };
  /* buffers, pipelines */
  let cap = 4096, data = new Float32Array(cap * STRIDE), n = 0; let ibuf = storage(cap * STRIDE * 4);
  const u = uniform(16), pipe = render(UI_SHADER, { blend: true, topology: 'triangle-strip' }), smp = dev.createSampler({ magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear' });
  const bu = uniform(16), bh = uniform(16), bp = render(BLUR), blit = render(BLIT), ip = render(IMG, { blend: true, topology: 'triangle-strip' });
  let imgs = [], imgData = new Float32Array(64 * 8), imgBuf = storage(64 * 8 * 4); const imgGroups = new Map(); let split = -1, sceneScale = 1;
  let bg = null, half = null, halfB = null, g = null, gBlurA = null, gBlurB = null, gBlit = null, pw = 0, ph = 0;
  /* an app whose scene is rendered by another runtime (Supercell, on vgpu) hands its
     texture over with ui.scene(tex) each frame; blur and blit then read it instead of bg.
     The groups are cached for the last texture seen and rebuilt when it changes or ensure() rebuilds. */
  let ext = null, extKey = null, extG = null;
  const ensure = () => { const want = [Math.max(2, Math.round(canvas.width * sceneScale)), Math.max(2, Math.round(canvas.height * sceneScale))]; if (want[0] === pw && want[1] === ph && bg) return; if (bg) { bg.destroy(); half.destroy(); halfB.destroy(); } pw = want[0]; ph = want[1];
    const mk = (w, h) => dev.createTexture({ size: [w, h], format: fmt, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
    bg = mk(pw, ph); half = mk(Math.max(1, pw >> 1), Math.max(1, ph >> 1)); halfB = mk(Math.max(1, pw >> 1), Math.max(1, ph >> 1)); extKey = null;
    const mkb = (p, list) => dev.createBindGroup({ layout: p.getBindGroupLayout(0), entries: list.map((r, i) => ({ binding: i, resource: r })) });
    g = mkb(pipe, [{ buffer: u }, { buffer: ibuf }, smp, atlas.createView(), halfB.createView()]);
    gBlurA = mkb(bp, [{ buffer: bu }, smp, bg.createView()]); gBlurB = mkb(bp, [{ buffer: bh }, smp, half.createView()]); gBlit = mkb(blit, [smp, bg.createView()]);
    dev.queue.writeBuffer(bu, 0, new Float32Array([1, 0, half.width, half.height])); dev.queue.writeBuffer(bh, 0, new Float32Array([0, 1, half.width, half.height])); };
  const grow = () => { cap *= 2; const nd = new Float32Array(cap * STRIDE); nd.set(data); data = nd; ibuf = storage(cap * STRIDE * 4); g = null; pw = -1; };
  const imgGroup = (tex) => { let e = imgGroups.get(tex); if (!e) { e = dev.createBindGroup({ layout: ip.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: u } }, { binding: 1, resource: { buffer: imgBuf } }, { binding: 2, resource: smp }, { binding: 3, resource: tex.createView() }] }); imgGroups.set(tex, e); } return e; };
  const push = (x, y, w, h, r, kind, sw, op, c, clip, e) => { if (n >= cap) grow(); const o = n * STRIDE; data[o] = x; data[o + 1] = y; data[o + 2] = w; data[o + 3] = h; data[o + 4] = r; data[o + 5] = kind; data[o + 6] = sw; data[o + 7] = op;
    data[o + 8] = c[0]; data[o + 9] = c[1]; data[o + 10] = c[2]; data[o + 11] = c[3] === undefined ? 1 : c[3];
    if (clip) { data[o + 12] = clip[0]; data[o + 13] = clip[1]; data[o + 14] = clip[2]; data[o + 15] = clip[3]; } else { data[o + 12] = 0; data[o + 13] = 0; data[o + 14] = 0; data[o + 15] = 0; }
    if (e) { data[o + 16] = e[0]; data[o + 17] = e[1]; data[o + 18] = e[2]; data[o + 19] = e[3] === undefined ? 1 : e[3]; } else { data[o + 16] = 0; data[o + 17] = 0; data[o + 18] = 0; data[o + 19] = 0; } n++; };
  const hits = []; let clipRect = null;
  const ui = {
    W, H, canvas, hits, time: 0,
    begin() { n = 0; hits.length = 0; clipRect = null; imgs = []; split = -1; ext = null; },
    /* use a GPUTexture from elsewhere as this frame's scene, in place of prepare()'s view */
    scene(tex) { ext = tex; },
    /* everything pushed after layer(1) is drawn above the images */
    layer(i) { split = i ? n : -1; },
    image(tex, x, y, w, h, r = 0, op = 1) { if (imgs.length >= 64) return; const o = imgs.length * 8; imgData[o] = x; imgData[o + 1] = y; imgData[o + 2] = w; imgData[o + 3] = h; imgData[o + 4] = r; imgData[o + 5] = op; imgs.push(tex); },
    forget(tex) { imgGroups.delete(tex); },
    /* pixels per point on the canvas, for apps that size their own textures */
    ppp: () => canvas.width / W,
    clip(r) { clipRect = r; },
    rect(x, y, w, h, c, r = 0, op = 1) { push(x, y, w, h, r, 0, 0, op, c, clipRect); },
    grad(x, y, w, h, c1, c2, r = 0, diag = false, op = 1) { push(x, y, w, h, r, diag ? 6 : 5, 0, op, c1, clipRect, c2); },
    stroke(x, y, w, h, c, r = 0, sw = 1, op = 1) { push(x, y, w, h, r, 3, sw, op, c, clipRect); },
    glass(x, y, w, h, tint, r = 0, rim = 0.18, op = 1) { push(x, y, w, h, r, 2, 0, op, tint, clipRect, [rim, 0, 0, 0]); },
    disc(cx, cy, rad, c, op = 1) { push(cx - rad, cy - rad, rad * 2, rad * 2, rad, 0, 0, op, c, clipRect); },
    glassDisc(cx, cy, rad, tint, rim = 0.22, op = 1) { push(cx - rad, cy - rad, rad * 2, rad * 2, rad, 2, 0, op, tint, clipRect, [rim, 0, 0, 0]); },
    ring(cx, cy, rad, c, sw = 1, op = 1) { push(cx - rad, cy - rad, rad * 2, rad * 2, rad, 3, sw, op, c, clipRect); },
    /* text: returns the advance; align 'left' | 'center' | 'right'; y is the top of a line box of 1.25 em */
    measure(str, size, o = {}) { const fam = o.family || SANS, wt = o.weight || 400, ls = (o.track || 0) * size; let w = 0; for (const ch of str) w += glyph(ch, size, wt, fam, o.italic).adv + ls; return w - ls; },
    text(x, y, str, size, c, o = {}) { const fam = o.family || SANS, wt = o.weight || 400, ls = (o.track || 0) * size, op = o.op === undefined ? 1 : o.op; let w = ui.measure(str, size, o); let cx = x; if (o.align === 'center') cx = x - w / 2; if (o.align === 'right') cx = x - w;
      for (const ch of str) { const gl = glyph(ch, size, wt, fam, o.italic); if (ch !== ' ') push(cx - gl.off, y, gl.w, gl.h, 0, 1, 0, op, c, clipRect, [gl.u0, gl.v0, gl.u1, gl.v1]); cx += gl.adv + ls; } return w; },
    icon(name, x, y, size, c, draw, op = 1) { const gl = icon(name, size, draw); push(x - 1 / SS, y - 1 / SS, gl.w, gl.h, 0, 4, 0, op, c, clipRect, [gl.u0, gl.v0, gl.u1, gl.v1]); },
    hit(id, x, y, w, h) { hits.push({ id, x, y, w, h }); },
    at(px, py) { for (let i = hits.length - 1; i >= 0; i--) { const h = hits[i]; if (px >= h.x && py >= h.y && px <= h.x + h.w && py <= h.y + h.h) return h.id; } return null; },
    /* the app draws its background into ui.bgView() during its own pass, then calls compose */
    prepare(scale = 1) { fit(); sceneScale = scale; ensure(); return { view: bg.createView(), w: pw, h: ph }; },
    compose(enc) { flushAtlas(); dev.queue.writeBuffer(u, 0, new Float32Array([W, H, pw / W, ui.time])); dev.queue.writeBuffer(ibuf, 0, data, 0, n * STRIDE);
      let blurA = gBlurA, blitG = gBlit;
      if (ext) { if (ext !== extKey) { const v = ext.createView(); extKey = ext; extG = { a: dev.createBindGroup({ layout: bp.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: bu } }, { binding: 1, resource: smp }, { binding: 2, resource: v }] }), b: dev.createBindGroup({ layout: blit.getBindGroupLayout(0), entries: [{ binding: 0, resource: smp }, { binding: 1, resource: v }] }) }; } blurA = extG.a; blitG = extG.b; }
      let rp = enc.beginRenderPass({ colorAttachments: [{ view: half.createView(), loadOp: 'clear', storeOp: 'store' }] }); rp.setPipeline(bp); rp.setBindGroup(0, blurA); rp.draw(3); rp.end();
      rp = enc.beginRenderPass({ colorAttachments: [{ view: halfB.createView(), loadOp: 'clear', storeOp: 'store' }] }); rp.setPipeline(bp); rp.setBindGroup(0, gBlurB); rp.draw(3); rp.end();
      if (imgs.length) dev.queue.writeBuffer(imgBuf, 0, imgData, 0, imgs.length * 8);
      rp = enc.beginRenderPass({ colorAttachments: [{ view: canvas.view(), loadOp: 'clear', storeOp: 'store' }] }); rp.setPipeline(blit); rp.setBindGroup(0, blitG); rp.draw(3);
      const a = split < 0 ? n : split; if (a) { rp.setPipeline(pipe); rp.setBindGroup(0, g); rp.draw(4, a); }
      if (imgs.length) { rp.setPipeline(ip); imgs.forEach((tex, i) => { rp.setBindGroup(0, imgGroup(tex)); rp.draw(4, 1, 0, i); }); }
      if (split >= 0 && n > split) { rp.setPipeline(pipe); rp.setBindGroup(0, g); rp.draw(4, n - split, 0, split); } rp.end(); },
    count: () => n,
    destroy() { if (bg) { bg.destroy(); half.destroy(); halfB.destroy(); } atlas.destroy(); ibuf.destroy(); imgBuf.destroy(); },
  };
  return ui;
}

/* the iOS 27 furniture on the Duo: the time over the radios disc, top-right */
export function statusCorner(ui, dark = false) {
  const ink = dark ? [0.08, 0.08, 0.09, 1] : [1, 1, 1, 1], glass = dark ? [1, 1, 1, 0.55] : [1, 1, 1, 0.42];
  ui.text(ui.W - 20, 8, '9:41', 11.5, ink, { weight: 600, align: 'right' });
  ui.glassDisc(ui.W - 29, 43, 15, glass, 0.25);
  ui.icon('radios', ui.W - 29 - 8, 43 - 8, 16, [0.08, 0.08, 0.09, 1], (x) => { x.lineWidth = 0.1; x.beginPath(); x.arc(0.5, 0.78, 0.44, Math.PI * 1.22, Math.PI * 1.78); x.stroke(); x.beginPath(); x.arc(0.5, 0.78, 0.25, Math.PI * 1.2, Math.PI * 1.8); x.stroke(); x.beginPath(); x.arc(0.5, 0.78, 0.06, 0, Math.PI * 2); x.fill(); });
}
/* icons the apps share */
export const ICONS = {
  search: (x) => { x.beginPath(); x.arc(0.42, 0.42, 0.28, 0, Math.PI * 2); x.stroke(); x.beginPath(); x.moveTo(0.63, 0.63); x.lineTo(0.88, 0.88); x.stroke(); },
  chevron: (x) => { x.beginPath(); x.moveTo(0.38, 0.22); x.lineTo(0.66, 0.5); x.lineTo(0.38, 0.78); x.stroke(); },
  chevronL: (x) => { x.beginPath(); x.moveTo(0.62, 0.22); x.lineTo(0.34, 0.5); x.lineTo(0.62, 0.78); x.stroke(); },
  up: (x) => { x.beginPath(); x.moveTo(0.5, 0.78); x.lineTo(0.5, 0.22); x.moveTo(0.28, 0.44); x.lineTo(0.5, 0.22); x.lineTo(0.72, 0.44); x.stroke(); },
  down: (x) => { x.beginPath(); x.moveTo(0.5, 0.22); x.lineTo(0.5, 0.78); x.moveTo(0.28, 0.56); x.lineTo(0.5, 0.78); x.lineTo(0.72, 0.56); x.stroke(); },
  plus: (x) => { x.beginPath(); x.moveTo(0.5, 0.2); x.lineTo(0.5, 0.8); x.moveTo(0.2, 0.5); x.lineTo(0.8, 0.5); x.stroke(); },
  more: (x) => { for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(0.25 + i * 0.25, 0.5, 0.07, 0, Math.PI * 2); x.fill(); } },
  filter: (x) => { x.beginPath(); x.moveTo(0.2, 0.3); x.lineTo(0.8, 0.3); x.moveTo(0.3, 0.5); x.lineTo(0.7, 0.5); x.moveTo(0.4, 0.7); x.lineTo(0.6, 0.7); x.stroke(); },
  share: (x) => { x.beginPath(); x.moveTo(0.5, 0.62); x.lineTo(0.5, 0.15); x.moveTo(0.34, 0.3); x.lineTo(0.5, 0.15); x.lineTo(0.66, 0.3); x.stroke(); x.beginPath(); x.moveTo(0.34, 0.45); x.lineTo(0.22, 0.45); x.lineTo(0.22, 0.85); x.lineTo(0.78, 0.85); x.lineTo(0.78, 0.45); x.lineTo(0.66, 0.45); x.stroke(); },
  pin: (x) => { x.beginPath(); x.arc(0.5, 0.4, 0.22, Math.PI * 0.85, Math.PI * 2.15); x.lineTo(0.5, 0.88); x.closePath(); x.stroke(); x.beginPath(); x.arc(0.5, 0.4, 0.07, 0, Math.PI * 2); x.fill(); },
  plane: (x) => { x.beginPath(); x.moveTo(0.12, 0.55); x.lineTo(0.42, 0.5); x.lineTo(0.62, 0.15); x.lineTo(0.72, 0.18); x.lineTo(0.62, 0.52); x.lineTo(0.86, 0.6); x.lineTo(0.86, 0.68); x.lineTo(0.58, 0.64); x.lineTo(0.42, 0.9); x.lineTo(0.34, 0.88); x.lineTo(0.4, 0.62); x.lineTo(0.12, 0.62); x.closePath(); x.fill(); },
  bed: (x) => { x.beginPath(); x.moveTo(0.15, 0.75); x.lineTo(0.15, 0.35); x.moveTo(0.15, 0.55); x.lineTo(0.85, 0.55); x.lineTo(0.85, 0.75); x.moveTo(0.15, 0.55); x.lineTo(0.15, 0.55); x.stroke(); x.beginPath(); x.arc(0.3, 0.44, 0.08, 0, Math.PI * 2); x.fill(); },
  train: (x) => { x.beginPath(); x.roundRect(0.25, 0.15, 0.5, 0.6, 0.12); x.stroke(); x.beginPath(); x.moveTo(0.25, 0.5); x.lineTo(0.75, 0.5); x.moveTo(0.32, 0.88); x.lineTo(0.4, 0.75); x.moveTo(0.68, 0.88); x.lineTo(0.6, 0.75); x.stroke(); x.beginPath(); x.arc(0.38, 0.64, 0.045, 0, 7); x.arc(0.62, 0.64, 0.045, 0, 7); x.fill(); },
  swap: (x) => { x.beginPath(); x.moveTo(0.2, 0.38); x.lineTo(0.8, 0.38); x.moveTo(0.64, 0.22); x.lineTo(0.8, 0.38); x.lineTo(0.64, 0.54); x.moveTo(0.8, 0.66); x.lineTo(0.2, 0.66); x.moveTo(0.36, 0.5); x.lineTo(0.2, 0.66); x.lineTo(0.36, 0.82); x.stroke(); },
  calendar: (x) => { x.beginPath(); x.roundRect(0.16, 0.22, 0.68, 0.62, 0.08); x.stroke(); x.beginPath(); x.moveTo(0.16, 0.4); x.lineTo(0.84, 0.4); x.moveTo(0.34, 0.14); x.lineTo(0.34, 0.3); x.moveTo(0.66, 0.14); x.lineTo(0.66, 0.3); x.stroke(); },
  person: (x) => { x.beginPath(); x.arc(0.5, 0.36, 0.16, 0, Math.PI * 2); x.stroke(); x.beginPath(); x.arc(0.5, 0.95, 0.34, Math.PI * 1.15, Math.PI * 1.85); x.stroke(); },
  send: (x) => { x.beginPath(); x.moveTo(0.18, 0.5); x.lineTo(0.82, 0.5); x.moveTo(0.6, 0.28); x.lineTo(0.82, 0.5); x.lineTo(0.6, 0.72); x.stroke(); },
  card: (x) => { x.beginPath(); x.roundRect(0.14, 0.26, 0.72, 0.48, 0.07); x.stroke(); x.beginPath(); x.moveTo(0.14, 0.42); x.lineTo(0.86, 0.42); x.stroke(); },
  bee: (x) => { x.beginPath(); x.ellipse(0.5, 0.55, 0.26, 0.18, 0, 0, Math.PI * 2); x.fill(); x.globalCompositeOperation = 'destination-out'; x.lineWidth = 0.06; x.beginPath(); x.moveTo(0.42, 0.38); x.lineTo(0.42, 0.72); x.moveTo(0.56, 0.38); x.lineTo(0.56, 0.72); x.stroke(); x.globalCompositeOperation = 'source-over'; x.beginPath(); x.ellipse(0.4, 0.3, 0.12, 0.08, -0.5, 0, Math.PI * 2); x.ellipse(0.6, 0.3, 0.12, 0.08, 0.5, 0, Math.PI * 2); x.fill(); },
  check: (x) => { x.beginPath(); x.moveTo(0.22, 0.52); x.lineTo(0.42, 0.72); x.lineTo(0.8, 0.3); x.stroke(); },
  clock: (x) => { x.beginPath(); x.arc(0.5, 0.5, 0.33, 0, Math.PI * 2); x.stroke(); x.beginPath(); x.moveTo(0.5, 0.3); x.lineTo(0.5, 0.52); x.lineTo(0.66, 0.6); x.stroke(); },
  spark: (x) => { x.beginPath(); x.moveTo(0.5, 0.12); x.lineTo(0.58, 0.42); x.lineTo(0.88, 0.5); x.lineTo(0.58, 0.58); x.lineTo(0.5, 0.88); x.lineTo(0.42, 0.58); x.lineTo(0.12, 0.5); x.lineTo(0.42, 0.42); x.closePath(); x.fill(); },
  sidebar: (x) => { x.beginPath(); x.roundRect(0.14, 0.22, 0.72, 0.56, 0.08); x.stroke(); x.beginPath(); x.moveTo(0.38, 0.22); x.lineTo(0.38, 0.78); x.stroke(); },
  grid: (x) => { for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { x.beginPath(); x.roundRect(0.2 + i * 0.34, 0.2 + j * 0.34, 0.26, 0.26, 0.05); x.stroke(); } },
  x: (x) => { x.beginPath(); x.moveTo(0.28, 0.28); x.lineTo(0.72, 0.72); x.moveTo(0.72, 0.28); x.lineTo(0.28, 0.72); x.stroke(); },
};
