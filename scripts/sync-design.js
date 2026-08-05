/* Copies design/ into static/sheets/ so SvelteKit serves the design
   harness verbatim at /sheets/… — deliberately NOT /design/,
   which is an app route: the harness has its own index.html, and
   letting both live under /design meant a static host could serve
   the harness hub for /design/ instead of the app page. Different
   hosts resolve that differently, which is exactly the kind of
   difference you find out about after deploying.

   Why copy rather than move design/ into static/ permanently: the
   harness is a set of standalone HTML tearsheets that must keep
   working when opened directly, without the app running at all.
   That property has been load-bearing for the whole build — every
   verification pass so far has been "open the file, look at it" —
   and folding it into the app's source tree would quietly end it.
   So design/ stays the source of truth, static/sheets/ is generated
   and gitignored.

   Copy rather than symlink because build hosts (Netlify, Render)
   don't reliably follow symlinks out of the publish directory. */
import { cp, rm, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const SRC = new URL('../design/', import.meta.url);
const DEST = new URL('../static/sheets/', import.meta.url);

if (!existsSync(SRC)) {
  console.error('sync-design: design/ not found — nothing to copy');
  process.exit(1);
}

await rm(DEST, { recursive: true, force: true });
await mkdir(DEST, { recursive: true });
await cp(SRC, DEST, { recursive: true });

console.log('sync-design: design/ → static/sheets/');
