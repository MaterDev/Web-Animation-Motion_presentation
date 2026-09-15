/* Every slide prerenders at its own path, so the static site has one real
   page per slide as well as the dev server. An id that is not in the deck
   is a 404 rather than a silent jump to slide one. */
import { error } from '@sveltejs/kit';
import { SLIDES } from '$lib/deck/slides.js';

/** @type {import('./$types').EntryGenerator} */
export const entries = () => SLIDES.map((s) => ({ slide: s.id }));

/** @type {import('./$types').PageLoad} */
export const load = ({ params }) => {
  const i = SLIDES.findIndex((s) => s.id === params.slide);
  if (i < 0) error(404, `No slide '${params.slide}' in the deck`);
  return { i };
};
