# Web Animation & Motion — Presentation

A custom-built, interactive presentation app for a talk on web animation and motion techniques — delivered as real running code rather than slides or screen recordings.

**Talk date:** 21 August 2026

## Overview

The talk tours a spectrum of rendering techniques, from cheap/passive to powerful/expensive: Video/GIF → CSS → Layout/Paint/Composite → Layout Animation → SVG → Canvas → WebGL → WebGPU. A single recurring "thread demo" reappears in a new form at each stage as a visual callback, culminating in a WebGPU-upgraded version at the close.

**Thesis:** as AI becomes a universal interface for consuming reference content, a website's comparative advantage shifts from being a repository of content to being a crafted, authored experience. Motion, animation, and interaction are the craft that makes that possible.

## The site

Three top-level sections, deployed as one static site:

| Route | What it is |
|---|---|
| `/design` | Methodology — how the design system was made, and why the process is what it is |
| `/design/reference` | The live reference sheets: materials, motion, graphic language, layouts, and seven technique demos |
| `/paper` | [SCOPE.md](./SCOPE.md), rendered — the full scope the whole build defers to |
| `/presentation` | The deck itself. Not built yet; next phase |

## Documents

- **[SCOPE.md](./SCOPE.md)** — the paper. Thesis, content outline, motion craft, accessibility, fallbacks, technical approach, risks. Written first; everything defers to it.
- **[DESIGN.md](./DESIGN.md)** — the design research it produced. Visual language, motion system, architecture, conventions.

## Tech stack

- **Svelte 5 + SvelteKit**, static output via `adapter-static`
- **Bun** as runtime, package manager and bundler
- **Vite 8**
- Per-technique demo tooling native to each rendering method — plain CSS, plain SVG, raw Canvas 2D, Three.js for WebGL/WebGPU
- **Anime.js** for JS animation, including the layout-animation slide transitions
- No CDNs. Every dependency, fonts included, is installed and vendored — see below.

See SCOPE.md's *Technical Approach* for why each of these, including what was ruled out (Tailwind, Tauri/Wails) and why.

## Running it

```bash
bun install
bun run dev        # http://localhost:5173
bun run build      # static output in build/
bun run preview    # serve the built output
bun run check      # svelte-check
```

`dev` and `build` both run two generator steps first:

- **`bun run vendor`** — copies Anime.js, Three.js and the three variable fonts out of `node_modules` into `design/vendor/`, so nothing loads from a third party and the standalone sheets have real files to reference.
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
