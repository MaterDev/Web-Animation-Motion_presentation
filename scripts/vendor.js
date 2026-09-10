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
  /* Entry given as an explicit path, not the package name: flubber's
     `main` is a UMD build, so resolving by name produced a bundle
     whose only export was `default` — usable, but it makes every
     consumer write `F.interpolate` instead of importing what it
     needs. index.js is the ESM entry and keeps the named exports.
     Same class of trap as the animejs barrel noted above. */
  { entry: 'node_modules/flubber/index.js', outfile: 'flubber.js',
    expect: ['interpolate', 'separate', 'combine'] },
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

/* ── Food illustrations ────────────────────────────────────
   Hand-authoring representational art as bezier coordinates was
   tried across three passes and thrown out: the geometry came out
   topologically correct and aesthetically uncanny every time. These
   are drawn by people who can draw.

   ⚠ LICENCE: the Twemoji npm package is MIT for its CODE, but the
   graphics are CC-BY 4.0. Attribution is required wherever they
   appear — SL-10 carries a credit line, and it must stay there.

   Only the handful the sheet uses are extracted, with their fills,
   so the dependency stays legible and the payload stays small. Each
   emoji is drawn on a 36-unit grid, which is why every consumer
   places them with a 36-box transform rather than the 100-box the
   old hand-drawn shapes used. */
const FOODS = {
  pear: '1f350', apple: '1f34e', lettuce: '1f96c', carrot: '1f955',
  fish: '1f41f', drop: '1f4a7', salad: '1f957', broccoli: '1f966',
  avocado: '1f951', lemon: '1f34b', grapes: '1f347', bread: '1f35e',
  leaf: '1f343', herb: '1f33f', egg: '1f95a',
};

/* ── Silhouettes ─────────────────────────────────────────────
   A morph library reasons about ONE closed ring. A twemoji drawing is
   three to six layers with no correspondence between drawings (apple 3,
   fish 6, drop 1), and every attempt to pair layers across drawings
   produced a detail that had to appear from nowhere. The outline of
   the whole drawing, on the other hand, always has a counterpart in
   the outline of the next drawing — so that is what gets morphed, and
   it is computed here rather than in the browser: sample every layer
   into a polygon, union them, keep the outer ring.

   Each ring is dilated by DILATE before the union, because twemoji
   leaves hairline gaps between parts that read as touching. The
   silhouette is only ever used as a clip, so a little generosity
   costs nothing and guarantees no visible island is left outside. */
const { svgPathProperties, parse } = await import('svg-path-properties');
const { default: clip } = await import('polygon-clipping');
const DILATE = 0.5, STEP = 0.2, TOL = 0.06;
const R3 = (v) => Math.round(v * 1000) / 1000;   // snap to a 0.001 grid: the exact-arithmetic sweep chokes on 15-decimal near-coincidences

/* Split a path into its subpaths, each rewritten with an ABSOLUTE
   opening move. Splitting the raw string on /[Mm]/ looked equivalent
   and was not: twemoji writes `zm-7.485 8.072`, a relative move after
   a close, and a lone `m` at the head of a fragment gets read as
   absolute — which put the carrot's stripes fourteen units off the
   canvas and left them as separate islands. Walking the parsed
   commands keeps the cursor, so the relative move resolves correctly. */
