/* §7 · the iPhone Duo as a model, not a photograph. Two panes and a hinge as
   signed-distance geometry — rounded slabs, a barrel hinge, inset glass —
   lit by a studio key, a coloured rim and a hemisphere, with a soft shadow
   on the floor and one reflection bounce off it. The panes are emissive and
   show a live, procedural screen. It opens and closes on its own; drag orbits.
   Dimensions come from SPECS below; every figure there is labelled either
   verified (with a source in wallet-duo.md) or estimated, and the sheet
   prints which. */
import { $, DPR, TAU, uniform, render, bind, attach, timer, card, pointer, FSQ_VS } from './common.js';

/* centimetres. Verified figures from Apple's published dimensions via conductor/tracks/004-webgpu-sl-14/wallet-duo.md:
   open 164.6 × 117.8 × 5.2 mm, closed 84.1 × 117.8 × 11.3 mm; inner panel 1878 × 2670 @ 430 ppi → 110.93 × 157.72 mm,
   so the open bezel is 3.44 mm all round; outer panel 1398 × 2034 @ 460 ppi → closed bezels 3.46 mm sides, 2.75 mm top/bottom.
   Apple publishes no corner radius and no crease width: those are constructed and say so. */
export const SPECS = {
  leafW: { v: 8.23, src: 'verified' }, leafH: { v: 11.78, src: 'verified' }, leafT: { v: 0.52, src: 'verified' },
  bezel: { v: 0.344, src: 'derived' }, outerBezelSide: { v: 0.346, src: 'derived' }, outerBezelEnd: { v: 0.275, src: 'derived' },
  cornerR: { v: 0.78, src: 'constructed' }, hingeR: { v: 0.30, src: 'constructed' },
};

