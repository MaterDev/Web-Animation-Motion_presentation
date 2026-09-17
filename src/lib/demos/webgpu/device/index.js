// @ts-nocheck -- derived from design/techniques/webgpu/sheet.js; untyped sheet code
/* SL-14 §2 · one device, four apps, as a demo the deck owns.
   sheet.js, cut down to the device card and four of its eight apps: acquire a device, run the card from one
   WAM clock, keep the instrument plate current — and, unlike the sheet, give
   all of it back on dispose so a slide can mount it again. */
import css from './demo.css?raw';
import html from './demo.html?raw';
import { stage } from '../../_kit/stage.js';
import { createWAM } from '../../_kit/wam.js';
import { disposer } from '../../_kit/disposer.js';
import { setScope, $, getDevice, bytes, run, releaseDevice } from './common.js';
import { deviceCard } from './device.js';
import { flockApp } from './flock.js';
import { tesseraApp } from './procedural.js';
import { stormApp } from './storm.js';

/* slide: the device itself is the Duo now (duo.js is its hardware), so the apps are Roost, Tessera and Supercell */
const APPS = [
  { id: 'flock', name: 'Roost', make: flockApp }, { id: 'tessera', name: 'Tessera', make: tesseraApp }, { id: 'storm', name: 'Supercell', make: stormApp },
];
const CAPTIONS = {
  closed: ['iPhone Duo', 'the hardware is sphere-traced too — press Open'],
  home: ['Home Screen', 'widgets, glass and type, all drawn by WebGPU'],
  flock: ['Roost', 'a flock game that plays itself · 131 072 starlings'],
  tessera: ['Tessera', 'a site grown as a world, ray-marched every frame'],
  storm: ['Supercell', 'a storm that runs itself · debris in compute'],
};

const fmtB = (n) => n === 0 ? '0 B' : n < 1024 ? n + ' B' : (n / 1024).toFixed(1) + ' KB';

/** @param {HTMLElement} host */
export function mount(host) {
  const { root, body } = stage(host, { css, html });
  const d = disposer();
  const WAM = createWAM({ root });
  let gone = false, dev = null;
  setScope(root);
  releaseDevice(); /* a fresh card registry for this mount */
  const device = deviceCard(APPS, CAPTIONS);
  const cards = [device];
  (async () => {
    try { dev = await getDevice(); } catch (e) { if (gone) return; root.querySelectorAll('.gp-status').forEach((el) => { el.hidden = false; el.textContent = e.message; }); return; }
    if (gone) { releaseDevice(dev); return; }
    /* slide fit: the instrument plate (adapter, timestamp-query, uniforms, DPR) is not on the slide; only the state strip stays */
    dev.lost.then((info) => { if (gone) return; root.querySelectorAll('.gp-status').forEach((el) => { el.hidden = false; el.textContent = 'device lost: ' + info.message; }); });
    for (const c of cards) c.__dev = dev;
    root.querySelectorAll('.gp-status').forEach((el) => { el.hidden = true; });
    run(WAM, d, body, 6000);
    let n = 0, raf = 0; const tick = () => { n++; if (n % 20 === 0) { $('loop-bytes').textContent = fmtB(bytes.frameState); } raf = requestAnimationFrame(tick); }; tick();
    d.add(() => cancelAnimationFrame(raf));
  })();
  return () => {
    gone = true;
    WAM.dispose();
    d.run();
    device.dispose(); /* the open app, the UI, the card's own frame request */
    if (globalThis.__supercell) delete globalThis.__supercell; /* Supercell's verification handle */
    releaseDevice(dev);
  };
}
