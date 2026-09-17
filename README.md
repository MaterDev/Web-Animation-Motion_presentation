# Web Animation & Motion — Presentation

A custom-built, interactive presentation app for a talk on web animation and motion techniques — delivered as real running code rather than slides or screen recordings.

**Talk date:** 17 September 2026

## Overview

The talk climbs a comprehension ladder, not a cost ladder: Layout/CSS → SVG → GIF → Video → Canvas → WebGL and WebGPU, then Composite as the closing argument. Seven techniques in the paper, six stops on stage. The paper explains the order.

**Premise:** most US Google searches now end without a click. The reading the paper offers: if the web stops being where people go for answers, it becomes where they go for experiences, and motion is how those are built.

## The site

Four top-level sections, deployed as one static site:

| Route | What it is |
|---|---|
| `/design` | Methodology — how the design system was made, and why the process is what it is |
| `/design/reference` | The design system's live reference sheets: materials, motion, graphic language, layouts |
| `/techniques` | One live sheet per rendering technique, in the talk's order |
| `/paper` | [SCOPE.md](./SCOPE.md), rendered — the paper the talk is built on |
| `/presentation` | The deck itself, in build |

## Documents

- **[SCOPE.md](./SCOPE.md)** — the paper, with its bibliography. The talk is compressed from it; everything defers to it.
- **[DESIGN.md](./DESIGN.md)** — the design research it produced. Visual language, motion system, architecture, conventions.

## Tech stack

- **Svelte 5 + SvelteKit**, static output via `adapter-static`
- **Bun** as runtime, package manager and bundler
- **Vite 8**
- Per-technique demo tooling native to each rendering method — plain CSS, plain SVG, raw Canvas 2D, Three.js for WebGL, raw WGSL (and `vgpu` for Supercell) for WebGPU
- **Anime.js** for JS animation, including the layout-animation slide transitions
- No CDNs. Every dependency, fonts included, is installed and vendored — see below.

## Running it

```bash
bun install
bun run dev        # http://localhost:5173
bun run build      # static output in build/
bun run preview    # serve the built output
bun run check      # svelte-check
```

`dev` and `build` both run two generator steps first:

- **`bun run vendor`** — copies Anime.js, Three.js, vgpu and the three variable fonts out of `node_modules` into `design/vendor/`, so nothing loads from a third party and the standalone sheets have real files to reference.
- **`bun run sync:design`** — copies `design/` into `static/sheets/`, which is how SvelteKit serves the harness at `/sheets/…`.

Both outputs are generated and gitignored. After a fresh clone, `bun install` plus either script handles it.

## Repo layout

```
design/             the design harness — standalone HTML tearsheets, no build step
  system/           tokens.css + components.css — the single source of truth for
                    every colour, curve, material and module. Loaded unmodified
                    by both the harness and the app.
  treatments/       six competing visual directions; T-06 was kept
  techniques/       one live demo per rendering technique
  layouts/          the LED slide surface, the modular grid, all 15 compositions
  graphic-language/ per-topic tints, marks, rules, glyphs, patterns
  vendor/           GENERATED — third-party deps + fonts
src/                the SvelteKit app
scripts/            the two generator scripts above
static/sheets/      GENERATED — a copy of design/
```

**The harness is deliberately buildless.** Every sheet opens directly in a browser with no server and no toolchain, which is what has made it possible to verify each change by looking at the real thing rather than trusting it. The app consumes those exact files rather than reimplementing them, so the two cannot drift apart.

## Deploying

Static output, so it serves from anywhere. Config for two hosts is checked in — `netlify.toml` and `render.yaml` — both running the same build to the same directory. Neither is committed to; the hosting decision is still open.
