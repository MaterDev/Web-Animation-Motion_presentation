// @ts-nocheck -- untyped sheet code, extracted from design/techniques/svg.html (lines 2178–2555, §3 THE FRAME stage); see NOTES.md
import { stage } from '../../_kit/stage.js';
import { createWAM } from '../../_kit/wam.js';
import { disposer } from '../../_kit/disposer.js';
import css from './demo.css?raw';
import html from './demo.html?raw';
import H from './data/ai-history.js';
import M from './data/map.js';

/* ── 3 · THE FRAME, stage ─────────────────────────────────────
   The camera the bench chose, on the map the build projected. Nested
   <g transform> rather than the root viewBox, for the reasons the
   bench's verdict panel gives — not because it measured faster, which
   it did not, but because the viewBox belongs to responsive sizing and
   to the filmstrip's clones. */

export function mount(host) {
  const bin = disposer();
  const { root } = stage(host, { css, html });
  const wam = createWAM({ root });
  bin.add(() => wam.dispose());
  const sheet = root.getElementById('svSheet');
  const paper = root.getElementById('svPaper');
  const NS = 'http://www.w3.org/2000/svg';
  const svg = sheet.querySelector('svg');
  const cam = root.getElementById('svCam');
  const W = M.frame.w, HH = M.frame.h;
  const LV = M.layers;

  /* How far below its nominal k a level is swapped in. Below its own k
     the coarse layer is still the honest one — 10m coastline shown at
     world scale is not more accurate, it is the same shoreline drawn
     with more points than the pixels can hold — and 0.7 is where the
     difference between the two goes under a pixel. */
  const SWITCH = 0.7;
  /* How much wider than its viewport the build cut each level. Read
     from the map rather than retyped, because vendor.js chose it and a
     crossfade that started earlier than the geometry reaches would
     fade in a layer with a visible rectangular edge. */
  const MARGIN = M.margin;
  const smoothstep = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

  let scale = 1;
  function fit() {
    scale = paper.clientWidth / 960;
    sheet.style.transform = 'scale(' + scale + ')';
    paper.style.height = Math.round(540 * scale) + 'px';
  }
  if ('ResizeObserver' in window) bin.observer(new ResizeObserver(fit)).observe(paper);
  fit();

  const mk = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    parent.appendChild(e);
    return e;
  };

  /* One path per level, all present, only one shown. Swapping the `d`
     of a single path instead would re-parse a 240 KB string on the
     frame the level changes, which is exactly the frame that can least
     afford it. */
  const gLand = root.getElementById('svLand');
  const gShelf = root.getElementById('svShelf');
  const gTex = root.getElementById('svTex');
  const gBord = root.getElementById('svBord');
  const stipple = root.getElementById('sv-stipple');
  const layers = LV.map((l) => {
    if (l.beyondMap) return null;
    /* A level whose whole box is inland has no coastline to draw and no
       water to draw it against — the ground is simply land. Painting
       the usual blue sheet under an empty path is how the ocean ended
       up covering New Hampshire. */
    if (l.solidLand) return { solid: true };
    const shelves = [1, 2, 3].map((n) =>
      mk('path', { class: 'sv-shelf sv-shelf-' + n, d: l.d }, gShelf));
    return {
      land: mk('path', { class: 'sv-land', d: l.d }, gLand),
      tex: mk('path', { class: 'sv-stipple', d: l.d }, gTex),
      bord: l.borders ? mk('path', { class: 'sv-border', d: l.borders }, gBord) : null,
      state: l.states ? mk('path', { class: 'sv-state', d: l.states }, gBord) : null,
      county: l.counties ? mk('path', { class: 'sv-county', d: l.counties }, gBord) : null,
      shelves,
    };
  });

  /* Place names, one pool for every level; which ones are eligible is
     decided per frame by the level that is showing. */
  const placeLayer = root.getElementById('svLabels');
  const places = LV.flatMap((l, i) => (l.named || []).map((n) => {
    const d = document.createElement('div');
    d.className = 'sv-place r' + n.r;
    d.textContent = n.n;
    placeLayer.appendChild(d);
    return { ...n, level: i, el: d };
  }));



  const gGrat = root.getElementById('svGrat');
  for (let x = 0; x <= W; x += 100) mk('line', { class: 'sv-grat', x1: x, x2: x, y1: 0, y2: HH }, gGrat);
  for (let y = 0; y <= HH; y += 100) mk('line', { class: 'sv-grat', x1: 0, x2: W, y1: y, y2: y }, gGrat);

  /* The reticle: the index mark that says where the next sheet in the
     series sits. It is drawn in map units and counter-scaled every
     frame so it stays a constant size on the page — a mark that grew
     with the zoom would stop being a locator and become a shape. */
  const gMarks = root.getElementById('svMarks');
  const tgt = LV[LV.length - 1];
  const retic = mk('g', {}, gMarks);
  mk('circle', { class: 'sv-retic-fill', cx: 0, cy: 0, r: 26 }, retic);
  mk('circle', { class: 'sv-retic', cx: 0, cy: 0, r: 26 }, retic);
  mk('line', { class: 'sv-retic', x1: -38, x2: -12, y1: 0, y2: 0 }, retic);
  mk('line', { class: 'sv-retic', x1: 12, x2: 38, y1: 0, y2: 0 }, retic);
  mk('line', { class: 'sv-retic', x1: 0, x2: 0, y1: -38, y2: -12 }, retic);
  mk('line', { class: 'sv-retic', x1: 0, x2: 0, y1: 12, y2: 38 }, retic);

  const sites = H.nodes.filter((n) => M.geo[n.id]).map((n) => {
    const g = M.geo[n.id];
    const dot = mk('circle', { class: 'sv-site', cx: g[0], cy: g[1], r: 3 }, gMarks);
    const lab = document.createElement('div');
    lab.className = 'sv-lab';
    lab.textContent = n.short;
    lab.dataset.testid = 'frame-label-' + n.id;
    root.getElementById('svLabels').appendChild(lab);
    return { ...n, x: g[0], y: g[1], dot, lab };
  });
  /* Dartmouth is what the flight is for, so it is marked as the target
     rather than being one label among thirty. */
  const target = sites.find((n) => n.id === 'dartmouth');
  if (target) target.lab.classList.add('is-target');

  /* Measure every label once, rather than estimating its width from a
     character advance. Three passes at guessing the metrics of
     uppercase mono with tracking each left labels touching; offsetWidth
     is the browser's own answer, it is unaffected by the ancestor
     transform because it is layout rather than paint, and it converts
     to sheet units by one constant. Measured, not claimed — the same
     rule the rest of this sheet is held to.

     One forced layout at init, then never again. */
  const U0 = W / 960;
  for (const n of sites) { n.labW = n.lab.offsetWidth * U0; n.labH = n.lab.offsetHeight * U0; }
  for (const pl of places) {
    pl.w = pl.el.offsetWidth * U0; pl.h = pl.el.offsetHeight * U0;
    pl.el.style.display = 'none';
  }

  const plate = root.getElementById('svPlate');
  const scaleBar = root.getElementById('svScale');
  const record = root.getElementById('svRecord');
  plate.style.cssText += ';left:22px;top:22px';
  scaleBar.style.cssText += ';left:22px;bottom:22px';

  if (target) {
    record.innerHTML =
      '<div class="card">' +
      '<div class="yr">' + target.year + '</div>' +
      '<div class="ttl">' + target.label + '</div>' +
      '<div class="meta">' + target.place + '<br>' +
      'past the end of the map — solid land, no coastline within 60 km<br>' +
      'the reticle is still centred; there is simply nothing left to draw</div>' +
      '</div>';
  }

  /* Log-space zoom. Linear interpolation of k spends almost the whole
     flight already deep: the first half of a 1→384 linear ramp covers
     1→192, which is seven of the eight doublings. In log space every
     doubling takes the same time, which is what a constant rate of
     zoom means to an eye — and it is also what makes the level changes
     land evenly instead of all at once at the start. */
  const HOLD = 0.08;
  const legs = LV.length - 1;
  const LEG = (1 - HOLD * legs) / legs;
  function camAt(t) {
    for (let i = 0; i < legs; i++) {
      const a = i * (LEG + HOLD);
      if (t < a + LEG) {
        const p = Math.max(0, (t - a) / LEG);
        const e = 1 - Math.pow(1 - p, 3);
        const k = Math.exp(Math.log(LV[i].k) + (Math.log(LV[i + 1].k) - Math.log(LV[i].k)) * e);
        return { k, cx: LV[i].cx + (LV[i + 1].cx - LV[i].cx) * e,
                 cy: LV[i].cy + (LV[i + 1].cy - LV[i].cy) * e, at: i + e };
      }
      if (t < a + LEG + HOLD) return { k: LV[i + 1].k, cx: LV[i + 1].cx, cy: LV[i + 1].cy, at: i + 1 };
    }
    const last = LV[LV.length - 1];
    return { k: last.k, cx: last.cx, cy: last.cy, at: legs };
  }

  function render(t) {
    const c = camAt(t);
    cam.setAttribute('transform',
      'translate(' + (W / 2) + ' ' + (HH / 2) + ') scale(' + c.k.toFixed(5) +
      ') translate(' + (-c.cx).toFixed(4) + ' ' + (-c.cy).toFixed(4) + ')');

    /* Device pixels per map unit. The sheet is 960 CSS px for a
       1600-unit box, scaled again by the page fit, then by the camera
       — every one of those multiplies. Inverse stroke-width, not
       vector-effect: the bench measured vector-effect landing at 2
       device px on a 2x display, and the criterion is one. */
    const dpr = window.devicePixelRatio || 1;
    const D = (960 / W) * scale * c.k * dpr;
    const hair = (1 / D).toFixed(6);
    for (const L2 of layers) if (L2 && L2.land) {
      L2.land.style.strokeWidth = hair;
      if (L2.bord) L2.bord.style.strokeWidth = (1.6 / D).toFixed(6);
      if (L2.state) L2.state.style.strokeWidth = (1.3 / D).toFixed(6);
      if (L2.county) L2.county.style.strokeWidth = (1 / D).toFixed(6);
    }
    for (const el of gGrat.children) el.style.strokeWidth = hair;
    /* Counter-scale the halftone so the dots stay a constant size on
       the page rather than becoming circles at depth. */
    stipple.setAttribute('patternTransform', 'scale(' + (1 / c.k).toFixed(6) + ')');

    /* Only the level whose geometry is cut for this scale. SWITCH is
       declared at the top of the stage, with the reason it is 0.7. */
    let show = 0;
    for (let i = 0; i < LV.length; i++) if (!LV[i].beyondMap && c.k >= LV[i].k * SWITCH) show = i;

    /* Ground swaps hard; divisions cross-fade.

       The ground can swap on one frame because the 0.7 is chosen so
       that it is the same shoreline at a scale where the difference
       between the two resolutions is under a pixel — there is nothing
       to see. Division lines are the opposite case: a county mesh has
       no coarse version to be confused with, so switching it on at
       full strength puts several thousand lines on the sheet between
       one frame and the next, and that reads as a fault in the paper
       rather than as detail arriving.

       The band costs nothing extra, because the build already pays for
       it. vendor.js cuts each level with MARGIN 1.6, so a level's
       geometry covers the frame from k/1.6 upward while the swap does
       not happen until k*0.7 — everything between is a window where
       both levels are complete and either may be drawn. That margin is
       there for this: see the comment at scripts/vendor.js:401. */
    const enter = (l) => smoothstep(
      (Math.log(c.k) - Math.log(l.k / MARGIN)) /
      (Math.log(l.k * SWITCH) - Math.log(l.k / MARGIN)));

    layers.forEach((L2, i) => {
      if (!L2 || L2.solid) return;
      const on = i === show ? '' : 'none';
      L2.land.style.display = on; L2.tex.style.display = on;
      for (const sh of L2.shelves) sh.style.display = on;

      /* In as this level's own band opens, out as the next one's does.
         The min is what makes the handover continuous: at any k the two
         adjacent levels' weights sum to 1 across the overlap, so the
         total ink on the sheet never jumps. */
      const nx = LV[i + 1];
      const w = Math.min(
        i === 0 ? 1 : enter(LV[i]),
        (nx && !nx.beyondMap && !nx.solidLand) ? 1 - enter(nx) : 1);
      for (const p of [L2.bord, L2.state, L2.county]) {
        if (!p) continue;
        p.style.display = w > 0.002 ? '' : 'none';
        p.style.setProperty('--fade', w.toFixed(4));
      }
    });
    /* The sheet's own ground is the water, so an all-land level has to
       repaint it — otherwise the frame is an ocean with a coastline
       drawn on top of nowhere. */
    sheet.style.background = (layers[show] && layers[show].solid)
      ? 'var(--sv-land)' : 'var(--sv-water)';

    /* Counter-scaled so the reticle and the site dots stay a constant
       size on the page rather than growing into shapes. */
    const inv = (1 / c.k);
    retic.setAttribute('transform',
      'translate(' + tgt.cx + ' ' + tgt.cy + ') scale(' + inv.toFixed(6) + ')');
    retic.style.opacity = c.at >= legs - 0.02 ? 0 : 1;

    /* Semantic zoom: a level admits a rank, and ranks below it drop
       out. This is the dataset's own `level` field — the same one §2's
       standing labels read — so the two sections agree about which
       events are landmarks. */
    const lvl = Math.min(LV.length - 1, Math.floor(c.at + 0.35));

    /* Semantic zoom is not "show more labels as you go in". A level
       admits only what it can HOLD, which means two filters, and the
       first version only had the first one: rank gates which events are
       eligible, and then collision decides which of those actually get
       drawn. Without the second, sheet 2 offered twenty-four eligible
       labels into one corner of the Northeast and printed all of them
       on top of each other.

       Priority is rank, then year — so a landmark keeps its label and
       the thing that loses is always the more minor of two, rather than
       whichever happened to come later in the array. The target is
       placed first unconditionally: it is what the flight is for. */
    /* Hiding a label has to clear its position too. A label culled by the
       collision pass keeps whatever left/top the previous frame gave it,
       which is invisible on screen and makes render(t) non-idempotent —
       the same t reached from two different frames produces two different
       outerHTMLs. Caught by the acceptance check, not by looking. */
    const hide = (el) => {
      el.style.display = 'none';
      el.style.left = ''; el.style.top = '';
    };

    const cand = [];
    for (const n of sites) {
      const sx = (W / 2) + (n.x - c.cx) * c.k;
      const sy = (HH / 2) + (n.y - c.cy) * c.k;
      n.dot.setAttribute('r', (3 * inv).toFixed(5));
      const inFrame = sx > -60 && sx < W + 60 && sy > -40 && sy < HH + 40;
      const eligible = inFrame && n.level <= lvl;
      n.dot.style.display = inFrame ? '' : 'none';
      if (eligible) cand.push({ n, sx, sy });
      else hide(n.lab);
    }
    cand.sort((a, b) => (a.n === target ? -1 : b.n === target ? 1
      : a.n.level - b.n.level || a.n.year - b.n.year));

    /* Boxes in the sheet's own 1600x900 space — and the conversion is
       the whole trick. The labels are HTML sized in CSS pixels, but sx
       and sy are map units, and the sheet draws a 1600-unit box into
       960 CSS px. Comparing a 6.6px character advance directly against
       map units understated every box by 1.667x, which is why the first
       cull still left labels touching. */
    const U = W / 960;
    const PAD = 4 * U;
    const placed = [];
    for (const c2 of cand) {
      const w = c2.n.labW + PAD * 2, h = c2.n.labH;
      const box = { l: c2.sx - w / 2, r: c2.sx + w / 2, t: c2.sy - 10 - h, b: c2.sy - 10 + PAD };
      const hit = placed.some((q) => box.l < q.r && q.l < box.r && box.t < q.b && q.t < box.b);
      if (hit) { hide(c2.n.lab); continue; }
      placed.push(box);
      c2.n.lab.style.display = '';
      c2.n.lab.style.left = (c2.sx / W * 100) + '%';
      c2.n.lab.style.top = ((c2.sy - 10) / HH * 100) + '%';
    }

    /* Place names run through the same cull, but AFTER the events — so
       when a county name and a landmark want the same square inch, the
       landmark keeps it. The ground never displaces the subject. */
    for (const pl of places) {
      if (pl.level !== show) { hide(pl.el); continue; }
      const sx = (W / 2) + (pl.x - c.cx) * c.k;
      const sy = (HH / 2) + (pl.y - c.cy) * c.k;
      if (sx < 40 || sx > W - 40 || sy < 30 || sy > HH - 30) { hide(pl.el); continue; }
      const w = pl.w + PAD * 2, h = pl.h + PAD;
      const box = { l: sx - w / 2, r: sx + w / 2, t: sy - h / 2, b: sy + h / 2 };
      if (placed.some((q) => box.l < q.r && q.l < box.r && box.t < q.b && q.t < box.b)) {
        hide(pl.el); continue;
      }
      placed.push(box);
      pl.el.style.display = '';
      pl.el.style.left = (sx / W * 100) + '%';
      pl.el.style.top = (sy / HH * 100) + '%';
    }

    const L = LV[Math.min(LV.length - 1, Math.round(c.at))];
    plate.innerHTML =
      '<span class="t">sheet ' + (Math.round(c.at) + 1) + ' of ' + LV.length + '</span>' +
      '<b>' + L.label + '</b><br>' +
      'scale &nbsp;<b>×' + (c.k < 10 ? c.k.toFixed(2) : Math.round(c.k)) + '</b><br>' +
      'source&nbsp; <b>' + (L.beyondMap ? 'none at this scale' : 'natural earth ' + L.res) + '</b><br>' +
      'projection <b>mercator, ' + M.distortion.toFixed(2) + '× at target</b>';

    /* A scale bar is the one piece of map furniture that must be
       recomputed rather than drawn once — that is the whole point of
       it. 100 map units, measured in CSS px at the current zoom. */
    const px = 100 * (960 / W) * c.k;
    scaleBar.innerHTML = '<span class="bar" style="width:' + Math.min(150, px).toFixed(0) + 'px">' +
      '<i style="width:25%"></i><i style="width:25%"></i><i style="width:25%"></i><i style="width:25%"></i></span>' +
      '<span>100 units</span>';

    /* The record. Fades up exactly as the map runs out. */
    /* Featureless, not merely empty: the deepest box turns out to be
       entirely inland rather than off the edge of the data, and either
       way there is nothing left to draw there. */
    const beyond = LV[LV.length - 1].beyondMap || LV[LV.length - 1].solidLand;
    const near = Math.max(0, Math.min(1, (c.at - (legs - 1)) / 1));
    record.hidden = !(beyond && near > 0.01);
    record.style.opacity = beyond ? near.toFixed(3) : 0;
  }

  wam.clock('frame-stage', { render, dur: 20000, el: sheet, poster: 1 });

  return () => bin.run();
}
