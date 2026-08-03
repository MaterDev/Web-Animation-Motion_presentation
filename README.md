# Web Animation & Motion — Presentation

A custom-built, interactive presentation app for a talk on web animation and motion techniques — delivered as real running code rather than slides or screen recordings.

## Overview

The talk tours a spectrum of rendering techniques, from cheap/passive to powerful/expensive: Video/GIF → CSS → Layout/Paint/Composite → SVG → Canvas → WebGL → WebGPU. A single recurring "thread demo" reappears in a new form at each stage as a visual callback, culminating in a WebGPU-upgraded version at the close.

**Thesis:** as AI becomes a universal interface for consuming reference content, a website's comparative advantage shifts from being a repository of content to being a crafted, authored experience. Motion, animation, and interaction are the craft that makes that possible.

See [SCOPE.md](./SCOPE.md) for the full presentation scope, content outline, technical approach, and risks.

## Status

Early planning stage — see SCOPE.md for the timeline and must-have vs. stretch goals.

## Tech Stack (planned)

- React + Vite app shell
- Native Fullscreen API, keyboard navigation, `BroadcastChannel`/`localStorage`-synced speaker view
- Per-technique demo tooling native to each rendering method (CSS, SVG/GSAP, Canvas 2D/p5.js, Three.js for WebGL/WebGPU)
- Framer Motion for presentation chrome (slide transitions, nav UI) — kept separate from technique demos
