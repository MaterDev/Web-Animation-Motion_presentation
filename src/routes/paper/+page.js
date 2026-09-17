import raw from '../../../SCOPE.md?raw';
import { renderDoc } from '$lib/doc.js';

/* Landmarks: the sections whose subsections earn a line in the contents.
   The six technique stops, composite mechanics, and the two halves of
   the budget argument. Everything else stays one line. */
const LANDMARKS = {
  'The techniques': ['Layout / CSS', 'SVG', 'GIF', 'Video', 'Canvas — the surface', 'WebGL and WebGPU'],
  Composite: ['Composite mechanics'],
  'Performance budgets, and performance as an extension of QA': ['The budget', 'Performance as an extension of QA'],
};

export function load() {
  return renderDoc(raw, { landmarks: LANDMARKS });
}
