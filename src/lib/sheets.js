/* The design harness's sheets, as data.

   Deliberately duplicated from the ITEMS array in
   design/index.html rather than imported: that file is a standalone
   page that has to keep working when opened directly with no build
   step, so it can't export a module the app consumes. The list is
   short and changes rarely; the alternative — a generated manifest
   both sides read — buys little and adds a build dependency to the
   one part of the repo whose whole point is not having one.

   If a sheet is added, add it in both places. */
export const SHEETS = [
  {
    group: 'Reference',
    code: 'SYS',
    name: 'System',
    note: 'T-06 — materials, glass, liquid motion, micro-animations, motion tokens, colour, scrollbars',
    file: 'treatments/06-field-unit-dark.html',
  },
  {
    group: 'Reference',
    code: 'LAY',
    name: 'Layouts',
    note: 'The LED slide surface, the modular grid, all 15 compositions, and the live transition preview',
    file: 'layouts/index.html',
  },
  {
    group: 'Reference',
    code: 'GFX',
    name: 'Graphic language',
    note: 'Per-topic tint, pixel marks, rule treatments, glyph sets and pattern bands',
    file: 'graphic-language/index.html',
  },
  { group: 'Techniques', code: 'SL-04', name: 'Video / GIF', note: 'Baseline — pre-baked pixels', file: 'techniques/video.html', tint: 'var(--tint-video)' },
  { group: 'Techniques', code: 'SL-05', name: 'CSS', note: 'Browser-managed motion', file: 'techniques/css.html', tint: 'var(--tint-css)' },
  { group: 'Techniques', code: 'SL-06', name: 'Composite', note: 'CPU vs. GPU', file: 'techniques/composite.html', tint: 'var(--tint-composite)' },
  { group: 'Techniques', code: 'SL-09', name: 'SVG', note: 'Vector, DOM-based', file: 'techniques/svg.html', tint: 'var(--tint-svg)' },
  { group: 'Techniques', code: 'SL-10', name: 'Canvas', note: 'Imperative pixel drawing', file: 'techniques/canvas.html', tint: 'var(--tint-canvas)' },
  { group: 'Techniques', code: 'SL-11', name: 'WebGL', note: 'GPU shaders, real 3D', file: 'techniques/webgl.html', tint: 'var(--tint-webgl)' },
  { group: 'Techniques', code: 'SL-13', name: 'WebGPU', note: 'Compute shaders', file: 'techniques/webgpu.html', tint: 'var(--tint-webgpu)' },
];

/* The five superseded treatments. Kept reachable rather than
   deleted, because the methodology argument on /design depends on
   them being real and inspectable — "we made six and kept one" is a
   claim you should be able to check. */
export const TREATMENTS = [
  { code: 'T-01', name: 'Instrument housing', file: 'treatments/01-instrument-housing.html' },
  { code: 'T-02', name: 'Daylight panel', file: 'treatments/02-daylight-panel.html' },
  { code: 'T-03', name: 'Panel grey', file: 'treatments/03-panel-grey.html' },
  { code: 'T-04', name: 'Chassis', file: 'treatments/04-chassis.html' },
  { code: 'T-05', name: 'Field unit', file: 'treatments/05-field-unit.html' },
  { code: 'T-06', name: 'Field unit (dark) — kept', file: 'treatments/06-field-unit-dark.html', kept: true },
];

/** @param {string} path */
export const base = (path) => `/sheets/${path}`;
