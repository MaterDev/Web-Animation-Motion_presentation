/* THE DEMO COLLECTION, AS DATA.
   Each demo is a folder: src/lib/demos/<technique>/<slug>/ with
     meta.js    — id, technique, title, order, where it came from (eager, tiny)
     index.js   — export function mount(host) → dispose()   (lazy)
     NOTES.md   — what it is, its source on the tear sheet, what changed
                  in extraction, issues carried over as-is
   plus its own CSS, markup, scripts and assets. A demo imports nothing
   from design/techniques/ and nothing from another demo: it is a
   standalone copy, derived from the sheet on purpose, owned by the deck,
   and expected to diverge from the sheet as it is edited for slides. */

/** @typedef {{ id: string, technique: string, title: string, order: number, source: { sheet: string, section: string }, summary: string }} DemoMeta */

const metas = import.meta.glob('./*/*/meta.js', { eager: true, import: 'default' });
const mounts = import.meta.glob('./*/*/index.js');
const notes = import.meta.glob('./*/*/NOTES.md', { eager: true, query: '?raw', import: 'default' });

export const TECHNIQUE_ORDER = ['css', 'svg', 'gif', 'video', 'canvas', 'webgl', 'webgpu', 'composite'];

/** @type {(DemoMeta & { dir: string, notes: string })[]} */
export const DEMOS = Object.entries(metas)
  .map(([path, m]) => {
    const dir = path.replace(/\/meta\.js$/, '');
    return { .../** @type {DemoMeta} */ (m), dir, notes: String(notes[dir + '/NOTES.md'] ?? '') };
  })
  .sort((a, b) => TECHNIQUE_ORDER.indexOf(a.technique) - TECHNIQUE_ORDER.indexOf(b.technique) || a.order - b.order);

/** @param {string} id @returns {Promise<(host: HTMLElement) => (() => void)>} */
export async function loadDemo(id) {
  const d = DEMOS.find((x) => x.id === id);
  if (!d) throw new Error('no demo: ' + id);
  const mod = /** @type {{ mount: (host: HTMLElement) => (() => void) }} */ (await mounts[d.dir + '/index.js']());
  return mod.mount;
}
