/* THE DECK, AS DATA.
   This is the only place slide content lives. Nothing here knows how a
   slide is drawn — `layout` names a composition and the renderer looks
   it up, so changing what a slide says and changing how it looks are
   two different edits.

   `demo` is a URL, not a name — so a slide can point at design/techniques/…
   with no other change.

   The talk's structure, from Key's handoff brief (track 006, Part 2):
   opening beats → six technique stops on the comprehension ladder →
   friction → close. Slides are simple, pointed statements; elaboration
   lives in speaker notes (deck-notes/<id>.md, track 007). Per technique:
   at most four slides, no more than two of them text.

   `placeholder: true` marks the one slide per technique that stands in for
   its demos. Each demo becomes its own slide once the examples are chosen;
   the candidates are listed on the placeholder. "The demos are chosen" is
   decidable by searching for the placeholders that remain.

   Statistics on screen are pending verification (track 006's claims
   register) and carry `verify: true` until checked.

   `screen` is the title and every section opener: the LCD panel the home
   hero and the paper's front panel use, so the deck's structure reads in
   the app's own voice. Since 2026-09-17 every other slide is on that LCD
   too, composed as regions of the display the way the home index is; the
   layout names below choose the arrangement of those regions. */

/* PRESENTATION FIELDS — how a section is recognised before a word is read.
   From design/graphic-language: every technique section owns a tint and a
   pixel mark, shown as a small chip beside the heading. None of these carry
   text, so none of them can go stale against the paper.

   `motif`  which section this is, for the chip beside the heading and the
            ladder's one lit chip. Defaults to `tint`. `gif` shares the video
            tint on purpose (DESIGN.md: a separate GIF tint would imply a
            capability step it lacks), so it is told apart by its chip mark.
   `mark`   override the chip mark.
   `sides`  per-region tint, chip and sheet code on a `pair` slide, so a
            css/svg or webgl/webgpu comparison is coloured by what each side IS.
   `graphic` a figure drawn from a number already stated in `body`. */

/** @typedef {'stage'|'demo'|'hero'|'statement'|'index'|'figure'|'split'|'bleed'|'compare'|'gallery'|'screen'|'datum'|'mirror'|'low'|'framed'|'ledger'|'pair'|'weighted'} Layout */
/** @typedef {'composite'|'css'|'svg'|'gif'|'video'|'canvas'|'webgl'|'webgpu'} Motif */
/** @typedef {{ label: string, demo: string }} Example */
/**
 * @typedef {object} Slide
 * @property {string} id
 * @property {string} code
 * @property {Layout} layout
 * @property {string} [tint]
 * @property {boolean} [sample]
 * @property {boolean} [placeholder]
 * @property {boolean} [verify]
 * @property {string} [kicker]
 * @property {string} [h]
 * @property {string} [body]
 * @property {string} [demo]
 * @property {string[]} [items]
 * @property {[string, string][]} [readout]
 * @property {string} [qr]  a URL shown as a QR code with the address under it
 * @property {{ h: string, body: string }[]} [blocks]  two explanatory blocks on a screen slide
 * @property {string} [caption]  one line in the bottom margin of a demo slide
 * @property {string} [demoId]  a demo from the collection (src/lib/demos), mounted live
 * @property {boolean} [bare]  no LED well: the demo sits directly on the slide's screen
 * @property {boolean} [even]  demo well with equal screen margins on all four sides (864 × 444)
 * @property {'16/9'} [ratio]  the demo's own shape; a 16:9 demo fills the field width into the bottom margin
 * @property {number} [demoWidth]  px the demo lays out at before `stage` scales it to the slide (default 1100)
 * @property {boolean} [wide]  demo region spans the width under the heading
 * @property {number[]} [cite]  bibliography numbers in the paper (SCOPE.md), shown as markers
 * @property {[string, string][]} [strip]  key/value readout along the foot of a `screen` slide
 * @property {{ h: string, body: string }[]} [compare]
 * @property {Example[]} [examples]
 * @property {Motif} [motif]  section kit: rule, band and default mark
 * @property {string} [mark]  chip mark override (a topic key); technique slides only
 * @property {{ tint: string, mark: string, code?: string }[]} [sides]  per-region tint, chip mark and sheet code, `pair` layout
 * @property {{ kind: 'waffle' | 'bar', lit: number, of: number }} [graphic]  a share already stated in `body`,
 *   drawn as a two-segment LED bar (lit | off) with both parts labelled on the figure
 * @property {boolean} [prism]  neutral screen base with section tints used as accents (opening and close):
 *   no dominant cast; regions, label, brackets, rows and chips each take a spectrum tint, rotated per slide
 * @property {'stack'|'right'|'led'|'frame'|'low'|'panel'|'points'|'mix'|'card'} [shape]  which composition a
 *   `screen` opener uses, so the six technique openers and the payoff slides are not one shape
 * @property {boolean} [alt]  the mirrored/alternate arrangement of this slide's layout, so two slides in
 *   one layout family are not the same shape (see Slide.svelte for what each layout's alternate is)
 * @property {boolean} [showStrip]  render `strip` on a `screen` slide. Off by default: stop numbers and
 *   sheet codes are notation for the presenter, not the audience, so only the title and the end
 *   (presenter/date, site/paper) show theirs — and then below the title in rank, not beside it.
 */

