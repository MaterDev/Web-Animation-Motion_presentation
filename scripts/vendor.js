/* Vendors third-party runtime deps out of node_modules and into
   design/vendor/, so nothing on this site loads from a CDN.

   Why this exists at all: the design harness is a set of standalone
   HTML tearsheets with no build step — that property has been
   load-bearing for the whole build, since every verification pass so
   far has been "open the file in a browser and look at it". Those
   pages can't `import 'animejs'`; they need a real file at a real
   relative path. So the app imports from node_modules normally (Vite
   bundles it) and the harness reads these vendored copies. One
   dependency, one version, two consumers.

   This also closes a risk SCOPE.md raised on its own: the WebGL page
   previously pulled Three.js from unpkg at runtime, with a note that
   the real build should vendor it rather than depend on a live CDN
   during the talk. It now does.

   Fonts are copied out of the @fontsource-variable packages as bare
   .woff2 files. The @font-face declarations that name them are NOT
   generated — they live in design/system/fonts.css as a real part of
   the system, so the app can @import that file and have Vite hash
   the fonts while the harness <link>s the same file and resolves the
   same relative paths off disk. One declaration, two consumers.

   Doto needs the `full` file specifically, not `wght` or `rond`: the
   system uses weight 900 AND the ROND axis at 100 together, and only
   the full variant carries both axes. */
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const out = new URL('design/vendor/', root);

await rm(out, { recursive: true, force: true });
await mkdir(new URL('fonts/', out), { recursive: true });

/* ── JS: bundled to single files with Bun ──────────────────
   The published packages are multi-file ESM (three.module.js pulls
   three.core.js; animejs splits across dist/modules/*), which a
   plain copy would break. Bundling flattens each to one file the
   harness can import directly. */
/* Prefer a prebuilt single-file bundle when the package ships one.
   animejs does (dist/bundles/anime.esm.min.js) and it must be used:
   its module entry is a pure re-export barrel, and bundling that
   with Bun silently produced a 900-byte file containing only an
   export list — "Bundled 1 module" — that imports without error and
   fails the moment anything is called. Caught by checking the
   artifact's size and contents rather than trusting the exit code.

   Three has no single-file ESM build (three.module.js pulls
   three.core.js), so it genuinely needs bundling, and that path
   works — verified by grepping the output for surviving bare
   imports, of which there are none. */
const copies = [
  { from: 'node_modules/animejs/dist/bundles/anime.esm.min.js', outfile: 'anime.esm.js' },
];

for (const { from, outfile } of copies) {
  await cp(new URL(from, root), new URL(outfile, out));
  const size = Bun.file(new URL(outfile, out)).size;
  if (size < 20_000) {
    console.error(`vendor: ${outfile} is only ${size} bytes — that is not a real bundle`);
    process.exit(1);
  }
  console.log(`vendor: ${from} → design/vendor/${outfile} (${Math.round(size / 1024)} KB)`);
}

const bundles = [
  { entry: 'three', outfile: 'three.module.js' },
];

for (const { entry, outfile, expect } of bundles) {
  /* No `outdir`/`naming` here on purpose. Passing both made Bun
     write every emitted artifact — the entry *and* its code-split
     chunks — to the same filename, so they overwrote each other and
     anime.esm.js came out as a 1KB file containing nothing but an
     export list referencing identifiers that no longer existed. It
     imported without error and failed at use. Taking the build
     result in memory and writing exactly one artifact avoids the
     whole class of problem; the assert below catches it if a future
     version starts splitting anyway. */
  const result = await Bun.build({
    entrypoints: [entry.includes('/') ? new URL(entry, root).pathname : Bun.resolveSync(entry, process.cwd())],
    format: 'esm',
    target: 'browser',
    minify: true,
  });
  if (!result.success) {
    console.error(`vendor: failed to bundle ${entry}`);
    for (const log of result.logs) console.error(log);
    process.exit(1);
  }
  if (result.outputs.length !== 1) {
    console.error(`vendor: expected 1 artifact for ${entry}, got ${result.outputs.length} — bundle would be incomplete`);
    process.exit(1);
  }
  const code = await result.outputs[0].text();
  await writeFile(new URL(outfile, out), code);
  /* Assert the API survived, not just the byte count. A bundle can be
     the right size and still export nothing callable — which is
     exactly how the animejs barrel failed. */
  if (expect) {
    const mod = await import(new URL(outfile, out).href);
    const missing = expect.filter((k) => typeof mod[k] !== 'function');
    if (missing.length) {
      console.error(`vendor: ${outfile} is missing export(s): ${missing.join(', ')}`);
      process.exit(1);
    }
  }
  console.log(`vendor: ${entry} → design/vendor/${outfile} (${Math.round(code.length / 1024)} KB` +
    (expect ? `, exports verified: ${expect.join(', ')}` : '') + ')');
}