const SHADER = FSQ_VS + `
struct R { camPos: vec3f, time: f32, camF: vec3f, aspect: f32, camR: vec3f, fold: f32, camU: vec3f, beat: f32,
  dims: vec4f, misc: vec4f, key: vec4f, rim: vec4f, cards: array<vec4f, 8> };
@group(0) @binding(0) var<uniform> r: R;
fn rotY(p: vec3f, a: f32) -> vec3f { let c = cos(a); let s = sin(a); return vec3f(c * p.x + s * p.z, p.y, -s * p.x + c * p.z); }
fn sdRBox(p: vec3f, b: vec3f, rad: f32) -> f32 { let q = abs(p) - b + rad; return length(max(q, vec3f(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0) - rad; }
fn sdBox2(p: vec2f, b: vec2f, rad: f32) -> f32 { let q = abs(p) - b + rad; return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - rad; }
fn hash(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }
fn vn(p: vec2f) -> f32 { let i = floor(p); var f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2f(1, 0)), f.x), mix(hash(i + vec2f(0, 1)), hash(i + vec2f(1, 1)), f.x), f.y); }
/* one pane in its own frame: x from the hinge outward, y up, inner face toward +z */
fn pane(p: vec3f, outer: bool) -> vec2f { let W = r.dims.x; let H = r.dims.y; let T = r.dims.z; let cr = r.dims.w; let bz = r.misc.x;
  /* the leaf: square-edged at the hinge, rounded outboard, so the closed device is one slab */
  let body = max(sdRBox(p - vec3f(W * 0.5 + cr, 0.0, 0.0), vec3f(W * 0.5 + cr, H * 0.5, T * 0.5), cr), -p.x);
  /* the inner display is one continuous sheet: inset by the bezel on the three outboard sides only */
  let sc = sdBox2(p.xy - vec2f((W - bz) * 0.5 + bz * 0.5, 0.0), vec2f((W - bz) * 0.5 + bz * 0.5, H * 0.5 - bz), cr - bz * 0.6); let scx = max(sc, -p.x);
  var m = 1.0; if (scx < 0.0 && p.z > T * 0.5 - 0.08) { m = 2.0; }
  /* the outer display on the back of one leaf, with Apple's asymmetric closed bezels */
  if (outer) { let so = sdBox2(p.xy - vec2f(W * 0.5, 0.0), vec2f(W * 0.5 - r.misc.w, H * 0.5 - r.misc.w * 0.8), cr - r.misc.w * 0.6); if (so < 0.0 && p.z < -T * 0.5 + 0.08) { m = 7.0; } }
  return vec2f(body, m); }
fn map(p: vec3f) -> vec2f {
  /* pane B is fixed; pane A is mirrored across the hinge and folded toward +z by the fold angle */
  let a = pane(p, true); let pa = rotY(p, r.fold); let b = pane(vec3f(-pa.x, pa.y, pa.z), false); let hr = r.misc.y;
  let hinge = length(vec2f(p.x, p.z)) - hr; let hcap = max(hinge, abs(p.y) - r.dims.y * 0.5 + r.dims.w * 0.4);
  var d = a.x; var m = a.y; if (b.x < d) { d = b.x; m = select(b.y + 2.0, b.y, b.y > 6.5); } if (hcap < d) { d = hcap; m = 5.0; }
  let floor = p.y + r.dims.y * 0.5 + 0.05; if (floor < d) { d = floor; m = 6.0; }
  return vec2f(d, m); }
fn nrm(p: vec3f) -> vec3f { let e = vec2f(0.004, 0.0); return normalize(vec3f(map(p + e.xyy).x - map(p - e.xyy).x, map(p + e.yxy).x - map(p - e.yxy).x, map(p + e.yyx).x - map(p - e.yyx).x)); }
fn march(ro: vec3f, rd: vec3f, steps: i32) -> vec2f { var t = 0.02; var m = 0.0; for (var i = 0; i < steps; i++) { let h = map(ro + rd * t); m = h.y; if (h.x < 0.002 * t + 0.001) { return vec2f(t, m); } t += h.x * 0.9; if (t > 120.0) { break; } } return vec2f(-1.0, 0.0); }
fn shadow(ro: vec3f, rd: vec3f) -> f32 { var s = 1.0; var t = 0.05; for (var i = 0; i < 36; i++) { let h = map(ro + rd * t).x; s = min(s, 9.0 * h / t); if (s < 0.01) { return 0.0; } t += clamp(h, 0.03, 1.2); if (t > 40.0) { break; } } return clamp(s, 0.0, 1.0); }
fn ao(p: vec3f, n: vec3f) -> f32 { var occ = 0.0; var sca = 1.0; for (var i = 0; i < 5; i++) { let h = 0.03 + 0.25 * f32(i); occ += (h - map(p + n * h).x) * sca; sca *= 0.7; } return clamp(1.0 - 1.5 * occ, 0.0, 1.0); }
/* the screens: a live, procedural UI. Pane B (m = 2) shows the wallet stack; pane A (m = 4) the open card and its detail. */
fn screenB(uv: vec2f) -> vec3f { var c = mix(vec3f(0.06, 0.06, 0.09), vec3f(0.10, 0.09, 0.16), uv.y);
  c += vec3f(0.55, 0.22, 0.60) * exp(-length((uv - vec2f(0.3, 0.85)) * vec2f(1.0, 2.0)) * 3.0) * 0.5 + vec3f(0.10, 0.35, 0.55) * exp(-length((uv - vec2f(0.8, 0.2)) * vec2f(1.0, 2.0)) * 3.0) * 0.6;
  /* the stack of eight cards, stock colours from the wallet */
  /* back to front: each card's top edge shows above the next, the way a wallet stacks them */
  for (var k = 0; k < 8; k++) { let i = 7 - k; let fi = f32(i); let top = 0.84 - fi * 0.062; let d = sdBox2(uv - vec2f(0.5, top - 0.135), vec2f(0.42, 0.135), 0.035); let card = r.cards[i]; let inside = 1.0 - smoothstep(0.0, 0.005, d);
    c = mix(c, card.rgb * (0.9 + 0.1 * uv.x) * (1.0 - 0.25 * smoothstep(0.0, 0.03, -d) * 0.0), inside); c = mix(c, vec3f(0.0), inside * smoothstep(0.012, 0.0, top - uv.y) * 0.25 * f32(i < 7)); }
  c = mix(c, vec3f(0.92), smoothstep(0.004, 0.0, abs(uv.y - 0.94)) * step(0.10, uv.x) * step(uv.x, 0.42) * 0.9);
  return c; }
fn screenA(uv: vec2f) -> vec3f { var c = mix(vec3f(0.05, 0.05, 0.07), vec3f(0.09, 0.08, 0.12), uv.y);
  /* the open card, large, and three detail rows beneath it */
  let d = sdBox2(uv - vec2f(0.5, 0.72), vec2f(0.43, 0.135), 0.04); let card = r.cards[u32(r.misc.z)]; c = mix(c, card.rgb, 1.0 - smoothstep(0.0, 0.006, d));
  c += vec3f(0.9) * exp(-length((uv - vec2f(0.72, 0.78)) * vec2f(1.0, 2.0)) * 6.0) * 0.25 * (1.0 - smoothstep(0.0, 0.006, d));
  for (var i = 0; i < 3; i++) { let y = 0.46 - f32(i) * 0.09; c = mix(c, vec3f(0.24), smoothstep(0.004, 0.0, abs(uv.y - y)) * step(0.08, uv.x) * step(uv.x, 0.92)); c = mix(c, vec3f(0.55), (1.0 - smoothstep(0.0, 0.004, sdBox2(uv - vec2f(0.20, y + 0.035), vec2f(0.10, 0.012), 0.008)))); }
  c = mix(c, vec3f(0.92), 1.0 - smoothstep(0.0, 0.005, sdBox2(uv - vec2f(0.5, 0.12), vec2f(0.30, 0.03), 0.03)));
  return c; }
fn screenO(uv: vec2f) -> vec3f { var c = mix(vec3f(0.05, 0.05, 0.08), vec3f(0.12, 0.08, 0.16), uv.y); c += vec3f(0.6, 0.3, 0.7) * exp(-length((uv - vec2f(0.5, 0.65)) * vec2f(1.0, 1.4)) * 2.2) * 0.5;
  /* the time, as two blocks, and a notification pill */
  c = mix(c, vec3f(0.95), 1.0 - smoothstep(0.0, 0.006, sdBox2(uv - vec2f(0.5, 0.78), vec2f(0.20, 0.05), 0.02))); c = mix(c, vec3f(0.85), 1.0 - smoothstep(0.0, 0.006, sdBox2(uv - vec2f(0.5, 0.30), vec2f(0.34, 0.04), 0.03)) * 0.5); return c; }
fn shade(p: vec3f, n: vec3f, rd: vec3f, m: f32) -> vec3f { let key = normalize(r.key.xyz); let rimL = normalize(r.rim.xyz); let sh = shadow(p + n * 0.02, key); let occ = ao(p, n);
  let nd = max(dot(n, key), 0.0); let hv = normalize(key - rd); let fr = pow(1.0 - max(dot(n, -rd), 0.0), 5.0); let hemi = mix(vec3f(0.05, 0.05, 0.06), vec3f(0.22, 0.23, 0.26), 0.5 + 0.5 * n.y);
  var col: vec3f;
  if ((m > 1.5 && m < 2.5) || (m > 3.5 && m < 4.5) || m > 6.5) { /* the glass over a lit screen: emissive content plus a sharp reflection */
    let W = r.dims.x; let H = r.dims.y; var q = p; if (m > 3.5 && m < 4.5) { let pa = rotY(p, r.fold); q = vec3f(-pa.x, pa.y, pa.z); } let uv = vec2f(q.x / W, q.y / H + 0.5);
    let content = select(select(screenA(uv), screenB(uv), m < 2.5), screenO(vec2f(1.0 - uv.x, uv.y)), m > 6.5); let ph = pow(max(dot(n, hv), 0.0), 400.0) * 3.0;
    col = content * 1.15 + vec3f(ph) * sh + hemi * fr * 1.2 + vec3f(0.06) * fr; }
  else if (m > 5.5) { /* the floor */ col = vec3f(0.09, 0.09, 0.10) * (0.35 + 0.65 * nd * sh) * occ + hemi * 0.15; }
  else { /* titanium: brushed, warm, with an anisotropic lobe along the edges */
    let tan = normalize(cross(n, vec3f(0.0, 1.0, 0.0)) + 1e-4); let th = dot(tan, hv); let ph = pow(max(1.0 - th * th, 0.0), 10.0) * pow(max(dot(n, hv), 0.0), 6.0);
    let base = select(vec3f(0.36, 0.34, 0.32), vec3f(0.22, 0.22, 0.23), m > 4.5); col = base * (vec3f(1.0, 0.97, 0.93) * nd * sh * 1.3 + hemi * 1.4) * occ + vec3f(ph * 1.4 * sh) + r.rim.rgb * pow(max(dot(n, rimL), 0.0), 3.0) * 0.5 * fr + vec3f(0.25) * fr * occ; }
  return col; }
@fragment fn fs(o: VO) -> @location(0) vec4f { let ndc = vec2f(o.uv.x * 2.0 - 1.0, 1.0 - o.uv.y * 2.0); let tf = tan(0.5 * 0.48);
  let rd = normalize(r.camF + r.camR * ndc.x * tf * r.aspect + r.camU * ndc.y * tf); let ro = r.camPos;
  var col = vec3f(0.05, 0.05, 0.06) * (1.0 - 0.5 * ndc.y); let h = march(ro, rd, 110);
  if (h.x > 0.0) { let p = ro + rd * h.x; let n = nrm(p); col = shade(p, n, rd, h.y);
    if (h.y > 5.5) { /* the floor reflects the device, softened with distance */ let rr = reflect(rd, n); let h2 = march(p + n * 0.02, rr, 70); if (h2.x > 0.0 && map(p + n * 0.02 + rr * h2.x).y < 5.5) { let p2 = p + n * 0.02 + rr * h2.x; col = mix(col, shade(p2, nrm(p2), rr, h2.y), 0.35 * exp(-h2.x * 0.06)); } col = mix(col, vec3f(0.07, 0.07, 0.08), smoothstep(6.0, 30.0, length(p.xz))); } }
  col = col / (1.0 + col * 0.5) * 1.3; col = pow(max(col, vec3f(0.0)), vec3f(1.0 / 2.2));
  let vig = 1.0 - 0.25 * dot(ndc * vec2f(0.75, 1.0), ndc * vec2f(0.75, 1.0)); return vec4f(col * vig, 1.0); }`;

