/* §6 · SUM! — a kids' maths game that reads handwriting on the device.
   Each answer box is a small canvas the child draws on; on every lift the
   drawing is downsampled to 28×28, centred by its mass the way MNIST is,
   and pushed through the two-layer network trained in this repository —
   two matmul passes in WGSL — and ten scores come back. */
import { $, DPR, storage, uniform, readback, compute, bind, card } from './common.js';

const L1 = `
struct U { inN: u32, hid: u32, outN: u32, pad: u32, s1: f32, s2: f32, pad2: vec2f };
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> x: array<f32>;
@group(0) @binding(2) var<storage, read> w1: array<u32>;
@group(0) @binding(3) var<storage, read> b1: array<f32>;
@group(0) @binding(4) var<storage, read_write> h: array<f32>;
fn w(i: u32) -> f32 { let word = w1[i >> 2u]; let byte = (word >> ((i & 3u) * 8u)) & 255u; let v = i32(byte); return f32(select(v, v - 256, v > 127)) * u.s1; }
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) id: vec3u) { let j = id.x; if (j >= u.hid) { return; } var s = b1[j]; let row = j * u.inN; for (var i = 0u; i < u.inN; i++) { s += w(row + i) * x[i]; } h[j] = max(s, 0.0); }`;
const L2 = `
struct U { inN: u32, hid: u32, outN: u32, pad: u32, s1: f32, s2: f32, pad2: vec2f };
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> h: array<f32>;
@group(0) @binding(2) var<storage, read> w2: array<u32>;
@group(0) @binding(3) var<storage, read> b2: array<f32>;
@group(0) @binding(4) var<storage, read_write> z: array<f32>;
fn w(i: u32) -> f32 { let word = w2[i >> 2u]; let byte = (word >> ((i & 3u) * 8u)) & 255u; let v = i32(byte); return f32(select(v, v - 256, v > 127)) * u.s2; }
@compute @workgroup_size(16) fn main(@builtin(global_invocation_id) id: vec3u) { let k = id.x; if (k >= u.outN) { return; } var s = b2[k]; let row = k * u.hid; for (var j = 0u; j < u.hid; j++) { s += w(row + j) * h[j]; } z[k] = s; }`;
const b64 = (s) => { const bin = atob(s); const a = new Uint8Array(bin.length); for (let i = 0; i < a.length; i++) a[i] = bin.charCodeAt(i); return a; };

