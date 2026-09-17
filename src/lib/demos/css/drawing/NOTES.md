# CSS as a drawing instrument

## What it is
CSS used as pigment instead of layout, in three cards: metaballs from `filter: blur() contrast()`, moiré from two rotating concentric rulings under `mix-blend-mode: difference`, and the TIMELESS type poster, which turns a conic gradient through the letterforms on a registered `--holo` angle. There is no script.

## Source
`design/techniques/css.html`, section "Not layout at all · css as a drawing instrument".
- Markup: page context 623–639, section head/prose 810–828, art-goo 829–833, art-moire 835–839, art-holo 841–845, notes 878–906.
- CSS: 11–27, 124–130 (scene-card), 329–339 (art-grid), 341–354 (goo), 356–366 (moiré), 368–468 (holo, `@property --holo`), 609–614 (reduced motion), 616–618 (notes).

## Extraction changes
- `:root` becomes `:host`. The crumb iframe-hide script moves into `mount()`, scoped to the root.
- **`@property --holo` registered at document level** with `CSS.registerProperty`. Inside the shadow root Chromium ignored the rule and `--holo` stayed unregistered, so the gradient did not turn. Measured: the computed value was stuck before registering and advanced 47° → 107° → 122° after. The rule stays in demo.css.
- The section prose is shared with `css/aperture-and-type`, so both pages carry a copy.
- The markup closes `.art-grid` after the holo card, because the sheet's grid continues with aperture/variable, which are now their own demo.
- Dispose clears the shadow root. Everything is CSS.

## Carried over as-is
- The reduced-motion block still names `.depth` and `.vf` selectors, which this page does not use. It is copied verbatim.
- The holo poster sits alone in the second grid row, because on the sheet its row partner was the aperture card.
- The notes block is the whole SL-06 sheet's, verbatim. The crumb links are relative to the sheet.

## Assets
None. Doto (`.ho-dots`) and Inter load at document level.

## For the edit pass
- Key: "for layout and css we can take all these examples divided into 3 pages of demo". This is page 2 of the split.
