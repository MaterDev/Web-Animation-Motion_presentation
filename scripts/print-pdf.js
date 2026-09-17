/* THE DECK AS A PDF — one A4 landscape page per slide, notes left, slide right.

   It opens /print in the headless Chrome on 9333 (the one cdp-verify.js uses),
   captures each `.pk-page` as an image and assembles the images into a PDF.

   Why not Chrome's own print: a slide is dense vector work — LCD grids, glass,
   gradients, poster stills — and `Page.printToPDF` re-rasterised every layer at
   print resolution. It ran for minutes and made an 83 MB file. A screenshot per
   page is one raster of what the page already looks like: seconds, and a few
   hundred KB per page. The text is part of the image, so it is not selectable.

   Usage: bun scripts/print-pdf.js [out.pdf] [--port 9333] [--url <page>]
                                   [--dpr 2] [--quality 88] */
const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith('--')) ?? 'WAM-2026-deck-and-notes.pdf';
const val = (flag, dflt) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : dflt; };
const port = +val('--port', 9333);
const url = val('--url', 'http://localhost:5199/print');
const dpr = +val('--dpr', 2);
const quality = +val('--quality', 88);

const base = `http://127.0.0.1:${port}`;
const target = await (await fetch(`${base}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
let n = 0; const pending = new Map(); const logs = [];
const send = (method, params = {}) => new Promise((res, rej) => { const k = ++n; pending.set(k, { res, rej }); ws.send(JSON.stringify({ id: k, method, params })); });
ws.onmessage = (ev) => { const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); return; }
  if (m.method === 'Runtime.exceptionThrown') logs.push('PAGEERROR ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 200)); };
await new Promise((r) => { ws.onopen = r; });
await send('Page.enable'); await send('Runtime.enable');
const evalIn = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
};

/* wide enough for a whole page, tall enough to hold one in view */
await send('Emulation.setDeviceMetricsOverride', { width: 1120, height: 780, deviceScaleFactor: dpr, mobile: false });
await send('Page.navigate', { url });
await new Promise((r) => setTimeout(r, 2500));
/* every wait is raced against a deadline: a font or image that never settles must not hold this open */
const ready = await evalIn(`(async () => { const cap = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(r, ms))]);
  await cap(document.fonts.ready, 8000);
  const imgs = [...document.images];
  await cap(Promise.all(imgs.map((i) => i.complete ? 1 : new Promise((r) => { i.onload = i.onerror = r; }))), 20000);
  /* the screen padding and drop shadows are for reading on screen, not for paper */
  document.querySelectorAll('.pk-print').forEach((e) => { e.style.background = '#fff'; e.style.padding = '0'; });
  document.querySelectorAll('.pk-page').forEach((e) => { e.style.boxShadow = 'none'; e.style.margin = '0 auto'; });
  return { pages: document.querySelectorAll('.pk-page').length, images: imgs.length, loaded: imgs.filter((i) => i.naturalWidth > 0).length }; })()`);
await new Promise((r) => setTimeout(r, 600));

const shots = [];
for (let k = 0; k < ready.pages; k++) {
  const box = await evalIn(`(() => { const el = document.querySelectorAll('.pk-page')[${k}];
    el.scrollIntoView({ block: 'start' }); const b = el.getBoundingClientRect();
    return { x: b.left + scrollX, y: b.top + scrollY, w: b.width, h: b.height }; })()`);
  await new Promise((r) => setTimeout(r, 160));
  const shot = await send('Page.captureScreenshot', {
    format: 'jpeg', quality, captureBeyondViewport: true,
    clip: { x: box.x, y: box.y, width: box.w, height: box.h, scale: dpr },
  });
  const file = `${out}.page-${String(k).padStart(2, '0')}.jpg`;
  await Bun.write(file, Buffer.from(shot.data, 'base64'));
  shots.push(file);
}
await send('Target.closeTarget', { targetId: target.id }).catch(() => {});
ws.close();

/* assemble: each image is one A4 landscape sheet (842.4 × 595.3 pt) */
const py = Bun.spawnSync(['python3', 'scripts/jpegs-to-pdf.py', out, '842.4', '595.3', ...shots]);
if (py.exitCode !== 0) { console.error(py.stderr.toString()); process.exit(1); }
for (const f of shots) { try { await Bun.file(f).delete(); } catch {} }
console.log(JSON.stringify({ out, ...ready, assembled: py.stdout.toString().trim(), logs: logs.slice(0, 10) }, null, 1));
process.exit(0);
