// @ts-nocheck -- sheet code, untyped on the sheet
import { stage } from '../../_kit/stage.js';
import css from './demo.css?raw';
import html from './demo.html?raw';

/* Chromium ignores @property inside a shadow root, so the rule in
   demo.css registers nothing here and --holo would step instead of
   interpolate. The same registration, made at document level (where it
   reaches every tree). Registration is global and permanent for the
   page; a second mount finds it already there and moves on. */
function registerProps() {
  try { CSS.registerProperty({ name: '--holo', syntax: '<angle>', inherits: false, initialValue: '0deg' }); } catch { /* already registered */ }
}

/* Goo, moiré and the TIMELESS poster are CSS-only: mounting is the whole
   demo, and clearing the shadow root stops every animation with it. */
export function mount(host) {
  registerProps();
  const { root } = stage(host, { css, html });
  if (window.top !== window.self) root.getElementById('crumb').style.display = 'none';
  return () => { root.innerHTML = ''; };
}
