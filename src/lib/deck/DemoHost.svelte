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

<div class="dh-frame" bind:this={frame}>
  <div class="dh" class:fit bind:this={host} data-testid={testId}
    style={fit ? `width:${width}px;transform:translate(${offX}px, ${offY}px) scale(${scale})` : ''}></div>
</div>
{#if failed}<span class="dh-fail">demo unavailable</span>{/if}

<style>
  .dh-frame { position: absolute; inset: 0; overflow: hidden; }
  .dh { position: absolute; inset: 0; overflow: hidden; }
  .dh.fit { inset: auto; left: 0; top: 0; overflow: visible; transform-origin: 0 0; }
  .dh-fail { position: absolute; left: 12px; bottom: 10px; font-family: var(--mono); font-size: 11px; color: var(--signal); }
</style>
