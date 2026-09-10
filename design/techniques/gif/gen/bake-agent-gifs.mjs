/* Bakes the eight agent-identity creatures to real .gif files in
   ../assets/. Each is a full keyframed special-move loop (12-24
   frames) — see agent-icon.mjs.
   Run: bun run design/techniques/video/gen/bake-agent-gifs.mjs */

import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { toRGBA, upscale, unionBounds, cropSide, cropToSquare } from './pixel-grid.mjs';
import { AGENTS, SIZE } from './agent-icon.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, '..', 'assets');
const SCALE = 12;   // 32-cell icon grid → 456px GIF; icons need a
                    // bigger multiplier than the old 68-cell sprites did
const MARGIN = 2;   // cells of guaranteed empty space on every side

mkdirSync(OUT_DIR, { recursive: true });
const BG = [0, 0, 0, 0];

/* Every creature was authored at whatever size felt right on a 68-cell
   grid, so each one filled a different fraction of its own canvas —
   Boulderback sat in roughly a quarter of its frame while Starlet
   nearly filled hers. Rendered into one fixed-size card slot that reads
   as wildly inconsistent scale and a lot of dead space.

   Rather than hand-retuning eight sets of body proportions, the bake
   measures the union bounding box across ALL frames of an agent (union,
   not per-frame, or the character would jitter and rescale as its own
   effects fire), crops to it, then re-centres inside a square with a
   fixed MARGIN. Result: every creature fills its frame as fully as it
   can, all of them land at a consistent scale, and nothing ever touches
   the canvas edge. */
for (const [key, agent] of Object.entries(AGENTS)) {
  const b = unionBounds(agent.frames, SIZE);
  const w = b.maxX - b.minX + 1, h = b.maxY - b.minY + 1;
  const side = cropSide(b, MARGIN);

  const gif = GIFEncoder();
  const outSize = side * SCALE;

  agent.frames.forEach((grid, fi) => {
    const cropped = cropToSquare(grid, b, side);
    const rgba = upscale(toRGBA(cropped, side, agent.palette, BG), side, SCALE);
    const palette = quantize(rgba, 64, { format: 'rgba4444' });
    const index = applyPalette(rgba, palette, 'rgba4444');
    gif.writeFrame(index, outSize, outSize, {
      palette,
      delay: (agent.delays && agent.delays[fi]) ?? agent.delayMs ?? 400,
      transparent: true,
      transparentIndex: palette.findIndex(c => c[3] === 0),
      dispose: 2,
    });
  });
  gif.finish();

  const path = join(OUT_DIR, `agent-${key}.gif`);
  writeFileSync(path, Buffer.from(gif.bytes()));
  const fill = ((Math.max(w, h) / side) * 100).toFixed(0);
  console.log(
    `bake-agent: ${agent.name.padEnd(12)} ${String(agent.frames.length).padStart(2)}f  ` +
    `content ${w}x${h} → ${side}px sq (${fill}% fill, ${MARGIN}px margin)  ` +
    `${(gif.bytes().length / 1024).toFixed(1)} KB`
  );
}
