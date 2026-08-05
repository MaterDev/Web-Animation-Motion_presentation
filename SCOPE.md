# Web Animation & Motion — Presentation Scope

**Presenter:** k (jclark@folklore.digital)
**Presentation date:** Friday, August 21, 2026
**Doc drafted:** August 3, 2026 · **Last revised:** August 5, 2026

## Timeline

**Moved from August 7 to August 21** — roughly twelve working days from August 5 rather than four. This changes the plan in one specific way and not others: the build was never the thing most at risk, sequencing and rehearsal were, and those still need reserving. What the extra two weeks genuinely buys is room to prototype the two unproven items (layout-animation slide transitions, and the WebGPU compute sim at a real particle count) *before* they're load-bearing, instead of discovering their limits during the build.

It also makes learning an unfamiliar stack a reasonable choice rather than a gamble — see Technical Approach.

Scope decision, unchanged: **build all demos live** (no video substitutions except the WebGPU fallback), on the basis that demo code will be AI-generated rather than hand-written, which compresses the build. Presentation chrome to be polished/branded, on the reasoning that a talk arguing craft is the differentiator should itself demonstrate craft.

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

**Presenting environment:** presenter's own machine, Chrome. WebGPU support is therefore low-risk, though a fallback recording is still produced for the WebGPU section.

**Visual design:** polished and branded. Existing brand/style guide to be supplied as a build input — visual direction (type, palette, motion language) is not defined in this document.

## The Thread Demo

A single recurring visual runs through the entire deck: **a particle system that assembles into the Folklore brandmark.**

Why this concept:
- **It escalates naturally.** Particle count and simulation fidelity are the exact axis on which these technologies differ — a handful of particles in SVG, more in Canvas, thousands in WebGL, millions via WebGPU compute shaders. The audience sees the capability jump rather than being told about it.
- **It resolves.** Each stage ends with the particles forming the brandmark, giving every section a payoff beat instead of an abstract loop.
- **It makes the off-browser surfaces legible.** The same asset shown as a broadcast lower-third, a billboard, an ad unit, and a vertical social video reads immediately as real brand work, not a tech demo.

Each technique section shows this same demo rebuilt in that technique, so the through-line is a continuous comparison rather than a series of unrelated examples.

## Content Outline

Structured as a "spectrum" from passive/cheap to powerful/expensive rendering techniques, with one recurring "thread demo" that reappears in a new form at each stage as a visual callback, culminating in a WebGPU-upgraded version at the end.

