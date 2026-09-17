# canvas/readback — radiology workstation

## What it is
A synthetic phantom "scan" drawn into an offscreen canvas and read back with one `getImageData` per frame; the viewport's window/level mapping, LUT, fusion overlay, histogram, region statistics, magnified region, profile and optional threshold "reconstruction" are all derived from that read. Drag on the image to set window and level; the bar switches LUT, cine, region, auto window, fusion ramp and rotation.

## Source
- Sheet: `design/techniques/canvas.html`, **§4 Readback**.
- Markup: 698–727 (`r4-world`: bar, stage, caption, readouts) and 729–738 (`r4-instr` notes).
- CSS: 378–419 (`.r4`), plus `.cv-dagger` 75 and `.cv-instr` 79–80.
- JS: 2630–3080 (clock at 2745, pointer drag 3049–3061, bar handler 3063–3079).
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
- Pointer listeners (`pointerdown/up/move` on the canvas) go through the disposer.

## Carried over as-is
- Every frame re-draws the full 520×520 slice pixel by pixel in JS before reading it back, so a frame is heavy; under a contended headless browser the cine advanced only a few slices per second.
- Readback cost readout measured ~0.2 ms (†, near the clock floor) during verification.
- "SYNTHETIC PHANTOM — NOT A PATIENT" is drawn on the image; nothing is a real scan.
- The first drag switches auto window off and it stays off until the button is pressed.
- `pointerup` outside the canvas relies on pointer capture; there is no `pointercancel` handler.

## Assets
None. The phantom is generated.

## For the edit pass
Nothing specific recorded for this demo yet.


## Presentation edits (2026-09-17)
- **Slide layout:** the caption and prose are hidden. Long explanations moved to the speaker notes.

## Slide fit (2026-09-17)
- **World is exactly 864 × 444:** button bar 30 px + canvas 384 px + readout row 30 px (flex column, fixed heights).
- **Canvas** backing 1728 × 768 (2× of 864 × 384 CSS); all drawing is in CSS px under `setTransform(2,…)`. Was 1240 × 640 scaled down to ~0.66, which put canvas labels at ~7 px.
- **Composition:** scan viewport square 368 × 368 at left (16, 8). Right column 440 px wide: histogram (92 px tall), LUT bar with the fusion ramp beneath it (LUT and fusion labels share one line), stack ladder on one row with its label inline, then region magnifier (fills to the bottom, aspect of the ROI) beside the profile. Canvas labels 11 px, overlay annotation 12 px. Labels shortened ("REGION — STUDY ONLY", "PROFILE — MIDDLE ROW", "LUT — GSDF GREY · 256").
- **Rendering:** the display image is now mapped 1:1 with the read (520 × 520 ImageData in an offscreen canvas) and drawn scaled onto the viewport, instead of resampling to the viewport size per pixel; fusion coverage is a percentage of the read. The magnified region is a 140 × 110 ImageData drawn with smoothing off (was 70 000 per-pixel `fillRect`s). Measured ~47 rAF/s in headless Chrome during verification.
- **Button bar:** one row, 11 px chips that flex to fill the width; labels shortened (auto W/L, rotate map, reconstruct). `data-testid`s unchanged.
- **Readouts:** one thin row, label and value inline (11 px label, 13 px value), labels shortened (W / L, region, fusion, px read, readback); fusion reads "spectral 5.5%".
- Caption and `cv-instr` prose stay hidden (speaker notes).
