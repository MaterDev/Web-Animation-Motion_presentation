// @ts-nocheck -- copied from design/techniques/webgpu/; untyped sheet code
/* the iPhone Duo's inner display as a CSS shell: 890 × 626 pt at 1 CSS px = 1 pt,
   scaled as a whole when the column is narrower, never re-laid. The furniture
   iOS 27 keeps on this device — the time over the radios disc in the top-right
   corner — is markup; each app draws its own panes inside. */
import { $ } from './common.js';
export const DUO = { w: 890, h: 626, frameW: 928, frameH: 664, leaf: 445 };
export function duoShell(fitId, frameId) {
  const fit = $(fitId), frame = $(frameId);
  const scale = () => { const sc = Math.min(1.6, fit.clientWidth / DUO.frameW); frame.style.setProperty('--dd-scale', sc); fit.style.height = (DUO.frameH * sc) + 'px'; };
  /* extraction: the observer is returned so the demo can disconnect it on dispose */
  const ro = new ResizeObserver(scale); ro.observe(fit); scale();
  return { fit, frame, scale, ro };
}
