/* CLIENT FOR THE LOCAL CONTROL API.

   One module so the deck and the phone cannot disagree about the
   contract. Every call fails soft: in the built static site there is
   no dev server behind /deck-api, and the correct behaviour there is
   for the deck to keep working on its own rather than to break. The
   remote page is the one place that treats "unavailable" as something
   worth saying out loud, because that page has no other purpose. */

const BASE = '/deck-api';

/** @param {string} path @param {RequestInit} [init] @returns {Promise<any|null>} */
async function req(path, init) {
  try {
    const r = await fetch(BASE + path, { cache: 'no-store', ...init });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;                    // no dev server — this is expected
  }
}

/** Where the deck currently is. `null` when there is no control API. */
export const getState = () => req('/state');

/** @param {{ i?: number, ex?: number, mode?: string }} patch */
export const setState = (patch) =>
  req('/state', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  });

/** Every slide's notes as Markdown, read from `deck-notes/` on disk.
 *  `null` when there is no local API — the built site — which is also
 *  what makes notes read-only there.
 *  @returns {Promise<Record<string, string>|null>} */
export const getNotes = () => req('/notes');

/** Save one slide's notes to `deck-notes/<id>.md`. Local dev server only.
 *  `keepalive` lets a save started as the page closes finish anyway.
 *  @param {string} id @param {string} markdown @param {boolean} [keepalive]
 *  @returns {Promise<{ ok: true, id: string, file: string|null }>} */
export async function putNote(id, markdown, keepalive = false) {
  const ok = await req('/notes', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id, markdown }),
    keepalive,
  });
  if (!ok) throw new Error('the local notes API is not answering');
  return ok;
}

/** LAN addresses this machine is reachable on, for the phone. */
export const getInfo = () => req('/info');

/**
 * Polling, not a socket. The thing being synced is one small integer
 * that changes when a human presses a key, so a request every 600ms is
 * both plenty and trivially debuggable — and it reconnects by itself
 * when the laptop's wifi drops mid-talk, which a socket would not.
 * @param {(s: any) => void} onChange
 * @param {number} [ms]
 */
export function watchState(onChange, ms = 600) {
  let last = -1, stop = false;
  (async function loop() {
    while (!stop) {
      const s = await getState();
      if (s && s.rev !== last) { last = s.rev; onChange(s); }
      await new Promise((r) => setTimeout(r, ms));
    }
  })();
  return () => { stop = true; };
}
