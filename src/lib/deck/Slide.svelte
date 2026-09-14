<script>
  /* ONE SLIDE, AT ITS TRUE SIZE.

     Always 960 × 540. The caller scales it with a transform, which is
     what keeps the 6px matrix a whole number of cells at any display
     size — a slide sized in relative units would resolve modules to
     fractional pixels and the grid would quietly stop being real.

     A slide's demo is a URL, not a function, and it runs in an
     <iframe>. That buys three things at once:

       · isolation — its globals, listeners, styles, animation frames
         and GPU context belong to that document and can never reach
         another slide
       · lazy — nothing is fetched or executed until `live` is true,
         so opening a deck of sixteen costs one demo, not sixteen
       · teardown that is real — dropping the frame discards the whole
         context. Not paused; gone.

     It is also the shape the technique sheets already have, so
     pointing a slide at design/techniques/… later changes the URL and
     nothing else. That is the same trade the reference viewer already
     made, for the same reason: porting a demo means maintaining two
     copies of it. */
  import { TINTS } from './slides.js';

  /** @typedef {import('./slides.js').Slide} Slide */
  /** @type {{ slide: Slide, live?: boolean, ex?: number, guides?: boolean }} */
  let { slide, live = false, ex = 0, guides = false } = $props();

  /* A gallery slide holds several examples and shows one. Which one is
     the caller's business, not the slide's — the presenter is moving
     through them by hand while talking over them. */
  const example = $derived(slide.examples?.[Math.min(ex, slide.examples.length - 1)] ?? null);
  const demoUrl = $derived(example?.demo ?? slide.demo ?? null);

  const tint = $derived((slide.tint && TINTS[slide.tint]) || 'var(--led-ink)');

  /* Resolve the tint to a real colour so the frame — which has none of
     our CSS — can be handed it. */
  /** @type {HTMLElement | null} */
  let probe = $state(null);
  let resolved = $state('#8899aa');
  $effect(() => {
    if (probe) resolved = getComputedStyle(probe).color || '#8899aa';
  });

  const src = $derived(
    live && demoUrl
      ? demoUrl + (demoUrl.includes('?') ? '&' : '?') + 'tint=' + encodeURIComponent(resolved)
      : ''
  );

  let failed = $state(false);
  $effect(() => {
    void demoUrl;                      // re-run when the example changes
    failed = false;                    // a fresh demo starts unbroken
    /** @param {MessageEvent} e */
    const onMsg = (e) => {
      if (e.data?.deck === 'error') failed = true;
    };
    addEventListener('message', onMsg);
    return () => removeEventListener('message', onMsg);
  });
</script>

