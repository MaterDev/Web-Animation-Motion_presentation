<script module>
  /* SECTION MARKS — the pixel symbols from design/graphic-language,
     ported as static geometry. Same predicates, same 12 × 12 grid, no
     canvas and no motion.

     A mark is never drawn bare. It lives in a CHIP — the graphic-
     language key tile: a small LCD in the section's backlight, the mark
     centred and small, the sheet code tiny in the corner — and a chip is
     used one of two ways only: beside its section's heading (the heading
     takes the tint), or in the seven-chip ladder with exactly one on.
     Key, 2026-09-17: "subtle motifs, not big bold things." */
  const G = 12;
  /** @returns {boolean[][]} */
  const blank = () => Array.from({ length: G }, () => Array(G).fill(false));
  /**
   * @param {boolean[][]} g
   * @param {number} x0
   * @param {number} y0
   * @param {number} w
   * @param {number} h
   */
  function rect(g, x0, y0, w, h) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      const xi = Math.round(x), yi = Math.round(y);
      if (xi >= 0 && xi < G && yi >= 0 && yi < G) g[yi][xi] = true;
    }
    return g;
  }
  /**
   * @param {boolean[][]} g
   * @param {number} x0
   * @param {number} y0
   * @param {number} w
   * @param {number} h
   * @param {number} [t]
   */
  function rectOutline(g, x0, y0, w, h, t = 1) {
    rect(g, x0, y0, w, t); rect(g, x0, y0 + h - t, w, t);
    rect(g, x0, y0, t, h); rect(g, x0 + w - t, y0, t, h);
    return g;
  }
  /**
   * @param {boolean[][]} g
   * @param {number} x0
   * @param {number} y0
   * @param {number} size
   */
  function triRight(g, x0, y0, size) {
    for (let y = 0; y < size; y++) rect(g, x0, y0 + y, Math.min(y, size - 1 - y) + 1, 1);
    return g;
  }
  /**
   * @param {boolean[][]} g
   * @param {number} cx
   * @param {number} cy
   * @param {number} r
   */
  function circle(g, cx, cy, r) {
    for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) if (Math.hypot(x - cx, y - cy) <= r) g[y][x] = true;
    return g;
  }
  /**
   * @param {boolean[][]} g
   * @param {number} cx
   * @param {number} cy
   * @param {number} r
   */
  function diamondOutline(g, cx, cy, r) {
    for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
      const d = Math.abs(x - cx) + Math.abs(y - cy);
      if (d <= r && d > r - 2) g[y][x] = true;
    }
    return g;
  }
  /**
   * @param {boolean[][]} g
   * @param {number} x0
   * @param {number} y0
   * @param {number} x1
   * @param {number} y1
   */
  function line(g, x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0, n = Math.max(Math.abs(dx), Math.abs(dy));
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + (dx * i) / n), y = Math.round(y0 + (dy * i) / n);
      if (x >= 0 && x < G && y >= 0 && y < G) g[y][x] = true;
    }
    return g;
  }

  /** @type {Record<string, () => boolean[][]>} */
  const ICONS = {
    video: () => triRight(rectOutline(blank(), 1, 2, 10, 8, 1.2), 5, 4, 4),
    css: () => { const g = blank(); rect(g, 2, 2, 8, 2); rect(g, 2, 6, 6, 2); return rect(g, 2, 9, 4, 2); },
    composite: () => rectOutline(rectOutline(blank(), 1, 1, 7, 7, 1), 4, 4, 7, 7, 1),
    svg: () => { const g = blank(); line(g, 1, 9, 5, 3); line(g, 5, 3, 10, 7); circle(g, 1, 9, 1); circle(g, 5, 3, 1); return circle(g, 10, 7, 1); },
    canvas: () => { const g = blank(); rect(g, 3, 3, 2, 2); rect(g, 7, 3, 2, 2); rect(g, 3, 7, 2, 2); return rect(g, 7, 7, 2, 2); },
    webgl: () => line(diamondOutline(blank(), 5.5, 5.5, 5), 5.5, 1, 5.5, 10),
    webgpu: () => { const g = rect(blank(), 4, 4, 4, 4);
      line(g, 5, 1, 5, 3); line(g, 6, 1, 6, 3); line(g, 5, 8, 5, 10); line(g, 6, 8, 6, 10);
      line(g, 1, 5, 3, 5); line(g, 1, 6, 3, 6); line(g, 8, 5, 10, 5); line(g, 8, 6, 10, 6);
      return g; },
    /* gif: the video family's sprocket-strip glyph — frames, not film */
    gif: () => { const g = blank(); [1, 4, 7, 10].forEach((y) => rect(g, 2, y, 2, 2)); return g; },
  };

  /** @type {Map<string, [number, number][]>} */
  const cache = new Map();
  /**
   * Lit cells for a mark key.
   * @param {string} key
   * @returns {[number, number][]}
   */
  export function cellsFor(key) {
    if (cache.has(key)) return /** @type {[number, number][]} */ (cache.get(key));
    const draw = ICONS[key];
    /** @type {[number, number][]} */
    const out = [];
    if (draw) {
      const g = draw();
      for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) if (g[y][x]) out.push([x, y]);
    }
    cache.set(key, out);
    return out;
  }

  /** the seven-tint spectrum, in the order the home page's swatch bar runs */
  export const SPECTRUM = ['css', 'svg', 'video', 'canvas', 'webgl', 'webgpu', 'composite'];
  /** the motifs that are technique sections (and so get a chip) */
  const TECHNIQUE = new Set(['css', 'svg', 'gif', 'video', 'canvas', 'webgl', 'webgpu']);
  /**
   * @param {string} motif
   * @returns {boolean}
   */
  export const isTechnique = (motif) => TECHNIQUE.has(motif);

  /**
   * A placement on the 12 × 6 module field, as the layouts sheet states
   * them: start column, column span, start row, row span.
   * @param {number} c
   * @param {number} w
   * @param {number} r
   * @param {number} h
   * @returns {string}
   */
  export const at = (c, w, r, h) => `grid-column:${c} / span ${w};grid-row:${r} / span ${h}`;
