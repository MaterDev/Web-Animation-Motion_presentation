# webgpu/device · iPhone Duo · four apps

## What it is
A CSS iPhone Duo whose whole inner display is one WebGPU canvas. Each app draws its own panes, type, glass and controls through `ui.js`. The Dock opens one app at a time, and the previous app is torn down before the next compiles. This copy keeps four of the sheet's eight apps: Roost (a starling flock game), Tessera (a grown, ray-marched world), Supercell (a vgpu storm) and Duo (the device sphere-traced inside itself).

## Source
- `design/techniques/webgpu.html`, §2 "One device · eight apps · one canvas / WebGPU treated as an app, not a demo"
  - markup: lines 103–125 (crumb, head, dek, instrument plate), 153–191 (§2), 193–203 (notes)
  - CSS: lines 12–40, 44–58, 76–94, 97
- `design/techniques/webgpu/`: `common.js`, `device.js`, `ui.js`, `shell.js`, `flock.js` + `population.js` (Roost), `procedural.js` (Tessera), `storm.js` + `storm-wgsl.js` + `storm-lens.js` + `storm-sprites.js` (Supercell), `duo.js` (Duo). All are whole files.
- `design/techniques/webgpu/sheet.js` (device acquisition, instrument plate, loop strip tick) → `index.js`

