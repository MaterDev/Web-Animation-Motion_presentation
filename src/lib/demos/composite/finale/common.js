// @ts-nocheck -- the few helpers duo.js needs, copied from src/lib/demos/webgpu/device/common.js; untyped sheet code
/* One device for this mount. The device demo's common.js also holds the card
   registry, the bytes counter and the timestamp ring; the finale needs none of
   them, so only acquisition and the three pipeline helpers duo.js calls are
   copied. `device` is module state, set by getDevice and cleared on release. */
export let device = null, format = null;
export const DPR = Math.min(2, window.devicePixelRatio || 1);
export async function getDevice() {
  if (!navigator.gpu) throw new Error('navigator.gpu is undefined');
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
  if (!adapter) throw new Error('requestAdapter() returned null');
  const dev = await adapter.requestDevice();
  device = dev; format = navigator.gpu.getPreferredCanvasFormat();
  return dev;
}
export function releaseDevice(dev) {
  if (dev) { try { dev.destroy(); } catch {} }
  if (!dev || dev === device) { device = null; format = null; }
}
export const uniform = (size) => device.createBuffer({ size: Math.max(16, Math.ceil(size / 16) * 16), usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
export function render(code, opts = {}) {
  const m = device.createShaderModule({ code });
  return device.createRenderPipeline({ layout: 'auto', vertex: { module: m, entryPoint: 'vs' }, fragment: { module: m, entryPoint: 'fs', targets: [{ format: opts.format || format }] }, primitive: { topology: 'triangle-list' } });
}
/* a full-screen triangle vertex stage, for image-like passes */
export const FSQ_VS = `struct VO { @builtin(position) p: vec4f, @location(0) uv: vec2f };
@vertex fn vs(@builtin(vertex_index) i: u32) -> VO { var o: VO; let x = f32((i << 1u) & 2u); let y = f32(i & 2u); o.uv = vec2f(x, 1.0 - y); o.p = vec4f(x * 2.0 - 1.0, y * 2.0 - 1.0, 0.0, 1.0); return o; }`;
/* a CSS colour (any syntax, oklch included) → display-encoded [r, g, b, 1] via a 1 × 1 canvas */
const pxc = document.createElement('canvas'); pxc.width = pxc.height = 1; const pxx = pxc.getContext('2d', { willReadFrequently: true });
export function cssRGB(value) { pxx.clearRect(0, 0, 1, 1); pxx.fillStyle = '#000'; pxx.fillRect(0, 0, 1, 1); pxx.fillStyle = value || '#f0f'; pxx.fillRect(0, 0, 1, 1);
  const d = pxx.getImageData(0, 0, 1, 1).data; return [d[0] / 255, d[1] / 255, d[2] / 255, 1]; }