const END = {
  M: (c, a) => [a[1], a[2]],            m: (c, a) => [c[0] + a[1], c[1] + a[2]],
  L: (c, a) => [a[1], a[2]],            l: (c, a) => [c[0] + a[1], c[1] + a[2]],
  T: (c, a) => [a[1], a[2]],            t: (c, a) => [c[0] + a[1], c[1] + a[2]],
  H: (c, a) => [a[1], c[1]],            h: (c, a) => [c[0] + a[1], c[1]],
  V: (c, a) => [c[0], a[1]],            v: (c, a) => [c[0], c[1] + a[1]],
  C: (c, a) => [a[5], a[6]],            c: (c, a) => [c[0] + a[5], c[1] + a[6]],
  S: (c, a) => [a[3], a[4]],            s: (c, a) => [c[0] + a[3], c[1] + a[4]],
  Q: (c, a) => [a[3], a[4]],            q: (c, a) => [c[0] + a[3], c[1] + a[4]],
  A: (c, a) => [a[6], a[7]],            a: (c, a) => [c[0] + a[6], c[1] + a[7]],
};
function subpaths(d) {
  const cmds = parse(d);
  const out = [];
  let cur = [0, 0], start = [0, 0], buf = null;
  for (const a of cmds) {
    const op = a[0];
    if (op === 'M' || op === 'm') {
      cur = END[op](cur, a); start = [cur[0], cur[1]];
      buf = [`M${cur[0]} ${cur[1]}`]; out.push(buf);
      continue;
    }
    if (!buf) continue;                       // a path that opens with something other than a move
    buf.push(a.join(' '));
    cur = op === 'Z' || op === 'z' ? [start[0], start[1]] : END[op](cur, a);
  }
  return out.map((parts) => parts.join(''));
}
function ringsOf(d) {
  return subpaths(d).map((sub) => {
    const p = new svgPathProperties(sub);
    const L = p.getTotalLength();
    if (!(L > 0)) return [];
    const n = Math.max(12, Math.ceil(L / STEP));
    return Array.from({ length: n }, (_, i) => { const q = p.getPointAtLength((L * i) / n); return [R3(q.x), R3(q.y)]; });
  }).filter((r) => r.length >= 3);
}
const signedArea = (r) => r.reduce((s, [x, y], i) => { const [x2, y2] = r[(i + 1) % r.length]; return s + x * y2 - x2 * y; }, 0) / 2;
/* push every vertex out along its normal — good enough on a densely
   sampled ring, and one polygon per ring keeps the union tractable */
function dilated(ring) {
  const sgn = signedArea(ring) > 0 ? 1 : -1, n = ring.length;
  const out = ring.map(([x, y], i) => {
    const [px, py] = ring[(i - 1 + n) % n], [nx, ny] = ring[(i + 1) % n];
    let tx = nx - px, ty = ny - py; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    return [R3(x + ty * sgn * DILATE), R3(y - tx * sgn * DILATE)];
  });
  return clip.union([ring], [out]);   // union with the original, so a wrong-way normal can never shrink it
}
const ringArea = (r) => Math.abs(signedArea(r));
/* Ramer–Douglas–Peucker on a closed ring: keeps corners, drops the
   collinear crowd the union produces along every straight run. */
