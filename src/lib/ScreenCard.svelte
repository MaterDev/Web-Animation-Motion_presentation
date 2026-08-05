<script>
  /* A card, built out of the system's own vocabulary: a screen unit
     (bezel + LED matrix + vignette) rather than a bordered rectangle.
     Type inside uses the LED scale, so a card is literally a small
     display showing content — which is the same premise the slides
     are built on.

     All appearance comes from components.css. The scoped block below
     sets layout only: if a card needs a look the system doesn't
     have, the system is what should change. */

  /* Never write a literal style or script tag inside a comment in
     here. svelte2tsx scans for the closing tag textually, so one
     inside a comment ends the script region early and it reports the
     block as unclosed — while the Svelte compiler itself parses the
     file fine, so the build passes and only type-checking fails. */
  /** @type {{ href: string, code: string, title: string, note?: string, tint?: string, meta?: string, testId?: string, external?: boolean }} */
  let { href, code, title, note = '', tint = '', meta = '', testId = '', external = false } = $props();
</script>

<a
  class="screen-unit is-link"
  {href}
  style={tint ? `--ct:${tint}` : ''}
  target={external ? '_blank' : undefined}
  rel={external ? 'noopener' : undefined}
  data-testid={testId || undefined}
>
  <span class="screen-face">
    <span class="screen-content card-body">
      <span class="card-top">
        <span class="led-micro" style={tint ? `color:${tint}` : ''}>{code}</span>
        {#if meta}<span class="led-micro card-meta">{meta}</span>{/if}
      </span>
      <span class="led-sub dot card-title">{title}</span>
      {#if note}<span class="card-note">{note}</span>{/if}
    </span>
  </span>
</a>

<style>
  /* layout only — every colour, texture and type size above comes
     from the shared system stylesheet */
  .card-body { display: flex; flex-direction: column; gap: 9px; padding: 16px 18px 18px; }
  .card-top { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
  .card-meta { opacity: 0.75; }
  .card-title { color: var(--led-ink); line-height: 1.05; }
  .card-note {
    font-family: var(--sans); font-size: 12.5px; line-height: 1.6;
    color: var(--led-dim);
  }
</style>
