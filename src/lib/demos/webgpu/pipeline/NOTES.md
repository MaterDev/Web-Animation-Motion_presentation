# webgpu/pipeline · Frame inspector

## What it is
Two hundred thousand particles pushed through four GPU passes (curl-noise flow, integrate, a density histogram by atomic add, one instanced draw), each pass timed between two GPU timestamps. Switch a compute pass off and its bar and its time go; the panel also prints the bytes the CPU uploaded that frame.

## Source
- `design/techniques/webgpu.html`, §1 "Pipeline · what a frame costs on the GPU"
  - markup: lines 103–125 (crumb, head, dek, instrument plate), 127–151 (§1), 193–203 (notes)
  - CSS: lines 12–40, 44–46, 50–75, 98
- `design/techniques/webgpu/clock.js` (whole file) → `clock.js`
- `design/techniques/webgpu/common.js` (whole file) → `common.js`
- `design/techniques/webgpu/sheet.js` (device acquisition, instrument plate, tick) → `index.js`

## Extraction changes
- Files copied, not imported; each starts with `// @ts-nocheck`.
- `common.js` `$` queries the demo's shadow root (`setScope(root)` on mount), not `document`.
- `common.js` `run()` takes the demo's own `createWAM()` instance and a disposer in place of `window.WAM`; its IntersectionObserver is registered for disconnect.
- `common.js` gains `releaseDevice(dev)`: destroys the GPUDevice and clears the module-level singletons (`device`, `adapter`, `format`, `hasTS`, the byte counters, the card registry), so mounting again requests a fresh device. It runs on mount (to empty the card registry) and on dispose.
- `index.js` is `sheet.js` cut down to the one card: every `document.querySelectorAll('.gp-status')` is scoped to the root. The instrument tick's rAF is cancelled on dispose. `device.lost` is ignored once disposed (a destroyed device resolves `lost`). A mount disposed before `requestDevice` resolves destroys that device when it arrives.
- The crumb's `if (window.top !== window.self)` hide script is not carried: an inline script in markup does not run, and it was page-level coupling.
- CSS: only the rules this demo uses; `:root { --tint }` → `:host`. `.gp-grid`, `.gp-card`, `.gp-strip` and the §2 device rules are left out.
- The root `.wrap` carries `data-testid="technique-webgpu"` (it was on the sheet's `<body>`).

## Carried over as-is
- The crumb links point at `../index.html`, which does not resolve inside the deck.
- The dek and the notes speak for the whole sheet ("one device, eight apps", Atlas, Nectar, Wallet, Halcyon).
- The readouts are medians of the last eight timestamp readings. On this machine (apple · metal-3, headless Chrome 152) the demo read about 2.1 ms a frame: flow 0.10, integrate 0.03, density 0.05, render 1.97 ms. It uploads 104 B a frame, all uniforms. The sheet read the same passes in the same run.
- Where `timestamp-query` is unavailable, the bars print `n/a`, as on the sheet.
- Module-level state in `common.js` means only one live mount of this demo at a time.

## Assets
None.

## For the edit pass
- Key: "i like the pipeline example that can be its own thing." It stays its own demo; nothing specific to change was named yet.
