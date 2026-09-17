/* A tiny Chrome DevTools Protocol driver for verifying the WebGPU sheet.

   Why this exists: the Playwright MCP's Chromium ships without WebGPU, and
   the Chrome behind the browser extension is not on this machine's
   loopback. A headless Chrome launched here with --enable-unsafe-webgpu
   and --remote-debugging-port has both, and CDP over a WebSocket is all it
   takes to open a page, run JavaScript in it and take a screenshot.

   Usage:
     bun scripts/cdp-verify.js <url> [--eval 'js expression'] [--shot out.png]
                               [--wait ms] [--click 'selector'] [--port 9333]
                               [--width 1180] [--height 900] [--dpr 1] [--reduced]
   --eval runs in the page after the wait and prints the JSON result; the
   expression may be an async IIFE. --click and --wait may repeat, in order.
   Console errors and page errors are collected and printed at the end. */
const args = process.argv.slice(2);
const url = args[0];
if (!url || url.startsWith('--')) { console.error('usage: bun scripts/cdp-verify.js <url> [--eval js] [--shot file] [--wait ms] [--click sel]'); process.exit(1); }
const opt = { port: 9333, width: 1180, height: 900, dpr: 1 }, steps = [];
for (let i = 1; i < args.length; i++) {
  const a = args[i], v = args[i + 1];
  if (a === '--port') { opt.port = +v; i++; } else if (a === '--width') { opt.width = +v; i++; } else if (a === '--height') { opt.height = +v; i++; } else if (a === '--dpr') { opt.dpr = +v; i++; } else if (a === '--reduced') { opt.reduced = true; }
  else if (a === '--eval') { steps.push({ eval: v }); i++; } else if (a === '--shot') { steps.push({ shot: v }); i++; }
  else if (a === '--wait') { steps.push({ wait: +v }); i++; } else if (a === '--click') { steps.push({ click: v }); i++; }
  else if (a === '--full') { steps.push({ full: true }); }
}
const base = `http://127.0.0.1:${opt.port}`;
const target = await (await fetch(`${base}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0; const pending = new Map(); const logs = [];
const send = (method, params = {}) => new Promise((res, rej) => { const n = ++id; pending.set(n, { res, rej }); ws.send(JSON.stringify({ id: n, method, params })); });
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); return; }
  if (m.method === 'Runtime.exceptionThrown') logs.push('PAGEERROR ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 300));
  if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) logs.push(m.params.type + ': ' + m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 300));
  if (m.method === 'Log.entryAdded' && (m.params.entry.level === 'error' || m.params.entry.level === 'warning')) logs.push('log.' + m.params.entry.level + ': ' + m.params.entry.text.slice(0, 300));
};
await new Promise((r) => { ws.onopen = r; });
await send('Network.enable'); await send('Network.setCacheDisabled', { cacheDisabled: true }); await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
if (opt.reduced) await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
await send('Emulation.setDeviceMetricsOverride', { width: opt.width, height: opt.height, deviceScaleFactor: opt.dpr, mobile: false });
const evalIn = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) return { error: r.exceptionDetails.exception?.description || r.exceptionDetails.text }; return r.result.value; };
await send('Page.navigate', { url });
await new Promise((r) => setTimeout(r, 1500));
const out = [];
for (const s of steps) {
  if (s.wait) await new Promise((r) => setTimeout(r, s.wait));
  else if (s.eval) out.push(await evalIn(s.eval));
  else if (s.click) await evalIn(`(() => { const el = document.querySelector(${JSON.stringify(s.click)}); if (!el) return 'no such element'; el.scrollIntoView({ block: 'center' }); el.click(); return 'clicked'; })()`);
  else if (s.shot) {
    const clipExpr = s.shot.includes('@') ? s.shot.split('@')[1] : null; const file = s.shot.split('@')[0];
    let clip;
    if (clipExpr) { const r = await evalIn(`(() => { const el = document.querySelector(${JSON.stringify(clipExpr)}); if (!el) return null; el.scrollIntoView({ block: 'center' }); const b = el.getBoundingClientRect(); return { x: b.left + scrollX, y: b.top + scrollY, w: b.width, h: b.height }; })()`); if (r) clip = { x: r.x, y: r.y, width: r.w, height: r.h, scale: 1 }; await new Promise((r) => setTimeout(r, 300)); }
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, ...(clip ? { clip } : {}) });
    await Bun.write(file, Buffer.from(shot.data, 'base64')); out.push('shot ' + file);
  }
}
console.log(JSON.stringify({ out, logs: logs.slice(0, 20) }, null, 1));
await send('Target.closeTarget', { targetId: target.id }).catch(() => {});
ws.close(); process.exit(0);
