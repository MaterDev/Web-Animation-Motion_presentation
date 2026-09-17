// @ts-nocheck -- sheet code, copied from design/techniques/video/index.html lines 1316–1615; it was never typed
/* ── chroma key ───────────────────────────────────────────────
   The missing fourth channel, computed per frame.

   Keying on RGB distance is the obvious approach and the wrong one:
   it conflates brightness with colour, so a shadowed fold of the
   backdrop reads as "not green" and survives, while a bright green
   highlight on the subject gets cut away. Separating luma from chroma
   fixes that — the comparison happens in the Cb/Cr plane only, where a
   lit and a shadowed patch of the same backdrop land in the same
   place.

   THE KEY COLOUR IS MEASURED, AND MEASURED IN THE RIGHT PLACE. ffmpeg
   decoding this same file reports the backdrop as rgb(58,216,56); the
   browser's own canvas decode of it reports rgb(48,192,54). That gap
   is limited-range vs full-range YUV — the two disagree about whether
   16-235 should be stretched to 0-255 — and the browser's answer is
   the only one that matters, because the browser is what the keyer
   reads. Sampling the decoded frames in the page gives the number
   above, stable within ~2 points across all ten seconds.

   The histogram says the backdrop lands at 0.012-0.024 and the solid
   body of the subject at ~0.42, with an empty valley between — which
   argues for a threshold around 0.04. The shipped defaults are much
   wider than that, and deliberately: this subject is a stag with a
   glowing corona, drifting particles and motion blur on the legs, and
   all of that lives in the transition band the histogram calls empty.
   A statistically tight key cuts the glow off at a hard line. The
   values here were set against the composite by eye, which is the
   right instrument once the key colour itself is measured.

   Alpha is a ramp, not a test. Anything inside `similarity` is fully
   out; the `softness` band beyond it fades, which is what gives hair
   and motion blur an edge instead of a staircase.

   Spill is the step people skip. Green bounces onto the subject, so
   edge pixels stay greenish even at full alpha and the cut-out reads
   as pasted on. Where green exceeds the red/blue average it is pulled
   back toward that average, weighted by how close the pixel was to
   being keyed — strongest exactly at the fringe.

   Rendered at 360×640 rather than the source 720×1280: a quarter of
   the per-pixel work, and the result is scaled up by the element. */
/* Extraction: the sheet IIFE (1359–1614) is now keyer(root, d). Lookups go
   through the shadow root; listeners, the rAF loop and the observer are
   registered on the disposer `d`. */