</script>

<script>
  /* ONE SLIDE, AT ITS TRUE SIZE — 960 × 540, scaled by the caller.

     THE GRID IS THE LAYOUTS SHEET'S. The LCD fills the slide inside a
     one-cell (6px) bezel, and everything on it is placed on the 12 × 6
     field of 72px modules inside the 8-cell / 9-cell margins — measured
     from the slide edge, so the guides overlay still lines up. No
     gutters: space is an empty module. Type is the five whole-cell
     sizes (72 / 48 / 24 / 18 / 12) on whole-cell line heights.

     MATERIALS vary slide to slide, drawn from the system, so neighbours
     differ: LCD regions (the home index language), LED sub-panels
     (emissive, lit type, the 6px matrix), optical glass over the tinted
     screen, registration brackets, a section-head annotation rule, and
     a position indicator. Each section keeps its dominant screen tint.

     Notation — kicker, code, position, citations, status — lives in the
     margin bands, small and dim. */
  import { TINTS, SLIDES } from './slides.js';

  /** @typedef {import('./slides.js').Slide} Slide */
  /** @type {{ slide: Slide, live?: boolean, ex?: number, guides?: boolean }} */
  let { slide, live = false, ex = 0, guides = false } = $props();

  const example = $derived(slide.examples?.[Math.min(ex, slide.examples.length - 1)] ?? null);
  const demoUrl = $derived(example?.demo ?? slide.demo ?? null);

  /* PRISM (opening and close): a neutral screen with no dominant cast, and
     the section tints used as accents. Each prism slide starts the
     spectrum at a different point, so neighbours don't share an accent;
     `acc(n)` is the n-th accent on this slide. */
  const prism = $derived(!!slide.prism);
  const prismIdx = $derived(Math.max(0, SLIDES.filter((s) => s.prism).findIndex((s) => s.id === slide.id)));
  /** @param {number} n */
  const acc = (n) => `var(--tint-${SPECTRUM[(prismIdx + n) % SPECTRUM.length]})`;
  const tint = $derived(prism ? acc(0) : (slide.tint && TINTS[slide.tint]) || 'var(--led-ink)');
  const motif = $derived(slide.motif ?? slide.tint ?? 'composite');
  const mark = $derived(slide.mark ?? motif);
  const technique = $derived(isTechnique(motif));
  /* which spectrum chip is ON: gif lives in the video tint, gpu in webgpu */
  const onTint = $derived(motif === 'gif' ? 'video' : motif === 'webgl' ? 'webgpu' : motif);
  const chipCode = $derived(slide.code.split(' ')[0]);
  const L = $derived(slide.layout);
  const alt = $derived(!!slide.alt);
  /* slides that put content in glass: the LCD's sheen band is toned down
     on these, because the field sits in a stacking context below the
     sheen and a pane cannot rise above it to shield its own text */
  const glassy = $derived(L === 'framed' || L === 'compare' || (L === 'index' && alt));

  /* position within the run of slides sharing this code — a navigation
     indicator, drawn as lamps rather than words */
  const run = $derived(SLIDES.filter((s) => s.code === slide.code));
  const pos = $derived(run.findIndex((s) => s.id === slide.id));

  /** @param {string} s */
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  /** @param {number} n */
  const two = (n) => String(n).padStart(2, '0');

  /** @type {HTMLElement | null} */
  let probe = $state(null);
  let resolved = $state('#8899aa');
  $effect(() => {
    if (probe) resolved = getComputedStyle(probe).color || '#8899aa';
  });

  const src = $derived(
    live && demoUrl
      ? demoUrl + (demoUrl.includes('?') ? '&' : '?') + 'tint=' + encodeURIComponent(resolved)
      : ''
  );

  let failed = $state(false);
  $effect(() => {
    void demoUrl;
    failed = false;
    /** @param {MessageEvent} e */
    const onMsg = (e) => {
      if (e.data?.deck === 'error') failed = true;
    };
    addEventListener('message', onMsg);
    return () => removeEventListener('message', onMsg);
  });
</script>

