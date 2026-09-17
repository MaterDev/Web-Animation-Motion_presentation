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
   register) and carry `verify: true` until checked. */

/** @typedef {'hero'|'statement'|'index'|'figure'|'split'|'bleed'|'compare'|'gallery'} Layout */
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
 * @property {{ h: string, body: string }[]} [compare]
 * @property {Example[]} [examples]
 */

/** @type {Slide[]} */
export const SLIDES = [
  /* ── Opening. Beats 1 and 2 (why I'm up here; the nine months) are spoken
     over the title, not slides. Context, not argument. ── */
  {
    id: 'open-title', code: 'WAM', layout: 'hero', tint: 'composite',
    kicker: 'WAM-2026', h: 'web animation<br>& motion',
    body: 'Key Clark · Folklore · 17 September 2026',
  },
  {
    id: 'open-data', code: 'OPEN', layout: 'figure', tint: 'composite', verify: true,
    kicker: 'Why now', h: '68% never click',
    body: 'Most Google searches this year ended without anyone visiting a website. — SparkToro, January–April 2026',
  },
  {
    id: 'open-reading', code: 'OPEN', layout: 'figure', tint: 'composite',
    kicker: 'What that might mean', h: 'from answers to experiences',
    body: 'If people stop visiting websites for answers, what’s left to visit for is the experience. That’s a reading, not a prophecy.',
  },
  {
    id: 'open-reframe', code: 'OPEN', layout: 'figure', tint: 'composite',
    kicker: 'Why an engineer cares', h: 'not decoration',
    body: 'A good site is built from a shared kit of parts. Motion built into that kit can be changed once, everywhere. Motion bolted on has to be redone by hand, every time.',
  },
  {
    id: 'open-question', code: 'OPEN', layout: 'figure', tint: 'composite',
    kicker: 'Keep this in mind', h: 'could you describe it?',
    body: 'As we go: could you describe what you’re seeing well enough for someone else to build it? Or would you have to point?',
  },

  /* ── Stop 1 · Layout / CSS ── */
  {
    id: 'css-intro', code: 'SL-06', layout: 'figure', tint: 'css',
    kicker: '1 · Layout & CSS', h: 'the page itself moves',
    body: 'You already know this one: menus that slide, cards that open. A newspaper can’t move. A web page can, and this is the cheapest way to do it.',
  },
  {
    id: 'css-cost', code: 'SL-06', layout: 'compare', tint: 'css',
    kicker: '1 · Layout & CSS', h: 'cheap, until it isn’t',
    compare: [
      { h: 'good at', body: 'Free, works everywhere, and the browser does the heavy lifting.' },
      { h: 'costs', body: 'Animate the wrong thing and the browser redraws the page. Stick to moving and fading, transform and opacity, and it stays smooth.' },
    ],
  },
  {
    id: 'css-demos', code: 'SL-06', layout: 'index', tint: 'css', placeholder: true,
    kicker: '1 · Layout & CSS · demos', h: 'demos',
    items: ['timeless — a magazine whose layout moves', 'drawing with css — blobs, moiré, holographic type'],
  },

  /* ── Stop 2 · SVG ── */
  {
    id: 'svg-intro', code: 'SL-10', layout: 'figure', tint: 'svg',
    kicker: '2 · SVG', h: 'drawn, not loaded',
    body: 'The browser draws the graphic from instructions while the page runs. It’s behind most charts, maps and icons. The catch: every shape has a cost, so thousands of them get slow.',
  },
  {
    id: 'svg-vs-css', code: 'SL-10', layout: 'compare', tint: 'svg',
    kicker: '2 · SVG', h: 'not the same as CSS',
    compare: [
      { h: 'css', body: 'Moves what’s already on the page: boxes, text, images.' },
      { h: 'svg', body: 'Draws the shapes themselves, so they can come from data or turn into something else.' },
    ],
  },
  {
    id: 'svg-demos', code: 'SL-10', layout: 'index', tint: 'svg', placeholder: true,
    kicker: '2 · SVG · demos', h: 'demos',
    items: ['a history of ai, drawn from real data', 'the camera bench'],
  },

  /* ── Stop 3 · GIF — the shortest stop ── */
  {
    id: 'gif-intro', code: 'SL-05', layout: 'figure', tint: 'video',
    kicker: '3 · GIF', h: 'no off switch',
    body: 'Works anywhere with no code, but you can’t pause it or slow it down. Ours are made by a script, so changing one is an edit, not a redo.',
  },
  {
    id: 'gif-demos', code: 'SL-05', layout: 'index', tint: 'video', placeholder: true,
    kicker: '3 · GIF · demos', h: 'demos',
    items: ['one sticker, four places', 'eight tiny animated id cards'],
  },

  /* ── Stop 4 · Video ── */
  {
    id: 'video-intro', code: 'SL-04', layout: 'figure', tint: 'video',
    kicker: '4 · Video', h: 'it can’t react',
    body: 'Video is the cheapest way to put motion on a page, and you can pause it. But it can’t respond to a scroll, a hover or a click.',
  },
  {
    id: 'video-component', code: 'SL-04', layout: 'figure', tint: 'video',
    kicker: '4 · Video', h: 'motion you can edit',
    body: 'Built in code, motion can be changed like any other part of the site, even by a client in their content system. We’re not making a video. We’re making the thing that makes them.',
  },
  {
    id: 'video-demos', code: 'SL-04', layout: 'index', tint: 'video', placeholder: true,
    kicker: '4 · Video · demos', h: 'demos',
    items: ['nova-7 — a gadget rendered to video', 'live filters on a camera', 'an elk filmed on green screen, placed into the page', 'the vertical social cut, made not cropped'],
  },

  /* ── Stop 5 · Canvas — the setup for the graphics card; can run short ── */
  {
    id: 'canvas-intro', code: 'SL-11', layout: 'figure', tint: 'canvas',
    kicker: '5 · Canvas', h: 'try selecting the text',
    body: 'On most sites you can highlight text, drag an image, tab to a link. On a canvas you can’t. It’s just pixels the page painted, and it remembers nothing.',
  },
  {
    id: 'canvas-why', code: 'SL-11', layout: 'compare', tint: 'canvas',
    kicker: '5 · Canvas', h: 'so why use it?',
    compare: [
      { h: 'for a content site', body: 'You’d give up too much.' },
      { h: 'for richer graphics', body: 'Freedom a normal page can’t give: real depth, and control of every pixel.' },
    ],
  },
  {
    id: 'canvas-demos', code: 'SL-11', layout: 'index', tint: 'canvas', placeholder: true,
    kicker: '5 · Canvas · demos', h: 'demos',
    items: ['acetate — a print-shop desk', 'halftone printing', 'a clickable transit map'],
  },

  /* ── Stop 6 · WebGL and WebGPU, as one: the graphics card. Punchy — no buffers, no shaders. ── */
  {
    id: 'gpu-intro', code: 'SL-12 · SL-14', layout: 'figure', tint: 'webgpu',
    kicker: '6 · WebGL & WebGPU', h: 'the graphics card',
    body: 'Think of a video game, then think of a website. Much of that difference is the graphics card, and these let a web page use it.',
  },
  {
    id: 'gpu-two', code: 'SL-12 · SL-14', layout: 'compare', tint: 'webgpu',
    kicker: '6 · WebGL & WebGPU', h: 'two ways in',
    compare: [
      { h: 'webgl', body: 'Older. Runs almost everywhere. Years of answers online.' },
      { h: 'webgpu', body: 'Newer. Can do far more at once. Less help when you get stuck.' },
    ],
  },
  {
    id: 'gpu-demos', code: 'SL-12 · SL-14', layout: 'index', tint: 'webgpu', placeholder: true,
    kicker: '6 · WebGL & WebGPU · demos', h: 'demos',
    items: ['roost — 131,072 birds, each reacting', 'a vermeer under a magnifying glass', 'the marble bust', 'supercell — a storm'],
  },

  /* ── What gets in the way. One slide, four points; Key talks through them and paces it live.
     Not a warning; naming what's uncertain, not a call to action. ── */
  {
    id: 'friction', code: 'FRICTION', layout: 'figure', tint: 'composite',
    kicker: 'What gets in the way', h: 'what gets<br>in the way',
    body: 'Real technical limits. No shared words for motion. Saying clearly what you want. No agreed limit for how much motion a page can afford.',
  },

  /* ── Close. Mix and match, proof it's buildable, then the question — to us and to the client. ── */
  {
    id: 'close-composite', code: 'CLOSE', layout: 'figure', tint: 'composite',
    kicker: 'Bringing it together', h: 'mix and match',
    body: 'Most of what you just saw combined several of these. The useful question isn’t which technique a project uses. It’s which one does which part.',
  },
  {
    id: 'close-shipped', code: 'CLOSE', layout: 'figure', tint: 'composite',
    kicker: 'Already happening', h: 'it’s already shipped',
    body: 'We’ve done this: a gallery of motion patterns for our designers, and a shared design system that went live for a client.',
  },
  {
    id: 'close-question', code: 'CLOSE', layout: 'compare', tint: 'composite',
    kicker: 'Back to the question', h: 'could you describe it?',
    compare: [
      { h: 'could we?', body: 'AI didn’t create the need to explain clearly. It removed the last place to hide.' },
      { h: 'could the client?', body: 'And can we help them do it early? That gap is where the budget quietly goes.' },
    ],
  },
  {
    id: 'close-end', code: 'WAM', layout: 'hero', tint: 'composite',
    kicker: 'WAM-2026', h: 'thank you',
    body: 'wam-2026.netlify.app · every source is in the paper',
  },
];

/** Section tint → the token that paints it.
 *  @type {Record<string, string>} */
export const TINTS = {
  video: 'var(--tint-video)', css: 'var(--tint-css)', composite: 'var(--tint-composite)',
  svg: 'var(--tint-svg)', canvas: 'var(--tint-canvas)', webgl: 'var(--tint-webgl)',
  webgpu: 'var(--tint-webgpu)',
};
