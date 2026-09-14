<script>
  /* THE REMOTE — a phone, on the same network, driving the deck.

     Designed for the phone first and not adapted down to it. The real
     use is one-handed, in a dim room, while talking to people: so the
     notes get the space, the controls sit in the thumb's reach at the
     bottom, and nothing that matters is more than a thumb away.

     Layout is a fixed 100dvh column — header, preview, notes, controls
     — with only the notes scrolling. A page that scrolls as a whole
     would move the buttons out from under the thumb mid-sentence.

     ⚠ The preview is NOT live — `live={false}`. A phone showing the
     current slide must never mount that slide's demo: a WebGL slide
     would then hold two contexts for one slide across two machines,
     and the phone would burn battery drawing a field nobody is
     looking at. The presenter sees the demo; the remote sees the
     composition.

     ⚠ The slide is scaled in JS, measured. A CSS `calc(100cqw / 960)`
     was tried first and silently does nothing — scale() takes a
     number, and that expression is a length — so the panel rendered
     at its full 960px and was cut off. */
  import Slide from '$lib/deck/Slide.svelte';
  import { SLIDES } from '$lib/deck/slides.js';
  import { getNotes, setState, watchState } from '$lib/deck/control.js';

  let i = $state(0);
  let ex = $state(0);
  /** @type {Record<string, string>} */
  let notes = $state({});
  let connected = $state(/** @type {boolean | null} */ (null));

  /** @type {HTMLDivElement | null} */
  let box = $state(null);
  let scale = $state(0);

  const slide = $derived(SLIDES[i]);
  const next = $derived(SLIDES[(i + 1) % SLIDES.length]);
  const exCount = $derived(slide?.examples?.length ?? 0);
  const note = $derived(notes[slide?.id] ?? '');

  $effect(() => {
    const stop = watchState((/** @type {any} */ s) => {
      connected = true; i = s.i; ex = s.ex ?? 0;
    });
    (async () => {
      const n = await getNotes();
      if (n) { notes = n; connected = true; } else connected = false;
    })();
    return stop;
  });

  /* Refresh notes whenever the slide changes — they are edited on the
     laptop while this page is open, and a stale note is worse than no
     note when you are reading it out loud. */
  $effect(() => {
    void i;
    (async () => { const n = await getNotes(); if (n) notes = n; })();
  });

  $effect(() => {
    if (!box) return;
    const el = box;
    const fit = () => { scale = el.getBoundingClientRect().width / 960; };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  });

  /** @param {number} n */
  const go = (n) => { i = (n + SLIDES.length) % SLIDES.length; ex = 0; setState({ i, ex }); };
  /** @param {number} n */
  const goEx = (n) => { if (exCount) { ex = (n + exCount) % exCount; setState({ i, ex }); } };
</script>

<svelte:head>
  <title>Remote — WAM-2026</title>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
  <meta name="robots" content="noindex" />
</svelte:head>

