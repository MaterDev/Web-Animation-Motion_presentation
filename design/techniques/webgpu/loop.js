/* §2 · particles as interface — one kernel, four products.
   Each grain has a position, a velocity and a target; the target set is
   uploaded when the product's state changes (a keystroke, a gesture, a
   tap) and never per frame. The kernel gathers to the target, obeys wind,
   gravity and jitter, and flees the pointer. */
import { $, DPR, TAU, col, hash2, storage, uniform, compute, render, bind, attach, card, pointer, timer } from './common.js';

const KERNEL = `
struct U { n: u32, mode: u32, dt: f32, time: f32, gather: f32, gravity: f32, damp: f32, jitter: f32, ptr: vec2f, ptrR: f32, ptrF: f32, wind: vec2f, aspect: f32, settle: f32 };
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read_write> pos: array<vec2f>;
@group(0) @binding(2) var<storage, read_write> vel: array<vec2f>;
@group(0) @binding(3) var<storage, read> tgt: array<vec2f>;
fn hash(n: u32) -> f32 { var x = n * 747796405u + 2891336453u; x = ((x >> ((x >> 28u) + 4u)) ^ x) * 277803737u; x = (x >> 22u) ^ x; return f32(x) / 4294967295.0; }
@compute @workgroup_size(256) fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x; if (i >= u.n) { return; }
  var p = pos[i]; var v = vel[i]; let tg = tgt[i]; let h = hash(i);
  var a = vec2f(0.0);
  /* gather to the target, with a per-grain delay so a change ripples */
  let d = tg - p; a += d * u.gather * (0.6 + 0.8 * h);
  a += u.wind * (0.7 + 0.6 * hash(i + 1u));
  a.y -= u.gravity;
  let ph = u.time * (0.8 + h) + h * 6.2831853; a += vec2f(sin(ph * 1.3 + p.y * 9.0), cos(ph * 0.9 + p.x * 7.0)) * u.jitter;
  /* the hand */
  let dp = (p - u.ptr) * vec2f(u.aspect, 1.0); let dd = length(dp);
  if (dd < u.ptrR) { a += dp / (dd + 1e-4) * u.ptrF * (1.0 - dd / u.ptrR); }
  v = v * u.damp + a * u.dt; p += v * u.dt;
  /* the floor, for the pouring switch and the sand */
  if (u.settle > 0.5 && p.y < 0.02) { p.y = 0.02; v.y = abs(v.y) * 0.2; v.x *= 0.9; }
  if (p.x < -0.05) { p.x += 1.1; } if (p.x > 1.05) { p.x -= 1.1; } if (p.y < -0.05) { p.y += 1.1; } if (p.y > 1.05) { p.y -= 1.1; }
  pos[i] = p; vel[i] = v;
}`;
const DRAW = `
struct R { res: vec2f, size: f32, alpha: f32, a: vec4f, b: vec4f, aspect: f32, pad: f32, pad2: vec2f };
@group(0) @binding(0) var<uniform> r: R;
@group(0) @binding(1) var<storage, read> pos: array<vec2f>;
@group(0) @binding(2) var<storage, read> vel: array<vec2f>;
struct VO { @builtin(position) p: vec4f, @location(0) c: vec4f, @location(1) q: vec2f };
fn hash(n: u32) -> f32 { var x = n * 747796405u + 2891336453u; x = ((x >> ((x >> 28u) + 4u)) ^ x) * 277803737u; x = (x >> 22u) ^ x; return f32(x) / 4294967295.0; }
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO {
  let corner = vec2f(f32(vi & 1u), f32((vi >> 1u) & 1u)) * 2.0 - 1.0;
  let p = pos[ii]; let sp = length(vel[ii]);
  var o: VO; let sz = r.size * (0.6 + 0.8 * hash(ii));
  o.p = vec4f((p * 2.0 - 1.0) + corner * sz / r.res, 0.0, 1.0); o.q = corner;
  o.c = mix(r.a, r.b, clamp(hash(ii + 7u) * 0.7 + sp * 0.4, 0.0, 1.0)); return o;
}
@fragment fn fs(o: VO) -> @location(0) vec4f { if (dot(o.q, o.q) > 1.0) { discard; } return vec4f(o.c.rgb, r.alpha); }`;