1. **Title / Cold Open** — thread demo already running full-bleed, no explanation yet.
2. **The Thesis** — stated above; visual: plain chat-answer mockup vs. thread demo as a real site.
3. **The Map** — preview of the spectrum (Video/GIF → CSS → Layout/Paint/Composite → Layout Animation → SVG → Canvas → WebGL → WebGPU); tells the audience to watch for the recurring demo.
4. **Baseline: Video & GIF** — pre-baked pixels, no interactivity; visual: thread demo as GIF and video side by side with file sizes labeled.
5. **CSS Transitions/Animations + Render Pipeline** — browser-managed motion; introduces Layout → Paint → Composite; visual: animated pipeline diagram + simple live hover/transition demo (generic, not the thread demo — keep this one legible).
6. **CPU vs. GPU: Compositing** — `transform`/`opacity` are GPU-cheap, `width`/`top`/`left` force layout ("jank"); visual: live side-by-side janky vs. smooth box animation with a measured FPS readout and an adjustable layout load.
7. **Layout Animation** — the technique that gets a layout-affecting change (grid to list, a reorder, a resize) to move smoothly without paying the layout cost slide 6 just demonstrated: measure the DOM before, measure it after, then animate only the cheap transform delta between the two — the FLIP technique. Anime.js's layout animation support (https://animejs.com/documentation/layout) does this natively off real measured DOM state rather than a hand-rolled FLIP implementation; visual: a real UI element — the thread demo's own technique-spectrum grid — reflowing between two very different arrangements, animated as one continuous move rather than a cut.
8. **When Motion Earns Its Place** — the restraint beat, placed here because the audience has just seen that motion has a cost. Covers what motion is *for* (feedback, continuity, attention, perceived speed, brand), when it backfires, and the frequency/intensity rule. See "Motion Craft & Restraint" below; visual: the same interaction shown three ways — no motion, well-judged motion, overdone motion — so the audience can feel the difference rather than be told.
9. **SVG Animation** — vector, DOM-based, path morphing; visual: thread demo as SVG — a low particle count (tens), each one a real DOM node, resolving into the brandmark via path morph/draw-on. Worth surfacing the DOM-node cost as the reason the count stays low.
10. **Canvas 2D** — imperative pixel drawing, CPU-bound, good for generative work; visual: thread demo in Canvas 2D at a visibly higher particle count (thousands), no DOM overhead.
11. **WebGL** — GPU shaders, real 3D; visual: thread demo in WebGL — tens of thousands of particles, now reactive to cursor, brandmark forming in 3D space.
12. **Same Tech, Different Surfaces (Beyond the Browser)** — same build outputs to broadcast graphics (OBS/CasparCG/Singular.live-style browser sources), digital signage (embedded-browser displays or baked video loops), programmatic ad creative (HTML5 templates + data swaps), and baked-for-social video (Remotion/Rive-style export); visual: four-panel of the thread demo as a broadcast lower-third, a billboard mockup, an ad template, and a vertical social video.
13. **WebGPU: The New Layer** — compute shaders enable particle/fluid sims and on-device ML at a scale WebGL can't reach; support has arrived, adoption hasn't; same WGSL code runs outside the browser too; visual: thread demo in WebGPU at a particle count the WebGL version couldn't sustain (hundreds of thousands to millions, simulated on the GPU) — the payoff of the whole callback chain.
14. **Building the Version Without It** — deliberately placed immediately after the most spectacular slide in the deck: here is the most impressive thing I can show you, and here is why you must also build the version that doesn't do any of it. Covers `prefers-reduced-motion`, the fallback ladder, and mobile as a design starting point rather than a cleanup pass. See "Accessibility & Reduced Motion" and "Fallbacks" below; visual: the same WebGPU scene shown at four rungs of the ladder — full compute sim, WebGL reduced, static poster frame, reduced-motion cross-fade — all four running side by side.
15. **Close: Full Circle** — recap thesis; visual: return to the opening hook shot of the thread demo in its most advanced form.

**Timing note:** at 15 slides this is now tight for 15-20 minutes (roughly 60-80 seconds per slide including demo watch time). The three new slides (7, 8, and 14) are the compressible ones — each can degrade to a spoken aside over the neighbouring demo, or move to a Q&A appendix, if the run-through goes long. Recommend building them as full slides and deciding after the first timed rehearsal, since they're the ones that most improve credibility with the technical half of the room.

## Motion Craft & Restraint

Content for slide 8. The through-line: motion is a communication tool with a cost, so it should be spent where it does work. "More animation" is not the same as "better experience" — the difference between a site that feels crafted and one that feels exhausting is almost entirely judgement about where motion goes.

**What motion is legitimately for.** Roughly six jobs, worth naming explicitly because they're the test for whether a given animation deserves to exist:

- **Feedback** — confirming something happened. A press, a submit, a drag landing. Without it users repeat actions or assume failure.
- **Continuity** — showing where something came from and where it went, so the user's spatial mental model survives the change. Expanding cards, shared-element transitions, drawers.
- **Attention** — directing the eye to what changed. Only works if one thing moves; several competing motions cancel out.
- **Perceived performance** — motion buys patience. A well-staged skeleton or progressive reveal makes the same wait feel shorter than a frozen screen does.
- **Meaning and state** — communicating relationship, hierarchy, loading vs. settled, valid vs. rejected.
- **Brand and feeling** — the experiential layer. This is the one the thesis of this talk is about, and also the one most easily overdone.

**When it backfires.** The failure modes are consistent enough to be a checklist:

- It sits between the user and their task — anything that gates interaction until an animation finishes
- It's on a high-frequency action — a 600ms flourish is charming the first time and infuriating the fortieth
- Several things move at once, so nothing reads as important
- Decorative motion next to text someone is trying to read
- It overrides expected behaviour (scroll-jacking is the canonical example)
- It signals nothing — movement with no meaning behind it, which is the definition of noise

**Rules of thumb worth knowing.** Heuristics rather than laws, but they're what separates motion that reads as considered from motion that reads as applied:

