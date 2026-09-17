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

## Slide fit (2026-09-17)
Recomposed for the slide well (864 × 444, `bare`). Only the inspector is kept; the sheet head (crumb, title, dek, instrument plate), §1 kicker, heading and prose, the caption and "what this sheet is holding itself to" are gone from the markup. The instrument-plate tick in `index.js` went with them.
- **Layout:** one dark chassis, 864 × 444, 16px padding, radius 10. Grid `1fr | 268px`, gap 20. Left: the particle field fills the column height (544 × 412 CSS px; `attach().fit()` sizes the backing store to that × DPR, capped at 2), with a small frosted chip "200 000 particles · one storage buffer". Right, top to bottom: head "one frame · four passes" with the `ms` unit; four pass rows (checkbox, name 13px, ms 14px bold, full-width bar underneath); GPU time this frame as the prominent number (30px, tint, not white) over a stacked bar showing each pass's share of the frame; bytes uploaded (14px bold) with its kind; a foot line with the adapter name and "median of 8". All text ≥ 11px.
- **Colour:** each pass has its own hue, shared by its checkbox, row bar and stack segment. The chassis tokens moved toward the webgpu tint (hue 300/320); the particles still read `--ck-dim` and `--ck-acc`, so they follow.
- **clock.js:** rows print the number without " ms" (the unit is in the head); a stacked-bar update (`ck-stack-N`, v / total) was added; the "uniforms only" label is now read off the counter (`bytes.frameState === 0`), not hard-coded.
- **index.js:** prints the adapter into `ck-adapter` (plus "no timestamp-query" where it is missing); `fmtB`, `DPR`, `bytes` imports and the instrument rAF tick are gone.
- **Measured (headless Chrome, apple · metal-3, DPR 1):** demo-host 864 wide, `scrollHeight` 444; panel 412 / 412, no overflow; canvas backing 544 × 412. The readings were flow 0.102, integrate 0.030, density 0.048, render 2.413, total 2.593 ms, 104 B a frame, uniforms only.