<!-- heading: the section chip beside the dot-face title, tint carried
     into the type. Chip is 60px + 12px = exactly one module, so the
     title starts on the next column line. -->
{#snippet heading()}
  <div class="dk-head" class:dk-head-xl={L === 'screen'}>
    {#if technique}
      <span class="lcd-chip dk-chip" aria-hidden="true">
        <span class="lcd dk-chip-lcd">
          <span class="wash" style="background:{tint}"></span>
          <svg class="dk-mark" width="24" height="24" viewBox="0 0 12 12" shape-rendering="crispEdges">
            {#each cellsFor(mark) as [x, y] (x + ':' + y)}<rect {x} {y} width="1" height="1" />{/each}
          </svg>
          <span class="dk-chip-code">{chipCode}</span>
        </span>
      </span>
    {/if}
    <h2 class="dk-title" class:dk-tinted={technique} data-testid="slide-{slide.id}-title">{@html slide.h}</h2>
  </div>
{/snippet}

<!-- registration brackets from the system (.led-reg), on a framed subject -->
{#snippet reg()}<span class="led-reg" aria-hidden="true"><i></i><i></i><i></i><i></i></span>{/snippet}

<!-- section-head annotation: code tag, dotted rule, position — the
     system's .sec-head pattern drawn on the screen -->
{#snippet annot()}
  <div class="dk-annot" aria-hidden="true">
    <span class="dk-tag">{chipCode}</span>
    <span class="dk-dotrule"></span>
    <span class="dk-meta">{two(pos + 1)} / {two(run.length)}</span>
  </div>
{/snippet}

<div class="led-slide" class:guides style="--tint:{tint}" data-motif={motif} data-testid="slide-{slide.id}">
  <span class="probe" bind:this={probe} style="color:{tint}"></span>

  <div class="lcd-panel dk-screen" data-testid="screen-{slide.id}">
    <div class="well">
      <div class="lcd" class:dk-glassy={glassy}>
        <span class="dk-cast" class:dk-neutral={prism} aria-hidden="true"></span>

        <!-- top margin band: section name, position lamps, code -->
        <div class="dk-band dk-band-top">
          <span class="dk-kicker" data-testid="slide-{slide.id}-kicker">{slide.kicker ?? ''}</span>
          <span class="dk-band-r">
            {#if L !== 'screen' && L !== 'low' && run.length > 1}
              <span class="dk-lamps" aria-hidden="true">
                {#each run as s, n (s.id)}<span class="led" class:off={n !== pos} style="--c:var(--lcd-ink)"></span>{/each}
              </span>
            {/if}
            <span class="dk-code">{slide.code}</span>
          </span>
        </div>

        <div class="led-field dk-field">

          {#if L === 'screen'}
            <div class="dk-at" style={at(1, 11, 1, 2)}>{@render heading()}</div>
            {#if slide.body}
              <p class="dk-body" style={alt && technique ? at(7, 6, 3, 2) : at(technique ? 2 : 1, 6, 3, 2)} data-testid="slide-{slide.id}-body">{slide.body}</p>
            {/if}
            <div class="lcd-rule dk-rule-top" style={at(1, 12, 6, 1)}></div>
            {#if slide.strip && slide.showStrip}
              <div class="lcd-strip dk-strip dk-end" style={at(1, 7, 6, 1)} data-testid="slide-{slide.id}-strip">
                {#each slide.strip as [k, v] (k)}
                  <span class="lcd-kv"><span class="k">{k}</span><span class="v">{v}</span></span>
                {/each}
              </div>
            {/if}
            {#if technique || (prism && !slide.showStrip)}
              <!-- techniques: one chip on. mix and match: all seven on. -->
              <div class="dk-ladder dk-end" style={at(8, 5, 6, 1)} aria-hidden="true" data-testid="slide-{slide.id}-ladder">
                {#each SPECTRUM as t (t)}
                  <span class="lcd-chip dk-rung" class:dk-off={!prism && t !== onTint}>
                    <span class="lcd dk-chip-lcd">
                      <span class="wash" style="background:var(--tint-{t})"></span>
                      <svg class="dk-mark" width="24" height="24" viewBox="0 0 12 12" shape-rendering="crispEdges">
                        {#each cellsFor(t) as [x, y] (x + ':' + y)}<rect {x} {y} width="1" height="1" />{/each}
                      </svg>
                    </span>
                  </span>
                {/each}
              </div>
            {:else}
              <span class="dk-spectrum dk-end" style={at(10, 3, 6, 1)} aria-hidden="true">
                {#each SPECTRUM as t (t)}<span class="dk-pip" style="background:var(--tint-{t})"></span>{/each}
              </span>
            {/if}

          {:else if L === 'datum'}
            <!-- the stated share as a two-segment LED bar across the full
                 field width, each segment labelled on the figure. Row 3 is
                 the empty module between statement and figure. -->
            <div class="dk-at" style={at(1, 7, 1, 1)}>{@render heading()}</div>
            {#if slide.body}<p class="dk-body" style={at(1, 6, 2, 2)} data-testid="slide-{slide.id}-body">{slide.body}</p>{/if}
            {#if slide.graphic}
              {@const lit = Math.round((slide.graphic.lit / slide.graphic.of) * 100)}
              <div class="dk-led dk-share" style="{at(1, 12, 4, 3)};--ct:{tint};--lit:{lit}fr;--rest:{100 - lit}fr" data-testid="slide-{slide.id}-figure">
                <span class="dk-share-labels">
                  <span class="dk-share-label"><b>{lit}%</b><em>No click</em></span>
                  <span class="dk-share-label"><b>{100 - lit}%</b><em>Clicked</em></span>
                </span>
                <span class="dk-share-bar" aria-hidden="true">
                  <i class="dk-seg dk-seg-on"></i><i class="dk-seg dk-seg-off"></i>
                </span>
              </div>
            {/if}

          {:else if L === 'mirror'}
            {#if alt}
              <div class="dk-at" style={at(1, 5, 1, 3)}>{@render heading()}</div>
              <div class="dk-led dk-center" style="{at(7, 6, 1, 6)};--ct:{tint}">
                {#if slide.body}<p class="dk-led-body" data-testid="slide-{slide.id}-body">{slide.body}</p>{/if}
              </div>
            {:else}
              <div class="dk-rg dk-center" style="{at(1, 6, 1, 6)};--ct:{tint}">
                <span class="dk-rg-cast" aria-hidden="true"></span>
                {#if slide.body}<p class="dk-rg-note" data-testid="slide-{slide.id}-body">{slide.body}</p>{/if}
              </div>
              <div class="dk-at dk-end" style={at(8, 5, 4, 3)}>{@render heading()}</div>
            {/if}

          {:else if L === 'low'}
            {#if alt}
              <div class="dk-at" style={at(4, 9, 1, 1)}>{@render heading()}</div>
              {#if slide.body}<p class="dk-body" style={at(4, 7, 2, 2)} data-testid="slide-{slide.id}-body">{slide.body}</p>{/if}
              <div class="dk-at dk-end" style={at(1, 12, 6, 1)}>{@render annot()}</div>
            {:else if slide.items}
              <!-- the kit of parts, named: statement left, the parts as a §
                   readout right, motion (the last, and the point) lit -->
              <div class="dk-at" style={at(1, 6, 1, 1)}>{@render heading()}</div>
              {#if slide.body}<p class="dk-body" style={at(1, 5, 2, 4)} data-testid="slide-{slide.id}-body">{slide.body}</p>{/if}
              <div class="dk-rg dk-list" style="{at(7, 6, 1, 6)};--ct:{tint}" data-testid="slide-{slide.id}-items">
                <span class="dk-rg-cast" aria-hidden="true"></span>
                <span class="dk-rg-top">
                  <span class="dk-tag">{chipCode}</span>
                  <span class="dk-meta">{two(slide.items.length)}</span>
                </span>
                <span class="dk-readout">
                  {#each slide.items as it, n (it)}
                    {@const key = n === (slide.items?.length ?? 0) - 1}
                    <span class="dk-row" class:dk-row-key={key} class:dk-row-sw={prism} data-testid="slide-{slide.id}-item-{slug(it)}">
                      {#if prism}<span class="dk-sw" style="background:{acc(n + 1)}" aria-hidden="true"></span>{/if}
                      <span class="dk-idx">§{two(n + 1)}</span>
                      <span class="dk-name">{it}</span>
                      {#if key}<span class="led" style="--c:var(--ok)" aria-hidden="true"></span>{/if}
                    </span>
                  {/each}
                </span>
              </div>
            {:else}
              <div class="dk-at" style={at(1, 12, 1, 1)}>{@render annot()}</div>
              <div class="dk-at dk-end" style={at(1, 9, 4, 1)}>{@render heading()}</div>
              {#if slide.body}<p class="dk-body" style={at(1, 7, 5, 2)} data-testid="slide-{slide.id}-body">{slide.body}</p>{/if}
            {/if}

          {:else if L === 'framed'}
            <div class="glass-optical dk-glass dk-framed" style={at(3, 8, 2, 4)}>
              {#if prism}
                <!-- four corners, four section tints: the whole talk framing the question -->
                <span class="led-reg" aria-hidden="true">
                  {#each [1, 2, 3, 4] as k (k)}<i style="border-color:{acc(k)}"></i>{/each}
                </span>
              {:else}
                {@render reg()}
              {/if}
              {@render heading()}
              {#if slide.body}<p class="dk-rg-note" data-testid="slide-{slide.id}-body">{slide.body}</p>{/if}
            </div>

          {:else if L === 'index'}
            <div class="dk-at" style={alt ? at(9, 4, 1, 2) : at(1, 4, 1, 2)}>{@render heading()}</div>
            <div class={alt ? 'glass-optical dk-glass dk-list' : 'dk-rg dk-list'}
                 style="{alt ? at(1, 7, 1, 6) : at(6, 7, 1, 6)};--ct:{tint}" data-testid="slide-{slide.id}-list">
              {#if !alt}<span class="dk-rg-cast" aria-hidden="true"></span>{/if}
              <span class="dk-rg-top">
                <span class="dk-tag">{chipCode}</span>
                {#if slide.items}<span class="dk-meta">{slide.items.length} candidates</span>{/if}
              </span>
              <span class="dk-readout">
                {#each slide.items ?? [] as it, n (it)}
                  <span class="dk-row" data-testid="slide-{slide.id}-item-{slug(it)}">
                    <span class="dk-idx">§{two(n + 1)}</span>
                    <span class="dk-name">{it}</span>
                  </span>
                {/each}
              </span>
              {#if slide.placeholder}
                <span class="dk-rg-foot">
                  <span class="led off" style="--c:var(--ok)" aria-hidden="true"></span>
                  <span class="dk-meta">to choose</span>
                </span>
              {/if}
            </div>

          {:else if slide.compare && L === 'ledger'}
            <!-- two rows a module apart; the cost row on an LED strip -->
            <div class="dk-at" style={at(1, 11, 1, 1)}>{@render heading()}</div>
            {#each slide.compare as c, n (c.h)}
              <div class={n === 0 ? 'dk-rg dk-ledger' : 'dk-led dk-ledger'}
                   style="{n === 0 ? at(1, 12, 3, 1) : at(1, 12, 5, 2)};--ct:{tint}"
                   data-testid="slide-{slide.id}-side-{slug(c.h)}">
                {#if n === 0}<span class="dk-rg-cast" aria-hidden="true"></span>{/if}
                <span class="dk-tag">{two(n + 1)}</span>
                <span class="dk-rg-title">{c.h}</span>
                <span class="dk-rg-note">{c.body}</span>
              </div>
            {/each}

          {:else if slide.compare && L === 'pair'}
            {#if alt}<div class="dk-at" style={at(1, 9, 1, 1)}>{@render heading()}</div>
            {:else}<div class="dk-at dk-end" style={at(1, 6, 6, 1)}>{@render heading()}</div>{/if}
            {#each slide.compare as c, n (c.h)}
              {@const side = slide.sides?.[n]}
              {@const ct = side ? (TINTS[side.tint] ?? tint) : tint}
              {@const place = alt ? at(n === 0 ? 2 : 8, 5, 3, 4) : at(n === 0 ? 1 : 7, 5, 1, 4)}
              <div class={alt ? 'dk-rg dk-pair' : 'dk-led dk-pair'} style="{place};--ct:{ct};--tint:{ct}"
                   data-testid="slide-{slide.id}-side-{slug(c.h)}">
                {#if alt}<span class="dk-rg-cast" aria-hidden="true"></span>{@render reg()}{/if}
                <span class="dk-rg-top dk-float">
                  <span class="dk-rg-head">
                    {#if side}
                      <span class="lcd-chip dk-chip dk-chip-sm" aria-hidden="true">
                        <span class="lcd dk-chip-lcd">
                          <span class="wash" style="background:{ct}"></span>
                          <svg class="dk-mark" width="24" height="24" viewBox="0 0 12 12" shape-rendering="crispEdges">
                            {#each cellsFor(side.mark) as [x, y] (x + ':' + y)}<rect {x} {y} width="1" height="1" />{/each}
                          </svg>
                        </span>
                      </span>
                    {/if}
                    <span class="dk-rg-title dk-rg-tinted">{c.h}</span>
                  </span>
                  {#if side?.code}<span class="dk-meta">{side.code}</span>{/if}
                </span>
                <span class="dk-rg-note">{c.body}</span>
              </div>
            {/each}

          {:else if slide.compare && L === 'weighted'}
            <div class="dk-at" style={at(1, 4, 1, 2)}>{@render heading()}</div>
            {#each slide.compare as c, n (c.h)}
              {#if n === 0}
                <div class="dk-rg dk-rg-off dk-end-flex" style="{at(1, 4, 4, 3)};--ct:{tint}" data-testid="slide-{slide.id}-side-{slug(c.h)}">
                  <span class="dk-tag">{two(n + 1)}</span>
                  <span class="dk-rg-title">{c.h}</span>
                  <span class="dk-rg-note">{c.body}</span>
                </div>
              {:else}
                <div class="dk-led dk-end-flex" style="{at(6, 7, 1, 6)};--ct:{tint}" data-testid="slide-{slide.id}-side-{slug(c.h)}">
                  <span class="dk-tag">{two(n + 1)}</span>
                  <span class="dk-rg-title">{c.h}</span>
                  <span class="dk-rg-note">{c.body}</span>
                </div>
              {/if}
            {/each}

          {:else if slide.compare}
            <!-- two glass panes over the tinted screen, a module apart,
                 the right quarter of the field left empty -->
            <div class="dk-at" style={at(1, 10, 1, 1)}>{@render heading()}</div>
            {#each slide.compare as c, n (c.h)}
              <div class="glass-optical dk-glass dk-glass-tint" style="{at(n === 0 ? 1 : 6, 4, 3, 4)};--ct:{prism ? acc(n * 3) : tint}" data-testid="slide-{slide.id}-side-{slug(c.h)}">
                <span class="dk-tag">{two(n + 1)}</span>
                <span class="dk-rg-title">{c.h}</span>
                <span class="dk-rg-note">{c.body}</span>
              </div>
            {/each}

          {:else}
            <div class="dk-at" style={at(1, 9, 1, 2)}>{@render heading()}</div>
            {#if slide.body}<p class="dk-body" style={at(1, 7, 3, 2)} data-testid="slide-{slide.id}-body">{slide.body}</p>{/if}
          {/if}

          {#if demoUrl}
            <div class="dk-led" style={at(7, 6, 1, 6)} data-testid="well-{slide.id}">
              {#if src && !failed}
                <iframe {src} title="" tabindex="-1" data-testid="demo-{slide.id}"></iframe>
              {:else if failed}
                <span class="dk-meta">demo unavailable</span>
              {/if}
            </div>
          {/if}
        </div>

        <!-- bottom margin band: dev status and citations, quiet -->
        <div class="dk-band dk-band-bot">
          <span>{slide.sample ? 'sample' : slide.verify ? 'figures to verify' : ''}</span>
          <span>{#if slide.cite}<b class="dk-cite" data-testid="slide-{slide.id}-cite">{slide.cite.map((n) => `[${n}]`).join(' ')}</b>{/if}</span>
        </div>
      </div>
    </div>
  </div>

  <div class="led-guides"><span class="margin"></span><span class="field"></span></div>
</div>

<style>
  .probe { position: absolute; width: 0; height: 0; overflow: hidden; }

  /* ── the screen: fills the slide inside a one-cell bezel ─────── */
  .dk-screen { position: absolute; inset: 0; }
  .dk-screen > .well { display: block; box-sizing: border-box; height: 100%; padding: 6px; border-radius: 0; }
  .dk-screen .lcd { height: 100%; border-radius: 0; }
  /* Every slide's screen is cast in its section's tint, strongly enough
     to be the dominant colour (Key: "each section should have a
     dominant color treatment"). */
  .dk-cast { position: absolute; inset: 0; z-index: 1; pointer-events: none;
    background: color-mix(in oklch, var(--tint) 58%, transparent); }
  /* opening and close: no section cast — the LCD gently pulled toward a
     neutral grey so it reads as the device's base, not as teal */
  .dk-cast.dk-neutral { background: oklch(0.85 0.008 120 / 0.42); }
  /* accents on the neutral base */
  .dk-sw { display: block; width: 12px; height: 12px; border-radius: 1px; align-self: center;
    box-shadow: inset 0 0 0 1px oklch(0.2 0.05 130 / 0.3); }
  .dk-row.dk-row-sw { grid-template-columns: 24px 48px minmax(0, 1fr) auto; }
  .dk-glass.dk-glass-tint { background:
    linear-gradient(170deg, color-mix(in oklch, var(--ct) 30%, oklch(1 0 0 / 0.22)), oklch(1 0 0 / 0.14)); }
  .dk-glass-tint .dk-tag { background: oklch(from var(--ct) 0.34 calc(c * 2.4) h); }

  /* the field, re-anchored inside the bezel so it sits exactly where the
     layouts sheet puts it on the slide: 48 / 54 from the slide edge */
  .dk-field { inset: 48px 42px; z-index: 2; }
  .dk-at { min-width: 0; }
  .dk-end { align-self: end; }

  /* ── margin bands: notation, micro size, dim ─────────────────── */
  .dk-band { position: absolute; left: 42px; right: 42px; z-index: 2; display: flex; align-items: center;
    justify-content: space-between; gap: 18px; height: 18px;
    font-family: var(--mono); font-size: 12px; line-height: 18px; letter-spacing: 0.18em; text-transform: uppercase;
    color: var(--lcd-ink); }
  .dk-band-top { top: 12px; }
  .dk-band-bot { bottom: 12px; opacity: 0.55; }
  /* the section label is wayfinding: small, but contained so it is found
     at a glance — a translucent pane in the section accent with the
     system glass's tight top highlight and a light blur. Codes and
     citations stay uncontained and dim. */
  .dk-kicker {
    display: inline-block; padding: 0 12px; border-radius: 3px; font-weight: 700; letter-spacing: 0.16em;
    color: var(--lcd-ink);
    background: linear-gradient(170deg,
      color-mix(in oklch, oklch(from var(--tint) calc(l + 0.12) c h) 55%, oklch(1 0 0 / 0.25)),
      color-mix(in oklch, var(--tint) 30%, transparent));
    backdrop-filter: blur(6px) saturate(160%);
    box-shadow:
      inset 0 1px 0 oklch(1 0 0 / 0.7),
      inset 0 0 0 1px color-mix(in oklch, oklch(from var(--tint) 0.4 calc(c * 2) h) 45%, transparent),
      0 1px 6px oklch(0.2 0.02 265 / 0.14);
  }
  .dk-code { opacity: 0.45; }
  .dk-band-r { display: inline-flex; align-items: center; gap: 18px; }
  .dk-lamps { display: inline-flex; gap: 6px; }
  .dk-lamps :global(.led) { width: 6px; height: 6px; }
  .dk-cite { font-weight: inherit; }

  /* ── heading ─────────────────────────────────────────────────── */
  .dk-head { display: flex; align-items: flex-start; }
  .dk-title {
    font-family: var(--dot); font-variation-settings: 'ROND' 0; font-weight: 900;
    font-size: 48px; line-height: 48px; letter-spacing: 0.01em;
    color: var(--lcd-ink); text-transform: lowercase; margin: 0; min-width: 0;
  }
  .dk-head-xl .dk-title { font-size: 72px; line-height: 72px; letter-spacing: 0.005em; }
  .dk-head-xl .dk-chip { margin-top: 6px; }
  .dk-tinted { color: oklch(from var(--tint) 0.34 calc(c * 2.4) h); }

  /* body: 18 on 30, sans */
  .dk-body { margin: 0; font-family: var(--sans); font-size: 18px; line-height: 30px; font-weight: 500; color: var(--lcd-ink); }

  /* ── chips (flat on the screen: hairline ink frame, no recess) ── */
  .dk-chip { flex: none; margin-right: 12px; }
  .dk-chip > .dk-chip-lcd { position: relative; width: 54px; height: 54px; padding: 0; display: grid; place-items: center; }
  .dk-chip .wash { opacity: 0.7; }
  .dk-mark { position: relative; z-index: 2; display: block; fill: var(--lcd-ink); }
  .dk-chip-code { position: absolute; top: 3px; right: 4px; z-index: 2;
    font-family: var(--mono); font-size: 6.5px; letter-spacing: 0.1em; color: var(--lcd-dim); }
  .dk-chip-lcd .dk-mark { margin-top: 6px; }
  .dk-chip-sm { margin-right: 12px; }
  .dk-chip-sm > .dk-chip-lcd { width: 30px; height: 30px; }
  .dk-chip-sm .dk-mark { margin-top: 0; width: 18px; height: 18px; }

  .dk-ladder { display: flex; gap: 4px; }
  .dk-rung > .dk-chip-lcd { width: 42px; height: 30px; padding: 0; display: grid; place-items: center; position: relative; }
  .dk-rung .dk-mark { margin-top: 0; width: 18px; height: 18px; }
  .dk-rung .wash { opacity: 0.7; }
  .dk-off .wash { opacity: 0.06; filter: saturate(0.2); }
  /* A chip on an LCD is drawn by the screen, not set into it: a hairline
     ink frame rather than the system chip's dark recess. */
  .dk-chip, .dk-rung { background: none; box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--lcd-ink) 32%, transparent); padding: 3px; border-radius: 3px; }
  .dk-off { box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--lcd-ink) 14%, transparent); }
  .dk-off .dk-mark { opacity: 0.3; }

  /* ── opener foot ─────────────────────────────────────────────── */
  .dk-rule-top { align-self: start; }
  .dk-strip { gap: 36px; }
  .dk-strip .lcd-kv { gap: 0; }
  .dk-strip .k { font-family: var(--mono); font-size: 12px; line-height: 18px; font-weight: 700; letter-spacing: 0.14em; color: var(--lcd-ink); opacity: 0.7; }
  .dk-strip .v { font-family: var(--mono); font-size: 18px; line-height: 30px; font-weight: 700; color: var(--lcd-ink); }
  .dk-spectrum { display: flex; gap: 6px; justify-content: flex-end; padding-bottom: 6px; }
  .dk-pip { width: 18px; height: 12px; border-radius: 1px; box-shadow: inset 0 0 0 1px oklch(0.2 0.05 130 / 0.25); }

  /* ── LCD region (home index language) ────────────────────────── */
  .dk-rg {
    position: relative; overflow: hidden; display: flex; flex-direction: column; gap: 12px;
    padding: 18px; border-radius: 2px; color: var(--lcd-ink); min-width: 0; box-sizing: border-box;
    box-shadow: inset 0 0 0 var(--hair) var(--lcd-rule);
  }
  .dk-rg-cast { position: absolute; inset: 0; pointer-events: none;
    background: color-mix(in oklch, oklch(from var(--ct) calc(l - 0.1) calc(c * 1.4) h) 42%, transparent); }
  .dk-rg > :not(.dk-rg-cast):not(.led-reg):not(.dk-float) { position: relative; }
  .dk-rg-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .dk-rg-head { display: flex; align-items: center; }
  .dk-tag {
    align-self: flex-start;
    font-family: var(--mono); font-size: 12px; line-height: 18px; letter-spacing: 0.12em; font-weight: 700;
    color: var(--lcd-ground-top); background: color-mix(in oklch, var(--lcd-ink) 80%, transparent);
    padding: 0 6px; border-radius: 1px;
  }
  .dk-meta { font-family: var(--mono); font-size: 12px; line-height: 18px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--lcd-ink); opacity: 0.62; }
  .dk-rg-title { font-family: var(--mono); font-size: 24px; line-height: 30px; letter-spacing: 0.02em; color: var(--lcd-ink); text-transform: lowercase; }
  .dk-rg-tinted { color: oklch(from var(--ct) 0.34 calc(c * 2.4) h); }
  .dk-rg-note { margin: 0; font-family: var(--sans); font-size: 18px; line-height: 30px; font-weight: 500; color: var(--lcd-ink); }
  .dk-rg-foot { display: flex; align-items: center; gap: 12px; margin-top: auto; }
  .dk-rg-off .dk-rg-title, .dk-rg-off .dk-rg-note { opacity: 0.72; }
  .dk-center { justify-content: center; padding: 36px; }
  .dk-end-flex { justify-content: flex-end; }

  /* ── LED sub-panel: emissive, the 6px matrix, lit type ───────── */
  .dk-led {
    position: relative; overflow: hidden; display: flex; flex-direction: column; gap: 12px;
    padding: 18px; border-radius: 2px; box-sizing: border-box; min-width: 0;
    background: var(--led-ground); color: var(--led-ink);
    box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--ct, var(--tint)) 45%, transparent);
  }
  .dk-led::before { content: ''; position: absolute; inset: 0; pointer-events: none;
    background:
      repeating-linear-gradient(90deg, oklch(1 0 0 / 0.05) 0 1px, transparent 1px 6px),
      repeating-linear-gradient(0deg,  oklch(1 0 0 / 0.05) 0 1px, transparent 1px 6px); }
  .dk-led > * { position: relative; }
  .dk-led .dk-rg-title, .dk-led .dk-rg-tinted { color: oklch(from var(--ct) 0.84 calc(c * 2.2) h);
    text-shadow: 0 0 12px color-mix(in oklch, var(--ct) 45%, transparent); }
  .dk-led .dk-rg-note, .dk-led-body { color: var(--led-ink); opacity: 0.86; }
  .dk-led-body { margin: 0; font-family: var(--sans); font-size: 18px; line-height: 30px; }
  .dk-led .dk-tag { color: var(--led-ground); background: oklch(from var(--ct) 0.84 calc(c * 2.2) h); }
  .dk-led .dk-meta { color: var(--led-dim); opacity: 1; }
  .dk-led iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; background: transparent; display: block; }

  /* ── glass: the system's optical glass over the tinted screen ─── */
  /* Frosted, slightly: a few px of blur and a faint milky fill soften the
     pixel grid and cast behind so the type reads crisply; the system
     glass's bright white rim and screen-blend flare are dropped (they
     added to the glare) for one gentle top highlight. */
  .dk-glass { box-sizing: border-box; border-radius: 6px; padding: 18px; min-width: 0;
    display: flex; flex-direction: column; gap: 12px; color: var(--lcd-ink);
    background: linear-gradient(170deg, oklch(1 0 0 / 0.26), oklch(1 0 0 / 0.16));
    backdrop-filter: blur(4px) saturate(120%);
    box-shadow:
      inset 0 1px 0 oklch(1 0 0 / 0.45),
      inset 0 0 0 1px oklch(1 0 0 / 0.16),
      0 6px 18px oklch(0.2 0.02 265 / 0.12); }
  .dk-glass::before { opacity: 0.18; }
  /* the LCD sheen on a slide carrying glass: kept, but faint */
  .lcd.dk-glassy::after { opacity: 0.3; }
  .dk-glass > :not(.led-reg) { position: relative; }
  .dk-framed { padding: 36px; justify-content: center; gap: 18px; }
  .dk-framed .led-reg i { border-color: color-mix(in oklch, var(--lcd-ink) 55%, transparent); }

  /* ── compositions' furniture ─────────────────────────────────── */
  /* ledger rows: tag | label | body, on module-width tracks */
  .dk-ledger { display: grid; grid-template-columns: 54px 216px minmax(0, 1fr); column-gap: 0; align-items: center; padding: 0 18px; }
  .dk-ledger .dk-tag { align-self: center; justify-self: start; }

  .dk-pair { justify-content: flex-end; }
  .dk-pair .dk-float { position: absolute; top: 18px; left: 18px; right: 18px; }

  /* datum: a share as two LED segments, lit | off, labels sitting over
     the segment they name. Columns are fr of the share itself, so the
     label and the segment always start on the same line. */
  .dk-share { padding: 36px; justify-content: flex-end; gap: 12px; }
  .dk-share-labels, .dk-share-bar { display: grid; grid-template-columns: var(--lit) var(--rest); column-gap: 6px; }
  .dk-share-label { display: flex; align-items: baseline; gap: 12px; }
  .dk-share-label b { font-family: var(--mono); font-size: 24px; line-height: 30px; font-weight: 700;
    color: oklch(from var(--ct) 0.84 calc(c * 2.2) h); text-shadow: 0 0 12px color-mix(in oklch, var(--ct) 45%, transparent); }
  .dk-share-label em { font-family: var(--mono); font-style: normal; font-size: 12px; line-height: 18px;
    letter-spacing: 0.16em; text-transform: uppercase; color: var(--led-ink); opacity: 0.8; }
  .dk-share-bar { height: 60px; }
  .dk-seg { display: block; position: relative; }
  /* cells: 1px dark lines on the 6px pitch, so a segment is visibly LEDs */
  .dk-seg::after { content: ''; position: absolute; inset: 0;
    background:
      repeating-linear-gradient(90deg, oklch(0.12 0.012 265 / 0.55) 0 1px, transparent 1px 6px),
      repeating-linear-gradient(0deg,  oklch(0.12 0.012 265 / 0.55) 0 1px, transparent 1px 6px); }
  .dk-seg-on { background: oklch(from var(--ct) 0.84 calc(c * 2.2) h);
    box-shadow: 0 0 14px color-mix(in oklch, var(--ct) 50%, transparent); }
  /* off LEDs: clearly present, clearly unlit */
  .dk-seg-off { background: oklch(1 0 0 / 0.12); box-shadow: inset 0 0 0 1px oklch(1 0 0 / 0.28); }
  .dk-share-label:last-child b { opacity: 0.85; }

  /* the § readout */
  .dk-list { gap: 18px; }
  .dk-readout { display: flex; flex-direction: column; gap: 12px; padding: 18px 0;
    border-top: var(--hair) solid var(--lcd-rule); border-bottom: var(--hair) solid var(--lcd-rule); }
  .dk-row { display: grid; grid-template-columns: 54px minmax(0, 1fr) auto; align-items: baseline; }
  /* the row that is the point: inverted, like the region's own code tag */
  .dk-row-key { align-items: center; margin: 0 -6px; padding: 0 6px; border-radius: 1px;
    background: color-mix(in oklch, var(--lcd-ink) 12%, transparent);
    box-shadow: inset 2px 0 0 var(--lcd-ink); }
  .dk-row-key .dk-name { font-weight: 700; }
  .dk-idx, .dk-name { font-family: var(--mono); font-size: 18px; line-height: 30px; color: var(--lcd-ink); }
  .dk-idx { font-size: 12px; opacity: 0.72; letter-spacing: 0.12em; }
  .dk-name { text-transform: lowercase; }

  /* section-head annotation */
  .dk-annot { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 18px; }
  .dk-dotrule { height: 6px; opacity: 0.6;
    background: repeating-linear-gradient(90deg, var(--lcd-ink) 0 1px, transparent 1px 6px); }
</style>
