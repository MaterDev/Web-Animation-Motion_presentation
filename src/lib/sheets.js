/* The design section's contents, as data — used by the section
   sidebar, the top-bar dropdown, and the reference viewer, so all
   three can't disagree about what exists.

   The sheet list is deliberately duplicated from the ITEMS array in
   design/index.html rather than imported: that file is a standalone
   page that has to keep working when opened directly with no build
   step, so it can't export a module the app consumes. The list is
   short and changes rarely; a generated manifest both sides read
   would buy little and add a build dependency to the one part of the
   repo whose whole point is not having one.

   If a sheet is added, add it in both places. */

/** The design section's landing page. */
export const PAGES = [
  { href: '/design', code: 'OVW', name: 'Overview', note: 'What this section is' },
];

/** The pages that narrate how the system was decided. They head the
 *  Treatments group, next to the six treatments they describe: the
 *  methodology tells the process, the write-up compares the directions. */
export const PROCESS_PAGES = [
  { href: '/design/methodology', code: 'MTH', name: 'Methodology', note: 'How the system was made, and why the process is what it is' },
  { href: '/design/treatments', code: 'ITR', name: 'Treatments', note: 'The six competing directions, five of them superseded' },
];

/** The design system's live reference sheets, shown in the design viewer.
 *  The technique sheets moved to their own section; see TECHNIQUES. */
export const SHEETS = [
  {
    group: 'Reference',
    code: 'SYS',
    name: 'System',
    note: 'Materials, glass, liquid motion, micro-animations, motion tokens, colour, scrollbars',
    file: 'treatments/06-field-unit-dark.html',
  },
  {
    group: 'Reference',
    code: 'LAY',
    name: 'Layouts',
    note: 'The LED surface, the modular grid, all 15 compositions, the live transition preview',
    file: 'layouts/index.html',
  },
  {
    group: 'Reference',
    code: 'GFX',
    name: 'Graphic language',
    note: 'Per-topic tint, pixel marks, rule treatments, glyph sets, pattern bands',
    file: 'graphic-language/index.html',
  },
];

/* The technique sheets are their own top-level section (/techniques),
   no longer part of the design system. ORDER IS THE TALK'S COMPREHENSION
   LADDER (SCOPE.md › The techniques): CSS, SVG, GIF, Video, Canvas, then
   WebGL and WebGPU. Composite follows as the pipeline demo; the paper
   does not count it as a technique. */
export const TECHNIQUES = [
  { group: 'Techniques', code: 'SL-06', name: 'Layout / CSS', note: 'Layout animated by selectors + scroll', file: 'techniques/css.html', tint: 'var(--tint-css)' },
  { group: 'Techniques', code: 'SL-10', name: 'SVG', note: 'Vector, DOM-based', file: 'techniques/svg.html', tint: 'var(--tint-svg)' },
  { group: 'Techniques', code: 'SL-05', name: 'GIF', note: 'Baseline — pre-baked, no player', file: 'techniques/gif/index.html', tint: 'var(--tint-video)' },
  { group: 'Techniques', code: 'SL-04', name: 'Video', note: 'Baseline — pre-baked pixels', file: 'techniques/video/index.html', tint: 'var(--tint-video)' },
  { group: 'Techniques', code: 'SL-11', name: '2D Canvas', note: 'Imperative pixel drawing', file: 'techniques/canvas.html', tint: 'var(--tint-canvas)' },
  { group: 'Techniques', code: 'SL-12', name: 'WebGL', note: 'The picture is computed, not stored', file: 'techniques/webgl.html', tint: 'var(--tint-webgl)' },
  { group: 'Techniques', code: 'SL-14', name: 'WebGPU', note: 'Compute shaders', file: 'techniques/webgpu.html', tint: 'var(--tint-webgpu)' },
  { group: 'Techniques', code: 'SL-07', name: 'Composite', note: 'The closing argument — which surface carries which part', file: 'techniques/composite.html', tint: 'var(--tint-composite)' },
];

/* The six treatments: the kept one first, then the rest newest to
   oldest, so the list opens on the decision and reads back through
   how it was reached. The codes still number them in the order they
   were made. Kept reachable
   and viewable rather than deleted, because the methodology's
   central claim — that directions were built, looked at, and thrown
   away — is one you should be able to check.

   The arc isn't a straight line, which is the interesting part:
   started dark, went light on the argument that light projects more
   safely, built the system up across three light iterations, then
   flipped back to dark once the LED-screen premise arrived and made
   an emissive ground the honest choice. */
export const TREATMENTS = [
  {
    group: 'Treatments',
    code: 'T-06',
    name: 'Field unit (dark)',
    file: 'treatments/06-field-unit-dark.html',
    ground: 'dark',
    kept: true,
    note: 'T-05 re-derived on a dark ramp — same components, values recomputed',
    verdict:
      'Kept. The dark ground is what let the LED-screen premise work, and the grid and slide surface are both built on it.',
  },
  {
    group: 'Treatments',
    code: 'T-05',
    name: 'Field unit',
    file: 'treatments/05-field-unit.html',
    ground: 'light',
    note: 'The motion system, corrected mid-build; ambient and triggered separated',
    verdict:
      'Motion solved — Liquid Glass re-read from what Apple actually shipped. Ground still wrong: a light panel fights an emissive screen.',
  },
  {
    group: 'Treatments',
    code: 'T-04',
    name: 'Chassis',
    file: 'treatments/04-chassis.html',
    ground: 'light',
    note: 'Adds the architecture diagram and the annotated presenter unit',
    verdict:
      'Where the system stopped being a palette and became a spec. Most of the component vocabulary starts here.',
  },
  {
    group: 'Treatments',
    code: 'T-03',
    name: 'Panel grey',
    file: 'treatments/03-panel-grey.html',
    ground: 'light',
    note: 'Off white to a mid grey; argues light is the safer projection choice',
    verdict: 'Right about contrast. The surface still read as flat and papery — no material yet.',
  },
  {
    group: 'Treatments',
    code: 'T-02',
    name: 'Daylight panel',
    file: 'treatments/02-daylight-panel.html',
    ground: 'light',
    note: 'Inverted to a near-white ground — four structural changes, not a re-skin',
    verdict:
      'Proved the ramp has to be re-derived rather than flipped: tints built to pop off a dark ground go muddy on a light one.',
  },
  {
    group: 'Treatments',
    code: 'T-01',
    name: 'Instrument housing',
    file: 'treatments/01-instrument-housing.html',
    ground: 'dark',
    note: 'Dark ground, machined-instrument metaphor, clickable section tints',
    verdict:
      'Established the housing idea and the tint system. Landed too close to the terminal/blueprint cliché DESIGN.md had set out to avoid.',
  },
];

/* Everything the viewer can show, in sidebar order. Treatments are
   included so they're inspectable in place rather than only as links
   off a write-up. */
export const VIEWABLE = [...SHEETS, ...TREATMENTS];

/** @param {string} path */
export const base = (path) => `/sheets/${path}`;

/**
 * @param {{ code: string }[]} list
 * @param {string | null | undefined} code
 */
export const indexIn = (list, code) =>
  list.findIndex((s) => s.code.toLowerCase() === String(code ?? '').toLowerCase());

/** @param {string | null | undefined} code */
export const indexFor = (code) => indexIn(VIEWABLE, code);

/** @param {string} code */
export const sheetHref = (code) => `/design/reference?sheet=${code.toLowerCase()}`;

/** @param {string} code */
export const techniqueHref = (code) => `/techniques?sheet=${code.toLowerCase()}`;
