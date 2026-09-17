<script>
  import { SLIDES } from '$lib/deck/slides.js';
  import { SHEETS } from '$lib/sheets.js';

  let { data } = $props();

  /* The whole page is the device's readout: one LCD, and the index
     lives on it. The sections are regions of the screen rather than
     cards under it, because the app is the instrument and everything
     it offers is something the display shows. */

  /* same order as the top nav: the talk first, the reference behind it */
  const SECTIONS = $derived([
    {
      href: '/paper',
      code: 'PA',
      tint: 'var(--tint-canvas)',
      title: 'full paper',
      /* no topic list here: the readout below is generated from the
         paper's own headings, and a hand-written summary would be the
         one part of this card that drifts when the paper is restructured */
      note: 'The paper the talk is built on — the argument every slide defers to.',
      meta: `${data.paperSections.length} sections`,
      status: 'live',
    },
    {
      href: '/presentation',
      code: 'PR',
      tint: 'var(--tint-webgpu)',
      title: 'presentation',
      note: 'The deck itself, delivered as running code rather than slides, with speaker notes per slide.',
      meta: `${SLIDES.length} slides`,
      status: 'in build',
    },
    {
      href: '/design',
      code: 'DS',
      tint: 'var(--tint-css)',
      title: 'design system',
      note: 'Methodology, the six treatments, and the live reference: materials, motion, graphic language, layouts.',
      meta: `${SHEETS.length} sheets`,
      status: 'live',
    },
  ]);

  /* the talk's comprehension ladder, not the old cost order: CSS first,
     the graphics card last, composite as the close (GIF shares video's tint) */
  const SPECTRUM = ['css', 'svg', 'video', 'canvas', 'webgl', 'webgpu', 'composite'];

  /* The paper readout holds at most ten lines and never scrolls. Past
     ten sections it shows the first nine and spends the tenth line
     saying how many more there are, so the region's height is capped
     without hiding that the list continues. */
  const READOUT_LINES = 10;
  const readout = $derived.by(() => {
    const all = data.paperSections;
    const shown = all.length > READOUT_LINES ? all.slice(0, READOUT_LINES - 1) : all;
    return { shown, more: all.length - shown.length };
  });
</script>

<svelte:head><title>Web Animation &amp; Motion — WAM-2026</title></svelte:head>

