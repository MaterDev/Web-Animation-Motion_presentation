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
