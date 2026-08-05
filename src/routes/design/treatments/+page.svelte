<script>
  import { page } from '$app/state';
  import { browser } from '$app/environment';
  import { replaceState } from '$app/navigation';
  import { TREATMENTS, base } from '$lib/sheets.js';

  /* Two panes: a scannable list, and a live preview of whatever's
     selected. These are previews — the point is to flick through six
     directions and see them, not to navigate away and come back five
     times. The previous version put each treatment's full write-up in
     its own card and sent you to a standalone tab to actually look at
     one, which is the wrong shape for comparison and also crammed a
     wrapping pixel headline next to a right-aligned label until they
     collided. */

  /** @param {string} code */
  const idxFor = (code) => TREATMENTS.findIndex((t) => t.code.toLowerCase() === code.toLowerCase());

  /* ?t=t-03 keeps a selection linkable. Read via an effect rather
     than derived, because url.searchParams can't be touched during
     prerender — the page prerenders on the first treatment and
     corrects on hydration. */
  let selected = $state(0);

  $effect(() => {
    if (!browser) return;
    const i = idxFor(page.url.searchParams.get('t') ?? '');
    if (i >= 0) selected = i;
  });

  const active = $derived(TREATMENTS[selected]);

  /** @param {number} i */
  function select(i) {
    selected = i;
    const url = new URL(page.url);
    url.searchParams.set('t', TREATMENTS[i].code.toLowerCase());
    replaceState(url, {});
  }

  /** @param {KeyboardEvent} e */
  function onListKey(e) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const next = e.key === 'ArrowDown'
      ? (selected + 1) % TREATMENTS.length
      : (selected - 1 + TREATMENTS.length) % TREATMENTS.length;
    select(next);
    /** @type {HTMLElement | null} */
    (document.querySelector(`[data-testid="tr-${TREATMENTS[next].code.toLowerCase()}"]`))?.focus();
  }
</script>

<svelte:head>
  <title>Treatments — Design System — WAM-2026</title>
  <meta
    name="description"
    content="The six competing visual directions built for the Web Animation & Motion talk, five superseded, previewed side by side."
  />
</svelte:head>

