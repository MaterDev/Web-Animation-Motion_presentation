# composite/layers: One page, three surfaces

**What it is:** Exploded view of one product page: DOM on top, a GPU canvas in the middle, a video loop at the back, assembling and coming apart; with its layer key.

**Source:** `design/techniques/composite.html`, section "1 · The argument — one page, three surfaces". The Composite sheet was rewritten on 2026-09-17. Its claims were checked by two tachikomas against SCOPE.md and the claims register, and every one holds.

**Extraction changes**
- The sheet's whole `<style>` block was copied, with `:root` changed to `:host` and the page chrome rules removed (`.wrap`, `.crumb`, `.head`, `.dek`).
- The markup is the section's figure(s) only. The section heading and prose were left out, because the slide carries those.
- There is no script. The layer animation is `@keyframes cp-explode` on `transform`, with `prefers-reduced-motion: reduce` turning it off.

**Carried over as-is:** the sizes are the sheet's (the stage is 520px tall, the iso plane 330×214).

**For the edit pass:** fit it to its slide region.
