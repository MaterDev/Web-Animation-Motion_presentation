<script>
  /* ONE SHEET VIEWER for every section that shows standalone sheets
     (design reference, techniques). The sheets are standalone HTML served
     from static/sheets/ and shown in an iframe rather than ported to
     Svelte: each is a self-contained document with its own scripts, and
     porting them would mean two copies of every demo. The iframe also
     gives each a clean document scope.

     ?sheet=code rather than #code: the prerenderer validates fragment
     links against real ids, and a query param keeps that check on for
     the paper's contents. Read in an effect because reading
     url.searchParams during prerender throws; it resolves on hydration. */
  import { page } from '$app/state';
  import { indexIn, base } from '$lib/sheets.js';

  /** @type {{ sheets: { code: string, name: string, note?: string, file: string }[], section: string }} */
  let { sheets, section } = $props();

  let activeIndex = $state(0);
  $effect(() => {
    const i = indexIn(sheets, page.url.searchParams.get('sheet'));
    if (i >= 0) activeIndex = i;
  });

  const active = $derived(sheets[activeIndex]);
</script>

<svelte:head><title>{active.name} — {section} — WAM-2026</title></svelte:head>

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
  <!-- `allow` is opt-in per feature and defaults to denied inside an
       iframe, so without it SL-04's camera toggle fails with a
       NotAllowedError that looks identical to the user refusing the
       browser prompt. Scoped to same-origin, which is all the sheets
       ever are. -->
  <iframe
    class="frame"
    src={base(active.file)}
    title={`${active.code} — ${active.name}`}
    allow="camera 'self'"
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