function simplify(ring, tol) {
  const sq = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
  const segDist = (p, a, b) => {
    const l2 = sq(a, b); if (!l2) return sq(p, a);
    let t = ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / l2; t = Math.max(0, Math.min(1, t));
    return sq(p, [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
  };
  const rdp = (pts) => {
    if (pts.length < 3) return pts;
    let idx = 0, max = 0;
    for (let i = 1; i < pts.length - 1; i++) { const d = segDist(pts[i], pts[0], pts[pts.length - 1]); if (d > max) { max = d; idx = i; } }
    if (max <= tol * tol) return [pts[0], pts[pts.length - 1]];
    return [...rdp(pts.slice(0, idx + 1)).slice(0, -1), ...rdp(pts.slice(idx))];
  };
  /* open the ring at its two farthest-apart points so RDP sees two arcs */
  let far = 0; for (let i = 1; i < ring.length; i++) if (sq(ring[0], ring[i]) > sq(ring[0], ring[far])) far = i;
  const a = rdp(ring.slice(0, far + 1)), b = rdp([...ring.slice(far), ring[0]]);
  return [...a.slice(0, -1), ...b.slice(0, -1)];
}
function silhouette(name, layers) {
  /* dilate each ring on its own, then union the dilated layers — one
     big union of every copy at once is where the sweep gets confused */
  const u = clip.union(...layers.flatMap((l) => ringsOf(l.d).map(dilated)));
  const outers = u.map((poly) => poly[0]).sort((x, y) => ringArea(y) - ringArea(x));
  if (outers.length !== 1) console.warn(`vendor: ${name} silhouette is ${outers.length} islands (areas ${outers.map((r) => ringArea(r).toFixed(0)).join(', ')}); keeping the largest`);
  const ring = simplify(outers[0], TOL);
  return 'M' + ring.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join('L') + 'Z';
}

/* ── STAR-DOMAIN PARAMETERISATION ──────────────────────────
   The silhouette above is what gets morphed, but HOW two silhouettes
   are put into correspondence is the thing that decides whether a
   morph is clean. This is the second half of that answer, and it is
   precomputed here so the browser only ever lerps numbers.

   Flubber (and every point-matching morph library) walks both
   outlines as polygon rings, pads the shorter until the counts
   match, then rotates one ring to the cheapest alignment. It is a
   good general answer and it was what this sheet used first. It also
   has no way to guarantee the in-between is a simple polygon —
   measured over all 105 pairs of these fifteen foods at nine
   interior frames each, it produced 44 self-intersecting frames and
   220 frames that pinched more than 3% below a linear area ramp.

   A star-domain parameterisation cannot do either, by construction.
   Fire N rays from one interior origin, record where each leaves the
   shape, and a shape becomes a function r(theta). Morphing is then
   just interpolating two radius arrays:

     · correspondence is total and automatic — ray k maps to ray k,
       so no point is ever unpaired, and detail does not pop in or
       out when a 142-point broccoli meets an 87-point fish. It
       flattens, because its radii shrink.
     · the result is always a simple polygon: N radii around a single
       interior origin cannot cross each other. Self-intersection is
       not tuned away, it is unrepresentable.
     · radii are interpolated as r², not r. Area goes with r², so
       lerping r makes a shape dip under a linear area ramp on the
       way across — the "pinch" the numbers above are counting.
       sqrt(lerp(ra², rb²)) removes it exactly.

   The cost is real and worth stating: a ray records only its FARTHEST
   exit, so a concavity hidden behind nearer geometry is filled in.
   That is why the origin is searched for rather than assumed. The
   centroid is a bad origin for anything with a stem — on the apple it
   left 2.23 units of error on a 36-unit box, visibly clipping the
   stem. Searching interior points for the one that minimises
   Hausdorff distance to the true outline drops that to 0.12. Worst
   across all fifteen foods is 0.66 (the fish's tail notch), under 2%
   of the box, and the runtime snaps to the real path at both ends
   anyway so the endpoints are exact and only the middle is
   approximate — where there is nothing to compare it against. */
const RAYS = 256;

function ringPoints(d) {
  const pts = [];
  const re = /([ML])\s*(-?[\d.]+)[ ,]+(-?[\d.]+)/g;
  let m;
  while ((m = re.exec(d))) pts.push([+m[2], +m[3]]);
  return pts;
}
function polyCentroid(p) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length];
    const c = x1 * y2 - x2 * y1;
    a += c; cx += (x1 + x2) * c; cy += (y1 + y2) * c;
  }
  a /= 2;
  return [cx / (6 * a), cy / (6 * a)];
}
function pointInPoly(p, x, y) {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i], [xj, yj] = p[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
/* farthest exit along each ray — farthest, not nearest, so the ring
   stays outside every concavity instead of diving into one */
function castRays(p, c, n) {
  const out = [];
  for (let k = 0; k < n; k++) {
    const th = (2 * Math.PI * k) / n, dx = Math.cos(th), dy = Math.sin(th);
    let rmax = 0;
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      const ex = b[0] - a[0], ey = b[1] - a[1];
      const den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-9) continue;
      const wx = a[0] - c[0], wy = a[1] - c[1];
      const r = (wx * ey - wy * ex) / den;
      const u = (wx * dy - wy * dx) / den;
      if (u >= 0 && u <= 1 && r > rmax) rmax = r;
    }
    out.push(rmax);
  }
  return out;
}
function ringOf(c, R) {
  return R.map((r, k) => {
    const th = (2 * Math.PI * k) / R.length;
    return [c[0] + Math.cos(th) * r, c[1] + Math.sin(th) * r];
  });
}
function distToSeg(p, a, b) {
  const ex = b[0] - a[0], ey = b[1] - a[1];
  const L2 = ex * ex + ey * ey || 1;
  const u = Math.max(0, Math.min(1, ((p[0] - a[0]) * ex + (p[1] - a[1]) * ey) / L2));
  return Math.hypot(p[0] - (a[0] + u * ex), p[1] - (a[1] + u * ey));
}
function hausdorff(P, Q) {
  const one = (A, B) => {
    let h = 0;
    for (const a of A) {
      let m = Infinity;
      for (let i = 0; i < B.length; i++) m = Math.min(m, distToSeg(a, B[i], B[(i + 1) % B.length]));
      h = Math.max(h, m);
    }
    return h;
  };
  return Math.max(one(P, Q), one(Q, P));
}
/* Coarse grid then a local refine. Brute force over a fine grid was
   the first version and cost ~8s for fifteen foods; this is the same
   answer in a fraction of it. */
