<script>
  import ScreenCard from '$lib/ScreenCard.svelte';

  /* The whole page is the device's readout: a big LCD for the hero,
     smaller LCD panels for the index. Same backlit screen as the
     hardware sheets — the app is the instrument, the deck's slides
     are what it displays. */

  const SECTIONS = [
    {
      href: '/design',
      code: 'DS',
      title: 'design system',
      note: 'Methodology, the six treatments, and the live reference: materials, motion, graphic language, layouts.',
      meta: '16 sheets',
      status: 'live',
    },
    {
      href: '/paper',
      code: 'PA',
      title: 'full paper',
      note: 'The complete scope — thesis, content outline, motion craft, accessibility, architecture, risks.',
      meta: '18 sections',
      status: 'live',
    },
    {
      href: '/presentation',
      code: 'PR',
      title: 'presentation',
      note: 'The deck itself, delivered as running code rather than slides. Viewer in progress.',
      meta: '15 slides',
      status: 'in build',
    },
  ];

  const SPECTRUM = ['video', 'css', 'composite', 'svg', 'canvas', 'webgl', 'webgpu'];
</script>

<svelte:head><title>Web Animation &amp; Motion — WAM-2026</title></svelte:head>

<div class="wrap">
  <div class="lcd-panel hero" data-testid="hero-screen">
    <div class="well">
      <div class="lcd">
        <div class="lcd-body hero-body">
          <div class="hero-top">
            <span class="lcd-label">Key Clark · Talk</span>
            <span class="lcd-label">21 Aug 2026</span>
          </div>

          <h1 class="hero-title">web animation<br />&amp; motion</h1>

          <p class="lcd-text hero-dek">
            A tour through web animation and motion, built and delivered as a custom
            interactive app rather than slides — so every example is real, running code
            instead of a screenshot or a description.
          </p>

          <div class="lcd-rule"></div>

          <!-- the instrument strip: key/value readouts, status
               lamps, and the section-tint key — the same furniture
               the T-06 hero carries, because this page IS the
               device's own readout -->
          <div class="lcd-strip hero-foot">
            <span class="lcd-kv"><span class="k">Model</span><span class="v">WAM-2026</span></span>
            <span class="lcd-kv"><span class="k">Slides</span><span class="v">15</span></span>
            <span class="lcd-kv"><span class="k">Spectrum</span><span class="v">video → webgpu</span></span>

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

  <p class="mono index-label">Index</p>
  <div class="cards" data-testid="home-sections">
    {#each SECTIONS as s (s.href)}
      <ScreenCard {...s} testId={`home-card-${s.code.toLowerCase()}`} />
    {/each}
  </div>
</div>

<style>
  .wrap {
    max-width: 1040px; margin: 0 auto; width: 100%;
    padding: calc(var(--u) * 6) calc(var(--u) * 5) calc(var(--u) * 12);
  }

  .hero { margin-bottom: calc(var(--u) * 5); }
  .hero-body { padding: calc(var(--u) * 4) calc(var(--u) * 5); gap: calc(var(--u) * 2); }
  .hero-top { display: flex; align-items: baseline; justify-content: space-between; gap: calc(var(--u) * 2); }
  .hero-foot { margin-top: calc(var(--u) * 1); }
  .lamps { display: flex; gap: 7px; align-items: center; margin-left: auto; padding-bottom: 2px; }

  /* .lcd-title at hero scale, in LCD ink rather than the page's
     greyscale h1 colour */
  .hero-title {
    font-family: var(--dot); font-variation-settings: 'ROND' 0; font-weight: 900;
    font-size: clamp(32px, 6vw, 72px); line-height: 1.02; letter-spacing: 0.005em;
    color: var(--lcd-ink); text-transform: lowercase; margin: calc(var(--u) * 1) 0 0;
  }
  .hero-dek { max-width: 54ch; font-size: 14px; }

  /* the seven section tints, in spectrum order — the colour key the
     deck runs on, stated once on the way in */
  .spectrum { display: flex; gap: 4px; }
  .pip { width: 17px; height: 9px; border-radius: 1px; box-shadow: inset 0 0 0 1px oklch(0.2 0.05 130 / 0.25); }

  .index-label { margin: 0 0 calc(var(--u) * 2); }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: calc(var(--u) * 2.5); }
</style>
