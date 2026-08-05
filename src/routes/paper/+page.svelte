<script>
  let { data } = $props();
</script>

<svelte:head>
  <title>Full Paper — WAM-2026</title>
  <meta
    name="description"
    content="The full scope for the Web Animation & Motion talk: thesis, content outline, motion craft, accessibility, architecture and risks."
  />
</svelte:head>

<div class="wrap">
  <nav class="toc" aria-label="Contents" data-testid="paper-toc">
    <p class="toc-label">Contents</p>
    {#each data.toc as item (item.id)}
      <a href={`#${item.id}`}>{item.title}</a>
    {/each}
  </nav>

  <article class="prose paper" data-testid="paper-body">
    <!-- Rendered from SCOPE.md at build time; see +page.js. The
         markdown is authored in this repo, so there's no untrusted
         input here to sanitise. -->
    {@html data.html}
  </article>
</div>

<style>
  .wrap {
    max-width: 1180px; margin: 0 auto; width: 100%;
    padding: calc(var(--u) * 7) calc(var(--u) * 5) calc(var(--u) * 14);
    display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: calc(var(--u) * 6);
    align-items: start;
  }

  .toc {
    position: sticky; top: calc(52px + var(--u) * 4);
    display: flex; flex-direction: column; gap: 1px;
    max-height: calc(100vh - 52px - var(--u) * 8); overflow-y: auto;
  }
  .toc-label {
    font-family: var(--mono); font-size: 9px; letter-spacing: 0.18em;
    text-transform: uppercase; color: var(--hz-400); margin: 0 0 calc(var(--u) * 1.5);
  }
  .toc a {
    font-size: 12px; color: var(--hz-500); text-decoration: none;
    padding: 5px 8px; border-radius: 3px; border-left: 2px solid transparent;
    transition: color var(--dur-fast) var(--ease-standard), background var(--dur-fast) var(--ease-standard);
  }
  .toc a:hover { color: var(--hz-800); background: var(--hz-100); border-left-color: var(--tint); }

  /* h1 comes from the markdown itself, so the page has no separate
     title block — the document is the page. */
  .paper :global(h1) { margin-bottom: calc(var(--u) * 4); }
  /* scroll-margin so a TOC jump doesn't land the heading under the
     sticky topbar */
  .paper :global(h2), .paper :global(h3) { scroll-margin-top: calc(52px + var(--u) * 3); }
  .paper :global(code) {
    font-family: var(--mono); font-size: 0.86em; background: var(--hz-200);
    border: var(--hair) solid var(--hz-300); border-radius: 2px; padding: 1px 5px; color: var(--hz-700);
  }

  @media (max-width: 900px) {
    .wrap { grid-template-columns: 1fr; gap: calc(var(--u) * 4); }
    .toc { position: static; max-height: none; }
  }
</style>