- **Duration.** Roughly 150-300ms for small UI feedback, 300-500ms for larger transitions. Past ~500ms functional UI starts to feel sluggish. Ambient/decorative motion plays by different rules and can be much slower.
- **Easing.** Things should decelerate as they arrive (ease-out) and accelerate as they leave (ease-in). Linear motion looks mechanical because nothing in the physical world starts or stops instantly.
- **Distance affects duration.** Something crossing the screen should take longer than something nudging 4px. Same duration for both looks wrong.
- **Reversibility.** If opening animates one way, closing should mirror it. Asymmetric enter/exit quietly breaks the mental model.
- **Causality.** Motion should originate from where the user acted, not from an unrelated edge of the screen.
- **One focal point per moment.** Motion needs hierarchy exactly like type does.
- **Frequency is inversely proportional to intensity.** This is the single most useful rule in the set: the more often an interaction happens, the more restrained its motion must be.

**Subtle vs. big — two different layers, not a spectrum of taste.**

- The **functional layer** is subtle, fast, and largely invisible when it's working. Its absence is what makes a product feel cheap; its presence is rarely consciously noticed. This is where most of the commercial value sits.
- The **experiential layer** is where big, authored, memorable motion belongs — entry points, hero moments, section transitions, moments of arrival. This is the layer that differentiates, and the one the thesis of this talk argues for.
- The two common mistakes are symmetrical: applying experiential-scale motion inside functional flows (exhausting, slow, obstructive), or shipping nothing but functional motion and then wondering why the site feels generic and forgettable.

**Where motion should and shouldn't go.** Good candidates: navigation and state changes, entry/hero moments, empty and loading states, moments of confirmation or delight, transitions between major contexts. Bad candidates: dense reading content, data tables, form fields mid-input, anything on a critical path where speed is the whole point, and anything a user will encounter dozens of times per session.

## Accessibility & Reduced Motion

Content for slide 14. Framed not as a compliance chore but as the thing that separates motion work that's actually professional from motion work that's just impressive.

- **`prefers-reduced-motion` is a stated preference, not an edge case.** It's an OS-level setting the user has already deliberately turned on. Ignoring it isn't a missed enhancement, it's overriding an explicit request.
- **The harm is physical, not aesthetic.** Large-area movement, parallax, scaling/zooming, and spinning are documented vestibular triggers and can cause genuine nausea and dizziness. Flashing content above ~3 times per second is a seizure risk (WCAG 2.3.1). This is the part worth stating plainly to a mixed audience, because the non-technical half generally hasn't heard it.
- **Reduced does not mean none — substitute rather than delete.** Transitions often carry meaning (this came from there; this replaced that), so stripping all motion can actively hurt comprehension. The better pattern is to swap travel for a cross-fade or an instant state change: keep the information that something changed, remove the movement through space.
- **Never gate content or function behind an animation completing.** The zero-motion path must be a complete, usable experience.
- **Give control over anything long-running.** WCAG 2.2.2 expects a pause/stop mechanism for motion running more than ~5 seconds, especially anything looping near text.
- **Motion competes for attention.** Relevant for cognitive load generally, and specifically for users with ADHD or cognitive disabilities — another reason the frequency/intensity rule matters.

## Fallbacks & The Degradation Ladder

Also slide 14. Principle: **build the static state first and layer motion onto it**, rather than building the rich version and stripping it back. Stripping back reliably produces broken intermediate states; layering up doesn't.

The ladder, top to bottom — each rung a complete experience in itself:

1. Full experience — WebGPU compute, high particle counts
2. Reduced — WebGL, lower counts, simpler simulation
3. Static poster frame — a rendered image, never a blank hole where a canvas failed
4. Reduced-motion variant — cross-fades and instant state changes, no travel

Practical notes:

- **Feature-detect, don't device-sniff.** Ask whether WebGPU exists, then WebGL, then fall through. Device/UA guessing ages badly.
- **Heavy scenes need a poster frame that shows first and upgrades once ready.** A blank rectangle during init reads as broken.
- **Pause when not visible.** `IntersectionObserver` for off-screen, `visibilitychange` for backgrounded tabs. Otherwise a GPU sim runs at full tilt on a tab nobody is looking at, burning battery and generating heat.
- **Respect the device's own signals.** `deviceMemory`, `hardwareConcurrency`, `navigator.connection.saveData` and battery state are all reasonable inputs for choosing a rung on the ladder.

## Mobile-First vs. Mobile-Friendly

Also slide 14 — the distinction is worth making explicitly because it changes what gets built.

