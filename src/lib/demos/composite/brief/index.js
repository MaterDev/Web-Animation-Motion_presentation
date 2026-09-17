import { stage } from '../../_kit/stage.js';
import css from './demo.css?raw';
import html from './demo.html?raw';

/* Static markup and CSS only: the one motion (the layers assembling) is a
   CSS animation on transform with its own reduced-motion rule, so there is
   nothing to stop beyond clearing the root. */
/** @param {HTMLElement} host */
export function mount(host) {
  const { root } = stage(host, { css, html });
  return () => { root.innerHTML = ''; };
}