function starOf(name, d) {
  const P = ringPoints(d);
  const xs = P.map((q) => q[0]), ys = P.map((q) => q[1]);
  const bx0 = Math.min(...xs), bx1 = Math.max(...xs);
  const by0 = Math.min(...ys), by1 = Math.max(...ys);
  const score = (c) => hausdorff(ringOf(c, castRays(P, c, 96)), P);

  let best = polyCentroid(P), bestErr = score(best);
  for (let step of [1.2, 0.4]) {
    const x0 = step === 1.2 ? bx0 + step : best[0] - 1.2;
    const x1 = step === 1.2 ? bx1 : best[0] + 1.2;
    const y0 = step === 1.2 ? by0 + step : best[1] - 1.2;
    const y1 = step === 1.2 ? by1 : best[1] + 1.2;
    for (let y = y0; y <= y1; y += step) {
      for (let x = x0; x <= x1; x += step) {
        if (!pointInPoly(P, x, y)) continue;
        const e = score([x, y]);
        if (e < bestErr) { bestErr = e; best = [x, y]; }
      }
    }
  }
  const R = castRays(P, best, RAYS);
  const minR = Math.min(...R);
  /* a zero radius would be a cusp pinned to the origin — a pinch that
     no amount of r² correction can fix. None of the current set comes
     near it (smallest is 1.28), so this is a tripwire, not a fallback. */
  if (!(minR > 0.2)) {
    console.error(`vendor: ${name} has a degenerate ray radius (${minR}); its origin is not interior enough to parameterise`);
    process.exit(1);
  }
  const err = hausdorff(ringOf(best, R), P);
  return {
    c: best.map((v) => Math.round(v * 100) / 100),
    R: R.map((v) => Math.round(v * 1000) / 1000),
    err: Math.round(err * 100) / 100,
  };
}

const food = {};
for (const [name, code] of Object.entries(FOODS)) {
  const src = await Bun.file(new URL(`node_modules/@twemoji/svg/${code}.svg`, root)).text();
  /* Parse each <path> and read its attributes in whatever order they
     appear. A fill-then-d regex silently dropped two of the fish's six
     layers — twemoji emits bare <path d="…"/> for shapes that inherit
     the default black, and those are real parts of the drawing. */
  const layers = [...src.matchAll(/<path\b([^>]*)\/?>/g)].map((m) => {
    const attrs = m[1];
    const d = /\bd="([^"]+)"/.exec(attrs);
    const fill = /\bfill="([^"]+)"/.exec(attrs);
    return d ? { fill: fill ? fill[1] : '#000000', d: d[1] } : null;
  }).filter(Boolean);
  if (!layers.length) {
    console.error(`vendor: ${name} (${code}) yielded no paths — twemoji markup may have changed shape`);
    process.exit(1);
  }
  const vb = src.match(/viewBox="([^"]+)"/);
  const sil = silhouette(name, layers);
  food[name] = { view: vb ? vb[1] : '0 0 36 36', layers, sil, star: starOf(name, sil) };
}
await writeFile(
  new URL('food.js', out),
  '/* Generated by scripts/vendor.js from @twemoji/svg (graphics CC-BY 4.0).\n' +
    '   Attribution is required wherever these appear.\n' +
    '   `sil` is the outline of the whole drawing as one closed polygon —\n' +
    '   the union of every layer — which is the only thing about a\n' +
    '   drawing that always has a counterpart in another drawing.\n' +
    '   `star` is that outline as a function of angle: {c} is an interior\n' +
    '   origin chosen to reproduce the outline most faithfully, and R is\n' +
    `   \${RAYS} exit radii sampled evenly around it. Two foods morph by\n` +
    '   interpolating R against R — see the header of scripts/vendor.js\n' +
    '   for why that beats point-matching, with the numbers. `err` is the\n' +
    '   Hausdorff distance from the reconstruction back to `sil`, in the\n' +
    '   same 36-unit box, so the approximation is stated not hidden. */\n' +
    `export const FOOD = ${JSON.stringify(food, null, 2)};\n` +
    '/* The largest layer by path-data length is the body. */\n' +
    'export const BODY = Object.fromEntries(\n' +
    '  Object.entries(FOOD).map(([k, v]) => [k, v.layers.reduce((a, b) => (b.d.length > a.d.length ? b : a)).d])\n' +
    ');\n'
);
console.log(`vendor: @twemoji/svg → design/vendor/food.js (${Object.keys(food).length} foods, CC-BY 4.0)`);

