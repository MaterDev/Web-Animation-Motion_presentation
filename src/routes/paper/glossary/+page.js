import raw from '../../../../GLOSSARY.md?raw';
import { renderDoc } from '$lib/doc.js';

/* Both groups list every term in the contents: on a glossary the terms
   ARE the landmarks. */
export function load() {
  return renderDoc(raw, { landmarks: { 'The ten to understand': true, 'Twenty more worth knowing': true } });
}
