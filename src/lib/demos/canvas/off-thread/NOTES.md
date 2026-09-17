# canvas/off-thread — twin blitted players

## What it is
Two identical-by-construction skin-era media players, every pixel blitted (flat rects, a hand-set 5×6 bitmap font, six-line bevels); unit 1 is drawn on the main thread, unit 2 by a worker through a transferred OffscreenCanvas, with a boot parity hash proving both threads run the same code. "Block the main thread 800 ms" freezes unit 1's marquee and clock while unit 2 keeps going, and reports the frame counts.

## Source
- Sheet: `design/techniques/canvas.html`, **§5 Off-thread**.
- Markup: 751–796 (`t5-world`: rack, bar, readouts, `t5-note`, `t5-instr`).
- CSS: 89–183 (`.t5`), plus `.cv-dagger` 75 and `.cv-instr` 79–80.
- JS: 3085–3377 (clock at 3195; worker Blob body 3216–3230; ping/transfer/parity 3233–3300; free-run 3305–3327; block 3329–3366; matchMedia change 3371–3376).
- `transport.js` (all of it) and `skin.js` (SKIN_BEVEL, SKIN_CSS); helpers 861–942.

## Extraction changes
- **Shadow root.** Markup and CSS mount through `_kit/stage.js`; `$` (by `data-testid`) queries the shadow root instead of `document`.
- **Helpers copied** into `helpers.js` (from canvas.html 861–942). `token()` reads the demo host (where `:root` tokens land as `:host`) instead of `document.documentElement`, and the world probe is appended **inside the shadow root** with only this world's class, not to `document.body` with all five.
- **Token misses** were printed on the page-level instrument plate (canvas.html 436–446, 976–996). The plate is omitted; a miss now goes to `console.warn` instead.
- **Instrument plate omitted** (renderer, clock floor, backing store): it is page-level.
- **`WAM`** is a per-demo `createWAM({ root })` instance instead of `window.WAM`, and is disposed on unmount.
- **Listeners** on in-demo elements are registered through `_kit/disposer.js` so dispose removes them.
- **Classic scripts to modules.** `transport.js` and the two `skin.js` helpers it needs became one ES module; see the next two bullets for how the `self.X` globals were kept working.
- **CSS.** Only the rules this demo uses. `:root { --tint }` → `:host`. The `body` rule from tokens.css does not reach a shadow root, so its background/colour/font are restated on `.demo-root`. The sheet's `.wrap` (1060 px max width) is not carried, so the world runs the viewer's full width. The global page grain (`body::after`) is not carried.
- **Unused sheet furniture not carried:** `fit()`, `onResize()` and the `window` resize listener (no section used them), `DPR`, the breadcrumb, the section head and `.cv-because` prose outside the world.
- **The worker is still built from `Function.prototype.toString()`.** `transport.js` + the two skin helpers are one module whose functions keep their sheet text (`self.T5_TEXT(…)`, `self.SKIN_BEVEL(…)`). `self` there is a **module-local namespace object** that shadows the global, so the main thread resolves the siblings without window globals. Main-thread call sites use the exported `T5` (`self.T5_CHROME` → `T5.T5_CHROME`).
- **Worker body wrapped.** A bundler can rename that `self` binding (Rollup deconflicts, minifiers shorten), and toString returns the renamed text. So the Blob body is `(function (<NS>) { <NS>.T5_TEXT = …; …; (T5_WORKER)(); })(self);` where `<NS>` is read back from the source text of the exported `nsName()` sentinel. In dev `<NS>` is `self` and the wrapper is a no-op. Verified in dev (parity ✓ 0xf1b886c4, same hash as the sheet). Under a minified bundle (`bun build --minify`) the binding became `Z` and the wrapped body still built and drew; **not checked in a full Vite production build or a live worker from one**.
- **`BOOT.settled()` removed** from the parity-pass branch (it released §2's table measurement on the sheet).
- **Teardown added** (the sheet had none): `worker.terminate()`, Blob URL revoked if still live, ping timer and the post-block settle timer on the disposer, free-run rAF cancelled, the block's double-rAF bails if disposed, the `matchMedia` change listener and both button listeners removed.
- `blobUrl` is nulled after the sheet's own revoke on `ready`, so dispose does not revoke twice.

## Carried over as-is
- The canvas transfer is one-way; reduced motion at load stands down to a main-thread fallback (both units on the main thread) and says so in `t5-note`.
- Ping budget 2.5 s; a late pong after stand-down is ignored.
- Console warning "Multiple readback operations using getImageData are faster with willReadFrequently" — from the worker's `hash()` on the transferred context; the sheet logs it too.
- `demo.cost` is deliberately not printed (it would measure postMessage).
- Measured during verification: block → unit 1 advanced 0 frames while blocked, 2 across the 852 ms window; unit 2 advanced 25 (13×). Chassis paint 0.20 / 0.30 ms †. Headless and contended, not stage numbers.
- The "main-thread frames" and "worker frames" counters reset on free-run.

## Assets
None. Everything is blitted.

## For the edit pass
Nothing specific recorded for this demo yet.