- **Mobile-friendly** means designed for desktop and then made to survive on a phone. Motion gets scaled down or switched off as a cleanup pass.
- **Mobile-first** means the constrained case is the starting point: motion is designed to work within a small viewport, touch input, and a thermal/battery budget, then *enhanced* on capable hardware.

For motion specifically this matters more than it does for layout, for reasons worth naming:

- **There is no hover on touch.** Hover-driven motion simply doesn't exist for a large share of users. It needs a tap, scroll, or gesture equivalent, designed rather than inherited.
- **Thermal throttling and battery are real constraints.** A 60fps particle sim heats a phone, gets throttled, and visibly drains the battery — all things the user notices and attributes to the site.
- **Scroll-linked animation is the most common source of mobile jank**, and mobile scroll performance is far less forgiving than desktop.
- **Viewport chrome moves.** Address bars collapse and reappear, changing viewport height mid-scroll and breaking naively-built scroll and sticky animation.
- **Large-area motion occupies a bigger proportion of vision on a small screen**, which makes vestibular triggers *more* likely on mobile, not less.

Practical stance: design the motion system mobile-first — decide what's essential when there's no hover, little thermal headroom, and a small viewport — and treat heavy experiential motion as progressive enhancement for hardware that can carry it.

## Technical Approach

- **App shell: Svelte 5 + Bun.** Decided August 5, replacing the earlier React + Vite placeholder. Slide state as an index, optionally one route per slide for deep-linking/reload during rehearsal.
  - **Why Svelte 5 over React here.** Two reasons that are specific to this build rather than general preference. First, Svelte compiles away, so there is very little framework sitting between the code and the DOM — which matters when nearly every slide is manipulating transforms, canvases and measured geometry, and a framework re-render landing mid-animation is a real failure mode. Second, the design system is already ~1,100 lines of hand-written vanilla CSS (`design/system/tokens.css` + `components.css`) that has to come across untouched; Svelte takes plain CSS as-is. React's genuine strengths — shared state across a large tree, ecosystem depth — are the ones a linear slide deck needs least.
  - **Learning cost is accepted deliberately.** The presenter has not used Svelte before. With the date moved to the 21st this is a reasonable trade rather than a gamble, and it is confined to the shell: the demos are the risky part and they are mostly framework-agnostic (raw Canvas, Three.js, WGSL) by design. If Svelte turns out to be a fight, the shell is the cheapest layer in the build to rewrite.
  - **Bun** as runtime, package manager and bundler. Low risk for a static client-side app, and fast enough to keep the rebuild loop tight during rehearsal week.
  - **Not Tailwind.** The design system is token- and material-based vanilla CSS; a utility-first layer would fight it for no gain.
  - **Not Tauri or Wails.** Both use the *system* webview (WKWebView on macOS), which is a different WebGPU implementation from Chrome's. The whole WebGPU section is currently de-risked by the decision to present in Chrome, and particle counts are to be tuned against that target — a system webview reintroduces exactly that risk in exchange for a window without an address bar. If a desktop shell is ever genuinely wanted, Electron at least bundles Chromium so parity holds. For a talk on the presenter's own laptop, Chrome in fullscreen is the answer.
- **Navigation/fullscreen/preview:** native Fullscreen API, custom keyboard handlers, `BroadcastChannel`/`localStorage` sync for a speaker-view window.
- **Per-technique demo tooling** — deliberately native to each technique rather than one shared abstraction, so the tech shown matches the tech being explained:
  - CSS section: plain CSS transitions/keyframes
  - Layout Animation section: Anime.js's layout animation API (https://animejs.com/documentation/layout) — a FLIP implementation over real measured DOM state
  - SVG section: plain SVG + CSS, or Anime.js for scripted path-morphing
  - Canvas section: raw Canvas 2D API, or p5.js for faster iteration
  - WebGL section: Three.js, used directly rather than through a framework wrapper (the React Three Fiber option is dropped with the move off React; Svelte's equivalents are less mature and this build doesn't need one)
  - WebGPU section: Three.js's experimental `WebGPURenderer`/TSL, letting the WebGL and WebGPU demos share one codebase
  - Video/GIF section: native `<video>`/`<img>`; optionally `ffmpeg.wasm` or Remotion to bake the thread demo to video live on stage
