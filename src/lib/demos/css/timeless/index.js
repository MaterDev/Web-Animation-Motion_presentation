// @ts-nocheck -- sheet code, untyped on the sheet
import { stage } from '../../_kit/stage.js';
import css from './demo.css?raw';
import html from './demo.html?raw';

/* Chromium ignores @property inside a shadow root, so the rule in
   demo.css registers nothing here and --accent would step instead of
   interpolate. The same registration, made at document level (where it
   reaches every tree). Registration is global and permanent for the
   page; a second mount finds it already there and moves on. */
function registerProps() {
  try { CSS.registerProperty({ name: '--accent', syntax: '<color>', inherits: true, initialValue: '#b5342a' }); } catch { /* already registered */ }
}

/* All six cards are CSS-only: mounting is the whole demo, and removing
   the shadow root's contents stops every animation with it. */
export function mount(host) {
  registerProps();
  const { root } = stage(host, { css, html });
  // the sheet hides its breadcrumb when framed; same check, scoped to the root
  if (window.top !== window.self) root.getElementById('crumb').style.display = 'none';
  return () => { root.innerHTML = ''; };
}
