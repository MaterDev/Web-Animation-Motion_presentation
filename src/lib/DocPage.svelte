<script>
  /* One document page: the front readout, the contents, the body. Used by
     /paper and /paper/glossary so the two read as the same document set. */
  /** @type {{ data: any, label?: string, headTitle: string, description: string, testid?: string, callout?: { after: string, href: string, title: string, note: string } | null, back?: { href: string, label: string } | null, heroLink?: { href: string, kicker: string, title: string } | null, variant?: string }} */
  let { data, label = 'Paper', headTitle, description, testid = 'paper', callout = null, back = null, heroLink = null, variant = '' } = $props();
</script>

<svelte:head>
  <title>{headTitle}</title>
  <meta name="description" content={description} />
</svelte:head>

<div class="wrap">
  <!-- The front matter as the device's own readout: the same LCD
       screen and key/value strip the System sheet's hero and the home
       page carry, so the paper opens on the system rather than on a
       line of bold labels. -->
  <header class="lcd-panel front" data-testid="{testid}-front">
    <div class="well">
      <div class="lcd">
        <div class="lcd-body front-body">
          <div class="front-top">
            <span class="lcd-label">Key Clark · {label}</span>
            <span class="lcd-label">WAM-2026</span>
          </div>

          <h1 class="front-title" data-testid="{testid}-front-title">{data.title}</h1>

          <div class="lcd-rule"></div>

          <div class="front-foot">
          <dl class="lcd-strip front-strip">
              {#each data.front as f (f.key)}
                <div class="lcd-kv" data-testid={`${testid}-front-${f.key}`}>
                  <dt class="k">{f.label}</dt>
                  <dd class="v">{f.value}</dd>
                </div>
              {/each}
            </dl>
            {#if heroLink}
              <!-- a sub-page, called out on the front panel, bottom right -->
              <!-- built from the system's own parts: an .lcd-kv readout whose
                   value is an .lcd-chip on the amber (caution) LCD -->
              <div class="lcd-kv front-link-kv">
                <span class="k">{heroLink.kicker}</span>
                <a class="lcd-chip front-link" href={heroLink.href} data-testid="{testid}-front-link">
                  <span class="lcd amber"><span class="v">{heroLink.title} <span class="front-link-arrow" aria-hidden="true">→</span></span></span>
                </a>
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>
  </header>

  <nav class="toc" aria-label="Contents" data-testid="{testid}-toc">
    <p class="toc-label">Contents</p>
    {#if back}<a class="toc-back" href={back.href} data-testid="{testid}-toc-back">← {back.label}</a>{/if}
    {#each data.toc as item (item.id)}
      <a href={`#${item.id}`} data-testid="{testid}-toc-{item.id}">{item.title}</a>
      {#if item.children?.length}
        <div class="toc-sub">
          {#each item.children as sub (sub.id)}
            <a href={`#${sub.id}`} data-testid="{testid}-toc-{sub.id}">{sub.title}</a>
          {/each}
        </div>
      {/if}
      {#if callout && callout.after === item.title}
        <!-- the glossary sits in the contents where shared language is argued -->
        <a class="toc-callout" href={callout.href} data-testid="{testid}-toc-callout">
          <span class="toc-callout-k">Sub-page</span>
          <span class="toc-callout-t">{callout.title}</span>
          <span class="toc-callout-n">{callout.note}</span>
        </a>
      {/if}
    {/each}
  </nav>

  <article class="prose paper" class:gl={variant === 'glossary'} data-testid="{testid}-body">
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
  /* glossary: each term on its own LCD label in bold dot type; its
     definition tabbed in beneath it (Key) */
  .gl :global(h3) {
    display: inline-block; margin: calc(var(--u) * 5) 0 calc(var(--u) * 1.5);
    padding: 7px 14px 6px; border-radius: 4px;
    font-family: var(--dot); font-variation-settings: 'ROND' 0; font-weight: 900; font-size: 22px; line-height: 1.15;
    letter-spacing: 0.01em; text-transform: lowercase; color: var(--lcd-ink);
    background: linear-gradient(178deg, var(--lcd-ground-top), var(--lcd-ground-bot));
    box-shadow: inset 0 0 0 1px oklch(0.2 0.05 130 / 0.4), 0 0 0 3px var(--well-floor);
  }
  .gl :global(h3 ~ :is(p, ul, ol, blockquote, pre, table)) { margin-left: calc(var(--u) * 5); }
  .gl :global(#sources ~ *) { margin-left: 0; }
  .toc-sub { display: flex; flex-direction: column; gap: 1px; margin: 0 0 4px 10px; border-left: var(--hair) solid var(--hz-300); }
  .toc-sub a { font-size: 11px; padding: 3px 8px; color: var(--hz-400); }
  .toc-back { font-family: var(--mono); font-size: 10px !important; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 6px; }
  .toc .toc-callout {
    display: flex; flex-direction: column; gap: 2px; margin: 6px 0 8px; padding: 9px 10px;
    border-radius: 5px; border: var(--hair) solid color-mix(in oklch, var(--tint-svg) 45%, var(--hz-300));
    border-left: 3px solid var(--tint-svg);
    background: color-mix(in oklch, var(--tint-svg) 12%, var(--hz-100));
  }
  .toc .toc-callout:hover { background: color-mix(in oklch, var(--tint-svg) 20%, var(--hz-100)); border-left-color: var(--tint-svg); }
  .toc-callout-k { font-family: var(--mono); font-size: 8.5px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--hz-500); }
  .toc-callout-t { font-size: 13px; color: var(--hz-800); font-weight: 600; }
  .toc-callout-n { font-size: 11px; color: var(--hz-500); line-height: 1.4; }
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
  .front-foot { display: flex; align-items: flex-end; justify-content: space-between; gap: calc(var(--u) * 4); flex-wrap: wrap; }
  /* Glossary link: the system's .lcd-chip holding an .lcd.amber screen,
     labelled like the strip's other readouts; sized to match them. */
  .front-link-kv { gap: 6px; align-items: flex-end; }
  .front-link-kv .k { font-size: 13px; font-weight: 900; letter-spacing: 0.12em; color: var(--lcd-ink); }
  .front-link { text-decoration: none; }
  .front-link .lcd { padding: 6px 12px; }
  .front-link .v { font-size: 22px; font-weight: 900; letter-spacing: 0.02em; text-transform: lowercase; color: oklch(0.280 0.060 70); }
  .front-link:hover .lcd { filter: brightness(1.06); }
  /* micro-animation that says "this goes somewhere": the arrow nudges
     forward on the system's detent ease every few seconds, and steps
     further on hover. Off under reduced motion. */
  .front-link-arrow { display: inline-block; animation: front-nudge 3.2s var(--ease-detent) infinite; }
  .front-link:hover .front-link-arrow, .front-link:focus-visible .front-link-arrow { animation: none; transform: translateX(6px);
    transition: transform var(--dur-fast) var(--ease-detent); }
  @keyframes front-nudge { 0%, 70%, 100% { transform: translateX(0); } 80% { transform: translateX(5px); } 90% { transform: translateX(0); } }
  @media (prefers-reduced-motion: reduce) { .front-link-arrow { animation: none; } }
  .front-link:focus-visible { outline: 2px solid var(--lcd-ink); outline-offset: 3px; }
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
