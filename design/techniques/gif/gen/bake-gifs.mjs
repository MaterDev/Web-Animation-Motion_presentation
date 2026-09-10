/* Bakes the four slime animations to real .gif files in ../assets/.
   Run: bun run design/techniques/video/gen/bake-gifs.mjs */

import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { toRGBA, upscale } from './pixel-grid.mjs';
import { ANIMATIONS, PALETTE, SIZE } from './slime-sprite.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, '..', 'assets');
const SCALE = 5; // 40px grid → 200px sticker

mkdirSync(OUT_DIR, { recursive: true });

// Transparent background so the sticker sits on the LCD ground, not a box.
const BG = [0, 0, 0, 0];

for (const [name, anim] of Object.entries(ANIMATIONS)) {
  const gif = GIFEncoder();
  const outSize = SIZE * SCALE;

  for (const grid of anim.frames) {
    const rgba = upscale(toRGBA(grid, SIZE, PALETTE, BG), SIZE, SCALE);
    // gifenc quantizes RGBA -> a per-frame palette + indexed buffer.
    // format: 'rgba4444' keeps the transparent index distinct from any opaque color.
    const palette = quantize(rgba, 64, { format: 'rgba4444' });
    const index = applyPalette(rgba, palette, 'rgba4444');
    gif.writeFrame(index, outSize, outSize, {
      palette,
      delay: anim.delayMs,
      transparent: true,
      transparentIndex: palette.findIndex(c => c[3] === 0),
      dispose: 2, // restore-to-background between frames — avoids ghosting on a transparent gif
    });
  }
  gif.finish();

  const path = join(OUT_DIR, `slime-${name}.gif`);
  writeFileSync(path, Buffer.from(gif.bytes()));
  console.log(`bake-gifs: ${name} → ${anim.frames.length} frames, ${(gif.bytes().length / 1024).toFixed(1)} KB → ${path}`);
}
