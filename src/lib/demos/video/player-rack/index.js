// @ts-nocheck -- mounts sheet code that was never typed
import { stage } from '../../_kit/stage.js';
import { disposer } from '../../_kit/disposer.js';
import css from './demo.css?raw';
import html from './demo.html?raw';
import { rack } from './rack.js';
import { vision } from './vision.js';

const MP4 = new URL('./assets/nova7-explode-16x9.mp4', import.meta.url).href;
const POSTER = new URL('./assets/nova7-explode-16x9-poster.png', import.meta.url).href;

/** @param {HTMLElement} host */
export function mount(host) {
  const { root } = stage(host, {
    css,
    html: html.replaceAll('%MP4%', MP4).replaceAll('%POSTER%', POSTER),
  });
  const d = disposer();
  rack(root, d);
  vision(root, d);
  return () => d.run();
}
