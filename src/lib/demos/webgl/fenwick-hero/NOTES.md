# The Fenwick · homepage hero

## What it is
The homepage of an invented museum, The Fenwick: a dark 16:9 hero with a headline over a marble bust drawn as 120 000 WebGL points. The points gather out of a cloud into the scan's surface and back again, and the pointer blows them apart. All of that runs in the vertex shader, so nothing is uploaded per frame.

## Source
- Sheet: `design/techniques/webgl.html`, §1 "Four small experiences", tab `rl-tab-hero` ("Homepage hero · points · the bust, in 120 000").
- Markup: band 413–417, `rl-world` 419, stage `<template>` 428–438, hero panel `rl-p-hero` 550–562, bench `rl-bench` 580–616.
- CSS: lines 31, 53–57, 59–85, 103, 113–140, 153–154, 167–168, 184–187, 203–210, 344–349.
- Script: the first module script, 934–1490. It uses the helpers (`tokenColor`, `median`, `fmtMs`, `hash2`), `POINTS_VS`/`POINTS_FS`, `makeRenderer`/`fit`/`sync`, `buildHero`, `ensure`/`loadGLTF`, `openVariant`, `renderMain`, `renderOverlay`, `render`, `runControl`, `instrumentPlate`, the pointer handlers and `boot`.

