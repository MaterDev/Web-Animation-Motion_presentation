# Timeless, a magazine animated

## What it is
Six page fragments from Timeless, a fictional newsweekly, each looping one CSS layout technique on its own: a cover packing into a sticky masthead, a staggered story feed, a news crawl, section tabs that retint, a cascading contents flyout and 0fr → 1fr drawers. There is no JavaScript. The three state-driven cards hand over to `:checked`, `:focus-within` and `:has()` as soon as someone uses them.

## Source
`design/techniques/css.html`, section "CSS for layout · timeless, a magazine animated".
- Markup: page context 623–639 (crumb, `.head`, dek), section 680–808 (ex-cover 697–716, ex-feed 718–733, ex-ticker 735–756, ex-sections 759–773, ex-contents 775–790, ex-expand 792–806), notes 878–906.
- CSS: 11–27 (page context), 111–130 (card grid, scene-card), 169–327 (`.mag` base, the six cards, reduced motion), 616–618 (notes).

## Extraction changes
- `:root { --tint }` becomes `:host`.
- The crumb's iframe-hide inline script is now in `mount()` and queries `root.getElementById('crumb')`.
- **`@property --accent` registered at document level** with `CSS.registerProperty` (try/catch, so a second mount is fine). Chromium ignores `@property` inside a shadow root, which was checked by reading the computed value before and after registering. The rule is still in demo.css. Registration is global and permanent for the page. If another demo registers `--accent` with a different syntax, the first registration wins.
- Dispose clears the shadow root. Every animation is CSS, so nothing else needs stopping.

## Carried over as-is
- **Class collisions with components.css are kept on purpose.** ex-feed's `.thumb` picks up the system thumb rule (`aspect-ratio: 16/10`, box-shadow, hover lift, `::before` counter). ex-ticker's `.plate` picks up the system plate (dark gradient, padding, lift), which is why "The Wire" plate is dark on a paper card. The sheet has the same collisions, and `stage()` injects the system, so the copy matches the sheet.
- The cover and feed cards run on the clock, not `scroll()`/`view()`. The sheet says this in the card notes.
- The sheet's notes block describes the whole SL-06 sheet, including the pipeline and SL-07/08. It is kept verbatim.
- The crumb links (`../index.html`) are relative to the sheet and do not resolve from the deck.

## Assets
None. The page uses system fonts (Georgia serif stack) plus the mono token.

## For the edit pass
- Key: "for layout and css we can take all these examples divided into 3 pages of demo". This is page 1 of the split.
