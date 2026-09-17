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
  import { markdownToHtml } from '$lib/deck/markdown.js';

  let i = $state(0);
  let ex = $state(0);
  let deckMode = $state('grid');
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
      connected = true; i = s.i; ex = s.ex ?? 0; deckMode = s.mode ?? deckMode;
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

  /* THE REMOTE NEVER SCROLLS, EITHER WAY UP. Key: "resize the containers
     and contents so that there is no vertical scrolling in horizontal" —
     "or in vertical … when the url bar is there in mobile chrome the page
     is too tall … it needs to be based on whatever is available after the
     dynamic viewport height." The page is pinned to 100dvh (see .remote),
     so every container is sized to what is actually visible with the
     address bar showing. What can still overflow is the notes, so their
     type steps down until they fit — portrait 20px to a 14px floor,
     landscape 18px to 13px — re-fitted whenever the slide, the notes or
     the screen change. Only notes too long even at the floor scroll, and
     only inside their own panel. */
  /** @type {HTMLElement | null} */
  let notesEl = $state(null);
  let noteSize = $state(0);
  $effect(() => {
    if (!notesEl) return;
    const el = notesEl;
    void note;
    const land = matchMedia('(orientation: landscape) and (max-height: 560px)');
    const fitNotes = () => {
      const body = el.firstElementChild instanceof HTMLElement ? el.firstElementChild : null;
      if (!body) return;
      const [top, floor] = land.matches ? [18, 13] : [20, 14];
      let size = top;
      body.style.fontSize = `${size}px`;
      while (size > floor && body.scrollHeight > el.clientHeight) { size -= 0.5; body.style.fontSize = `${size}px`; }
      noteSize = size;
    };
    const raf = requestAnimationFrame(fitNotes);
    const ro = new ResizeObserver(fitNotes);
    ro.observe(el);
    land.addEventListener('change', fitNotes);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); land.removeEventListener('change', fitNotes); };
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
  /* Start or stop presenting on the laptop. The deck covers its window at
     once; true fullscreen needs a click or F on the laptop itself, which is
     a browser rule, not a choice. */
  /* JUMP TO ANY SLIDE. Key, 2026-09-15: "in the mobile app … a thing in
     the top middle of the header bar that opens up a little window that
     lets me select any slide and immediately jump to it. make sure it has
     an exit button." One tap on a row moves the deck there and closes the
     window; ✕, the scrim and Esc all close it without moving anything. */
  let jumping = $state(false);
  /** @param {number} n */
  const jumpTo = (n) => { go(n); jumping = false; };
  /** @param {KeyboardEvent} e */
  const onKey = (e) => { if (jumping && e.key === 'Escape') jumping = false; };

  const togglePresent = () => {
    deckMode = deckMode === 'present' ? 'open' : 'present';
    setState({ i, ex, mode: deckMode });
  };
</script>

