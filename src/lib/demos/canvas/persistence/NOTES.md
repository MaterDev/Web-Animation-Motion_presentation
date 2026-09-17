# canvas/persistence — trails visualizer

## What it is
A never-cleared canvas framebuffer: every frame is replaced by a faded copy of itself scaled 1.006 about its centre, then new analyser bars or an oscilloscope trace go on top, and the field is quantised to a 24-entry palette with no dither so the trail bands. Above it, an explainer strip in the same palette shows how one mark ages and what the 16-step quantisation does to the fade.

## Source
- Sheet: `design/techniques/canvas.html` (SL-11 "2D Canvas"), **§1 Persistence**.
- Markup: 458–514 (`v1-world`: explainer stage 459–461 + caption, trails stage, `v1-bar`, `v1-readouts`, in-world notes `v1-instr` and `v1-idem`).
- CSS: 185–238 (`.v1`), plus `.cv-dagger` 75 and `.cv-instr` 79–80.
- JS: 1018–1351 (1b trails at 1018–1248, clock at 1227; 1a explainer at 1255–1328, which reads 1b's closure state: `mode`, `DECAY`, `PALETTE`, `BEVEL`, `FEEDBACK`; bar handler 1330–1350).
- Helpers 861–942; `skin.js` (SKIN_RAMP / CACHE / QUANTISE / BAYER / BEVEL / CSS).

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

## Carried over as-is
- Path-dependent by construction: small forward steps accumulate, a jump (>0.02 of the cycle) rebuilds the field from 40 steps. Documented on the sheet in `v1-idem`.
- Quantise cost readout is measured live (seen ~3.9 ms on the sheet and ~6.5 ms in the viewer during verification, headless and contended; not a fixed number).
- Frame counter is a count of renders, including renders triggered by the bar buttons.
- The explainer and the field run two independent `WAM.clock`s on the same 11 s period.
- `skin.js` still carries SKIN_HASH2 / SKIN_NOISE, unused here.

## Assets
None. Everything is drawn.

## For the edit pass
Nothing specific recorded for this demo yet. Key: "canvas we can take all of these except the metro map".


## Presentation edits (2026-09-17)
- **Slide layout:** the explainer, controls and readouts sit in a left column and the live field fills the right, making the demo 2:1. Long explanations moved to the speaker notes.

## Slide fit (2026-09-17)
Recomposed for the 864 × 444 slide well at 1:1 (measured `.demo-root` 444px tall, 864 wide, no overflow). Replaces the two-column layout above.
- **Chassis.** The world is now a raised grey housing (CSS four-colour bevel, the off-thread players' chassis range) filling the box edge to edge, with a 16px inner margin for every screen, readout and button. `--v1-face/hi/lt/sh/dk` are lifted in this copy only (the tear sheet keeps its near-black face); the canvas chrome reads the same tokens, so screen bevels match the housing. `--v1-well` and a brighter `--v1-ink` added.
- **Field (hero).** Full width, 832 × 312 backing store = displayed CSS size, drawn at 1× and scaled by whole device pixels with `image-rendering: pixelated` (a DPR-sized store would quadruple the per-frame quantise pass). The canvas no longer draws its own outer raised bevel; `FRAME` 14 → 2 (sunken screen bevel only), `STRIP` 16 → 12, palette strip centred under the field.
- **Panel row (88px).** Left: explainer screen 372 × 88, backing × devicePixelRatio, 11px labels. Cut to five generations twelve frames apart (true 1.006 scale) and the smooth-over-quantised fade strips. Right: a recessed readout window (frame 24px hero, palette, decay / frame, quantise cost; labels 11px) above the four bevelled buttons.
- **Readout text.** Palette shows `24` (was `24 entries`); label `decay per frame` → `decay / frame`.
- **Hidden:** the explainer caption and both `.cv-instr` paragraphs (prose is in `deck-notes/canvas-persistence.md`). Their test ids are kept.
- **Gotcha:** sizing rules target `[data-testid="v1-world"]`, not `.v1` — `createTokens` appends a probe wearing `.v1`, and a sized `.v1` added 32px of overflow below the world.
- Added test ids: `v1-panel`, `v1-controls`, `v1-kv-frame`, `v1-kv-palette`, `v1-kv-decay`, `v1-kv-qcost`.
