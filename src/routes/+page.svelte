<script>
  import ScreenCard from '$lib/ScreenCard.svelte';

  /* The hero is a screen, not a headline on a page. Same
     .screen-unit / .screen-face the sheets and the cards use, with
     the LED type scale inside it — so the first thing you see is the
     system rather than a description of it. */

  const SECTIONS = [
    {
      href: '/design',
      code: 'DS',
      title: 'design system',
      note: 'Methodology, the six treatments, and the live reference: materials, motion, graphic language, layouts.',
    },
    {
      href: '/paper',
      code: 'PA',
      title: 'full paper',
      note: 'The complete scope — thesis, content outline, motion craft, accessibility, architecture, risks.',
    },
    {
      href: '/presentation',
      code: 'PR',
      title: 'presentation',
      note: 'The deck itself, delivered as running code rather than slides. Viewer in progress.',
    },
  ];
</script>

<svelte:head><title>Web Animation &amp; Motion — WAM-2026</title></svelte:head>

<div class="wrap">
  <div class="screen-unit hero" data-testid="hero-screen">
    <div class="screen-face">
      <div class="screen-content hero-body">
        <div class="led-chrome-row">
          <span class="led-micro">Folklore · Talk</span>
          <span class="led-micro">21 Aug 2026</span>
        </div>

        <h1 class="hero-title">web animation<br />&amp; motion</h1>

        <p class="led-body hero-dek">
          A tour through web animation and motion, built and delivered as a custom
          interactive app rather than slides — so every example is real, running code
          instead of a screenshot or a description.
        </p>

        <div class="led-chrome-row foot">
          <span class="led-micro">15 slides · video → webgpu</span>
          <span class="spectrum" aria-hidden="true">
            {#each ['video', 'css', 'composite', 'svg', 'canvas', 'webgl', 'webgpu'] as t (t)}
              <span class="pip" style={`background: var(--tint-${t})`}></span>
            {/each}
          </span>
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

  .hero { margin-bottom: calc(var(--u) * 6); }
  .hero-body { padding: calc(var(--u) * 4) calc(var(--u) * 5) calc(var(--u) * 4); }

  .led-chrome-row { display: flex; align-items: baseline; justify-content: space-between; gap: calc(var(--u) * 2); }
  .led-chrome-row.foot { margin-top: calc(var(--u) * 4); }

  /* Doto at display scale — the screen's own type, matching
     .screen-face h1 in components.css but tightened for a wide hero */
  .hero-title {
    margin: calc(var(--u) * 3) 0 calc(var(--u) * 2.5);
    color: var(--led-ink);
    font-size: clamp(34px, 6.4vw, 76px);
  }

  .hero-dek { max-width: 56ch; }

  /* the seven section tints, in spectrum order — the colour key the
     whole deck runs on, stated once on the way in */
  .spectrum { display: flex; gap: 4px; }
  .pip { width: 16px; height: 8px; border-radius: 1px; }

  .index-label { margin: 0 0 calc(var(--u) * 2); }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: calc(var(--u) * 2.5); }
</style>
