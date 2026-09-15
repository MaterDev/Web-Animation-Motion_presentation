/* ── SL-14 · shared GPU plumbing for every card on the sheet ─────────────
   One device, many canvases. Each card registers { canvas, init, frame,
   pointer? } and the sheet drives them from one WAM clock; a card that is
   off-screen is not rendered. Nothing here is a framework — a handful of
   helpers so each card's code is its own program and nothing else. */
export const $ = (id) => document.querySelector(`[data-testid="${id}"]`);
export const TAU = Math.PI * 2;
export const DPR = Math.min(2, window.devicePixelRatio || 1);
export const reduced = matchMedia('(prefers-reduced-motion: reduce)');

/* oklch tokens → display-encoded floats via canvas 2D (no lighting maths on
   this sheet needs linear; the canvases are bgra8unorm) */
const pxc = document.createElement('canvas'); pxc.width = pxc.height = 1; const pxx = pxc.getContext('2d', { willReadFrequently: true });
export function col(el, name, alpha = 1) {
  const v = getComputedStyle(el).getPropertyValue(name).trim() || '#ff00ff';
  pxx.fillStyle = '#000'; pxx.fillRect(0, 0, 1, 1); pxx.fillStyle = v; pxx.fillRect(0, 0, 1, 1);
  const d = pxx.getImageData(0, 0, 1, 1).data; return [d[0] / 255, d[1] / 255, d[2] / 255, alpha];
}
export function hash2(i, j) { let n = (i * 374761393 + j * 668265263) | 0; n = (n ^ (n >>> 13)) * 1274126177 | 0; return ((n ^ (n >>> 16)) >>> 0) / 4294967296; }

/* ── device ──────────────────────────────────────────────────────────── */
export let device = null, adapter = null, format = null, hasTS = false;
export const bytes = { frameState: 0, frameUni: 0 };
export async function getDevice() {
  if (device) return device;
  if (!navigator.gpu) throw new Error('navigator.gpu is undefined — this is the fallback rung');
  adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
  if (!adapter) throw new Error('requestAdapter() returned null — WebGPU present, no device obtainable');
  hasTS = adapter.features.has('timestamp-query');
  device = await adapter.requestDevice({ requiredFeatures: hasTS ? ['timestamp-query'] : [], requiredLimits: { maxStorageBufferBindingSize: Math.min(adapter.limits.maxStorageBufferBindingSize, 1 << 30), maxBufferSize: Math.min(adapter.limits.maxBufferSize, 1 << 30) } });
  format = navigator.gpu.getPreferredCanvasFormat();
  /* the counter: every writeBuffer on the queue, split into state and uniforms */
  const wb = device.queue.writeBuffer.bind(device.queue);
  device.queue.writeBuffer = (buf, off, data, dOff, size) => { const n = size !== undefined ? size : (data.byteLength !== undefined ? data.byteLength - (dOff || 0) : 0); if (buf.__uniform) bytes.frameUni += n; else bytes.frameState += n; return wb(buf, off, data, dOff, size); };
  return device;
}
export const adapterName = () => { const i = (adapter && adapter.info) || {}; return [i.vendor, i.architecture, i.description].filter(Boolean).join(' · ') || 'unnamed'; };

