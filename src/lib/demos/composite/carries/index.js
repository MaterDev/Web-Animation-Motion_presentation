import { stage } from '../../_kit/stage.js';
import css from './demo.css?raw';
import html from './demo.html?raw';

/* SVG and CSS only. The one motion, a highlight stepping through the
   parts, is a CSS animation with a reduced-motion rule, so dispose only
   has to clear the root. */
/** @param {HTMLElement} host */
export function mount(host) {
  const { root } = stage(host, { css, html });
  return () => { root.innerHTML = ''; };
}