<div class="wrap">
  <div class="lcd-panel hero" data-testid="hero-screen">
    <div class="well">
      <div class="lcd">
        <div class="lcd-body hero-body">
          <div class="hero-top">
            <span class="lcd-label">Key Clark · Talk</span>
            <span class="lcd-label">17 Sep 2026</span>
          </div>

          <h1 class="hero-title">web animation<br />&amp; motion</h1>

          <p class="lcd-text hero-dek">
            A tour through web animation and motion, built and delivered as a custom
            interactive app rather than slides — so every example is real, running code
            instead of a screenshot or a description.
          </p>

          <div class="lcd-rule"></div>

          <!-- The index, drawn on the screen. Regions of one display,
               not cards: hairline ink frames, dot type, and each
               region's backlight cast in its section tint so the three
               read apart without leaving the LCD's palette. The paper
               leads, large, on the left; the other two stack beside
               it. -->
          <span class="lcd-label ix-label">Index</span>
          <nav class="ix-grid" aria-label="Index" data-testid="home-sections">
            {#each SECTIONS as s, i (s.href)}
              {@const id = `home-card-${s.code.toLowerCase()}`}
              <a class="ix" class:ix-feature={i === 0} href={s.href} style={`--ct:${s.tint}`} data-testid={id}>
                <span class="ix-cast" aria-hidden="true"></span>
                {#if i === 0}<span class="ix-scan" aria-hidden="true"></span>{/if}

                <span class="ix-top">
                  <span class="ix-code">{s.code}</span>
                  <span class="ix-meta">{s.meta}</span>
                </span>

                <span class="ix-title" data-testid={`${id}-title`}>{s.title}</span>
                <span class="ix-note">{s.note}</span>

                {#if i === 0}
                  <!-- the paper's sections as a readout: each bar fills
                       on the system's one ambient curve (.liquid-fill,
                       --ease-liquid), staggered into a slow wave. All
                       CSS, so the global reduced-motion rule stops it;
                       bars rest full and the scan rests off-screen, so
                       the still frame is complete. -->
                  <span class="ix-readout" data-testid={`${id}-readout`}>
                    {#each readout.shown as sec, n (sec.id)}
                      <span class="ix-row" data-testid={`${id}-readout-${sec.id}`}>
                        <span class="ix-idx">§{String(n + 1).padStart(2, '0')}</span>
                        <span class="ix-name">{sec.title}</span>
                        <span class="ix-track" aria-hidden="true">
                          <span class="ix-bar liquid-fill" style={`animation-delay: ${-n * 0.55}s`}></span>
                        </span>
                      </span>
                    {/each}
                    {#if readout.more}
                      <span class="ix-row ix-more" data-testid={`${id}-readout-more`}>
                        <span class="ix-idx">…</span>
                        <span class="ix-name">+{readout.more} more</span>
                      </span>
                    {/if}
                  </span>
                {/if}

                <span class="ix-foot">
                  <span class="led" style="--c:var(--ok)" aria-hidden="true"></span>
                  <span class="ix-status">{s.status}</span>
                </span>
              </a>
            {/each}
          </nav>

          <div class="lcd-rule"></div>

          <!-- the instrument strip: key/value readouts, status
               lamps, and the section-tint key — the same furniture
               the T-06 hero carries, because this page IS the
               device's own readout -->
          <div class="lcd-strip hero-foot">
            <span class="lcd-kv"><span class="k">Model</span><span class="v">WAM-2026</span></span>
            <span class="lcd-kv"><span class="k">Slides</span><span class="v">{SLIDES.length}</span></span>
            <span class="lcd-kv"><span class="k">Ladder</span><span class="v">css → webgpu</span></span>

            <span class="lamps" aria-hidden="true">
              <span class="led" style="--c:var(--ok)"></span>
              <span class="led" style="--c:var(--tint)"></span>
              <span class="led off" style="--c:var(--signal)"></span>
            </span>

            <span class="spectrum" aria-hidden="true">
              {#each SPECTRUM as t (t)}
                <span class="pip" style={`background: var(--tint-${t})`}></span>
              {/each}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .wrap {
    max-width: 1040px; margin: 0 auto; width: 100%;
    padding: calc(var(--u) * 6) calc(var(--u) * 5) calc(var(--u) * 12);
  }

  .hero-body { padding: calc(var(--u) * 4) calc(var(--u) * 5); gap: calc(var(--u) * 2); }
  .hero-top { display: flex; align-items: baseline; justify-content: space-between; gap: calc(var(--u) * 2); }
  /* the system's 9px dim label disappears at hero scale under the
     glare — same correction the paper's front panel got */
  .hero-body > .hero-top .lcd-label, .ix-label { font-size: 12.5px; letter-spacing: 0.14em; color: var(--lcd-ink); }
  .hero-foot { margin-top: calc(var(--u) * 1); gap: calc(var(--u) * 6); }
  .hero-foot .lcd-kv { gap: 6px; }
  .hero-foot .k { font-size: 13px; font-weight: 900; letter-spacing: 0.12em; color: var(--lcd-ink); }
  .hero-foot .v { font-size: 22px; font-weight: 900; }
  .lamps { display: flex; gap: 7px; align-items: center; margin-left: auto; padding-bottom: 2px; }

  /* .lcd-title at hero scale, in LCD ink rather than the page's
     greyscale h1 colour */
  .hero-title {
    font-family: var(--dot); font-variation-settings: 'ROND' 0; font-weight: 900;
    font-size: clamp(32px, 6vw, 72px); line-height: 1.02; letter-spacing: 0.005em;
    color: var(--lcd-ink); text-transform: lowercase; margin: calc(var(--u) * 1) 0 0;
  }
  /* Readability under the pixel grid — the /paper front panel's
     correction, applied to the whole screen: the grid and glare eat
     dimmed, light-weight text, so everything on this display is full
     LCD ink, a size up, and a weight heavier than the system default. */
  .hero-dek { max-width: 58ch; font-size: 16px; line-height: 1.6; font-weight: 500; color: var(--lcd-ink); }

  /* the seven section tints, in spectrum order — the colour key the
     deck runs on, stated once on the way in */
  .spectrum { display: flex; gap: 4px; }
  .pip { width: 17px; height: 9px; border-radius: 1px; box-shadow: inset 0 0 0 1px oklch(0.2 0.05 130 / 0.25); }

  /* ── index, on the screen ── */
  .ix-grid {
    display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(0, 1fr);
    gap: calc(var(--u) * 2);
  }
  .ix-feature { grid-row: span 2; }

  /* a region of the display: flat, emissive, framed in ink. Screen
     content follows the screen's rules — no lift, no shadow, no
     material; hover deepens the cast rather than moving anything */
  .ix {
    position: relative; overflow: hidden; display: flex; flex-direction: column; gap: 9px;
    padding: calc(var(--u) * 2.25) calc(var(--u) * 2.5);
    border-radius: 2px; text-decoration: none; color: var(--lcd-ink);
    box-shadow: inset 0 0 0 var(--hair) var(--lcd-rule);
    transition: box-shadow var(--dur-fast) var(--ease-standard);
  }
  .ix:hover { box-shadow: inset 0 0 0 1px var(--lcd-ink); }
  .ix:focus-visible { outline: 2px solid var(--lcd-ink); outline-offset: 2px; }

  /* the section tint as a cast on the backlight — translucent, so
     the green ground and its pixel grid still read through */
  .ix-cast {
    position: absolute; inset: 0; pointer-events: none;
    background: color-mix(in oklch, var(--ct) 26%, transparent);
    transition: background var(--dur-fast) var(--ease-standard);
  }
  .ix:hover .ix-cast { background: color-mix(in oklch, var(--ct) 40%, transparent); }
  .ix > :not(.ix-cast):not(.ix-scan) { position: relative; }

  .ix-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  /* the code as an inverted segment block: ink ground, backlight
     letters — how a monochrome display draws a tag */
  .ix-code {
    font-family: var(--dot); font-variation-settings: 'ROND' 0; font-weight: 900;
    font-size: 12px; letter-spacing: 0.1em; line-height: 1;
    color: var(--lcd-ground-top); background: var(--lcd-ink);
    padding: 4px 6px 3px; border-radius: 1px;
  }
  .ix-meta, .ix-status {
    font-family: var(--dot); font-variation-settings: 'ROND' 0; font-weight: 700;
    font-size: 12px; font-weight: 900; letter-spacing: 0.12em; text-transform: uppercase; color: var(--lcd-ink);
  }
  .ix-title {
    font-family: var(--dot); font-variation-settings: 'ROND' 0; font-weight: 900;
    font-size: 26px; line-height: 1.08; letter-spacing: 0.01em;
    color: var(--lcd-ink); text-transform: lowercase;
  }
  .ix-note { font-size: 15px; line-height: 1.55; font-weight: 500; color: var(--lcd-ink); }
  .ix-foot { display: flex; align-items: center; gap: 8px; margin-top: auto; padding-top: 4px; }

  .ix-feature { padding: calc(var(--u) * 3.5) calc(var(--u) * 4); gap: calc(var(--u) * 1.75); }
  .ix-feature .ix-title { font-size: clamp(30px, 4vw, 48px); line-height: 1.02; }
  .ix-feature .ix-note { font-size: 16.5px; max-width: 48ch; }

  /* ── paper readout ── */
  /* Never scrolls in either axis: the line cap lives in the markup
     (READOUT_LINES), titles truncate with an ellipsis, and overflow is
     clipped as a guard rather than relied on. Row height is pinned so
     the region grows in whole lines. */
  .ix-readout {
    --ix-row: 17px; --ix-gap: 9px;
    display: flex; flex-direction: column; gap: var(--ix-gap);
    overflow: hidden;
    padding: calc(var(--u) * 1.75) 0; margin: calc(var(--u) * 0.5) 0;
    border-top: var(--hair) solid var(--lcd-rule); border-bottom: var(--hair) solid var(--lcd-rule);
  }
  .ix-row { flex: none; height: var(--ix-row); display: grid; grid-template-columns: 38px minmax(0, 1fr) 18%; align-items: center; gap: 12px; }
  .ix-idx, .ix-name {
    font-family: var(--dot); font-variation-settings: 'ROND' 0; font-weight: 900;
    font-size: 14px; line-height: var(--ix-row); letter-spacing: 0.01em; color: var(--lcd-ink);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .ix-idx { opacity: 0.72; }
  .ix-name { text-transform: lowercase; }
  .ix-more { grid-template-columns: 38px minmax(0, 1fr); }
  .ix-more .ix-name { opacity: 0.72; }
  /* overflow hidden: --ease-liquid overshoots by design, so a bar
     briefly runs past 100% — clipped here, it reads as the fill
     pressing the end of its track instead of widening the readout */
  .ix-track { height: 8px; border-radius: 1px; overflow: hidden; background: color-mix(in oklch, var(--lcd-ink) 14%, transparent); }
  /* width 100% is the rest state reduced motion lands on; the loop
     is slowed from the system's 1.6s so six bars read as ambient,
     not busy */
  .ix-bar {
    display: block; height: 100%; width: 100%; border-radius: 1px;
    background: var(--lcd-ink); opacity: 0.8;
    animation-duration: 3.4s;
  }
  .ix-scan {
    position: absolute; left: 0; right: 0; top: 100%; height: 40%; pointer-events: none;
    background: linear-gradient(oklch(1 0 0 / 0), oklch(1 0 0 / 0.14), oklch(1 0 0 / 0));
    animation: ixScan 7s linear infinite;
  }
  @keyframes ixScan { 0% { top: -40%; } 100% { top: 100%; } }

  @media (max-width: 760px) {
    .ix-grid { grid-template-columns: 1fr; }
    .ix-feature { grid-row: auto; }
    /* on a phone the paper region is a link, not a table of contents:
       the readout and its scan are desktop furniture */
    .ix-readout, .ix-scan { display: none; }
  }
</style>
