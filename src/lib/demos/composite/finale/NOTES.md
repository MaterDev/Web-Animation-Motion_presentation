# composite/finale · the credits were on the fPhone Duo

## What it is
The last slide (`close-finale`, after `close-end`). It opens as a full credits "slide" (864 × 444, bare): "with thanks", the seven names, "made for `Folklore Digital`". Every technique in the talk is on that screen:

| Surface | Carries |
| --- | --- |
| DOM / CSS | the names (real text, staggered transform/opacity reveal), the heading's variable-font `wght` wave, kicker, key, footer |
| SVG | a lineage-style arc network drawing itself on (`pathLength=1`, `stroke-dashoffset`) |
| GIF | three slime stickers in the names grid's eighth cell |
| Video | the NOVA-7 loop in a 224 × 126 tile |
| 2D canvas | the oil slick band (the off-thread visualizer's field, pastel over the LCD ground) |
| WebGPU | the screen's ground and two layers of drifting particles, and the device itself |

On **the end ▸** (`finale-play`; Space/Enter on the focused root; or 4 s after the GPU is ready) the camera pulls back and the screen turns out to be the inner display of the sphere-traced fPhone Duo. It holds, the screen sleeps, the device folds shut, and "end · WAM-2026" appears bottom-left. After a 4 s idle on the closed device, **replay ↺** (`finale-replay`) fades in; it restarts from the credits. No auto-restart.

Timeline (ms from the trigger): zoom 0–2200 (eased) · hold 2200–3200 · sleep 3200–3700 · fold 3700–5100 · replay offered at 9100.

## The composite mechanics
- One `requestAnimationFrame` loop; every value is a function of (now − trigger). `z = ease(T / 2200)`.
- `hw.rectAt(z)` (duo.js) projects the inner display's corners through the same camera the BODY shader uses (frontal, so the rect is axis-aligned and exact). The page layer `.fn-screen` (864 × 607.6 layer px, the display's aspect, corner radius 38.7 px) gets `translate(x, y) scale(w / 864)` from that rect in the same frame the GPU draws with it. Transform only, no layout properties.
- COMPOSITE draws the ground and particles in display space (`uv × 864`), so they scale with the screen, and the credits band sits centred in the layer. At z = 0 the display is 1.003× the canvas width, so no bezel shows.
- Sleep: layer opacity and the GPU's `awake` fall together; the display goes to its dark glass. The fold is the device demo's close (pose 1 → 0), with the outer display left dark.