## Extraction changes
- Files copied, not imported; each starts with `// @ts-nocheck`.
- `storm.js` imports `vgpu` (the npm package, 0.5.0) in place of `../../vendor/vgpu.module.js`, which is that package bundled by `scripts/vendor.js`.
- Dock and captions: only Roost, Tessera, Supercell and Duo are kept, in that order. Wallet, Atlas, Nectar and Halcyon are removed from the dock, the captions and `APPS`, and `wallet.js`, `apps.js`, `loop.js` and `optics.js` are not copied. The hidden `at-input` (Atlas's keystroke field) and its `.dv-input` rule are removed with Atlas.
- The first app is now Roost, so `dv-cap-flock` is the caption visible before the device opens (the sheet showed Wallet's).
- `common.js`: `$` is scoped to the shadow root. `run()` takes the demo's `createWAM()` instance and a disposer. `releaseDevice(dev)` destroys the device and resets the module-level singletons and the card registry, so mounting again works (same changes as `webgpu/pipeline`).
- `device.js`: no longer reads the open app from `location.hash` or writes it back with `history.replaceState`, because the deck owns the URL; it opens `apps[0]`. It gains `dispose()`, which disconnects the shell's ResizeObserver, cancels the reduced-motion `invalidate()` frame, and destroys the open app and the UI.
- `shell.js` returns its ResizeObserver so it can be disconnected.
- `index.js` (from `sheet.js`): queries are scoped to the root, the tick's rAF is cancelled on dispose, and `device.lost` is ignored once disposed. Dispose order: WAM clock, disposer, card (app + UI), `globalThis.__supercell` cleared, device destroyed.
- The crumb's iframe-hide inline script is not carried.
- CSS: only the rules this demo uses; `:root { --tint }` → `:host`.

## Carried over as-is
- Supercell still sets `globalThis.__supercell` (verification handle: seek, pause, steps, scale, spans), and still reads `?scale=` / `?steps=` from `location.search`. The handle is cleared on dispose; checked by leaving and re-entering with Supercell open, twice.
- The section label, prose, dek and notes still say "eight apps" and name Wallet, Atlas, Nectar and Halcyon. No copy was edited.
- `.dv` breaks out of its column with `width: 80vw; margin-left: calc(50% - 40vw)`. That is centred on the viewport, not on the host, so the phone is offset when the demo sits beside a sidebar (as in `/demos`).
- The shell scales the 928 × 664 frame to the column width, capped at 1.6×.
- Readings on this machine (apple · metal-3, headless Chrome 152), state uploaded per frame: Roost 2.7 KB, Tessera 6.3 KB, Supercell 92.4 KB, Duo 7.9 KB. These match the sheet in the same run. Supercell printed "frame 8.40 ms of 8.3" at 530×373.
- Module-level state in `common.js` means only one live mount of this demo at a time.

## Assets
None. Sprites, glyphs and icons are drawn to canvases at runtime.

## For the edit pass
Key: "then we will use the phone duo example, but the only apps we will have are roost, tessera (but its interface is too chunky and we need to improve the graphic quality) and supercell. lets bring the iphone duo demo, but we need to make the actual animated model smaller so it doesnt get cut off and the ui inside of it is too large also."
- The app set is already cut to Roost, Tessera, Supercell and Duo.
- Tessera: the interface is too chunky; improve the graphic quality.
- Duo app: make the animated model smaller so it is not cut off (it runs under the glass panel on the right). The UI inside it is too large.
- The prose still describes eight apps; rewrite it for the slide.

## Tessera edits (2026-09-17)
Key: "tessera (but its interface is too chunky and we need to improve the graphic quality)". Only `procedural.js` changed.

Interface
- The UI is now laid out in CSS pixels, not display points. `P(px)` converts using the measured size of the UI surface: a page canvas uses its bounding rect, and the Duo's display texture uses `width / DPR`. Type and panels stay the same size on the slide however the device is scaled.
- Panel (top-right, 50 px in from the right edge, clear of the home indicator): 152 px wide, down from 268 pt. It has one header row (TESSERA plus a small outlined "New world" pill), a world and seed line, two sliders (1.5 px tracks, 4 px knobs), and two measured lines: grow (noise + flow + carve, summed) and march, with its scene resolution. The "A WORLD INSTEAD OF A WEBSITE" label, the helper sentence, the four-row timing table and the footer line are cut. Glass alpha went from 0.55 to 0.34, with a thinner rim.
- Field guide (bottom-left, sized to its content): 232 px wide, down from 400 pt. Name 16 px with the n / 5 counter on the same row, kind, climate (wrapped), body at 11 px, species as one wrapped line of text instead of chips, and 20 px buttons ("← Map", "Next place →").
- Pins: 2.6 px dot, 5.5 px ring, 10 px label on a 16 px glass pill.
- Pins project to `ui.W × ui.H` instead of a hard-coded 890 × 626.
- Type floor: 10 px for labels and mono, 11 px for body.

Graphic quality
- March: it jumps to the top of the world, steps by 0.42 × clearance (minimum 0.12 + 0.0022·t, so fine near the camera), then bisects 7 times after the loop instead of nested inside it. Step counts (240 march, 36 shadow) are uniforms, per the constant-loop compile stall on ANGLE/Metal.
- Normals: central differences over a tent-filtered height (four bilinear taps), and the epsilon widens with distance. The bilinear creases are gone, and far slopes no longer sparkle. The rock bump fades out once a pixel is wider than the bump.
- Lighting: clearance-stepped soft shadows (smoothstepped penumbra, offset along the normal), cavity occlusion at two radii, a sun-opposite bounce term, and a specular on ice, volcanic glass and rivers.
- Air: aerial perspective integrated in closed form over a height-falling density, with per-channel extinction (blue goes first) and in-scatter warmed toward the sun. This replaces the linear fog. The sky gets a sun halo and disc, and the clouds get a silver lining.
- Water: Schlick fresnel reflecting the sky, a sharp specular plus a broad sheen, and the bed seen through shallows with red absorbed first. A broken shoreline foam band breathes with the surf. Past the map edge the bed keeps falling away, so there is no rectangle in the shallows.
- Rivers: flow is sampled bilinearly (it was nearest-neighbour), so rivers read as lines rather than cell stairs up close. They darken toward wet ground instead of painting sea colour.
- The NOISE pass also shelves every map edge into the sea (`smoothstep(0.80, 0.97, max(|u|,|v|))`), so the near edge of the overview is no longer a cliff. Places sit well inside that band.
- Grade: ACES filmic curve, 1.1 saturation, cool shadows and warm highlights, a softer vignette, and 1/255 dither against sky banding.
- Resolution: the scene follows the measured march pass. It starts at 0.8 of the display's device pixels, drops 0.1 above 6.5 ms and rises 0.1 below 3.2 ms (range 0.5–1.0, at most one change per 1.2 s). It stays fixed at 0.75 with no timestamp-query. The old fixed value was 0.6.

Measured (headless Chrome, apple · metal-3, DPR 2, display texture about 1134 × 798 device px): the march pass read 1.9–3.5 ms at 100% scene resolution, on both the overview and a place. Grow (one regrow) read 2.3–5.3 ms. The before build read march 2.36 ms at 0.6 scale on the old 542 px shell.

## Slide fit (2026-09-17)
Rebuilt for the `gpu-device` slide (864 × 444, bare). Earlier sections of this file describe the sheet copy: the CSS phone, the Dock of four, `shell.js` and the Duo app are gone. Where they disagree, this section is right.

**What it is now.** One canvas the size of the box, premultiplied. The fPhone Duo (Key: "don't call it iPhone Duo" on the slide) is WebGPU hardware as well as software: sphere-traced, it starts closed, opens on **Open**, boots in about 1 s to a Home Screen, and launches Roost, Tessera and Supercell. Where no ray lands the canvas is transparent, so the slide's LCD ground is the floor it stands on, with a contact shadow.

**Layout.** Open and frontal, the body is fitted to the box height with a 10 CSS px margin (about 598 × 424 CSS px). The inner display lands on whole device pixels (568 × 399 CSS px at 864 wide), so the OS texture is sampled 1:1. The caption column sits at the left (app name 15 px, one line 11 px, then bytes uploaded per frame in 11–12 px). **Open/Close** is bottom-right. The red **✕** (`dv-app-exit`) sits just outside the device's top-right corner, only while an app is open. Nothing sits under the device. `demo-host` measures 864 × 444.

**Sequence.** Opening takes 1.5 s: the hinge eases open while the camera moves from a three-quarter view of the closed device to exactly frontal, pulling back mid-way so the device stays in frame. The outer Lock Screen fades out and the inner display wakes. Boot takes 1.15 s, then fades to Home. Tapping an icon zooms the app out of it (483 ms); the ✕, the vertical home indicator on the right edge, or Escape zooms it back (414 ms). Key asked for the app open and close to be 15% slower, so these are 1.15× the first timings. **Close** puts the display to sleep (260 ms), then folds (1.3 s). Under reduced motion every transition is a cut and boot is skipped. Only one app is alive at a time: the last is destroyed when the zoom back to Home finishes.

**Hardware (`duo.js`).**
- The leaves are swapped relative to the sheet. Leaf A (the one that moves) carries the outer display, and leaf B (fixed) carries the cameras. The device therefore opens like a book cover toward the viewer, and the inner display faces the same way the outer display did (Key: "the face should be on the other side").
- The inner display is a plane tested analytically in each leaf's frame, not a marched material. Its edges are exact, and the two halves overlap by 0.02 cm, so there is no centre column.
- Over the last 10° of travel, each slab and its cover glass grow 0.32 cm across the hinge, and the spine retracts. Flat, the body is one continuous slab: no notch, knuckle or crease. This was checked in 2× crops of the top and bottom centre.
- Anti-aliasing: the BODY pass writes two rgba16f targets (lit body; display u·m, v·m, m). While the pose holds still it accumulates jittered R2 samples with a blend constant: 2 spp × 12 frames = 24 samples, and then it stops marching. While moving it renders 1 spp at full device-pixel resolution.
- Loop bounds are uniforms (march 140/200 steps, shadow 28/48, AO 5), with no constant-bound loops inside the march; the two lenses are written out. The hit epsilon is 0.00012·t, the step is 0.95 of the distance, normals are tetrahedral (ε 0.0012), shadows get a penumbra smoothstep, and the composite adds 1/255 dither.
- COMPOSITE runs every frame: body + screen texture × awake + app zoom + the right-edge home indicator.
- Measured: rAF interval during the opening swing, headless Chrome at DPR 2 (1728 × 888), median 16.7 ms and p90 16.7 ms. That is an rAF interval, not GPU cost.

**OS (`home.js`), following what Apple published about iOS 27 on the iPhone Duo** (newsroom, 2026-09-09; MacRumors, 2026-09-10): Today View widgets on the left, a Home Screen page on the right, the Dock and navigation on the side, and a circular status system in the top-right corner.
- Per Key, only our three apps appear (on the page and in the Dock), with three glass widgets: weather, calendar and music.
- The wallpaper is a soft gradient field, shared with the Lock Screen.
- Positions and sizes are constructed. The meeting, the song and the weather are invented.
- The boot screen shows an invented fold mark (two panels) and an "fPhone" wordmark, with no Apple mark. An earlier italic "f" in a rounded square read as another company's logo; its overhang also bled into the next glyph packed in the atlas.

**Other changes.**
- `ui.js`: `makeUI` draws into a surface `{ width, height, view() }` instead of a canvas swap chain. `uiPointer` is removed; `device.js` maps pointer → device px → display points itself.
- `ui.screenRadius` is set to the display's corner radius in points: (cornerR − bezel) scaled to 890 pt, about 39.8.
- `storm.js`: Supercell's red emergency edge follows `ui.screenRadius`, so it no longer clips at the corners (checked in a 2× corner crop).
- `canvas.__duo = { rect, bounds, state() }` is a verification handle on the element.

**Files that make up the device (for the sheet port).**
| Role | File |
| --- | --- |
| Mount, device acquisition, clock, bytes readout, app registry (`APPS`) and captions | `index.js` |
| Device card: state machine, pointer, DOM controls, surfaces | `device.js` |
| Hardware model: SDF, BODY and COMPOSITE shaders, camera, display rect; also `WALLPAPER` and `SPECS` | `duo.js` |
| Home Screen and boot screen | `home.js` |
| UI toolkit: atlas text, SDF panels, glass (surface target) | `ui.js` |
| Shared GPU plumbing | `common.js` |
| Apps: Roost | `flock.js`, `population.js` |
| Apps: Tessera | `procedural.js` |
| Apps: Supercell | `storm.js`, `storm-wgsl.js`, `storm-lens.js`, `storm-sprites.js` |
| Markup and styles | `demo.html`, `demo.css` |
`shell.js` is deleted.

**Verified** (`/demos?d=webgpu/device`, headless Chrome with WebGPU, host forced to 864 px on an LCD-green ground, DPR 1 and 2): closed, mid-open (three frames), boot, Home, the zoom from an icon, Roost, Tessera and Supercell each opened from their icon and closed with ✕, Close back to closed, and the same flow under reduced motion. `bun run check`: 0 errors.
