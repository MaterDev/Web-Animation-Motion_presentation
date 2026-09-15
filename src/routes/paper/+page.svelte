<script>
  let { data } = $props();
</script>

<svelte:head>
  <title>Full Paper — WAM-2026</title>
  <meta
    name="description"
    content="The paper behind the Web Animation & Motion talk: thesis, motion craft, accessibility, the degradation ladder and mobile-first motion."
  />
</svelte:head>

<div class="wrap">
  <!-- The front matter as the device's own readout: the same LCD
       screen and key/value strip the System sheet's hero and the home
       page carry, so the paper opens on the system rather than on a
       line of bold labels. -->
  <header class="lcd-panel front" data-testid="paper-front">
    <div class="well">
      <div class="lcd">
        <div class="lcd-body front-body">
          <div class="front-top">
            <span class="lcd-label">Key Clark · Paper</span>
            <span class="lcd-label">WAM-2026</span>
          </div>

          <h1 class="front-title" data-testid="paper-front-title">{data.title}</h1>

          <div class="lcd-rule"></div>

          <dl class="lcd-strip front-strip">
            {#each data.front as f (f.key)}
              <div class="lcd-kv" data-testid={`paper-front-${f.key}`}>
                <dt class="k">{f.label}</dt>
                <dd class="v">{f.value}</dd>
              </div>
            {/each}
          </dl>
        </div>
      </div>
    </div>
  </header>

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

  /* spans both columns: the panel opens the page, the contents and
     the body sit under it */
  .front { grid-column: 1 / -1; }
  .front-body { padding: calc(var(--u) * 4) calc(var(--u) * 5); gap: calc(var(--u) * 2); }
  .front-top { display: flex; align-items: baseline; justify-content: space-between; gap: calc(var(--u) * 2); }
  /* .lcd-title at hero scale in LCD ink — the home hero's recipe */
  .front-title {
    font-family: var(--dot); font-variation-settings: 'ROND' 0; font-weight: 900;
    font-size: clamp(30px, 5vw, 60px); line-height: 1.02; letter-spacing: 0.005em;
    color: var(--lcd-ink); text-transform: lowercase; margin: calc(var(--u) * 1) 0 0;
  }
  /* The readout is the panel's second voice, not fine print: the
     system's 9px label and 13px value vanish at hero scale, under the
     glass glare. Up-sized and set in full LCD ink, and the labels
     take the dot face's heavier weight so they hold on the green. */
  .front-top .lcd-label { font-size: 13px; letter-spacing: 0.14em; color: var(--lcd-ink); }
  .front-strip { margin: calc(var(--u) * 1) 0 0; gap: calc(var(--u) * 6); }
  .front-strip .lcd-kv { gap: 6px; }
  .front-strip .k { font-size: 13px; font-weight: 900; letter-spacing: 0.12em; color: var(--lcd-ink); }
  .front-strip .v { font-size: 22px; font-weight: 900; }
  .front-strip dd { margin: 0; }
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
