/* §2 · one device, eight apps. The iPhone Duo is CSS — a frame, a display, a
   status corner and the Dock down the right edge — because the phone is
   only there to say "this form factor". Everything inside the display is
   one WebGPU canvas: whichever app is open owns it, draws its own panes,
   type, glass and controls through ui.js over its own scene, and is torn
   down when the next app is opened, so only one app's buffers exist at a
   time. The Dock switches apps; the caption under the device follows. */
import { $, card, reduced } from './common.js';
import { makeUI, uiPointer } from './ui.js';
import { duoShell, DUO } from './shell.js';

export function deviceCard(apps) {
  const el = $('dv-card'), canvas = $('dv-canvas'), loading = $('dv-loading'); duoShell('dv-fit', 'dv-phone');
  let ui = null, dev = null, cur = null, curId = null, pending = null, hover = null, press = null, drag = false;
  /* Under reduced motion the sheet's clock draws its poster once and stops, so nothing would
     ever open an app or show a change. invalidate() asks for exactly one more frame — a
     single rAF, not a loop — and is a no-op while the clock is running. */
  let self = null, queued = 0;
  const invalidate = () => { if (!reduced.matches || queued || !self) return; queued = requestAnimationFrame(() => { queued = 0; self.frame(0, 1 / 60, performance.now()); }); };
  const host = { canvas, get ui() { return ui; }, pointer: { x: -1, y: -1, down: false }, invalidate };
  const buttons = apps.map((a) => $('dv-app-' + a.id));
  const caption = (id) => apps.forEach((a) => { const c = $('dv-cap-' + a.id); if (c) c.hidden = a.id !== id; });
  const open = (id) => { if (id === curId || !dev) { pending = id === curId ? null : id; return; } pending = id; loading.hidden = false; loading.textContent = 'opening ' + apps.find((a) => a.id === id).name + '…'; invalidate(); };
  const swap = () => { const id = pending; pending = null; if (cur) { try { cur.destroy(); } catch (e) { console.warn('destroy', curId, e); } cur = null; }
    const a = apps.find((x) => x.id === id); curId = id; buttons.forEach((b, i) => b.classList.toggle('dd-dock-on', apps[i].id === id)); caption(id);
    cur = a.make(); cur.init(dev, host); location.hash.length > 1 && history.replaceState(null, '', '#' + id); };
  buttons.forEach((b, i) => b.addEventListener('click', () => open(apps[i].id)));
  return self = card({ name: 'device', el, init() { dev = this.__dev; ui = makeUI(canvas, DUO.w, DUO.h);
      uiPointer(ui, (p) => { host.pointer.x = p.x; host.pointer.y = p.y; hover = ui.at(p.x, p.y); canvas.style.cursor = hover ? 'pointer' : (cur && cur.cursor) || 'default'; if (cur && cur.move) cur.move(p, hover, drag); },
        () => { host.pointer.x = -1; host.pointer.y = -1; hover = null; if (cur && cur.leave) cur.leave(); },
        (p) => { press = ui.at(p.x, p.y); drag = true; host.pointer.down = true; if (cur && cur.down) cur.down(p, press); },
        (p) => { drag = false; host.pointer.down = false; if (p && cur && cur.up) cur.up(p, press, press && ui.at(p.x, p.y) === press); press = null; invalidate(); });
      const want = (location.hash || '').slice(1); pending = apps.some((a) => a.id === want) ? want : apps[0].id; },
    frame(t, dt, now) { if (!ui) return; if (pending) { if (loading.hidden) { loading.hidden = false; loading.textContent = 'opening ' + apps.find((a) => a.id === pending).name + '…'; invalidate(); return; } swap(); loading.hidden = true; }
      if (!cur) return; ui.begin(); cur.frame(t, dt, now, hover); } });
}
