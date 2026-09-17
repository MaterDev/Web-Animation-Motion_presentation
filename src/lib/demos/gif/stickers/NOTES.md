# Slime stickers and the companion device

## What it is
One baked slime character in four real contexts: a chat-reaction sticker, a processing indicator and an away state in a row, above an AI companion device. The device's tamagotchi screen, stats and mood follow a scripted chat conversation that loops forever.

## Source
`design/techniques/gif/index.html`, section "GIF · the sticker".
- Markup: page context 390–398 (crumb, `.head`, dek), section head/prose 401–413, gif-scene-sticker 415–425, gif-scene-loading 427–437, gif-scene-away 439–448, gif-scene-ai-chat 450–503, notes 747–758.
- CSS: 11–70 (page context, card grid, mock chat, ai-turn), 72–123 (tama device), 130 (`.gif-frame` base), 253–381 (tama sky/HUD, chat app, input row, upload, away), 383–385 (notes).
- JS: 587–745 (companion chat IIFE), minus the pulse interval 733–743.

## Extraction changes
- **Layout change Key asked for:** the three character cards sit in a 3-column row (`.gif-row`) above the companion device ("the player"). The device keeps its sheet width (2 of 4 columns) and is centred under the row. It is not stretched, because the device screen is a fixed 132px tall and the sprite is sized as a % of width. The card's inline `style="grid-column: span 2"` is replaced by the `.gif-player-row` rule. Below 860px the device goes full width.
- **Excluded:** agent roster (505–583), frame inspector modal (760–773), its module script (775–934), and every CSS rule only they used (`.agent-*`, `.fi-*`).
- **Removed the `.gif-frame` pulse interval** (733–743) and its `.gif-pulse` CSS. It selected across the ai-chat card and the roster, and the roster is gone. The plain `.gif-frame` wrapper rule stays because it sets `inline-block` and `line-height: 0`.
- Assets are copied into `assets/`. The markup's `assets/slime-*.gif` paths are rewritten to `new URL(..., import.meta.url)` at import, and `GIFS` uses the same URLs. The `?m=<mood>` cache-busting still appends to them.
- `getElementById` calls go through the shadow root.
- The conversation's `wait()` timeouts are tracked in a Set and cleared on dispose. A cleared wait never resolves, so the async loop simply stops. Ids leave the Set as they fire, so a long run does not pile them up. Dispose was verified: after navigating away, only the probe's own timer remained.
- `:root` becomes `:host`. The crumb iframe-hide script moves into `mount()`.

## Carried over as-is
- **Reduced motion is a busy loop.** With `prefers-reduced-motion`, `wait()` becomes 0ms, so the whole conversation re-runs back to back on 0ms timers, rewriting the DOM continuously. It is the sheet's behaviour and is not fixed.
- The reduced-motion check runs once at mount and is not live.
- `--tint` is the sheet's `--tint-video` (the GIF sheet borrows the video tint).
- Each `.gif-frame` span inside `.chat-header` wraps a `<div>`, which is invalid nesting. Copied as it is.
- `@keyframes typingdot` is defined twice in the sheet CSS, and both copies are kept.
- The section prose says "The four below…", and the sheet notes mention the agent roster, which this demo no longer carries. The text is verbatim page context.

## Assets
- `assets/slime-happy.gif`, `slime-eat.gif`, `slime-sleep.gif`, `slime-idle.gif` are copied from `design/techniques/gif/assets/`. The sheet notes say they are baked from `gen/` as stand-ins built for the sheet. No licence is stated.

## For the edit pass
- Key: "for gif we can show the set, but exclude the agent roster. put the 3 character animation gifs above the player." The roster exclusion and the row-above layout are both done in this phase. Anything further (16:9 fit, sizing the row against the device) is for the edit pass.


## Presentation edits (2026-09-17)
- **Layout:** the sprites are on the left as a 2 × 2 grid, the companion app on the right, both 420px tall. The slide gives the demo no container.
- **Fourth context** (Key): "presence / idle", using `slime-idle.gif` (already an asset, previously used only by the device) with an "online · ready to help" tag.
