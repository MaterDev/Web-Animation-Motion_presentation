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
   is meaningless once the talk is over. Notes are a real file, because
   they are written over days, by hand and with Claude, and want to be
   diffable. */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { networkInterfaces } from 'node:os';

const NOTES_FILE = 'deck-notes.json';

/** @param {string} root */
function loadNotes(root) {
  const f = join(root, NOTES_FILE);
  if (!existsSync(f)) return {};
  try {
    return JSON.parse(readFileSync(f, 'utf8'));
  } catch (err) {
    /* Do not silently reset someone's speaker notes because a file got
       mangled. Say so and hand back nothing for this session. */
    console.error(`[deck-api] ${NOTES_FILE} is not valid JSON — notes not loaded.`, err);
    return {};
  }
}

/** @param {string} root @param {Record<string, string>} notes */
function saveNotes(root, notes) {
  const f = join(root, NOTES_FILE);
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, JSON.stringify(notes, null, 2) + '\n');
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
  /** @type {{ i: number, ex: number, rev: number, mode: string }} */
  const state = { i: 0, ex: 0, rev: 0, mode: 'grid' };
  /** @type {Record<string, string>} */
  let notes = {};
  let root = process.cwd();

  return {
    name: 'wam-deck-api',
    apply: 'serve',                       // dev only; never in the build
    configResolved(c) { root = c.root; notes = loadNotes(root); },
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
            state.rev++;
            return send(200, state);
          }

          if (url.pathname === '/notes' && req.method === 'GET') return send(200, notes);

          if (url.pathname === '/notes' && req.method === 'PUT') {
            const b = /** @type {any} */ (await body(req));
            if (typeof b.id === 'string' && typeof b.html === 'string') {
              notes[b.id] = b.html;
              saveNotes(root, notes);
              return send(200, { ok: true, id: b.id });
            }
            return send(400, { error: 'expected { id, html }' });
          }

          if (url.pathname === '/info' && req.method === 'GET') {
            return send(200, { urls: lanUrls(port), notesFile: NOTES_FILE });
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
