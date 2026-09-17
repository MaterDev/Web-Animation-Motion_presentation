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


## Presentation edits (2026-09-17)
- **Slide layout:** the prose and note are hidden. Long explanations moved to the speaker notes.

## Slide fit (2026-09-17)
- **Backing store 560 × 340 → 420 × 360**, displayed at exactly 420 × 360 CSS px (1 CSS px per backing pixel). Two players + a 24 px gutter = the slide's 864 px. The old store was shown at ~0.75×, which resampled the bitmap font.
- **Shared chassis (`transport.js`)**, so both threads still run identical code: the eq response well now takes whatever width the eleven faders leave (192 px at W = 420, was a fixed 132), and the playlist blits at 2× in 16 px rows, as many rows as fit (8 at H = 360), instead of 12 rows at 1×. The worker still gets its code via `Function.toString`. Boot parity passes (✓ 0x49157398; the hash changed because the picture changed).
- **Controls in one 52 px row** (`t5-controls`) under the players: the two buttons stacked on the left, then the four readouts spread across (main-thread frames as the 30 px hero). Labels are 11 px. Rack columns are fixed at 420 px.
- The prose and the block-result `t5-note` stay hidden on the slide.
- Measured: host 864 × 443. Block test in headless Chrome: unit 1 advanced 0 frames while blocked (4 across the 851 ms window), unit 2 advanced 50.

