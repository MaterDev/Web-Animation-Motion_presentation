<script module>
  /* The employer's name gets an inline-code treatment wherever a slide
     uses it (Key). Body text is escaped first, so {@html} only ever
     emits the one <code> this adds. */
  /** @param {string} t @returns {string} */
  export const brand = (t) =>
    t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c)
      .replace(/Folklore Digital|folklore\.digital/g, (m) => `<code class="dk-brand">${m}</code>`);

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
  import DemoHost from './DemoHost.svelte';
  /* the GIF opener shows the format itself: the slime stickers, as files */
  import gifIdle from '$lib/demos/gif/stickers/assets/slime-idle.gif?url';
  import gifEat from '$lib/demos/gif/stickers/assets/slime-eat.gif?url';
  import gifHappy from '$lib/demos/gif/stickers/assets/slime-happy.gif?url';
  import gifSleep from '$lib/demos/gif/stickers/assets/slime-sleep.gif?url';
  const GIFS = [gifHappy, gifEat, gifIdle, gifSleep];
  /* the site's QR code, generated once (qrcode 1.5.4, error level M) so the
     deck needs no QR library at runtime */
  import qrSvg from './assets/qr-wam-2026.svg?raw';

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
  /** which opener composition a `screen` slide uses (see slides.js `shape`) */
  const shape = $derived(slide.shape ?? '');
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

