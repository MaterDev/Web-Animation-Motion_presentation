/* Train a small MLP on MNIST in plain Bun and emit its weights as a
   side-effect global the WebGPU sheet can load as a classic script.

   Why here and not a downloaded model: the sheet's claim is "inference on
   the device, no upload, no API bill", and a model whose provenance is one
   short script in this repo is a model the room can believe. 784 → 128 →
   10, ReLU, softmax; ~102 k weights, quantised to int8 with a per-layer
   scale → ~100 KB on the page.

   Usage: bun scripts/train-mnist.js <mnist-dir> <out.js> [epochs=4] */
import { readFileSync, writeFileSync } from 'node:fs';
const [,, dir, out, epochsArg] = process.argv;
if (!dir || !out) { console.error('usage: bun scripts/train-mnist.js <mnist-dir> <out.js> [epochs]'); process.exit(1); }
const EPOCHS = +(epochsArg || 4), H = 128, IN = 784, OUT = 10, LR = 0.05, BATCH = 32;
function idx(name) { const b = readFileSync(`${dir}/${name}`); const dv = new DataView(b.buffer, b.byteOffset, b.byteLength); const dims = b[3]; let off = 4; const shape = []; for (let i = 0; i < dims; i++) { shape.push(dv.getUint32(off)); off += 4; } return { data: new Uint8Array(b.buffer, b.byteOffset + off), shape }; }
const trX = idx('train-images-idx3-ubyte').data, trY = idx('train-labels-idx1-ubyte').data, teX = idx('t10k-images-idx3-ubyte').data, teY = idx('t10k-labels-idx1-ubyte').data;
const NTR = trY.length, NTE = teY.length;
console.log(`train ${NTR} · test ${NTE}`);
let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const W1 = new Float32Array(IN * H), b1 = new Float32Array(H), W2 = new Float32Array(H * OUT), b2 = new Float32Array(OUT);
for (let i = 0; i < W1.length; i++) W1[i] = (rnd() * 2 - 1) * Math.sqrt(6 / (IN + H));
for (let i = 0; i < W2.length; i++) W2[i] = (rnd() * 2 - 1) * Math.sqrt(6 / (H + OUT));
const x = new Float32Array(IN), h = new Float32Array(H), z = new Float32Array(OUT), p = new Float32Array(OUT), dh = new Float32Array(H);
const gW1 = new Float32Array(IN * H), gb1 = new Float32Array(H), gW2 = new Float32Array(H * OUT), gb2 = new Float32Array(OUT);
function forward(src, o) {
  for (let i = 0; i < IN; i++) x[i] = src[o + i] / 255;
  for (let j = 0; j < H; j++) { let s = b1[j]; const row = j * IN; for (let i = 0; i < IN; i++) s += W1[row + i] * x[i]; h[j] = s > 0 ? s : 0; }
  let mx = -1e9; for (let k = 0; k < OUT; k++) { let s = b2[k]; const row = k * H; for (let j = 0; j < H; j++) s += W2[row + j] * h[j]; z[k] = s; if (s > mx) mx = s; }
  let sum = 0; for (let k = 0; k < OUT; k++) { p[k] = Math.exp(z[k] - mx); sum += p[k]; } for (let k = 0; k < OUT; k++) p[k] /= sum;
}
const order = new Uint32Array(NTR); for (let i = 0; i < NTR; i++) order[i] = i;
const t0 = performance.now();
for (let ep = 0; ep < EPOCHS; ep++) {
  for (let i = NTR - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = order[i]; order[i] = order[j]; order[j] = t; }
  let loss = 0, correct = 0;
  for (let bi = 0; bi < NTR; bi += BATCH) {
    gW1.fill(0); gb1.fill(0); gW2.fill(0); gb2.fill(0);
    const n = Math.min(BATCH, NTR - bi);
    for (let s = 0; s < n; s++) {
      const idxS = order[bi + s], y = trY[idxS]; forward(trX, idxS * IN);
      loss -= Math.log(p[y] + 1e-9); let am = 0; for (let k = 1; k < OUT; k++) if (p[k] > p[am]) am = k; if (am === y) correct++;
      for (let k = 0; k < OUT; k++) { const g = (p[k] - (k === y ? 1 : 0)) / n; gb2[k] += g; const row = k * H; for (let j = 0; j < H; j++) gW2[row + j] += g * h[j]; }
      for (let j = 0; j < H; j++) { if (h[j] <= 0) { dh[j] = 0; continue; } let g = 0; for (let k = 0; k < OUT; k++) g += (p[k] - (k === y ? 1 : 0)) / n * W2[k * H + j]; dh[j] = g; }
      for (let j = 0; j < H; j++) { const g = dh[j]; if (g === 0) continue; gb1[j] += g; const row = j * IN; for (let i = 0; i < IN; i++) gW1[row + i] += g * x[i]; }
    }
    const lr = LR * (1 - ep / EPOCHS * 0.6);
    for (let i = 0; i < W1.length; i++) W1[i] -= lr * gW1[i]; for (let j = 0; j < H; j++) b1[j] -= lr * gb1[j];
    for (let i = 0; i < W2.length; i++) W2[i] -= lr * gW2[i]; for (let k = 0; k < OUT; k++) b2[k] -= lr * gb2[k];
  }
  let tc = 0; for (let i = 0; i < NTE; i++) { forward(teX, i * IN); let am = 0; for (let k = 1; k < OUT; k++) if (p[k] > p[am]) am = k; if (am === teY[i]) tc++; }
  console.log(`epoch ${ep + 1}/${EPOCHS} · loss ${(loss / NTR).toFixed(3)} · train ${(100 * correct / NTR).toFixed(1)}% · test ${(100 * tc / NTE).toFixed(2)}% · ${((performance.now() - t0) / 1000).toFixed(0)} s`);
}
let tc = 0; for (let i = 0; i < NTE; i++) { forward(teX, i * IN); let am = 0; for (let k = 1; k < OUT; k++) if (p[k] > p[am]) am = k; if (am === teY[i]) tc++; }
const acc = tc / NTE;
/* quantise: int8 with a per-layer scale; biases stay float */
function q8(w) { let mx = 0; for (const v of w) mx = Math.max(mx, Math.abs(v)); const s = mx / 127; const q = new Int8Array(w.length); for (let i = 0; i < w.length; i++) q[i] = Math.round(w[i] / s); return { q, s }; }
const q1 = q8(W1), q2 = q8(W2);
const b64 = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');
const meta = { in: IN, hidden: H, out: OUT, epochs: EPOCHS, trainN: NTR, testAcc: +acc.toFixed(4), s1: q1.s, s2: q2.s, trainedOn: new Date().toISOString().slice(0, 10) };
writeFileSync(out, `/* generated by scripts/train-mnist.js — do not edit.\n   ${JSON.stringify(meta)} */\nglobalThis.WG_MNIST = ${JSON.stringify(meta)};\nglobalThis.WG_MNIST.W1 = ${JSON.stringify(b64(q1.q))};\nglobalThis.WG_MNIST.b1 = ${JSON.stringify(b64(b1))};\nglobalThis.WG_MNIST.W2 = ${JSON.stringify(b64(q2.q))};\nglobalThis.WG_MNIST.b2 = ${JSON.stringify(b64(b2))};\n`);
console.log(`wrote ${out} · test accuracy ${(100 * acc).toFixed(2)}%`);