## Extraction changes
- `import * as THREE from '../vendor/three.module.js'` became the npm `three` package (0.185.1, the same version as the vendor bundle). `THREE.GLTFLoader` and `THREE.MeshSurfaceSampler` now come from `three/examples/jsm/…`.
- `document.querySelector` / `$` now query the demo's shadow root, through the kit's `stage()`.
- `window.WAM` became a per-mount `createWAM({ root })`.
- The stage `<template>` is gone: the stage markup sits at the start of the hero slot, where `openVariant('hero')` prepends it. The panel carries `rl-open` in the markup, because the tab click is not there to add it.
- Dropped: the tab bar, the museum, auction and studio panels, and their builders (`authorMedal`, relief, loupe, blend). Also dropped: the comparison block `rl-compare` and its second renderer `RC`, which the sheet hides while the hero is open (`cmpShell.hidden = !ex.compare`, and the hero's `compare` is null).
- Removed the branches of `renderOverlay`, `runControl` and the pointer handler that the points experience never takes. The overlay still clears the lead, anchor and lamp mark every frame, as the sheet does for an experience with no chapters.
- The sheet loads the Vermeer painting before building the hero (`loadGLTF().then(loadImage)`) and uses it only as a fallback texture when the scan has no base colour map. The scan has one (`marble_bust_01_diff_1k.jpg`), so the painting is not loaded or copied, and `u_tex` falls back to `null` instead. The picture does not change.
- The background preload of the auction and studio experiences (`setTimeout(…, 1200)`) is removed as sheet-only coupling.
- `instrumentPlate()` now fills only the bench's floor readouts (`rl-floor`, `rl-bench-floor`). The page-level instrument plate (renderer, context, dpr) is sheet prose and is not in the demo. A token-miss warning now goes at the end of `rl-bench-instr` instead of the plate.
- Every listener is registered through `disposer()`: stage pointer events, the CTA, run control, the reduced-motion `change` and `webglcontextlost`. The ResizeObserver is registered too.
- Dispose stops the WAM clock (rAF, IntersectionObserver, visibility and reduced-motion listeners) and removes all listeners. It then disposes the points geometry, the material, the glTF geometries and textures, and the renderer, and calls `forceContextLoss()`. A `gone` flag stops a scan that finishes loading after unmount from building anything.
- Assets are imported with `?url`. A `LoadingManager.setURLModifier` maps the glTF's relative `.bin` and texture URIs to their imported URLs, so a hashed build still resolves them.
- Added `data-testid` attributes are limited to what the sheet already had. The markup is otherwise verbatim.

## Carried over as-is
- The clock is the sheet's: `dur = 41 × 17 × 9 s`, poster `5 / DUR_S`. The morph cycle is 19 s (42% gathering, 30% held, 28% dispersing), and the camera sways ±40° over 29 s. The demo starts at t = 0, so it opens on the cloud. On the sheet the hero opens at whatever t the page clock has reached.
- `MAXP = 1 200 000` points are sampled on the CPU at build time, even though only 120 000 are drawn. The two extra rows exist for the point-count control. This blocks the main thread for a moment on load.
- The Doto band still reads `points · on the scan's surface, drawn this frame`. Its first paint shows the sheet's default "light azimuth" label until the scan is built.
- The frame readout brackets every 12th frame with `gl.readPixels(0,0,1,1)`, taking the median of 8.
- Reduced motion: the hero freezes fully formed (`t = 1`, yaw 20°, `time = 0`).
- The CTA toggles to "Loading the collection…", which is sheet behaviour.
- Headless verification note: in the CDP Chrome on :9333, rAF only advances while a screenshot is being captured, so the ms readout stays "—" until screenshots drive frames. That is the instrument, not the demo.

## Assets
- `assets/bust/marble_bust_01_1k.gltf`, `marble_bust_01.bin`, and `textures/marble_bust_01_{diff,nor_gl,rough}_1k.jpg`, copied from `design/assets/bust/`. Marble Bust 01 · [Poly Haven](https://polyhaven.com/a/marble_bust_01) · CC0 1.0 (per `design/assets/LICENCES.md`).

## For the edit pass
- Key: "for webgl we can use the fenwick example, but make the homepage hero the first example." Done through `order: 1`. No other edits were requested yet.

## Slide fit (2026-09-17)
Designed for the 864 × 444 slide well as a presentation composition, not a trimmed sheet page. Key's notes: "make the homepage hero the first example"; "I dislike the home screen … it's ugly and it progresses too slow — can we make them more fine particles and have the animation resolve more quickly"; and "redesigned for the actual presentation in terms of their layout".

**Layout.** The stage is the whole 444 px panel, and the WebGL canvas is full-bleed behind every DOM layer. All layers sit on a 28 px margin:
- mast (56 px): brand, centred nav buttons, opening hours
- copy column (330 px): eyebrow, 34 px headline, 14.5 px body, pill CTA
- foot (44 px): credit and "pointer = wind"

The ground is a dark ink panel with a blue radial glow behind the bust and a faint warm corner. The bust sits right of centre through `camera.setViewOffset` (`SHIFT = 0.16`, camera distance 2.85), so it clears the copy and is never cut. Labels are 11 px or larger. The measured `demo-host` scrollHeight is 444.

**Removed:**
- the Doto band, which showed the point count
- the §1 bench: readouts, the point-count control, the control table and the instrument prose
- the `readPixels` frame bracket
- the SVG overlay, which the hero never used

The long explanations belong in speaker notes.

**Particles:**
- The count went from 120 000 to `COUNT = 320 000`. Only that many are sampled; the sheet sampled 1 200 000 for the control rows, so load is lighter. The copy's count is written from `COUNT`.
- Point size is set in device pixels (`PX = 1.0`, scaled by depth), so the points stay fine at 2× DPR.
- Depth cues: points near the front are larger and brighter, and those at the back dim to 35%.
- Lighting is a warm key that rides with the camera, a cool under-fill and a blue rim, plus ±28% per-point brightness grain.
- The scattered state is a flattened, turning nebula in which only about 22% of the points show (dust, not a sheet). Formed points are opaque with depth-write on.

**Timing.** The cycle is `CYCLE = 16 s`: gather over 2.2 s with a per-point stagger and a cubic ease-out and a quarter-turn curl, hold until 13 s, let go over 2 s (the same curve read as an ease-in), then drift for 1 s. When the scan finishes loading, the clock seeks to 0 and plays, so the slide always opens on the gather. Camera sway is ±32° over 29 s. Reduced motion shows the formed bust at yaw 18°.

**Kept:** pointer wind (ray push, now 0.12 within 0.16 units), CTA toggle, full disposal (points geometry, material, glTF geometries and textures, renderer, `forceContextLoss`). Verified: the hero's WebGL context reports lost after switching demos in the viewer.

Screenshots (scratchpad): `gpu-fenwick-hero-scattered.png`, `gpu-fenwick-hero-mid.png`, `gpu-fenwick-hero-resolved.png`, `gpu-fenwick-hero-reduced.png`.
