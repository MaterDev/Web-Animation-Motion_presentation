// @ts-nocheck -- untyped sheet code, extracted from design/techniques/svg.html (lines 2027–2175, §4 THE PIPELINE stage); see NOTES.md
import { stage } from '../../_kit/stage.js';
import { createWAM } from '../../_kit/wam.js';
import { disposer } from '../../_kit/disposer.js';
import css from './demo.css?raw';
import html from './demo.html?raw';
import H from './data/ai-history.js';
import M from './data/map.js';

/* ── 4 · THE PIPELINE, stage ──────────────────────────────────
   The same three primitives as the bench above, one screen up in
   scale, over the projected map. Every radius here is COUNTED from the
   dataset — events on record at a site plus movements in and out of
   it, both as of the year on the readout. No magnitude was authored to
   make a shape, which matters because the fusions are the argument and
   a tuned radius would be tuning the argument. */

export function mount(host) {
  const bin = disposer();
  const { root } = stage(host, { css, html });
  const wam = createWAM({ root });
  bin.add(() => wam.dispose());
  const slide = root.getElementById('wxSlide');
  const paper = root.getElementById('wxPaper');
  const NS = 'http://www.w3.org/2000/svg';
  const svg = root.getElementById('wxSvg');
  const [Y0, Y1] = H.span;
  /* Derived from where the data actually projects, not a constant. It
     was hardcoded, and the moment the projection's central meridian
     moved — it did, to put the sheet's seam over open ocean — the
     window was pointing at the wrong ocean. A radar shows its coverage
     area; this computes it. */
  const VB = (function () {
    const pts = Object.values(M.geo);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const pad = 90;
    let x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad;
    let cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const w = x1 - x0, h = w * (540 / 960);
    return { x: x0, y: cy - h / 2, w, h };
  })();

  svg.setAttribute('viewBox',
    VB.x.toFixed(1) + ' ' + VB.y.toFixed(1) + ' ' + VB.w.toFixed(1) + ' ' + VB.h.toFixed(1));

  function fit() {
    const k = paper.clientWidth / 960;
    slide.style.transform = 'scale(' + k + ')';
    paper.style.height = Math.round(540 * k) + 'px';
  }
  if ('ResizeObserver' in window) bin.observer(new ResizeObserver(fit)).observe(paper);
  fit();

  const mk = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    parent.appendChild(e);
    return e;
  };

  /* Graticule, on the projected plane. Drawn from the layer's own
     coordinates rather than re-projected, because the camera never
     moves on this stage — this one is a fixed coverage area. */
  const grat = root.getElementById('wxGrat');
  for (let x = Math.ceil(VB.x / 60) * 60; x <= VB.x + VB.w; x += 60) mk('line', { class: 'wx-grat', x1: x, x2: x, y1: VB.y, y2: VB.y + VB.h }, grat);
  for (let y = Math.ceil(VB.y / 60) * 60; y <= VB.y + VB.h; y += 60) mk('line', { class: 'wx-grat', x1: VB.x, x2: VB.x + VB.w, y1: y, y2: y }, grat);

  mk('path', { class: 'wx-coast', d: M.layers[0].d }, root.getElementById('wxMap'));

  /* One cell per SITE, not per event: co-located events share a place,
     and it is places that accumulate. Keyed by projected position so
     two entries at the same institution land in one cell rather than
     two stacked ones. */
  const sites = new Map();
  for (const n of H.nodes) {
    const g = M.geo[n.id];
    if (!g) continue;
    const key = g[0].toFixed(1) + ',' + g[1].toFixed(1);
    if (!sites.has(key)) sites.set(key, { x: g[0], y: g[1], org: n.org, events: [], deg: [] });
    sites.get(key).events.push(n);
  }
  /* Degree, counted. An arc contributes to both ends in the year it
     happened — that is the movement arriving somewhere and leaving
     somewhere else, and both are activity. */
  const byId = Object.fromEntries(H.nodes.map((n) => [n.id, n]));
  for (const a of H.arcs) {
    for (const id of [a.from, a.to]) {
      const g = M.geo[id]; if (!g) continue;
      const key = g[0].toFixed(1) + ',' + g[1].toFixed(1);
      if (sites.has(key)) sites.get(key).deg.push(a.year);
    }
  }
  const field = root.getElementById('wxField');
  const sitesG = root.getElementById('wxSites');
  const RAMP = ['--wx-1', '--wx-2', '--wx-3', '--wx-4', '--wx-5'];
  const cells = [...sites.values()].map((st) => ({
    ...st,
    blob: mk('circle', { cx: st.x.toFixed(2), cy: st.y.toFixed(2), r: 0 }, field),
    dot: mk('circle', { class: 'wx-site', cx: st.x.toFixed(2), cy: st.y.toFixed(2), r: 1.4 }, sitesG),
  }));

  const yearEl = root.getElementById('wxYear');
  const hotEl = root.getElementById('wxHot');
  const cellsEl = root.getElementById('wxCells');
  const massEl = root.getElementById('wxMass');
  const pct = (v, d) => (v / d * 100) + '%';
  root.getElementById('wxChrome').style.cssText += ';left:' + pct(34, 960) + ';top:' + pct(18, 540);
  yearEl.style.cssText += ';right:' + pct(34, 960) + ';top:' + pct(14, 540);
  root.getElementById('wxKeyEl').style.cssText += ';left:' + pct(34, 960) + ';bottom:' + pct(58, 540);

  /* Two blobs belong to one mass when they overlap — the same
     condition the threshold uses to weld them, so this count is a
     reading of the picture rather than a second opinion about it.
     Union-find over the cells present this year. */
  function massCount(live) {
    const parent = live.map((_, i) => i);
    const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        const d = Math.hypot(live[i].x - live[j].x, live[i].y - live[j].y);
        if (d < (live[i].r + live[j].r) * 0.92) parent[find(i)] = find(j);
      }
    }
    return new Set(live.map((_, i) => find(i))).size;
  }

  function render(t) {
    /* Eased so the field rests at both ends rather than sliding past
       the two states worth looking at — diffuse, and collapsed. */
    const u = t;
    const year = Y0 + u * (Y1 - Y0);
    yearEl.textContent = Math.floor(year);

    const live = [];
    let hot = null;
    for (const c of cells) {
      const n = c.events.filter((e) => e.year <= year).length;
      const d = c.deg.filter((y) => y <= year).length;
      const w = n + d;
      /* sqrt, so a site with nine units is three times the RADIUS and
         nine times the area of one with one — area is what the eye
         reads as quantity, and a linear radius would overstate it. */
      const r = w ? 5.5 + Math.sqrt(w) * 5.2 : 0;
      c.blob.setAttribute('r', r.toFixed(2));
      c.blob.style.fill = w ? 'var(' + RAMP[Math.min(RAMP.length - 1, w - 1)] + ')' : 'none';
      c.dot.style.opacity = w ? 0.85 : 0.18;
      if (w) { live.push({ x: c.x, y: c.y, r, w, org: c.org }); if (!hot || w > hot.w) hot = { w, org: c.org }; }
    }
    cellsEl.textContent = live.length;
    massEl.textContent = live.length ? massCount(live) : 0;
    hotEl.textContent = hot ? hot.org + ' · ' + hot.w + ' units' : '—';
  }

  wam.clock('pipeline-stage', { render, dur: 15000, el: slide, poster: 1 });

  return () => bin.run();
}
