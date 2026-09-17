/* POSTERS FOR NON-LIVE SLIDES.

   The grid, the rail and the phone remote render slides with live={false},
   so a demo slide's well was blank there (Key: "i dont want to show a blank").
   This mounts each deck demo alone on /demos in the headless Chrome on 9333
   (see cdp-verify.js), lays it out the way DemoHost does (demoWidth wide, or
   the well's size when not fit), waits for it to settle and saves a
   transparent WebP to src/lib/deck/posters/<technique>__<slug>.webp.
   DemoHost shows that image whenever it is not live.

   Usage: bun scripts/shoot-posters.js [demoId ...]    (dev server on 5199) */
import { SLIDES } from '../src/lib/deck/slides.js';

const only = process.argv.slice(2);
const jobs = SLIDES.filter((s) => s.demoId && (!only.length || only.includes(s.demoId)))
  .map((s) => ({ id: s.demoId, fit: s.layout !== 'demo', w: s.layout === 'demo' ? (s.wide ? 864 : 504) : (s.demoWidth ?? 1100), h: s.layout === 'demo' ? (s.wide ? 288 : 444) : 0, wait: s.demoId.endsWith('finale') ? 1800 : /webgpu|webgl/.test(s.demoId) ? 8000 : 4500 }));

const base = 'http://127.0.0.1:9333';
for (const job of jobs) {
  const target = await (await fetch(`${base}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let n = 0; const pending = new Map();
  const send = (method, params = {}) => new Promise((res, rej) => { const k = ++n; pending.set(k, { res, rej }); ws.send(JSON.stringify({ id: k, method, params })); });
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } };
  await new Promise((r) => { ws.onopen = r; });
  const evalIn = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.value;
  await send('Page.enable'); await send('Runtime.enable');
  await send('Target.activateTarget', { targetId: target.id }).catch(() => {});
  await send('Emulation.setDeviceMetricsOverride', { width: Math.max(job.w, 400), height: 1400, deviceScaleFactor: 1, mobile: false });
  await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
  await send('Page.navigate', { url: `http://localhost:5199/demos?d=${job.id}` });
  await new Promise((r) => setTimeout(r, 1500));
  await evalIn(`(() => { const h = document.querySelector('[data-testid=demo-host]');
    for (const e of [document.documentElement, document.body]) { e.style.background = 'transparent'; }
    document.body.style.visibility = 'hidden';
    h.style.cssText = 'position:fixed;left:0;top:0;margin:0;padding:0;border:0;z-index:2147483647;visibility:visible;background:transparent;width:${job.w}px;${job.h ? `height:${job.h}px;overflow:hidden;` : ''}';
    return 1; })()`);
  await new Promise((r) => setTimeout(r, job.wait));
  const hh = job.h || await evalIn(`document.querySelector('[data-testid=demo-host]').scrollHeight`);
  const shot = await send('Page.captureScreenshot', { format: 'webp', quality: 82, clip: { x: 0, y: 0, width: job.w, height: hh, scale: 1 } });
  const file = `src/lib/deck/posters/${job.id.replace('/', '__')}.webp`;
  await Bun.write(file, Buffer.from(shot.data, 'base64'));
  console.log(file, job.w + '×' + hh, Math.round(shot.data.length * 0.75 / 1024) + ' KB');
  await send('Target.closeTarget', { targetId: target.id }).catch(() => {});
  ws.close();
}
process.exit(0);
