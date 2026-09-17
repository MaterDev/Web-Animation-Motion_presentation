// @ts-nocheck -- rebuilt for the slide from design/techniques/webgpu/device.js; untyped sheet code
/* One device, one canvas, and the device is WebGPU too. The fPhone Duo is the
   sphere-traced hardware in duo.js; it starts closed, opens on a press, boots,
   and lands on a Home Screen drawn with ui.js. An icon opens its app out of the
   icon; the home indicator on the right edge (or Home, or Escape) takes it
   back. Only one app's buffers are ever alive: the last is torn down once the
   Home Screen is back in front.

   The OS layer draws into a texture the size of the open display in device
   pixels — the Home Screen's, or the app's — and the hardware composites it
   onto the display plane. Closed or moving, the body is marched every frame;
   held still, it accumulates jittered samples and then stops marching. */
import { $, card, reduced, format, DPR } from './common.js';
import { makeUI } from './ui.js';
import { makeHardware, ease, SPECS } from './duo.js';
import { makeHome, REAL } from './home.js';

const PW = 890, PH = 626;
/* the inner display's corner radius in points, so apps can follow it: (cornerR − bezel) of a display 2 (leafW − bezel) wide = 890 pt */
const SCREEN_RADIUS = (SPECS.cornerR.v - SPECS.bezel.v) * PW / (2 * (SPECS.leafW.v - SPECS.bezel.v));
const DUR = { open: 1500, boot: 1150, launch: 483, back: 414, sleep: 260, close: 1300 }; /* app zoom in and out: 420 and 360 ms × 1.15 */

