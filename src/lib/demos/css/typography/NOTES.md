# css/typography — holographic and variable type

Composed 2026-09-17 for the deck (Key: "all the typography ones can go together"): the TIMELESS poster (`art-holo`) and the expanded variable-type card (`art-variable`), from css.html's drawing section. The history of each half is below.

## Holographic type

> Split out of `css/drawing` on 2026-09-17: the TIMELESS type poster on its own slide (goo and moiré hidden in this copy).



## Variable type

# css/variable-type: Variable type

Split out of `css/aperture-and-type` on 2026-09-17 for its own slide (Key: three group slides plus two typography slides), then expanded as Key asked.

**Deck expansion:** two rows added on the sheet's stagger. JetBrains Mono animates `wght` 100→800, and a monospace keeps its cells. Doto animates `ROND` alone at `wght` 700, as a slower wave across TYPOGRAPHY. The aperture card and its scroll script are removed from this copy.

---
# Aperture and variable type

## What it is
Two drawing-instrument cards. In Aperture, a scroll timeline widens a hole in an opaque plate to reveal a drifting colour field, and a small script eases the scrollbar the way a finger would. MOTION sets the same word in two variable fonts: Doto changes wght + ROND in place with no reflow, while Inter's wght changes its advance widths and re-runs layout every frame.

## Source
`design/techniques/css.html`, section "Not layout at all · css as a drawing instrument".
- Markup: page context 623–639, section head/prose 810–828, art-depth 847–853, art-variable 855–874, notes 878–906.
- CSS: 11–27, 124–130, 329–339 (art-grid, `.vf-card` spans both columns), 470–550 (aperture, `@property --ap`, `scroll-timeline: --apScroll`), 552–607 (variable), 609–618.
- JS: 908–954 (auto-scroll IIFE).

## Extraction changes
- `:root` becomes `:host`. The crumb iframe-hide script moves into `mount()`.
- `document.querySelector('.depth')` / `getElementById('depthHint')` become `root.querySelector` / `root.getElementById`.
- The rAF loop keeps its id and is cancelled on dispose. The wheel/touchstart/pointerdown/keydown listeners are registered through `disposer().on`.
- **`@property --ap` registered at document level** with `CSS.registerProperty`. Chromium ignores `@property` in a shadow root, so without this the mask radius steps instead of interpolating. The rule stays in demo.css.
- Dispose was verified: after navigating away, rAF calls dropped from 19/s to 0.

## Carried over as-is
- The `matchMedia` reduced-motion check runs once at mount, as on the sheet. Turning reduced motion on later does not stop the scroll drive.
- `apMark` uses a hard-coded `451px * 0.56` travel. It is sized for the sheet's card, so the tick marker's travel will be off at other card sizes.
- At the far end the step is sub-pixel (ease 0.22), so the scroll can stall for a while at max before it turns. The sheet does the same (seen at scrollTop 1227).
- Measured numbers in the copy: Inter "213px → 232px" at wght 120/900, and Doto advance widths identical (288px). Both were measured on the sheet and have not been re-measured in the deck.
- The notes block is the whole SL-06 sheet's, verbatim. The crumb links are relative to the sheet.

## Assets
None. Doto (ROND + wght) and Inter (wght) load at document level from the app.

## For the edit pass
- Key: "for layout and css we can take all these examples divided into 3 pages of demo, with the variable font being expanded to have some more so that it has enough". **Expand the variable-font card with more content.** Not done in this phase.