<!-- the seven-chip ladder: exactly one on for a technique -->
{#snippet ladder()}
  <div class="dk-ladder" aria-hidden="true" data-testid="slide-{slide.id}-ladder">
    {#each SPECTRUM as t (t)}
      <span class="lcd-chip dk-rung" class:dk-off={t !== onTint}>
        <span class="lcd dk-chip-lcd">
          <span class="wash" style="background:var(--tint-{t})"></span>
          <svg class="dk-mark" width="24" height="24" viewBox="0 0 12 12" shape-rendering="crispEdges">
            {#each cellsFor(t) as [x, y] (x + ':' + y)}<rect {x} {y} width="1" height="1" />{/each}
          </svg>
        </span>
      </span>
    {/each}
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

  {#if L !== 'full'}
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
            {#if slide.code.toLowerCase() !== (slide.kicker ?? '').toLowerCase()}<span class="dk-code">{slide.code}</span>{/if}
          </span>
        </div>

        <div class="led-field dk-field">

          {#if L === 'screen' && shape === 'stack'}
            <!-- css: title, dek indented under it, rule and ladder at the foot -->
            <div class="dk-at" style={at(1, 11, 1, 2)}>{@render heading()}</div>
            {#if slide.body}<p class="dk-body" style={at(2, 6, 3, 2)} data-testid="slide-{slide.id}-body">{@html brand(slide.body)}</p>{/if}
            <div class="lcd-rule dk-rule-top" style={at(1, 12, 6, 1)}></div>
            <div class="dk-at dk-end" style={at(8, 5, 6, 1)}>{@render ladder()}</div>

          {:else if L === 'screen' && shape === 'right'}
            <!-- svg: ladder foot-left, dek set low on the right -->
            <div class="dk-at" style={at(1, 11, 1, 2)}>{@render heading()}</div>
            {#if slide.body}<p class="dk-body" style={at(7, 6, 4, 2)} data-testid="slide-{slide.id}-body">{@html brand(slide.body)}</p>{/if}
            <div class="dk-at dk-end" style={at(1, 5, 6, 1)}>{@render ladder()}</div>

          {:else if L === 'screen' && shape === 'led'}
            <!-- gif: the loop that cannot be switched off — the dek on an
                 emissive LED panel with its lamp permanently lit -->
            <div class="dk-at" style={at(1, 11, 1, 2)}>{@render heading()}</div>
            {#if slide.blocks}
              <!-- two points on dark LED panels, and the format itself: four
                   real GIFs looping, with no way to stop them -->
              {#each slide.blocks as b, n (b.h)}
                <div class="dk-led dk-gifpt" style="{at(1, 6, n === 0 ? 3 : 5, 2)};--ct:{tint}" data-testid="slide-{slide.id}-block-{n + 1}">
                  <span class="dk-gifpt-h">{b.h}</span>
                  <p class="dk-led-body dk-gifpt-b">{@html brand(b.body)}</p>
                </div>
              {/each}
              <div class="dk-gifs" style={at(8, 5, 3, 4)} aria-label="Four looping GIFs" data-testid="slide-{slide.id}-gifs">
                {#each GIFS as g (g)}<span class="dk-gif"><img src={g} alt="" /></span>{/each}
                <span class="dk-gifs-cap">.gif · 256 colours · no controls</span>
              </div>
            {:else}
              <div class="dk-led dk-center" style="{at(2, 6, 3, 3)};--ct:{tint}">
                {#if slide.body}<p class="dk-led-body" data-testid="slide-{slide.id}-body">{@html brand(slide.body)}</p>{/if}
              </div>
            {/if}

          {:else if L === 'screen' && shape === 'frame'}
            <!-- video: the dek in a bracketed frame, like a player's picture area -->
            <div class="dk-at" style={at(1, 11, 1, 2)}>{@render heading()}</div>
            {#if slide.blocks}
              <!-- two explanatory blocks side by side (Key: combined slide, two blocks) -->
              {#each slide.blocks as b, n (b.h)}
                <div class="dk-rg dk-center dk-block" class:dk-block-l={n === 0} class:dk-block-r={n === 1} style="{at(n === 0 ? 1 : 7, 6, 3, 3)};--ct:{tint}" data-testid="slide-{slide.id}-block-{n + 1}">
                  <span class="dk-rg-cast" aria-hidden="true"></span>
                  <span class="dk-rg-title">{b.h}</span>
                  <p class="dk-rg-note">{@html brand(b.body)}</p>
                </div>
              {/each}
            {:else}
            <div class="dk-rg dk-center" style="{at(6, 7, 3, 3)};--ct:{tint}">
              <span class="dk-rg-cast" aria-hidden="true"></span>
              {@render reg()}
              {#if slide.body}<p class="dk-rg-note" data-testid="slide-{slide.id}-body">{@html brand(slide.body)}</p>{/if}
            </div>
            {/if}
            <div class="dk-at dk-end" style={at(1, 5, 6, 1)}>{@render ladder()}</div>

          {:else if L === 'screen' && shape === 'low'}
            <!-- canvas: ladder first along the top, title below it, dek at the foot -->
            <div class="dk-at" style={at(8, 5, 1, 1)}>{@render ladder()}</div>
            <div class="dk-at" style={at(1, 11, 2, 2)}>{@render heading()}</div>
            {#if slide.body}<p class="dk-body" style={at(2, 7, 5, 2)} data-testid="slide-{slide.id}-body">{@html brand(slide.body)}</p>{/if}

          {:else if L === 'screen' && shape === 'panel'}
            <!-- graphics card: an LED panel across the lower field, the dek
                 and the ladder both inside it -->
            <div class="dk-at" style={at(1, 11, 1, 2)}>{@render heading()}</div>
            <div class="dk-led dk-gpu" style="{at(1, 12, 4, 3)};--ct:{tint}">
              <!-- a graphics card, exploded like the composite graphic: the
                   shroud with its fans, the heatsink fins, the board with its
                   memory and edge connector. Layers breathe apart and back;
                   fans turn slowly. -->
              <div class="gpu-fig" aria-hidden="true" data-testid="slide-{slide.id}-gpu-figure">
                <div class="gpu-iso">
                  <div class="gpu-pl gpu-board"><span class="gpu-tag">board</span>
                    {#each [0, 1, 2, 3] as k (k)}<i class="gpu-chip" style="--k:{k}"></i>{/each}
                    <i class="gpu-die"></i><i class="gpu-pcie"></i>
                  </div>
                  <div class="gpu-pl gpu-sink"><span class="gpu-tag">heatsink</span><i class="gpu-fins"></i></div>
                  <div class="gpu-pl gpu-shroud"><span class="gpu-tag">shroud</span>
                    <i class="gpu-fan" style="--f:0"><b></b></i><i class="gpu-fan" style="--f:1"><b></b></i>
                  </div>
                </div>
              </div>
              <div class="gpu-copy">
              {#if slide.body}<p class="dk-led-body" data-testid="slide-{slide.id}-body">{@html brand(slide.body)}</p>{/if}
              <div class="dk-gpu-ladder">{@render ladder()}</div>
              </div>
            </div>

          {:else if L === 'screen' && shape === 'points'}
            <!-- friction: the four obstacles, one per row, in a warm region.
                 The body is split at sentence ends only; the words are its own. -->
            <div class="dk-at" style={at(1, 7, 1, 2)}>{@render heading()}</div>
            <div class="dk-rg dk-list" style="{at(8, 5, 1, 6)};--ct:{tint}" data-testid="slide-{slide.id}-body">
              <span class="dk-rg-cast" aria-hidden="true"></span>
              <span class="dk-readout dk-points">
                {#each (slide.body ?? '').split(/(?<=\.)\s+/) as sentence, n (sentence)}
                  <span class="dk-row"><span class="dk-idx">§{two(n + 1)}</span><span class="dk-rg-note">{sentence}</span></span>
                {/each}
              </span>
            </div>
            <div class="lcd-rule dk-rule-top" style={at(1, 6, 6, 1)}></div>
            <span class="dk-spectrum dk-end dk-start" style={at(1, 3, 6, 1)} aria-hidden="true">
              {#each SPECTRUM as t (t)}<span class="dk-pip" style="background:var(--tint-{t})"></span>{/each}
            </span>

          {:else if L === 'screen' && shape === 'mix'}
            <!-- mix and match: the seven chips, all on, gathered into one
                 region beside the statement — the combination is the figure -->
            <div class="dk-at" style={at(1, 8, 1, 1)}>{@render heading()}</div>
            {#if slide.body}<p class="dk-body" style={at(1, 6, 3, 3)} data-testid="slide-{slide.id}-body">{@html brand(slide.body)}</p>{/if}
            <div class="dk-rg dk-mix" style={at(8, 5, 2, 4)} aria-hidden="true" data-testid="slide-{slide.id}-ladder">
              {#each SPECTRUM as t (t)}
                <span class="lcd-chip dk-chip dk-mix-chip">
                  <span class="lcd dk-chip-lcd">
                    <span class="wash" style="background:var(--tint-{t})"></span>
                    <svg class="dk-mark" width="24" height="24" viewBox="0 0 12 12" shape-rendering="crispEdges">
                      {#each cellsFor(t) as [x, y] (x + ':' + y)}<rect {x} {y} width="1" height="1" />{/each}
                    </svg>
                  </span>
                </span>
              {/each}
            </div>
            <div class="lcd-rule dk-rule-top" style={at(1, 12, 6, 1)}></div>
            <span class="dk-spectrum dk-end" style={at(10, 3, 6, 1)} aria-hidden="true">
              {#each SPECTRUM as t (t)}<span class="dk-pip" style="background:var(--tint-{t})"></span>{/each}
            </span>

          {:else if L === 'screen' && shape === 'card'}
            <!-- thank you: where to go next, as a region you could point at -->
            <div class="dk-at" style={at(1, 8, 1, 1)}>{@render heading()}</div>
            {#if slide.body}<p class="dk-body" style={slide.qr ? at(1, 6, 3, 2) : at(1, 4, 3, 2)} data-testid="slide-{slide.id}-body">{@html brand(slide.body)}</p>{/if}
            {#if slide.qr && slide.strip}
              <!-- with a QR code the card would repeat the address, so the
                   strip becomes one quiet line under the body -->
              <p class="dk-qr-meta" style={at(1, 6, 5, 1)} data-testid="slide-{slide.id}-strip">
                {#each slide.strip as [k, v] (k)}<span><span class="k">{k}</span> {@html brand(v)}</span>{/each}
              </p>
            {/if}
            {#if slide.qr}
              <!-- scan to open the site: dark modules on a light plate for a reliable read from the room -->
              <div class="dk-qr" style={at(8, 5, 2, 4)} data-testid="slide-{slide.id}-qr">
                <span class="dk-qr-code" role="img" aria-label="QR code for {slide.qr}">{@html qrSvg.replace(/<\?xml[^>]*>|<!DOCTYPE[^>]*>/g, '')}</span>
                <span class="dk-qr-url" data-testid="slide-{slide.id}-qr-url">{slide.qr.replace(/^https?:\/\//, '')}</span>
              </div>
            {/if}
            {#if slide.strip && !slide.qr}
              <div class="dk-rg dk-card" style="{at(7, 6, 2, 4)};--ct:{acc(2)}" data-testid="slide-{slide.id}-strip">
                <span class="dk-rg-cast" aria-hidden="true"></span>
                <span class="dk-rg-top"><span class="dk-tag">{slide.code}</span><span class="led" style="--c:var(--ok)" aria-hidden="true"></span></span>
                <span class="lcd-strip dk-strip dk-card-strip">
                  {#each slide.strip as [k, v] (k)}
                    <span class="lcd-kv"><span class="k">{k}</span><span class="v">{@html brand(v)}</span></span>
                  {/each}
                </span>
              </div>
            {/if}
            <div class="lcd-rule dk-rule-top" style={at(1, 12, 6, 1)}></div>
            <span class="dk-spectrum dk-end" style={at(10, 3, 6, 1)} aria-hidden="true">
              {#each SPECTRUM as t (t)}<span class="dk-pip" style="background:var(--tint-{t})"></span>{/each}
            </span>

          {:else if L === 'screen'}
            <!-- title (and any unshaped opener) -->
            <div class="dk-at" style={at(1, 11, 1, 2)}>{@render heading()}</div>
            {#if slide.body}<p class="dk-body" style={at(1, 6, 3, 2)} data-testid="slide-{slide.id}-body">{@html brand(slide.body)}</p>{/if}
            <div class="lcd-rule dk-rule-top" style={at(1, 12, 6, 1)}></div>
            {#if slide.strip && slide.showStrip}
              <div class="lcd-strip dk-strip dk-end" style={at(1, 7, 6, 1)} data-testid="slide-{slide.id}-strip">
                {#each slide.strip as [k, v] (k)}
                  <span class="lcd-kv"><span class="k">{k}</span><span class="v">{@html brand(v)}</span></span>
                {/each}
              </div>
            {/if}
            {#if technique}
              <div class="dk-at dk-end" style={at(8, 5, 6, 1)}>{@render ladder()}</div>
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
            {#if slide.body}<p class="dk-body" style={at(1, 6, 2, 2)} data-testid="slide-{slide.id}-body">{@html brand(slide.body)}</p>{/if}
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
                {#if slide.body}<p class="dk-led-body" data-testid="slide-{slide.id}-body">{@html brand(slide.body)}</p>{/if}
              </div>
            {:else}
              <div class="dk-rg dk-center" style="{at(1, 6, 1, 6)};--ct:{tint}">
                <span class="dk-rg-cast" aria-hidden="true"></span>
                {#if slide.body}<p class="dk-rg-note" data-testid="slide-{slide.id}-body">{@html brand(slide.body)}</p>{/if}
              </div>
              <div class="dk-at dk-end" style={at(8, 5, 4, 3)}>{@render heading()}</div>
            {/if}

          {:else if L === 'low'}
            {#if alt}
              <!-- already shipped: annotation rule on top, the claim, then the
                   proof in a region edged with the whole spectrum -->
              <div class="dk-at" style={at(1, 12, 1, 1)}>{@render annot()}</div>
              <div class="dk-at dk-end" style={at(1, 9, 2, 1)}>{@render heading()}</div>
              <div class="dk-rg dk-center dk-prismedge" style="{at(1, 8, 4, 3)};--ct:{tint}">
                <span class="dk-rg-cast" aria-hidden="true"></span>
                {#if slide.body}<p class="dk-rg-note" data-testid="slide-{slide.id}-body">{@html brand(slide.body)}</p>{/if}
              </div>
            {:else if slide.items}
              <!-- the kit of parts, named: statement left, the parts as a §
                   readout right, motion (the last, and the point) lit -->
              <div class="dk-at" style={at(1, 6, 1, 1)}>{@render heading()}</div>
              {#if slide.body}<p class="dk-body" style={at(1, 5, 2, 4)} data-testid="slide-{slide.id}-body">{@html brand(slide.body)}</p>{/if}
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
              {#if slide.body}<p class="dk-body" style={at(1, 7, 5, 2)} data-testid="slide-{slide.id}-body">{@html brand(slide.body)}</p>{/if}
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
              {#if slide.body}<p class="dk-rg-note" data-testid="slide-{slide.id}-body">{@html brand(slide.body)}</p>{/if}
            </div>

          {:else if L === 'index' && prism}
            <!-- credits: people, not candidates. No count, no status lamp, no §
                 numbers — each name in the warm sans at sub size, each with its
                 own section-tint swatch, on a plain framed region of the
                 neutral screen. -->
            <div class="dk-at" style={at(1, 6, 1, 1)}>{@render heading()}</div>
            {#if slide.body}<p class="dk-body" style={at(1, 5, 2, 2)} data-testid="slide-{slide.id}-body">{@html brand(slide.body)}</p>{/if}
            <div class="dk-rg dk-credits" style={at(7, 6, 1, 5)} data-testid="slide-{slide.id}-list">
              {#each slide.items ?? [] as it, n (it)}
                <span class="dk-credit" data-testid="slide-{slide.id}-item-{slug(it)}">
                  <span class="dk-sw" style="background:{acc(n + 1)}" aria-hidden="true"></span>
                  <span class="dk-credit-name">{it}</span>
                </span>
              {/each}
            </div>
            <div class="lcd-rule dk-rule-top" style={at(1, 12, 6, 1)}></div>
            <span class="dk-spectrum dk-end" style={at(10, 3, 6, 1)} aria-hidden="true">
              {#each SPECTRUM as t (t)}<span class="dk-pip" style="background:var(--tint-{t})"></span>{/each}
            </span>

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
              {@const place = alt ? at(n === 0 ? 2 : 8, 5, 3, 4) : at(n === 0 ? 1 : 7, 6, 1, 4)}
              <div class={alt ? 'dk-rg dk-pair' : 'dk-led dk-pair dk-pair-wide'} class:dk-block-l={!alt && n === 0} class:dk-block-r={!alt && n === 1} style="{place};--ct:{ct};--tint:{ct}"
                   data-testid="slide-{slide.id}-side-{slug(c.h)}">
                {#if side?.mark === 'webgl'}
                  <!-- WebGL: the CPU holds the state and hands the GPU one
                       instruction at a time; data crosses every frame -->
                  <svg class="pr-fig" viewBox="0 0 300 96" aria-hidden="true" data-testid="slide-{slide.id}-fig-webgl">
                    <rect class="pr-box" x="6" y="18" width="84" height="60" rx="4" /><text x="14" y="32">cpu</text>
                    {#each [0, 1, 2, 3, 4, 5] as k (k)}<rect class="pr-mem" x={16 + (k % 3) * 22} y={42 + Math.floor(k / 3) * 16} width="16" height="10" rx="1" />{/each}
                    <rect class="pr-box" x="210" y="18" width="84" height="60" rx="4" /><text x="218" y="32">gpu</text>
                    <line class="pr-wire" x1="96" y1="40" x2="204" y2="40" /><line class="pr-wire" x1="204" y1="58" x2="96" y2="58" />
                    {#each [0, 1, 2] as k (k)}<rect class="pr-pkt pr-out" x="96" y="36" width="9" height="8" rx="1" style="--k:{k}" /><rect class="pr-pkt pr-back" x="195" y="54" width="9" height="8" rx="1" style="--k:{k}" />{/each}
                  </svg>
                {:else if side?.mark === 'webgpu'}
                  <!-- WebGPU: one batch of instructions goes over once; the
                       state lives on the GPU and many cores work it in place -->
                  <svg class="pr-fig" viewBox="0 0 300 96" aria-hidden="true" data-testid="slide-{slide.id}-fig-webgpu">
                    <rect class="pr-box" x="6" y="18" width="84" height="60" rx="4" /><text x="14" y="32">cpu</text>
                    {#each [0, 1, 2] as k (k)}<rect class="pr-cmd" x="18" y={40 + k * 11} width="60" height="7" rx="1" />{/each}
                    <line class="pr-wire" x1="96" y1="48" x2="130" y2="48" />
                    <rect class="pr-batch" x="96" y="41" width="30" height="14" rx="2" />
                    <rect class="pr-box" x="136" y="8" width="158" height="80" rx="4" /><text x="144" y="22">gpu · memory stays here</text>
                    {#each Array.from({ length: 36 }, (_, n) => n) as n (n)}<rect class="pr-core" x={146 + (n % 12) * 12} y={32 + Math.floor(n / 12) * 17} width="9" height="11" rx="1" style="--n:{n}" />{/each}
                  </svg>
                {/if}
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
                  <!-- the two freedoms, drawn: depth (a cube on three axes)
                       and every pixel (a grid lit cell by cell) -->
                  <div class="cv-fig" aria-hidden="true" data-testid="slide-{slide.id}-figure">
                    <svg class="cv-depth" viewBox="0 0 150 150">
                      <g class="cv-axes"><line x1="40" y1="112" x2="132" y2="112" /><line x1="40" y1="112" x2="40" y2="18" /><line x1="40" y1="112" x2="8" y2="140" /></g>
                      <g class="cv-cube">
                        <path class="cv-back" d="M70 50 h40 v40 h-40 z" />
                        <path class="cv-front" d="M56 64 h40 v40 h-40 z" />
                        <path class="cv-edge" d="M56 64 L70 50 M96 64 L110 50 M96 104 L110 90 M56 104 L70 90" />
                      </g>
                      <text x="134" y="116">x</text><text x="44" y="22">y</text><text x="2" y="146">z</text>
                    </svg>
                    <div class="cv-px">{#each Array.from({ length: 48 }, (_, n) => n) as n (n)}<i style="--n:{n}"></i>{/each}</div>
                    <span class="cv-lab cv-lab-a">depth</span><span class="cv-lab cv-lab-b">every pixel</span>
                  </div>
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

          {:else if L === 'stage' && slide.demoId}
            <!-- the demo is the slide: the whole field, scaled to fit, with
                 the section label in the top band saying what it is -->
            <div class="dk-led dk-demo-well" class:dk-wide169={slide.ratio === '16/9'} class:dk-even={slide.even} class:dk-bare={slide.bare} style={at(1, 12, 1, 6)} data-testid="well-{slide.id}">
              <DemoHost id={slide.demoId} {live} fit width={slide.demoWidth ?? 1100} testId="demo-{slide.id}" />
            </div>
          {:else if L === 'demo' && slide.demoId}
            <!-- a collection demo on the right, the point on the left -->
            <div class="dk-at" style={slide.wide ? at(1, 8, 1, 2) : at(1, 5, 1, 3)}>{@render heading()}</div>
            {#if slide.body}<p class="dk-body" style={slide.wide ? at(9, 4, 1, 2) : at(1, 5, 4, 3)} data-testid="slide-{slide.id}-body">{@html brand(slide.body)}</p>{/if}
            <div class="dk-led dk-demo-well" style={slide.wide ? at(1, 12, 3, 4) : at(6, 7, 1, 6)} data-testid="well-{slide.id}">
              <DemoHost id={slide.demoId} {live} testId="demo-{slide.id}" />
            </div>
          {:else}
            <div class="dk-at" style={at(1, 9, 1, 2)}>{@render heading()}</div>
            {#if slide.body}<p class="dk-body" style={at(1, 7, 3, 2)} data-testid="slide-{slide.id}-body">{@html brand(slide.body)}</p>{/if}
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
        {#if slide.caption}
          <!-- demo slides: one line of caption in the bottom margin (Key) -->
          <p class="dk-caption" data-testid="slide-{slide.id}-caption">{@html brand(slide.caption)}</p>
        {/if}
        <div class="dk-band dk-band-bot">
          <span>{slide.sample ? 'sample' : slide.verify ? 'figures to verify' : ''}</span>
          <span>{#if slide.cite}<b class="dk-cite" data-testid="slide-{slide.id}-cite">{slide.cite.map((n) => `[${n}]`).join(' ')}</b>{/if}</span>
        </div>
      </div>
    </div>
  </div>

  <div class="led-guides"><span class="margin"></span><span class="field"></span></div>
  {/if}

  {#if L === 'full' && slide.demoId}
    <!-- full: the demo IS the slide. It covers the whole 960 × 540 surface,
         bezel and chrome included, so a finale can pull back from the
         entire frame (Key: the whole presentation was inside the phone). -->
    <div class="dk-full" data-testid="well-{slide.id}">
      <DemoHost id={slide.demoId} {live} fit width={960} testId="demo-{slide.id}" />
    </div>
  {/if}
</div>

<style>
  /* inline-code treatment for the employer's name: a small inset ink
     well in the mono face, the way a code span sits in prose */
  .led-slide :global(code.dk-brand) {
    font-family: var(--mono) !important; font-variation-settings: normal; font-size: 0.9em; font-weight: 500; letter-spacing: 0; text-transform: none;
    padding: 0.08em 0.4em; border-radius: 3px; white-space: nowrap;
    /* explicit ink and ground: the system's global code style is light
       text for dark pages and vanished on the LCD */
    color: var(--lcd-ink); text-shadow: none; border: 0;
    background: color-mix(in oklch, var(--lcd-ink) 9%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--lcd-ink) 30%, transparent);
  }
  .probe { position: absolute; width: 0; height: 0; overflow: hidden; }

  /* ── the screen: fills the slide inside a one-cell bezel ─────── */
  .dk-screen { position: absolute; inset: 0; }
  .dk-screen > .well { display: block; box-sizing: border-box; height: 100%; padding: 6px; border-radius: 0; }
  .dk-screen .lcd { height: 100%; border-radius: 0; }
  /* The pixel grids over every slide, at half their system strength (Key:
     "too intense … 50% more transparent"): the LED panel's cell grid, the
     LCD's dot grid, and the grid inside LED wells. The deck only; the
     design system and the site keep theirs. */
  .led-slide::before, .dk-screen .lcd::before, .dk-led::before { opacity: 0.3; }
  /* Demos float above the grid (Key): on a slide carrying a live demo, the
     layers that would trap the demo under the pixel grid and sheen stop
     forming their own stacking contexts, and the demo well is lifted over
     the LED grid (z 4), its vignette (z 5) and the LCD grid and sheen. */
  .led-slide:has(.dk-demo-well) :global(.led-field),
  .led-slide:has(.dk-demo-well) :global(.lcd-body) { z-index: auto; }
  .dk-demo-well { z-index: 6; }
  .dk-demo-well::before { display: none; }  /* 0.5, then 40% less (Key) */
  /* Every slide's screen is cast in its section's tint, strongly enough
     to be the dominant colour (Key: "each section should have a
     dominant color treatment"). */
  .dk-cast { position: absolute; inset: 0; z-index: 1; pointer-events: none;
    background: color-mix(in oklch, var(--tint) 58%, transparent); }
  /* ── opener shapes ───────────────────────────────────────────── */
  .dk-led.dk-gifpt { justify-content: center; gap: 6px; padding: 16px 22px; }
  .dk-gifpt-h { font-family: var(--mono); font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--led-ink); opacity: 0.6; }
  .dk-gifpt-b { font-size: 16px !important; line-height: 24px !important; }
  .dk-gifs { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr auto; gap: 10px; }
  .dk-gif { display: grid; place-items: center; border-radius: 4px; overflow: hidden;
    background: color-mix(in oklch, var(--lcd-ink) 8%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--lcd-ink) 25%, transparent); }
  .dk-gif img { width: 78%; height: 78%; object-fit: contain; image-rendering: pixelated; }
  .dk-gifs-cap { grid-column: 1 / -1; font-family: var(--mono); font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--lcd-ink); opacity: 0.7; text-align: right; }
  .dk-gpu { padding: 36px; flex-direction: row; align-items: flex-end; justify-content: space-between; gap: 72px; }
  .dk-gpu .dk-led-body { max-width: 360px; }
  .dk-gpu-ladder { flex: none; }
  /* canvas "why" figure: simple, amber on the dark panel */
  .dk-led > .cv-fig { position: absolute; left: 36px; right: 36px; top: 30px; height: 170px; display: grid;
    grid-template-columns: 1fr 1fr; align-items: center; justify-items: center; column-gap: 24px;
    --cvc: color-mix(in oklch, var(--tint-canvas) 80%, white); }
  .cv-depth { width: 150px; height: 150px; overflow: visible; }
  .cv-axes line { stroke: color-mix(in oklch, var(--cvc) 45%, transparent); stroke-width: 1; }
  .cv-depth text { font-family: var(--mono); font-size: 9px; fill: color-mix(in oklch, var(--cvc) 60%, transparent); }
  .cv-cube { transform-box: fill-box; transform-origin: center; animation: cv-float 7s var(--ease-mechanical) infinite; }
  .cv-back { fill: none; stroke: color-mix(in oklch, var(--cvc) 40%, transparent); stroke-width: 1; }
  .cv-front { fill: color-mix(in oklch, var(--cvc) 14%, transparent); stroke: var(--cvc); stroke-width: 1.4; }
  .cv-edge { stroke: color-mix(in oklch, var(--cvc) 70%, transparent); stroke-width: 1; fill: none; }
  @keyframes cv-float { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(-10px, 9px); } }
  .cv-px { display: grid; grid-template-columns: repeat(8, 12px); gap: 3px; }
  .cv-px i { width: 12px; height: 12px; background: var(--cvc); opacity: 0.1; animation: cv-pix 4.8s steps(1, end) infinite;
    animation-delay: calc(var(--n) * 0.1s); }
  @keyframes cv-pix { 0% { opacity: 0.95; } 8% { opacity: 0.45; } 16%, 100% { opacity: 0.1; } }
  .cv-lab { position: absolute; bottom: -8px; font-family: var(--mono); font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--cvc); opacity: 0.65; }
  .cv-lab-a { left: 0; width: 50%; text-align: center; } .cv-lab-b { right: 0; width: 50%; text-align: center; }
  @media (prefers-reduced-motion: reduce) { .cv-cube, .cv-px i { animation: none; } .cv-px i { opacity: 0.4; } }
  /* the graphics card slide: figure left, copy and ladder right, in a grid
     so the two can never overlap */
  .dk-led.dk-gpu { display: grid !important; grid-template-columns: 360px minmax(0, 1fr); align-items: stretch; gap: 24px; padding: 18px 36px 24px 12px; }
  .gpu-copy { display: flex; flex-direction: column; justify-content: space-between; align-items: flex-start; gap: 18px; padding-top: 18px; min-width: 0; }
  .dk-gpu .gpu-copy .dk-led-body { max-width: none; margin: 0; }
  .gpu-fig { display: grid; place-items: center; }
  .gpu-iso { position: relative; width: 250px; height: 118px; transform-style: preserve-3d; transform: rotateX(58deg) rotateZ(-34deg); }
  .gpu-pl { position: absolute; inset: 0; border-radius: 6px; border: 1px solid var(--bc); background: var(--bg);
    transform: translateZ(var(--z)); animation: gpu-breathe 10s var(--ease-mechanical) infinite; overflow: hidden; }
  @keyframes gpu-breathe { 0%, 30% { transform: translateZ(var(--z)); } 50%, 72% { transform: translateZ(calc(var(--z) * 0.25)); } 92%, 100% { transform: translateZ(var(--z)); } }
  .gpu-tag { position: absolute; top: 5px; right: 8px; font-family: var(--mono); font-size: 9px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--bc); }
  .gpu-board { --z: -52px; --bc: color-mix(in oklch, var(--tint-svg) 70%, white); --bg: color-mix(in oklch, var(--tint-svg) 16%, transparent); }
  .gpu-chip { position: absolute; top: 14px; left: calc(16px + var(--k) * 28px); width: 20px; height: 16px; border-radius: 2px;
    background: color-mix(in oklch, var(--bc) 35%, transparent); box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--bc) 70%, transparent); }
  .gpu-chip:nth-of-type(n+3) { top: 78px; }
  .gpu-die { position: absolute; left: 150px; top: 36px; width: 42px; height: 42px; border-radius: 3px;
    background: color-mix(in oklch, var(--tint-webgpu) 55%, transparent); box-shadow: 0 0 14px color-mix(in oklch, var(--tint-webgpu) 70%, transparent); }
  .gpu-pcie { position: absolute; left: 22px; width: 150px; bottom: 0; height: 6px;
    background: repeating-linear-gradient(90deg, color-mix(in oklch, var(--tint-canvas) 90%, white) 0 3px, transparent 3px 5px); }
  .gpu-sink { --z: 0px; --bc: color-mix(in oklch, var(--tint-css) 70%, white); --bg: color-mix(in oklch, var(--tint-css) 10%, transparent); }
  .gpu-fins { position: absolute; inset: 20px 14px 14px; background: repeating-linear-gradient(90deg, color-mix(in oklch, var(--bc) 55%, transparent) 0 1px, transparent 1px 7px); }
  .gpu-shroud { --z: 52px; --bc: color-mix(in oklch, var(--tint-webgpu) 70%, white); --bg: color-mix(in oklch, var(--tint-webgpu) 12%, transparent); }
  .gpu-fan { position: absolute; top: 20px; left: calc(26px + var(--f) * 110px); width: 80px; height: 80px; border-radius: 50%;
    border: 1px solid var(--bc); display: grid; place-items: center; }
  .gpu-fan b { width: 64px; height: 64px; border-radius: 50%; animation: gpu-spin 3s linear infinite;
    background: repeating-conic-gradient(from 0deg, color-mix(in oklch, var(--bc) 55%, transparent) 0 14deg, transparent 14deg 45deg); }
  @keyframes gpu-spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .gpu-pl, .gpu-fan b { animation: none; } }
  .dk-start { justify-content: flex-start; }
  .dk-points { border: 0; padding: 0; gap: 18px; justify-content: center; flex: 1; }
  .dk-points .dk-row { align-items: baseline; }
  .dk-rg.dk-mix { display: grid; grid-template-columns: repeat(4, 72px); grid-auto-rows: 72px;
    align-content: center; justify-content: center; padding: 18px; }
  .dk-mix-chip { align-self: center; justify-self: center; margin: 0; }
  .dk-rg.dk-block { padding: 18px 24px; gap: 8px; }
  /* a gutter between the pair: half a module each side of the shared line */
  .dk-rg.dk-block-l, .dk-led.dk-block-l { margin-right: 12px; }
  .dk-rg.dk-block-r, .dk-led.dk-block-r { margin-left: 12px; }
  .dk-block .dk-rg-note { font-size: 15px; line-height: 22px; }
  .dk-rg.dk-card { justify-content: space-between; padding: 36px; }
  .dk-rg.dk-credits { justify-content: center; gap: 18px; padding: 36px; }
  .dk-credit { display: grid; grid-template-columns: 24px minmax(0, 1fr); align-items: center; }
  .dk-credit .dk-sw { width: 12px; height: 12px; }
  /* people get the warm face: the sans, at the sub size, on a whole-cell line */
  .dk-credit-name { font-family: var(--sans); font-size: 24px; line-height: 30px; font-weight: 600;
    letter-spacing: 0; color: var(--lcd-ink); }
  .dk-card-strip { flex-direction: column; align-items: flex-start; gap: 12px; }
  /* a region whose left edge carries the whole spectrum: the shared
     system, stated as seven tints stacked in one 6px stripe */
  .dk-rg.dk-prismedge { padding-left: 36px; }
  .dk-prismedge::after { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 6px;
    background: linear-gradient(180deg,
      var(--tint-css) 0 14.3%, var(--tint-svg) 0 28.6%, var(--tint-video) 0 42.9%, var(--tint-canvas) 0 57.1%,
      var(--tint-webgl) 0 71.4%, var(--tint-webgpu) 0 85.7%, var(--tint-composite) 0 100%); }

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
  /* the caption sits in the bottom margin under the demo well, left of the
     citation; sentence case, the sans, quiet but readable */
  .dk-caption { position: absolute; left: 48px; right: 48px; bottom: 8px; z-index: 7; margin: 0; max-width: none;
    font-family: var(--sans); font-size: 11px; line-height: 14px; font-weight: 500; color: var(--lcd-ink);
    opacity: 0.85; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  /* the citation shares the bottom band; lift it clear of the caption */
  .led-slide:has(.dk-caption) .dk-band-bot { bottom: 22px; }
  .dk-band-bot { bottom: 12px; opacity: 0.55; }
  /* the section label is wayfinding: small, but contained so it is found
     at a glance. INLAID, not raised (Key): a dark, flat, section-tinted
     well set into the screen — inner shadow and an ink hairline, no top
     highlight, no drop shadow, backlight-coloured letters. Codes and
     citations stay uncontained and dim. */
  .dk-kicker {
    display: inline-block; padding: 0 12px; border-radius: 2px; font-weight: 700; letter-spacing: 0.16em;
    color: var(--lcd-ground-top);
    background: color-mix(in oklch, oklch(from var(--tint) 0.3 calc(c * 1.6) h) 88%, transparent);
    box-shadow:
      inset 0 1px 3px oklch(0 0 0 / 0.45),
      inset 0 0 0 1px oklch(0.18 0.04 130 / 0.55);
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
  .dk-demo-well { position: relative; overflow: hidden; }
  .dk-full { position: absolute; inset: 0; z-index: 20; }
  /* a full slide draws nothing of its own: no LED grid or vignette under the demo */
  .led-slide:has(.dk-full)::before, .led-slide:has(.dk-full)::after { display: none; }
  .led-slide:has(.dk-full) { background: #fff; }
  /* even: the same 42px of screen on all four sides of the demo. The screen
     is 948 × 528 inside its 6px bezel, so the well is 864 × 444 at 42,42
     on the screen: the field's width, pulled up 6px into the top band and
     12px down into the bottom margin. */
  /* bare: the demo sits on the screen itself, no LED well around it */
  .dk-bare { background: transparent !important; box-shadow: none !important; }
  .dk-bare::before, .dk-bare::after { display: none !important; }
  .dk-even { align-self: start; margin-top: -6px; height: 444px; }
  /* A 16:9 demo sits in a 768 × 432 well: the field's full height, and a
     width of 128 × 6px cells, centred with a 48px margin of screen either
     side. It fills its well edge to edge, and the slide's own margins
     stay intact. */
  .dk-wide169 { justify-self: center; width: 768px; background: transparent; box-shadow: 0 0 0 1px color-mix(in oklch, var(--lcd-ink) 25%, transparent); }
  .dk-qr-meta { margin: 0; align-self: center; display: flex; gap: 24px; font-size: 16px; color: var(--lcd-ink); }
  .dk-qr-meta .k { font-family: var(--mono); font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--lcd-dim); margin-right: 6px; }
  .dk-qr { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; }
  .dk-qr-code { display: block; width: 216px; height: 216px; padding: 12px; box-sizing: border-box; border-radius: 4px;
    background: #f4f7f1; box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--lcd-ink) 30%, transparent); }
  .dk-qr-code :global(svg) { display: block; width: 100%; height: 100%; }
  .dk-qr-url { font-family: var(--mono); font-size: 18px; font-weight: 600; letter-spacing: 0.02em; color: var(--lcd-ink); }
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
  .lcd.dk-glassy::after { opacity: 0.21; }  /* 0.3 of the global 0.7 */
  .dk-glass > :not(.led-reg) { position: relative; }
  .dk-framed { padding: 36px; justify-content: center; gap: 18px; }
  .dk-framed .led-reg i { border-color: color-mix(in oklch, var(--lcd-ink) 55%, transparent); }

  /* ── compositions' furniture ─────────────────────────────────── */
  /* ledger rows: tag | label | body, on module-width tracks */
  .dk-ledger { display: grid; grid-template-columns: 54px 216px minmax(0, 1fr); column-gap: 0; align-items: center; padding: 0 18px; }
  .dk-ledger .dk-tag { align-self: center; justify-self: start; }

  .dk-pair { justify-content: flex-end; }
  .dk-pair .dk-float { position: absolute; top: 18px; left: 18px; right: 18px; }
  /* wide pair (WebGL / WebGPU): the figure sits between the head and the note */
  .dk-led.dk-pair-wide { justify-content: flex-end; gap: 10px; }
  .dk-pair-wide .pr-fig { position: absolute; left: 18px; right: 18px; top: 64px; width: calc(100% - 36px); height: 96px; }
  .pr-fig text { font-family: var(--mono); font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; fill: var(--ct); opacity: 0.8; }
  .pr-box { fill: color-mix(in oklch, var(--ct) 8%, transparent); stroke: color-mix(in oklch, var(--ct) 55%, transparent); stroke-width: 1; }
  .pr-mem, .pr-cmd { fill: color-mix(in oklch, var(--ct) 45%, transparent); }
  .pr-wire { stroke: color-mix(in oklch, var(--ct) 35%, transparent); stroke-width: 1; stroke-dasharray: 3 3; }
  .pr-pkt { fill: var(--ct); }
  .pr-out { animation: pr-out 1.8s linear infinite; animation-delay: calc(var(--k) * -0.6s); }
  .pr-back { animation: pr-back 1.8s linear infinite; animation-delay: calc(var(--k) * -0.6s - 0.3s); }
  @keyframes pr-out { from { transform: translateX(0); } to { transform: translateX(99px); } }
  @keyframes pr-back { from { transform: translateX(0); } to { transform: translateX(-99px); } }
  .pr-batch { fill: var(--ct); opacity: 0.9; }
  .pr-core { fill: var(--ct); opacity: 0.2; animation: pr-core 1.6s ease-in-out infinite; animation-delay: calc(mod(var(--n), 12) * 0.08s + mod(var(--n), 3) * 0.1s); }
  @keyframes pr-core { 0%, 100% { opacity: 0.2; } 40% { opacity: 0.9; } }
  @media (prefers-reduced-motion: reduce) { .pr-pkt, .pr-core { animation: none; } .pr-core { opacity: 0.55; } }

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
