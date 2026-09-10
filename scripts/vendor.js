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
  const W = 1000, PAD = 46, AXIS = 366, TOP_MARGIN = 10;
  const xOf = (year) => PAD + ((year - Y0) / (Y1 - Y0)) * (W - PAD * 2);

  /* Lanes exist to stop labels colliding, so the gap that decides them
     is a LABEL WIDTH expressed in years, not a number picked to look
     right: ~86 units of monospace caption over an axis of 81 years in
     (W - 2*PAD) units. Greedy lowest-free-lane over nodes in year
     order — the standard interval assignment, and deterministic, which
     matters because the sheet's filmstrip compares frames across runs. */
  /* Derived from the widest label that will actually be drawn, not from
     a constant: `short` is capped by the dataset's own SHORT_MAX, and
     JetBrains Mono at the 9px the sheet uses advances ~5.4 units per
     character in this coordinate space. Measured off the rendered
     sheet, not taken from the font metrics, because the CSS size is
     what decides it. */
  const CHAR_U = 5.4, LABEL_PAD = 14;
  const widest = Math.max(...NODES.map((n) => n.short.length));
  const GAP_YEARS = (widest * CHAR_U + LABEL_PAD) / ((W - PAD * 2) / (Y1 - Y0));
  const laneLastYear = [];
  const byYear = [...NODES].sort((a, b) => a.year - b.year || a.id.localeCompare(b.id));
  const pos = {};
  for (const n of byYear) {
    let lane = laneLastYear.findIndex((last) => n.year - last >= GAP_YEARS);
    if (lane === -1) { lane = laneLastYear.length; laneLastYear.push(-Infinity); }
    laneLastYear[lane] = n.year;
    pos[n.id] = { id: n.id, year: n.year, short: n.short, label: n.label, place: n.place, level: n.level, lane,
      x: Math.round(xOf(n.year) * 100) / 100 };
  }
  const lanes = laneLastYear.length;
  const laneY = (lane) => Math.round((AXIS - (lane + 1) * (AXIS / (lanes + 1))) * 100) / 100;
  for (const id in pos) pos[id].y = laneY(pos[id].lane);

  /* Edges are drawn as arcs ABOVE the axis so the year ordering stays
     readable underneath them. Height grows with the square root of the
     span rather than linearly: a 40-year edge is only ~2.4x the arc of
     a 7-year one, which keeps the long movements from leaving the box
     while short ones stay visible. */
  const arcs = EDGES.map((e) => {
    const a = pos[e.from], b = pos[e.to];
    const dx = Math.abs(b.x - a.x);
    const lift = Math.min(150, 16 + Math.sqrt(dx) * 7.2);
    /* Clamped to the frame. A cubic lies inside the convex hull of its
       control points, so pinning the control ys inside the box is
       enough to guarantee the drawn curve is too — and the first
       version of this did not, which put four of the twenty-two arcs
       up to 89 units above the top edge. The node assertion below did
       not catch it because nodes were all inside; it was the arcs that
       left. Both are checked now. */
    const top = Math.max(TOP_MARGIN, Math.min(a.y, b.y) - lift);
    const R2 = (v) => Math.round(v * 100) / 100;
    return { ...e,
      x1: a.x, y1: a.y, x2: b.x, y2: b.y,
      d: `M${R2(a.x)} ${R2(a.y)}C${R2(a.x)} ${R2(top)} ${R2(b.x)} ${R2(top)} ${R2(b.x)} ${R2(b.y)}` };
  }).sort((p, q) => p.year - q.year);

  const bad = arcs.filter((a) => /NaN|Infinity|undefined/.test(a.d));
  if (bad.length) {
    console.error(`vendor: ${bad.length} lineage arcs produced non-finite path data`);
    process.exit(1);
  }
  const inFrame = (x, y) => x >= 0 && x <= W && y >= 0 && y <= AXIS;
  const outside = Object.values(pos).filter((n) => !inFrame(n.x, n.y));
  if (outside.length) {
    console.error(`vendor: ${outside.length} nodes project outside the ${W}x${AXIS} frame`);
    process.exit(1);
  }
  /* Every control point, not just the endpoints — see the note on the
     clamp above. */
  const escaped = arcs.filter((a) => [...a.d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)]
    .some((m) => !inFrame(+m[1], +m[2])));
  if (escaped.length) {
    console.error(`vendor: ${escaped.length} lineage arcs have control points outside the ${W}x${AXIS} frame`);
    process.exit(1);
  }

  await writeFile(
    new URL('ai-history.js', out),
    '/* Generated by scripts/vendor.js from scripts/data/ai-history.js.\n' +
      '   Sources are per-entry in that file; do not edit this copy.\n' +
      '   A side-effect global, NOT an ES module: the SVG tearsheet has to\n' +
      '   keep opening over file://, where import is blocked. */\n' +
      'globalThis.AI_HISTORY = ' + JSON.stringify({
        span: [Y0, Y1], frame: { w: W, h: AXIS, pad: PAD }, lanes,
        nodes: byYear.map((n) => pos[n.id]), arcs, levels: LEVELS, activity: ACTIVITY,
        geo: Object.fromEntries(NODES.map((n) => [n.id, [n.lon, n.lat]])),
      }, null, 1) + ';\n'
  );
  console.log(`vendor: ai-history → design/vendor/ai-history.js ` +
    `(${NODES.length} nodes ${Y0}–${Y1}, ${arcs.length} arcs, ${lanes} lanes, ` +
    `widest label ${widest} chars → ${GAP_YEARS.toFixed(1)}y lane gap)`);
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
  const { feature } = await import('topojson-client');
  const { geoMercator, geoPath } = await import('d3-geo');
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
  let widest = { gap: -1, cut: 0 };
  for (let i = 0; i < lons.length; i++) {
    const a = lons[i], b = lons[(i + 1) % lons.length];
    const gap = ((b - a) + 360) % 360;
    if (gap > widest.gap) widest = { gap, cut: ((a + gap / 2) + 540) % 360 - 180 };
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
  for (const r in RES) {
    const topo = await Bun.file(new URL(`node_modules/world-atlas/land-${r}.json`, root)).json();
    RES[r] = feature(topo, topo.objects.land);
  }

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
      p.clipExtent([[Math.max(0, cx - hw), Math.max(0, cy - hh)],
                    [Math.min(W, cx + hw), Math.min(HGT, cy + hh)]]);
    }
    /* Coordinate precision is set on the PATH, not the projection —
       geoPath.digits(). Three decimals for the deep layers: at the
       levels this zooms to, two quantises to about a fifth of a device
       pixel and the coastline visibly snaps to a grid. */
    const path = geoPath(p);
    if (typeof path.digits === 'function') path.digits(plan.digits);
    const d = path(RES[plan.res]) || '';
    /* A level can outrun the map. Dartmouth is about 150 km inland, so
       by k=384 the clip box is ~60 km across and contains no Natural
       Earth geometry at all — the deepest level of this zoom is simply
       past the end of what a coastline dataset knows. That is a fact
       about the subject, not a failure to fetch: the talk zooms out of
       geography and into a room. Marked, so the stage can render
       something else there rather than a blank plane. */
    const beyondMap = d.length < 200;
    return { label: lv.label, k: lv.k, res: plan.res, digits: plan.digits, beyondMap,
      cx: Math.round(cx * 1000) / 1000, cy: Math.round(cy * 1000) / 1000, d: beyondMap ? '' : d };
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
    `centred ${centre.toFixed(1)}° cut ${widest.cut.toFixed(1)}° (widest data gap ${widest.gap.toFixed(0)}°), ` +
    `layers ${layers.map((l) => l.beyondMap ? l.label.split(',')[0] + ':beyond-map'
      : l.res + '@' + l.digits + 'dp:' + Math.round(l.d.length / 1024) + 'KB').join(' ')}, ` +
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
