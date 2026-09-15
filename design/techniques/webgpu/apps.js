/* §2 · two fictive apps that are entirely WebGPU — Atlas, whose results are sand, and Nectar, whose balance is a jar of honey. The phone around them is
   CSS, there to say "this form factor"; everything inside the display —
   the panes, the type, the glass, the cells, the buttons, the sand and the
   bees — is drawn by the GPU from one instance buffer over one background
   pass. Layout is in points on the Duo's 890 × 626 inner display. */
import { $, TAU, hash2, uniform, render, bind } from './common.js';
import { ICONS, MONO } from './ui.js';
import { makeSystem, textTargets, textBox, fmtGBP } from './loop.js';
import { DUO } from './shell.js';

const W = DUO.w, H = DUO.h, LEAF = DUO.leaf, SAFE = 62; /* the Dock's lane on the right */
const ease = (t) => t * t * (3 - 2 * t);

/* ── ATLAS · travel search, the results made of sand ─────────────────── */
export function atlasApp() {
  const input = $('at-input'); let canvas = null, dev = null;
  const C = { bg: [0.945, 0.915, 0.855, 1], ink: [0.20, 0.16, 0.11, 1], dim: [0.50, 0.44, 0.36, 1], acc: [0.70, 0.32, 0.17, 1], glass: [1, 1, 1, 0.42], glassHi: [1, 1, 1, 0.66], white: [1, 1, 1, 1] };
  let ui = null, sys = null, ptr = [-9, -9], hover = null, seg = 0, text = input.value || 'Lisbon', phase = 'name', tPhase = 0, focused = false, results = [];
  const PHASES = { name: 4200, chart: 5200, date: 3000, route: 5200 }, NEXT = { name: 'chart', chart: 'date', date: 'route', route: 'name' };
  const months = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  const AIRLINES = ['Corvo Air', 'Tagus', 'Northline', 'Meridian', 'Sable'];
  const prices = () => { let h = 0; for (const ch of text.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return months.map((_, m) => 70 + Math.round(120 * hash2(h % 9973, m + 1)) + (m === 6 || m === 7 ? 60 : 0)); };
  const fares = () => { const pr = prices(), lo = Math.min(...pr); let h = 0; for (const ch of text) h = (h * 17 + ch.charCodeAt(0)) >>> 0; return [0, 1, 2].map((i) => { const dep = 6 + Math.floor(hash2(h + i, 3) * 13), mins = Math.floor(hash2(h + i, 5) * 4) * 15, dur = 150 + Math.floor(hash2(h + i, 7) * 6) * 5; const arr = dep * 60 + mins + dur; return { air: AIRLINES[(h + i * 3) % AIRLINES.length], dep: `${String(dep).padStart(2, '0')}:${String(mins).padStart(2, '0')}`, arr: `${String(Math.floor(arr / 60) % 24).padStart(2, '0')}:${String(arr % 60).padStart(2, '0')}`, dur: `${Math.floor(dur / 60)}h ${String(dur % 60).padStart(2, '0')}`, price: lo + Math.round(hash2(h + i, 9) * 40) - (i === 2 ? 12 : 0), direct: hash2(h + i, 11) > 0.25 }; }); };
  /* target sets live in the right leaf: x ∈ [0.5, 1] of the display */
  const box = (x, y, w) => textBox(canvas, 0.5 + x * 0.5, y, w * 0.5);
  const chartTargets = (n) => { const pr = prices(), mx = Math.max(...pr), cum = []; let acc = 0; pr.forEach((v) => { acc += v; cum.push(acc); }); const a = new Float32Array(n * 2);
    for (let k = 0; k < n; k++) { const r = hash2(k, 5) * acc; let m = 0; while (cum[m] < r) m++; const hgt = pr[m] / mx * 0.36; a[k * 2] = (LEAF + 30 + m * 29 + hash2(k, 9) * 24) / W; a[k * 2 + 1] = 0.30 + hash2(k, 11) * hgt; } return a; };
  const routeTargets = (n) => { const a = new Float32Array(n * 2); const P0 = [0.56, 0.40], P1 = [0.73, 0.86], P2 = [0.90, 0.40];
    for (let k = 0; k < n; k++) { const u = hash2(k, 5), r = hash2(k, 9); if (u < 0.12) { const t = hash2(k, 11) * TAU, rr = Math.sqrt(r) * 0.05; a[k * 2] = P0[0] + Math.cos(t) * rr * 0.7; a[k * 2 + 1] = P0[1] + Math.sin(t) * rr; } else if (u < 0.24) { const t = hash2(k, 11) * TAU, rr = Math.sqrt(r) * 0.05; a[k * 2] = P2[0] + Math.cos(t) * rr * 0.7; a[k * 2 + 1] = P2[1] + Math.sin(t) * rr; }
      else { const t = (u - 0.24) / 0.76, x = (1 - t) * (1 - t) * P0[0] + 2 * (1 - t) * t * P1[0] + t * t * P2[0], y = (1 - t) * (1 - t) * P0[1] + 2 * (1 - t) * t * P1[1] + t * t * P2[1]; const dash = Math.floor(t * 40) % 2 ? 1 : 0.35; a[k * 2] = x + (hash2(k, 13) - 0.5) * 0.012 * dash; a[k * 2 + 1] = y + (hash2(k, 15) - 0.5) * 0.03 * dash; } } return a; };
  const setPhase = (ph) => { phase = ph; tPhase = performance.now(); if (!sys) return;
    if (ph === 'name') sys.setTargets(textTargets(text.toUpperCase(), sys.n, box(0.05, 0.36, 0.9), text.length > 8 ? 110 : 150, 800));
    if (ph === 'chart') { sys.setTargets(chartTargets(sys.n)); results = fares(); }
    if (ph === 'date') sys.setTargets(textTargets('14 — 21 SEP', sys.n, box(0.05, 0.40, 0.9), 110, 800));
    if (ph === 'route') sys.setTargets(routeTargets(sys.n)); };
  const onInput = () => { text = input.value.trim() || 'Lisbon'; setPhase('name'); }, onFocus = () => { focused = true; }, onBlur = () => { focused = false; };
  const code = (c) => c.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3).padEnd(3, 'X');
  const draw = (now, hov) => { const T = now / 1000, ui_ = ui; hover = hov; ui_.time = T;
    /* ── left pane: the app ── */
    ui_.text(24, 26, 'Atlas', 30, C.ink, { weight: 700, track: -0.02 }); ui_.text(24, 66, 'Flights · stays · the whole coast', 12, C.dim);
    /* segmented control */
    ui_.glass(24, 96, 397, 36, C.glass, 18); const segs = [['Flights', ICONS.plane], ['Stays', ICONS.bed], ['Trains', ICONS.train]];
    segs.forEach(([lab, ic], i) => { const x = 27 + i * 131; if (i === seg) ui_.rect(x, 99, 128, 30, C.white, 15); ui_.icon('seg' + i, x + 28, 106, 16, i === seg ? C.acc : C.dim, ic); ui_.text(x + 50, 105, lab, 13, i === seg ? C.ink : C.dim, { weight: i === seg ? 600 : 500 }); ui_.hit('seg' + i, x, 99, 128, 30); });
    /* the search card */
    ui_.glass(24, 146, 397, 178, C.glassHi, 20, 0.12);
    const row = (y, label, value, id, ic, strong) => { ui_.icon(id + 'ic', 42, y + 12, 18, C.dim, ic); ui_.text(72, y + 2, label, 10, C.dim, { weight: 600, track: 0.04 }); ui_.text(72, y + 16, value, 15, C.ink, { weight: strong ? 600 : 500 }); ui_.hit(id, 24, y, 397, 44); };
    row(158, 'FROM', 'London · any airport', 'from', ICONS.plane); ui_.rect(72, 202, 320, 1, [0, 0, 0, 0.08]);
    row(206, 'TO', input.value || 'Lisbon', 'to', ICONS.pin, true); if (focused && Math.floor(T * 2) % 2 === 0) { const cw = ui_.measure(input.value, 15, { weight: 600 }); ui_.rect(73 + cw, 223, 1.5, 17, C.acc); }
    ui_.glassDisc(394, 204, 14, C.glass, 0.2); ui_.icon('swap', 386, 196, 16, C.dim, ICONS.swap); ui_.hit('swap', 380, 190, 28, 28);
    ui_.rect(72, 250, 320, 1, [0, 0, 0, 0.08]); row(254, 'DATES', '14 – 21 Sep', 'dates', ICONS.calendar); row(254, '', '', 'trav', ICONS.person); ui_.icon('travic', 262, 266, 18, C.dim, ICONS.person); ui_.text(292, 256, 'TRAVELLERS', 10, C.dim, { weight: 600, track: 0.04 }); ui_.text(292, 270, '1 adult', 15, C.ink, { weight: 500 });
    /* search */
    const goHot = hover === 'go'; ui_.rect(24, 336, 397, 44, goHot ? [0.62, 0.27, 0.13, 1] : C.acc, 22); ui_.icon('goic', 158, 349, 18, C.white, ICONS.search); ui_.text(184, 348, 'Search flights', 15, C.white, { weight: 600 }); ui_.hit('go', 24, 336, 397, 44);
    /* best fares */
    ui_.text(24, 398, 'Best fares', 16, C.ink, { weight: 700 }); ui_.text(421, 402, 'from £' + Math.min(...prices()), 12, C.acc, { weight: 600, align: 'right' });
    const rs = results.length ? results : fares(); rs.forEach((r, i) => { const y = 424 + i * 50; const hot = hover === 'res' + i; ui_.glass(24, y, 397, 44, hot ? C.glassHi : C.glass, 14, 0.1);
      ui_.text(40, y + 6, `${r.dep} → ${r.arr}`, 14, C.ink, { weight: 600 }); ui_.text(40, y + 25, `${r.air} · ${r.direct ? 'direct' : '1 stop'} · ${r.dur}`, 11, C.dim);
      ui_.text(378, y + 12, '£' + r.price, 16, C.acc, { weight: 700, align: 'right' }); ui_.icon('chev', 388, y + 14, 16, C.dim, ICONS.chevron); ui_.hit('res' + i, 24, y, 397, 44); });
    /* the pill at the foot */
    ui_.glass(24, 574, 397, 38, C.glassHi, 19, 0.14); ui_.icon('pillsearch', 40, 585, 16, C.dim, ICONS.search); ui_.text(64, 585, 'Search cities, airports, hotels', 12.5, C.dim); ui_.hit('pill', 24, 574, 397, 38);
    /* ── right pane: what the sand is doing, and the app's floating controls ── */
    const rx = LEAF + 26;
    if (phase === 'name') { ui_.text(rx, 40, 'WHERE TO', 10, C.dim, { weight: 600, track: 0.16 }); ui_.text(rx, 56, 'Type a city — the sand spells it, charts it, dates it, flies it.', 12, C.dim); }
    if (phase === 'chart') { const pr = prices(), lo = Math.min(...pr); ui_.text(rx, 34, `from £${lo} · ${text}`, 22, C.ink, { weight: 700, track: -0.01 }); ui_.text(rx, 64, 'FARES BY MONTH · RETURN · 1 ADULT', 10, C.dim, { weight: 600, track: 0.14 });
      months.forEach((m, i) => { const x = LEAF + 42 + i * 29; ui_.text(x, 448, m, 10, C.dim, { align: 'center', family: MONO }); ui_.text(x, 462, '£' + pr[i], 9, pr[i] === lo ? C.acc : C.ink, { align: 'center', family: MONO, weight: pr[i] === lo ? 700 : 400 }); }); }
    if (phase === 'date') { ui_.text(rx, 40, 'YOUR DATES', 10, C.dim, { weight: 600, track: 0.16 }); ui_.text(rx, 56, 'Seven nights, out on a Sunday, back on a Sunday.', 12, C.dim); }
    if (phase === 'route') { ui_.text(0.56 * W, 340, 'LON', 13, C.ink, { weight: 700, align: 'center', family: MONO, track: 0.1 }); ui_.text(0.56 * W, 358, 'Heathrow', 10, C.dim, { align: 'center' });
      ui_.text(0.90 * W, 340, code(text), 13, C.ink, { weight: 700, align: 'center', family: MONO, track: 0.1 }); ui_.text(0.90 * W, 358, text, 10, C.dim, { align: 'center' });
      ui_.text(rx, 40, 'NEXT SUNDAY', 10, C.dim, { weight: 600, track: 0.16 }); const r0 = rs[0]; ui_.text(rx, 56, `${r0.air} · ${r0.dep} · ${r0.direct ? 'direct' : '1 stop'} · £${r0.price}`, 12, C.ink, { weight: 500 }); }
    /* the discs down the pane's edge */
    [['filter', ICONS.filter], ['map', ICONS.pin], ['share', ICONS.share]].forEach(([id, ic], i) => { const cx = W - SAFE - 30, cy = 300 + i * 48; ui_.glassDisc(cx, cy, 18, hover === id ? C.glassHi : C.glass, 0.22); ui_.icon('disc' + id, cx - 9, cy - 9, 18, C.ink, ic); ui_.hit(id, cx - 18, cy - 18, 36, 36); });
    /* the crease, as a whisper, and the status corner */
    ui_.rect(LEAF - 0.5, 0, 1, H, [0, 0, 0, 0.10]); };
  const act = (id) => { if (!id) return; if (id.startsWith('seg')) seg = +id[3]; if (id === 'to' || id === 'pill') { input.focus(); } if (id === 'go') setPhase('chart'); if (id.startsWith('res')) setPhase('route'); if (id === 'map') setPhase('route'); if (id === 'filter') setPhase('chart'); };
  return { init(d, host) { dev = d; canvas = host.canvas; ui = host.ui; sys = makeSystem(dev, canvas, 160000, [0.20, 0.16, 0.11, 1], [0.70, 0.32, 0.17, 1], { size: 1.6, alpha: 0.55, bg: C.bg, external: true });
      input.addEventListener('input', onInput); input.addEventListener('focus', onFocus); input.addEventListener('blur', onBlur); setPhase('name'); },
    move(p) { ptr = [p.x / W, 1 - p.y / H]; }, leave() { ptr = [-9, -9]; }, up(p, id, same) { if (same) act(id); },
    frame(t, dt, now, hov) { if (!sys) return; if (now - tPhase > PHASES[phase]) setPhase(NEXT[phase]);
      const tgt = ui.prepare(); const enc = dev.createCommandEncoder();
      sys.frame(enc, { dt, time: now / 1000, gather: phase === 'route' ? 16.0 : 18.0, gravity: 0.0, damp: 0.86, jitter: phase === 'chart' ? 0.006 : 0.012, ptr, ptrR: 0.10, ptrF: 3.0, wind: [0, 0], settle: false }, null, tgt);
      draw(now, hov); ui.compose(enc); dev.queue.submit([enc.finish()]); },
    destroy() { input.removeEventListener('input', onInput); input.removeEventListener('focus', onFocus); input.removeEventListener('blur', onBlur); input.blur(); sys.destroy(); sys = null; } };
}

