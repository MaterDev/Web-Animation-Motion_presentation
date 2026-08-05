<script>
  /* A chassis card with an LCD chip in it — not a card made OF an
     LCD. The screen is a component here, showing the code and the
     count, and the card around it is ordinary panel material.

     This is the correction to the previous version, which wrapped
     the whole card in .lcd-panel. Every card being a green screen
     made the app read as one continuous surface and the display
     stopped meaning anything. A full .lcd-panel earns its place for
     a hero or a callout; a chip is the default.

     Never write a literal style or script tag inside a comment in
     here: svelte2tsx scans for the closing tag textually, so one in
     a comment ends the script region early and it reports the block
     as unclosed, while the Svelte compiler itself parses the file
     fine — so the build passes and only type-checking fails. */

  /** @type {{ href: string, code: string, title: string, note?: string, tint?: string, meta?: string, status?: string, testId?: string, external?: boolean }} */
  let {
    href, code, title, note = '', tint = '', meta = '', status = '', testId = '', external = false,
  } = $props();
</script>

<a
  class="card"
  {href}
  style={tint ? `--ct:${tint}` : ''}
  target={external ? '_blank' : undefined}
  rel={external ? 'noopener' : undefined}
  data-testid={testId || undefined}
>
  <span class="top">
    <span class="lcd-chip">
      <span class="lcd"><span class="v">{code}</span></span>
    </span>
    {#if meta}<span class="meta mono">{meta}</span>{/if}
  </span>

  <span class="title">{title}</span>
  {#if note}<span class="note-text">{note}</span>{/if}

  {#if status}
    <span class="foot">
      <span class="led" style="--c:var(--ok)" aria-hidden="true"></span>
      <span class="mono st">{status}</span>
    </span>
  {/if}
</a>

<style>
  .card {
    position: relative; display: flex; flex-direction: column; gap: 11px;
    padding: calc(var(--u) * 2.5); border-radius: 6px; text-decoration: none;
    background: linear-gradient(180deg, var(--hz-200), var(--hz-100));
    box-shadow: var(--edge), var(--lift-1);
    transition: transform var(--dur-fast) var(--ease-standard),
                box-shadow var(--dur-fast) var(--ease-standard);
  }
  .card:hover { transform: translateY(-3px); box-shadow: var(--edge), var(--lift-3); }
  .card:active { transform: translateY(-1px); }
  .card:focus-visible { outline: 2px solid var(--tint); outline-offset: 2px; }
  /* the tint marks identity on an otherwise neutral panel — colour
     for state, never decoration */
  .card::before {
    content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 2px;
    border-radius: 6px 0 0 6px; background: var(--ct, var(--tint));
  }

  .top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .meta { font-size: 9px; color: var(--hz-400); }

  /* title in the dot face on the chassis, light ink — the pixel
     voice carries without needing a green ground behind it */
  .title {
    font-family: var(--dot); font-variation-settings: 'ROND' 0; font-weight: 900;
    font-size: 20px; line-height: 1.1; letter-spacing: 0.01em;
    color: var(--hz-900); text-transform: lowercase;
  }
  .note-text { font-size: 12.5px; line-height: 1.6; color: var(--hz-500); }

  .foot { display: flex; align-items: center; gap: 8px; margin-top: auto; padding-top: 3px; }
  .st { font-size: 8.5px; color: var(--hz-500); }
</style>