export function keyer(root, d) {
  const V = root.getElementById('ckSrc');
  const CV = root.getElementById('ckCanvas');
  const stage = root.getElementById('ckStage');
  if (!V || !CV || !stage) return;

  const cx = CV.getContext('2d', { willReadFrequently: true });
  const W = 360, H = 640;
  CV.width = W; CV.height = H;

  // scratch canvas: the raw decode, before any keying
  const raw = document.createElement('canvas');
  raw.width = W; raw.height = H;
  const rx = raw.getContext('2d', { willReadFrequently: true });

  // second scratch, used only to build a flat-ink silhouette
  const sil = document.createElement('canvas');
  sil.width = W; sil.height = H;
  const sx = sil.getContext('2d');

  /* Duotone done properly: luminance remapped onto a ramp between two
     inks. The CSS approximation this replaces was a stack of
     grayscale/sepia/hue-rotate/saturate, which only ever lands near the
     colours you want and drags the whole element through four filter
     passes. Doing it in the loop that already touches every pixel for
     the key costs one extra multiply per channel and hits the exact
     inks. */
  const DUO_LO = [22, 16, 52], DUO_HI = [255, 216, 128];

  /* A short ring of past KEYED frames. This is the buffer-rack idea
     from the section above, scoped to the subject rather than the whole
     picture: because these frames already carry alpha, a trail drawn
     from them sits behind the animal and in front of the page, which a
     trail built before keying could never do.

     History advances on VIDEO frames, not animation frames. Pushing
     every rAF stores the same decoded picture several times over on a
     60Hz display and makes the trail's length depend on the monitor;
     gating on currentTime gives 14 real frames of a 24fps clip, so the
     echo is ~0.58s everywhere. */
  const NH = 14;
  const hist = Array.from({ length: NH }, () => {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    return { c, x: c.getContext('2d') };
  });
  let hi = 0, lastPush = -1;
  const older = k => hist[(hi - k + NH) % NH].c;

  const KR = 48, KG = 192, KB = 54;   // measured from the browser's decode, not ffmpeg's
  const kY = 0.2126 * KR + 0.7152 * KG + 0.0722 * KB;
  const kCb = KB - kY, kCr = KR - kY;

  let sim = 0.21, soft = 0.20, spill = 0.80, scene = 'float';

  const bind = (id, vid, set) => {
    const el = root.getElementById(id), out = root.getElementById(vid);
    d.on(el, 'input', () => { set(parseFloat(el.value)); out.textContent = (+el.value).toFixed(2); });
  };
  bind('ckSim', 'ckSimV', v => { sim = v; });
  bind('ckSoft', 'ckSoftV', v => { soft = v; });
  bind('ckSpill', 'ckSpillV', v => { spill = v; });

  const caption = root.getElementById('ckCap');
  const CAPS = {
    float:  'keyed · alpha computed per frame',
    type:   'keyed · echo through the first half, then it resolves',
    card:   'keyed · body over the card, legs behind its content',
    duo:    'keyed · duotone in the pixel loop, threaded through a ring',
    knock:  'keyed · punched out of a slab, the cut tearing in slices',
    snow:   'keyed · snow and bokeh in front and behind, subject trailing',
    tick:   'keyed · marquees crossing behind the body and over the legs',
  };
  root.querySelectorAll('.ck-scene').forEach(b => {
    d.on(b, 'click', () => {
      root.querySelectorAll('.ck-scene').forEach(o => o.classList.toggle('is-on', o === b));
      scene = b.dataset.scene;
      stage.dataset.scene = scene;
      caption.textContent = CAPS[scene] || '';
    });
  });

  /* key `raw` into an ImageData with a real alpha channel */
  function key() {
    const duo = scene === 'duo';
    const img = rx.getImageData(0, 0, W, H), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const cb = b - y - kCb, cr = r - y - kCr;
      const dist = Math.sqrt(cb * cb + cr * cr) / 255;
      let a = (dist - sim) / soft;
      a = a < 0 ? 0 : a > 1 ? 1 : a;
      if (a === 0) { d[i + 3] = 0; continue; }
      if (spill > 0) {
        const m = (r + b) * 0.5;
        if (g > m) d[i + 1] = g - (g - m) * spill * (1 - a * 0.55);
      }
      d[i + 3] = a * 255;
      if (duo) {
        const l = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
        d[i]     = DUO_LO[0] + (DUO_HI[0] - DUO_LO[0]) * l;
        d[i + 1] = DUO_LO[1] + (DUO_HI[1] - DUO_LO[1]) * l;
        d[i + 2] = DUO_LO[2] + (DUO_HI[2] - DUO_LO[2]) * l;
      }
    }
    return img;
  }

  /* Two fields of flakes, seeded deterministically. Math.random() here
     would reshuffle the weather on every reload, which makes the scene
     impossible to compare against itself between runs. */
  function seedSnow(host, count, seed) {
    if (!host) return;
    let x = seed;
    const rnd = () => (x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let i = 0; i < count; i++) {
      const f = document.createElement('i');
      f.className = 'ck-flake';
      f.style.left = (rnd() * 100).toFixed(2) + '%';
      f.style.animationDuration = (5 + rnd() * 7).toFixed(2) + 's';
      f.style.animationDelay = (-rnd() * 12).toFixed(2) + 's';
      host.appendChild(f);
    }
  }
  seedSnow(root.getElementById('ckSnowB'), 26, 8191);
  seedSnow(root.getElementById('ckSnowF'), 12, 5077);

  /* Warm bulbs, seeded the same deterministic way. Weighted toward the
     upper half so they read as strung up rather than scattered. */
  const BULBS = ['oklch(0.86 0.17 78)', 'oklch(0.64 0.21 26)',
                 'oklch(0.72 0.16 152)', 'oklch(0.90 0.09 92)'];
  function seedLights(host, count, seed) {
    if (!host) return;
    let x = seed;
    const rnd = () => (x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let i = 0; i < count; i++) {
      const b = document.createElement('i');
      b.className = 'ck-bulb';
      b.style.left = (rnd() * 100).toFixed(2) + '%';
      b.style.top = (rnd() * 68).toFixed(2) + '%';
      b.style.background = BULBS[(rnd() * BULBS.length) | 0];
      b.style.animationDelay = (-rnd() * 4).toFixed(2) + 's';
      b.style.animationDuration = (2.8 + rnd() * 2.4).toFixed(2) + 's';
      host.appendChild(b);
    }
  }
  seedLights(root.getElementById('ckBokehB'), 16, 3301);
  seedLights(root.getElementById('ckBokehF'), 7, 9973);

  let rafId = 0;
  const t0 = performance.now();
  function frame() {
    if (V.readyState >= 2) {
      rx.drawImage(V, 0, 0, W, H);
      const img = key();
      const t = (performance.now() - t0) / 1000;
      if (V.currentTime !== lastPush) {
        lastPush = V.currentTime;
        hi = (hi + 1) % NH;
        hist[hi].x.clearRect(0, 0, W, H);
        hist[hi].x.putImageData(img, 0, 0);
      }
      cx.clearRect(0, 0, W, H);
      if (scene === 'duo') {
        /* Screen-print misregistration: the same alpha, filled flat in a
           second ink and offset a few pixels behind the plate. It reads
           as a print artefact rather than a drop shadow because it
           follows the silhouette exactly — antlers, legs, the gap under
           the belly — which is only true because the alpha is real.
           putImageData ignores the transform stack, so the frame goes
           via drawImage to be offset at all. */
        rx.putImageData(img, 0, 0);
        sx.clearRect(0, 0, W, H);
        sx.globalCompositeOperation = 'source-over';
        sx.drawImage(raw, 0, 0);
        sx.globalCompositeOperation = 'source-in';
        sx.fillStyle = 'rgb(255,64,122)';
        sx.fillRect(0, 0, W, H);
        cx.globalAlpha = 0.6;
        cx.drawImage(sil, -8, 7);
        // two older plates behind the current one — a print that smears
        cx.globalAlpha = 0.20; cx.drawImage(older(4), 0, 0);
        cx.globalAlpha = 0.30; cx.drawImage(older(2), 0, 0);
        cx.globalAlpha = 1;
        cx.drawImage(raw, 0, 0);
      } else if (scene === 'knock') {
        /* Paint a slab, then remove the subject from it. destination-out
           keeps the destination only where the incoming pixel is
           TRANSPARENT, so the animal becomes a hole and the layers the
           page put behind the canvas show through it. The stencil has
           the same soft edge the matte does, because it is the matte. */
        rx.putImageData(img, 0, 0);
        cx.fillStyle = 'rgb(14,15,20)';
        cx.fillRect(0, 0, W, H);
        cx.globalCompositeOperation = 'destination-out';
        cx.drawImage(raw, 0, 0);                 // the clean cut
        /* then tear a few slices sideways and punch those too. Quantised
           to ~7 changes a second and re-seeded from that step, so the
           displacement HOLDS and then jumps — a sine swept across the
           same bands reads as a wobble, which is the opposite of a
           glitch. Deterministic per step, so it never flickers within a
           held frame. */
        let r = (Math.floor(t * 7) * 2654435761) & 0x7fffffff;
        const rnd = () => (r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
        for (let i = 0; i < 3; i++) {
          const y = (rnd() * H) | 0;
          const h = 8 + ((rnd() * 26) | 0);
          const dx = (rnd() * 2 - 1) * 24;
          cx.drawImage(raw, 0, y, W, h, dx, y, W, h);
        }
        cx.globalCompositeOperation = 'source-over';
      } else if (scene === 'type') {
        /* A delayed copy of the subject, held at full strength through
           the first half of the clip and eased away across the second —
           so the scene arrives busy and resolves to a clean cut by the
           loop point, then starts over. The fade is driven by
           currentTime rather than a wall clock, so it stays locked to
           the footage however long the page has been open. */
        rx.putImageData(img, 0, 0);
        const dur = V.duration || 10;
        const u = dur ? (V.currentTime % dur) / dur : 0;
        const lin = u < 0.5 ? 1 : Math.max(0, 1 - (u - 0.5) / 0.42);
        const k = lin * lin * (3 - 2 * lin);       // smoothstep the tail off
        if (k > 0.01) {
          cx.globalAlpha = 0.30 * k; cx.drawImage(older(12), 0, 0);
          cx.globalAlpha = 0.44 * k; cx.drawImage(older(6), 0, 0);
        }
        cx.globalAlpha = 1;
        cx.drawImage(raw, 0, 0);
      } else if (scene === 'snow') {
        // a cold ghost off the same history ring — trailing, not blurred
        rx.putImageData(img, 0, 0);
        cx.globalAlpha = 0.13; cx.drawImage(older(5), 0, 0);
        cx.globalAlpha = 0.22; cx.drawImage(older(3), 0, 0);
        cx.globalAlpha = 1;
        cx.drawImage(raw, 0, 0);
      } else {
        cx.putImageData(img, 0, 0);
      }

    }
    rafId = requestAnimationFrame(frame);
  }
  frame();

  /* nothing to key while the element is off screen; a 360×640 read-back
     every frame is real work to be doing for a section nobody is looking at */
  if ('IntersectionObserver' in window) {
    d.observer(new IntersectionObserver((es) => {
      es.forEach(e => {
        if (e.isIntersecting) { V.play().catch(() => {}); if (!rafId) frame(); }
        else { V.pause(); cancelAnimationFrame(rafId); rafId = 0; }
      });
    }, { rootMargin: '120px' })).observe(stage);
  }

  /* extraction: teardown the sheet never needed */
  d.add(() => { cancelAnimationFrame(rafId); rafId = 0; V.pause(); V.querySelectorAll('source').forEach(s => s.remove()); V.load(); });
}
