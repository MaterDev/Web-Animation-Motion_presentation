# Chroma key composite

## What it is
A green-screen stag clip decoded into a canvas, keyed per frame in the Cb/Cr plane into a real alpha channel, with spill removal. It is then composited into seven page scenes (float, type, card, duo, knock, snow, tick), with DOM in front of and behind the canvas. A 14-frame history of keyed frames drives the echo, smear and ghost trails.

## Source
`design/techniques/video/index.html`, section "an alpha channel the file never had"
- markup `.ck` 677–754 (bar/rail 678–704, `#ckStage` 708–739, `canvas#ckCanvas` 726, `video#ckSrc` 747–749)
- CSS 206–467
- JS 1316–1615 (rAF loop, 14-frame history, IntersectionObserver)
- Section prose (663–675) is not mounted.

## Extraction changes
- **Classic IIFE → `keyer(root, d)` in `keyer.js`.** `document.getElementById` / `querySelectorAll` → the shadow root. `document.createElement` for scratch canvases, flakes and bulbs is unchanged.
- **Disposal.**
  - Slider `input` and scene `click` listeners go through `disposer.on`.
  - The IntersectionObserver is registered with `disposer.observer`.
  - Dispose cancels the rAF loop, pauses the source video and unloads it.
- **Asset path.** `assets/greens-screen-9x16.mp4` is rewritten through `new URL(…, import.meta.url)`.
- **Tint.** `:root { --tint: var(--tint-video) }` → `:host`. The tint stays the video tint even though the demo now sits under `composite`.

## Carried over as-is
- **Reduced motion is ignored by the keying loop.** It has no `matchMedia` check, and the source video autoplays. The CSS scene animations (drift, marquee, snow, twinkle, glitch, field) do keep their `prefers-reduced-motion` rules.
- **Off-screen pause.** The IntersectionObserver pauses the video and the loop when the stage is off screen (`rootMargin: 120px`).
  - In a hidden tab or a backgrounded headless target the video can stay paused and the loop stopped until the stage re-intersects. This was seen during verification whenever the CDP target was not the front tab.
- **Key values.** The key colour rgb(48,192,54) was measured from the browser's decode, and the similarity/softness/spill defaults were set by eye.
- **Size.** The keying canvas is 360×640. The stage is `height: min(70vh, 660px)` at 9:16.

## Assets
- `assets/greens-screen-9x16.mp4`, from `design/techniques/video/assets/`. The sheet states no licence.

## For the edit pass
- Key: "for the composite example we can move that to the composite section of the presentation". The move is done here: technique `composite`. There are no other edits yet.

## Presentation edits (2026-09-17)
- **Slide layout:** the controls sit in a 330px column on the left, and the composite and source stand side by side at 440px tall. The whole demo is 960 × 480 (2:1).
- **Moved:** it now appears in the Composite section of the deck, not the Video stop (Key).
