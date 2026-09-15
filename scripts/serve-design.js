/* serve design/ on 8765 with Cache-Control: no-store, so browsers never hold a stale module */
const root = new URL('../design/', import.meta.url).pathname;
const types = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', woff2: 'font/woff2', json: 'application/json', md: 'text/markdown', glb: 'model/gltf-binary' };
Bun.serve({ port: 8765, hostname: '0.0.0.0', async fetch(req) { let p = decodeURIComponent(new URL(req.url).pathname); if (p.endsWith('/')) p += 'index.html'; const f = Bun.file(root + p); if (!(await f.exists())) return new Response('not found', { status: 404 }); const ext = p.split('.').pop(); return new Response(f, { headers: { 'Content-Type': types[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' } }); } });
console.log('design/ on http://127.0.0.1:8765 (no-store)');
