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
import { setScope, $, DPR, getDevice, adapterName, bytes, run, releaseDevice } from './common.js';
import * as common from './common.js';
import { deviceCard } from './device.js';
import { flockApp } from './flock.js';
import { tesseraApp } from './procedural.js';
import { stormApp } from './storm.js';
import { duoApp } from './duo.js';

/* extraction: the Dock keeps Roost, Tessera, Supercell and Duo, in that order; Wallet, Atlas, Nectar and Halcyon are not copied */
const APPS = [
  { id: 'flock', name: 'Roost', make: flockApp }, { id: 'tessera', name: 'Tessera', make: tesseraApp }, { id: 'storm', name: 'Supercell', make: stormApp }, { id: 'duo', name: 'Duo', make: duoApp },
];

const fmtB = (n) => n === 0 ? '0 B' : n < 1024 ? n + ' B' : (n / 1024).toFixed(1) + ' KB';

/** @param {HTMLElement} host */
export function mount(host) {
  const { root, body } = stage(host, { css, html });
  const d = disposer();
  const WAM = createWAM({ root });
  let gone = false, dev = null;
  setScope(root);
  releaseDevice(); /* a fresh card registry for this mount */
  const device = deviceCard(APPS);
  const cards = [device];
  (async () => {
    try { dev = await getDevice(); } catch (e) { if (gone) return; root.querySelectorAll('.gp-status').forEach((el) => { el.hidden = false; el.textContent = e.message; }); $('instrument-adapter').textContent = 'none'; return; }
    if (gone) { releaseDevice(dev); return; }
    $('instrument-adapter').textContent = adapterName(); $('instrument-ts').textContent = common.hasTS ? 'available' : 'unavailable on this adapter'; $('instrument-dpr').textContent = DPR + '× device pixels';
    dev.lost.then((info) => { if (gone) return; root.querySelectorAll('.gp-status').forEach((el) => { el.hidden = false; el.textContent = 'device lost: ' + info.message; }); });
    for (const c of cards) c.__dev = dev;
    root.querySelectorAll('.gp-status').forEach((el) => { el.hidden = true; });
    run(WAM, d, body, 6000);
    let n = 0, raf = 0; const tick = () => { n++; if (n % 20 === 0) { $('instrument-bytes').textContent = fmtB(bytes.frameState); $('instrument-uni').textContent = fmtB(bytes.frameUni); $('loop-bytes').textContent = fmtB(bytes.frameState) + ' state'; const on = root.querySelector('.dd-dock-on'); $('loop-count').textContent = on ? on.title : '—'; } raf = requestAnimationFrame(tick); }; tick();
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
