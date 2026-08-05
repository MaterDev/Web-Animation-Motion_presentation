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

const bundles = [{ entry: 'three', outfile: 'three.module.js' }];

for (const { entry, outfile } of bundles) {
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
    entrypoints: [Bun.resolveSync(entry, process.cwd())],
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
  console.log(`vendor: ${entry} → design/vendor/${outfile} (${Math.round(code.length / 1024)} KB)`);
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
