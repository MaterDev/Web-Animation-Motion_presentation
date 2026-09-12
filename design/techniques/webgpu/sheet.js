/* SL-14 · the sheet: one device, eleven cards, one clock. */
import { $, DPR, getDevice, adapterName, hasTS, bytes, run } from './common.js';
import { clockCard } from './clock.js';
import { loopCards } from './loop.js';
import { neighbourCards } from './neighbours.js';
import { populationCards } from './population.js';
import { proceduralCard } from './procedural.js';
import { inferCard } from './infer.js';

const cards = [clockCard(), ...loopCards(), ...neighbourCards(), ...populationCards(), proceduralCard(), inferCard()];
const fmtB = (n) => n === 0 ? '0 B' : n < 1024 ? n + ' B' : (n / 1024).toFixed(1) + ' KB';
(async () => {
  let dev;
  try { dev = await getDevice(); } catch (e) { document.querySelectorAll('.gp-status').forEach((el) => { el.hidden = false; el.textContent = e.message; }); $('instrument-adapter').textContent = 'none'; return; }
  $('instrument-adapter').textContent = adapterName(); $('instrument-ts').textContent = hasTS ? 'available' : 'unavailable on this adapter'; $('instrument-dpr').textContent = DPR + '× device pixels';
  dev.lost.then((info) => document.querySelectorAll('.gp-status').forEach((el) => { el.hidden = false; el.textContent = 'device lost: ' + info.message; }));
  for (const c of cards) c.__dev = dev;
  /* the device is here; a card's status line comes back only if its own init fails */
  document.querySelectorAll('.gp-status').forEach((el) => { el.hidden = true; });
  const demo = run(document.body, 6000);
  let n = 0; const tick = () => { n++; if (n % 20 === 0) { $('instrument-bytes').textContent = fmtB(bytes.frameState); $('instrument-uni').textContent = fmtB(bytes.frameUni); $('loop-bytes').textContent = fmtB(bytes.frameState) + ' state'; $('loop-count').textContent = (160000 + 36000 + 80000 + 300000).toLocaleString(); } requestAnimationFrame(tick); }; tick();
  void demo;
})();
