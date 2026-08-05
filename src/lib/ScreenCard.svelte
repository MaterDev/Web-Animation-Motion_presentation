<script>
  /* A card as an LCD panel — a backlit green screen in a recessed
     well, the same readout the hardware sheets and the T-06 hero
     use. Everything visual comes from .lcd-panel / .lcd-* in
     components.css.

     An earlier version built these on the dark LED screen surface
     instead. That was the wrong display: the LED panel is emissive
     and belongs to the deck's slides — what the device outputs — and
     the app IS the device, so the app is made of the device's own
     LCD. Building cards from the slide surface made the app look
     like a deck.

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
  class="lcd-panel is-link"
  {href}
  target={external ? '_blank' : undefined}
  rel={external ? 'noopener' : undefined}
  data-testid={testId || undefined}
>
  <span class="well">
    <span class="lcd">
      <!-- .wash tints the backlight itself rather than painting over
           it, so a tinted card still reads as the same screen -->
      {#if tint}<span class="wash" style={`background:${tint}`}></span>{/if}
      <span class="lcd-body">
        <span class="top">
          <span class="lcd-kv"><span class="k">{code}</span></span>
          {#if meta}<span class="lcd-kv"><span class="v">{meta}</span></span>{/if}
        </span>
        <span class="lcd-title">{title}</span>
        {#if note}
          <span class="lcd-rule"></span>
          <span class="lcd-text">{note}</span>
        {/if}
        {#if status}
          <span class="foot">
            <span class="led" style="--c:var(--ok)" aria-hidden="true"></span>
            <span class="lcd-kv"><span class="k">{status}</span></span>
          </span>
        {/if}
      </span>
    </span>
  </span>
</a>

<style>
  /* layout only — colour, texture and type come from the system */
  .top { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
  .foot { display: flex; align-items: center; gap: 8px; margin-top: 2px; }
</style>