<div class="led-slide" class:guides style="--tint:{tint}" data-testid="slide-{slide.id}">
  <span class="probe" bind:this={probe} style="color:{tint}"></span>

  {#if slide.layout === 'bleed' && slide.demo}
    <div class="led-bleed">
      <div class="well bleedwell">
        {#if src}<iframe {src} title="" tabindex="-1" data-testid="demo-{slide.id}"></iframe>{/if}
      </div>
    </div>
  {/if}

  <div class="led-chrome top">
    <span>{slide.kicker ?? ''}</span><span>{slide.code}</span>
  </div>

  <div class="led-field" class:l-hero={slide.layout === 'hero'}
       class:l-statement={slide.layout === 'statement'}
       class:l-index={slide.layout === 'index'}
       class:l-figure={slide.layout === 'figure'}
       class:l-split={slide.layout === 'split'}
       class:l-bleed={slide.layout === 'bleed'}
       class:l-compare={slide.layout === 'compare'}
       class:l-gallery={slide.layout === 'gallery'}>

    <div class="type">
      {#if slide.layout === 'statement'}
        <h2 class="led-display">{@html slide.h}</h2>
      {:else}
        <h2 class="led-head led-lit">{@html slide.h}</h2>
      {/if}
      {#if slide.body}<p class="led-body">{slide.body}</p>{/if}

      {#if slide.readout}
        <div class="readout">
          {#each slide.readout as [n, l] (l)}
            <span><b>{n}</b><em>{l}</em></span>
          {/each}
        </div>
      {/if}
    </div>

    {#if slide.items}
      <ul class="items">
        {#each slide.items as it (it)}<li class="led-sub">{it}</li>{/each}
      </ul>
    {/if}

    {#if slide.compare}
      <div class="cmp">
        {#each slide.compare as c (c.h)}
          <div class="cmp-col">
            <h3 class="led-sub cmp-h">{c.h}</h3>
            <p class="led-body">{c.body}</p>
          </div>
        {/each}
      </div>
    {/if}

    {#if slide.examples}
      <div class="strip" data-testid="examples-{slide.id}">
        {#each slide.examples as e, n (e.label)}
          <span class="chip led-micro" class:on={n === Math.min(ex, slide.examples.length - 1)}>{e.label}</span>
        {/each}
      </div>
    {/if}

    {#if demoUrl && slide.layout !== 'bleed'}
      <div class="led-cellblock well" data-testid="well-{slide.id}">
        {#if src && !failed}
          <iframe {src} title="" tabindex="-1" data-testid="demo-{slide.id}"></iframe>
        {:else if failed}
          <span class="led-micro fail">demo unavailable</span>
        {/if}
      </div>
    {/if}
  </div>

  <div class="led-chrome bot">
    <span>960 × 540 · 6px cell</span><span>{slide.sample ? 'sample' : ''}</span>
  </div>

  <div class="led-guides"><span class="margin"></span><span class="field"></span></div>
</div>

<style>
  .probe { position: absolute; width: 0; height: 0; overflow: hidden; }

  /* Compositions. Each places its parts on the 12 × 6 module field and
     leaves the rest empty — the empty modules are the composition, not
     space nobody got round to using. */
  .type { grid-column: 1 / 8; grid-row: 2 / 5; align-self: center; display: flex; flex-direction: column; gap: 18px; }
  .items { grid-column: 8 / 13; grid-row: 2 / 6; margin: 0; padding: 0; list-style: none;
    display: flex; flex-direction: column; justify-content: center; gap: 6px; }
  .well { grid-column: 8 / 13; grid-row: 1 / 6; border-radius: 2px; }

  .l-hero .type { grid-column: 1 / 9; grid-row: 3 / 6; }
  .l-hero .well { grid-column: 1 / 13; grid-row: 1 / 7; opacity: 0.55; }

  .l-statement .type { grid-column: 1 / 11; grid-row: 2 / 6; }

  .l-index .type { grid-column: 1 / 6; grid-row: 1 / 4; }
  .l-index .items { grid-column: 1 / 13; grid-row: 4 / 7; flex-direction: row; flex-wrap: wrap;
    align-content: flex-start; align-items: flex-start; gap: 0 24px; }

  .l-split .type { grid-column: 1 / 7; }
  .l-split .items { grid-column: 8 / 13; }

  .l-figure .type { grid-column: 1 / 7; }

  .l-bleed .type { grid-column: 1 / 8; grid-row: 4 / 7; align-self: end; }

  /* two columns, deliberately equal — the point of the slide is that
     neither one is the default */
  .l-compare .type { grid-column: 1 / 13; grid-row: 1 / 3; }
  .cmp { grid-column: 1 / 13; grid-row: 3 / 7; display: grid; grid-template-columns: 1fr 1fr; gap: 72px; }
  .cmp-col { display: flex; flex-direction: column; gap: 12px; }
  .cmp-h { color: var(--tint); }

  /* the browsing slide: type small and out of the way, the example
     large, and a strip saying which of them you are looking at */
  .l-gallery .type { grid-column: 1 / 5; grid-row: 1 / 3; }
  .l-gallery .well { grid-column: 5 / 13; grid-row: 1 / 7; }
  .strip { grid-column: 1 / 5; grid-row: 3 / 7; display: flex; flex-direction: column;
    align-items: flex-start; gap: 8px; }
  .chip { padding: 4px 9px; border-radius: 3px; border: 1px solid oklch(1 0 0 / 0.14);
    color: var(--led-dim); }
  .chip.on { color: var(--led-ground); background: var(--tint); border-color: var(--tint); }

  .readout { display: flex; gap: 28px; margin-top: 6px; }
  .readout b { font-family: var(--dot); font-variation-settings: 'ROND' 0; font-weight: 900;
    font-size: 36px; line-height: 36px; color: var(--tint); display: block; }
  .readout em { font-family: var(--mono); font-style: normal; font-size: 12px;
    letter-spacing: 0.18em; text-transform: uppercase; color: var(--led-dim); }

  .well { position: relative; overflow: hidden; display: grid; place-items: center; }
  .bleedwell { position: absolute; inset: 0; opacity: 0.55; }
  .well iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0;
    background: transparent; display: block; }
  .fail { color: var(--signal); }
</style>
