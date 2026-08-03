# Web Animation & Motion — Presentation Scope

**Presenter:** k (jclark@folklore.digital)
**Presentation date:** Friday, August 7, 2026
**Doc drafted:** August 3, 2026

## ⚠️ Timeline flag

Today is Monday; the talk is Friday — 4 working days for a custom-built app with multiple live coded demos across six rendering techniques plus a WebGPU section. Recommend treating the outline below as the full vision, but explicitly deciding a "must-have v1" vs. "stretch" split before starting build (see Risks section).

## Overview

A tour through web animation and motion, built and delivered as a custom interactive app (not slides) so every example is real, running code rather than a screenshot or description. Ends on WebGPU, framed as an underused frontier with applications beyond the browser.

## Audience

Mixed technical/non-technical crowd who has seen this kind of work before but hasn't necessarily understood what's happening under the hood or what's technically possible.

## Objective / Thesis

As AI becomes a universal interface for searching, synthesizing, and experiencing information, reference content — specs, policies, contact details — increasingly gets consumed directly inside a chat session rather than on a site. What that ephemeral AI-generated display can't replicate is a crafted experience: a unifying hub for a brand's digital presence, its media and creative, its social content. That's where a website's comparative advantage now lives — not as a repository of content, which can be distributed anywhere, but as a living, authored space that only exists as itself. Motion, animation, and interaction are the craft that makes that possible.

**Supporting premises (fact-checked, see Notes on Evidence below):**
- Multiple independent studies show declining click-through from AI-mediated search to informational content sites — directionally solid, though Google disputes the aggregate magnitude and effects vary by query type.
- Motion/experiential design as a proven *business* differentiator is a real craft trend but thin on rigorous business-impact data — framed here as a craft/attention argument, not a claimed ROI stat.
- WebGPU has real browser support now but negligible real-world adoption — "untapped frontier" is accurate for usage, not availability.
- WebGPU/WGSL genuinely runs outside the browser (Dawn, wgpu/Rust powering real game engines) — this is the most solidly evidenced claim of the four.

## Format & Delivery

Custom-built app, not PowerPoint/Keynote, so animation/interaction examples run as live code rather than being described or screen-recorded. Requirements:
- Slide-based navigation (forward/back, keyboard control)
- Preview/speaker view (current + next slide, notes) — likely a second synced browser window via `BroadcastChannel` or `localStorage` events
- Fullscreen presentation mode via the native Fullscreen API

## Content Outline

Structured as a "spectrum" from passive/cheap to powerful/expensive rendering techniques, with one recurring "thread demo" that reappears in a new form at each stage as a visual callback, culminating in a WebGPU-upgraded version at the end.

1. **Title / Cold Open** — thread demo already running full-bleed, no explanation yet.
2. **The Thesis** — stated above; visual: plain chat-answer mockup vs. thread demo as a real site.
3. **The Map** — preview of the spectrum (Video/GIF → CSS → Layout/Paint/Composite → SVG → Canvas → WebGL → WebGPU); tells the audience to watch for the recurring demo.
4. **Baseline: Video & GIF** — pre-baked pixels, no interactivity; visual: thread demo as GIF and video side by side with file sizes labeled.
5. **CSS Transitions/Animations + Render Pipeline** — browser-managed motion; introduces Layout → Paint → Composite; visual: animated pipeline diagram + simple live hover/transition demo.
6. **CPU vs. GPU: Compositing** — `transform`/`opacity` are GPU-cheap, `width`/`top`/`left` force layout ("jank"); visual: live side-by-side janky vs. smooth box animation.
7. **SVG Animation** — vector, DOM-based, path morphing; visual: thread demo as an SVG morph/draw-on version.
8. **Canvas 2D** — imperative pixel drawing, CPU-bound, good for generative work; visual: thread demo as a Canvas 2D version.
9. **WebGL** — GPU shaders, real 3D; visual: thread demo in WebGL, reactive to mouse.
10. **Same Tech, Different Surfaces (Beyond the Browser)** — same build outputs to broadcast graphics (OBS/CasparCG/Singular.live-style browser sources), digital signage (embedded-browser displays or baked video loops), programmatic ad creative (HTML5 templates + data swaps), and baked-for-social video (Remotion/Rive-style export); visual: four-panel of the thread demo as a broadcast lower-third, a billboard mockup, an ad template, and a vertical social video.
11. **WebGPU: The New Layer** — compute shaders enable particle/fluid sims and on-device ML at a scale WebGL can't reach; support has arrived, adoption hasn't; same WGSL code runs outside the browser too; visual: thread demo rendered in WebGPU at a scale the WebGL version couldn't sustain.
12. **Close: Full Circle** — recap thesis; visual: return to the opening hook shot of the thread demo in its most advanced form.