## Source (copied, not imported)
- `duo.js`: from `webgpu/device/duo.js`. BODY, SDF, lighting and SPECS unchanged. The camera takes a zoom (fill distance → the device demo's open distance). `rectAt(z)` added, and the rect is no longer snapped. The pull-back in the middle of the swing is 0.5 (it was 0.3), so the swinging leaf stays inside 444 px. COMPOSITE was rewritten: no OS/app textures, just the ground gradient and particles. Adds `LAYER_W`, `LAYER_H` and `LAYER_RADIUS`.
- `common.js`: the device acquisition and the `uniform`/`render`/`FSQ_VS` helpers from `webgpu/device/common.js`, plus `cssRGB` (tokens → display-encoded floats).
- `slick.js`: `T5_OIL_LUT` and `T5_OIL_FIELD` from `canvas/off-thread/transport.js`, as a function of seconds, mixed from the LCD ground toward the film by the sheen, with alpha fading at the band's ends. 240 × 18 backing store, scaled up.
- `assets/`: `slime-idle|happy|eat.gif` from `gif/stickers`, `nova7-explode-16x9.mp4` from `video/player-rack`.

## Reduced motion
No auto-start. The reveal, particles and slick are stills, and the video is paused on a frame. The trigger cuts straight to the closed device with "end"; replay follows the same 4 s idle.

## Fallback
Without WebGPU, the page layer paints the LCD ground itself (`fn-css-ground`) and the play button stays hidden, so the credits are a still screen. The same class covers the moment before the first GPU frame.

## Dispose
rAF, timeout and listeners (disposer); video paused, `src` removed, `load()`; hardware textures and buffers destroyed; context unconfigured; device destroyed; shadow root cleared. Checked by mounting twice more from the /demos sidebar and seeking mid-zoom on the third mount: it rendered correctly with no console errors.

## Verification handle
`[data-testid=finale-gpu].__finale`: `play()`, `replay()`, `seek(ms | null)` (freezes the timeline at T ms after the trigger), `state()`.

## Verified (2026-09-17)
`/demos?d=composite/finale`, headless Chrome with WebGPU (9333), host forced to 864 px on an LCD gradient: credits, mid-zoom (layers registered to the display, corners included), zoomed out on the device, sleep, mid-fold, closed with replay; the reduced-motion credits and closed frames. `demo-host` 864 × 444. No console errors. `bun run check`: 0 errors.


## Revision (2026-09-17, later): full-slide replica, white studio, click to close, FOLKLORE
Where this section disagrees with the sections above, this section is right.
- **Layout `full`, 960 × 540.** The deck draws only this demo over a white 960 × 540 slide. The opening frame is a replica of a deck slide. It uses the same `.well > .lcd` structure with the values copied from `Slide.svelte`: a 6 px bezel, the neutral prism cast, the LCD dot grid at 0.3, the glare, the inlaid "WITH THANKS" kicker, the "END" code, and the field at 48 / 42. The heading is the deck's `.dk-title` (Doto 48 px) with a `wght` wave. The body is 18 / 30. "The end ▸" (`finale-play`) sits in the bottom band as band notation.
- **The whole frame is the display.** At z = 0 the display's width is exactly the canvas's. The GPU draws the replica's bezel, LCD ground and particles on the display, and the page layer (960 × LAYER_H) carries the text, SVG, GIFs, video and slick.
- **Adapts to the display's aspect.** The slide box grows from 540 px to the display's full height exactly as the display's edges come into view: `g = clamp((canvasH · 960 / rect.w − 540) / (LAYER_H − 540))`. The bezel thins to 0 as it grows. The DOM (box top, height, well padding) and the shader (band and LCD rect) take the same `g`, so there is never a letterbox. The field's contents are top-anchored, the slick sits at 69.4 % and "made for" is bottom-anchored.
- **White studio.** `.fn` is white. Outside the device the canvas is transparent apart from the contact shadow. The open framing has a 30 px margin (it was 10). No replica chrome remains outside the display.
- **Takeover.** `wam-deck-takeover` is dispatched with `{ on: true }` on the trigger, and `{ on: false }` on replay and in dispose (if it was on). Sizing comes only from the demo host, and nothing calls fullscreen.
- **SVG** is coordinate dots only (20, every fourth with a small crosshair), fading in. The connecting lines are removed (Key).
- **Closing is a click (Key).** The zoom stops at its end. "close ▸" (`finale-close`) then fades in bottom-right on the white. A click anywhere inside the open device's projected body box (`hw.boundsOpen()`) does the same, with a pointer cursor only in that state. Space/Enter on the focused root also closes. Then sleep 0.5 s, fold 1.4 s, "end · WAM-2026" bottom-left, and **replay ↺** after 4 s idle. The timeline T is `min(now − playAt, zoom)` until close, then `zoom + (now − closeAt)`.
- **FOLKLORE on the closed device.** Folklore Digital's display face, Extenda 20 Micro (`assets/fonts/extenda-20-micro.woff2`, uppercase as their site sets it), is loaded with `FontFace`, rasterised once into a canvas cropped to the ink, and uploaded as an rgba8 texture (BODY bindings 1 and 2). It is etched into the outer glass, centred and 60 % of the face's width: a pale satin fill lit by the key light, with an environment sheen and a soft highlight. The rest of the outer display stays dark. If the font doesn't load within 3 s, a system face is used.
- **Reduced motion:** play cuts to the open device waiting for close, and close cuts to the closed device.
- Verified at 960 px on `/demos`: the opening, mid-zoom and late zoom (no letterbox), open and waiting with close, mid-fold with FOLKLORE, closed with replay, the reduced-motion open and closed frames, and a click on the device closing it. Height 540. No console errors. `bun run check`: 0 errors.