const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const lerp = (a, b, t) => a + (b - a) * t, ease = (t) => t * t * (3 - 2 * t);
const STOCKS = [[0.16, 0.16, 0.18], [0.95, 0.94, 0.92], [0.12, 0.13, 0.24], [0.985, 0.985, 0.98], [0.10, 0.10, 0.13], [0.90, 0.89, 0.86], [0.12, 0.17, 0.19], [0.70, 0.68, 0.64]];

export function duoCard() {
  const el = $('du-card'), stage = $('du-stage'), canvas = $('du-canvas'), status = $('du-status'); let s = null, drag = null, yaw = 0.7, pitch = 0.22, lastTouch = -1e9, manual = false, foldDeg = 0;
  const slider = $('du-fold');
  slider.addEventListener('input', () => { manual = true; lastTouch = performance.now(); foldDeg = +slider.value; $('du-fold-v').textContent = foldDeg + '°'; });
  $('du-auto').addEventListener('click', () => { manual = false; lastTouch = -1e9; });
  pointer(stage, (p) => { if (drag) { yaw = drag.yaw + (p.x - drag.x) * 4.0; pitch = Math.max(-0.2, Math.min(1.0, drag.pitch - (p.y - drag.y) * 2.5)); lastTouch = performance.now(); } }, () => { drag = null; }, (p) => { drag = { x: p.x, y: p.y, yaw, pitch }; lastTouch = performance.now(); }, () => { drag = null; });
  $('du-specs').innerHTML = Object.entries(SPECS).map(([k, v]) => `<span>${k.replace(/([A-Z])/g, ' $1').toLowerCase()} <b>${(v.v * 10).toFixed(2)} mm</b> <i>${v.src}</i></span>`).join('');
  return card({ name: 'duo', el, init() {
    const dev = this.__dev, { ctx } = attach(canvas), ru = uniform(64 + 64 + 128), pipe = render(SHADER), g = bind(pipe, [ru]), tm = timer(['march'], 4);
    s = { ctx, ru, pipe, g, tm }; status.hidden = true;
  }, frame(t, dt, now) {
    if (!s) return; const dev = this.__dev, T = now / 1000;
    const rc = stage.getBoundingClientRect(), bw = Math.round(rc.width * Math.min(DPR, 1.5) * 0.7), bh = Math.round(rc.height * Math.min(DPR, 1.5) * 0.7);
    if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
    /* the loop: closed, opening over five seconds, held, closing; the slider takes over for as long as it is touched */
    const tl = T % 18; let fold = tl < 2 ? 0 : tl < 7 ? ease((tl - 2) / 5) : tl < 13 ? 1 : tl < 17 ? 1 - ease((tl - 13) / 4) : 0;
    if (manual && now - lastTouch < 8000) fold = foldDeg / 180; else if (manual) { manual = false; }
    if (!manual) { foldDeg = Math.round(fold * 180); slider.value = foldDeg; $('du-fold-v').textContent = foldDeg + '°'; }
    const idle = (now - lastTouch) / 1000; if (idle > 4 && !drag) { yaw = lerp(yaw, 0.55 + 0.35 * Math.sin(T * 0.11), 1 - Math.pow(0.05, dt)); pitch = lerp(pitch, 0.18 + 0.08 * Math.sin(T * 0.07), 1 - Math.pow(0.05, dt)); }
    /* the camera looks at the hinge; the frame is sized to hold the device open */
    const W = SPECS.leafW.v, H = SPECS.leafH.v, T_ = SPECS.leafT.v, dist = 30, tgt = [W * 0.5 - W * 0.5 * Math.cos(Math.PI - fold * Math.PI) * 0.5, 0.5, 2.5];
    const pos = [tgt[0] + Math.sin(yaw) * Math.cos(pitch) * dist, tgt[1] + Math.sin(pitch) * dist, tgt[2] + Math.cos(yaw) * Math.cos(pitch) * dist];
    const F = norm([tgt[0] - pos[0], tgt[1] - pos[1], tgt[2] - pos[2]]), Rt = norm(cross(F, [0, 1, 0])), Up = cross(Rt, F);
    const RB = new ArrayBuffer(256), Rf = new Float32Array(RB);
    Rf.set(pos, 0); Rf[3] = T; Rf.set(F, 4); Rf[7] = canvas.width / canvas.height; Rf.set(Rt, 8); Rf[11] = Math.PI - fold * Math.PI; Rf.set(Up, 12); Rf[15] = (tl % 6) / 6 < 0.5 ? 0 : 1;
    Rf.set([W, H, T_, SPECS.cornerR.v], 16); Rf.set([SPECS.bezel.v, SPECS.hingeR.v, Math.floor(T / 6) % 8, SPECS.outerBezelSide.v], 20); Rf.set([-0.5, 0.9, 0.8, 0], 24); Rf.set([0.35, 0.55, 1.0, 0], 28);
    STOCKS.forEach((c, i) => Rf.set([...c, 1], 32 + i * 4));
    dev.queue.writeBuffer(s.ru, 0, RB);
    const enc = dev.createCommandEncoder(); const rp = enc.beginRenderPass({ colorAttachments: [{ view: s.ctx.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store' }], ...s.tm.begin(0) });
    rp.setPipeline(s.pipe); rp.setBindGroup(0, s.g); rp.draw(3); rp.end(); s.tm.resolve(enc); dev.queue.submit([enc.finish()]);
    const rd = s.tm.read(); if (rd.march !== undefined) $('du-t-march').textContent = rd.march.toFixed(2) + ' ms · ' + canvas.width + ' × ' + canvas.height;
  } });
}
