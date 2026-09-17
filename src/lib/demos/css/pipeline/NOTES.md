# What a frame costs

## What it is
An interactive pipeline rig. Picking a CSS property lights up the stages (style, layout, paint, composite) that re-run for it, updates a cost readout, and animates a specimen box with that property. One table drives all of it, so the diagram and the motion cannot disagree.

## Source
`design/techniques/css.html`, section "Pipeline · what a frame costs".
- Markup: page context 623–639, section 640–678 (rig 655–677), notes 878–906.
- CSS: 11–27, 29–109 (rig), 616–618.
- JS: 956–1025.

## Extraction changes
- `:root` becomes `:host`. The crumb iframe-hide script moves into `mount()`.
- `STAGES`/`PROPS` are module constants, and the rest runs inside `mount()`.
- `document.getElementById` / `querySelector` become `root.getElementById` / `root.querySelector`.
- The click listener on `#plProps` goes through `disposer().on`, and the `ResizeObserver` is disconnected on dispose.

## Carried over as-is
- **Bug: `select()` removes `--travel`.** `boxEl.removeAttribute('style')` wipes the `--travel` that `sizeTravel()` set, so after the first click (and after the initial `select(0)`) the specimen falls back to `300px` travel until the next resize. On a wide stage the box stops short, and on a narrow one it overshoots the track. Not fixed.
- The `.skip` label sits off-centre inside a faded stage because the whole stage, overlay included, is at opacity 0.34. The sheet looks the same.
- The notes block is the whole SL-06 sheet's, verbatim. The crumb links are relative to the sheet.

## Assets
None.

## For the edit pass
- Key: "for layout and css we can take all these examples divided into 3 pages of demo". The three pages are timeless, drawing and aperture-and-type. This rig is the fourth demo, migrated alongside them.