/** @type {Slide[]} */
export const SLIDES = [
  /* ── Opening. Beats 1 and 2 (why I'm up here; the nine months) are spoken
     over the title, not slides. Context, not argument. ── */
  {
    id: 'open-title', code: 'WAM-2026', layout: 'screen', tint: 'composite', prism: true, showStrip: true,
    kicker: 'Key Clark · Talk', h: 'web animation<br>& motion',
    body: 'A tour through the ways a web page can move, and what it takes to get them built.',
    strip: [['Presenter', 'Key Clark'], ['Presented', '17 Sep 2026'], ['Made for', 'Folklore Digital']],
  },
  {
    id: 'open-data', code: 'OPEN', layout: 'datum', tint: 'composite', prism: true, cite: [1],
    graphic: { kind: 'bar', lit: 68, of: 100 },
    kicker: 'Why now', h: '68% no click',
    body: 'In the US, 68% of Google searches in January–April 2026 ended without a click on anything.',
  },
  {
    id: 'open-reading', code: 'OPEN', layout: 'mirror', tint: 'composite', prism: true,
    kicker: 'What that might mean', h: 'from answers to experiences',
    body: 'If people stop visiting websites for answers, what’s left to visit for is the experience. That’s a reading, not a prophecy.',
  },
  {
    id: 'open-reframe', code: 'OPEN', layout: 'low', tint: 'composite', prism: true,
    kicker: 'Why an engineer cares', h: 'not decoration',
    body: 'A good site is built from a shared kit of parts. Motion built into that kit can be changed once, everywhere. Motion bolted on has to be redone by hand, every time.',
    /* the kit, named, so later slides can point back at it: motion joins
       the list as one more part (paper: Decoration vs. infrastructure) */
    items: ['colour', 'type', 'spacing', 'components — buttons, cards, menus', 'motion — timing, easing, how things arrive'],
  },
  {
    id: 'open-question', code: 'OPEN', layout: 'framed', tint: 'composite', prism: true,
    kicker: 'Keep this in mind', h: 'could you describe it?',
    body: 'As we go: could you describe what you’re seeing well enough for someone else to build it? Or would you have to point?',
  },

  /* ── Stop 1 · Layout / CSS ── */
  {
    id: 'css-intro', code: 'SL-06', layout: 'screen', strip: [['Stop', '1 of 6'], ['Sheet', 'SL-06']], tint: 'css', shape: 'stack',
    kicker: '1 · Layout & CSS', h: 'the page itself moves',
    body: 'You already know this one: menus that slide, cards that open. A newspaper can’t move. A web page can, and this is the cheapest way to do it.',
  },
  {
    id: 'css-cost', code: 'SL-06', layout: 'ledger', tint: 'css', cite: [7],
    kicker: '1 · Layout & CSS', h: 'cheap, until it isn’t',
    compare: [
      { h: 'good at', body: 'Free, works everywhere, and the browser does the heavy lifting.' },
      { h: 'costs', body: 'Animate size or position and the browser redoes layout and paint every frame. Stick to moving and fading — transform and opacity — and it stays smooth.' },
    ],
  },
  /* ── Layout & CSS demos, one slide per group (Key): timeless; drawing
     (goo, moiré, aperture); typography (holographic, variable) ── */
  {
    id: 'css-timeless', code: 'SL-06', layout: 'stage', tint: 'css', demoId: 'css/timeless',
    caption: 'Six magazine layouts that move with no JavaScript: sticky mastheads, staggered cards, tabs, drawers.',
    kicker: '1 · Layout & CSS · Timeless', h: 'timeless, a magazine animated',
  },
  {
    id: 'css-drawing', code: 'SL-06', layout: 'stage', tint: 'css', demoId: 'css/drawing',
    caption: 'CSS as a drawing tool: blur and contrast make goo, a blend mode makes moiré, a scroll timeline opens the aperture.',
    kicker: '1 · Layout & CSS · Drawing', h: 'css as a drawing instrument',
  },
  {
    id: 'css-typography', code: 'SL-06', layout: 'stage', tint: 'css', demoId: 'css/typography',
    caption: 'A gradient clipped to real text, and variable fonts animating weight and roundness inside the font file.',
    kicker: '1 · Layout & CSS · Typography', h: 'holographic and variable type',
  },

  /* ── Stop 2 · SVG ── */
  {
    id: 'svg-intro', code: 'SL-10', layout: 'screen', strip: [['Stop', '2 of 6'], ['Sheet', 'SL-10']], tint: 'svg', shape: 'right',
    kicker: '2 · SVG', h: 'drawn, not loaded',
    body: 'The browser draws the graphic from instructions while the page runs. It suits charts, maps and icons. The catch: every shape has a cost, so thousands of them get slow.',
  },
  {
    id: 'svg-vs-css', code: 'SL-10', layout: 'pair', tint: 'svg', alt: true,
    sides: [{ tint: 'css', mark: 'css', code: 'SL-06' }, { tint: 'svg', mark: 'svg', code: 'SL-10' }],
    kicker: '2 · SVG', h: 'not the same as CSS',
    compare: [
      { h: 'css', body: 'Moves what’s already on the page: boxes, text, images.' },
      { h: 'svg', body: 'Draws the shapes themselves, so they can come from data or turn into something else.' },
    ],
  },
  /* ── SVG demos, each the whole slide ── */
  {
    id: 'svg-zoom-map', code: 'SL-10', layout: 'stage', tint: 'svg', demoId: 'svg/zoom-map', demoWidth: 1600, even: true,
    caption: 'One SVG camera flies from the world to Dartmouth College, 1956: sharp at every zoom, labels as real text.',
    kicker: '2 · SVG · The camera', h: 'a survey-sheet zoom map',
  },
  {
    id: 'svg-lineage-radar', code: 'SL-10', layout: 'stage', tint: 'svg', demoId: 'svg/lineage-radar', demoWidth: 1600, even: true,
    caption: 'AI history as weather: 30 events and 22 movements of people, welded together by an SVG filter.',
    kicker: '2 · SVG · Real data', h: 'lineage radar',
  },

  /* ── Stop 3 · GIF — the shortest stop ── */
  {
    id: 'gif-intro', code: 'SL-05', layout: 'screen', strip: [['Stop', '3 of 6'], ['Sheet', 'SL-05']], tint: 'video', motif: 'gif', shape: 'led',
    kicker: '3 · GIF', h: 'no off switch',
    blocks: [
      { h: 'the format', body: 'Works anywhere with no code, but you can’t pause it or slow it down.' },
      { h: 'the pipeline', body: 'Ours are made by a script, so changing one is an edit, not a redo.' },
    ],
  },
  /* ── GIF demos: the three stickers and the companion device, one slide ── */
  {
    id: 'gif-stickers', code: 'SL-05', layout: 'stage', tint: 'video', motif: 'gif', demoId: 'gif/stickers', even: true, bare: true, demoWidth: 900,
    caption: 'One GIF character in four product contexts, and a companion app that swaps GIFs as its mood changes.',
    kicker: '3 · GIF · Stickers', h: 'one character, four places',
  },

  /* ── Stop 4 · Video ── */
  {
    id: 'video-intro', code: 'SL-04', layout: 'screen', strip: [['Stop', '4 of 6'], ['Sheet', 'SL-04']], tint: 'video', shape: 'frame',
    kicker: '4 · Video', h: 'video',
    /* combined with the former "motion you can edit" slide (Key) */
    blocks: [
      { h: 'it can’t react', body: 'Video is the cheapest way to put motion on a page, and you can pause it. But it can’t respond to a scroll, a hover or a click.' },
      { h: 'motion you can edit', body: 'Built in code, motion changes like any other part of the site, even by a client in their content system. We’re not making a video; we’re making the thing that makes them.' },
    ],
  },
  /* ── Video demos, each the whole slide ── */
  {
    id: 'video-player-rack', code: 'SL-04', layout: 'stage', tint: 'video', demoId: 'video/player-rack', even: true, bare: true, demoWidth: 960,
    caption: 'The decoded frame is a buffer: effects rewrite a playing video, or a live camera, frame by frame.',
    kicker: '4 · Video · The buffer rack', h: 'the decoded frame is a buffer',
  },


  /* ── Stop 5 · Canvas — the setup for the graphics card; can run short ── */
  {
    id: 'canvas-intro', code: 'SL-11', layout: 'screen', strip: [['Stop', '5 of 6'], ['Sheet', 'SL-11']], tint: 'canvas', shape: 'low',
    kicker: '5 · Canvas', h: 'try selecting the text',
    body: 'On most sites you can highlight text, drag an image, tab to a link. On a canvas you can’t. It’s just pixels the page painted, and it remembers nothing.',
  },
  {
    id: 'canvas-why', code: 'SL-11', layout: 'weighted', tint: 'canvas',
    kicker: '5 · Canvas', h: 'so why use it?',
    compare: [
      { h: 'for a content site', body: 'You’d give up too much.' },
      { h: 'for richer graphics', body: 'Freedom a normal page can’t give: real depth, and control of every pixel.' },
    ],
  },
  /* ── 2D Canvas demos, each the whole slide ── */
  {
    id: 'canvas-readback', code: 'SL-11', layout: 'stage', tint: 'canvas', demoId: 'canvas/readback', even: true, bare: true, demoWidth: 864,
    caption: 'Readback: histogram, region stats and profile are all computed from the canvas pixels, every frame.',
    kicker: '5 · 2D Canvas · Readback', h: 'readback',
  },
  {
    id: 'canvas-off-thread', code: 'SL-11', layout: 'stage', tint: 'canvas', demoId: 'canvas/off-thread', even: true, bare: true, demoWidth: 864,
    caption: 'A worker draws the player and visualizer through OffscreenCanvas; block the page and they keep running.',
    kicker: '5 · 2D Canvas · Off-thread', h: 'off-thread',
  },

  /* ── Stop 6 · WebGL and WebGPU, as one: the graphics card. Punchy — no buffers, no shaders. ── */
  {
    id: 'gpu-intro', code: 'SL-12 · SL-14', layout: 'screen', strip: [['Stop', '6 of 6'], ['Sheets', 'SL-12 · SL-14']], tint: 'webgpu', shape: 'panel',
    kicker: '6 · WebGL & WebGPU', h: 'the graphics card',
    body: 'Think of a video game, then think of a website. Much of that difference is the graphics card, and these let a web page use it.',
  },
  {
    id: 'gpu-two', code: 'SL-12 · SL-14', layout: 'pair', tint: 'webgpu', cite: [16, 17, 19, 21],
    sides: [{ tint: 'webgl', mark: 'webgl', code: 'SL-12' }, { tint: 'webgpu', mark: 'webgpu', code: 'SL-14' }],
    kicker: '6 · WebGL & WebGPU', h: 'two ways in',
    compare: [
      { h: 'webgl', body: 'Older. Runs almost everywhere. Years of answers online.' },
      { h: 'webgpu', body: 'Newer: in every major browser for about a year. Can do far more at once. Less help when you get stuck.' },
    ],
  },
  /* ── WebGL & WebGPU demos, each the whole slide ── */
  {
    id: 'gpu-fenwick', code: 'SL-12', layout: 'stage', tint: 'webgl', demoId: 'webgl/fenwick', even: true, bare: true, demoWidth: 864,
    caption: 'A CC0 scan as 320,000 GPU points that resolve into the lit, outlined marble; gallery, daylight and raking light read the stone differently.',
    kicker: '6 · WebGL · The Fenwick', h: 'the fenwick · object in the round',
  },
  {
    id: 'gpu-pipeline', code: 'SL-14', layout: 'stage', tint: 'webgpu', demoId: 'webgpu/pipeline', even: true, bare: true, demoWidth: 864,
    caption: '200,000 particles in one storage buffer, four passes timed by the GPU; only uniforms cross each frame.',
    kicker: '6 · WebGPU · The pipeline', h: 'what a frame costs on the gpu',
  },
  {
    id: 'gpu-device', code: 'SL-14', layout: 'stage', tint: 'webgpu', demoId: 'webgpu/device', even: true, bare: true, demoWidth: 864, cite: [29],
    caption: 'One canvas, all WebGPU: the fPhone Duo, its home screen and every app drawn by the graphics card.',
    kicker: '6 · WebGPU · One device', h: 'one device, four apps',
  },

  /* ── Composite: the argument, re-reading the six stops. Not a technique;
     two slides between the graphics card and the friction section. ── */
  {
    id: 'composite-layers', code: 'SL-07', layout: 'demo', tint: 'composite', demoId: 'composite/layers', wide: false,
    caption: 'One page, three surfaces: real elements on top, a GPU canvas in the middle, video at the back.',
    kicker: 'Composite', h: 'one page, three surfaces',
    body: 'Most of what you just saw was already a combination: real page elements where you need text and clicks, the graphics card where you need pixels, video where nothing has to respond.',
  },
  /* the chroma key composite: moved here from the video stop (Key) */
  {
    id: 'composite-chroma-key', code: 'SL-07', layout: 'stage', tint: 'composite', demoId: 'composite/chroma-key', even: true, bare: true, demoWidth: 960,
    caption: 'Green-screen footage keyed live in the browser and layered between real page elements.',
    kicker: 'Composite · Video as a material', h: 'an alpha channel the file never had',
  },
  {
    id: 'composite-brief', code: 'SL-07', layout: 'demo', tint: 'composite', demoId: 'composite/carries',
    caption: 'For a brief: each part goes on the cheapest surface that can carry it.',
    kicker: 'Composite', h: 'which technique carries which part?',
    body: 'Don’t be a purist. Put each part on the cheapest surface that can carry it.',
  },

  /* ── What gets in the way. One slide, four points; Key talks through them and paces it live.
     Not a warning; naming what's uncertain, not a call to action. ── */
  {
    id: 'friction', code: 'FRICTION', layout: 'screen', tint: 'webgl', motif: 'composite', shape: 'points',
    kicker: 'Friction', h: 'what gets<br>in the way',
    body: 'Real technical limits. No shared words for motion. Saying clearly what you want. No agreed limit for how much motion a page can afford.',
  },

  /* ── Close. Mix and match, proof it's buildable, then the question — to us and to the client. ── */
  {
    id: 'close-composite', code: 'CLOSE', layout: 'screen', tint: 'composite', prism: true, shape: 'mix',
    kicker: 'Bringing it together', h: 'mix and match',
    body: 'Most of what you just saw combined several of these. The useful question isn’t which technique a project uses. It’s which one does which part.',
  },
  {
    id: 'close-shipped', code: 'CLOSE', layout: 'low', tint: 'composite', prism: true, alt: true,
    kicker: 'Already happening', h: 'it’s already shipped',
    body: 'We’ve done this: a gallery of motion patterns for our designers, and a shared design system that went live for a client.',
  },
  {
    id: 'close-question', code: 'CLOSE', layout: 'compare', tint: 'composite', prism: true,
    kicker: 'Back to the question', h: 'could you describe it?',
    compare: [
      { h: 'could we?', body: 'AI didn’t create the need to explain clearly. It removed the last place to hide.' },
      { h: 'could the client?', body: 'And can we help them do it early? That gap is where the budget quietly goes.' },
    ],
  },
  {
    id: 'close-end', code: 'WAM-2026', layout: 'screen', tint: 'composite', prism: true, showStrip: true, shape: 'card',
    kicker: 'Key Clark · Talk', h: 'thank you',
    body: 'Every source is in the paper, and every example runs on the site. Scan to open it.',
    strip: [['Made for', 'Folklore Digital']],
    qr: 'https://wam-2026.netlify.app',
  },
  /* The finale, last: the credits screen turns out to be the fPhone Duo's inner display, which zooms out, sleeps and folds shut. */
  {
    id: 'close-finale', code: 'END', layout: 'stage', tint: 'composite', prism: true, demoId: 'composite/finale', even: true, bare: true, demoWidth: 864,
    kicker: 'With thanks', h: 'with thanks',
  },
];

/** Section tint → the token that paints it.
 *  @type {Record<string, string>} */
export const TINTS = {
  video: 'var(--tint-video)', css: 'var(--tint-css)', composite: 'var(--tint-composite)',
  svg: 'var(--tint-svg)', canvas: 'var(--tint-canvas)', webgl: 'var(--tint-webgl)',
  webgpu: 'var(--tint-webgpu)',
};
