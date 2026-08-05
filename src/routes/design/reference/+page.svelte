<script>
  import { page } from '$app/state';
  import { VIEWABLE, indexFor, base } from '$lib/sheets.js';

  /* The sheets are served as standalone HTML from static/sheets/ and
     shown in an iframe rather than ported to Svelte components. That
     is deliberate: each is a self-contained document with its own
     scripts (canvas renderers, a WebGL scene, a WebGPU device init,
     an Anime.js layout timeline). Porting them would mean maintaining
     two copies of every demo, and the point of the harness is that it
     is the real thing.

     The iframe also gives each sheet a clean document scope, which
     stops sixteen pages' worth of global scripts and id lookups from
     colliding — matching DESIGN.md §3.4's isolation note.

     The sheet list now lives in the section layout's sidebar, so this
     route is only the viewer. */

  /* ?sheet=lay rather than #lay: the prerenderer validates fragment
     links against real element ids, and #lay is view state, not an
     anchor. Suppressing that check would also have disabled it for
     the paper's table of contents, where the anchors ARE real ids —
     and where it caught a genuine bug. A query param keeps it on.

     Read in an effect rather than derived, because reading
     url.searchParams during prerender throws: a prerendered page has
     to be byte-identical whatever query string requests it. Effects
     don't run during prerender, so this resolves on hydration, and
     re-runs on back/forward for free. */
  let activeIndex = $state(0);

  $effect(() => {
    const i = indexFor(page.url.searchParams.get('sheet'));
    if (i >= 0) activeIndex = i;
  });

  const active = $derived(VIEWABLE[activeIndex]);
</script>

<svelte:head><title>{active.name} — Design Reference — WAM-2026</title></svelte:head>

<div class="viewer">
  <div class="bar">
    <span class="bar-title" data-testid="reference-title">
      <span class="bar-code">{active.code}</span>{active.name}
    </span>
    <span class="bar-note">{active.note}</span>
    <a class="ibtn" href={base(active.file)} target="_blank" rel="noopener" data-testid="reference-popout">
      Open standalone ↗
    </a>
  </div>

  <!-- title so the sheet is announced rather than being an
       unlabelled embedded document -->
  <iframe
    class="frame"
    src={base(active.file)}
    title={`${active.code} — ${active.name}`}
    data-testid="reference-frame"
  ></iframe>
</div>

<style>
  .viewer { display: flex; flex-direction: column; min-width: 0; flex: 1 1 auto; }

  .bar {
    display: flex; align-items: center; gap: calc(var(--u) * 2);
    padding: 0 calc(var(--u) * 2); height: 44px; flex: none;
    border-bottom: var(--hair) solid var(--hz-300);
    background: var(--hz-050);
    position: sticky; top: 52px; z-index: 5;
  }
  .bar-title {
    display: flex; align-items: baseline; gap: 10px; flex: none;
    font-size: 13px; color: var(--hz-700); text-transform: lowercase;
  }
  .bar-code {
    font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.14em;
    color: var(--hz-400); text-transform: uppercase;
  }
  .bar-note {
    flex: 1 1 auto; min-width: 0;
    font-family: var(--mono); font-size: 9px; letter-spacing: 0.1em; color: var(--hz-400);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }

  /* the sheets are long documents; giving the iframe the remaining
     viewport height and letting it scroll internally keeps the app
     chrome and the sidebar fixed, so you never lose them mid-sheet */
  .frame { width: 100%; height: calc(100vh - 52px - 44px); border: 0; display: block; background: var(--hz-000); }

  @media (max-width: 980px) { .frame { height: 72vh; } }
</style>