/* ── NECTAR · banking; the balance is a jar of honey ─────────────────── */
/* one ray march: a glass jar (a hollow rounded cylinder, IOR 1.5, Fresnel), honey inside it to the level the balance sets, a drop that joins or leaves the surface when a transaction lands, a honeycomb wall behind whose lit cells are the month's spend, all seen through the glass and the amber — Beer's law along the honey path — on a dark table with the jar's caustic */
const JAR = `${''}
struct U { res: vec2f, time: f32, level: f32, drop: vec4f, spend: f32, tilt: f32, pad: vec2f };
@group(0) @binding(0) var<uniform> u: U;
struct VO { @builtin(position) p: vec4f, @location(0) uv: vec2f };
@vertex fn vs(@builtin(vertex_index) i: u32) -> VO { var o: VO; let x = f32((i << 1u) & 2u); let y = f32(i & 2u); o.uv = vec2f(x, 1.0 - y); o.p = vec4f(x * 2.0 - 1.0, y * 2.0 - 1.0, 0.0, 1.0); return o; }
fn sdCyl(p: vec3f, r: f32, y0: f32, y1: f32, rr: f32) -> f32 { let d = vec2f(length(p.xz) - r + rr, max(y0 - p.y, p.y - y1) + rr); return min(max(d.x, d.y), 0.0) + length(max(d, vec2f(0.0))) - rr; }
fn smin(a: f32, b: f32, k: f32) -> f32 { let h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
fn glass(p: vec3f) -> f32 { return max(sdCyl(p, 1.0, 0.0, 2.3, 0.22), -sdCyl(p, 0.92, 0.12, 2.6, 0.16)); }
fn honeyTop(p: vec3f) -> f32 { return u.level * 1.9 + 0.12 + 0.03 * sin(p.x * 3.0 + u.time * 1.7) * u.tilt + 0.02 * cos(p.z * 4.0 - u.time * 1.3) * u.tilt + p.x * 0.18 * u.tilt; }
fn honey(p: vec3f) -> f32 { let body = max(sdCyl(p, 0.91, 0.13, 2.5, 0.15), p.y - honeyTop(p)); let drop = length(p - u.drop.xyz) - u.drop.w; return smin(body, drop, 0.16); }
fn hexCell(q: vec2f) -> vec3f { let s = vec2f(1.0, 1.7320508); let a = (q - s * floor(q / s)) - s * 0.5; let b = (q - s * 0.5 - s * floor((q - s * 0.5) / s)) - s * 0.5; let ca = floor(q / s); let cb = floor((q - s * 0.5) / s) + vec2f(0.5); let ua = dot(a, a) < dot(b, b); let cell = select(b, a, ua); let id = select(cb, ca, ua); return vec3f(cell, id.x + id.y * 7.0); }
fn hexD(c: vec2f) -> f32 { let q = abs(c); return max(q.x, dot(q, vec2f(0.5, 0.8660254))); }
fn wall(p: vec3f) -> vec3f { let h = hexCell(vec2f(p.x, p.y - 0.4) * 2.4); let d = hexD(h.xy); let id = h.z; let n = fract(sin(id * 12.9898) * 43758.5453); let lit = smoothstep(0.02, -0.02, n - u.spend);
  let rim = smoothstep(0.50, 0.46, d) - smoothstep(0.46, 0.42, d); let fill = smoothstep(0.45, 0.41, d); let base = vec3f(0.075, 0.055, 0.035); let gold = vec3f(0.98, 0.70, 0.22);
  let fade = smoothstep(3.2, 0.6, length(vec2f(p.x, p.y - 1.2) * vec2f(0.7, 1.0))); return base + (gold * (rim * 0.18 + fill * lit * (0.42 + 0.08 * sin(u.time * 1.5 + id))) + vec3f(0.04, 0.03, 0.02) * fill * (1.0 - lit)) * (0.35 + 0.65 * fade); }
fn env(d: vec3f) -> vec3f { let up = d.y; var c = mix(vec3f(0.12, 0.09, 0.06), vec3f(0.55, 0.42, 0.28), smoothstep(-0.2, 0.9, up)); let key = normalize(vec3f(-0.5, 0.8, 0.4)); c += vec3f(1.0, 0.92, 0.75) * pow(max(dot(d, key), 0.0), 40.0) * 2.5; let strip = step(abs(d.x - 0.7), 0.1) * step(abs(d.y - 0.2), 0.5); c += vec3f(0.9, 0.85, 0.75) * strip * 0.6; return c; }
fn map(p: vec3f) -> vec2f { let g = glass(p); let h = honey(p); if (g < h) { return vec2f(g, 1.0); } return vec2f(h, 2.0); }
fn nrmG(p: vec3f) -> vec3f { let e = vec2f(0.002, 0.0); return normalize(vec3f(glass(p + e.xyy) - glass(p - e.xyy), glass(p + e.yxy) - glass(p - e.yxy), glass(p + e.yyx) - glass(p - e.yyx))); }
fn nrmH(p: vec3f) -> vec3f { let e = vec2f(0.002, 0.0); return normalize(vec3f(honey(p + e.xyy) - honey(p - e.xyy), honey(p + e.yxy) - honey(p - e.yxy), honey(p + e.yyx) - honey(p - e.yyx))); }
/* what a ray sees past the jar: the table with the jar's caustic, or the honeycomb wall */
fn backdrop(ro: vec3f, rd: vec3f, amber: f32) -> vec3f { var c = vec3f(0.06, 0.045, 0.03); if (rd.y < -0.001) { let t = -ro.y / rd.y; let p = ro + rd * t; if (t < 12.0) { let r = length(p.xz); c = vec3f(0.14, 0.10, 0.07) * (0.6 + 0.4 * exp(-r * 0.3)) + vec3f(1.0, 0.70, 0.22) * exp(-r * r * 1.4) * (0.35 + 0.45 * u.level) * (1.0 + amber); let wz = (-2.6 - ro.z) / rd.z; if (wz > 0.0 && wz < t) { let q = ro + rd * wz; c = wall(q); } return c; } }
  if (rd.z < -0.001) { let t = (-2.6 - ro.z) / rd.z; let p = ro + rd * t; if (p.y > 0.0) { return wall(p); } } return c; }
@fragment fn fs(o: VO) -> @location(0) vec4f { let aspect = u.res.x / u.res.y; let ndc = vec2f((o.uv.x - 0.75) * 4.0 * aspect * 0.5, (0.5 - o.uv.y) * 2.0); if (o.uv.x < 0.5) { return vec4f(0.105, 0.085, 0.055, 1.0); }
  let ro = vec3f(0.0, 1.9, 4.6); let ta = vec3f(0.0, 1.05, 0.0); let F = normalize(ta - ro); let R = normalize(cross(F, vec3f(0.0, 1.0, 0.0))); let Up = cross(R, F); let rd = normalize(F * 1.9 + R * ndc.x + Up * ndc.y);
  var col = backdrop(ro, rd, 0.0); var t = 0.0; var hit = 0.0; var m = 0.0; for (var i = 0; i < 90; i++) { let h = map(ro + rd * t); if (h.x < 0.0015) { hit = 1.0; m = h.y; break; } t += h.x; if (t > 14.0) { break; } }
  if (hit > 0.5) { let p = ro + rd * t; let key = normalize(vec3f(-0.5, 0.8, 0.4));
    if (m < 1.5) { /* glass: reflect the room, refract on through */ let n = nrmG(p); let fr = 0.04 + 0.96 * pow(1.0 - max(dot(n, -rd), 0.0), 5.0); let refl = env(reflect(rd, n)); let rr = refract(rd, n, 1.0 / 1.5);
      /* walk inside: out of the glass shell, then through whatever honey lies on the way; count the amber path */
      var q = p + rr * 0.02; var amber = 0.0; var dir = rr; var inHoney = false; var exited = false; var hn = vec3f(0.0); for (var j = 0; j < 70; j++) { let dg = glass(q); let dh = honey(q); let inside = dg < 0.0;
        if (!inside && !exited) { exited = true; let n2 = -nrmG(q); dir = normalize(refract(dir, n2, 1.5 / 1.0) + vec3f(1e-4)); }
        if (exited) { if (dh < 0.0) { inHoney = true; amber += 0.03; } else if (inHoney) { hn = nrmH(q); break; } let step_ = max(abs(dh) * 0.6, 0.03); q += dir * step_; if (length(q.xz) > 1.05 || q.y > 2.7 || q.y < -0.05) { break; } } else { q += dir * max(abs(dg) * 0.8, 0.01); } }
      var through = backdrop(q, dir, amber); let absorb = exp(-vec3f(0.35, 1.6, 4.0) * amber * 1.4); through = through * absorb + vec3f(0.98, 0.62, 0.14) * (1.0 - exp(-amber * 1.6)) * (0.35 + 0.65 * max(dot(hn, key), 0.0));
      col = mix(through, refl, fr) + vec3f(1.0, 0.95, 0.85) * pow(max(dot(n, normalize(key - rd)), 0.0), 240.0) * 1.2; }
    else { /* honey seen directly, above the glass lip: a drop, or the surface */ let n = nrmH(p); let nd = max(dot(n, key), 0.0); let fr = pow(1.0 - max(dot(n, -rd), 0.0), 3.0); col = vec3f(0.92, 0.55, 0.12) * (0.35 + 0.75 * nd) + env(reflect(rd, n)) * (0.08 + 0.5 * fr) + vec3f(1.0, 0.95, 0.85) * pow(max(dot(n, normalize(key - rd)), 0.0), 120.0); } }
  col = col / (1.0 + col * 0.3) * 1.15; return vec4f(pow(max(col, vec3f(0.0)), vec3f(1.0 / 2.2)), 1.0); }`;

