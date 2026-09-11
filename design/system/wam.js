/* ── WAM · shared runtime ─────────────────────────────────────
   One namespace for every demo on a technique sheet. Deliberately not a
   module: ES module imports are blocked on file:// in Chrome and
   Safari, and these tearsheets are meant to open from disk.

   The contract is render(t), t in [0,1], where EVERY visual attribute
   is set from t alone — no accumulated state, idempotent, and nothing
   render() touches may carry a CSS transition (a transition would make
   a screenshot at t show a value that is on its way somewhere else).
   Scrub, autoplay, the reduced-motion poster and the QC filmstrip are
   then four callers of one function rather than four code paths.

   Loaded as a CLASSIC script — no defer, no async, no type="module" —
   immediately before the first inline block that references WAM. A
   deferred copy would run after those inline blocks and every
   WAM.clock() call would throw. See ADR-001. */
window.WAM = (function () {
  const mq = matchMedia('(prefers-reduced-motion: reduce)');
  const demos = {};

  /* performance.now() is NOT the same clock in every browser. Chromium
     hands out roughly 5 µs; Firefox and WebKit clamp it to 1 ms as an
     anti-fingerprinting measure. A per-frame cost averaged over N
     frames therefore cannot resolve anything below clamp/N — which is
     why an unqualified "0 µs/frame" in Safari and "13 µs/frame" in
     Chrome is a browser difference in the CLOCK, not in the work.

     Measured here rather than hardcoded, because the clamp is a
     setting: it moves with privacy.reduceTimerPrecision, with cross
     origin isolation, and between releases. A readout that quotes a
     cost owes the reader this number beside it. */
  let _res = 0;
  function clockRes() {
    if (_res) return _res;
    /* Bounded by WALL TIME, not by iteration count. Under a 1 ms clamp
       each distinct reading costs a millisecond of real time, so
       "sample 40000 times" is forty seconds of blocked main thread —
       which is what the first version of this did, and it hung the
       sheet in both Firefox and Safari. Take whatever transitions fall
       inside a few milliseconds instead. */
    let min = Infinity;
    const deadline = performance.now() + 4;
    while (performance.now() < deadline) {
      const a = performance.now();
      const b = performance.now();
      if (b > a && b - a < min) min = b - a;
    }
    return (_res = min === Infinity ? 1 : min);
  }

  function clock(name, { render, dur = 6000, el, poster = 1 }) {
    let raf = 0, t0 = 0, visible = true, playing = false, t = 0;

    /* Rolling mean of the time spent INSIDE render(). This is the only
       cost this sheet can honestly measure: it is main-thread work.
       Raster — including every filter primitive — happens on the
       compositor and is invisible from here. See the note in the §4
       readout; a frame-rate meter beside a filter reads the same with
       the filter on or off, which was verified rather than assumed. */
    const COST_N = 30;
    let costAcc = 0, costN = 0, cost = 0;

    /* Frame rate is tracked but deliberately NOT surfaced by default.
       It is a valid instrument for main-thread work — attribute writes,
       style, layout — and a useless one next to anything the compositor
       rasterises. A demo opts in by reading .fps, and owes the reader a
       statement of which kind of work it is measuring. */
    let fpsLast = 0, fpsAcc = 0, fpsN = 0, fps = 0;

    function draw(v) {
      t = v;
      const a = performance.now();
      render(v);
      costAcc += performance.now() - a; costN++;
      if (costN >= COST_N) { cost = costAcc / costN; costAcc = 0; costN = 0; }
    }
    function frame(now) {
      if (!t0) t0 = now;
      /* A frame over a third of a second is a stall, not a frame rate —
         a tab switch, a GC pause. Averaging it in produces a confident
         wrong number on a slide someone is reading aloud. */
      const dt = fpsLast ? now - fpsLast : 0;
      fpsLast = now;
      if (dt > 0 && dt < 340) {
        fpsAcc += dt; fpsN++;
        if (fpsAcc >= 500) { fps = (fpsN * 1000) / fpsAcc; fpsAcc = 0; fpsN = 0; }
      } else { fpsAcc = 0; fpsN = 0; }
      draw(((now - t0) % dur) / dur);
      if (playing && visible) raf = requestAnimationFrame(frame);
    }
    function play() {
      if (mq.matches || playing || !visible) return;
      playing = true; t0 = performance.now() - t * dur;
      raf = requestAnimationFrame(frame);
    }
    function pause() { playing = false; cancelAnimationFrame(raf); raf = 0; fpsLast = 0; fpsAcc = 0; fpsN = 0; }
    function seek(v) { pause(); draw(v); }

    /* Browsers throttle rAF to ~1Hz in a background tab, and a demo
       animating off-screen is pure waste on a page with several. */
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) pause(); else if (!mq.matches) play();
    });
    if (el && 'IntersectionObserver' in window) {
      new IntersectionObserver((es) => es.forEach((e) => {
        visible = e.isIntersecting;
        if (visible && !mq.matches) play(); else pause();
      }), { rootMargin: '160px' }).observe(el);
    }

    const api = {
      play, pause, seek, render: draw,
      get t() { return t; }, get playing() { return playing; },
      get cost() { return cost; }, get fps() { return fps; },
      /* Nothing below this is a measurement — it is the clock's floor. */
      get costFloor() { return clockRes() / COST_N; },
      resetMeters() { costAcc = 0; costN = 0; cost = 0; fpsAcc = 0; fpsN = 0; fps = 0; },
      dur
    };
    demos[name] = api;

    /* Reduced motion is not covered by the global CSS rule in
       tokens.css — that rule cannot reach a rAF loop. Freeze on the
       poster frame, and honour a change to the setting live. */
    if (mq.matches) draw(poster); else play();
    mq.addEventListener('change', () => {
      if (mq.matches) { pause(); draw(poster); } else play();
    });
    return api;
  }

  /* Clone the stage at N values of t into one row in THIS document, so
     CSS custom properties, @font-face and url(#…) filter refs all still
     resolve. Screenshot once and the whole transformation is one image.
     Serialising the SVG instead loses every one of those. */
  /* cloneNode(true) copies a <canvas> element and NOT its bitmap. The
     clone keeps width/height and comes back fully transparent — measured
     in Chromium, Firefox and WebKit over both file:// and localhost:
     source pixel 255,0,255,255, clone pixel 0,0,0,0, 6 of 6 runs. So a
     canvas demo filmstripped without this would render twelve blank
     cells and never error, which is worse than failing.

     drawImage on the clone's own 2D context is the copy. Sources are
     walked in document order in both trees, so the i-th source canvas
     is the i-th clone canvas; a stage that IS a canvas is handled by
     the same walk. A zero-sized backing store is skipped rather than
     passed to drawImage, which throws on a 0-width source. */
  function copyBitmaps(srcRoot, dstRoot) {
    const pick = (root) =>
      root.tagName === 'CANVAS' ? [root] : [...root.querySelectorAll('canvas')];
    const src = pick(srcRoot), dst = pick(dstRoot);
    for (let i = 0; i < src.length && i < dst.length; i++) {
      const s = src[i], c = dst[i];
      if (!s.width || !s.height) continue;
      c.width = s.width; c.height = s.height;
      c.getContext('2d').drawImage(s, 0, 0);
    }
    return src.length;
  }

  function filmstrip(name, n = 12) {
    const d = demos[name]; if (!d) return console.error('no demo: ' + name);
    const stage = document.querySelector('[data-testid="' + name + '"]');
    if (!stage) return console.error('no stage for: ' + name);
    document.querySelector('.qc-strip')?.remove();
    const was = d.t, wasPlaying = d.playing;
    d.pause();
    const strip = document.createElement('section');
    strip.className = 'qc-strip'; strip.dataset.testid = 'qc-strip';
    strip.style.cssText = 'display:flex;gap:6px;overflow:auto;padding:10px;margin:16px 0;background:var(--hz-050);border-radius:8px';
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      d.render(t);
      const cell = document.createElement('div');
      cell.style.cssText = 'flex:none;width:150px';
      const clone = stage.cloneNode(true);
      clone.removeAttribute('data-testid');
      clone.querySelectorAll('[id]').forEach((e) => e.removeAttribute('id'));
      clone.style.cssText += ';width:150px;height:100px;min-height:0';
      copyBitmaps(stage, clone);
      const cap = document.createElement('div');
      cap.style.cssText = 'font:9px var(--mono);color:var(--hz-500);padding-top:4px';
      cap.textContent = 't=' + t.toFixed(2);
      cell.append(clone, cap); strip.append(cell);
    }
    const anchor = document.querySelector('.notes') || stage.closest('section') || stage;
    anchor.before(strip);
    d.render(was); if (wasPlaying) d.play();
    return strip;
  }

  return { clock, filmstrip, copyBitmaps, demos, clockRes, get reduced() { return mq.matches; } };
})();
