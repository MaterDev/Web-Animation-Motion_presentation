<script>
  /* Mounts one demo from the deck's collection (src/lib/demos) into a
     slide. Only when `live`: the grid, the rail and the thumbnails render
     every slide at once, and none of them should start a demo. The demo's
     dispose runs when the slide leaves or the id changes.

     `fit`: the demos were built at tear-sheet width, not slide width. With
     fit, the demo lays out at `width` px (its natural column) and the whole
     result is scaled down to fit the slide region, centred, so nothing is
     cropped and nothing reflows into a cramped column. */
  import { loadDemo } from '$lib/demos/registry.js';

  /* Not live — the grid, the rail, the phone remote — a demo shows its
     poster: a still of the real demo, shot by scripts/shoot-posters.js,
     laid out the way the live one fits. No poster → a skeleton of the
     well, never a blank (Key). */
  const POSTERS = /** @type {Record<string, string>} */ (import.meta.glob('./posters/*.webp', { eager: true, import: 'default', query: '?url' }));

  /** @type {{ id: string, live?: boolean, testId?: string, fit?: boolean, width?: number }} */
  let { id, live = false, testId, fit = false, width = 1100 } = $props();

  /** @type {HTMLElement | null} */
  let frame = $state(null);
  /** @type {HTMLElement | null} */
  let host = $state(null);
  let failed = $state(false);
  let scale = $state(1);
  let offX = $state(0);
  let offY = $state(0);
  const poster = $derived(POSTERS[`./posters/${id.replace('/', '__')}.webp`]);

  $effect(() => {
    const el = host, demo = id;
    if (!el || !demo || !live) return;
    failed = false;
    /** @type {(() => void) | null} */
    let dispose = null;
    let gone = false;
    loadDemo(demo)
      .then((mount) => { if (!gone) dispose = mount(el); })
      .catch((e) => { failed = true; console.error(e); });
    return () => { gone = true; dispose?.(); if (el.shadowRoot) el.shadowRoot.innerHTML = ''; };
  });

  $effect(() => {
    if (!fit || !frame || !host) return;
    const f = frame, h = host;
    const measure = () => {
      const fw = f.clientWidth, fh = f.clientHeight, hh = h.scrollHeight || h.offsetHeight;
      if (!fw || !fh || !hh) return;
      const s = Math.min(fw / width, fh / hh);
      scale = s;
      offX = (fw - width * s) / 2;
      offY = (fh - hh * s) / 2;
    };
    const ro = new ResizeObserver(measure);
    ro.observe(f); ro.observe(h);
    measure();
    return () => ro.disconnect();
  });
</script>

{#if !live}
  <div class="dh-frame dh-still" data-testid={testId && `${testId}-poster`}>
    {#if poster}
      <img class="dh-poster" class:cover={!fit} src={poster} alt="" loading="lazy" decoding="async" />
    {:else}
      <div class="dh-skel" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
    {/if}
  </div>
{:else}
<div class="dh-frame" bind:this={frame}>
  <div class="dh" class:fit bind:this={host} data-testid={testId}
    style={fit ? `width:${width}px;transform:translate(${offX}px, ${offY}px) scale(${scale})` : ''}></div>
</div>
{/if}
{#if failed}<span class="dh-fail">demo unavailable</span>{/if}

<style>
  .dh-frame { position: absolute; inset: 0; overflow: hidden; }
  .dh { position: absolute; inset: 0; overflow: hidden; }
  .dh.fit { inset: auto; left: 0; top: 0; overflow: visible; transform-origin: 0 0; }
  .dh-poster { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; }
  .dh-poster.cover { object-fit: cover; object-position: center top; }
  .dh-skel { position: absolute; inset: 8%; display: grid; grid-template-columns: 2fr 1fr; grid-template-rows: auto 1fr 1fr; gap: 10px; }
  .dh-skel i { border-radius: 6px; background: color-mix(in oklch, var(--lcd-ink, #333) 12%, transparent); }
  .dh-skel i:first-child { grid-column: 1 / -1; height: 14px; width: 40%; }
  .dh-skel i:nth-child(2) { grid-row: 2 / span 2; }
  .dh-fail { position: absolute; left: 12px; bottom: 10px; font-family: var(--mono); font-size: 11px; color: var(--signal); }
</style>