## Slide fit, one player + oil-slick visualizer (2026-09-17, later)
Supersedes the twin-player layout above (and the "What it is" summary at the top). Key: "we just need to show one player, we won't do the comparison", plus a 90s music-player visualizer on the right, then "something abstract like an oil spill".
- **One player:** the worker unit (amber skin, `OffscreenCanvas`), 400 x 360 backing, drawn 1:1. The main-thread unit, its green `--t5-*` inks at the call site, `t5-main-canvas`/`t5-main-stage`/`t5-main-title`, the `t5-parity` and `t5-chrome-ms` readouts and the `cv-instr` prose are gone. The green tokens are still declared in `demo.css` but unused.
- **Visualizer** (`t5-visualizer`, `t5-vis-canvas`, 448 x 360, 1:1), right of the player with a 16 px gutter: 400 + 16 + 448 = 864. It uses the player's bevelled chassis: a title bar ("VIS / OIL SLICK" and a frame counter), a sunken screen, mode chips (OIL lit, SPEC and SCOPE dark), and L/R segmented level meters. The screen shows an abstract **oil slick**: two-octave value noise from an integer hash, domain-warped twice, mapped through a cyclic thin-film palette built from six new tokens `--t5b-oil-0..5` (indigo, magenta, gold, green, cyan, violet), over a dark indigo base, with faint scanlines and "OIL" / beat-lamp "120 BPM" chips on top. The field renders at quarter size (107 x 74) into ImageData and is drawn up with smoothing on. The kick envelope of the stated 120 bpm signal (`T5_SIG`) widens the warp and lifts the sheen. All motion comes from t: warp offsets move on circles and the band shift is an integer count per cycle, so the loop is seamless.
- **Same worker draws both.** The second canvas is transferred in the same `init` message (`visCanvas`). New functions `T5_SIG`, `T5_OIL_LUT`, `T5_OIL_FIELD`, `T5_VIS_CHROME` and `T5_VIS_LIVE` live in `transport.js` and ship through the same `Function.toString` wrapper. The worker makes the field's `OffscreenCanvas`; the fallback path makes a `<canvas>`.
- **Parity is kept but silent.** Boot hashes the player raster plus the oil field's **bytes** (stride 7), not the smoothed raster, because two rasterisers may round a smoothed scale differently. Pass sets `data-parity="ok"` on the host. Fail stands down to the main-thread fallback with a `console.warn`. The worker only hashes on the boot `render` (`parity: true`), no longer on every frame.
- **Paint cost readout** (`t5-paint-ms`, "worker paint / frame"): the worker times both canvases on every 15th frame, closes the timing with a 1 px `getImageData` on each, and reports the median of the last 9 samples. Headless and contended: 2.8–8.6 ms.
- **Controls row** (52 px): "block the main thread 800 ms" and "free-run worker" (buttons made `nowrap`/`flex: none` so they don't wrap), then readouts: main-thread frames (30 px hero, the "is the page blocked" witness), worker frames (30 px, amber), worker paint / frame, and "during last block" (`t5-last-block`, e.g. `page 0 · worker 55`). Free-run still matters: in clock mode the worker only draws when the main thread posts a `render`, and block turns free-run on first.
- `meta.js` title/summary updated.
- **Measured:** host 864 x 443 (`.demo-root` 442). Block in headless Chrome: page 0 frames while blocked, worker 55 and 48 over the ~850 ms window (two runs). A 2.5 s synthetic block with two CDP screenshots 700 ms apart: the visualizer's counter went 249 → 297 and the oil field changed, and the player's counter and clock advanced too. Reduced motion (`--reduced`): stands down before transfer, both canvases show the poster frame, and the counters hold. Boot parity ok. `bun run check`: 0 errors.

## Slide fit, housed + real time (2026-09-17, Key review)
- **Oil slick is not reactive now.** The kick pulse, the "120 BPM" chip with its beat lamp, and `T5_SIG` are gone. The field drifts on its own: warp offsets move on 60 s and 40 s circles and the palette bands turn once every 15 s, all as integer counts per loop. The L/R meters are decorative slow sine swells.
- **Real time.** The loop is now one 4:00 track (`LOOP_MS = 240000` in `index.js`, sent to the worker as `dur`). The player clock shows `t × 240` s, so it counts 1 s per second. It used to show 214 s every 12 s. Every other player rate was multiplied by 20 to keep its old natural speed (small scope 20/40/60, band partials 40/140/260, EQ faders 14/38). The marquee scrolls about 28 px/s, rounded to whole passes per loop.
- **Playlist is still.** It doesn't scroll and the highlight doesn't move. Row 03 is the marquee's track ("UNTITLED / A-SIDE", 4:00) and is current for the whole loop.
- **Housing.** The whole demo sits in one chassis, `.t5-housing`, 864 x 444. It's flat dark grey with hard-stop brushing stripes, a CSS inset six-line bevel, four screws, a product plate ("HALCYON TX-5 · off-thread deck", fictional) with an amber LED, "drawn by <host>" on the right, and a groove seam above the controls. The controls and readouts sit inside it. Layout: padding 10/16, header 18, gap 6, units 342, gap 8, controls 48 = 442 inside 444. Units: player **384 x 342** + 12 + visualizer **436 x 342** (field 104 x 69), both 1:1.
- **The chassis rules are on `.t5-housing`, not `.t5`.** The token probe in `helpers.js` wears `.t5`, and padding on it added 20 px of phantom `scrollHeight` to the host (464).
- The DOM unit-name labels are gone; the canvases' title bars and the header carry that. `t5-vis-host` is now visually hidden. Readouts were shortened to fit: "paint / frame", and "last block · page / worker" with a value like `0 / 49`.
- **Measured:** host 864 x 444, last readout ends 16 px inside the chassis. Block button: `0 / 49`, `0 / 55` and `0 / 48` across runs (page frames while blocked / worker frames over the ~850 ms window). Clock vs frames across two screenshots: 00:13.47 → 00:15.08 over 97 frames at about 60 fps, which is real time. Parity ok. `bun run check`: 0 errors.
- **Correction to the entry above:** CDP `Page.captureScreenshot` waits for the renderer's main thread, so a screenshot cannot land *during* a synthetic block. The earlier "249 → 297 during a 2.5 s block" pair was almost certainly captured after the block, as the DOM main-thread counter also moved between shots. The evidence that the worker kept drawing while the page was blocked is the counter readout (page 0 while blocked, worker 48–55), not those screenshots.

- **2026-09-17:** removed the floating "OIL" label chip from the top-left of the visualizer screen (Key). The OIL/SPEC/SCOPE chips below the screen remain. Both the worker and the main-thread poster draw the same functions, so parity is unaffected.
