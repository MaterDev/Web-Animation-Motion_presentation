<script>
  import { TREATMENTS, sheetHref, base } from '$lib/sheets.js';
</script>

<svelte:head>
  <title>Treatments — Design System — WAM-2026</title>
  <meta
    name="description"
    content="The six competing visual directions built for the Web Animation & Motion talk, five superseded, and what each one settled."
  />
</svelte:head>

<div class="wrap">
  <p class="mono kicker">Design System · Treatments</p>
  <h1>six directions</h1>
  <p class="lead">
    Each one a complete, running sheet rather than a mockup — which is what made it possible
    to reject five of them by looking. They're all still here and still work; the arc is more
    useful than any single one of them.
  </p>

  <div class="note diff">
    <b>The path isn't a straight line.</b> It started dark, went light on the argument that a
    light ground projects more safely, built the system up across three light iterations, then
    flipped back to dark once the LED-screen premise arrived and made an emissive ground the
    honest choice. The final treatment is a re-derivation of the fifth, not a recolour of it.
  </div>

  <ol class="track" data-testid="treatment-track">
    {#each TREATMENTS as t, i (t.code)}
      <li class="tr" class:kept={t.kept} style={`--i:${i}`}>
        <div class="tr-rail" aria-hidden="true">
          <span class="dot" class:lit={t.kept}></span>
          {#if i < TREATMENTS.length - 1}<span class="line"></span>{/if}
        </div>

        <div class="tr-body screen-unit">
          <div class="screen-face">
            <div class="screen-content">
              <!-- meta row and title are separate blocks. Putting the
                   title in the same baseline-aligned flex row as the
                   code and ground label made a two-line name overflow
                   the row's height and print straight over the note
                   below it — visible immediately on T-01, whose name
                   wraps. A wrapping heading doesn't belong in a
                   single-line flex row. -->
              <div class="tr-meta">
                <span class="led-micro code">{t.code}</span>
                <span class="tr-rule" aria-hidden="true"></span>
                <span class="led-micro ground">{t.ground} ground</span>
                {#if t.kept}<span class="tag">kept</span>{/if}
              </div>
              <h2 class="tr-name">{t.name}</h2>
              <p class="tr-note">{t.note}</p>
              <p class="tr-verdict"><span class="vk">Verdict</span>{t.verdict}</p>
              <div class="tr-actions">
                <a class="ibtn" href={sheetHref(t.code)} data-testid={`view-${t.code.toLowerCase()}`}>View in reference</a>
                <a class="ibtn" href={base(t.file)} target="_blank" rel="noopener">Open standalone ↗</a>
              </div>
            </div>
          </div>
        </div>
      </li>
    {/each}
  </ol>
</div>

<style>
  .wrap {
    max-width: 900px; margin: 0 auto; width: 100%;
    padding: calc(var(--u) * 8) calc(var(--u) * 5) calc(var(--u) * 14);
  }
  .kicker { margin: 0 0 calc(var(--u) * 2); }
  h1 { font-size: clamp(38px, 6vw, 68px); margin-bottom: calc(var(--u) * 3); }
  .lead { max-width: 60ch; margin-bottom: calc(var(--u) * 3); }

  /* a track rather than a grid — these are sequential, and the
     numbering is the argument */
  .track { list-style: none; padding: 0; margin: calc(var(--u) * 5) 0 0; }
  .tr { display: grid; grid-template-columns: 26px minmax(0, 1fr); gap: calc(var(--u) * 2); }

  .tr-rail { display: flex; flex-direction: column; align-items: center; padding-top: 20px; }
  .dot {
    width: 9px; height: 9px; border-radius: 50%; flex: none;
    background: var(--hz-400); box-shadow: inset 0 -1px 1px oklch(0.2 0.02 265 / 0.35);
  }
  .dot.lit {
    background: var(--tint);
    box-shadow: 0 0 10px color-mix(in oklch, var(--tint) 65%, transparent);
  }
  .line { flex: 1 1 auto; width: var(--hair); background: var(--hz-300); margin: 6px 0; }

  .tr-body { margin-bottom: calc(var(--u) * 2.5); }
  .tr.kept .screen-face { border-top: 2px solid var(--tint); }

  .screen-content { padding: calc(var(--u) * 2.5) calc(var(--u) * 3) calc(var(--u) * 3); }

  /* meta row: code, a hairline rule, the ground label — the same
     shape as .sec-head on the reference sheets, so a treatment card
     reads like a section header from the system it came out of */
  .tr-meta { display: flex; align-items: center; gap: calc(var(--u) * 1.5); margin-bottom: 12px; }
  .code { color: var(--led-dim); flex: none; }
  .tr-rule {
    flex: 1 1 auto; height: 9px; opacity: 0.4;
    background: repeating-linear-gradient(90deg, var(--led-dim) 0 var(--hair), transparent var(--hair) 8px);
  }
  .ground { color: var(--led-dim); opacity: 0.7; flex: none; }

  /* the title as a block, in the screen's own pixel face */
  .tr-name {
    font-family: var(--dot); font-variation-settings: 'ROND' 0; font-weight: 900;
    font-size: 26px; line-height: 1.1; letter-spacing: 0.01em;
    color: var(--led-ink); text-transform: lowercase;
    margin: 0 0 12px;
  }
  .tag {
    font-family: var(--mono); font-size: 8px; letter-spacing: 0.16em; text-transform: uppercase;
    color: var(--tint); background: color-mix(in oklch, var(--tint) 20%, transparent);
    padding: 2px 6px; border-radius: 2px;
  }

  .tr-note { font-size: 13.5px; color: var(--led-dim); line-height: 1.65; margin: 0 0 10px; max-width: 62ch; }
  .tr-verdict { font-size: 13px; color: var(--led-ink); line-height: 1.7; margin: 0 0 calc(var(--u) * 2); max-width: 62ch; }
  .vk {
    display: block; font-family: var(--mono); font-size: 8.5px; letter-spacing: 0.18em;
    text-transform: uppercase; color: var(--led-dim); margin-bottom: 3px;
  }

  .tr-actions { display: flex; gap: 8px; flex-wrap: wrap; }

  @media (max-width: 640px) {
    .tr { grid-template-columns: 1fr; }
    .tr-rail { display: none; }
  }
</style>
