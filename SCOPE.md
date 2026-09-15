---
presenter: Key Clark
presented: 2026-09-17
drafted: 2026-08-03
revised: 2026-09-15
---

# Web Animation & Motion — Presentation Scope

## Overview

A tour through web animation and motion, built and delivered as a custom interactive app (not slides) so every example is real, running code rather than a screenshot or description. Ends on WebGPU, framed as an underused frontier with applications beyond the browser.

## Objective / Thesis

As AI becomes a universal interface for searching, synthesizing, and experiencing information, reference content — specs, policies, contact details — increasingly gets consumed directly inside a chat session rather than on a site. What that ephemeral AI-generated display can't replicate is a crafted experience: a unifying hub for a brand's digital presence, its media and creative, its social content. That's where a website's comparative advantage now lives — not as a repository of content, which can be distributed anywhere, but as a living, authored space that only exists as itself. Motion, animation, and interaction are the craft that makes that possible.

**Supporting premises (fact-checked, see Notes on Evidence below):**
- Multiple independent studies show declining click-through from AI-mediated search to informational content sites — directionally solid, though Google disputes the aggregate magnitude and effects vary by query type.
- Motion/experiential design as a proven *business* differentiator is a real craft trend but thin on rigorous business-impact data — framed here as a craft/attention argument, not a claimed ROI stat.
- WebGPU has real browser support now but negligible real-world adoption — "untapped frontier" is accurate for usage, not availability.
- WebGPU/WGSL genuinely runs outside the browser (Dawn, wgpu/Rust powering real game engines) — this is the most solidly evidenced claim of the four.

### The second thesis — the one the room actually has to act on

The argument above is about *why* this work is worth doing. It is aimed at the room at large. There is a second argument underneath it, aimed at the engineers, and it is the one a team takes back to work on Monday.

**Showing that something is possible is no longer the hard part.** A striking demo is cheap now, and AI assistance makes it cheaper — these techniques can be vibe-coded into existence in an afternoon. What is *not* cheap, and what a team actually needs from an engineer who has done this, is the discipline around it: **how to build this kind of work so that it is responsible, observable and debuggable — a reliable service rather than an experiment that happened to ship.**

So the deck is not a gallery of what is possible. It is eight techniques, each shown as real running code, and then a closing argument about **working inside constraints and requirements instead of exploring freely without concern**. The demos earn the right to make that argument; the argument is what the demos are for.

**The obstacles that argument is built from** — named here as the shape, not yet as slides, because the details of each need working out rather than theory-crafting:

- **Performance and optimisation** — the cost of a technique, measured rather than asserted, and what you do when it is too expensive.
- **Responsiveness** — not a cleanup pass. See "Mobile-First vs. Mobile-Friendly".
- **Adapting the experience across what users actually have** — web, devices, platforms. Some concerns are shared across every one of the eight techniques; others are specific to a single platform, and telling those two apart is most of the work.
- **Observability and debuggability** — how you know what a demo is doing, and how you find out why it is not, when the thing on screen is a shader or a canvas buffer rather than a DOM tree.
- **Degradation as a requirement, not a fallback** — already covered by the ladder and by reduced motion; this closing section is where it stops being an accessibility footnote and becomes an engineering contract.

**This reframes what the deck has to demonstrate about itself.** If the close argues for observable, debuggable, constrained work, then the app delivering the talk is the first exhibit — and every measured number in it is part of the argument rather than a nicety. That is already the repo's standing rule ("measured, not claimed"); this thesis is the reason for it.

## Motion Craft & Restraint

The restraint beat. The through-line: motion is a communication tool with a cost, so it should be spent where it does work. "More animation" is not the same as "better experience" — the difference between a site that feels crafted and one that feels exhausting is almost entirely judgement about where motion goes.

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

Framed not as a compliance chore but as the thing that separates motion work that's actually professional from motion work that's just impressive.

- **`prefers-reduced-motion` is a stated preference, not an edge case.** It's an OS-level setting the user has already deliberately turned on. Ignoring it isn't a missed enhancement, it's overriding an explicit request.
- **The harm is physical, not aesthetic.** Large-area movement, parallax, scaling/zooming, and spinning are documented vestibular triggers and can cause genuine nausea and dizziness. Flashing content above ~3 times per second is a seizure risk (WCAG 2.3.1). This is the part worth stating plainly to a mixed audience, because the non-technical half generally hasn't heard it.
- **Reduced does not mean none — substitute rather than delete.** Transitions often carry meaning (this came from there; this replaced that), so stripping all motion can actively hurt comprehension. The better pattern is to swap travel for a cross-fade or an instant state change: keep the information that something changed, remove the movement through space.
- **Never gate content or function behind an animation completing.** The zero-motion path must be a complete, usable experience.
- **Give control over anything long-running.** WCAG 2.2.2 expects a pause/stop mechanism for motion running more than ~5 seconds, especially anything looping near text.
- **Motion competes for attention.** Relevant for cognitive load generally, and specifically for users with ADHD or cognitive disabilities — another reason the frequency/intensity rule matters.

## Fallbacks & The Degradation Ladder

Principle: **build the static state first and layer motion onto it**, rather than building the rich version and stripping it back. Stripping back reliably produces broken intermediate states; layering up doesn't.

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

The distinction is worth making explicitly because it changes what gets built.

- **Mobile-friendly** means designed for desktop and then made to survive on a phone. Motion gets scaled down or switched off as a cleanup pass.
- **Mobile-first** means the constrained case is the starting point: motion is designed to work within a small viewport, touch input, and a thermal/battery budget, then *enhanced* on capable hardware.

For motion specifically this matters more than it does for layout, for reasons worth naming:

- **There is no hover on touch.** Hover-driven motion simply doesn't exist for a large share of users. It needs a tap, scroll, or gesture equivalent, designed rather than inherited.
- **Thermal throttling and battery are real constraints.** A 60fps particle sim heats a phone, gets throttled, and visibly drains the battery — all things the user notices and attributes to the site.
- **Scroll-linked animation is the most common source of mobile jank**, and mobile scroll performance is far less forgiving than desktop.
- **Viewport chrome moves.** Address bars collapse and reappear, changing viewport height mid-scroll and breaking naively-built scroll and sticky animation.
- **Large-area motion occupies a bigger proportion of vision on a small screen**, which makes vestibular triggers *more* likely on mobile, not less.

Practical stance: design the motion system mobile-first — decide what's essential when there's no hover, little thermal headroom, and a small viewport — and treat heavy experiential motion as progressive enhancement for hardware that can carry it.