{#if connected === false}
  <div class="offline" data-testid="remote-offline">
    <h1>Remote unavailable</h1>
    <p>
      This is a presenter tool, not part of the published site — it needs the local
      dev server. Run <code>bun run dev</code> on the presenting machine and open
      this page from that machine's address on the same network.
    </p>
  </div>
{:else}
  <div class="remote" data-testid="remote">

    <header class="top">
      <span class="code" data-testid="remote-code">{slide.code}</span>
      <span class="kick">{slide.kicker ?? ''}</span>
      <span class="pos" data-testid="remote-pos">{i + 1}<i>/{SLIDES.length}</i></span>
    </header>

    <div class="preview" bind:this={box} data-testid="remote-preview">
      <div class="fit" style="transform:scale({scale})">
        <Slide {slide} {ex} live={false} />
      </div>
    </div>

    <div class="upnext">
      <span>Next</span>
      <b>{next.code} · {next.kicker ?? '—'}</b>
    </div>

    <!-- Forward/back rather than one button per example: a slide's
         example count is not known in advance, and a row of them runs
         off the screen and stops being readable. -->
    {#if exCount}
      <div class="exs" data-testid="remote-examples">
        <button class="exnav" onclick={() => goEx(ex - 1)}
          data-testid="remote-ex-prev" aria-label="Previous example">◀</button>
        <span class="exlabel">
          <b data-testid="remote-ex-label">{slide.examples?.[ex]?.label ?? ''}</b>
          <i>{ex + 1} / {exCount}</i>
        </span>
        <button class="exnav" onclick={() => goEx(ex + 1)}
          data-testid="remote-ex-next" aria-label="Next example">▶</button>
      </div>
    {/if}

    <!-- The only scrolling region. This is what gets read while
         talking, so it gets the leftover height and the largest type
         on the page. -->
    <section class="notes" data-testid="remote-notes">
      {#if note}
        <div class="n">{@html note}</div>
      {:else}
        <p class="none">No notes for this slide.</p>
      {/if}
    </section>

    <!-- Thumb zone. Big, fixed, and clear of the home indicator. -->
    <nav class="pad">
      <button class="side" onclick={() => go(i - 1)} data-testid="remote-prev" aria-label="Previous slide">◀</button>
      <button class="main" onclick={() => go(i + 1)} data-testid="remote-next">Next ▶</button>
    </nav>
  </div>
{/if}

<style>
  /* The page itself is the app; nothing below scrolls except .notes. */
  /* Covers the app's sticky topbar (z-index 40). This is a
     single-purpose device page — site navigation on a presenter's
     phone during a talk is clutter at best and a misfire at worst. */
  /* Flex, not a fixed grid template. The examples row is conditional,
     and with `grid-template-rows` the tracks stayed put while the
     children shifted up into them — so on a slide with no examples the
     notes took the `auto` track and the button row inherited the `1fr`
     and grew. Flex places by child, so a missing row cannot reassign
     anybody else's height. */
  .remote {
    position: fixed; inset: 0; z-index: 100;
    display: flex; flex-direction: column; gap: 10px;
    padding: max(10px, env(safe-area-inset-top)) 12px 0;
    background: var(--hz-000, #0b0d0e); overscroll-behavior: none;
  }
  .top, .preview, .upnext, .exs, .pad { flex: none; }

  .top { display: flex; align-items: baseline; gap: 9px;
    font-family: var(--mono); font-size: 11px; letter-spacing: 0.1em; }
  .code { color: var(--hz-900); font-weight: 600; }
  .kick { color: var(--hz-500); text-transform: uppercase; font-size: 10px;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pos { margin-left: auto; color: var(--hz-700); font-size: 15px; }
  .pos i { font-style: normal; color: var(--hz-400); font-size: 11px; }

  /* 16:9 exactly, full width, scaled in JS so it can never be cut off */
  .preview { width: 100%; aspect-ratio: 16 / 9; overflow: hidden;
    border-radius: 7px; background: var(--led-ground);
    box-shadow: 0 0 0 1px oklch(1 0 0 / 0.08); }
  .fit { width: 960px; height: 540px; transform-origin: 0 0; }

  .upnext { display: flex; align-items: baseline; gap: 8px;
    font-family: var(--mono); font-size: 10px; letter-spacing: 0.08em; }
  .upnext span { color: var(--hz-400); text-transform: uppercase; }
  .upnext b { color: var(--hz-600); font-weight: 400;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  /* Fixed height and a fixed shape, whatever the example is called. */
  .exs { display: grid; grid-template-columns: 52px minmax(0, 1fr) 52px; gap: 6px;
    height: 44px; }
  .exnav { border-radius: 8px; border: 1px solid var(--hz-300);
    background: var(--hz-100); color: var(--hz-700); font-size: 12px;
    -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
  .exnav:active { background: var(--hz-300); }
  .exlabel { display: flex; align-items: center; justify-content: center; gap: 8px;
    border-radius: 8px; background: var(--hz-050); border: 1px solid var(--hz-200);
    padding: 0 10px; min-width: 0; }
  .exlabel b { font-family: var(--mono); font-size: 12px; letter-spacing: 0.04em;
    color: var(--hz-800); font-weight: 400;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .exlabel i { font-style: normal; font-family: var(--mono); font-size: 10px;
    color: var(--hz-400); flex: none; }

  /* Reserved space, whatever the notes happen to say. The panel is the
     same size on a slide with one line and on a slide with twenty, so
     nothing below it moves between slides. */
  .notes { flex: 1 1 auto; min-height: 30vh; overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    border-top: 1px solid var(--hz-200); padding: 12px 0 4px; }
  /* Read at arm's length, in the dark, mid-sentence. */
  .n { font-family: var(--sans); font-size: 17px; line-height: 1.65; color: var(--hz-800); }
  .n :global(ul), .n :global(ol) { padding-left: 22px; margin: 10px 0; }
  .n :global(li) { margin: 5px 0; }
  .n :global(blockquote) { margin: 12px 0; padding-left: 12px;
    border-left: 3px solid var(--tint-svg); color: var(--hz-900); font-weight: 500; }
  .n :global(b), .n :global(strong) { color: var(--hz-900); }
  .none { color: var(--hz-400); font-size: 15px; margin: 0; }

  /* Fixed, not min-height: with short notes the 1fr row above has
     nothing to give, and buttons that change size between slides are
     buttons you have to look at to press. */
  .pad { display: grid; grid-template-columns: 82px minmax(0, 1fr); gap: 8px;
    padding: 10px 0 max(12px, env(safe-area-inset-bottom)); }
  .pad button { height: 62px; border-radius: 12px; border: 1px solid var(--hz-300);
    background: var(--hz-100); color: var(--hz-800); font-family: var(--mono);
    font-size: 15px; letter-spacing: 0.06em;
    -webkit-tap-highlight-color: transparent; touch-action: manipulation;
    user-select: none; }
  .pad button:active { transform: translateY(1px); background: var(--hz-300); }
  .main { font-weight: 600; background: var(--tint-svg) !important;
    border-color: var(--tint-svg) !important; color: oklch(0.14 0.01 150) !important; }

  .offline { max-width: 34rem; margin: 0 auto; padding: 56px 20px; }
  .offline h1 { font-size: 22px; margin: 0 0 10px; }
  .offline p { color: var(--hz-600); font-size: 15px; line-height: 1.7; }

  /* A tablet or a desktop browser gets the same thing, centred, rather
     than a stretched phone layout. */
  @media (min-width: 560px) and (orientation: portrait) {
    .remote { max-width: 520px; margin: 0 auto; }
  }

  /* LANDSCAPE PHONE — a phone turned sideways is a different device.
     Stacking would spend the whole height on a 16:9 preview and leave
     the notes a two-line slot, which is backwards: the notes are the
     thing being read. So the preview and the controls take one column
     and the notes take the other, full height. */
  @media (orientation: landscape) and (max-height: 560px) {
    .remote {
      display: grid; column-gap: 14px; row-gap: 8px;
      grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
      grid-template-rows: auto auto auto 1fr auto;
      grid-template-areas:
        "top     notes"
        "preview notes"
        "exs     notes"
        "gap     notes"
        "pad     notes";
      padding: max(8px, env(safe-area-inset-top))
               max(12px, env(safe-area-inset-right))
               0
               max(12px, env(safe-area-inset-left));
    }
    .top { grid-area: top; }
    .preview { grid-area: preview; }
    .exs { grid-area: exs; }
    .notes { grid-area: notes; min-height: 0; border-top: 0; padding-top: 0; }
    .pad { grid-area: pad; }
    /* what's next is a nicety; the notes are not */
    .upnext { display: none; }
    .pad { padding-bottom: max(8px, env(safe-area-inset-bottom)); }
    .pad button { height: 52px; }
    .n { font-size: 15.5px; line-height: 1.6; }
  }
</style>