<div class="page">
  <header class="head">
    <p class="mono kicker">Design System · Treatments</p>
    <h1>six directions</h1>
    <p class="lead">
      Each one a complete, running sheet rather than a mockup — which is what made it
      possible to reject five of them by looking. Pick one to preview it.
    </p>
    <div class="note diff">
      <b>The path isn't a straight line.</b> It started dark, went light on the argument that
      a light ground projects more safely, built the system up across three light iterations,
      then flipped back to dark once the LED-screen premise arrived. The final treatment is a
      re-derivation of the fifth, not a recolour of it.
    </div>
  </header>

  <div class="panes">
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <ol class="list" data-testid="treatment-list" onkeydown={onListKey}>
      {#each TREATMENTS as t, i (t.code)}
        <li>
          <button
            type="button"
            class="row"
            class:on={i === selected}
            aria-pressed={i === selected}
            onclick={() => select(i)}
            data-testid={`tr-${t.code.toLowerCase()}`}
          >
            <span class="row-top">
              <span class="led-micro code">{t.code}</span>
              <span class="led-micro ground">{t.ground}</span>
              {#if t.kept}<span class="tag">kept</span>{/if}
            </span>
            <span class="row-name">{t.name}</span>
            <span class="row-note">{t.note}</span>
          </button>
        </li>
      {/each}
    </ol>

    <div class="viewer">
      <div class="v-bar">
        <span class="v-title"><span class="led-micro">{active.code}</span>{active.name}</span>
        <a class="ibtn" href={base(active.file)} target="_blank" rel="noopener" data-testid="tr-popout">
          Open full ↗
        </a>
      </div>

      <div class="v-verdict">
        <span class="mono vk">Verdict</span>
        <p>{active.verdict}</p>
      </div>

      <div class="v-frame-wrap">
        <iframe
          class="v-frame"
          src={base(active.file)}
          title={`${active.code} — ${active.name}`}
          data-testid="tr-frame"
        ></iframe>
      </div>
    </div>
  </div>
</div>

<style>
  .page { display: flex; flex-direction: column; min-width: 0; flex: 1 1 auto; }

  .head { padding: calc(var(--u) * 6) calc(var(--u) * 5) calc(var(--u) * 3); max-width: 900px; }
  .kicker { margin: 0 0 calc(var(--u) * 2); }
  h1 { font-size: clamp(34px, 5vw, 60px); margin-bottom: calc(var(--u) * 2.5); }
  .lead { max-width: 62ch; margin-bottom: calc(var(--u) * 2); }

  .panes {
    display: grid; grid-template-columns: 330px minmax(0, 1fr);
    gap: 0; flex: 1 1 auto; min-height: 0;
    border-top: var(--hair) solid var(--hz-300);
  }

  /* ── list ── */
  .list {
    list-style: none; margin: 0; padding: calc(var(--u) * 1.5);
    display: flex; flex-direction: column; gap: 4px;
    border-right: var(--hair) solid var(--hz-300);
  }
  .row {
    display: flex; flex-direction: column; gap: 5px; width: 100%;
    text-align: left; cursor: pointer; border: 0;
    padding: calc(var(--u) * 1.5) calc(var(--u) * 2);
    border-radius: 5px; background: var(--hz-100);
    box-shadow: var(--edge);
    transition: background var(--dur-fast) var(--ease-standard),
                box-shadow var(--dur-fast) var(--ease-standard);
  }
  .row:hover { background: var(--hz-200); }
  .row:focus-visible { outline: 2px solid var(--tint); outline-offset: -2px; }
  .row.on {
    background: color-mix(in oklch, var(--tint) 14%, var(--hz-100));
    box-shadow: var(--edge), inset 2px 0 0 var(--tint);
  }

  .row-top { display: flex; align-items: baseline; gap: 10px; }
  .code { color: var(--hz-500); }
  .ground { color: var(--hz-400); margin-left: auto; }
  .tag {
    font-family: var(--mono); font-size: 7.5px; letter-spacing: 0.14em; text-transform: uppercase;
    color: var(--tint); background: color-mix(in oklch, var(--tint) 20%, transparent);
    padding: 1px 5px; border-radius: 2px;
  }

  /* the pixel face, as a block on its own line — a wrapping headline
     never shares a flex line with anything else */
  .row-name {
    font-family: var(--dot); font-variation-settings: 'ROND' 0; font-weight: 900;
    font-size: 19px; line-height: 1.15; letter-spacing: 0.01em;
    color: var(--hz-900); text-transform: lowercase;
  }
  .row-note { font-size: 11.5px; line-height: 1.55; color: var(--hz-500); }
  .row.on .row-note { color: var(--hz-600); }

  /* ── viewer ── */
  .viewer { display: flex; flex-direction: column; min-width: 0; }
  .v-bar {
    display: flex; align-items: center; justify-content: space-between; gap: calc(var(--u) * 2);
    padding: 0 calc(var(--u) * 2); height: 44px; flex: none;
    border-bottom: var(--hair) solid var(--hz-300); background: var(--hz-050);
  }
  .v-title { display: flex; align-items: baseline; gap: 10px; font-size: 13px; color: var(--hz-700); text-transform: lowercase; }
  .v-title .led-micro { color: var(--hz-400); }

  .v-verdict {
    display: grid; grid-template-columns: 70px minmax(0, 1fr); gap: calc(var(--u) * 2);
    padding: calc(var(--u) * 2) calc(var(--u) * 2.5);
    border-bottom: var(--hair) solid var(--hz-300); background: var(--hz-050);
  }
  .vk { font-size: 9px; color: var(--hz-400); padding-top: 3px; }
  .v-verdict p { margin: 0; font-size: 13px; line-height: 1.65; color: var(--hz-600); max-width: 74ch; }

  .v-frame-wrap { flex: 1 1 auto; min-height: 0; background: var(--hz-000); }
  .v-frame { width: 100%; height: 100%; min-height: 60vh; border: 0; display: block; }

  @media (max-width: 1100px) {
    .panes { grid-template-columns: 1fr; }
    .list { border-right: 0; border-bottom: var(--hair) solid var(--hz-300); }
    .v-frame { min-height: 70vh; }
  }
</style>