export function deviceCard(apps, captions) {
  const el = $('dv-card'), canvas = $('dv-canvas'), openBtn = $('dv-open'), exitBtn = $('dv-app-exit'), capName = $('dv-cap-name'), capLine = $('dv-cap-line');
  let dev = null, ctx = null, hw = null, ui = null, home = null, homeT = null, appT = null, target = null;
  let state = 'closed', t0 = 0, cur = null, curId = null, zoomFrom = null, hover = null, press = null, drag = false, queued = 0, self = null;
  const surface = { width: 2, height: 2, view: () => target.createView() };
  const dur = (k) => (reduced.matches ? 0 : DUR[k]);
  const invalidate = () => { if (!reduced.matches || queued || !self) return; queued = requestAnimationFrame(() => { queued = 0; self.frame(0, 1 / 60, performance.now()); }); };
  const host = { canvas, get ui() { return ui; }, pointer: { x: -1, y: -1, down: false }, invalidate };

  const caption = (id) => { const c = captions[id] || captions.home; capName.textContent = c[0]; capLine.textContent = c[1]; };
  const controls = () => {
    const open = state !== 'closed' && state !== 'closing';
    openBtn.textContent = open ? 'Close' : 'Open'; openBtn.setAttribute('aria-pressed', String(open));
    exitBtn.hidden = !(state === 'app' || state === 'launch');
    caption(state === 'closed' || state === 'opening' || state === 'closing' || state === 'sleep' ? 'closed' : (state === 'app' || state === 'launch') ? curId : 'home');
  };
  const go = (s) => { state = s; t0 = performance.now(); controls(); invalidate(); };
  const killApp = () => { if (cur) { try { cur.destroy(); } catch (e) { console.warn('destroy', curId, e); } cur = null; curId = null; } };

  const open = () => { if (!hw) return; if (state === 'closed') go('opening'); };
  const close = () => { if (state === 'closed' || state === 'closing' || state === 'opening') return; killApp(); go('sleep'); };
  const goHome = () => { if (state === 'app' || state === 'launch') go('back'); };
  const launch = (id, r) => { if (state !== 'home' || !REAL[id]) return; killApp();
    const a = apps.find((x) => x.id === id); curId = id; cur = a.make(); cur.init(dev, host); zoomFrom = r; go('launch'); };
  openBtn.addEventListener('click', () => (state === 'closed' ? open() : close()));
  exitBtn.addEventListener('click', goHome);
  /* the exit button sits just outside the open device's top-right corner */
  const placeExit = () => { if (!hw) return; const B = hw.bounds, k = canvas.clientWidth / canvas.width;
    exitBtn.style.left = ((B.x + B.w) * k + 12) + 'px'; exitBtn.style.top = (B.y * k) + 'px'; };
  const onKey = (e) => { if (e.key === 'Escape') goHome(); };
  el.addEventListener('keydown', onKey);

  /* pointer → device pixels → points on the display */
  const at = (e) => { const r = canvas.getBoundingClientRect(); const px = (e.clientX - r.left) * canvas.width / r.width, py = (e.clientY - r.top) * canvas.height / r.height;
    const R = hw ? hw.rect : { x: 0, y: 0, w: 1, h: 1 }; return { x: (px - R.x) / R.w * PW, y: (py - R.y) / R.h * PH, inside: px >= R.x && py >= R.y && px <= R.x + R.w && py <= R.y + R.h }; };
  const onScreen = () => state === 'home' || state === 'app';
  const indicator = (p) => state === 'app' && p.x > PW - 40 && Math.abs(p.y - PH / 2) < 130;
  canvas.addEventListener('pointerdown', (e) => { const p = at(e);
    if (state === 'closed') { open(); return; }
    if (!onScreen() || !p.inside) return; try { canvas.setPointerCapture(e.pointerId); } catch {}
    press = indicator(p) ? 'home-indicator' : ui.at(p.x, p.y); drag = true; host.pointer.down = true;
    if (state === 'app' && cur && cur.down && press !== 'home-indicator') cur.down(p, press); });
  canvas.addEventListener('pointermove', (e) => { const p = at(e); host.pointer.x = p.x; host.pointer.y = p.y;
    if (state === 'closed') { canvas.style.cursor = 'pointer'; return; }
    if (!onScreen() || !ui) { canvas.style.cursor = 'default'; return; }
    hover = p.inside ? ui.at(p.x, p.y) : null; canvas.style.cursor = indicator(p) || hover ? 'pointer' : (state === 'app' && cur && cur.cursor) || 'default';
    if (state === 'app' && cur && cur.move) cur.move(p, hover, drag); });
  canvas.addEventListener('pointerup', (e) => { const p = at(e); drag = false; host.pointer.down = false; const was = press; press = null;
    if (was === 'home-indicator') { if (indicator(p)) goHome(); return; }
    const same = was && ui && ui.at(p.x, p.y) === was;
    if (state === 'home' && same) { const kind = was.slice(0, was.indexOf('-')), [id, x, y, sz] = was.slice(was.indexOf('-') + 1).split(':');
      if (kind === 'app') launch(id, [+x, +y, +sz]); return; }
    if (state === 'app' && cur && cur.up) cur.up(p, was, same); invalidate(); });
  canvas.addEventListener('pointerleave', () => { hover = null; if (state === 'app' && cur && cur.leave) cur.leave(); });

  const fitCanvas = () => { const r = canvas.getBoundingClientRect(); const w = Math.max(2, Math.round(r.width * DPR)), h = Math.max(2, Math.round(r.height * DPR)); if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; return true; } return false; };
  const surfaces = () => { const R = hw.resize(); if (homeT) { homeT.destroy(); appT.destroy(); }
    const mk = () => dev.createTexture({ size: [R.w, R.h], format, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
    homeT = mk(); appT = mk(); surface.width = R.w; surface.height = R.h; };

  return self = card({ name: 'device', el,
    init() { dev = this.__dev; ctx = canvas.getContext('webgpu'); ctx.configure({ device: dev, format, alphaMode: 'premultiplied' });
      fitCanvas(); hw = makeHardware(dev, canvas, ctx, format); surfaces();
      /* a verification handle on the element, not the window: the display rect in device pixels and the OS state */
      canvas.__duo = { rect: hw.rect, bounds: hw.bounds, state: () => state };
      target = homeT; ui = makeUI(surface, PW, PH); ui.screenRadius = SCREEN_RADIUS; home = makeHome(dev, ui); openBtn.disabled = false; placeExit(); controls(); },
    frame(t, dt, now) { if (!hw) return;
      if (fitCanvas()) surfaces();
      placeExit();
      const k = (d) => (d ? Math.min(1, (now - t0) / d) : 1);
      /* the state machine: pose 0 closed → 1 open and frontal; fold is the hinge angle */
      let pose = 1, openness = 1, outer = 0, awake = 1, still = true, zoom = null, appAlpha = 0, pill = 0, homeDim = 0, content = null, bootP = 0, fade = 0;
      if (state === 'closed') { pose = 0; openness = 0; outer = 1; awake = 0; }
      else if (state === 'opening') { const p = k(dur('open')); pose = p; openness = ease((p - 0.06) / 0.86); outer = 1 - Math.min(1, p / 0.22); awake = Math.max(0, (p - 0.8) / 0.2); still = false; content = awake > 0 ? 'boot' : null; if (p >= 1) go(reduced.matches ? 'home' : 'boot'); }
      else if (state === 'boot') { const p = k(dur('boot')); bootP = p; content = p < 0.8 ? 'boot' : 'home'; fade = p < 0.8 ? 0 : 1 - (p - 0.8) / 0.2; bootP = Math.min(1, p / 0.75); if (p >= 1) go('home'); }
      else if (state === 'home') content = 'home';
      else if (state === 'launch' || state === 'back') { const back = state === 'back', p = k(dur(back ? 'back' : 'launch')), e = ease(back ? 1 - p : p);
        const [ix, iy, is] = zoomFrom, sx = surface.width / PW, sy = surface.height / PH, from = [ix * sx, iy * sy, is * sx, is * sy], full = [0, 0, surface.width, surface.height];
        zoom = from.map((v, i) => v + (full[i] - v) * e); appAlpha = Math.min(1, e * 3); homeDim = 0.3 * e; pill = e; content = back ? 'home' : 'app';
        if (p >= 1) { if (back) { killApp(); go('home'); } else go('app'); } }
      else if (state === 'app') { zoom = [0, 0, surface.width, surface.height]; appAlpha = 1; pill = 1; content = 'app'; }
      else if (state === 'sleep') { const p = k(dur('sleep')); awake = 1 - p; content = 'home'; if (p >= 1) go('closing'); }
      else if (state === 'closing') { const p = k(dur('close')); pose = 1 - p; openness = 1 - ease((p - 0.02) / 0.86); outer = Math.max(0, (p - 0.78) / 0.22); awake = 0; still = false; if (p >= 1) go('closed'); }
      /* the display's content, into its texture */
      if (content === 'boot') { target = homeT; ui.begin(); home.boot(bootP); }
      else if (content === 'home') { target = homeT; ui.begin(); home.draw(now, fade); }
      else if (content === 'app' && cur) { target = appT; ui.begin(); cur.frame(t, dt, now, hover); }
      /* the hardware */
      const enc = dev.createCommandEncoder();
      const accumulating = hw.body(enc, pose, Math.PI - openness * Math.PI, outer, still);
      hw.composite(enc, homeT, appT, { awake, settled: pose >= 1, zoom, zoomRad: zoom ? 18 * (1 - (zoom[2] / surface.width)) * surface.width / PW : 0, appAlpha, pill, homeDim });
      dev.queue.submit([enc.finish()]);
      if (accumulating || (state !== 'closed' && state !== 'home' && state !== 'app')) invalidate(); },
    dispose() { if (queued) cancelAnimationFrame(queued); queued = 0; self = null; el.removeEventListener('keydown', onKey);
      killApp(); if (home) home.destroy(); if (ui) { try { ui.destroy(); } catch {} ui = null; }
      if (hw) hw.destroy(); hw = null; if (homeT) { homeT.destroy(); appT.destroy(); } homeT = appT = null; } });
}
