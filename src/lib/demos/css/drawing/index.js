// @ts-nocheck -- sheet code, untyped on the sheet
import { stage } from '../../_kit/stage.js';
import { disposer } from '../../_kit/disposer.js';
import css from './demo.css?raw';
import html from './demo.html?raw';

/* Chromium ignores @property inside a shadow root, so the rule in
   demo.css registers nothing here and --ap would step instead of
   interpolate. The same registration, made at document level (where it
   reaches every tree). Registration is global and permanent for the
   page; a second mount finds it already there and moves on. */
function registerProps() {
  try { CSS.registerProperty({ name: '--ap', syntax: '<percentage>', inherits: false, initialValue: '0%' }); } catch { /* already registered */ }
}

export function mount(host) {
  registerProps();
  const { root } = stage(host, { css, html });
  const d = disposer();
  if (window.top !== window.self) root.getElementById('crumb').style.display = 'none';

  /* ── the aperture card drives its own scrollbar ───────────────
     CSS can animate almost everything on this page, but it cannot
     animate scroll position — there is no property for it. Rather than
     fake the effect with a translate (which would stop being a
     demonstration of scroll-driven animation), a script eases the
     scrollbar instead, exactly as a finger would. The animation itself
     is still entirely CSS reading scroll().

     The drive is INCREMENTAL rather than a function of elapsed time:
     each frame it reads where the scrollbar actually is and nudges it
     on. That is what lets a stray wheel gesture interrupt without
     breaking anything — after a short beat the loop simply carries on
     from wherever the finger left it, with no jump to re-phase. A clock
     -based version would have to solve for the matching time offset, or
     snap. Speed is scaled by sin(π·u) so it slows into both turns. */
  (function () {
    const el = root.querySelector('.depth');
    const hint = root.getElementById('depthHint');
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let dir = 1;               // +1 opening, -1 closing
    let held = 0;              // auto-drive suspended until this timestamp
    let last = performance.now();
    let raf = 0;

    /* Programmatic scrollTop writes don't fire these, so the loop can't
       suspend itself — only a real gesture does. */
    ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach(ev =>
      d.on(el, ev, () => {
        held = performance.now() + 1600;
        if (hint) hint.textContent = 'yours · resumes';
      }, { passive: true }));

    (function tick(now) {
      const dt = Math.min(64, now - last);
      last = now;
      const max = el.scrollHeight - el.clientHeight;
      if (max > 0 && now >= held) {
        const u = Math.min(1, Math.max(0, el.scrollTop / max));
        const ease = 0.22 + 0.78 * Math.sin(Math.PI * u);   // slow at both ends
        el.scrollTop += dir * (max / 3600) * dt * ease;
        if (el.scrollTop >= max - 0.5) dir = -1;
        else if (el.scrollTop <= 0.5) dir = 1;
      }
      raf = requestAnimationFrame(tick);
    })(performance.now());
    d.add(() => cancelAnimationFrame(raf));
  })();

  return () => { d.run(); root.innerHTML = ''; };
}
