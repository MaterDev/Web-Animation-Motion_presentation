/* ═══════════════════════════════════════════════════════════════
   WAM-2026 · SHARED INTERACTIONS
   Small, dependency-free helpers reused across the hub, layouts
   gallery, and technique pages. Each is opt-in — call the init
   function for whichever widgets a given page actually has.
   ═══════════════════════════════════════════════════════════════ */

/* Tint swatches: any [data-tint] element sets --tint on load. */
export function initTintSwatches(root = document) {
  root.querySelectorAll('[data-tint]').forEach(el => {
    el.addEventListener('click', () => {
      document.documentElement.style.setProperty('--tint', el.dataset.tint);
    });
  });
}

/* Encoder knob: cycles through a fixed list of section tints,
   rotating the index needle to match. Pass the same NAMES order
   used by tint-card data-tint values so cycling stays in sync. */
export function initKnob(root = document, names = ['video', 'css', 'composite', 'svg', 'canvas', 'webgl', 'webgpu']) {
  root.querySelectorAll('.knob').forEach(k => {
    let i = names.length - 1;
    k.addEventListener('click', () => {
      i = (i + 1) % names.length;
      k.style.transform = `rotate(${i * (360 / names.length)}deg)`;
      document.documentElement.style.setProperty('--tint', `var(--tint-${names[i]})`);
    });
  });
}

/* Toggle: real <button role="switch">, click flips .on and keeps
   aria-checked in sync (the actual state a screen reader announces). */
export function initToggle(root = document) {
  root.querySelectorAll('.toggle').forEach(t => {
    t.addEventListener('click', () => {
      const on = t.classList.toggle('on');
      t.setAttribute('aria-checked', String(on));
    });
  });
}

/* Specular tilt: highlight position tracks pointer position via
   --mx/--my custom properties (device accelerometer on real
   hardware, cursor standing in for it here). */
export function initSpecularTilt(root = document) {
  root.querySelectorAll('.tilt').forEach(el => {
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
      el.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
    });
    el.addEventListener('pointerleave', () => {
      el.style.setProperty('--mx', '30%');
      el.style.setProperty('--my', '20%');
    });
  });
}

/* Morph control: click toggles .open and keeps aria-expanded in
   sync, same rationale as the toggle above. */
export function initMorph(root = document) {
  root.querySelectorAll('.morph').forEach(m => {
    m.addEventListener('click', () => {
      const open = m.classList.toggle('open');
      m.setAttribute('aria-expanded', String(open));
    });
  });
}

/* One-shot animation replay: remove the class, force reflow, add it
   back — needed because re-adding an already-present class doesn't
   restart a CSS animation. Used for LCD self-test/smear, LED boot. */
export function fireOnce(el, cls, ms) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  if (ms) setTimeout(() => el.classList.remove(cls), ms);
}

/* Segmented pill nav: measures the real button box so the pill
   stretches correctly at any label length, and keeps aria-pressed
   in sync (NOT aria-selected — these are plain toggle buttons in a
   group, not ARIA tabs, so aria-pressed is the correct pairing). */
export function initSegNav(root = document) {
  root.querySelectorAll('.seg-nav').forEach(nav => {
    const pill = nav.querySelector('.pill');
    const btns = [...nav.querySelectorAll('button')];
    if (!pill || !btns.length) return;
    const move = b => {
      pill.style.left = b.offsetLeft + 'px';
      pill.style.width = b.offsetWidth + 'px';
      btns.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    };
    btns.forEach(b => b.addEventListener('click', () => move(b)));
    requestAnimationFrame(() => move(btns[0]));
    window.addEventListener('resize', () =>
      move(btns.find(b => b.getAttribute('aria-pressed') === 'true') || btns[0]));
  });
}