/* ── AI history: the deck's one dataset ────────────────────
   Read from scripts/data/ai-history.js, validated, laid out, and
   emitted for the harness. The layout is computed HERE rather than in
   the sheet for the same reason the map geometry will be: it is a pure
   function of the data, it never changes between frames, and doing it
   at load would put a solver on the critical path of a page someone is
   presenting from.

   Emitted as a SIDE-EFFECT GLOBAL, not an ES module export. The other
   artifacts in this directory are `export const`, which is correct for
   them — they are only consumed over localhost. This one is consumed by
   design/techniques/svg.html, which has to keep opening from disk, and
   `import` is blocked on file:// in both Chrome and Safari. */
{
  const data = await import(new URL('scripts/data/ai-history.js', root).href);
  data.validate();   /* throws on an unsourced entry, an unknown edge id, or an out-of-range coordinate */

  const { NODES, EDGES, LEVELS, ACTIVITY } = data;
  const Y0 = Math.min(...NODES.map((n) => n.year));
  const Y1 = Math.max(...NODES.map((n) => n.year));

  /* §2 is a chart recorder, so its geometry is emitted in the LED
     slide's own coordinate space — 960x540 on a 6px cell. That is a
     system constant (components.css .led-slide), not a number picked
     here, which is what makes it safe to bake absolute coordinates in:
     the slide is scaled by transform at display time, so every value
     below stays a whole number of cells at any size.

     Bands, all multiples of the 6px cell. The trace gets the most
     height because it is the headline; the arcs get a shallow band
     because they are the detail, and that ratio is the hierarchy. */
  const S = { w: 960, h: 540, cell: 6, padX: 108,
    traceTop: 84, traceBase: 258,      /* channel 1 — movements per year */
    arcTop: 270, base: 342,            /* the register: events and the movements between them */
    labelTop: 348, labelRows: 4, rowH: 24,
    axis: 450, axisText: 468, readout: 486 };
  const xOf = (year) => S.padX + ((year - Y0) / (Y1 - Y0)) * (S.w - S.padX * 2);
  const R2 = (v) => Math.round(v * 100) / 100;

  /* The trace. A chart recorder draws one continuous line and never
     lifts the pen — including across the years where the value is
     zero, which is the entire point: an absence has to be DRAWN to be
     seen. The old staging hid what had not happened yet, so a decade
     with no movement looked identical to a decade not yet reached. */
  const act = new Map(ACTIVITY.map((a) => [a.year, a.magnitude]));
  const trace = [];
  for (let y = Y0; y <= Y1; y++) {
    const m = act.get(y) || 0;
    trace.push([R2(xOf(y)), R2(S.traceBase - m * (S.traceBase - S.traceTop))]);
  }
  const traceD = 'M' + trace.map(([x, y]) => x + ' ' + y).join('L');

  /* Every event on one baseline — this is a strip chart, not a lane
     diagram, so y carries nothing and x is time. Arcs lift above it. */
  const nodes = [...NODES].sort((a, b) => a.year - b.year).map((n) => ({
    id: n.id, year: n.year, short: n.short, label: n.label, place: n.place,
    /* The institution, for the register strip: an edge is a movement
       between PLACES, so printing the two event names either side of an
       arrow ("R1/XCON → Deep Blue") describes the wrong relation. The
       first segment of `place` is the institution in almost every case;
       where the dataset had to pin a split or venue location it is
       whatever that note says, which is still the right place. */
    org: n.place.split(',')[0].trim(),
    level: n.level, x: R2(xOf(n.year)),
  }));
  const pos = Object.fromEntries(nodes.map((n) => [n.id, n]));

  const arcs = [...EDGES].sort((a, b) => a.year - b.year).map((e) => {
    const a = pos[e.from], b = pos[e.to];
    const dx = Math.abs(b.x - a.x);
    /* Square root, so a fifty-year movement is only about twice the
       arc of a twelve-year one and the long ones stay in the band. */
    const lift = Math.min(S.base - S.arcTop, 12 + Math.sqrt(dx) * 6.2);
    const top = S.base - lift;
    return { ...e, x1: a.x, x2: b.x,
      d: `M${a.x} ${S.base}C${a.x} ${R2(top)} ${b.x} ${R2(top)} ${b.x} ${S.base}` };
  });

  /* Only the twelve level-0 events get a standing label, and the rank
     is the dataset's own — the same field §3's semantic zoom reads.
     Laid out here because "which labels fit" is a layout question, and
     answering it at load would mean measuring text in the browser on
     the critical path. Anything that would collide is DROPPED rather
     than overlapped, and the count is reported so a silent drop is
     impossible to miss. */
  /* 6.6 px per character is JetBrains Mono's 0.6em advance at the
     11px these are set at — measured off the rendered sheet, since the
     CSS size is what decides it, not the font's own metrics. */
  /* Clear space stated as a rule rather than a pixel count: one and a
     half character widths, which is a normal word gap and reads as
     separation at projection distance. Picking a round 12 px instead
     cost Transformer its place by two pixels, which is exactly the
     kind of number that should not be decided by taste. */
  const LABEL_CH = 6.6, LABEL_GAP = LABEL_CH * 1.5, LABEL_ROWS = S.labelRows, ROW_H = S.rowH;
  const marked = nodes.filter((n) => n.level === 0);
  /* A finite sentinel, not -Infinity: the tightest-fit comparison is
     `slack < bestSlack`, and an infinite slack is never strictly less
     than the infinite starting best, so every row was disqualified and
     all twelve labels were dropped. */
  const rowEnd = new Array(LABEL_ROWS).fill(-1e6);
  const labels = [], dropped = [];
  for (const n of marked) {
    const wpx = n.short.length * LABEL_CH;
    const left = n.x - wpx / 2;
    /* Tightest fit, not first fit. First-fit packs everything into row
       0 until it jams and leaves the lower rows empty, which both
       wastes the band and drops labels that would have fitted — it
       cost Transformer a place. Choosing the row whose last label ends
       closest to this one keeps all four rows in play. */
    let row = -1, bestSlack = Infinity;
    for (let r = 0; r < LABEL_ROWS; r++) {
      const slack = left - rowEnd[r];
      if (slack >= LABEL_GAP && slack < bestSlack) { bestSlack = slack; row = r; }
    }
    if (row === -1) { dropped.push(n.short); continue; }
    rowEnd[row] = left + wpx;
    labels.push({ id: n.id, x: n.x, row, y: S.labelTop + row * ROW_H, w: R2(wpx), text: n.short });
  }

  const bad = arcs.filter((a) => /NaN|Infinity|undefined/.test(a.d));
  if (bad.length || /NaN|Infinity|undefined/.test(traceD)) {
    console.error('vendor: §2 geometry produced non-finite path data');
    process.exit(1);
  }
  const escaped = [...arcs.flatMap((a) => [...a.d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => [+m[1], +m[2]])),
                   ...trace]
    .filter(([x, y]) => !(x >= 0 && x <= S.w && y >= 0 && y <= S.h));
  if (escaped.length) {
    console.error(`vendor: ${escaped.length} §2 control points fall outside the ${S.w}x${S.h} slide`);
    process.exit(1);
  }

  await writeFile(
    new URL('ai-history.js', out),
    '/* Generated by scripts/vendor.js from scripts/data/ai-history.js.\n' +
      '   Sources are per-entry in that file; do not edit this copy.\n' +
      '   A side-effect global, NOT an ES module: the SVG tearsheet has to\n' +
      '   keep opening over file://, where import is blocked. */\n' +
      'globalThis.AI_HISTORY = ' + JSON.stringify({
        span: [Y0, Y1], strip: S, nodes, arcs, labels, traceD,
        levels: LEVELS, activity: ACTIVITY,
      }) + ';\n'
  );
  console.log(`vendor: ai-history → design/vendor/ai-history.js ` +
    `(${nodes.length} events ${Y0}–${Y1}, ${arcs.length} movements, ` +
    `${labels.length}/${marked.length} standing labels placed` +
    (dropped.length ? ` — DROPPED (would collide): ${dropped.join(', ')}` : '') + ')');
}

