/* THE DECK'S LOCAL CONTROL API — dev server only, on purpose.

   Two things need a server that a static site does not have:

     · a phone on the same network driving the deck, and reading the
       notes, while the laptop is plugged into the projector
     · notes that survive more than one browser, and that can be read
       and edited outside the app — which localStorage cannot do

   Both are presenter conveniences, not audience features, so they are
   wired into the Vite dev server as middleware rather than turned into
   app routes. That keeps `adapter-static` with `strict: true` exactly
   as it is: the built site has no server, the remote page degrades to
   an honest "not available", and nothing about deployment changes.

   State is in memory — it is a pointer at the current slide, and it
   is meaningless once the talk is over. Notes are real files, one
   Markdown file per slide in `deck-notes/`, because they are written
   over days, by hand and with Claude, and want to be diffable and
   editable outside the app. They are read fresh on every request, so
   an edit made in the file shows up on the next load.

   Editing is LOCAL ONLY by construction: this API exists only under
   `vite dev`. The built site bundles the same files read-only and has
   nowhere to write to. */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { networkInterfaces } from 'node:os';

const NOTES_DIR = 'deck-notes';
/* A slide id becomes a filename, so it is held to a shape that cannot
   climb out of the directory. */
const NOTE_ID = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

/** Every slide's notes, as Markdown, straight from disk.
 *  @param {string} root @returns {Record<string, string>} */
function loadNotes(root) {
  const dir = join(root, NOTES_DIR);
  if (!existsSync(dir)) return {};
  /** @type {Record<string, string>} */
  const out = {};
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.md')) continue;
    const id = f.slice(0, -3);
    if (NOTE_ID.test(id)) out[id] = readFileSync(join(dir, f), 'utf8');
  }
  return out;
}

/** Write one slide's notes. Empty notes delete the file rather than
 *  leaving an empty one behind. Returns the path written, or null.
 *  @param {string} root @param {string} id @param {string} markdown */
function saveNote(root, id, markdown) {
  const dir = join(root, NOTES_DIR);
  const file = join(dir, `${id}.md`);
  const text = markdown.trim();
  if (!text) {
    if (existsSync(file)) unlinkSync(file);
    return null;
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, text + '\n');
  return `${NOTES_DIR}/${id}.md`;
}

/** Every address the phone could actually reach this machine on.
 *  @param {number} port */
function lanUrls(port) {
  /** @type {string[]} */
  const out = [];
  const ifs = networkInterfaces();
  for (const name of Object.keys(ifs)) {
    for (const ni of ifs[name] ?? []) {
      if (ni.family === 'IPv4' && !ni.internal) out.push(`http://${ni.address}:${port}`);
    }
  }
  return out;
}

/** @param {import('node:http').IncomingMessage} req */
function body(req) {
  return new Promise((resolve) => {
    let s = '';
    req.on('data', (c) => { s += c; });
    req.on('end', () => {
      try { resolve(JSON.parse(s || '{}')); } catch { resolve({}); }
    });
  });
}

/** @returns {import('vite').Plugin} */
export function deckApi() {
  /** @type {{ i: number, ex: number, rev: number, mode: string, tap: number }} */
  const state = { i: 0, ex: 0, rev: 0, mode: 'grid', tap: 0 };
  let root = process.cwd();

  return {
    name: 'wam-deck-api',
    apply: 'serve',                       // dev only; never in the build
    configResolved(c) { root = c.root; },
    configureServer(server) {
      const port = server.config.server.port ?? 5173;

      server.middlewares.use('/deck-api', async (req, res) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        /** @param {number} code @param {any} data */
        const send = (code, data) => {
          res.statusCode = code;
          res.setHeader('content-type', 'application/json');
          res.setHeader('cache-control', 'no-store');
          res.end(JSON.stringify(data));
        };

        try {
          if (url.pathname === '/state' && req.method === 'GET') return send(200, state);

          if (url.pathname === '/state' && req.method === 'POST') {
            const b = /** @type {any} */ (await body(req));
            if (Number.isInteger(b.i)) state.i = b.i;
            if (Number.isInteger(b.ex)) state.ex = b.ex;
            if (typeof b.mode === 'string') state.mode = b.mode;
            if (b.tap === true) state.tap++;        // the phone taps a slide's own sequence forward
            state.rev++;
            return send(200, state);
          }

          if (url.pathname === '/notes' && req.method === 'GET') return send(200, loadNotes(root));

          if (url.pathname === '/notes' && req.method === 'PUT') {
            const b = /** @type {any} */ (await body(req));
            if (typeof b.id !== 'string' || !NOTE_ID.test(b.id) || typeof b.markdown !== 'string') {
              return send(400, { error: 'expected { id, markdown } with a slide id' });
            }
            const file = saveNote(root, b.id, b.markdown);
            return send(200, { ok: true, id: b.id, file });
          }

          if (url.pathname === '/info' && req.method === 'GET') {
            return send(200, { urls: lanUrls(port), notesDir: NOTES_DIR, notesEditable: true });
          }

          return send(404, { error: 'no such deck-api route' });
        } catch (err) {
          console.error('[deck-api]', err);
          return send(500, { error: String(err) });
        }
      });

      const urls = lanUrls(port);
      if (urls.length) {
        console.log(`[deck-api] remote control: ${urls[0]}/presentation/remote`);
      }
    },
  };
}
