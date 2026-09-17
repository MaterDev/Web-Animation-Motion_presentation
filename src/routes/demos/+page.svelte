<script>
  /* The demo collection's own viewer: every deck demo, mounted alone,
     with its notes. It is where a demo is checked in isolation before a
     slide uses it. ?d=<id> picks one. */
  import { page } from '$app/state';
  import { DEMOS, loadDemo } from '$lib/demos/registry.js';

  let current = $state('');
  $effect(() => { current = page.url.searchParams.get('d') ?? DEMOS[0]?.id ?? ''; });
  const demo = $derived(DEMOS.find((d) => d.id === current));

  /** @type {HTMLElement | null} */
  let host = $state(null);
  let error = $state('');
  $effect(() => {
    const id = current, el = host;
    if (!id || !el) return;
    error = '';
    /** @type {(() => void) | null} */
    let dispose = null, gone = false;
    loadDemo(id)
      .then((mount) => { if (!gone) dispose = mount(el); })
      .catch((e) => { error = String(e?.stack ?? e); console.error(e); });
    return () => { gone = true; dispose?.(); if (el.shadowRoot) el.shadowRoot.innerHTML = ''; };
  });
</script>

<svelte:head><title>{demo?.title ?? 'Demos'} — Demo collection — WAM-2026</title></svelte:head>

<div class="dm" data-testid="demos">
  <aside class="dm-side" data-testid="demos-list">
    <p class="dm-grp">Demo collection · {DEMOS.length}</p>
    {#each DEMOS as d (d.id)}
      <a class="dm-item" class:on={d.id === current} href="/demos?d={encodeURIComponent(d.id)}" data-testid="demos-item-{d.id.replace('/', '-')}">
        <span class="dm-tech">{d.technique}</span><span class="dm-name">{d.title}</span>
      </a>
    {/each}
  </aside>
  <section class="dm-main">
    {#if demo}
      <header class="dm-head">
        <h1 data-testid="demos-title">{demo.title}</h1>
        <p class="dm-src">{demo.source.sheet} · {demo.source.section}</p>
      </header>
      {#if error}<pre class="dm-err" data-testid="demos-error">{error}</pre>{/if}
      <div class="dm-host" bind:this={host} data-testid="demo-host"></div>
      {#if demo.notes}<details class="dm-notes"><summary>Notes</summary><pre>{demo.notes}</pre></details>{/if}
    {:else}
      <p class="dm-src">No demos yet.</p>
    {/if}
  </section>
</div>

<style>
  .dm { display: grid; grid-template-columns: 240px minmax(0, 1fr); min-height: calc(100vh - 52px); }
  .dm-side { border-right: var(--hair) solid var(--hz-300); background: var(--hz-050); padding: 16px 10px; display: flex; flex-direction: column; gap: 2px; }
  .dm-grp { font-family: var(--mono); font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--hz-400); margin: 0 8px 8px; }
  .dm-item { display: flex; gap: 8px; align-items: baseline; padding: 7px 8px; border-radius: 4px; text-decoration: none; }
  .dm-item:hover, .dm-item.on { background: var(--hz-200); }
  .dm-tech { font-family: var(--mono); font-size: 9px; width: 56px; flex: none; color: var(--hz-400); text-transform: uppercase; }
  .dm-name { font-size: 13px; color: var(--hz-700); }
  .dm-main { padding: 20px 28px 60px; min-width: 0; }
  .dm-head h1 { font-size: 22px; margin: 0; color: var(--hz-900); }
  .dm-src { font-family: var(--mono); font-size: 10px; color: var(--hz-500); margin: 4px 0 16px; }
  .dm-host { min-height: 200px; }
  .dm-err { color: var(--signal); white-space: pre-wrap; font-size: 11px; }
  .dm-notes { margin-top: 24px; color: var(--hz-600); }
  .dm-notes pre { white-space: pre-wrap; font-size: 12px; }
</style>