Note: with full callback demos at each stage this runs ~16-18 slides, snug for a 15-20 minute talk. Expect to trim (e.g., a diagram instead of a live demo for the CSS pipeline slide) during build.

## Technical Approach

- **App shell:** React + Vite; slide state as an index, optionally one route per slide for deep-linking/reload during rehearsal.
- **Navigation/fullscreen/preview:** native Fullscreen API, custom keyboard handlers, `BroadcastChannel`/`localStorage` sync for a speaker-view window.
- **Per-technique demo tooling** — deliberately native to each technique rather than one shared abstraction, so the tech shown matches the tech being explained:
  - CSS section: plain CSS transitions/keyframes
  - SVG section: plain SVG + CSS, or GSAP for scripted path-morphing
  - Canvas section: raw Canvas 2D API, or p5.js for faster iteration
  - WebGL section: Three.js (optionally via React Three Fiber)
  - WebGPU section: Three.js's experimental `WebGPURenderer`/TSL, letting the WebGL and WebGPU demos share one codebase
  - Video/GIF section: native `<video>`/`<img>`; optionally `ffmpeg.wasm` or Remotion to bake the thread demo to video live on stage
- **Presentation chrome (not content):** Framer Motion for slide transitions, progress bar, nav UI — kept separate from the technique demos themselves so the audience isn't confused about which tech is doing what.

## Architecture Considerations

- Browsers cap concurrent WebGL contexts (~16); running many demos at once across slides risks crashing the tab over a 15-20 minute talk. Mount/unmount each demo so only the active slide's demo is live (or isolate via `<iframe>` if a demo needs harder isolation).
- WebGPU browser support is still uneven (Firefox rollout partial as of this year). Need a recorded fallback clip for the WebGPU section specifically, in case the presenting machine/browser doesn't support it live.

## Risks & Open Questions

- **Timeline:** 4 working days for a custom app with 6+ live technique demos, a 4-panel "beyond the browser" slide, and a WebGPU section is aggressive. Recommend deciding a must-have v1 (fewer live demos, more static/video fallback) vs. stretch goals before starting build.
- **Thread demo not yet chosen:** need to pick the actual visual concept that recurs through the deck.
- **WebGPU live-demo risk:** confirm the presenting machine/browser supports WebGPU before the day of, and have the fallback recording ready regardless.
- **Evidence caveats:** the AI-traffic-decline data is directionally solid but contested by Google; state it as "multiple studies show," not as settled fact.

## Out of Scope

- CMS/backend — this is a static, client-side app
- Cross-browser support beyond the presenting machine/browser (build for what will actually run the demo, not general production compatibility)
- Mobile/responsive layout for audience devices — this is presenter-driven, not self-serve

## Success Criteria

- Every animation category is demonstrated as real running code, not a description or recording (except where the WebGPU fallback is needed)
- The thread-demo callback structure lands as a visible through-line, not just a list of unrelated examples
- The talk closes having made the thesis concrete: the site's value is the craft, not the content