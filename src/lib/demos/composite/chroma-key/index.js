// @ts-nocheck -- mounts sheet code that was never typed
import { stage } from '../../_kit/stage.js';
import { disposer } from '../../_kit/disposer.js';
import css from './demo.css?raw';
import html from './demo.html?raw';
import { keyer } from './keyer.js';

const MP4 = new URL('./assets/greens-screen-9x16.mp4', import.meta.url).href;

/** @param {HTMLElement} host */
export function mount(host) {
  const { root } = stage(host, { css, html: html.replaceAll('%MP4%', MP4) });
  const d = disposer();
  keyer(root, d);
  return () => d.run();
}
