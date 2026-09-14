/* THE DECK, AS DATA.
   This is the only place slide content lives. Nothing here knows how a
   slide is drawn — `layout` names a composition and the renderer looks
   it up, so changing what a slide says and changing how it looks are
   two different edits.

   `demo` is a URL, not a name — so a slide can point at one of these
   filler pages today and at design/techniques/… tomorrow with no
   other change.

   Everything below is FILLER. Real content gets written later; these
   exist to exercise the surface — every layout, a slide with a live
   demo, a slide that deliberately throws — and nothing here should be
   mistaken for the talk. `sample: true` marks them, so "the deck is
   finished" is decidable by searching for the ones that remain. */

/** @typedef {'hero'|'statement'|'index'|'figure'|'split'|'bleed'|'compare'|'gallery'} Layout */
/** @typedef {{ label: string, demo: string }} Example */
/**
 * @typedef {object} Slide
 * @property {string} id
 * @property {string} code
 * @property {Layout} layout
 * @property {string} [tint]
 * @property {boolean} [sample]
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
  {
    id: 's01', code: 'SL-01', layout: 'hero', tint: 'webgpu', sample: true,
    kicker: 'WAM-2026', h: 'web animation<br>& motion',
    body: 'Cold open — the thread demo is already running.',
    demo: '/deck-demos/field.html',
  },
  {
    id: 's02', code: 'SL-02', layout: 'statement', sample: true,
    kicker: 'Thesis', h: "a site's value is<br>no longer the<br>content it holds",
  },
  {
    id: 's03', code: 'SL-03', layout: 'index', tint: 'css', sample: true,
    kicker: 'The Map', h: 'the spectrum',
    items: ['layout / css', 'svg', 'canvas', 'gif', 'video', 'webgl', 'webgpu', 'composite'],
  },
  {
    id: 's04', code: 'SL-06', layout: 'figure', tint: 'css', sample: true,
    kicker: 'Layout / CSS', h: 'browser-managed<br>motion',
    body: 'The platform does the work. Cheap, constrained, everywhere.',
    demo: '/deck-demos/bars.html',
    readout: [['0.9', 'ms gpu'], ['18.4', 'ms cpu']],
  },
  {
    id: 's05', code: 'SL-10', layout: 'split', tint: 'svg', sample: true,
    kicker: 'SVG', h: 'vector,<br>dom-based',
    body: 'Every mark is a real element. That is the cost and the point.',
    items: ['path morphing', 'draw-on', 'real dom nodes'],
  },
  /* The shape a technique takes, in three slides. Introduce it, then
     separate it from whatever it gets confused with, then stop
     presenting and start browsing — the gallery slide holds several
     examples and switches between them in place, so the commentary
     over them can be unscripted without the deck losing its place. */
  {
    id: 's06', code: 'SL-11', layout: 'figure', tint: 'canvas', sample: true,
    kicker: 'Canvas · what it is', h: 'imperative pixels',
    body: 'One element, a drawing API, and a loop. Nothing on screen is addressable — you get pixels, and you own every one of them.',
    demo: '/deck-demos/field.html',
    readout: [['1,800', 'particles']],
  },
  {
    id: 's06b', code: 'SL-11', layout: 'compare', tint: 'canvas', sample: true,
    kicker: 'Canvas · not SVG', h: 'the one it gets<br>confused with',
    compare: [
      { h: 'svg', body: 'Every mark is an element. Styleable, hit-testable, screen-readable — and each one costs a node.' },
      { h: 'canvas', body: 'One element. Nothing is addressable, nothing is free to inspect — and the count stops mattering.' },
    ],
  },
  {
    id: 's06c', code: 'SL-11', layout: 'gallery', tint: 'canvas', sample: true,
    kicker: 'Canvas · examples', h: 'in practice',
    examples: [
      { label: 'particle field', demo: '/deck-demos/field.html' },
      { label: 'plain markup',   demo: '/deck-demos/bars.html' },
      { label: 'dense field',    demo: '/deck-demos/field.html?n=1600' },
    ],
  },
  {
    id: 's07', code: 'SL-12', layout: 'bleed', tint: 'webgl', sample: true,
    kicker: 'WebGL', h: 'gpu shaders',
    body: 'Tens of thousands of points, reactive to the cursor.',
    demo: '/deck-demos/field.html',
  },
  {
    id: 's08', code: 'SL-14', layout: 'figure', tint: 'webgpu', sample: true,
    kicker: 'WebGPU', h: 'compute shaders',
    body: 'The particle count WebGL cannot sustain.',
    demo: '/deck-demos/broken.html',
    readout: [['1.2', 'm particles']],
  },
  {
    id: 's09', code: 'SL-07', layout: 'split', tint: 'composite', sample: true,
    kicker: 'Composite', h: 'the pipeline',
    body: 'Layout, paint, composite — and which of the three you pay for.',
    items: ['layout', 'paint', 'composite'],
  },
  {
    id: 's10', code: 'SL-15', layout: 'index', tint: 'video', sample: true,
    kicker: 'Fallbacks', h: 'the degradation<br>ladder',
    items: ['full compute sim', 'webgl reduced', 'static poster', 'reduced motion'],
  },
  {
    id: 's11', code: 'SL-16', layout: 'statement', sample: true,
    kicker: 'The Close', h: 'possible is<br>the easy part',
  },
  {
    id: 's12', code: 'SL-17', layout: 'hero', tint: 'svg', sample: true,
    kicker: 'Thank you', h: 'questions',
    body: 'Key Clark · WAM-2026',
  },
];

/** Section tint → the token that paints it.
 *  @type {Record<string, string>} */
export const TINTS = {
  video: 'var(--tint-video)', css: 'var(--tint-css)', composite: 'var(--tint-composite)',
  svg: 'var(--tint-svg)', canvas: 'var(--tint-canvas)', webgl: 'var(--tint-webgl)',
  webgpu: 'var(--tint-webgpu)',
};