/* ── buffers, pipelines, canvases ─────────────────────────────────────── */
export const storage = (size, extra = 0) => device.createBuffer({ size: Math.max(16, size), usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC | extra });
export const uniform = (size) => { const b = device.createBuffer({ size: Math.max(16, Math.ceil(size / 16) * 16), usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }); b.__uniform = true; return b; };
export const readback = (size) => device.createBuffer({ size, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
export const compute = (code, entry = 'main') => device.createComputePipeline({ layout: 'auto', compute: { module: device.createShaderModule({ code }), entryPoint: entry } });
export function render(code, opts = {}) {
  const m = device.createShaderModule({ code });
  const blend = opts.blend === 'add' ? { color: { srcFactor: 'src-alpha', dstFactor: 'one' }, alpha: { srcFactor: 'one', dstFactor: 'one' } } : opts.blend ? { color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' } } : undefined;
  return device.createRenderPipeline({ layout: 'auto', vertex: { module: m, entryPoint: opts.vs || 'vs' }, fragment: { module: m, entryPoint: opts.fs || 'fs', targets: [{ format: opts.format || format, blend }] }, primitive: { topology: opts.topology || 'triangle-list' } });
}
export const bind = (pipe, buffers, group = 0) => device.createBindGroup({ layout: pipe.getBindGroupLayout(group), entries: buffers.map((b, i) => ({ binding: i, resource: b.buffer ? b : { buffer: b } })) });
export function attach(canvas) {
  const ctx = canvas.getContext('webgpu'); ctx.configure({ device, format, alphaMode: 'opaque' });
  const fit = () => { const r = canvas.getBoundingClientRect(); const w = Math.max(2, Math.round(r.width * DPR)), h = Math.max(2, Math.round(r.height * DPR)); if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; return true; } return false; };
  fit(); return { ctx, fit };
}
/* a full-screen triangle vertex stage, for image-like passes */
export const FSQ_VS = `struct VO { @builtin(position) p: vec4f, @location(0) uv: vec2f };
@vertex fn vs(@builtin(vertex_index) i: u32) -> VO { var o: VO; let x = f32((i << 1u) & 2u); let y = f32(i & 2u); o.uv = vec2f(x, 1.0 - y); o.p = vec4f(x * 2.0 - 1.0, y * 2.0 - 1.0, 0.0, 1.0); return o; }`;

/* ── timestamps: a small ring of query pairs, resolved every N frames ─── */
export function timer(passNames, every = 30) {
  if (!hasTS) return { begin: () => ({}), resolve: () => {}, read: () => ({}), names: passNames, available: false };
  const n = passNames.length, qs = device.createQuerySet({ type: 'timestamp', count: n * 2 });
  const buf = device.createBuffer({ size: n * 16, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC });
  const rb = readback(n * 16); const samples = {}; let pending = false, frame = 0;
  return {
    available: true, names: passNames,
    begin: (i) => ({ timestampWrites: { querySet: qs, beginningOfPassWriteIndex: i * 2, endOfPassWriteIndex: i * 2 + 1 } }),
    resolve(enc) { frame++; if (pending || frame % every) return; enc.resolveQuerySet(qs, 0, n * 2, buf, 0); enc.copyBufferToBuffer(buf, 0, rb, 0, n * 16); pending = true;
      queueMicrotask(() => rb.mapAsync(GPUMapMode.READ).then(() => { const q = new BigUint64Array(rb.getMappedRange().slice(0)); rb.unmap(); pending = false; passNames.forEach((name, i) => { const ms = Number(q[i * 2 + 1] - q[i * 2]) / 1e6; if (ms >= 0 && ms < 1000) { (samples[name] = samples[name] || []).push(ms); if (samples[name].length > 8) samples[name].shift(); } }); }).catch(() => { pending = false; })); },
    read() { const out = {}; for (const k in samples) { const a = samples[k].slice().sort((x, y) => x - y); out[k] = a[a.length >> 1]; } return out; }
  };
}

/* ── the sheet's clock: one WAM clock, many cards ─────────────────────── */
const cards = [];
export function card(c) { cards.push(c); return c; }
export function pointer(el, onMove, onLeave, onDown, onUp) {
  const at = (e) => { const r = el.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, w: r.width, h: r.height, e }; };
  el.addEventListener('pointermove', (e) => onMove && onMove(at(e)));
  el.addEventListener('pointerdown', (e) => { try { el.setPointerCapture(e.pointerId); } catch {} onDown && onDown(at(e)); });
  el.addEventListener('pointerup', (e) => onUp && onUp(at(e)));
  el.addEventListener('pointerleave', () => onLeave && onLeave());
}
export function run(rootEl, dur = 6000) {
  const seen = new Map();
  const io = new IntersectionObserver((es) => es.forEach((e) => seen.set(e.target, e.isIntersecting)), { rootMargin: '120px' });
  cards.forEach((c) => io.observe(c.el));
  let last = 0;
  return WAM.clock('gp-sheet', { dur, el: rootEl, poster: 0.37, render(t) {
    const now = performance.now(); const dt = reduced.matches ? 1 / 60 : Math.min(1 / 30, last ? (now - last) / 1000 : 1 / 60); last = now;
    bytes.frameState = 0; bytes.frameUni = 0;
    /* a card compiles its pipelines the first time it is in view, so the
       page does not stall on load for shaders it has not scrolled to yet */
    for (const c of cards) { if (seen.get(c.el) === false || c.__err) continue; try { if (!c.__init) { c.__init = true; c.init(); } c.frame(t, dt, now); } catch (e) { if (!c.__err) { c.__err = true; console.error(c.name, e); const st = c.el.querySelector('.gp-status'); if (st) { st.hidden = false; st.textContent = c.name + ': ' + e.message; } } } }
  } });
}
