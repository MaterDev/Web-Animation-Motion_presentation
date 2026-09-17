# NOVA-7 player + buffer rack

## What it is
The 16:9 NOVA-7 exploded-view loop in a native-controls `<video>`, with the sheet's buffer rack docked over it. Every rack effect (canvas buffer effects, SVG/CSS filters, delayed-copy composites, the curve that maps loop time to video time) and the live-camera switch now act on that one player.

## Source
`design/techniques/video/index.html`
- "the broadcast": 16:9 player, lines 509–518
- "the decoded frame is a buffer": rack panel 548–632 (curve editor 596–625), `canvas#fxCanvas` 640, `video#fxEcho` 641–643, SVG filter defs 772–790
- CSS 29–45, 55, 73–81, 86–200; JS 792–1277 (rack core 809–1116, curve 1118–1181, card/reset wiring 1183–1197, camera 1199–1276)
- Left behind: section prose (482–507, 523–544), the 9:16 player and its hand-built controls (634–656, 1280–1314), `.mplayer`/`.mp-*`/`.vcut` CSS.

## Extraction changes
- **Re-targeted onto the 16:9 player (Key's one structural change).** The rack drives `#prVideo` (the 16:9 player, was `#mpVideo`, the 9:16 one). `#fxCanvas` and `#fxEcho` sit inside the 16:9 stage, above the video. The panel is absolutely positioned over the right side of the stage: 440 px wide, 12 px inset, `bottom: 56px` so the native controls bar stays reachable. See the `.pr-stage` rules at the end of `demo.css`.
- **Buffer size.** The sheet uses 270×480, which is 0.375 of the 720×1280 portrait file. Here it is 480×270, 0.375 of the 1280×720 landscape file: the same pixel count, turned landscape. `drawCover` already handles any aspect.
- **Curve editor wraps.** At 440 px the open editor could not fit beside its card (the preset chips ran under the graph). `.fx-temporal` now wraps, so the editor takes a full row under the card. Nothing else in the panel layout changed.
- **Echo source.** The echo decodes the 16:9 file, not the 9:16 one.
- **Camera label.** The live-camera label writes `16:9 · live camera · W×H` onto the 16:9 scene label. It restores the label from `data-file` when the camera goes off. The sheet wrote `9:16 …` onto the vertical player's label.
- **Queries.** `document.getElementById` / `querySelectorAll` → the shadow root. SVG `filter: url(#fx-edge)` / `url(#fx-split)` resolves inside the shadow root; this was checked in Chromium.
- **Disposal.**
  - Every listener goes through `disposer.on`, and every `setInterval`/`setTimeout` goes through `disposer.interval`/`timeout`.
  - Dispose bumps `gen` and stops the rAF loop and interval, the same way `reset()` does.
  - It stops any camera tracks and marks the demo dead, so a `getUserMedia` that resolves after unmount stops its tracks at once.
  - It pauses both videos and unloads their sources.
- **Classic IIFE → `rack(root, d)` in `rack.js`.** `:root { --tint }` → `:host`.
- `.scene-stage`/`.card-grid` furniture, the scene label and the note are kept.

## Carried over as-is
- **Reduced motion is ignored.** The player has `autoplay`, and no rack loop checks `prefers-reduced-motion`. The sheet behaves the same way.
- **Controls are covered or hidden.**
  - Canvas effects set `visibility: hidden` on the video, which also hides its native controls while a canvas effect runs.
  - The canvas and echo overlays sit over the controls bar. The sheet's 9:16 player had no native controls, so this never showed there.
- **Kaleidoscope wedges** use radius `CH`. That was the long side in portrait; landscape `CH` is 270 against a 275 px half-diagonal, so the extreme corners can show the `#05060a` fill.
- **Slit-scan** maps time down the rows (`y / CH`), so a landscape frame gives it 135 bands instead of 240.
- **Timer handles build up.** Each `reset()` watchdog timeout and each effect's interval also registers a disposer entry. Switching effects many times grows that list slightly until unmount.
- **Camera untested.** The success path (a stream into the player) was not verified headless, because headless Chrome denies the camera. The failure path ("denied", then the switch resets after 2.4 s) was verified.
- **Autoplay** starts muted inside the shadow root.

## Assets
- `assets/nova7-explode-16x9.mp4`, from `design/techniques/video/assets/`. Our own bake (`gen/bake-video.mjs`); no third-party licence.
- `assets/nova7-explode-16x9-poster.png`, same source.

## For the edit pass
- Key: "for video we will use the large horizontal player and then have a buffer rack to manipulate it that overlays the video." That overlay is done here structurally. Its docking side, width, translucency, and the covered or hidden native controls are still open.

## Presentation edits (2026-09-17)
- **Slide copy:** the scene label and note are hidden, because the slide carries the label.

- **Rack beside the video** (Key): the controls moved to a 290px column left of the 16:9 picture (656 × 369) instead of overlaying it. The effect canvas and echo layer are pinned exactly over the picture. The rack is compact: names only, two across, no footnote, no scrolling. The curve editor opens as a small panel over the picture's lower-left corner. The stage is 960 × 400.


## People detection on the live camera (deck-only, 2026-09-17)
- **What it does** (Key): with the camera on, "detect people" draws animated marks over the feed.
  - **Faces:** BlazeFace short-range. Corner brackets settle onto each face, with a scan line while locking on and a confidence tag.
  - **Bodies:** Pose Landmarker lite, up to 3 people. A 33-point skeleton whose limbs sweep in; the joints pulse.
  - **Smoothing:** marks ease between detections and fade out when lost.
- **Library:** `@mediapipe/tasks-vision` 1.0.1 (Apache-2.0), imported dynamically on first use.
- **Local files:** the WebAssembly runtime (`vision_wasm_internal.js` and `.wasm`, about 12 MB) and both models live in `assets/vision/`, so nothing is fetched from the network on stage.
  - `blaze_face_short_range.tflite` (230 KB)
  - `pose_landmarker_lite.task` (5.8 MB)
  - Both models are from `storage.googleapis.com/mediapipe-models`.
- **Running:** GPU delegate, with a CPU fallback. It runs only while the camera is live and the switch is on. The rack signals camera state with a `wam-cam` event on the shadow root. Dispose closes both tasks.
- **Reduced motion:** no sweep, scan or pulse; the marks still draw.
- **Untested here:** the headless test browser has no camera, so live detection hasn't been verified against a real face. Model loading is verified separately (see the report).