export function nectarApp() {
  let canvas = null, dev = null;
  const C = { bg: [0.105, 0.085, 0.055, 1], ink: [0.96, 0.93, 0.86, 1], dim: [0.60, 0.54, 0.44, 1], gold: [0.95, 0.72, 0.25, 1], cool: [0.55, 0.75, 0.90, 1], glass: [1, 1, 1, 0.07], glassHi: [1, 1, 1, 0.13], red: [0.93, 0.42, 0.36, 1] };
  let ui = null, s = null, hover = null, seg = 0, tilt = 0, stir = 0, dragging = false, y0 = 0;
  let shown = 2418.60, from = 2418.60, target = 2418.60, tMove = -9, nextTx = 0, spent = 0.42, spentShown = 0.42, sub = 'Updated just now', drop = { t0: -1e9, dir: 1 };
  const TXS = [['Ottolenghi', -38.40, 'Eating out'], ['TfL travel', -6.70, 'Transport'], ['Salary · Hive Ltd', 3120.00, 'Income'], ['Rent · Marchmont', -1450.00, 'Home'], ['Refund · Cos', 62.00, 'Shopping'], ['Deliveroo', -24.90, 'Eating out'], ['Waterstones', -18.99, 'Shopping'], ['Interest', 4.12, 'Honey Jar'], ['Council tax', -168.00, 'Home'], ['Transfer from Joint', 200.00, 'Transfers']];
  const list = [['Ottolenghi', -38.40, 'Eating out'], ['TfL travel', -6.70, 'Transport'], ['Salary · Hive Ltd', 3120.00, 'Income'], ['Waterstones', -18.99, 'Shopping']];
  const spring = (k) => 1 - Math.exp(-5.5 * k) * Math.cos(9.0 * k) * (1 - k * 0.3);
  const arrive = (now) => { const tx = TXS[Math.floor(hash2(Math.floor(now / 1000), 7) * TXS.length)]; from = shown; target = Math.max(0, target + tx[1]); tMove = now; spent = Math.max(0.05, Math.min(0.98, spent - tx[1] / 4200)); list.unshift([tx[0], tx[1], tx[2], now]); if (list.length > 4) list.length = 4; sub = tx[0]; drop = { t0: now, dir: tx[1] > 0 ? 1 : -1 }; };
  const money = (v) => (v > 0 ? '+' : '−') + '£' + Math.abs(v).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const draw = (now, hov) => { const T = now / 1000, u = ui; hover = hov; u.time = T;
    u.text(24, 26, 'Nectar', 30, C.gold, { weight: 700, track: -0.02 }); u.text(24, 66, 'Good morning, Amara', 12, C.dim);
    const accounts = [['Everyday', fmtGBP(shown), '•••• 4471 · current', ICONS.card], ['Honey Jar', '£8,240.00', 'Savings · 3.9 % AER', ICONS.bee], ['Joint', '£1,102.35', 'With Sam · 2 members', ICONS.person]];
    accounts.forEach(([nm, bal, sb, ic], i) => { const y = 96 + i * 78; const hot = hover === 'acc' + i; u.glass(24, y, 397, 68, i === 0 ? C.glassHi : hot ? C.glassHi : C.glass, 18, 0.06); if (i === 0) u.rect(24, y, 3, 68, C.gold, 1.5);
      u.glassDisc(52, y + 34, 16, [1, 1, 1, 0.1], 0.08); u.icon('acc' + i, 52 - 9, y + 34 - 9, 18, i === 0 ? C.gold : C.dim, ic); u.text(80, y + 14, nm, 15, C.ink, { weight: 600 }); u.text(80, y + 36, sb, 11, C.dim); u.text(404, y + 22, bal, 17, i === 0 ? C.gold : C.ink, { weight: 600, align: 'right', family: MONO }); u.hit('acc' + i, 24, y, 397, 68); });
    u.glass(24, 338, 397, 32, C.glass, 16); ['Today', 'This week', 'This month'].forEach((lab, i) => { const x = 27 + i * 131; if (i === seg) u.rect(x, 341, 128, 26, [1, 1, 1, 0.14], 13); u.text(x + 64, 346, lab, 12, i === seg ? C.ink : C.dim, { align: 'center', weight: i === seg ? 600 : 500 }); u.hit('seg' + i, x, 341, 128, 26); });
    list.forEach((tx, i) => { const y = 384 + i * 44; const fresh = tx[3] ? Math.max(0, 1 - (now - tx[3]) / 700) : 0; const op = 1 - fresh * 0.6; u.glass(24, y + (1 - ease(1 - fresh)) * -8, 397, 40, C.glass, 12, 0.05, op);
      u.glassDisc(46, y + 20, 13, [1, 1, 1, 0.08], 0.05, op); u.text(46, y + 12, tx[0][0], 12, C.dim, { align: 'center', weight: 700, op }); u.text(70, y + 5, tx[0], 13, C.ink, { weight: 500, op }); u.text(70, y + 22, tx[2], 10.5, C.dim, { op });
      u.text(404, y + 12, money(tx[1]), 13, tx[1] > 0 ? C.gold : C.ink, { align: 'right', family: MONO, weight: 600, op }); });
    [['Send', ICONS.send], ['Request', ICONS.down], ['Pay', ICONS.card]].forEach(([lab, ic], i) => { const cx = 92 + i * 130; const hot = hover === 'act' + i; u.glassDisc(cx, 578, 20, hot ? C.glassHi : [1, 1, 1, 0.1], 0.1); u.icon('act' + i, cx - 10, 568, 20, C.gold, ic); u.text(cx, 602, lab, 10.5, C.dim, { align: 'center', weight: 600 }); u.hit('act' + i, cx - 22, 556, 44, 60); });
    /* ── right pane: the jar, captioned ── */
    const cx = 0.75 * W; u.text(LEAF + 26, 40, 'EVERYDAY', 10, C.dim, { weight: 600, track: 0.18 }); u.text(LEAF + 26, 56, fmtGBP(shown), 34, C.ink, { weight: 800, family: MONO, track: -0.03 }); u.text(LEAF + 26, 100, sub, 12, C.dim, { weight: 500 });
    u.text(W - SAFE - 20, 40, Math.round(spentShown * 100) + '%', 22, C.gold, { align: 'right', weight: 800, family: MONO }); u.text(W - SAFE - 20, 70, 'OF THE MONTH\'S BUDGET', 8.5, C.dim, { align: 'right', weight: 600, track: 0.16 }); u.text(W - SAFE - 20, 84, 'lit cells on the wall', 9.5, C.dim, { align: 'right' });
    u.text(cx, 596, dragging ? 'STIRRING' : 'DRAG THE JAR TO STIR IT', 9.5, C.dim, { align: 'center', weight: 600, track: 0.16, op: 0.8 });
    [['more', ICONS.more], ['search', ICONS.search]].forEach(([id, ic], i) => { const dx = W - SAFE - 30, dy = 300 + i * 48; u.glassDisc(dx, dy, 18, hover === id ? C.glassHi : [1, 1, 1, 0.1], 0.1); u.icon('nd' + id, dx - 9, dy - 9, 18, C.ink, ic); u.hit(id, dx - 18, dy - 18, 36, 36); });
    u.rect(LEAF - 0.5, 0, 1, H, [0, 0, 0, 0.35]); };
  return { cursor: 'grab', init(d, host) { dev = d; canvas = host.canvas; ui = host.ui; const ru = uniform(48), pipe = render(JAR), g = bind(pipe, [ru]); s = { ru, pipe, g }; nextTx = performance.now() + 2500; },
    move(p) { if (dragging) { stir = Math.max(-1, Math.min(1, (p.x - y0) / 120)); y0 += (p.x - y0) * 0.2; } }, leave() { dragging = false; },
    down(p, id) { if (p.x > LEAF && !id) { dragging = true; y0 = p.x; } },
    up(p, id, same) { if (same && id && id.startsWith('seg')) seg = +id[3]; dragging = false; },
    destroy() { s.ru.destroy(); s = null; },
    frame(t, dt, now, hov) { if (!s) return; const T = now / 1000;
      if (now > nextTx) { arrive(now); nextTx = now + 5200 + 2600 * hash2(Math.floor(now), 3); }
      const k = Math.min(1, (now - tMove) / 1800); shown = from + (target - from) * spring(k); spentShown += (spent - spentShown) * Math.min(1, dt * 2.5);
      tilt += ((dragging ? stir : 0) + (k < 1 ? (1 - k) * 0.5 * Math.sin(k * 20) : 0) - tilt) * Math.min(1, dt * 3); stir *= Math.pow(0.2, dt);
      const level = Math.max(0.08, Math.min(0.92, shown / 4000)); const dk = Math.min(1, (now - drop.t0) / 1400); const dy = drop.dir > 0 ? 3.2 - (3.2 - (level * 1.9 + 0.1)) * ease(dk) : (level * 1.9 + 0.12) + 3.0 * ease(dk); const dr = dk < 1 ? 0.14 * (1 - dk * 0.3) : 0.0;
      const tgt = ui.prepare(0.6); dev.queue.writeBuffer(s.ru, 0, new Float32Array([tgt.w, tgt.h, T, level, 0.25 * Math.sin(T * 0.7), dy, 0.1, dr, spentShown, tilt, 0, 0]));
      const enc = dev.createCommandEncoder(); const rp = enc.beginRenderPass({ colorAttachments: [{ view: tgt.view, loadOp: 'clear', storeOp: 'store' }] }); rp.setPipeline(s.pipe); rp.setBindGroup(0, s.g); rp.draw(3); rp.end();
      draw(now, hov); ui.compose(enc); dev.queue.submit([enc.finish()]); } };
}
