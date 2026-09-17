# The Fenwick · object in the round

## What it is
The object-of-the-month page of an invented museum, The Fenwick. A Poly Haven photogrammetry bust is rendered live with PBR materials: you drag to turn it, switch between gallery, daylight and raking light, and click through three "look closer" notes. Each note draws a lead to its spot on the stone. Underneath, "The same turn, two ways" sets the live render beside the eight-photograph cross-faded turntable a page could ship without a shader.

## Source
- Sheet: `design/techniques/webgl.html`, §1 "Four small experiences", tab `rl-tab-museum` ("Object in the round · mesh · marble bust, CC0"). It is the sheet's default open tab.
- Markup: band 413–417, `rl-world` 419, stage `<template>` 428–438, museum panel `rl-p-museum` 442–475, comparison `rl-compare` 563–576, bench `rl-bench` 580–616.
- CSS: lines 31, 53–57, 59–85, 103, 113–135, 142–145, 148–154, 159–168, 176–179, 189–210, 344–349.
- Script: the first module script, 934–1490. It uses the helpers, `QUAD_VS`/`BLEND_FS`, `makeRenderer`/`fit`/`sync`, `buildMuseum`, `ensure`/`loadGLTF`, `openVariant`, `renderMain`, `blendQuad`, `renderCompare`, `renderOverlay`, `render`, `runControl`, `instrumentPlate`, the handlers and `boot`.

## Extraction changes
- `import * as THREE from '../vendor/three.module.js'` became the npm `three` package (0.185.1, the same version). `THREE.GLTFLoader` and `THREE.RoomEnvironment` now come from `three/examples/jsm/…`.
- `document.querySelector` / `$` / `querySelectorAll` now query the demo's shadow root, through the kit's `stage()`.
- `window.WAM` became a per-mount `createWAM({ root })`.
- The stage `<template>` is gone: the stage markup sits in the museum slot, where the sheet's `boot()` prepends it. The compare shell carries `rl-p-museum` in the markup, which `openVariant` sets on the sheet.
- Dropped: the tab bar, the auction, studio and hero panels, and their builders (`authorMedal`, relief, loupe, points programs).
- Removed code paths the mesh experience never takes: the relief lamp mark, loupe anchors, the `pair` compare kind, and the `points`/`apply` rows of the control. The loupe/relief/points pointer branches went too. Mesh drag is unchanged.
- The sheet chains `loadImage()` (the Vermeer painting) after the scan before building the museum, but the museum never uses it. It is not loaded or copied.
- The background preload of the auction and studio experiences (`setTimeout(…, 1200)`) is removed as sheet-only coupling.
- `instrumentPlate()` now fills only the bench's floor readouts (`rl-floor`, `rl-bench-floor`). The page-level instrument plate (renderer, context, dpr) is sheet prose and is not in the demo. A token-miss warning now goes at the end of `rl-bench-instr`.
- `data-testid` attributes were added to the rig buttons (`rl-museum-rig-*`) and chapter buttons (`rl-museum-ch-*`), following the repo rule that every interactive element gets one.
- Every listener is registered through `disposer()`: stage pointer events, chapters, rig options, both CTAs, run control, reduced-motion `change` and `webglcontextlost`. The ResizeObserver is registered too.
- Dispose stops the WAM clock and removes all listeners. It then disposes the eight prerender targets, the blend quad, the scene's geometries, materials and textures, and the PMREM environment texture. Both renderers get `dispose()` and `forceContextLoss()`. A `gone` flag stops a late scan load from building.
- Assets are imported with `?url`. A `LoadingManager.setURLModifier` maps the glTF's relative `.bin` and texture URIs to their imported URLs.

## Carried over as-is
- Two WebGL contexts, one for the stage and one for the comparison, as on the sheet. The PMREM environment is generated on the stage renderer `R` and used by the comparison renderer `RC` too.
- The rig's exposure (`applyRig`) is written to `R.toneMappingExposure` even when the frame is drawn by `RC`, so the comparison always renders at `RC`'s exposure of 1.0. The comparison bust reads darker than the stage, and the turntable half darker still. This is the sheet's look and was not fixed.
- The clock is the sheet's: `dur = 41 × 17 × 9 s`, poster `5 / DUR_S`. Chapters change every 17 s with a 2.3 s lead draw, yaw turns once per 27 s, and pitch sways over 11 s. The demo starts at t = 0. On the sheet, t is wherever the page clock has reached.
- The render-area control renders at 1×, 9× and 36× area into render targets, synced by `readRenderTargetPixels`.
- Reduced motion: the bust freezes on the picked chapter's yaw and pitch, and chapter clicks set `step`.
- "Plan a visit" toggles to "Sat 19 Sep, 11:00 ✓", which is sheet behaviour.
- Headless verification note: in the CDP Chrome on :9333, rAF only advances while a screenshot is being captured, so the ms readout stays "—" until screenshots drive frames.

## Assets
- `assets/bust/marble_bust_01_1k.gltf`, `marble_bust_01.bin`, and `textures/marble_bust_01_{diff,nor_gl,rough}_1k.jpg`, copied from `design/assets/bust/`. Marble Bust 01 · [Poly Haven](https://polyhaven.com/a/marble_bust_01) · CC0 1.0 (per `design/assets/LICENCES.md`).

## For the edit pass
- Key: "for webgl we can use the fenwick example, but make the homepage hero the first example." This demo is second (`order: 2`). No other edits were requested yet.
