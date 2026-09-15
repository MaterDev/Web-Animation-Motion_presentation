/* SL-14 · the sheet: one clock, one inspector, one device with eight apps. */
import { $, DPR, getDevice, adapterName, hasTS, bytes, run } from './common.js';
import { clockCard } from './clock.js';
import { deviceCard } from './device.js';
import { atlasApp, nectarApp } from './apps.js';
import { walletApp } from './wallet.js';
import { flockApp } from './flock.js';
import { tesseraApp } from './procedural.js';
import { halcyonApp } from './optics.js';
import { duoApp } from './duo.js';
import { stormApp } from './storm.js';

const APPS = [
  { id: 'wallet', name: 'Wallet', make: walletApp }, { id: 'atlas', name: 'Atlas', make: atlasApp }, { id: 'nectar', name: 'Nectar', make: nectarApp },
  { id: 'flock', name: 'Roost', make: flockApp }, { id: 'tessera', name: 'Tessera', make: tesseraApp }, { id: 'halcyon', name: 'Halcyon', make: halcyonApp }, { id: 'storm', name: 'Supercell', make: stormApp }, { id: 'duo', name: 'Duo', make: duoApp },
];
const cards = [clockCard(), deviceCard(APPS)];
const fmtB = (n) => n === 0 ? '0 B' : n < 1024 ? n + ' B' : (n / 1024).toFixed(1) + ' KB';
(async () => {
  let dev;
  try { dev = await getDevice(); } catch (e) { document.querySelectorAll('.gp-status').forEach((el) => { el.hidden = false; el.textContent = e.message; }); $('instrument-adapter').textContent = 'none'; return; }
  $('instrument-adapter').textContent = adapterName(); $('instrument-ts').textContent = hasTS ? 'available' : 'unavailable on this adapter'; $('instrument-dpr').textContent = DPR + '× device pixels';
  dev.lost.then((info) => document.querySelectorAll('.gp-status').forEach((el) => { el.hidden = false; el.textContent = 'device lost: ' + info.message; }));
  for (const c of cards) c.__dev = dev;
  document.querySelectorAll('.gp-status').forEach((el) => { el.hidden = true; });
  const demo = run(document.body, 6000);
  let n = 0; const tick = () => { n++; if (n % 20 === 0) { $('instrument-bytes').textContent = fmtB(bytes.frameState); $('instrument-uni').textContent = fmtB(bytes.frameUni); $('loop-bytes').textContent = fmtB(bytes.frameState) + ' state'; const on = document.querySelector('.dd-dock-on'); $('loop-count').textContent = on ? on.title : '—'; } requestAnimationFrame(tick); }; tick();
  void demo;
})();
