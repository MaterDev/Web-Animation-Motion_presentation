<script>
  /* THE PRESENTATION SURFACE — viewer and workbench in one.

     Three states, one deck:
       grid     every slide at once, nothing running
       open     one slide enlarged, its demo live, notes beside it
       present  fullscreen, one slide, no chrome at all

     Only the slide being shown is ever live (see Slide.svelte), so
     the cost of the deck does not grow with its length.

     ⚠ Fullscreen goes on the OUTER wrapper, never on the scaled
     stage. requestFullscreen() on a descendant of a transformed
     ancestor leaves the transform hierarchy and stretches to the
     viewport's aspect — measured: a 480×270 stage came back 1400×900
     with its modules the wrong size. Invisible on a laptop, wrong on
     a projector. The wrapper is unscaled, so it is safe to promote. */
  import Slide from '$lib/deck/Slide.svelte';
  import Notes from '$lib/deck/Notes.svelte';
  import { SLIDES } from '$lib/deck/slides.js';
  import { getInfo, getNotes, putNote, setState, watchState } from '$lib/deck/control.js';

  let mode = $state('grid');          // 'grid' | 'open' | 'present'
  let i = $state(0);
  /** @type {Record<string, string>} */
  let notes = $state({});
  let guides = $state(false);
  /** @type {HTMLDivElement | null} */
  let shell = $state(null);
  /** @type {HTMLDivElement | null} */
  let stageBox = $state(null);
  let scale = $state(1);
  let ex = $state(0);              // which example a gallery slide is showing

  const slide = $derived(SLIDES[i]);
  const showing = $derived(mode !== 'grid');

  /* Notes live in a file on disk, served by the dev API, so the phone
     can read them and so they outlive the browser. localStorage is the
     fallback for the built static site, where there is no API — the
     deck still works, the notes are just local to that browser. */
  $effect(() => {
    (async () => {
      const n = await getNotes();
      if (n) { notes = n; return; }
      try { notes = JSON.parse(localStorage.getItem('wam-deck-notes') ?? '{}'); } catch { notes = {}; }
    })();
  });
  /** @param {string} html */
  const saveNote = async (html) => {
    notes = { ...notes, [slide.id]: html };
    try { localStorage.setItem('wam-deck-notes', JSON.stringify(notes)); } catch { /* private mode */ }
    await putNote(slide.id, html);     // throws if there is no dev server; Notes reports it
  };

  /* The phone and the laptop are the same deck. Whoever moves, moves
     both — the laptop pushes on every change, and listens for the
     phone doing the same. */
  let remoteUrl = $state('');
  $effect(() => {
    const stop = watchState((/** @type {any} */ st) => {
      if (st.i !== i) { i = st.i; ex = st.ex ?? 0; }
      else if (st.ex !== ex) ex = st.ex;
    });
    (async () => {
      const info = await getInfo();
      if (info?.urls?.length) remoteUrl = info.urls[0] + '/presentation/remote';
    })();
    return stop;
  });
  $effect(() => { setState({ i, ex, mode }); });

  /* Fit the 960-wide stage to whatever box it is in. */
  $effect(() => {
    if (!stageBox || !showing) return;
    const box = stageBox;
    const fit = () => {
      const r = box.getBoundingClientRect();
      scale = Math.min(r.width / 960, r.height / 540);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  });

  /** @param {number} n */
  const go = (n) => { i = (n + SLIDES.length) % SLIDES.length; ex = 0; };
  const exCount = $derived(slide.examples?.length ?? 0);
  /** @param {number} n */
  const goEx = (n) => { if (exCount) ex = (n + exCount) % exCount; };
  /** @param {number} n */
  const open = (n) => { go(n); mode = 'open'; };

  async function present() {
    mode = 'present';
    try { await shell?.requestFullscreen?.(); } catch { /* denied — still presents in-page */ }
  }
  async function leave() {
    if (document.fullscreenElement) { try { await document.exitFullscreen(); } catch { /* ignore */ } }
    mode = 'grid';
  }
  $effect(() => {
    const onFs = () => { if (!document.fullscreenElement && mode === 'present') mode = 'grid'; };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  });

  /** @param {KeyboardEvent} e */
  function key(e) {
    if (!showing) return;
    /* Left/right move through the deck. Up/down move through a
       gallery slide's examples WITHOUT advancing — the point of that
       slide is to stop presenting and start browsing, so the two have
       to be different keys or the talk loses its place. */
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); go(i + 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(i - 1); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); goEx(ex + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); goEx(ex - 1); }
    else if (/^[1-9]$/.test(e.key) && exCount) { e.preventDefault(); goEx(+e.key - 1); }
    else if (e.key === 'Escape') leave();
    else if (e.key === 'g' && mode === 'open') guides = !guides;
  }
</script>

<svelte:head><title>Presentation — WAM-2026</title></svelte:head>
<svelte:window onkeydown={key} />