<svelte:window onkeydown={onKey} />

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
  {#if jumping}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="scrim" onclick={() => { jumping = false; }} data-testid="remote-jump-scrim"></div>
    <div class="picker" role="dialog" aria-modal="true" aria-label="Jump to slide" data-testid="remote-jump-panel">
      <div class="picker-h">
        <b>Jump to slide</b>
        <button class="close" onclick={() => { jumping = false; }} aria-label="Close" data-testid="remote-jump-close">✕</button>
      </div>
      <ol class="picker-list">
        {#each SLIDES as s, n (s.id)}
          <li>
            <button class="row" class:on={n === i} onclick={() => jumpTo(n)} data-testid="remote-jump-{s.id}">
              <!-- The real slide, static and at a tenth: pick by what it looks
                   like, not only by its code. Never live, for the same reason
                   the preview above is not. -->
              <span class="thumb" aria-hidden="true">
                <span class="thumb-fit"><Slide slide={s} live={false} /></span>
                <span class="num">{n + 1}</span>
              </span>
              <span class="rtext">
                <!-- the slide's own title first; the section label under it -->
                <span class="rc"><span class="rt">{(s.h ?? s.id).replace(/<br\s*\/?>/gi, ' ')}</span>{#if n === i}<span class="now">now</span>{/if}</span>
                <span class="rk">{[s.code, s.kicker].filter(Boolean).join(' · ')}</span>
              </span>
            </button>
          </li>
        {/each}
      </ol>
    </div>
  {/if}

  <div class="remote" data-testid="remote">
   <div class="left">

    <header class="top">
      <span class="id">
        <span class="code" data-testid="remote-code">{slide.code}</span>
        <span class="kick">{slide.kicker ?? ''}</span>
      </span>
      <span class="mid">
        <button class="jump" onclick={() => { jumping = true; }} aria-haspopup="dialog"
          aria-expanded={jumping} data-testid="remote-jump">Slides ▾</button>
        <!-- portrait: present sits beside the slide selector (Key) -->
        <button class="jump present-mini" class:on={deckMode === 'present'} onclick={togglePresent}
          data-testid="remote-present-mini" aria-pressed={deckMode === 'present'}
          aria-label={deckMode === 'present' ? 'Exit presenting' : 'Present fullscreen'}>
          {deckMode === 'present' ? '✕ Exit' : '▶ Present'}
        </button>
      </span>
      <span class="pos" data-testid="remote-pos">{i + 1}<i>/{SLIDES.length}</i></span>
    </header>

    <button class="present" class:on={deckMode === 'present'} onclick={togglePresent}
      data-testid="remote-present" aria-pressed={deckMode === 'present'}>
      {deckMode === 'present' ? '✕  Exit presenting' : '▶  Present fullscreen'}
    </button>

    <div class="stagerow">
      <!-- portrait: prev and next flank the thumbnail (Key) -->
      <button class="flank flank-prev" onclick={() => go(i - 1)} data-testid="remote-prev-flank" aria-label="Previous slide">◀</button>
      <div class="preview" bind:this={box} data-testid="remote-preview">
        <div class="fit" style="transform:scale({scale})">
          <Slide {slide} {ex} live={false} />
        </div>
      </div>
      <button class="flank flank-next" onclick={() => go(i + 1)} data-testid="remote-next-flank" aria-label="Next slide">▶</button>
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

    <!-- Thumb zone. Big, fixed, and clear of the home indicator. -->
    <nav class="pad">
      <button class="side" onclick={() => go(i - 1)} data-testid="remote-prev" aria-label="Previous slide">◀</button>
      <button class="main" onclick={() => go(i + 1)} data-testid="remote-next" aria-label="Next slide"><span class="next-word">Next </span>▶</button>
    </nav>
   </div>

    <!-- The only scrolling region. This is what gets read while
         talking, so it gets the leftover height and the largest type
         on the page. -->
    <section class="notes" bind:this={notesEl} data-noted-size={noteSize || undefined} data-testid="remote-notes">
      {#if note}
        <div class="n">{@html markdownToHtml(note)}</div>
      {:else}
        <p class="none">No notes for this slide.</p>
      {/if}
    </section>


  </div>
{/if}

<style>
  /* LIGHT MODE OF THE SYSTEM, WITH THE CONTRAST TURNED UP. Key,
     2026-09-15: "high contrast, light mode, easy reading since i am using
     it on my mobile device" — and then "a little softer instead of stark
     white … a light mode implementation of what we were using before,
     just better contrast." So this is the `hz` ramp mirrored rather than
     a new look: the same cool hue (265) and near-zero chroma, the ground
     a soft off-white instead of #fff, the ink dark enough to read at
     arm's length, the same mono labels at readable sizes, and the
     system's sage tint on the button that matters. The slide preview
     stays as it is, because it is the slide. */
  .remote, .offline {
    --r-bg:   oklch(0.965 0.004 265);   /* ground — soft, not white */
    --r-soft: oklch(0.930 0.005 265);   /* controls, the quote */
    --r-line: oklch(0.840 0.006 265);   /* borders and rules */
    --r-dim:  oklch(0.420 0.008 265);   /* labels — still ~6:1 on the ground */
    --r-ink:  oklch(0.200 0.008 265);   /* text — ~14:1 on the ground */
    --r-tint: var(--tint-svg, oklch(0.66 0.05 145));
    --r-tint-deep: oklch(0.46 0.06 145);
    color-scheme: light;
    background: var(--r-bg);
    color: var(--r-ink);
  }

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
  /* 100dvh, not inset: 0. A fixed box pinned to all four edges takes the
     LARGE viewport in mobile Chrome, so with the address bar showing its
     bottom — the thumb pad — sat under the fold. dvh is the height that is
     actually visible, and it follows the bar as it shows and hides. */
  .remote {
    position: fixed; top: 0; left: 0; right: 0; z-index: 100;
    height: 100svh; height: 100dvh; overflow: hidden;
    display: flex; flex-direction: column; gap: 12px;
    padding: max(12px, env(safe-area-inset-top)) 14px 0;
    overscroll-behavior: none;
  }
  .top, .present, .preview, .upnext, .exs, .pad { flex: none; }
  /* The left column only exists in landscape; in portrait its children
     sit straight in the page's column. The thumb pad is moved last with
     `order`, so it stays at the bottom under the notes. */
  .left { display: contents; }
  .stagerow { display: contents; }
  .flank { display: none; }
  .pad { order: 10; }

  /* Present / exit, full width under the header: the one control used
     before the talk starts and after it ends, so it sits away from the
     thumb pad and cannot be hit mid-sentence by mistake. */
  .present { height: 48px; border-radius: 12px; border: 1.5px solid var(--r-line);
    background: var(--r-soft); color: var(--r-ink); font-family: var(--mono);
    font-size: 15px; font-weight: 700; letter-spacing: 0.04em;
    -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
  .present:active { background: var(--r-line); }
  .present.on { background: oklch(0.52 0.15 28); border-color: oklch(0.52 0.15 28); color: oklch(0.985 0.003 265); }

  /* Three columns so the jump button sits dead centre whatever the slide's
     title is: code and title shrink on the left, position holds the right. */
  .top { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: center; gap: 10px; font-family: var(--mono); }
  .id { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
  .jump { height: 36px; padding: 0 14px; border-radius: 18px; border: 1.5px solid var(--r-line);
    background: var(--r-soft); color: var(--r-ink); font-family: var(--mono); font-size: 13px;
    font-weight: 700; letter-spacing: 0.04em; white-space: nowrap;
    -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
  .jump:active { background: var(--r-line); }
  .mid { display: flex; align-items: center; gap: 6px; }
  .present-mini.on { background: oklch(0.52 0.15 28); border-color: oklch(0.52 0.15 28); color: oklch(0.985 0.003 265); }
  /* Portrait: the full-width present bar goes (its control lives in the
     header now) and the preview shrinks, so the notes get the height. */


  /* The jump window: a scrim over the remote and a light panel that fits
     the visible screen, its list scrolling inside it. */
  .scrim { position: fixed; top: 0; left: 0; right: 0; height: 100svh; height: 100dvh; z-index: 110;
    background: oklch(0.2 0.01 265 / 0.35); }
  .picker { position: fixed; z-index: 120; left: 12px; right: 12px; top: max(12px, env(safe-area-inset-top));
    max-height: calc(100dvh - 24px); display: flex; flex-direction: column;
    background: var(--r-bg); color: var(--r-ink); border: 1.5px solid var(--r-line); border-radius: 16px;
    box-shadow: 0 18px 50px oklch(0.2 0.01 265 / 0.25); overflow: hidden; color-scheme: light;
    --r-bg: oklch(0.965 0.004 265); --r-soft: oklch(0.930 0.005 265); --r-line: oklch(0.840 0.006 265);
    --r-dim: oklch(0.420 0.008 265); --r-ink: oklch(0.200 0.008 265); --r-tint: var(--tint-svg, oklch(0.66 0.05 145));
    --r-tint-deep: oklch(0.46 0.06 145); }
  @media (min-width: 560px) { .picker { left: 50%; right: auto; width: 480px; translate: -50% 0; } }
  .picker-h { display: flex; align-items: center; justify-content: space-between;
    padding: 10px 10px 10px 16px; border-bottom: 1.5px solid var(--r-line); flex: none; }
  .picker-h b { font-family: var(--mono); font-size: 14px; letter-spacing: 0.06em; text-transform: uppercase; }
  .close { width: 44px; height: 44px; border-radius: 12px; border: 1.5px solid var(--r-line);
    background: var(--r-soft); color: var(--r-ink); font-size: 18px; font-weight: 700;
    -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
  .close:active { background: var(--r-line); }
  .picker-list { list-style: none; margin: 0; padding: 6px; overflow-y: auto; -webkit-overflow-scrolling: touch;
    flex: 1 1 auto; min-height: 0; }
  .row { width: 100%; display: grid; grid-template-columns: 96px minmax(0, 1fr); align-items: center;
    gap: 12px; min-height: 66px; padding: 6px 10px; border: 0; border-radius: 10px; background: none;
    color: var(--r-ink); text-align: left; font-family: var(--mono);
    -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
  .row:active { background: var(--r-soft); }
  .row.on { background: color-mix(in oklch, var(--r-tint) 32%, var(--r-bg)); }
  /* 96 × 54 is exactly a tenth of the 960 × 540 slide. */
  .thumb { position: relative; width: 96px; height: 54px; overflow: hidden; border-radius: 5px;
    background: var(--led-ground); box-shadow: 0 0 0 1px var(--r-line); }
  .row.on .thumb { box-shadow: 0 0 0 2.5px var(--r-tint-deep, oklch(0.46 0.06 145)); }
  .thumb-fit { position: absolute; left: 0; top: 0; width: 960px; height: 540px;
    transform: scale(0.1); transform-origin: 0 0; pointer-events: none; }
  .num { position: absolute; left: 4px; bottom: 3px; min-width: 16px; padding: 1px 4px; border-radius: 4px;
    background: oklch(0.98 0.003 265 / 0.92); color: var(--r-ink); font-size: 11px; font-weight: 700;
    text-align: center; line-height: 1.3; }
  .rtext { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
  .rc { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; }
  .rt { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--sans); font-weight: 700; }
  .rk { font-size: 12px; color: var(--r-dim); font-family: var(--sans); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .now { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--r-ink);
    padding: 1px 6px; border-radius: 4px; background: var(--r-bg); }
  .code { color: var(--r-ink); font-size: 15px; font-weight: 700; letter-spacing: 0.06em; white-space: nowrap; flex: none; }
  .kick { color: var(--r-dim); text-transform: uppercase; font-size: 12px; letter-spacing: 0.06em; min-width: 0;
    font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pos { justify-self: end; color: var(--r-ink); font-size: 20px; font-weight: 700; }
  .pos i { font-style: normal; color: var(--r-dim); font-size: 14px; font-weight: 600; }

  /* 16:9 exactly, full width, scaled in JS so it can never be cut off */
  .preview { width: 100%; aspect-ratio: 16 / 9; overflow: hidden;
    border-radius: 8px; background: var(--led-ground);
    box-shadow: 0 0 0 1.5px var(--r-line), 0 6px 18px oklch(0.2 0.01 265 / 0.12); }
  .fit { width: 960px; height: 540px; transform-origin: 0 0; }

  .upnext { display: flex; align-items: baseline; gap: 8px;
    font-family: var(--mono); font-size: 13px; letter-spacing: 0.04em; }
  .upnext span { color: var(--r-dim); text-transform: uppercase; font-weight: 600; }
  .upnext b { color: var(--r-ink); font-weight: 600;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  /* Fixed height and a fixed shape, whatever the example is called. */
  .exs { display: grid; grid-template-columns: 56px minmax(0, 1fr) 56px; gap: 8px;
    height: 50px; }
  .exnav { border-radius: 10px; border: 1.5px solid var(--r-line);
    background: var(--r-soft); color: var(--r-ink); font-size: 16px;
    -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
  .exnav:active { background: var(--r-line); }
  .exlabel { display: flex; align-items: center; justify-content: center; gap: 8px;
    border-radius: 10px; background: var(--r-bg); border: 1.5px solid var(--r-line);
    padding: 0 12px; min-width: 0; }
  .exlabel b { font-family: var(--mono); font-size: 14px; letter-spacing: 0.02em;
    color: var(--r-ink); font-weight: 700;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .exlabel i { font-style: normal; font-family: var(--mono); font-size: 13px;
    color: var(--r-dim); font-weight: 600; flex: none; }

  /* Reserved space, whatever the notes happen to say. The panel is the
     same size on a slide with one line and on a slide with twenty, so
     nothing below it moves between slides. */
  .notes { flex: 1 1 auto; min-height: 0; overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    border-top: 1.5px solid var(--r-line); padding: 14px 2px 6px; }
  /* Read at arm's length, mid-sentence: big, dark, generous leading. */
  .n { font-family: var(--sans); font-size: 20px; line-height: 1.6; color: var(--r-ink); }
  .n :global(p) { margin: 0 0 12px; }
  .n :global(ul), .n :global(ol) { padding-left: 24px; margin: 10px 0; }
  .n :global(li) { margin: 6px 0; }
  .n :global(blockquote) { margin: 14px 0; padding: 10px 14px;
    border-left: 4px solid var(--r-tint-deep); background: var(--r-soft);
    color: var(--r-ink); font-weight: 600; border-radius: 0 8px 8px 0; }
  .n :global(blockquote p) { margin: 0; }
  .n :global(b), .n :global(strong) { color: var(--r-ink); font-weight: 800; }
  .none { color: var(--r-dim); font-size: 17px; margin: 0; }

  /* Fixed, not min-height: with short notes the 1fr row above has
     nothing to give, and buttons that change size between slides are
     buttons you have to look at to press. */
  .pad { display: grid; grid-template-columns: 88px minmax(0, 1fr); gap: 10px;
    padding: 12px 0 max(14px, env(safe-area-inset-bottom)); }
  .pad button { height: 66px; border-radius: 14px; font-family: var(--mono);
    font-size: 18px; letter-spacing: 0.04em; font-weight: 700;
    -webkit-tap-highlight-color: transparent; touch-action: manipulation;
    user-select: none; }
  .pad button:active { transform: translateY(1px); }
  .side { border: 1.5px solid var(--r-line); background: var(--r-soft); color: var(--r-ink); }
  .side:active { background: var(--r-line); }
  /* The system's sage, as before, with dark ink on it: ~5:1, and the one
     button on the page that is meant to be found without looking. */
  .main { border: 1.5px solid var(--r-tint-deep); background: var(--r-tint); color: oklch(0.16 0.02 150); }
  .main:active { background: color-mix(in oklch, var(--r-tint) 80%, black); }

  .offline { position: fixed; top: 0; left: 0; right: 0; height: 100svh; height: 100dvh; overflow-y: auto; z-index: 100; padding: 56px 22px; }
  .offline h1 { font-size: 26px; margin: 0 0 12px; color: var(--r-ink); max-width: 34rem; }
  .offline p { color: var(--r-ink); font-size: 18px; line-height: 1.6; max-width: 34rem; }
  .offline code { background: var(--r-soft); padding: 1px 6px; border-radius: 4px; }

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
    /* Two columns, both exactly the screen's height. The left one is a
       flex column: header, present, examples and the thumb pad take their
       fixed heights, and the 16:9 preview takes what is left — its width
       follows from that height, so the column can never grow past the
       screen. The right column is the notes, fitted by type size in JS. */
    .remote {
      display: grid; column-gap: 16px;
      grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
      grid-template-rows: minmax(0, 1fr);
      padding: max(8px, env(safe-area-inset-top))
               max(14px, env(safe-area-inset-right))
               0
               max(14px, env(safe-area-inset-left));
    }
    .left { display: flex; flex-direction: column; gap: 6px; min-height: 0; height: 100%; }
    .top { flex: none; }
    .present { flex: none; height: 38px; font-size: 13px; }
    .present-mini { display: none; }
    .preview { flex: 1 1 auto; min-height: 0; width: auto; max-width: 100%; aspect-ratio: 16 / 9;
      align-self: center; height: auto; }
    .exs { flex: none; height: 40px; }
    .upnext { display: none; }
    .pad { flex: none; padding: 6px 0 max(8px, env(safe-area-inset-bottom)); }
    .pad button { height: 50px; font-size: 16px; }
    .notes { min-height: 0; height: 100%; border-top: 0; padding: 4px 0 8px; }
    .n { line-height: 1.5; }
  }

  /* Portrait (Key): the present control lives in the header beside the
     slide selector, and the preview shrinks so the notes get the height.
     Last in the sheet so it wins over the base .preview and .present. */
  @media (orientation: portrait) {
    .remote .present { display: none; }
    .remote .preview { align-self: center; }
    .remote .top { grid-template-columns: minmax(0, 1fr) auto auto; }
  }
  /* Portrait (Key): prev and next flank the slide thumbnail, so the
     notes run all the way to the bottom with nothing floating over them. */
  @media (orientation: portrait) {
    .remote .pad { display: none; }
    .remote .stagerow { display: grid; grid-template-columns: minmax(0, 1fr) 58% minmax(0, 1fr); align-items: stretch; gap: 10px; flex: none; }
    .remote .stagerow .preview { width: 100%; align-self: center; }
    .remote .flank { display: block; border-radius: 14px; border: 1.5px solid var(--r-line); background: var(--r-soft); color: var(--r-ink);
      font-size: 24px; -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
    .remote .flank:active { background: var(--r-line); }
    .remote .flank-next { border-color: var(--r-tint-deep); background: var(--r-tint); color: oklch(0.16 0.02 150); }
    .remote .notes { padding-bottom: max(14px, env(safe-area-inset-bottom)); }
  }
</style>
