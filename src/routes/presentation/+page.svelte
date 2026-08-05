<script>
  /* Placeholder. The viewer is the next build phase — see the paper's
     Technical Approach and Build Order. Kept as a real route rather
     than a nav item that goes nowhere, so the shape of the site is
     visible and the link is shareable from day one. */
  const PLANNED = [
    { k: 'Navigation', v: 'Keyboard forward/back, one route per slide for deep-linking during rehearsal' },
    { k: 'Fullscreen', v: 'Native Fullscreen API' },
    { k: 'Speaker view', v: 'Second window, current + next + notes, synced over BroadcastChannel' },
    { k: 'Transitions', v: 'Layout animation — three candidates still being prototyped, see the paper' },
    { k: 'Demos', v: 'Mounted only while their slide is active, to stay under the WebGL context cap' },
  ];
</script>

<svelte:head><title>Presentation — WAM-2026</title></svelte:head>

<div class="wrap">
  <p class="kicker">Presentation · Viewer</p>
  <h1>not built yet</h1>
  <p class="dek">
    The deck itself — 15 slides, each demo real running code rather than a recording. The
    design system it will be built from is <a href="/design">done and documented</a>; this is
    the next phase. Talk is 21 August 2026.
  </p>

  <div class="planned" data-testid="planned-list">
    {#each PLANNED as p (p.k)}
      <div class="row">
        <span class="k">{p.k}</span>
        <span class="v">{p.v}</span>
      </div>
    {/each}
  </div>

  <div class="note warn">
    <b>Why this is a route and not a redirect.</b> The link needs to be stable and
    shareable now — the site is how this work gets shown to people while it's in progress,
    so a nav item that 404s or bounces somewhere else is worse than one that honestly says
    what's coming.
  </div>
</div>

<style>
  .wrap { max-width: 860px; margin: 0 auto; padding: calc(var(--u) * 9) calc(var(--u) * 5) calc(var(--u) * 14); width: 100%; }
  .kicker {
    font-family: var(--mono); font-size: 10px; letter-spacing: 0.2em;
    text-transform: uppercase; color: var(--hz-400); margin: 0 0 calc(var(--u) * 2);
  }
  h1 { margin-bottom: calc(var(--u) * 3); }
  .dek { color: var(--hz-500); font-size: 15px; max-width: 58ch; margin: 0 0 calc(var(--u) * 6); }

  .planned { margin-bottom: calc(var(--u) * 4); }
  .row {
    display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: calc(var(--u) * 2);
    padding: 12px 0; border-bottom: var(--hair) solid var(--hz-300);
  }
  .k { font-family: var(--mono); font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--hz-500); padding-top: 2px; }
  .v { font-size: 13.5px; color: var(--hz-600); line-height: 1.65; }

  @media (max-width: 640px) { .row { grid-template-columns: 1fr; gap: 4px; } }
</style>