<div class="shell" bind:this={shell} class:presenting={mode === 'present'} data-testid="deck">
  {#if mode === 'grid'}
    <div class="wrap">
      <div class="bar">
        <div>
          <p class="mono kicker">Presentation · {SLIDES.length} slides</p>
          <h1>the deck</h1>
        </div>
        <div class="acts">
          {#if remoteUrl}
            <a class="remote-link" href="/presentation/remote" data-testid="remote-link">
              <b>Remote ▸</b><em>{remoteUrl.replace('http://', '')}</em>
            </a>
          {/if}
          <button class="go" onclick={() => { go(0); present(); }} data-testid="present">Present ▸</button>
        </div>
      </div>
      <p class="lead">
        Every slide is real HTML at 960 × 540 on the system's own <code>.led-slide</code>.
        Click one to open it. Content is placeholder — the surface is the thing being built.
      </p>

      <div class="grid" data-testid="overview">
        {#each SLIDES as s, n (s.id)}
          <button class="tile" onclick={() => open(n)} data-testid="tile-{s.id}">
            <span class="thumb"><span class="fit"><Slide slide={s} live={false} /></span></span>
            <span class="cap">
              <b>{s.code}</b>
              <em>{s.kicker}</em>
              {#if notes[s.id]}<i class="dot" title="has notes"></i>{/if}
            </span>
          </button>
        {/each}
      </div>
    </div>

  {:else}
    <div class="view" class:full={mode === 'present'}>
      <div class="stage" bind:this={stageBox} data-testid="stage">
        <div class="fit" style="transform:scale({scale})">
          <Slide {slide} {ex} {guides} live={true} />
        </div>
      </div>

      {#if mode === 'present'}
        <!-- Presenting chrome: nothing but a way out. It fades unless
             the pointer is near it, so the audience never sees a menu
             but the presenter is never trapped either. Esc works too,
             but Esc is invisible and a borrowed laptop is not the
             moment to rely on a shortcut nobody can see. -->
        <div class="exit-zone">
          <button class="exit" onclick={leave} data-testid="exit">✕ Exit</button>
          <span class="pos-live">{i + 1} / {SLIDES.length}{exCount ? ` · ex ${ex + 1}/${exCount}` : ''}</span>
        </div>
      {/if}

      {#if mode === 'open'}
        <aside class="side" data-testid="sidebar">
          <div class="side-h">
            <button class="lnk" onclick={() => { mode = 'grid'; }} data-testid="back">← All slides</button>
            <span class="pos">{i + 1} / {SLIDES.length}</span>
          </div>
          <div class="nav">
            <button onclick={() => go(i - 1)} data-testid="prev">← Prev</button>
            <button onclick={() => go(i + 1)} data-testid="next">Next →</button>
            <button class:on={guides} onclick={() => { guides = !guides; }} data-testid="guides">Grid</button>
            <button class="go" onclick={present} data-testid="present-open">Present ▸</button>
          </div>
          {#if exCount}
            <div class="exs" data-testid="example-switcher">
              <span class="nl">Examples · ↑↓ or 1–{exCount}</span>
              {#each slide.examples as e, n (e.label)}
                <button class="ex" class:on={n === ex} onclick={() => goEx(n)}
                  data-testid="ex-{n}">{n + 1}. {e.label}</button>
              {/each}
            </div>
          {/if}

          <span class="nl">Notes · {slide.code}</span>
          <Notes id={slide.id} html={notes[slide.id] ?? ''} onsave={saveNote} />
          <p class="tip">← → slides · ↑ ↓ examples · G grid · Esc leave</p>
        </aside>
      {/if}
    </div>
  {/if}
</div>

<style>
  .shell { min-height: 100%; }
  /* Presenting covers the viewport whether or not the Fullscreen API
     granted anything — position:fixed does the covering, fullscreen
     only removes the browser's own chrome on top of it. So a denied
     or dismissed fullscreen degrades to a full-window presentation
     rather than a slide floating in a page with a nav bar above it. */
  .shell.presenting {
    position: fixed; inset: 0; z-index: 900; background: #000;
    display: grid; place-items: center;
  }

  .wrap { max-width: 1280px; margin: 0 auto; padding: calc(var(--u)*8) calc(var(--u)*5) calc(var(--u)*12); }
  .bar { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; margin-bottom: 10px; }
  .kicker { margin: 0 0 6px; }
  h1 { font-size: clamp(30px, 5vw, 52px); margin: 0; }
  .lead { max-width: 60ch; color: var(--hz-600); margin: 0 0 calc(var(--u)*6); }

  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: calc(var(--u)*3); }
  .tile { display: block; padding: 0; border: 0; background: none; cursor: pointer; text-align: left; }
  /* The thumbnail is the real slide, scaled — not an approximation of
     one. 1/3 exactly, so the 6px cell lands on 2 whole pixels. */
  .thumb { display: block; width: 320px; max-width: 100%; aspect-ratio: 16/9; overflow: hidden;
    border-radius: 5px; box-shadow: var(--edge, 0 0 0 1px oklch(1 0 0 / 0.08)), 0 6px 18px oklch(0 0 0 / 0.35);
    transition: box-shadow var(--dur-fast) var(--ease-standard); }
  .tile:hover .thumb { box-shadow: 0 0 0 1px var(--hz-400), 0 10px 26px oklch(0 0 0 / 0.5); }
  .thumb .fit { display: block; transform: scale(0.3333); transform-origin: 0 0; }
  .cap { display: flex; align-items: baseline; gap: 8px; padding-top: 9px; }
  .cap b { font-family: var(--mono); font-size: 10px; letter-spacing: 0.12em; color: var(--hz-700); font-weight: 400; }
  .cap em { font-style: normal; font-family: var(--mono); font-size: 10px; letter-spacing: 0.08em; color: var(--hz-500); }
  .cap .dot { width: 5px; height: 5px; border-radius: 50%; background: var(--tint-svg); margin-left: auto; }

  .view { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: calc(var(--u)*4);
    max-width: 1440px; margin: 0 auto; padding: calc(var(--u)*6) calc(var(--u)*5); align-items: start; }
  /* Presenting: the view fills the viewport, and the 16:9 stage is
     centred inside it. The scale is min(w/960, h/540), so the slide
     grows to the largest 16:9 rectangle that fits and the leftover
     becomes black bar — letterbox on a tall window, pillarbox on a
     wide one. The slide's own proportions never change. */
  .view.full { grid-template-columns: 1fr; gap: 0; max-width: none; padding: 0;
    width: 100vw; height: 100vh; place-items: center; }

  .stage { display: grid; place-items: center; width: 100%; aspect-ratio: 16/9; }
  .view.full .stage { width: 100vw; height: 100vh; aspect-ratio: auto; }
  .stage .fit { width: 960px; height: 540px; transform-origin: center; }

  .exit-zone { position: fixed; top: 0; right: 0; padding: 14px 18px; z-index: 950;
    display: flex; align-items: center; gap: 12px;
    opacity: 0.12; transition: opacity var(--dur-base) var(--ease-standard); }
  .exit-zone:hover, .exit-zone:focus-within { opacity: 1; }
  .exit { background: oklch(1 0 0 / 0.1); border-color: oklch(1 0 0 / 0.22); color: oklch(0.96 0 0); }
  .exit:hover { background: oklch(1 0 0 / 0.2); border-color: oklch(1 0 0 / 0.4); }
  .pos-live { font-family: var(--mono); font-size: 10px; letter-spacing: 0.12em;
    color: oklch(1 0 0 / 0.5); }

  .side { display: flex; flex-direction: column; gap: 10px; padding-top: 4px; }
  .side-h { display: flex; align-items: center; justify-content: space-between; }
  .pos { font-family: var(--mono); font-size: 10px; letter-spacing: 0.1em; color: var(--hz-500); }
  .lnk { background: none; border: 0; padding: 0; cursor: pointer; font-family: var(--mono);
    font-size: 10px; letter-spacing: 0.1em; color: var(--hz-500); }
  .lnk:hover { color: var(--hz-800); }

  .nav { display: flex; flex-wrap: wrap; gap: 6px; }
  button { font-family: var(--mono); font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase;
    padding: 7px 11px; border-radius: 5px; border: var(--hair) solid var(--hz-300);
    background: var(--hz-100); color: var(--hz-700); cursor: pointer;
    transition: background var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard); }
  button:hover { background: var(--hz-200); border-color: var(--hz-400); }
  button.on { background: var(--hz-300); color: var(--hz-900); }
  button.go { background: var(--tint-svg); border-color: var(--tint-svg); color: oklch(0.14 0.01 150); font-weight: 600; }

  .exs { display: flex; flex-direction: column; align-items: flex-start; gap: 4px;
    margin-top: 6px; max-height: 22vh; overflow-y: auto; }
  .ex { text-transform: none; letter-spacing: 0.04em; font-size: 10.5px; padding: 5px 9px; }
  .ex.on { background: var(--hz-300); color: var(--hz-900); border-color: var(--hz-500); }

  .nl { font-family: var(--mono); font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase;
    color: var(--hz-500); margin-top: 8px; }
  .acts { display: flex; align-items: center; gap: 10px; }
  /* The phone cannot follow a relative link typed on a laptop, so the
     LAN address is printed rather than hidden behind the anchor. */
  .remote-link { display: flex; flex-direction: column; gap: 2px; text-decoration: none;
    padding: 7px 12px; border-radius: 5px; border: var(--hair) solid var(--hz-300);
    background: var(--hz-100); }
  .remote-link:hover { border-color: var(--hz-400); background: var(--hz-200); }
  .remote-link b { font-family: var(--mono); font-size: 10px; letter-spacing: 0.1em;
    text-transform: uppercase; color: var(--hz-700); font-weight: 400; }
  .remote-link em { font-family: var(--mono); font-style: normal; font-size: 9px;
    letter-spacing: 0.04em; color: var(--hz-500); }

  .tip { font-family: var(--mono); font-size: 9px; letter-spacing: 0.1em; color: var(--hz-400); margin: 0; }

  @media (max-width: 900px) { .view { grid-template-columns: 1fr; } }
</style>