/* ── Wordmark glyphs ───────────────────────────────────────
   Hand-drawn letterforms were tried and were the worst thing on the
   sheet. These are Inter's own outlines — the same font the deck
   already ships — pulled at BUILD time so the page carries no font
   parser and no decompressor at runtime.

   woff2 is compressed, and opentype.js will not read it directly; it
   is decompressed here with wawoff2 and thrown away. Only the nine
   letters the wordmark uses survive into the artifact.

   Each glyph is emitted twice: `full` keeps its counters (the hole in
   an O) and is what gets drawn at rest, while `outer` is the largest
   sub-path alone, because flubber morphs ONE closed ring. A counter
   vanishing mid-morph is invisible — the letter is dissolving into a
   pear at that point anyway. */
{
  const { decompress } = await import('wawoff2');
  const opentype = (await import('opentype.js')).default;
  /* Read from node_modules, not design/vendor: this script wipes the
     vendor directory on entry and the fonts are copied further down,
     so the file does not exist yet at this point. */
  const woff2 = await Bun.file(new URL('node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2', root)).arrayBuffer();
  const ttf = Buffer.from(await decompress(Buffer.from(woff2)));
  const font = opentype.parse(ttf.buffer.slice(ttf.byteOffset, ttf.byteOffset + ttf.byteLength));

  const LETTERS = 'GOODHEALTY'.split('').filter((c, i, a) => a.indexOf(c) === i);
  const BOX = 36, PAD = 3;
  const glyphs = {};
  for (const ch of LETTERS) {
    /* Emit the path data by hand rather than mutating the Path and
       calling toPathData(). Two separate traps were hit going the
       other way: asking opentype for a glyph at a computed fractional
       size produced NaN points, and mutating path.commands in place
       still produced NaN in toPathData() even with every command
       verified finite immediately beforehand. Reading the commands and
       formatting the string here is fully determined by code in this
       file, and mutating nothing means a repeated letter (the second O
       in GOOD, the second H in HEALTHY) cannot be scaled twice. */
    const path = font.getPath(ch, 0, 0, 100);
    const bb = path.getBoundingBox();
    const w = bb.x2 - bb.x1, h = bb.y2 - bb.y1;
    const k = (BOX - PAD * 2) / Math.max(w, h);
    const ox = -bb.x1 * k + (BOX - w * k) / 2;
    const oy = -bb.y1 * k + (BOX - h * k) / 2;
    const X = (v) => (Math.round((v * k + ox) * 100) / 100).toString();
    const Y = (v) => (Math.round((v * k + oy) * 100) / 100).toString();
    const d = path.commands.map((c) => {
      switch (c.type) {
        case 'M': return `M${X(c.x)} ${Y(c.y)}`;
        case 'L': return `L${X(c.x)} ${Y(c.y)}`;
        case 'C': return `C${X(c.x1)} ${Y(c.y1)} ${X(c.x2)} ${Y(c.y2)} ${X(c.x)} ${Y(c.y)}`;
        case 'Q': return `Q${X(c.x1)} ${Y(c.y1)} ${X(c.x)} ${Y(c.y)}`;
        case 'Z': return 'Z';
        default: return '';
      }
    }).join('');
    if (/NaN|Infinity|undefined/.test(d)) {
      console.error(`vendor: glyph ${ch} produced non-finite coordinates`);
      process.exit(1);
    }
    const subs = d.split(/(?=M)/).filter(Boolean);
    if (!subs.length) { console.error(`vendor: glyph ${ch} produced no path`); process.exit(1); }
    glyphs[ch] = { full: d, outer: subs.reduce((a, b) => (b.length > a.length ? b : a)) };
  }
  await writeFile(
    new URL('wordmark.js', out),
    '/* Generated by scripts/vendor.js from Inter (OFL). Nine glyphs,\n' +
      '   normalised into the same 36-unit box as the food art.\n' +
      '   `full` keeps counters for display; `outer` is the single ring\n' +
      '   flubber can morph. */\n' +
      `export const GLYPH = ${JSON.stringify(glyphs, null, 2)};\n`
  );
  const withCounters = LETTERS.filter((c) => glyphs[c].full !== glyphs[c].outer);
  console.log(`vendor: Inter → design/vendor/wordmark.js (${LETTERS.length} glyphs` +
    (withCounters.length ? `, counters: ${withCounters.join('')}` : '') + ')');
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