/* ── World map: projected at build time ────────────────────
   The sheet ships path strings. Nothing about d3-geo or topojson
   reaches the browser — a projection is a pure function of data that
   never changes between frames, and running it at load would put a
   solver on the critical path of a page someone is presenting from.

   Three resolutions, because one does not work: Natural Earth 110m is
   79 KB projected and falls apart by about x8; 10m is 6.3 MB, which is
   not shippable as a whole. So each zoom level gets the coarsest
   geometry that still holds up at that scale, clipped to what is
   actually on screen there. */
{
  const { feature, mesh } = await import('topojson-client');
  const { geoMercator, geoPath, geoContains } = await import('d3-geo');
  const data = await import(new URL('scripts/data/ai-history.js', root).href);
  const { NODES, LEVELS } = data;

  const W = 1600, HGT = 900;

  /* Where to cut the sphere, derived from the data rather than picked.
     A world map has to be split at some meridian, and splitting it
     through a node puts that node at both edges and neither. So: find
     the widest longitude gap in the dataset and cut there. It lands in
     central Asia, which this set has no entries in, and the map comes
     out centred on North America with Japan at one edge and Europe at
     the other — every node on one continuous sheet. */
  const lons = [...new Set(NODES.map((n) => n.lon))].sort((a, b) => a - b);
  const gaps = [];
  for (let i = 0; i < lons.length; i++) {
    const a = lons[i], b = lons[(i + 1) % lons.length];
    const gap = ((b - a) + 360) % 360;
    gaps.push({ gap, cut: ((a + gap / 2) + 540) % 360 - 180 });
  }
  gaps.sort((x, y) => y.gap - x.gap);

  /* The widest gap is not automatically the right meridian to cut. The
     widest one in this dataset is 122 degrees across central Asia, and
     cutting there slices the sheet through Kazakhstan and India —
     every world map is cut somewhere, and cutting through a continent
     is the one place it shows. So the cut has to clear the data AND
     fall over water, which is why every atlas cuts near the
     antimeridian.

     Tested against the coastline rather than hand-picked: a candidate
     is rejected if its meridian touches land at any of several
     latitudes. The Pacific gap between Japan and California is
     narrower at 98 degrees and wins, which puts the seam in open ocean
     near 171 W. */
  const probeTopo = await Bun.file(new URL('node_modules/world-atlas/land-110m.json', root)).json();
  const probeLand = feature(probeTopo, probeTopo.objects.land);
  const LATS = [-60, -30, -10, 0, 10, 30, 45, 60, 70];
  const overWater = (lon) => !LATS.some((lat) => geoContains(probeLand, [lon, lat]));
  const widest = gaps.find((g) => overWater(g.cut)) || gaps[0];
  if (!overWater(widest.cut)) {
    console.error('vendor: no data gap clears land — every candidate meridian cuts a continent');
    process.exit(1);
  }
  const centre = ((widest.cut + 180) + 540) % 360 - 180;

  const base = () => geoMercator().rotate([-centre, 0]).fitExtent([[0, 0], [W, HGT]], { type: 'Sphere' });
  const world = base();
  const at = (lon, lat) => world([lon, lat]);

  /* Mercator, and deliberately. The camera zooms this plane rather
     than re-projecting per level, so the projection has to be
     CONFORMAL — angle-preserving — or the deepest level shows a
     sheared building. Mercator is conformal everywhere; the price is
     an area stretch of 1/cos(lat), which is stated below rather than
     hidden, and over this dataset's 33-59 degree band it runs 1.2x to
     1.9x. An equal-area projection would trade that for shear at the
     one place the talk actually lands. */
  const target = LEVELS[LEVELS.length - 1];
  const distortion = 1 / Math.cos((target.lat * Math.PI) / 180);

  const RES = { '110m': null, '50m': null, '10m': null };
  const BORDERS = { '110m': null, '50m': null, '10m': null };
  for (const r in RES) {
    const topo = await Bun.file(new URL(`node_modules/world-atlas/land-${r}.json`, root)).json();
    RES[r] = feature(topo, topo.objects.land);
    /* Interior borders only — mesh with a filter that keeps arcs shared
       by two different countries and drops the ones shared with
       nothing, which are the coastlines. Drawing the country outlines
       instead would double every shoreline. */
    const ctry = await Bun.file(new URL(`node_modules/world-atlas/countries-${r}.json`, root)).json();
    BORDERS[r] = mesh(ctry, ctry.objects.countries, (a, b) => a !== b);
  }

  /* US divisions, from us-atlas — the unprojected files, because this
     build does its own projection and the -albers- variants arrive
     already flattened. This answers the spec's open question directly:
     clipped 50m land does NOT suffice for the mid-zoom, because a
     coastline is not a division and the middle levels of this flight
     are almost entirely inland. Country borders alone leave sheet 2 as
     one undifferentiated landmass.

     Counties are the finest boundary these public-domain sets carry.
     There is no municipal-boundary layer here, so the city-scale marks
     stay the dataset's own places rather than being invented. */
  const usTopo = await Bun.file(new URL('node_modules/us-atlas/counties-10m.json', root)).json();
  const US = {
    states: mesh(usTopo, usTopo.objects.states, (a, b) => a !== b),
    counties: mesh(usTopo, usTopo.objects.counties, (a, b) => a !== b),
  };
  /* Names, placed at each polygon's own centroid. A division you cannot
     name is decoration; a named one is the thing that makes a sheet
     informative rather than merely detailed. */
  const NAMED = {
    states: feature(usTopo, usTopo.objects.states).features,
    counties: feature(usTopo, usTopo.objects.counties).features,
  };

  /* Coarsest geometry that survives the level, clipped to the level's
     own viewport. clipExtent works in this projection's plane, which
     is exactly the plane the camera scales — so the clip box IS what
     will be on screen, and everything outside it costs nothing. */
  const RES_FOR = ['110m', '50m', '10m', '10m'];

  /* Coordinate precision derived from the pixel budget at each level,
     not chosen. The stage renders this 1600-unit box at roughly 1000
     CSS px, so one unit is ~0.625 px at k=1 and 0.625*k px at level k.
     Holding quantisation under a quarter of a pixel gives
     0.25 / (0.625*k) units, and the number of decimals follows.
     Uniform precision is the wrong answer in both directions: 2
     decimals visibly snaps the coastline to a grid at k=384, and is
     three times more than the world view can resolve. */
  const STAGE_PX = 1000, PX_BUDGET = 0.25;
  const digitsFor = (k) => Math.max(0, Math.min(4,
    Math.ceil(-Math.log10(PX_BUDGET / ((STAGE_PX / W) * k)))));
  const layers = LEVELS.map((lv, i) => {
    const plan = { res: RES_FOR[Math.min(i, RES_FOR.length - 1)], digits: digitsFor(lv.k) };
    const p = base();
    let clip = null;
    const [cx, cy] = at(lv.lon, lv.lat);
    if (i > 0) {
      /* HALF-widths. Writing W/k here rather than W/k/2 was a two-times
         error in each axis — four times the geometry — and it is
         invisible in the output because the extra is simply never on
         screen. It showed up only as a 580 KB layer.

         1.6 rather than 1.0 because a layer has to be complete from
         the moment it becomes the visible one, not from the moment the
         camera settles on it, and the crossfade starts early. */
      const MARGIN = 1.6;
      const hw = (W / lv.k) * 0.5 * MARGIN, hh = (HGT / lv.k) * 0.5 * MARGIN;
      clip = [[Math.max(0, cx - hw), Math.max(0, cy - hh)],
              [Math.min(W, cx + hw), Math.min(HGT, cy + hh)]];
      p.clipExtent(clip);
    }
    /* Coordinate precision is set on the PATH, not the projection —
       geoPath.digits(). Three decimals for the deep layers: at the
       levels this zooms to, two quantises to about a fifth of a device
       pixel and the coastline visibly snaps to a grid. */
    const path = geoPath(p);
    if (typeof path.digits === 'function') path.digits(plan.digits);
    let d = path(RES[plan.res]) || '';

    /* d3 emits the CLIP RECTANGLE as its own closed ring when it
       decides the polygon being clipped contains the whole box. On a
       MultiPolygon of four thousand rings that test gets it wrong, and
       the symptom is silent and total: a bare four-point rectangle in
       the path, filled under the nonzero rule, paints the entire frame
       as land and the ocean vanishes. It did, at level 2, and only at
       level 2 — the coastlines were still stroked correctly on top of
       it, which is what made it look like a fill bug rather than a
       geometry one.

       A legitimate clip against a coast comes back as one ring that
       runs along the shore and returns along the box edges — many
       points, not four. So a STANDALONE bare rectangle is always the
       bug, unless it is the only thing in the path, in which case the
       box really is entirely inland and the sheet should be solid
       land rather than solid water. Both cases are handled; neither
       is guessed at. */
    const subs = d.split(/(?=M)/).filter(Boolean);
    const onBox = (v, lo, hi) => Math.abs(v - lo) < 0.01 || Math.abs(v - hi) < 0.01;
    const isBoxRect = (sp) => {
      const pts = [...sp.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((m) => [+m[1], +m[2]]);
      if (pts.length < 4 || pts.length > 5 || !clip) return false;
      return pts.every(([x, y]) => onBox(x, clip[0][0], clip[1][0]) && onBox(y, clip[0][1], clip[1][1]));
    };
    const rects = subs.filter(isBoxRect);
    const kept = subs.filter((sp) => !isBoxRect(sp));
    const solidLand = rects.length > 0 && kept.length === 0;
    if (rects.length && !solidLand) d = kept.join('');

    const bpath = geoPath(p);
    if (typeof bpath.digits === 'function') bpath.digits(plan.digits);
    const borders = bpath(BORDERS[plan.res]) || '';

    /* Divisions deepen with the zoom, the same way the labels do:
       countries everywhere, states from the regional sheet down,
       counties only once the scale can hold them. Meshes are lines, so
       the clip-rectangle trap that bit the land fill does not apply —
       there is no area to fill and nothing for d3 to close. */
    const states = i >= 1 ? (bpath(US.states) || '') : '';
    const counties = i >= 2 ? (bpath(US.counties) || '') : '';

    /* Names for whatever is on this sheet, centroid-placed and kept
       only if the centroid is actually inside the clip box — a label
       whose polygon is off-sheet is worse than no label. */
    const inBox = (x, y) => !clip ||
      (x >= clip[0][0] && x <= clip[1][0] && y >= clip[0][1] && y <= clip[1][1]);
    const named = [];
    for (const [kind, rank] of [['states', 1], ['counties', 2]]) {
      if ((kind === 'states' && i < 1) || (kind === 'counties' && i < 2)) continue;
      for (const f of NAMED[kind]) {
        const c2 = geoPath(base()).centroid(f);
        if (!c2 || !isFinite(c2[0]) || !inBox(c2[0], c2[1])) continue;
        named.push({ n: f.properties.name, r: rank,
          x: Math.round(c2[0] * 100) / 100, y: Math.round(c2[1] * 100) / 100 });
      }
    }

    /* A level can outrun the map. Dartmouth is about 150 km inland, so
       by k=384 the clip box is ~60 km across and contains no Natural
       Earth geometry at all — the deepest level of this zoom is simply
       past the end of what a coastline dataset knows. That is a fact
       about the subject, not a failure to fetch: the talk zooms out of
       geography and into a room. Marked, so the stage can render
       something else there rather than a blank plane. */
    const beyondMap = d.length < 200 && !solidLand;
    return { label: lv.label, k: lv.k, res: plan.res, digits: plan.digits, beyondMap, solidLand,
      cx: Math.round(cx * 1000) / 1000, cy: Math.round(cy * 1000) / 1000,
      d: beyondMap ? '' : d, borders, states, counties, named };
  });

  const geo = {};
  for (const n of NODES) {
    const [x, y] = at(n.lon, n.lat);
    geo[n.id] = [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000];
  }

  /* Tripwires, in the house style: every one of these has a failure
     mode that is silent rather than loud. */
  const off = Object.entries(geo).filter(([, [x, y]]) => !(x >= 0 && x <= W && y >= 0 && y <= HGT));
  if (off.length) {
    console.error(`vendor: ${off.length} nodes project outside the ${W}x${HGT} map: ${off.map(([id]) => id).join(', ')}`);
    process.exit(1);
  }
  if (layers.some((l) => /NaN|Infinity|undefined/.test(l.d))) {
    console.error('vendor: a map layer produced non-finite path data');
    process.exit(1);
  }
  /* Running out of map is only legitimate at the END of the zoom. An
     empty layer with a populated one below it means the clip box is
     wrong, which is otherwise invisible — the missing geometry is
     simply never drawn. */
  const firstBeyond = layers.findIndex((l) => l.beyondMap);
  if (firstBeyond !== -1 && layers.slice(firstBeyond).some((l) => !l.beyondMap)) {
    console.error('vendor: a map layer is empty but a deeper one is not — the clip box is wrong at: ' +
      layers[firstBeyond].label);
    process.exit(1);
  }
  if (layers.every((l) => l.beyondMap)) {
    console.error('vendor: every map layer came out empty');
    process.exit(1);
  }

  const payload = { frame: { w: W, h: HGT }, centre: Math.round(centre * 100) / 100,
    cut: Math.round(widest.cut * 100) / 100, distortion: Math.round(distortion * 1000) / 1000,
    layers, geo };
  await writeFile(
    new URL('map.js', out),
    '/* Generated by scripts/vendor.js from Natural Earth via world-atlas\n' +
      '   (public domain), projected with d3-geo. Do not edit.\n' +
      '   A side-effect global, NOT an ES module — same reason as\n' +
      '   ai-history.js: this sheet has to keep opening over file://. */\n' +
      'globalThis.WORLD_MAP = ' + JSON.stringify(payload) + ';\n'
  );
  const size = Bun.file(new URL('map.js', out)).size;
  if (size < 40_000) {
    console.error(`vendor: map.js is only ${size} bytes — that is not a real projection`);
    process.exit(1);
  }
  console.log(`vendor: Natural Earth → design/vendor/map.js (${Math.round(size / 1024)} KB, ` +
    `centred ${centre.toFixed(1)}° cut ${widest.cut.toFixed(1)}° over water (gap ${widest.gap.toFixed(0)}°), ` +
    `layers ${layers.map((l) => l.beyondMap ? l.label.split(',')[0] + ':beyond-map'
      : l.res + '@' + l.digits + 'dp:' +
        Math.round((l.d.length + l.borders.length + l.states.length + l.counties.length) / 1024) + 'KB/' +
        l.named.length + 'names' + (l.solidLand ? ':solid' : '')).join(' ')}, ` +
    `Mercator stretch at ${target.label}: ${distortion.toFixed(2)}x)`);
}

/* ── Fonts ─────────────────────────────────────────────────
   Latin subset only. The deck is English and the harness is
   internal; shipping latin-ext as well would roughly double the
   font payload for glyphs nothing here renders. */
const FONTS = [
  { pkg: '@fontsource-variable/inter', file: 'inter-latin-wght-normal.woff2' },
  { pkg: '@fontsource-variable/jetbrains-mono', file: 'jetbrains-mono-latin-wght-normal.woff2' },
  { pkg: '@fontsource-variable/doto', file: 'doto-latin-full-normal.woff2' },
];

for (const f of FONTS) {
  await cp(new URL(`node_modules/${f.pkg}/files/${f.file}`, root), new URL(`fonts/${f.file}`, out));
}

console.log(`vendor: ${FONTS.length} fonts → design/vendor/fonts/`);
