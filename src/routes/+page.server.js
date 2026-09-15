import raw from '../../SCOPE.md?raw';
import { sections } from '$lib/paper.js';

/* Server-only on purpose: the page is prerendered, so this runs at
   build time and the client receives the section titles as data,
   never the paper's markdown in its bundle. */
export function load() {
  return { paperSections: sections(raw) };
}
