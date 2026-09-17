<script>
  /* Mounts one demo from the deck's collection (src/lib/demos) into a
     slide. Only when `live`: the grid, the rail and the thumbnails render
     every slide at once, and none of them should start a demo. The demo's
     dispose runs when the slide leaves or the id changes. */
  import { loadDemo } from '$lib/demos/registry.js';

  /** @type {{ id: string, live?: boolean, testId?: string }} */
  let { id, live = false, testId } = $props();

  /** @type {HTMLElement | null} */
  let host = $state(null);
  let failed = $state(false);

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
</script>

<div class="dh" bind:this={host} data-testid={testId}></div>
{#if failed}<span class="dh-fail">demo unavailable</span>{/if}

<style>
  .dh { position: absolute; inset: 0; overflow: hidden; }
  .dh-fail { position: absolute; left: 12px; bottom: 10px; font-family: var(--mono); font-size: 11px; color: var(--signal); }
</style>
