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

/* a box for text that keeps glyphs square on a non-square canvas */
function textBox(canvas, x, y, w) { const asp = canvas.width / canvas.height; return { x, y, w, h: w * asp * 0.5 }; }
const fmtGBP = (v) => '£' + v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export function loopCards() {
  const out = [];
  /* ── ATLAS · a search made of sand ────────────────────────────────── */
  {
    const el = $('at-card'), stage = $('at-stage'), canvas = $('at-canvas'), input = $('at-input'); let sys = null, ptr = [-9, -9], text = input.value || 'Lisbon', phase = 'name', tPhase = 0, seedHash = 0;
    const PHASES = { name: 3800, chart: 4600, date: 2600, route: 4200 };
    const months = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
    const prices = () => { let h = 0; for (const ch of text.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return months.map((_, m) => 70 + Math.round(120 * hash2(h % 9973, m + 1)) + (m === 6 || m === 7 ? 60 : 0)); };
    const chartTargets = (n) => { const pr = prices(), mx = Math.max(...pr), cum = []; let acc = 0; pr.forEach((v) => { acc += v; cum.push(acc); }); const a = new Float32Array(n * 2);
      for (let k = 0; k < n; k++) { const r = hash2(k, 5) * acc; let m = 0; while (cum[m] < r) m++; const hgt = pr[m] / mx * 0.42; a[k * 2] = 0.06 + m * 0.075 + 0.006 + hash2(k, 9) * 0.05; a[k * 2 + 1] = 0.36 + hash2(k, 11) * hgt; } return a; };
    const routeTargets = (n) => { const a = new Float32Array(n * 2); const P0 = [0.12, 0.42], P1 = [0.5, 0.92], P2 = [0.88, 0.42];
      for (let k = 0; k < n; k++) { const u = hash2(k, 5), r = hash2(k, 9); if (u < 0.12) { const t = hash2(k, 11) * TAU, rr = Math.sqrt(r) * 0.06; a[k * 2] = P0[0] + Math.cos(t) * rr * 0.62; a[k * 2 + 1] = P0[1] + Math.sin(t) * rr; } else if (u < 0.24) { const t = hash2(k, 11) * TAU, rr = Math.sqrt(r) * 0.06; a[k * 2] = P2[0] + Math.cos(t) * rr * 0.62; a[k * 2 + 1] = P2[1] + Math.sin(t) * rr; }
        else { const t = (u - 0.24) / 0.76, x = (1 - t) * (1 - t) * P0[0] + 2 * (1 - t) * t * P1[0] + t * t * P2[0], y = (1 - t) * (1 - t) * P0[1] + 2 * (1 - t) * t * P1[1] + t * t * P2[1]; const dash = Math.floor(t * 40) % 2 ? 1 : 0.35; a[k * 2] = x + (hash2(k, 13) - 0.5) * 0.02 * dash; a[k * 2 + 1] = y + (hash2(k, 15) - 0.5) * 0.03 * dash; } } return a; };
    const setPhase = (ph) => { phase = ph; tPhase = performance.now(); el.dataset.phase = ph; if (!sys) return;
      if (ph === 'name') sys.setTargets(textTargets(text.toUpperCase(), sys.n, { x: 0.05, y: 0.30, w: 0.9, h: 0.5 }, text.length > 8 ? 120 : 160, 800));
      if (ph === 'chart') { sys.setTargets(chartTargets(sys.n)); const pr = prices(); document.querySelectorAll('.at-month').forEach((m, i) => { m.querySelector('b').textContent = '£' + pr[i]; }); $('at-from').textContent = 'from £' + Math.min(...pr) + ' · ' + text; }
      if (ph === 'date') sys.setTargets(textTargets('14 — 21 SEP', sys.n, { x: 0.05, y: 0.34, w: 0.9, h: 0.42 }, 120, 800));
      if (ph === 'route') { sys.setTargets(routeTargets(sys.n)); $('at-r-city').textContent = text; } };
    pointer(stage, (p) => { ptr = [p.x, 1 - p.y]; }, () => { ptr = [-9, -9]; });
    input.addEventListener('input', () => { text = input.value.trim() || 'Lisbon'; setPhase('name'); }); $('at-go').addEventListener('click', () => setPhase('chart'));
    out.push(card({ name: 'atlas', el, init() { sys = makeSystem(this.__dev, canvas, 160000, col(el, '--at-ink'), col(el, '--at-acc'), { size: 1.6, alpha: 0.55, bg: col(el, '--at-bg') }); setPhase('name'); },
      frame(t, dt, now) { if (!sys) return;
        if (now - tPhase > PHASES[phase]) setPhase({ name: 'chart', chart: 'date', date: 'route', route: 'name' }[phase]);
        const enc = this.__dev.createCommandEncoder(); sys.frame(enc, { dt, time: now / 1000, gather: phase === 'route' ? 16.0 : 18.0, gravity: 0.0, damp: 0.86, jitter: phase === 'chart' ? 0.006 : 0.012, ptr, ptrR: 0.12, ptrF: 3.0, wind: [0, 0], settle: false }); this.__dev.queue.submit([enc.finish()]); } }));
  }
  /* ── NECTAR · the balance is the bees ─────────────────────────────── */
  {
    const el = $('nc-card'), stage = $('nc-stage'), canvas = $('nc-canvas'); let sys = null, ptr = [-9, -9], pull = 0, dragging = false, y0 = 0, phase = 'rest', tPhase = 0;
    let balance = 2418.60, shown = 2418.60, from = 2418.60, target = 2418.60, tMove = -9, lastStr = '', nextTx = 0, spent = 0.42, spentShown = 0.42, budgetLabel = null;
    const TXS = [['Ottolenghi', -38.40], ['TfL travel', -6.70], ['Salary · Hive Ltd', 3120.00], ['Rent · Marchmont', -1450.00], ['Refund · Cos', 62.00], ['Deliveroo', -24.90], ['Waterstones', -18.99], ['Interest', 4.12], ['Council tax', -168.00], ['Transfer from Joint', 200.00]];
    const gold = col(el, '--nc-gold'), ink = col(el, '--nc-ink'), colA = [...gold], colB = [...ink];
    /* targets: seventy percent of the bees spell the balance, the rest are the
       budget ring, whose filled arc is the month's spend */
    const build = (str, frac) => { const nD = Math.floor(sys.n * 0.7), nR = sys.n - nD, a = new Float32Array(sys.n * 2);
      a.set(textTargets(str, nD, textBox(canvas, 0.06, 0.60, 0.88), 96, 800), 0);
      for (let k = 0; k < nR; k++) { const u = hash2(k, 21); const onArc = u < frac; const ang = -Math.PI / 2 + (onArc ? u / Math.max(frac, 1e-3) : (u - frac) / Math.max(1 - frac, 1e-3)) * TAU; const rr = onArc ? 0.30 + 0.05 * hash2(k, 23) : 0.335 + 0.012 * (hash2(k, 23) - 0.5); a[(nD + k) * 2] = 0.5 + Math.cos(ang) * rr * (canvas.height / canvas.width); a[(nD + k) * 2 + 1] = 0.40 + Math.sin(ang) * rr * 0.62; }
      return a; };
    const spring = (k) => 1 - Math.exp(-5.5 * k) * Math.cos(9.0 * k) * (1 - k * 0.3);
    pointer(stage, (p) => { ptr = [p.x, 1 - p.y]; if (dragging && phase === 'rest') { pull = Math.max(0, Math.min(1, (p.y - y0) * 3)); $('nc-pull').textContent = pull > 0.85 ? 'release to refresh' : 'pull down to refresh'; } }, () => { ptr = [-9, -9]; }, (p) => { dragging = true; y0 = p.y; }, () => { dragging = false; if (pull > 0.85 && phase === 'rest') { phase = 'forage'; tPhase = performance.now(); nextTx = 0; $('nc-sub').textContent = 'refreshing…'; } pull = 0; $('nc-pull').textContent = 'pull down to refresh'; });
    const arrive = (now) => { const tx = TXS[Math.floor(hash2(Math.floor(now / 1000), 7) * TXS.length)]; from = shown; target = Math.max(0, target + tx[1]); tMove = now; spent = Math.max(0.05, Math.min(0.98, spent - tx[1] / 4200)); if (tx[1] < 0) { colA.splice(0, 4, ...col(el, '--nc-cool')); } else { colA.splice(0, 4, ...gold); }
      const li = document.createElement('div'); li.className = 'nc-tx nc-tx-new'; li.innerHTML = `<span>${tx[0]}</span><b class="${tx[1] > 0 ? 'nc-in' : ''}">${tx[1] > 0 ? '+' : '−'}£${Math.abs(tx[1]).toFixed(2)}</b>`; const list = $('nc-tx-list'); list.prepend(li); while (list.children.length > 4) list.lastChild.remove(); $('nc-sub').textContent = tx[0]; };
    out.push(card({ name: 'nectar', el, init() { sys = makeSystem(this.__dev, canvas, 36000, colA, colB, { size: 2.0, alpha: 0.8, bg: col(el, '--nc-bg') }); nextTx = performance.now() + 2500; },
      frame(t, dt, now) { if (!sys) return; const T = now / 1000;
        /* the number moves like a needle: an under-damped spring from the old
           figure to the new one, and the bees follow the printed digits */
        if (phase === 'rest' && now > nextTx) { arrive(now); nextTx = now + 5200 + 2600 * hash2(Math.floor(now), 3); }
        const k = Math.min(1, (now - tMove) / 1800); shown = from + (target - from) * spring(k); spentShown += (spent - spentShown) * Math.min(1, dt * 2.5);
        const str = fmtGBP(shown); if (str !== lastStr || Math.abs(spentShown - spent) > 0.002) { lastStr = str; if (phase !== 'forage') sys.setTargets(build(str, spentShown)); $('nc-bal').textContent = str; $('nc-ring').textContent = Math.round(spentShown * 100) + '% of budget'; }
        const moving = k < 1 ? 1 - k : 0;
        if (phase === 'forage' && now - tPhase > 1600) { phase = 'return'; tPhase = now; arrive(now); lastStr = ''; }
        if (phase === 'return' && now - tPhase > 1400) phase = 'rest';
        if (phase === 'forage') sys.setTargets(build('·', 0));
        const g = phase === 'forage' ? 2.2 : 9.0, jit = phase === 'forage' ? 0.05 : 0.004 + pull * 0.04 + moving * 0.025;
        const enc = this.__dev.createCommandEncoder(); sys.frame(enc, { dt, time: T, gather: g, gravity: -pull * 0.5, damp: 0.9, jitter: jit, ptr, ptrR: 0.14, ptrF: 1.5, wind: [0, 0], settle: false }); this.__dev.queue.submit([enc.finish()]); } }));
  }
  return out;
}