export function inferCard() {
  const el = $('sm-card'), M = globalThis.WG_MNIST; let s = null, score = 0, asked = 0, a = 7, b = 5;
  const boxes = [0, 1].map((i) => { const box = $('sm-box-' + i), canvas = $('sm-canvas-' + i); const ctx = canvas.getContext('2d'); return { box, canvas, ctx, strokes: [], guess: null, drawing: false, last: null }; });
  const fitBox = (bx) => { const r = bx.box.getBoundingClientRect(); const w = Math.round(r.width * DPR), h = Math.round(r.height * DPR); if (bx.canvas.width !== w || bx.canvas.height !== h) { bx.canvas.width = w; bx.canvas.height = h; redraw(bx); } };
  const redraw = (bx) => { const c = bx.ctx, W = bx.canvas.width; c.clearRect(0, 0, W, bx.canvas.height); c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = '#1f1a4a'; c.lineWidth = W * 0.09; bx.strokes.forEach((st) => { c.beginPath(); st.forEach(([x, y], i) => i ? c.lineTo(x * W, y * bx.canvas.height) : c.moveTo(x * W, y * bx.canvas.height)); c.stroke(); }); };
  boxes.forEach((bx) => {
    const at = (e) => { const r = bx.box.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
    bx.box.addEventListener('pointerdown', (e) => { try { bx.box.setPointerCapture(e.pointerId); } catch {} bx.drawing = true; bx.strokes.push([at(e)]); redraw(bx); });
    bx.box.addEventListener('pointermove', (e) => { if (!bx.drawing) return; bx.strokes[bx.strokes.length - 1].push(at(e)); redraw(bx); });
    const lift = () => { if (!bx.drawing) return; bx.drawing = false; classify(bx); };
    bx.box.addEventListener('pointerup', lift); bx.box.addEventListener('pointerleave', lift);
  });
  /* 28×28, centred by mass in a 20×20 box, the way MNIST digits are */
  function sample(bx) {
    const S = 56, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(bx.canvas, 0, 0, S, S);
    const d = x.getImageData(0, 0, S, S).data, g = new Float32Array(S * S); let minx = S, maxx = -1, miny = S, maxy = -1;
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const v = d[(j * S + i) * 4 + 3] / 255; g[j * S + i] = v; if (v > 0.1) { minx = Math.min(minx, i); maxx = Math.max(maxx, i); miny = Math.min(miny, j); maxy = Math.max(maxy, j); } }
    if (maxx < 0) return null;
    const bw = maxx - minx + 1, bh = maxy - miny + 1, scale = 20 / Math.max(bw, bh), out = new Float32Array(784);
    let sx = 0, sy = 0, sm = 0;
    for (let j = 0; j < 28; j++) for (let i = 0; i < 28; i++) { const gx = minx + (i - 4) / scale, gy = miny + (j - 4) / scale; let v = 0; if (gx >= 0 && gy >= 0 && gx < S - 1 && gy < S - 1) { const x0 = gx | 0, y0 = gy | 0, fx = gx - x0, fy = gy - y0; v = g[y0 * S + x0] * (1 - fx) * (1 - fy) + g[y0 * S + x0 + 1] * fx * (1 - fy) + g[(y0 + 1) * S + x0] * (1 - fx) * fy + g[(y0 + 1) * S + x0 + 1] * fx * fy; } out[j * 28 + i] = v; sx += i * v; sy += j * v; sm += v; }
    /* shift so the centre of mass sits at the centre */
    const cx = sm ? sx / sm : 14, cy = sm ? sy / sm : 14, dx = Math.round(14 - cx), dy = Math.round(14 - cy), sh = new Float32Array(784);
    for (let j = 0; j < 28; j++) for (let i = 0; i < 28; i++) { const si = i - dx, sj = j - dy; if (si >= 0 && si < 28 && sj >= 0 && sj < 28) sh[j * 28 + i] = out[sj * 28 + si]; }
    return sh;
  }
  async function classify(bx) {
    if (!s || s.busy) return; const x = sample(bx); if (!x) { bx.guess = null; $('sm-g-' + boxes.indexOf(bx)).textContent = '·'; return; }
    s.busy = true; const dev = this_dev; const t0 = performance.now();
    dev.queue.writeBuffer(s.xb, 0, x);
    const enc = dev.createCommandEncoder(); let pass = enc.beginComputePass(); pass.setPipeline(s.p1); pass.setBindGroup(0, s.g1); pass.dispatchWorkgroups(Math.ceil(M.hidden / 64)); pass.setPipeline(s.p2); pass.setBindGroup(0, s.g2); pass.dispatchWorkgroups(1); pass.end();
    enc.copyBufferToBuffer(s.zb, 0, s.zr, 0, 40); dev.queue.submit([enc.finish()]);
    await s.zr.mapAsync(GPUMapMode.READ); const z = new Float32Array(s.zr.getMappedRange().slice(0)); s.zr.unmap(); s.busy = false;
    const ms = performance.now() - t0; let am = 0; for (let k = 1; k < 10; k++) if (z[k] > z[am]) am = k;
    let mx = z[am], sum = 0; for (let k = 0; k < 10; k++) sum += Math.exp(z[k] - mx); const conf = 1 / sum;
    bx.guess = am; $('sm-g-' + boxes.indexOf(bx)).innerHTML = `<b>${am}</b> · ${Math.round(conf * 100)}%`; bx.box.classList.add('sm-read'); $('sm-ms').textContent = ms.toFixed(1) + ' ms';
  }
  let this_dev = null;
  const answer = () => a + b, nextQ = () => { a = 2 + Math.floor(Math.random() * 8); b = 1 + Math.floor(Math.random() * 9); $('sm-a').textContent = a; $('sm-b').textContent = b; clear(); };
  const clear = () => { boxes.forEach((bx, i) => { bx.strokes = []; bx.guess = null; redraw(bx); $('sm-g-' + i).textContent = '·'; bx.box.classList.remove('sm-read'); }); const v = $('sm-verdict'); v.textContent = ''; v.className = 'sm-verdict'; };
  $('sm-clear').addEventListener('click', clear); $('sm-next').addEventListener('click', nextQ);
  $('sm-check').addEventListener('click', () => {
    const ans = answer(), digits = String(ans).split('').map(Number), read = boxes.map((bx) => bx.guess), v = $('sm-verdict');
    const got = digits.length === 1 ? (read[0] === digits[0] && read[1] === null ? digits[0] : (read[1] === digits[0] && read[0] === null ? digits[0] : NaN)) : (read[0] === digits[0] && read[1] === digits[1] ? ans : NaN);
    asked++; if (got === ans) { score++; v.textContent = `Yes! ${a} + ${b} = ${ans}`; v.className = 'sm-verdict sm-yes'; setTimeout(nextQ, 1400); } else { v.textContent = read.every((g) => g === null) ? 'Write your answer in the boxes' : `Not quite — it reads ${read.filter((g) => g !== null).join('')}. Try again`; v.className = 'sm-verdict'; }
    $('sm-score').innerHTML = `${score}<span>of ${asked}</span>`;
  });
  return card({ name: 'sum', el, init() {
    const dev = this.__dev; this_dev = dev; if (!M) { $('sm-model').textContent = 'model weights not found — run scripts/train-mnist.js'; return; }
    const W1 = b64(M.W1), B1 = new Float32Array(b64(M.b1).buffer), W2 = b64(M.W2), B2 = new Float32Array(b64(M.b2).buffer);
    const pad4 = (u8) => { const p = new Uint8Array(Math.ceil(u8.length / 4) * 4); p.set(u8); return p; };
    const u = uniform(32); dev.queue.writeBuffer(u, 0, new Uint32Array([M.in, M.hidden, M.out, 0])); dev.queue.writeBuffer(u, 16, new Float32Array([M.s1, M.s2, 0, 0]));
    const xb = storage(784 * 4), w1 = storage(pad4(W1).length), b1 = storage(B1.byteLength), hb = storage(M.hidden * 4), w2 = storage(pad4(W2).length), b2 = storage(B2.byteLength), zb = storage(40), zr = readback(40);
    dev.queue.writeBuffer(w1, 0, pad4(W1)); dev.queue.writeBuffer(b1, 0, B1); dev.queue.writeBuffer(w2, 0, pad4(W2)); dev.queue.writeBuffer(b2, 0, B2);
    const p1 = compute(L1), p2 = compute(L2), g1 = bind(p1, [u, xb, w1, b1, hb]), g2 = bind(p2, [u, hb, w2, b2, zb]);
    s = { xb, zb, zr, p1, p2, g1, g2, busy: false };
    $('sm-acc').textContent = (M.testAcc * 100).toFixed(1) + '%'; $('sm-kb').textContent = Math.round((W1.length + W2.length + B1.byteLength + B2.byteLength) / 1024) + ' KB int8';
    boxes.forEach(fitBox); new ResizeObserver(() => boxes.forEach(fitBox)).observe(el);
  }, frame() { /* nothing per frame: this card only computes when the pen lifts */ } });
}
