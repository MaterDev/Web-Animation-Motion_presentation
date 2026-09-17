# canvas/batching — halftone press console

## What it is
A live four-colour halftone at 20×: an artwork drawn offscreen is read back, separated into CMYK plates and screened as dots at drifting angles with a moving loupe, and the draw method (arc per dot, one batched path, drawImage sprite, fillRect) is switchable live with its cost measured. Below it, Tables A and B measure 50 000 marks four ways (with a pixel-identity guard) and four mark types.

## Source
- Sheet: `design/techniques/canvas.html`, **§2 Batching**.
- Markup: 529–561 (`h2-world`: bar, explainer 545–551, console stage, readouts), 563–579 (`h2-instr`), 581–616 (Tables A/B, guard, `table-notes`).
- CSS: 240–288 (`.h2`), plus `.cv-cap` 62–63 and `.cv-scroll`/`.cv-table`/`.cv-guard`/`.cv-instr` 68–80.
- JS: `var SEC2` 1356–1529 (tables); console 1534–1816 (clock at 1724); explainer 1823–1900; bar handler 1902–1926; table run 1928.
- Helpers 861–942; `skin.js` (SKIN_CSS).

## Extraction changes
- **Shadow root.** Markup and CSS mount through `_kit/stage.js`; `$` (by `data-testid`) queries the shadow root instead of `document`.
- **Helpers copied** into `helpers.js` (from canvas.html 861–942). `token()` reads the demo host (where `:root` tokens land as `:host`) instead of `document.documentElement`, and the world probe is appended **inside the shadow root** with only this world's class, not to `document.body` with all five.
- **Token misses** were printed on the page-level instrument plate (canvas.html 436–446, 976–996). The plate is omitted; a miss now goes to `console.warn` instead.
- **Instrument plate omitted** (renderer, clock floor, backing store): it is page-level.
- **`WAM`** is a per-demo `createWAM({ root })` instance instead of `window.WAM`, and is disposed on unmount.
- **Listeners** on in-demo elements are registered through `_kit/disposer.js` so dispose removes them.
- **Classic scripts to modules.** `skin.js` became `skin.js` with named exports (`self.SKIN_X = function` → `export const SKIN_X = function`; internal `self.SKIN_` references → bare names). Call sites `self.SKIN_X(…)` → `SKIN_X(…)`.
- **CSS.** Only the rules this demo uses. `:root { --tint }` → `:host`. The `body` rule from tokens.css does not reach a shadow root, so its background/colour/font are restated on `.demo-root`. The sheet's `.wrap` (1060 px max width) is not carried, so the world runs the viewer's full width. The global page grain (`body::after`) is not carried.
- **Unused sheet furniture not carried:** `fit()`, `onResize()` and the `window` resize listener (no section used them), `DPR`, the breadcrumb, the section head and `.cv-because` prose outside the world.
- **BOOT gate removed.** The sheet ran `SEC2.measure()` through `BOOT.when` — held until §5's worker had passed its parity check, or a 4 s fallback — because the ~1 s blocking measurement starved §5's ping. There is no §5 in this demo, so the tables now run once, **1 s after mount**, on a disposer timeout (cancelled if the demo unmounts first). The console's first second is therefore not covered by the block, but the ~1 s main-thread stall still happens once, right after mount.
- `SEC2` stays a function-scoped var inside `mount` (was module-level of the sheet's IIFE).

## Carried over as-is
- **The table measurement blocks the main thread for about a second** (7 reps × 8 methods × 50 000 marks, plus warm-ups and a full-canvas pixel diff). The console freezes while it runs.
- Measured during verification (headless Chromium, contended, not stage numbers): Table A fillRect 8.6 ms, batched path 13.3 ms, drawImage sprite 57.4 ms, putImageData 0.9 ms; 0 of 540 000 pixels differ. Table B 10.7 / 14.7 / 15.4 / 15.2 ms. The sheet's own run was in the same range. Numbers are machine-dependent by design; the notes (sheet §notes) claim batching into one path is slower than per-call, which this run reproduced.
- The console's "draw + sync" cost resets when the method changes.
- `h2-angles` initial text in markup is replaced on first render.
- The explainer calls `resolveRGB(token(…))` several times per frame (allocates a 1×1 canvas each time).

## Assets
None. The "artwork" is drawn to an offscreen canvas at mount.

## For the edit pass
Nothing specific recorded for this demo yet. Consider whether the tables belong on the same slide as the console (they stall it for ~1 s).