- **JS animation, by default: Anime.js.** One library used deeply rather than several used shallowly — chosen over Framer Motion/GSAP so the deck's own tooling doesn't fragment. The only exceptions are WebGL and WebGPU, which need their own rendering pipelines (Three.js, WGSL) rather than a DOM animation library; everything else — SVG path work, the Layout Animation section, and the presentation chrome itself — runs on Anime.js.
- **Presentation chrome (not content):** the slide-to-slide transition is itself a layout animation — each slide's content measured before and after a navigation event and animated as one continuous move into its new arrangement, rather than a cut or a generic wipe. If it holds up under real slide content this is the detail that makes the deck's own chrome distinctive rather than merely competent: the same technique slide 7 explains, used to move between the slides explaining it. Kept conceptually separate from the technique demos so the audience isn't confused about which tech is doing what.

  **Three candidate implementations, to be prototyped against real slide content before one is chosen.** They solve the same problem by different mechanisms, and the differences are not cosmetic:
  - **View Transitions API** (`document.startViewTransition()` + `view-transition-name`) — the platform's own answer. Browser snapshots before and after and animates between them. Strongest thematic fit: a talk arguing the platform is capable enough to build crafted experiences, whose own chrome runs on the newest animation primitive the platform has. The usual objection is cross-browser support, and it does not apply here — the deck runs in Chrome on one known machine. **Current preference, added August 5.**
  - **Anime.js layout API** — already prototyped and working in the design harness (`design/layouts/index.html`). Known-good, but carries a hard constraint documented in Risks below: it is incompatible with a CSS-transform-scaled slide.
  - **Svelte's built-in `animate:flip`** — free with the framework choice above, worth an hour's evaluation on that basis alone, though it is the least proven of the three for whole-layout changes rather than list reordering.

  The reason to prototype rather than pick on paper: the transform constraint that broke the Anime.js version may or may not apply to the other two, and *that* is the deciding factor, not feel. Whichever wins, only one ships — the point of standardising on Anime.js for JS animation was to stop the deck's tooling fragmenting, and that logic applies here too. Plain cross-fade remains the fallback.

## Inspiration & Reference

**reactbits.dev** — an open-source library of 165+ animated React components (text effects, backgrounds, cursor/hover interactions, 3D), MIT + Commons Clause licensed. Useful here as a reference source, not a dependency: browse a category, then inspect the shipped component source (each one lands as plain, editable JS/CSS/TSX, no wrapper package) to extract the underlying motion technique.

- **Text animations** (reactbits.dev/text-animations) are the most directly applicable category — split-reveal, blur-in, shuffle/decrypt, scramble, shiny/gradient-sweep effects are close to the register a slide title or section kicker wants. One real constraint: reactbits' text components are built on GSAP (`gsap` + `@gsap/react`), which conflicts with this deck's "Anime.js, by default" decision (see Technical Approach) — the practical move is to study the effect and port the underlying technique to Anime.js, not drop the GSAP source in wholesale, so the deck's own tooling doesn't fragment.
- **Background Studio** (reactbits.dev/tools/background-studio) is a visual editor for shader-driven ambient backgrounds — pick an effect, tune it live, export as video, image, code, or a shareable URL. The exported components use `ogl` (a lightweight WebGL library) directly rather than GSAP/Anime.js, so it falls under the same exception already carved out for WebGL/WebGPU's own rendering pipelines rather than creating a new one. Plausible fit: a full-bleed ambient backdrop for the Title/Cold Open or Close slides, tuned in the tool and vendored in as a starting shader. Not yet decided which slide, if any — flagging as an open question rather than committing a slide to it.

## Architecture Considerations

- Browsers cap concurrent WebGL contexts (~16); running many demos at once across slides risks crashing the tab over a 15-20 minute talk. Mount/unmount each demo so only the active slide's demo is live (or isolate via `<iframe>` if a demo needs harder isolation).
- Presenting on Chrome, so WebGPU should run natively — but a recorded fallback clip is still produced for that section, since it's the one piece with no graceful degradation path.
- Particle counts per stage need tuning on the actual presenting hardware, not just in development. The whole callback structure depends on each stage visibly out-scaling the last; if the WebGL stage is tuned too high or the WebGPU stage too low, the payoff flattens.

## Dependencies

