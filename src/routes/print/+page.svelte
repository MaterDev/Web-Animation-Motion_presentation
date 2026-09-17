<script>
  /* THE DECK AS PAPER — one A4 landscape page per slide: the notes down the
     left, the slide itself on the right.

     Printed to PDF by `bun scripts/print-pdf.js`, which is only Chrome's own
     print. So everything here is print-first: real page breaks, no fixed
     positioning, no scroll containers, and the slides render with
     `live={false}`, which shows each demo's poster still rather than
     mounting 16 live demos into one document.

     The notes are the same `deck-notes/*.md` the phone reads, pulled in at
     build time so the page works without the dev server. */
  import Slide from '$lib/deck/Slide.svelte';
  import { SLIDES } from '$lib/deck/slides.js';
  import { markdownToHtml } from '$lib/deck/markdown.js';

  const RAW = /** @type {Record<string, string>} */ (
    import.meta.glob('/deck-notes/*.md', { query: '?raw', import: 'default', eager: true })
  );
  /** @type {Record<string, string>} */
  const NOTES = Object.fromEntries(
    Object.entries(RAW).map(([path, md]) => [path.split('/').pop()?.replace(/\.md$/, '') ?? path, md]),
  );

  /** @param {string} [html] */
  const plain = (html) => (html ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

  const pages = SLIDES.map((s, n) => ({
    s, n,
    title: (s.h ?? s.id).replace(/<br\s*\/?>/gi, ' '),
    note: markdownToHtml(NOTES[s.id] ?? ''),
    /* under the slide: what it is, then what it says in a line */
    cap: [s.demoId ? `Live demo · ${s.demoId}` : '', plain(s.caption) || plain(s.body)].filter(Boolean).join(' — '),
  }));

  /* NOTES THAT ALWAYS FIT. A page cannot scroll, so a long note has to come
     down in size instead of running off the sheet: 11pt down to 7pt in half
     points, measured, the same trick the phone remote uses. */
  /** @type {HTMLElement | null} */
  let root = $state(null);
  /** slide ids whose notes are too long to sit beside the slide @type {string[]} */
  let dense = $state([]);
  $effect(() => {
    if (!root) return;
    const box = root;
    /** @param {HTMLElement} el @param {number} from @param {number} floor */
    const shrink = (el, from, floor) => { let size = from; el.style.fontSize = `${size}pt`;
      while (size > floor && el.scrollHeight > el.clientHeight + 1) { size -= 0.5; el.style.fontSize = `${size}pt`; }
      return el.scrollHeight <= el.clientHeight + 1; };
    const fit = () => {
      /** @type {string[]} */
      const next = [];
      for (const el of box.querySelectorAll('.pk-notes')) {
        if (!(el instanceof HTMLElement)) continue;
        const id = el.getAttribute('data-slide') ?? '';
        if (dense.includes(id)) { shrink(el, 10, 7.5); continue; }
        if (shrink(el, 11, 8)) continue;
        /* too long for a column beside the slide: the page turns over to the
           wide layout — slide on top, notes in columns under it */
        next.push(id);
      }
      if (next.length) dense = [...dense, ...next];
      box.setAttribute('data-fitted', 'true');
    };
    const raf = requestAnimationFrame(fit);
    document.fonts?.ready.then(fit).catch(() => {});
    return () => cancelAnimationFrame(raf);
  });
</script>

<svelte:head>
  <title>WAM-2026 — deck and notes</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="pk-print" bind:this={root} data-testid="print-deck">
  <section class="pk-page pk-cover" data-testid="print-cover">
    <h1>Web animation<br />and motion</h1>
    <p class="pk-sub">The deck and the speaker notes · {SLIDES.length} slides</p>
    <dl class="pk-meta">
      <div><dt>Talk</dt><dd>Key Clark</dd></div>
      <div><dt>Made for</dt><dd><code>Folklore Digital</code></dd></div>
      <div><dt>Date</dt><dd>17 September 2026</dd></div>
      <div><dt>Paper and live examples</dt><dd>wam-2026.netlify.app</dd></div>
    </dl>
    <p class="pk-note-cover">
      Every example in this deck is live running code, not a recording. The stills here are
      captured from those same demos.
    </p>
  </section>

  {#each pages as p (p.s.id)}
    <section class="pk-page" class:pk-dense={dense.includes(p.s.id)} data-testid="print-page-{p.s.id}">
      <header class="pk-ph">
        <span class="pk-pn">{String(p.n + 1).padStart(2, '0')}<i>/{SLIDES.length}</i></span>
        <span class="pk-pt">{p.title}</span>
        <span class="pk-pk">{[p.s.code, p.s.kicker].filter(Boolean).join(' · ')}</span>
      </header>
      <div class="pk-body">
        <div class="pk-notes" data-slide={p.s.id} data-testid="print-notes-{p.s.id}">
          {#if p.note}
            {@html p.note}
          {:else}
            <p class="pk-none">No notes for this slide.</p>
          {/if}
        </div>
        <div class="pk-shot" data-testid="print-shot-{p.s.id}">
          <div class="pk-fit"><Slide slide={p.s} live={false} /></div>
          {#if p.cap}<p class="pk-cap" data-testid="print-cap-{p.s.id}">{p.cap}</p>{/if}
        </div>
      </div>
    </section>
  {/each}
</div>

<style>
  /* Each .pk-page IS one A4 landscape sheet, margins included: the PDF is
     assembled from an image of each page, so the sheet carries its own
     margins rather than leaving them to a print dialog. */
  @page { size: A4 landscape; margin: 0; }

  .pk-print { background: #fff; color: #17181a; font-family: var(--sans, system-ui, sans-serif); }
  .pk-page { position: relative; width: 297mm; height: 210mm; margin: 0 auto 8mm; padding: 12mm;
    box-sizing: border-box;
    display: flex; flex-direction: column; gap: 5mm; overflow: hidden; background: #fff;
    break-after: page; page-break-after: always; }
  .pk-page:last-child { break-after: auto; page-break-after: auto; }

  .pk-ph { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: baseline; gap: 6mm;
    padding-bottom: 2mm; border-bottom: 0.5pt solid #c9ccc6; }
  .pk-pn { font-family: var(--mono, ui-monospace, monospace); font-size: 13pt; font-weight: 700; letter-spacing: 0.04em; }
  .pk-pn i { font-style: normal; font-size: 9pt; color: #83887f; }
  .pk-pt { font-size: 15pt; font-weight: 650; letter-spacing: -0.01em; }
  .pk-pk { font-family: var(--mono, ui-monospace, monospace); font-size: 8.5pt; letter-spacing: 0.1em;
    text-transform: uppercase; color: #83887f; text-align: right; }

  /* notes left, slide right — the slide keeps its 16:9 at a fixed width */
  .pk-body { flex: 1 1 auto; min-height: 0; display: grid; grid-template-columns: 340px 666px; gap: 26px; }

  .pk-notes { min-width: 0; font-size: 11pt; line-height: 1.45; overflow: hidden; }
  .pk-notes :global(ul) { margin: 0 0 3mm; padding-left: 4.4mm; }
  .pk-notes :global(li) { margin: 0 0 1.4mm; }
  .pk-notes :global(li > ul) { margin: 1.2mm 0 1.6mm; }
  .pk-notes :global(li > ul > li) { font-size: 10.2pt; color: #3d4046; }
  .pk-notes :global(strong) { font-weight: 700; color: #101114; }
  .pk-notes :global(em) { color: #3d4046; }
  .pk-notes :global(code) { font-family: var(--mono, ui-monospace, monospace); font-size: 9pt;
    background: #eef0ec; padding: 0 1mm; border-radius: 1mm; }
  .pk-notes :global(p) { margin: 0 0 2.5mm; }
  .pk-notes :global(h1), .pk-notes :global(h2), .pk-notes :global(h3) { font-size: 10.5pt; margin: 0 0 2mm; }
  .pk-notes .pk-none { color: #9aa094; font-style: italic; }

  /* the slide at its true 960 × 540, scaled to the column */
  /* 706 / 960: the slide at its true size, scaled to the column. The slide's
     own layers are absolutely positioned, so .pk-fit has to be their
     containing block or they anchor to the page and cover the notes. */
  .pk-shot { position: relative; }
  .pk-fit { position: relative; width: 960px; height: 540px; transform: scale(0.6938); transform-origin: 0 0;
    margin-bottom: calc(375px - 540px); }
  .pk-cap { margin: 5mm 0 0; font-size: 9pt; line-height: 1.4; color: #4a4e54; max-width: 165mm; }

  @media screen {
    .pk-print { padding: 8mm 0; background: #55584f; }
    .pk-page { box-shadow: 0 2mm 6mm rgba(0, 0, 0, 0.35); }
  }

  /* the cover */
  .pk-cover { justify-content: center; gap: 6mm; padding: 12mm 24mm; }
  .pk-cover h1 { color: #17181a; font-size: 40pt; line-height: 1.02; letter-spacing: -0.02em; margin: 0; font-weight: 700; }
  .pk-sub { margin: 0; font-family: var(--mono, ui-monospace, monospace); font-size: 10pt;
    letter-spacing: 0.08em; text-transform: uppercase; color: #6f7469; }
  .pk-meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 3mm 10mm; margin: 2mm 0 0; max-width: 150mm; }
  .pk-meta dt { font-family: var(--mono, ui-monospace, monospace); font-size: 8pt; letter-spacing: 0.1em;
    text-transform: uppercase; color: #83887f; }
  .pk-meta dd { margin: 0.6mm 0 0; font-size: 11.5pt; }
  .pk-meta code { font-family: var(--mono, ui-monospace, monospace); font-size: 10.5pt; background: #eef0ec; padding: 0 1mm; }
  .pk-note-cover { max-width: 150mm; margin: 4mm 0 0; font-size: 10pt; color: #3d4046; }

  /* the app shell is not part of the paper */
  :global(.topbar) { display: none !important; }
  :global(.content) { padding: 0 !important; margin: 0 !important; max-width: none !important; }
  :global(body), :global(.shell) { background: #fff !important; }
  @media print { :global(.shell) { display: block !important; } }

  /* the wide layout, for slides whose notes will not fit beside them */
  .pk-page.pk-dense .pk-body { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); gap: 6mm; }
  .pk-dense .pk-shot { order: -1; justify-self: center; }
  .pk-dense .pk-fit { transform: scale(0.5); margin-bottom: calc(270px - 540px); }
  .pk-dense .pk-cap { margin-top: 3mm; text-align: center; max-width: 220mm; }
  .pk-dense .pk-notes { column-count: 3; column-gap: 9mm; column-rule: 0.5pt solid #e2e4df; }
  .pk-dense .pk-notes :global(ul) { margin-top: 0; }
</style>
