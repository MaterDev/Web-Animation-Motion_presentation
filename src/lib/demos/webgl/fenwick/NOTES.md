# The Fenwick · object in the round

## What it is
One experience made from two earlier demos, `webgl/fenwick-hero` (the points) and `webgl/fenwick-museum` (the lit mesh). Both folders are left in place as collection history. A CC0 marble bust arrives as 320 000 fine GPU points that gather out of drifting dust, and a warm scan line then rises through the cloud. Below the line the points give way to the PBR mesh, which has a crisp light outline. The bust turns slowly under one of three light rigs, then dissolves back to points and lets go. Everything sits in a dark bevelled housing with a compact museum panel.

Key's request (2026-09-17): "combine slides 27 and 28 for the art thing. we can use the particle effect to show the model coming together but I don't want the on-hover distortion, and let's render the model so it has an outline and also put it against a darker background since it's lighter. this experience needs a chassis."

## Source
- The points program (`POINTS_VS`/`POINTS_FS`), the sampler and the gather timing come from `fenwick-hero/index.js`.
- The mesh, room environment, light rigs, note poses, drag and the look-closer notes come from `fenwick-museum/index.js`.
- Everything is copied, so there are no imports from either folder. The assets are copied from `fenwick-museum/assets/bust/`: Marble Bust 01 · [Poly Haven](https://polyhaven.com/a/marble_bust_01) · CC0 1.0.

## Slide fit (2026-09-17)
**Layout (864 × 444, measured `demo-host` scrollHeight 444):**
- **Housing:** a dark brushed chassis with a six-line inset bevel, four screws, and padding of 10 px top and bottom and 14 px at the sides.
- **Head (20 px):** a sunken plate, "THE FENWICK · OBJECT IN THE ROUND", with a webgl-tint LED. On the right is a live phase readout: gathering · 320,000 points → points → object → lit mesh · outlined → object → points → letting go.
- **Rack (396 px), stage `1fr` (568 × 396) | panel 256 px, gap 12:**
  - **Stage:** a charcoal radial gradient with a soft vignette and an inner bevel over the canvas, plus a "drag to turn" hint.
  - **Panel, top to bottom:**
    - eyebrow "Marble · Gallery 3"
    - title "Portrait bust of a man" (20 px, warm ink, not white)
    - Light: Gallery / Daylight / Raking as three equal keys
    - Look closer: three notes; only the active one shows its line
    - "Replay the scan"
    - credit "Marble Bust 01 · Poly Haven · CC0" (11 px mono)
  - The panel fills exactly: scrollHeight 396 = clientHeight.
- All labels are 11 px or larger.

**Sequence (`CYCLE = 23.4 s`):**

| Time | What happens |
| --- | --- |
| 0–2.2 s | Gather, the hero's cubic ease-out with its per-point stagger and curl |
| 2.2–2.6 s | The points settle |
| 2.6–4.2 s | The scan line rises |
| 4.2–4.7 s | The outline fades in |
| 4.7–19 s | The lit mesh turns (360° per 40 s, pitch sway over 11 s) |
| 19–20.4 s | The line falls |
| 20.4–22.4 s | The points let go |
| 22.4–23.4 s | Drift |

When the scan finishes loading, the clock seeks to 0 and plays, so the slide always opens on the gather.

**Registration.** There is one renderer, one scene and one camera. The glTF scene is normalised once (1 unit tall, centred). The points are sampled on those same meshes after normalisation, and the mesh is drawn in place. The line uses one wobble function (`fwWobble`), shared by the points' vertex shader and the mesh's fragment shader (injected with `onBeforeCompile`), so the points vanish exactly where the stone appears. The mesh glows warm at the line, and the points brighten at it.

**Outline.** An inverted hull: a `BackSide` `ShaderMaterial` child of each mesh that shares its geometry. Each vertex is pushed out along the projected normal by a constant 1.8 CSS px (× DPR) in clip space and nudged back slightly in depth, so only the silhouette and deep contours show. The colour is `#f1dcb4`. No composer and no extra render target, so it adds one draw call.

**No pointer distortion.** The wind uniforms (`u_rayO`, `u_rayD`, `u_push`), the pointer handlers and the "pointer = wind" label are gone. Drag-to-turn remains.

**Interaction.** A note, a light key or a drag holds the object resolved. A gather in progress finishes, and a dissolve or drift snaps back to the lit mesh. "Replay the scan" clears the hold and pose and seeks to 0. A note turns the bust to its pose over 1.2 s, as in the museum demo.

**Lighting fixes, found while tuning:**
- **Bug in the museum demo, fixed here.** In three r185 `material.envMapIntensity` does NOT scale `scene.environment`. Measured: with all three lights at 0 and envMapIntensity 0, the bust still read 145,134,115, and removing `scene.environment` read 0,0,0. So every rig ran at full room-environment strength, which is why "Raking" barely differed. The rig now writes `scene.environmentIntensity`.
- **The rigs are camera-relative.** Light positions are turned by the camera yaw, so Raking always rakes across the face in view. The points' key light is the rig's key, so the handoff matches.
- **Values retuned for the dark well:**
  - gallery: env 0.5, exposure 0.95, rim 1.2
  - daylight: env 0.95, exposure 0.9
  - raking: key (3, 0.3, 0.5) at 3.6, env 0.12, exposure 1.1
- The points' texture is half-desaturated and ×1.15, and the per-point grain is narrowed to ±16%.

**Viewport fix.** Both source demos called `R.setViewport(0, 0, w, h)` with device-pixel sizes. three multiplies by the pixel ratio, so at DPR 2 only the lower-left quarter was drawn, scaled up. `setSize` already sets the viewport, so the call is removed here. The source folders were not touched.

**Reduced motion.** The phase is pinned to resolved: lit mesh, outline on, no gather. The pose is the active note's. Verified with `--reduced`: the readout says "lit mesh · outlined".

**Dispose.** Stops the WAM clock and every listener and observer. Then it traverses the scene: geometries (points and mesh; the shared outline geometry is harmless to free twice), materials (mesh, outline, points), textures (map, normal, roughness), the PMREM environment texture, and the render lists. The renderer is disposed and `forceContextLoss()` is called. Verified: after switching demos in the viewer, the old canvas's `webgl2` context reports `isContextLost() === true`. There is a single renderer; the composer the brief allowed was not needed.

**Verified** in headless Chrome at DPR 2, in the `/demos` viewer:
- `demo-host` 864 wide, scrollHeight 444
- canvas backing store 1136 × 792 (568 × 396 CSS)
- no console errors

Screenshots (scratchpad):
- `gpu-fenwick-gather.png`: mid-gather
- `gpu-fenwick-handoff.png`: scan line halfway, points above and mesh below
- `gpu-fenwick-lit.png`: resolved and outlined
- `gpu-fenwick-raking.png`: after the Raking key
- `gpu-fenwick-reduced.png`: reduced motion
- `gpu-fenwick-grid.png`: overview
