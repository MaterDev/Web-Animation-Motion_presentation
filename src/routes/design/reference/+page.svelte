<script>
  import { SHEETS, base } from '$lib/sheets.js';

  /* The sheets are served as standalone HTML from static/sheets/ and
     shown in an iframe rather than ported to Svelte components. That
     is deliberate, not a shortcut: each sheet is a self-contained
     document with its own scripts (canvas renderers, a WebGL scene, a
     WebGPU device init, an Anime.js layout timeline). Porting them
     would mean maintaining two copies of every demo, and the whole
     point of the harness is that it is the real thing.

     The iframe also gives each sheet a clean document scope, which is
     what stops fifteen pages' worth of global scripts and id-based
     lookups from colliding — and matches DESIGN.md §3.4's isolation
     note for demos that need harder separation. */

  import { page } from '$app/state';
  import { replaceState } from '$app/navigation';

  /* ?sheet=lay rather than #lay, so a sheet is linkable without
     misusing a fragment. The first version used a hash — the pattern
     the standalone hub uses — and the prerenderer rejected it,
     correctly: it validates fragment links against real element ids,
     and #lay is view state, not an anchor. Suppressing that check
     globally would also have disabled it for the paper's table of
     contents, where the anchors ARE real ids and worth validating.
     A query param keeps that check switched on. */
  /** @param {string | null | undefined} code */
  const indexFor = (code) =>
    SHEETS.findIndex((s) => s.code.toLowerCase() === String(code ?? '').toLowerCase());

  /* Local state, synced FROM the url in an effect, rather than
     derived directly off it. Deriving was the obvious shape and it
     fails the build: reading url.searchParams during prerender
     throws, because a prerendered page has to be byte-identical
     whatever query string it's requested with. Effects don't run
     during prerender, so this reads the param only in the browser —
     the page prerenders showing the first sheet, then corrects on
     hydration if a sheet was requested.

     The effect also covers back/forward for free, since page.url is
     reactive and this re-runs when it changes. */
  let activeIndex = $state(0);

  $effect(() => {
    const i = indexFor(page.url.searchParams.get('sheet'));
    if (i >= 0) activeIndex = i;
  });

  const active = $derived(SHEETS[activeIndex]);
  const groups = $derived([...new Set(SHEETS.map((s) => s.group))]);

  /** @param {number} i */
  function select(i) {
    activeIndex = i;
    const url = new URL(page.url);
    url.searchParams.set('sheet', SHEETS[i].code.toLowerCase());
    replaceState(url, {});
  }
</script>

<svelte:head><title>{active.name} — Design Reference — WAM-2026</title></svelte:head>

<div class="ref">
  <aside class="side" data-testid="reference-sidebar">
    <a class="back" href="/design">← Methodology</a>
    {#each groups as g (g)}
      <p class="grp">{g}</p>
      {#each SHEETS as s, i (s.code)}
        {#if s.group === g}
          <button
            type="button"
            class="item"
            class:active={i === activeIndex}
            style={s.tint ? `--ct:${s.tint}` : ''}
            aria-current={i === activeIndex ? 'true' : undefined}
            onclick={() => select(i)}
            data-testid={`sheet-${s.code.toLowerCase()}`}
          >
            <span class="item-code">{s.code}</span>
            <span class="item-name">{s.name}</span>
            <span class="item-note">{s.note}</span>
          </button>
        {/if}
      {/each}
    {/each}
  </aside>

  <div class="stage">
    <div class="bar">
      <span class="bar-title" data-testid="reference-title">
        <span class="bar-code">{active.code}</span>{active.name}
      </span>
      <a class="ibtn" href={base(active.file)} target="_blank" rel="noopener" data-testid="reference-popout">
        Open standalone ↗
      </a>
    </div>
    <!-- title on the iframe so the sheet is announced rather than
         being an unlabelled embedded document -->
    <iframe
      class="frame"
      src={base(active.file)}
      title={`${active.code} — ${active.name}`}
      data-testid="reference-frame"
    ></iframe>
  </div>
</div>

<style>
  .ref { display: grid; grid-template-columns: 272px minmax(0, 1fr); flex: 1 1 auto; min-height: 0; }

  .side {
    display: flex; flex-direction: column; gap: 2px;
    padding: calc(var(--u) * 2) calc(var(--u) * 1.5) calc(var(--u) * 4);
    background: var(--hz-050);
    border-right: var(--hair) solid var(--hz-300);
    overflow-y: auto;
    height: calc(100vh - 52px); position: sticky; top: 52px;
  }
  .back {
    font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.14em;
    text-transform: uppercase; color: var(--hz-500); text-decoration: none;
    padding: 8px calc(var(--u) * 1.5); margin-bottom: calc(var(--u) * 1);
  }
  .back:hover { color: var(--tint); }
  .grp {
    font-family: var(--mono); font-size: 9px; letter-spacing: 0.18em;
    text-transform: uppercase; color: var(--hz-400);
    margin: calc(var(--u) * 2.5) 0 calc(var(--u) * 1); padding: 0 calc(var(--u) * 1.5);
  }

  .item {
    display: grid; grid-template-columns: 42px minmax(0, 1fr); gap: 4px 10px;
    text-align: left; border: 0; cursor: pointer; width: 100%;
    padding: 9px calc(var(--u) * 1.5); border-radius: 4px; background: transparent;
    transition: background var(--dur-fast) var(--ease-standard);
  }
  .item:hover { background: var(--hz-100); }
  .item:focus-visible { outline: 2px solid var(--tint); outline-offset: -2px; }
  .item-code {
    font-family: var(--mono); font-size: 9px; letter-spacing: 0.1em;
    color: var(--ct, var(--hz-400)); padding-top: 2px;
  }
  .item-name { font-size: 13.5px; color: var(--hz-700); }
  .item-note {
    grid-column: 2; font-family: var(--mono); font-size: 9px; line-height: 1.5;
    color: var(--hz-400);
  }
  .item.active { background: color-mix(in oklch, var(--ct, var(--tint)) 16%, var(--hz-100)); }
  .item.active .item-name { color: var(--hz-900); }

  .stage { display: flex; flex-direction: column; min-width: 0; }
  .bar {
    display: flex; align-items: center; justify-content: space-between; gap: calc(var(--u) * 2);
    padding: 0 calc(var(--u) * 2); height: 44px; flex: none;
    border-bottom: var(--hair) solid var(--hz-300);
    background: var(--hz-050);
    position: sticky; top: 52px; z-index: 5;
  }
  .bar-title {
    display: flex; align-items: baseline; gap: 10px;
    font-size: 13px; color: var(--hz-700); text-transform: lowercase;
  }
  .bar-code {
    font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.14em;
    color: var(--hz-400); text-transform: uppercase;
  }

  /* The sheets are long documents; giving the iframe the remaining
     viewport height and letting it scroll internally keeps the app
     chrome fixed, so you never lose the sidebar mid-sheet. */
  .frame { width: 100%; height: calc(100vh - 52px - 44px); border: 0; display: block; background: var(--hz-000); }

  @media (max-width: 900px) {
    .ref { grid-template-columns: 1fr; }
    .side { height: auto; position: static; border-right: 0; border-bottom: var(--hair) solid var(--hz-300); }
    .frame { height: 70vh; }
  }
</style>