/* text → target points, uploaded once per change */
function textTargets(text, n, box, fontPx, weight) {
  const W = 512, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d', { willReadFrequently: true });
  x.clearRect(0, 0, W, H); x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `${weight || 800} ${fontPx}px Inter, system-ui, sans-serif`; const tw = x.measureText(text).width; if (tw > W * 0.94) { x.font = `${weight || 800} ${Math.floor(fontPx * W * 0.94 / tw)}px Inter, system-ui, sans-serif`; } x.fillText(text, W / 2, H / 2);
  const d = x.getImageData(0, 0, W, H).data, list = [];
  for (let j = 0; j < H; j += 2) for (let i = 0; i < W; i += 2) if (d[(j * W + i) * 4 + 3] > 120) list.push([i / W, 1 - j / H]);
  const out = new Float32Array(n * 2);
  for (let k = 0; k < n; k++) { const p = list.length ? list[Math.floor(hash2(k, 5) * list.length)] : [0.5, 0.5]; out[k * 2] = box.x + p[0] * box.w + (hash2(k, 9) - 0.5) * 0.006; out[k * 2 + 1] = box.y + p[1] * box.h + (hash2(k, 11) - 0.5) * 0.006; }
  return out;
}
function makeSystem(dev, canvas, n, colA, colB, opts) {
  const { ctx, fit } = attach(canvas);
  const pos = storage(n * 8), vel = storage(n * 8), target = storage(n * 8);
  const seed = new Float32Array(n * 2); for (let i = 0; i < n; i++) { seed[i * 2] = hash2(i, 1); seed[i * 2 + 1] = hash2(i, 2); } dev.queue.writeBuffer(pos, 0, seed); dev.queue.writeBuffer(target, 0, seed);
  const u = uniform(64), ru = uniform(64), pk = compute(KERNEL), pd = render(DRAW, { blend: true });
  const bk = bind(pk, [u, pos, vel, target]), bd = bind(pd, [ru, pos, vel]);
  const U = new ArrayBuffer(64), Ui = new Uint32Array(U), Uf = new Float32Array(U);
  return {
    n, target, setTargets: (arr) => dev.queue.writeBuffer(target, 0, arr),
    frame(enc, p, ts) {
      fit(); const aspect = canvas.width / canvas.height;
      Ui[0] = n; Ui[1] = 0; Uf[2] = Math.min(p.dt, 1 / 30); Uf[3] = p.time; Uf[4] = p.gather; Uf[5] = p.gravity; Uf[6] = p.damp; Uf[7] = p.jitter; Uf[8] = p.ptr[0]; Uf[9] = p.ptr[1]; Uf[10] = p.ptrR; Uf[11] = p.ptrF; Uf[12] = p.wind[0]; Uf[13] = p.wind[1]; Uf[14] = aspect; Uf[15] = p.settle ? 1 : 0;
      dev.queue.writeBuffer(u, 0, U);
      dev.queue.writeBuffer(ru, 0, new Float32Array([canvas.width, canvas.height, opts.size * DPR, opts.alpha, ...colA, ...colB, aspect, 0, 0, 0]));
      const cp = enc.beginComputePass(ts || {}); cp.setPipeline(pk); cp.setBindGroup(0, bk); cp.dispatchWorkgroups(Math.ceil(n / 256)); cp.end();
      const rp = enc.beginRenderPass({ colorAttachments: [{ view: ctx.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: opts.bg[0], g: opts.bg[1], b: opts.bg[2], a: 1 } }] });
      rp.setPipeline(pd); rp.setBindGroup(0, bd); rp.draw(4, n); rp.end();
    }
  };
}