- **Brand/style guide** — supplied separately; needed before chrome build begins
- **Brandmark asset** — vector/SVG path data for the logo, since the particle system needs to target its geometry
- **Presenting machine confirmed** — Chrome, presenter's own hardware; particle counts tuned against it

## Risks & Open Questions

- **Timeline is no longer the primary risk, but the failure mode it protects against hasn't changed.** Twelve working days is comfortable for the build. What the extra time does *not* automatically fix is the real hazard: demos that each work in isolation but were never tuned to escalate against each other, or chrome polish absorbing the last days. Get all demos rough and sequenced first, then polish — the same order that was right at four days, now with slack to actually follow it.
- **The new primary risk is scope creep into the design system.** The extra fortnight makes it easy to keep refining the reference harness (which is already well past what the talk needs) instead of building the app. The design system is a means to the deck, not the deliverable.
- **Runtime.** 15 slides in 15-20 minutes leaves little slack. Slides 7, 8, and 14 are designated compressible (see Timing note in the outline), but that decision needs a timed rehearsal to make, not a guess.
- **Rehearsal time is unscoped.** Reserve at least the two days before the 21st for running the talk end-to-end on the real machine, separate from build. This was the right call at four days and it doesn't get less important with more of them.
- **Unfamiliar framework.** Svelte 5 is a deliberate learning choice (see Technical Approach) and the risk is contained — the shell is the cheapest layer to rewrite and the demos are largely framework-agnostic. The thing to watch is runes-specific reactivity surprises landing mid-animation. Build one real slide end to end early, before committing the other fourteen to the pattern.
- **Evidence caveats:** the AI-traffic-decline data is directionally solid but contested by Google; state it as "multiple studies show," not as settled fact.
- **Slide 14 demands extra build work.** Showing four rungs of the degradation ladder side by side means actually building the reduced, static, and reduced-motion variants — not just describing them. Worth it (it's the credibility slide), but it's the one place where the talk's content and the app's engineering overlap most expensively.
- **The deck should practice what slide 14 preaches.** A talk that argues for `prefers-reduced-motion` support and then ignores it in its own chrome undercuts itself if anyone checks. Low cost to honour it in the presentation app; worth doing.
- **Layout-animation-driven slide transitions are the highest-upside, least-proven build item.** Genuinely distinctive if it works — a deck whose own navigation demonstrates the technique it's teaching — but "animate real slide layouts into each other" has more surface area for visual bugs (overlapping text mid-transition, wrong measured state after a fast double-advance) than a standard slide/fade. Prototype this early against real slide content, not a toy example, and keep a plain cross-fade as a fallback transition if it doesn't hold up under rehearsal.
- **Anime.js's layout animation is incompatible with a CSS-transform-scaled slide, which is the obvious way to fit a fixed-size slide to the window.** During a transition it takes each element out of flow and sets `position: fixed; left: 0; top: 0` plus a `translate` of the measured screen-space delta. A `transform` on any ancestor both re-roots that fixed positioning (a transformed element becomes the containing block for fixed descendants) and scales the translate, so elements fly to the wrong place and snap back at the end. Found and reproduced in the design harness — see the transition preview on the layouts page, which is rendered at true 1:1 for exactly this reason. **This shapes the app's architecture**: either size slides responsively so no scale transform is needed, or scale via a mechanism that doesn't create a containing block, or accept the cross-fade fallback. Decide this before building the chrome, not after. Note that the layout grid is currently specified in fixed pixels quantised to a 6px LED cell (see `design/layouts/index.html`), which assumes a fixed-size slide — so "size slides responsively" is not a free swap and needs its own decision. **This is also the sharpest test to run against the other two transition candidates**: if View Transitions or `animate:flip` tolerate a scaled ancestor, that alone likely decides which one ships.

## Out of Scope

- CMS/backend — this is a static, client-side app
- Cross-browser support beyond the presenting machine/browser (build for what will actually run the demo, not general production compatibility)
- Mobile/responsive layout for audience devices — this is presenter-driven, not self-serve

## Success Criteria

- Every animation category is demonstrated as real running code, not a description or recording
- Each stage of the thread demo visibly out-scales the one before it, so the escalation is felt rather than asserted
- A non-technical audience member can afterward explain, in plain terms, why some animation is smooth and some is janky
- The audience leaves with judgement, not just appetite — able to say where motion belongs and where it doesn't, not only that it's possible
- The talk closes having made the thesis concrete: the site's value is the craft, not the content