// @ts-nocheck -- derived from design/techniques/webgpu/sheet.js; untyped sheet code
/* SL-14 §1 · the frame inspector, as a demo the deck owns.
   sheet.js, cut down to the one card: acquire a device, run the card from one
   WAM clock, print the adapter under the panel — and, unlike the sheet, give
   all of it back on dispose so a slide can mount it again. */
import css from './demo.css?raw';
import html from './demo.html?raw';
import { stage } from '../../_kit/stage.js';
import { createWAM } from '../../_kit/wam.js';
import { disposer } from '../../_kit/disposer.js';
import { setScope, $, getDevice, adapterName, run, releaseDevice } from './common.js';
import * as common from './common.js';
import { clockCard } from './clock.js';

/** @param {HTMLElement} host */
export function mount(host) {
  const { root, body } = stage(host, { css, html });
  const d = disposer();
  const WAM = createWAM({ root });
  let gone = false, dev = null;
  setScope(root);
  releaseDevice(); /* a fresh card registry for this mount */
  const cards = [clockCard()];
  (async () => {
    try { dev = await getDevice(); } catch (e) { if (gone) return; root.querySelectorAll('.gp-status').forEach((el) => { el.hidden = false; el.textContent = e.message; }); $('ck-adapter').textContent = 'no adapter'; return; }
    if (gone) { releaseDevice(dev); return; }
    $('ck-adapter').textContent = adapterName() + (common.hasTS ? '' : ' · no timestamp-query');
    dev.lost.then((info) => { if (gone) return; root.querySelectorAll('.gp-status').forEach((el) => { el.hidden = false; el.textContent = 'device lost: ' + info.message; }); });
    for (const c of cards) c.__dev = dev;
    root.querySelectorAll('.gp-status').forEach((el) => { el.hidden = true; });
    run(WAM, d, body, 6000);
  })();
  return () => {
    gone = true;
    WAM.dispose();
    d.run();
    releaseDevice(dev);
  };
}