export function loopCards() {
  const out = [];
  /* ── ATLAS · sand that spells the destination ─────────────────────── */
  {
    const el = $('at-card'), stage = $('at-stage'), canvas = $('at-canvas'), input = $('at-input'); let sys = null, ptr = [-9, -9], text = input.value || 'Lisbon';
    pointer(stage, (p) => { ptr = [p.x, 1 - p.y]; }, () => { ptr = [-9, -9]; });
    const retarget = () => sys && sys.setTargets(textTargets(text.toUpperCase(), sys.n, { x: 0.05, y: 0.28, w: 0.9, h: 0.5 }, text.length > 8 ? 120 : 160, 800));
    input.addEventListener('input', () => { text = input.value.trim() || 'Lisbon'; retarget(); }); $('at-go').addEventListener('click', retarget);
    out.push(card({ name: 'atlas', el, init() { sys = makeSystem(this.__dev, canvas, 160000, col(el, '--at-ink'), col(el, '--at-acc'), { size: 1.6, alpha: 0.55, bg: col(el, '--at-bg') }); retarget(); },
      frame(t, dt, now) { if (!sys) return; const enc = this.__dev.createCommandEncoder(); sys.frame(enc, { dt, time: now / 1000, gather: 18.0, gravity: 0.0, damp: 0.86, jitter: 0.012, ptr, ptrR: 0.12, ptrF: 3.0, wind: [0, 0], settle: false }); this.__dev.queue.submit([enc.finish()]); } }));
  }
  /* ── NECTAR · pull to refresh, as a swarm ─────────────────────────── */
  {
    const el = $('nc-card'), stage = $('nc-stage'), canvas = $('nc-canvas'); let sys = null, ptr = [-9, -9], pull = 0, dragging = false, y0 = 0, phase = 'rest', tPhase = 0, ring = null, hive = null;
    const balances = ['£2,418.60', '£2,431.15', '£2,396.02', '£2,502.77'];
    const mkRing = (n) => { const a = new Float32Array(n * 2); for (let k = 0; k < n; k++) { const t = hash2(k, 3) * TAU, r = 0.32 + 0.1 * hash2(k, 4); a[k * 2] = 0.5 + Math.cos(t) * r * 0.62; a[k * 2 + 1] = 0.52 + Math.sin(t) * r; } return a; };
    const mkHive = (n) => { const a = new Float32Array(n * 2); for (let k = 0; k < n; k++) { const t = hash2(k, 3) * TAU, r = Math.sqrt(hash2(k, 4)) * 0.09; a[k * 2] = 0.5 + Math.cos(t) * r * 0.9; a[k * 2 + 1] = 0.86 + Math.sin(t) * r * 0.5; } return a; };
    pointer(stage, (p) => { ptr = [p.x, 1 - p.y]; if (dragging && phase === 'rest') { pull = Math.max(0, Math.min(1, (p.y - y0) * 3)); $('nc-pull').textContent = pull > 0.85 ? 'release to refresh' : 'pull down to refresh'; } }, () => { ptr = [-9, -9]; }, (p) => { dragging = true; y0 = p.y; }, () => { dragging = false; if (pull > 0.85 && phase === 'rest') { phase = 'forage'; tPhase = performance.now(); sys.setTargets(ring); $('nc-sub').textContent = 'refreshing…'; } pull = 0; $('nc-pull').textContent = 'pull down to refresh'; });
    out.push(card({ name: 'nectar', el, init() { sys = makeSystem(this.__dev, canvas, 36000, col(el, '--nc-gold'), col(el, '--nc-ink'), { size: 2.0, alpha: 0.75, bg: col(el, '--nc-bg') }); ring = mkRing(sys.n); hive = mkHive(sys.n); sys.setTargets(hive); },
      frame(t, dt, now) { if (!sys) return;
        if (phase === 'forage' && now - tPhase > 1600) { phase = 'return'; tPhase = now; sys.setTargets(hive); $('nc-bal').textContent = balances[Math.floor(now / 1000) % balances.length]; $('nc-sub').textContent = 'updated just now'; }
        if (phase === 'return' && now - tPhase > 1400) phase = 'rest';
        const g = phase === 'forage' ? 2.2 : 5.0, jit = phase === 'forage' ? 0.05 : 0.014 + pull * 0.04;
        const enc = this.__dev.createCommandEncoder(); sys.frame(enc, { dt, time: now / 1000, gather: g, gravity: -pull * 0.5, damp: 0.9, jitter: jit, ptr, ptrR: 0.14, ptrF: 1.5, wind: [0, 0], settle: false }); this.__dev.queue.submit([enc.finish()]); } }));
  }
  /* ── UMBRA · the switch that pours ────────────────────────────────── */
  {
    const el = $('um-card'), stage = $('um-stage'), canvas = $('um-canvas'); let sys = null, on = false, ptr = [-9, -9], left = null, right = null, tFlip = 0;
    /* a cone of light from a pendant: dense on the floor, narrowing to the lamp */
    const basin = (n, cx) => { const a = new Float32Array(n * 2); for (let k = 0; k < n; k++) { const y = 0.04 + Math.pow(hash2(k, 3), 1.7) * 0.86, hw = 0.03 + (1 - y) * 0.2; a[k * 2] = cx + (hash2(k, 4) - 0.5) * 2 * hw * Math.sqrt(hash2(k, 8)); a[k * 2 + 1] = y; } return a; };
    pointer(stage, (p) => { ptr = [p.x, 1 - p.y]; }, () => { ptr = [-9, -9]; }, () => { if (!sys) return; on = !on; tFlip = performance.now(); sys.setTargets(on ? right : left); $('um-state').textContent = on ? 'evening · 40%' : 'off'; el.style.setProperty('--um-bg', on ? 'oklch(0.22 0.05 70)' : 'oklch(0.13 0.03 262)'); });
    out.push(card({ name: 'umbra', el, init() { sys = makeSystem(this.__dev, canvas, 80000, col(el, '--um-warm'), col(el, '--um-dim'), { size: 1.7, alpha: 0.8, bg: col(el, '--um-bg') }); left = basin(sys.n, 0.24); right = basin(sys.n, 0.76); sys.setTargets(left); },
      frame(t, dt, now) { if (!sys) return; const since = (now - tFlip) / 1000, pouring = since < 2.2;
        const bg = col(el, '--um-bg');
        const enc = this.__dev.createCommandEncoder(); sys.frame(enc, { dt, time: now / 1000, gather: pouring ? 1.4 : 4.0, gravity: pouring ? 1.2 : 0.0, damp: 0.9, jitter: 0.01, ptr, ptrR: 0.1, ptrF: 1.2, wind: [0, 0], settle: true }); this.__dev.queue.submit([enc.finish()]); void bg; } }));
  }
  /* ── FIELD NOTES · pollen in a wind ───────────────────────────────── */
  {
    const el = $('fn-card'), stage = $('fn-stage'), canvas = $('fn-canvas'); let sys = null, ptr = [-9, -9];
    pointer(stage, (p) => { ptr = [p.x, 1 - p.y]; }, () => { ptr = [-9, -9]; });
    out.push(card({ name: 'fieldnotes', el, init() { sys = makeSystem(this.__dev, canvas, 300000, col(el, '--fn-dim'), col(el, '--fn-ink'), { size: 2.4, alpha: 0.05, bg: col(el, '--fn-bg') });
        /* a haze that is thick at the top of the sky and thins toward the headline */
        const tg = new Float32Array(sys.n * 2); for (let k = 0; k < sys.n; k++) { const h = hash2(k, 21); const w = hash2(k, 22); tg[k * 2] = 0.1 + Math.pow(w, 0.55) * 0.95; tg[k * 2 + 1] = 1 - h * h * 0.95; } sys.setTargets(tg); },
      frame(t, dt, now) { if (!sys) return; const T = now / 1000; const enc = this.__dev.createCommandEncoder(); sys.frame(enc, { dt, time: T, gather: 0.5, gravity: 0.0, damp: 0.96, jitter: 0.02, ptr, ptrR: 0.16, ptrF: 2.4, wind: [0.06 + 0.03 * Math.sin(T * 0.21), 0.01 * Math.sin(T * 0.17)], settle: false }); this.__dev.queue.submit([enc.finish()]); } }));
  }
  return out;
}
