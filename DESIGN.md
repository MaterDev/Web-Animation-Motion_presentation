# Design & Architecture — Presentation App

**Companion to:** [SCOPE.md](./SCOPE.md) — this document supplies the "brand/style guide" and app architecture that SCOPE.md lists as a build input (SCOPE.md §Format & Delivery, §Dependencies).

**Scope of this doc:** the presentation *application* — its visual language, motion system, architecture, and feature set. Not the slide content. Slides are built against placeholder content first; real content lands later.

**Confidence notation:** claims marked `⚠︎ VERIFY` are from working knowledge and have not been source-checked. Confirm before relying on them for anything load-bearing (particularly exact typeface names and hex values).

---

## Revision — where this actually landed (5 Aug 2026)

This document was written **before** the six treatments were built, and it did its job: it set the problem, the constraints, and the starting direction. Building against it then changed four things materially. Rather than silently rewriting the original — the treatments only make sense as a record if the brief they were answering is still legible — the deltas are stated here, and the affected sections below carry pointers back to this one.

**1. The premise moved from "instrument housing" to "content on an LED panel."** Part 0 proposed a machined instrument enclosure. Five treatments in, the stronger idea turned out to be that a slide *is a display*: an emissive dark ground with a visible pixel matrix, rather than a printed card sitting in a metal case. The housing survives as the app's chassis — top bar, bezels, plates — but the slide surface itself is a screen. This produced the `.led-slide` / `.screen-unit` components and the rule that governs both: **on-screen elements are emissive graphics and glass; chassis materials (moulded plastic, chamfers, knurl, wells) stay off the screen.**

**2. The grid is quantised to that panel's pixel matrix.** §1.3's "12-column grid with a wide gutter" is superseded. See §1.3 for the replacement: 12 × 6 square modules on a 160 × 90 cell matrix, no gutter, every dimension a whole number of LED cells.

**3. Dot-matrix went from a garnish to the headline face.** §1.2 restricts it to readouts — "numbers and short codes only." That was the right instinct for a *dot* face at projection distance, and wrong once the ground became a pixel screen. See §1.2 for the current rule, including the ROND-axis trap that cost real time.

**4. Motion collapsed to one curve.** Seven decorative curves were tried and cut. See Part 2.

**5. There are two displays, and which one you use is a rule, not a preference.** See below — this is the single most load-bearing thing to get right, and the easiest to get backwards.

**Kept treatment:** T-06 (Field Unit, dark). The other five are still in `design/treatments/` and viewable in the app at `/design/treatments`.

### The two displays

Every surface in this system is one of two screens. They are not interchangeable, and using the wrong one is the fastest way to make something look off-brand.

| | **LCD** — reflective | **LED** — emissive |
|---|---|---|
| Ground | backlit green (`--lcd-ground-top/bot`) | near-black (`--led-ground`) |
| Ink | dark green (`--lcd-ink`, `--lcd-dim`) | light (`--led-ink`, `--led-dim`) |
| Texture | fine pixel grid + a diagonal sheen | 6px cell matrix + edge vignette |
| Components | `.lcd-chip`, `.well` › `.lcd`, `.lcd-panel`, `.lcd-*` | `.led-slide`, `.screen-unit` / `.screen-face` |
| **Used for** | **readouts inside the app** — see the sizing rule below | **the deck's slides**, and only those |

The reasoning is literal rather than aesthetic: **the app is the instrument, and the slides are what the instrument outputs.** An instrument's own chrome is its readout panel — reflective, backlit, dark ink, the thing you look *at*. What it drives is an emissive display — the thing you look *through*, in a dark room, from the back. Build a slide out of the LCD and it stops reading as a projected image.

#### How much LCD — the part that's easy to overdo

A screen is only legible as a screen if the things around it aren't. Wrapping every card in `.lcd-panel` was tried and reverted: the whole app went one continuous green and the display stopped meaning anything.

**Reach for the small form first.**

- **`.lcd-chip` — the default.** A datum on its own little screen: a code, a count, a status, a small pixel graphic. Lives inside an otherwise ordinary chassis card. This is the workhorse.
- **`.lcd-panel` — earns its place.** Justified for exactly three things: a **hero with significant display-scale type**; a **callout** that wants to be read as an instrument talking back; and a **block of genuinely display-like content** — pixel art, an illustration, a cluster of readouts, a small chart. Not for general cards.
- **Nested sub-panels** inside a larger `.lcd-panel` are fine and good — a group of related values, each in its own recessed area, the way a weather or stats readout is laid out. That's a display showing structured data, which is what it's for.

The tell that you've overdone it: two adjacent LCD panels with ordinary prose in them and nothing display-like about either. The tell that you've got it right: the green reads as *lit*, because everything near it isn't.

**Type inside an LCD doesn't all have to be pixel.** The dot face is for headers, values and labels. Sentences on an LCD ground are set in the normal sans at LCD ink colour — a paragraph in a dot-matrix face is the same illegibility problem §1.2 has always warned about, just on a green background.

#### The readout vocabulary

Whichever size you're using, carry the furniture a real readout carries — that furniture *is* the aesthetic:

- **`.lcd-kv`** — key/value pairs (`MODEL / WAM-2026`, `SLIDES / 15`). Both halves in the dot face: on a real readout the label is printed by the same matrix as the value, and setting the label in a different family is the tell that it's a web page pretending.
- **`.lcd-strip`** — the row those sit in, along the bottom of a panel.
- **`.led` inside `.lcd`** — status lamps, automatically flattened to screen content (no dome, no bloom). Same rule as slides: indicators drawn on a screen are graphics, not hardware.
- **`.lcd.sm` / `.lcd.strip` in a `.well`** — small standalone readout chips (`12:04`, `06/14`, `RUNNING`), for data that belongs on its own little screen rather than inside a bigger one.
- **`.lcd.amber`** — the caution backlight. A *second* backlight colour, so it means over-time or fault, never decoration.
- **`.wash`** — tints the backlight itself rather than painting over it, so a tinted panel still reads as the same screen.

`/design/reference?sheet=gfx` is the closest existing example of this vocabulary used properly, and is the reference to match.

---

## Part 0 — Design Thesis

### The problem with the reference set

Four references were given: **Teenage Engineering**, **Nothing**, **clear-era Nintendo** (Game Boy Color Atomic Purple, N64 Funtastic), and the **iMac G3**. They are not one aesthetic. They split cleanly in two:

| | Teenage Engineering / Nothing | Clear Nintendo / iMac G3 |
|---|---|---|
| Mood | Austere, technical, adult | Playful, toy-like, friendly |
| Color | Monochrome + one rationed accent | Saturated candy tints |
| Type | Precise grotesque, lowercase, dot-matrix | Chunky, rounded, marketing-led |
| Material | Anodised aluminium, matte plastic, bare PCB | Tinted transparent polycarbonate, gloss |
| Attitude | "This is an instrument" | "This is not scary" |

Naively blending them produces mush. But they share one deep commonality, and it's the thing worth building on:

> **All four make the machine visible.** Pocket Operators ship as a bare circuit board. Nothing puts the coils and screws behind a transparent back. The Atomic Purple Game Boy shows you its own board. The iMac G3 was explicitly designed so you could see inside a computer and stop being afraid of it.

That is exactly the argument this talk is making — *stop describing the technique, show the running machine.* The design language and the thesis are the same idea.

### The resolution: instrument housing + exposed internals

The reconciliation is to give each half a **job**, not a percentage.

- **The chrome is the housing.** Monochrome, precise, technical, quiet. Teenage Engineering and Nothing own this layer entirely. Greyscale, hairline rules, dot-matrix and mono labels, alphanumeric slide codes, dimension marks. It never competes with the demo.
- **The content is the exposed internals.** This is where the Nintendo/iMac candy palette lives — as **tinted translucent panels** through which you see the working demo, and as **one saturated section colour per technique**.

Crucially, colour is then **informational, not decorative** — a Dieter Rams / Teenage Engineering principle rather than a Nintendo one. Each of the seven techniques on the spectrum owns a tint. The audience learns the colour code implicitly over 14 slides, so by the WebGPU payoff they know where they are on the ladder without reading a label. That satisfies both halves of the reference set honestly:

**Candy palette, applied with Swiss discipline.**

### Reflexive constraint (non-negotiable)

SCOPE.md §Risks, final bullet: *"A talk that argues for `prefers-reduced-motion` support and then ignores it in its own chrome undercuts itself if anyone checks."*

The app is itself evidence for slides 7 and 13. Therefore:

- Every chrome animation honours `prefers-reduced-motion`.
- Chrome motion obeys the frequency/intensity rule from SCOPE.md §Motion Craft — slide advance happens ~14 times in 20 minutes and must stay restrained; the cold open happens once and can be lavish.
- No chrome animation gates interaction. Pressing `→` twice fast must land on slide 3, never queue or block.
- The static state is built first and motion layered on (SCOPE.md §Fallbacks).

---

## Part 1 — Visual Language

### 1.1 Colour

**Space:** OKLCH throughout. It is perceptually uniform, so a lightness ramp reads as evenly stepped where the equivalent HSL ramp does not, and section tints at equal `L` and `C` genuinely feel equally bright. Chrome-only target (SCOPE.md §Format) means no fallback stack is needed.

#### Housing (greyscale)

Dark-first. Pure `#000` is avoided for the base — it kills the sense of a lit surface and makes elevation impossible to express through lightness. The darkest value is a near-black with a very slight cool cast, which reads as anodised metal rather than as void.

```css
--hz-000: oklch(0.14 0.006 265);  /* deepest — app backdrop */
--hz-050: oklch(0.18 0.006 265);  /* stage surround */
--hz-100: oklch(0.22 0.007 265);  /* panel */
--hz-200: oklch(0.28 0.008 265);  /* raised panel */
--hz-300: oklch(0.36 0.008 265);  /* hairline / divider */
--hz-400: oklch(0.48 0.008 265);  /* disabled text */
--hz-500: oklch(0.62 0.007 265);  /* secondary text */
--hz-600: oklch(0.75 0.005 265);  /* body text */
--hz-700: oklch(0.88 0.004 265);  /* emphasis */
--hz-800: oklch(0.96 0.002 265);  /* headline */
--hz-900: oklch(0.99 0.000 265);  /* pure — the display, LED-on */
```

Elevation is expressed by **lightness step, not drop shadow**. Shadows on a dark UI read as smudge; a lighter surface reads as closer to the light. Where a shadow is used it is a hairline top highlight plus a wide, very low-opacity ambient — the way a moulded plastic edge catches light.

#### Signal accent — one, rationed

Nothing's discipline: a single accent, used almost never, which is exactly what makes it land. `⚠︎ VERIFY` Nothing's exact red hex.

```css
--signal: oklch(0.62 0.24 27);   /* alert red */
```

Reserved for: recording state, an error boundary firing, the reduced-motion indicator when active, and the "you are over time" state in the presenter timer. **Not** for hover, focus, or general emphasis. If it appears more than twice in a run-through, something is wrong.

Teenage Engineering's signature orange `⚠︎ VERIFY` (the Computer-1 case, the OP-1 lineage) is deliberately *not* the accent here — it becomes the WebGL section tint instead, where it does informational work.

#### Section tints — the candy layer

One per rung of the spectrum, ordered so that **chroma and lightness climb with capability**. The cheap techniques are desaturated and dim; WebGPU is the brightest, most saturated thing in the deck. The palette itself performs the escalation argument.

| # | Section | Token | Value | Reference |
|---|---|---|---|---|
| 0 | Video / GIF | `--tint-video` | `oklch(0.55 0.03 265)` | N64 "Smoke" — near-grey, deliberately inert |
| 1 | CSS | `--tint-css` | `oklch(0.68 0.13 235)` | GBC Atomic Purple's blue cast |
| 2 | Composite | `--tint-composite` | `oklch(0.72 0.16 195)` | N64 Ice Blue |
| 3 | SVG | `--tint-svg` | `oklch(0.75 0.18 145)` | N64 Jungle Green |
| 4 | Canvas | `--tint-canvas` | `oklch(0.80 0.17 95)` | iMac Lime |
| 5 | WebGL | `--tint-webgl` | `oklch(0.74 0.19 55)` | iMac Tangerine / TE orange |
| 6 | WebGPU | `--tint-webgpu` | `oklch(0.70 0.26 320)` | iMac Grape / Atomic Purple — peak chroma |

`⚠︎ VERIFY` These are *derived from* the named products, not sampled from them. If exact fidelity matters, sample from reference photography and re-fit to the ramp.

The active tint is published as `--tint` on the stage element, so every component styles against one variable and the whole app re-skins on slide change:

```css
/* derive states from the single tint — no hand-authored variants */
--tint-dim:    color-mix(in oklch, var(--tint) 25%, var(--hz-000));
--tint-glow:   color-mix(in oklch, var(--tint) 60%, transparent);
--tint-text:   oklch(from var(--tint) 0.88 calc(c * 0.4) h);
```

#### Contrast

Body text (`--hz-600` on `--hz-100`) clears WCAG 2 AA. The genuine risk in a technical-grey palette is annotation text — the small mono labels are the most on-brand element and the easiest to make illegible. **Hard floor: no text below `--hz-500`, ever, at any size.** `--hz-400` is for disabled states and non-text marks only.

Second consideration specific to this project: it is being projected. Projectors crush blacks and wash mid-tones badly. `--hz-000` through `--hz-100` may collapse into one another on the actual hardware. **Action: test the ramp on the real projector during Thursday's rehearsal** (SCOPE.md §Risks flags rehearsal as unscoped — this is one more reason to book it).

### 1.2 Typography

Three roles, three faces. The tension across the reference set is resolved by giving each face a strict job.

#### Display / headline — the grotesque

Set **lowercase**, which is the single most recognisable Teenage Engineering signature: their product names, site, and UI are near-uniformly lowercase, and it reads as calm and matter-of-fact rather than shouty.

- Ideal: `ABC Diatype`, `Suisse Int'l`, or `Söhne` — all commercial licences.
- **Recommended (free):** **Inter** (OFL) — a neo-grotesque explicitly designed for screen UI, variable, with the optical-size and feature set needed here. `rsms.me/inter`
- Alternate with more character: **Space Grotesk** (OFL) — quirkier, slightly more "technical instrument".

Tighten tracking on large sizes; grotesques set at display size need negative tracking to avoid looking gappy.

#### Technical / label — monospace

This carries the whole "instrument" read. Every annotation, slide code, timer, readout, and axis label.

- **Recommended (free):** **JetBrains Mono** (OFL) or **Geist Mono** (OFL, Vercel). Both have the slightly-condensed, high-x-height, unambiguous character set that reads as engineering equipment.
- Alternates: IBM Plex Mono (OFL, warmer), Martian Mono (OFL, wider/louder), Berkeley Mono (commercial, arguably the best fit for this aesthetic).

Always with `font-variant-numeric: tabular-nums` — the timer must not jitter as digits change width, and it will if this is omitted.

Set uppercase with generous positive tracking for labels (`0.08em`–`0.12em`), lowercase for anything longer than a few words.

#### Dot-matrix — the Nothing layer

Used sparingly and only where a physical device would have a segment or matrix display: the slide counter, the presenter timer, the section indicator.

- Nothing's own face is **`Ndot`** `⚠︎ VERIFY` — believed to have been publicly released free by Nothing. Verify name, availability, and licence before shipping it. Their broader identity typeface is a 5×7-grid dot-matrix system. `⚠︎ VERIFY`
- **Free fallbacks (Google Fonts, OFL):** **Doto** — a variable font literally constructed from dots, the closest open match to the Nothing look. Also **Silkscreen**, **DotGothic16**, **Departure Mono**, **Micro 5**.

**Restraint note:** dot-matrix is illegible below a certain size and exhausting in quantity. It is a *readout* face — numbers and short codes only. Never body text, never anything the audience must read quickly.

> **⟲ Revised — see the Revision section at the top.** The restraint note above is now half right and half wrong, and the split matters.
>
> **Wrong:** dot-matrix is no longer a garnish. Once the ground became a pixel screen, a hairline grotesk was the one thing a dot-matrix panel physically cannot render — so **every `h1` and every `.sec-head h2` is Doto**, at display and head sizes. It's the headline face, not a readout accent.
>
> **Still right, and now a stated rule:** it hands off below 4 cells. The scale is **five sizes, all whole LED cells** — display 72px (12 cells), head 48px (8), sub 24px (4), body 18px (3), micro 12px (2) — with Doto at display and head, mono at sub and micro, and sans for body. Below head size at projection distance the dots stop resolving, which is exactly the failure mode the original note predicted.
>
> **The ROND trap.** Doto is variable on two axes: `wght`, and `ROND` where **0 = square pixels and 100 = round dots**. This system wants square — round dots read as a dot-matrix *printer*, not an LED matrix. This bit hard: while the fonts were loaded from a Google Fonts URL requesting `Doto:wght@...` only, the ROND axis wasn't in the file, so a `font-variation-settings: 'ROND' 100` sitting in the CSS was silently inert and everything rendered square by default. Self-hosting the full variant exposed the axis, that setting took effect for the first time, and every headline on the site quietly turned round. **Always self-host the `full` variant and always state `'ROND' 0`.**

#### Scale

Fluid via `clamp()`, but note this app has an unusual constraint: **it targets one machine at one resolution, projected.** So fluid type is a convenience during development, not a responsive requirement (SCOPE.md §Out of Scope excludes responsive layout). The more important axis is that **slide type must be legible from the back of a room** — which means the floor for body copy is considerably higher than web-normal. Baseline assumption: minimum ~24px effective body, headlines 64px+. Validate by standing at the back of the actual room.

### 1.3 Grid & Layout

> **⟲ Superseded for the slide surface — see below.** The 8px base unit and the named-preset rule still hold for app chrome and are still correct. The 12-column-with-gutter stage grid is replaced by the LED-matrix grid at the end of this section.

Swiss modular grid, made **visible** — the blueprint/technical-drawing read.

- **Base unit: 8px**, with 4px permitted for optical adjustment only.
- **12-column grid** on the stage with a wide gutter; slide layouts are named presets (`full-bleed`, `split`, `stack`, `quad`, `title`) referenced by data, never ad-hoc.
- **Hairlines everywhere.** 1 device pixel, which on a retina/high-DPI presenting machine means a sub-pixel value, not `1px`. Use `0.5px` at 2× or a scaled `box-shadow` — a literal `1px` border will look chunky and wrong.
- **Margin annotation.** The stage carries technical-drawing furniture in the housing greyscale: corner registration crosshairs, a slide code (`06 / 14 · COMPOSITE`), tick marks on the progress rail. This is the single highest-leverage detail for the aesthetic and it costs almost nothing.

A faint dot grid or rule grid sits behind content at very low opacity, snapping the eye to the module:

```css
background-image: radial-gradient(var(--hz-300) 0.5px, transparent 0.5px);
background-size: 8px 8px;
opacity: 0.14;
```

#### The slide grid, as built — a Swedish modular grid quantised to the LED matrix

Two ideas that only work together. Swedish modernist layout discipline gives the compositions their structure; the LED matrix gives that structure a reason to land on exactly these numbers rather than arbitrary ones. **The grid unit is a whole number of LED cells, so nothing in a composition can fall between pixels.**

| Unit | Value | In cells |
|---|---|---|
| stage | 960 × 540 | 160 × 90 — the matrix |
| cell | 6px | 1 — one LED pixel |
| margin x / y | 48 / 54 | 8 / 9 |
| field | 864 × 432 | 144 × 72 |
| module | 72 × 72 | **12 × 12 — a true square** |
| grid | 12 × 6 | **no gutter** |

`12 × 72 + 48 + 48 = 960` and `6 × 72 + 54 + 54 = 540`, exactly. Change one value and the rest have to be re-derived.

Three rules come out of this and are worth stating separately, because they're what make it read as Swedish rather than merely gridded:

- **No gutter.** Columns butt directly together and spacing is made by *leaving a module empty*. Every gap in every composition is therefore exactly one module, guaranteed by structure rather than by remembering a number. A gutter would also put fractional cells between columns and break the one rule everything rests on.
- **The margin is composition, not leftover.** 8 and 9 cells is a lot of empty edge for a 16:9 frame. The void is an active element that gives type somewhere to sit; only a deliberate full-bleed layer crosses it.
- **Asymmetry by default.** Content takes a subset of the columns and the rest is deliberately empty.

**Live reference:** `/design/reference?sheet=lay` — the grid with guides, the type scale, all 15 compositions, and the transition preview.

**Constraint discovered in build, not in theory:** because the grid is specified in fixed pixels, a slide is a fixed size, and **a CSS `transform: scale()` on a slide breaks Anime.js's layout animation** (it re-roots the `position: fixed` the library uses mid-transition and scales the translate). Scaling a fixed-size slide to the window is the obvious way to build presenter chrome, so this shapes the app's architecture. Recorded in SCOPE.md's risk list.

### 1.4 Surface & Material — the exposed-electronics layer

This is where the design either lands or becomes generic glassmorphism. The difference matters and is worth stating precisely.

**Glassmorphism** is a uniform blur with a white overlay and a light border. It reads as frosted glass and, by now, as a 2020 design trend. **Tinted transparent polycarbonate** — Atomic Purple, Funtastic Grape, Bondi Blue — reads differently because:

1. The tint is **saturated and coloured**, not white — it colours what's behind it rather than fogging it.
2. Transmission is **uneven**. Real moulded plastic has thick and thin sections, so the tint density varies across the panel. A flat uniform blur is the giveaway.
3. There is a **hard specular edge** — a bright, tight highlight on the top/left edge where the moulding catches light, not a soft 1px white border.
4. **You can actually see through to something.** Glassmorphism blurs an abstract gradient. This aesthetic requires real internals behind the panel — the running demo, a PCB trace pattern, component silhouettes.

Recipe:

```css
.panel-clear {
  background:
    linear-gradient(160deg,
      color-mix(in oklch, var(--tint) 22%, transparent),
      color-mix(in oklch, var(--tint) 9%, transparent) 45%,
      color-mix(in oklch, var(--tint) 18%, transparent));
  backdrop-filter: blur(12px) saturate(1.6);
  border-radius: 10px;
  box-shadow:
    inset 0 1px 0 oklch(1 0 0 / 0.28),      /* specular top edge */
    inset 0 0 24px color-mix(in oklch, var(--tint) 14%, transparent),
    0 24px 60px oklch(0 0 0 / 0.5);
}
```

Plus a **grain/noise overlay** at very low opacity across the whole app. Real moulded plastic is never perfectly smooth, and a trace of noise is what stops the UI looking like flat vector art. Cheap and disproportionately effective.

**Where the internals come from:** the "visible components" behind the panels should be honest, not decorative. Candidates, in order of preference:
1. The live demo itself, dimmed and blurred behind a chrome panel.
2. A PCB trace pattern generated from the actual slide graph — nodes are slides, traces are the navigation paths.
3. Rendered component silhouettes (capacitors, ICs, a ribbon cable along the progress rail).

Option 2 is the good one. It makes the deck's own structure the circuit board, which is on-thesis.

### 1.5 Iconography & Technical Annotation

Teenage Engineering's manuals are the reference: isometric line drawings, numbered callouts, dimension lines, almost no prose.

- **Pictograms, not icons.** Geometric, single-weight stroke, drawn on the 8px grid, no rounded-friendly corners.
- **Alphanumeric codes.** Every slide gets one (`SL-06`), every demo gets one (`TD-WEBGL`, matching the thread demo naming). Displayed in mono. This is pure TE and it makes the deck feel like equipment.
- **Dimension and leader lines** for callouts on diagram slides — hairline with tick terminals, the annotation offset on a horizontal leader.
- **Dashed construction lines** to indicate the inactive or planned state (a not-yet-visited slide, a disabled degradation rung).

---

## Part 2 — Motion System

The app is a talk *about* motion. Its own motion is under audit.

### 2.1 The two layers, applied to this app

Directly from SCOPE.md §Motion Craft:

**Functional layer** — fast, subtle, near-invisible. Slide advance, nav hover, panel open, presenter-view updates, focus rings. Happens constantly; must be restrained.

**Experiential layer** — authored, memorable, rare. The cold open (slide 1), the section-change moment when the tint shifts, the WebGPU reveal (slide 12), the close. Happens a handful of times; earns the flourish.

The failure mode to avoid is precisely the one SCOPE.md names: applying experiential-scale motion to slide advance. Advancing happens ~14 times in 20 minutes plus rehearsal — probably 200+ times before the talk is delivered. It must be *fast*.

### 2.2 Duration tokens

```css
--dur-instant: 90ms;    /* focus, press feedback */
--dur-fast:    160ms;   /* hover, toggle, small state */
--dur-base:    240ms;   /* slide advance ← the important one */
--dur-slow:    420ms;   /* panel/overlay, overview grid */
--dur-section: 700ms;   /* section tint change — experiential */
--dur-hero:    1400ms;  /* cold open, WebGPU reveal — once each */
```

Slide advance at **240ms** is deliberate. It reads as immediate and responsive rather than as an effect. Anything past ~300ms here will feel sluggish by the fifth rehearsal, and *that* is the number to trust — a transition that delights on first view and irritates on the fortieth is failing the frequency/intensity rule.

**Distance scales duration.** The overview grid zoom travels much further than a slide advance and should take longer; same duration for both looks wrong.

### 2.3 Easing tokens

The aesthetic is *instrument*, not *toy*. That means **sharp, decisive, slightly overshoot-free** curves. Springs and bounce read as playful and belong to a different brand.

```css
/* Material 3 emphasized set — sharp attack, long settle. ⚠︎ VERIFY exact values */
--ease-standard:    cubic-bezier(0.2, 0.0, 0.0, 1.0);
--ease-decelerate:  cubic-bezier(0.05, 0.7, 0.1, 1.0);   /* entering */
--ease-accelerate:  cubic-bezier(0.3, 0.0, 0.8, 0.15);   /* exiting */

/* mechanical — near-linear with hard stops. For readouts, counters, meters. */
--ease-mechanical:  cubic-bezier(0.4, 0.0, 0.2, 1.0);
```

Rules, from SCOPE.md §Motion Craft:
- **Enter decelerates, exit accelerates.** Things arrive gently and leave briskly.
- **Reversibility.** Back must mirror forward exactly. Asymmetric slide transitions quietly disorient — and this presenter will hit back during Q&A.
- **Causality.** Forward moves content leftward/inward; back reverses it. The direction must map to the key pressed.
- **One focal point.** During a slide transition, the chrome does not also animate. Either the content moves or the chrome does — never both.

CSS `linear()` is available (Chrome-only target) for any curve needing multiple inflections — a mechanical stepper or a segment-display flicker. Not needed for standard transitions.

> **⟲ Revised — see the Revision section at the top.** Two corrections from build.
>
> **Springs were wrong to exclude.** "Springs and bounce read as playful and belong to a different brand" holds for *bounce*, and doesn't for a damped spring settle. Apple's Liquid Glass is spring-driven throughout, and a mass-on-a-spring response has more inflections than four bezier control points can express — so `--ease-liquid` is authored with `linear()` and is now the system's most-used curve. The set is **seven curves and that is the ceiling**: past this nobody holds them in their head and they start getting picked by feel.
>
> ```css
> --ease-detent:    cubic-bezier(0.34, 1.28, 0.64, 1.0);  /* sprung mechanisms only — slight overshoot */
> --ease-ballistic: cubic-bezier(0.16, 0.84, 0.28, 1.0);  /* meters and needles — damped, no overshoot */
> --ease-liquid:    linear(…);                            /* morph, settle, AND every ambient loop */
> ```
>
> **Motion is not a differentiator.** An intermediate pass gave each of the seven technique sections its own idle signature — breathe, settle, drift, reveal, flicker, tilt, pulse. It read as seven unrelated widgets rather than one family, and it was cut entirely. **Every ambient loop anywhere in the system now runs `--ease-liquid`, unchanged** (`.liquid-idle` / `.liquid-fill` in components.css). Differentiation between sections is carried by graphic elements only — colour, shape, pattern, rule treatment, type — never by bespoke motion. A reader should not be able to tell two contexts apart by how something moves, only by how it looks.
>
> The remaining variation is *compositional*, not topical: parts of a single mark stagger so they don't move in lockstep, using the same positional rule for all seven topics.
>
> **`prefers-reduced-motion` needs handling twice.** The global CSS rule in `tokens.css` only reaches CSS animations and transitions. Anything JS-driven — the Anime.js layout transitions, any autoplay loop — has to check `matchMedia` explicitly, or it keeps moving for exactly the users this deck argues hardest about.

### 2.4 Slide transition

Default is a **cross-dissolve plus a short directional translate** — roughly 24px, not a full-width slide. Full-width travel is large-area movement, which is both a vestibular trigger (SCOPE.md §Accessibility) and visually exhausting at high frequency.

Section changes get more: the tint shift propagates across the chrome over `--dur-section`, so crossing from Canvas to WebGL is *felt*. This is the deck's own escalation device and it is worth the cost because it happens six times, not two hundred.

**View Transitions API** is viable here (Chrome-only) and is the right tool for shared-element continuity — e.g. the thread demo persisting across a transition, or a slide thumbnail expanding out of the overview grid. Worth using for those two cases specifically; the plain transition doesn't need it.

### 2.5 Reduced motion

Substitute, don't delete (SCOPE.md §Accessibility):

```css
@media (prefers-reduced-motion: reduce) {
  /* keep the state change legible, remove travel */
  --dur-hero: var(--dur-base);
  --dur-section: var(--dur-base);
}
```

- Slide transitions become a pure cross-fade — no translate. The audience still sees *that* something changed.
- Ambient chrome motion (the idle pulse on the record indicator, any looping background) stops entirely.
- The thread demo drops to the reduced-motion rung of the ladder.
- **A visible indicator appears in the chrome when reduced motion is active** — because the presenter will want to demonstrate this live during slide 13. This turns an accessibility feature into a demo asset.

### 2.6 Performance

- Animate **`transform` and `opacity` only** in the chrome. The deck cannot afford chrome-induced jank during a talk whose slide 6 is literally about jank.
- `will-change` applied narrowly and removed after — a permanently promoted layer costs memory, and with WebGL contexts already competing (SCOPE.md §Architecture) that matters.
- Chrome animation must not run while a demo is initialising. A heavy WebGL mount will drop frames; overlapping a transition with it guarantees a visible stutter at exactly the wrong moment. **Sequence: transition completes → demo mounts.**

---

## Part 3 — Architecture

### 3.1 Principle: data and UI are separate

Per your direction. Three layers, strictly:

```
DECK DATA  ──▶  RUNTIME  ──▶  UI / CHROME
(what)          (state)        (how it looks)
```

- **Deck data** is plain, serialisable, JSX-free. A slide is a data structure. It could be authored by a non-developer, generated, or loaded from JSON.
- **Runtime** owns navigation state, step state, timing, sync, and demo lifecycle. It knows nothing about visual design.
- **UI** renders data via named layouts and renders chrome. It holds no deck content.

The payoff: slide content can be reordered, rewritten, or cut on Thursday night without touching component code — which matters given SCOPE.md's 4-day timeline and the explicit note that slides 7 and 13 may be cut after a timed rehearsal.

### 3.2 Slide schema

```ts
type Isolation = 'inline' | 'iframe';

interface Slide {
  id: string;                 // stable, URL-safe: 'webgl'
  code: string;               // display code: 'SL-10'
  section: SectionId;         // drives the tint
  title: string;
  kicker?: string;

  /** HTML string — injected into the layout's content region. */
  body?: string;

  /** Reference into the demo registry. Resolved at render, never imported here. */
  demo?: {
    id: string;               // 'td-webgl'
    props?: Record<string, unknown>;
    isolation?: Isolation;    // default 'inline'
    poster?: string;          // fallback image — shown on error or during init
  };

  layout: 'title' | 'full-bleed' | 'split' | 'stack' | 'quad' | 'statement';
  steps?: number;             // incremental builds within the slide
  notes?: string;             // speaker notes (HTML)
  budgetSeconds?: number;     // planned pacing, drives the rehearsal timer
  compressible?: boolean;     // SCOPE.md marks slides 7 and 13 as cuttable
}
```

`body` as an HTML string is what you asked for, and it does the job for prose slides. But **an HTML string cannot host a live Three.js demo** — which is the entire point of this deck. Hence the `demo` reference: content stays declarative data, while live code is resolved through a registry.

```ts
// registry — the ONLY place data meets code
export const demos = {
  'td-svg':    () => import('../demos/ThreadSvg'),
  'td-canvas': () => import('../demos/ThreadCanvas'),
  'td-webgl':  () => import('../demos/ThreadWebgl'),
  'td-webgpu': () => import('../demos/ThreadWebgpu'),
  // ...
} satisfies Record<string, () => Promise<{ default: DemoComponent }>>;
```

Lazy imports mean a demo's code isn't even parsed until its slide is near — which keeps startup fast and keeps Three.js out of the initial bundle.

**Sanitisation:** `body` HTML is authored by you, not user input, so this is not a security boundary. But it is injected via `dangerouslySetInnerHTML`, so a malformed string can break the render. Validate the deck at load with a schema check that fails loudly in dev.

### 3.3 The frame

Hybrid, per the default I flagged earlier:

- **`inline` (default).** The slide renders into the stage element in the main document. Fast, shares fonts and tokens, transitions are trivial, React state is available.
- **`iframe` (opt-in per slide).** A sandboxed document. Reserved for the heavy WebGL/WebGPU demos.

The iframe path exists to solve a real, named risk: SCOPE.md §Architecture flags that browsers cap concurrent WebGL contexts at ~16 and that exhausting them crashes the tab mid-talk. An iframe gets its own context budget and, more importantly, **tearing down the iframe reliably reclaims the GPU resources**, which manual Three.js disposal often does not do completely. For a 20-minute live talk with no second take, that reliability is worth the plumbing.

Cost, stated honestly: tokens and fonts must be injected into each frame, and cross-frame transitions are harder. Mitigation is to treat the iframe as opaque during transition — cross-fade the frame element itself rather than its contents.

### 3.4 Demo lifecycle — the reliability spine

This is the most failure-prone part of the app and deserves explicit design.

```
    idle ──▶ preloading ──▶ mounted ──▶ running ──▶ disposing ──▶ idle
                                  └──▶ errored ──▶ poster
```

Rules:
- **Only the active slide's demo runs.** Never more than one live WebGL context.
- **The next slide's demo preloads** (module fetched, poster shown) but does not initialise a context.
- **Disposal is mandatory and verified.** Every demo exports a teardown; the runtime asserts in dev that context count returns to baseline.
- **Every demo is wrapped in an error boundary that falls back to its poster frame.** SCOPE.md §Fallbacks: "a blank rectangle during init reads as broken." A crashed demo must degrade to a still image, silently, mid-talk. The presenter keeps talking and nobody knows.
- **Pause on hidden.** `visibilitychange` and `IntersectionObserver` — a GPU sim must not run full-tilt behind the presenter view.

### 3.5 Presenter sync

`BroadcastChannel` between the audience window and the presenter window, with `localStorage` as reconnect backup.

- One window is **authoritative** (whichever has focus / was opened first); the other mirrors. Prevents a split-brain where both think they're leading.
- Messages are minimal: `{ slideIndex, step, timerState, blanked }`.
- **Reconnect is essential.** If the presenter window is closed or the channel drops mid-talk, the audience window must keep working standalone. It must never block waiting for a peer.

---

## Part 4 — Feature Set

Everything a presenter reaches for reflexively. Grouped by build priority.

### Must-have

| Feature | Notes |
|---|---|
| Keyboard nav | `→ ↓ Space PgDn` next · `← ↑ PgUp` prev · `Home/End` first/last |
| Jump to slide | Type a number + `Enter` |
| Fullscreen | Fullscreen API, `F` |
| Incremental builds | Steps within a slide; forward/back walks steps then slides |
| Presenter view | Second window: current, next, notes, timers, clock |
| Timers | Elapsed, per-slide, and pacing vs. `budgetSeconds` |
| Deep links | `/#/webgl/2` — survives reload during rehearsal. Critical on a 4-day build |
| Blank screen | `B` black, `W` white — standard presenter reflex, cheap to build |
| Progress rail | Slide position, section markers, tick marks |
| Error boundary → poster | Per §3.4. Non-negotiable for a live talk |
| Reduced-motion honour | Per §2.5 |

### Should-have

| Feature | Notes |
|---|---|
| Overview grid | `O` or `Esc` — thumbnails, click to jump. Invaluable in Q&A |
| Help overlay | `?` — shortcut list. You will forget your own bindings under pressure |
| Perf HUD | FPS/frame-time. **Slide 6 needs this as content anyway** — build once, use twice |
| Reduced-motion toggle | Force it on/off from the chrome. **Slide 13 demo asset** |
| Degradation-rung switch | Force WebGPU/WebGL/static/reduced. **Slide 13 shows four rungs side by side** |
| Autoplay / loop | For the kiosk and billboard panels on slide 11 |
| Safe mode | Boot flag disabling all live demos, posters only. Insurance |

Note the pattern: three "app features" are also **slide content**. Building the perf HUD, the reduced-motion toggle, and the rung switcher as real chrome features means slides 6 and 13 largely build themselves. SCOPE.md §Risks calls slide 13 "the one place where the talk's content and the app's engineering overlap most expensively" — this is how that cost gets recovered.

### Nice-to-have

Laser pointer / cursor spotlight · on-screen annotation · PDF export · slide-change sound (a Pocket-Operator-style click — very on-brand, likely too cute) · remote clicker mapping (most present as PgUp/PgDn, so likely free).

### Explicitly out

Editing UI, CMS, multi-deck management, audience-facing responsive layout (SCOPE.md §Out of Scope), cross-browser support beyond Chrome.

---

## Part 5 — Conventions

### Element identification

Per global project rules: **`data-testid`, never `id`.** Kebab-case, scoped to the component; root element of every component, every interactive element, every content landmark. List items keyed by stable data (`slide.id`), never by index.

```tsx
<div data-testid='slide-stage'>
  <nav data-testid='deck-nav'>
    <button data-testid='deck-nav-prev' />
    <button data-testid='deck-nav-next' />
  </nav>
  {slides.map(s => <button key={s.id} data-testid={`overview-slide-${s.id}`} />)}
</div>
```

Reusable components expose a `testId?: string` prop and derive children from it. Self-contained components use hardcoded constants.

### File structure

```
src/
  design/      tokens.css, reset.css, type.css   — no components
  deck/        slides.ts, sections.ts            — data only, no JSX
  runtime/     useDeck, useSync, useTimer, demoRegistry, lifecycle
  ui/          Stage, Chrome, PresenterView, Overview, layouts/
  demos/       ThreadSvg, ThreadCanvas, ThreadWebgl, …  — lazy-loaded
```

The dependency rule: `deck/` imports nothing. `runtime/` imports `deck/`. `ui/` imports both. `demos/` is reached only through the registry. Any import that violates this is a design bug.

---

## Part 6 — Build Order

Deliberately sequenced so the app is *presentable* early and improves, rather than being complete only at the end. SCOPE.md §Risks names the real failure mode: "chrome polish eating the day before the talk."

1. **Skeleton** — Vite + React + TS, tokens, reset, type scale. Placeholder deck of 14 stub slides carrying the real titles and sections.
2. **Runtime** — navigation, steps, deep links, keyboard. Ugly but complete. *The deck is now navigable end to end.*
3. **Chrome v1** — stage, progress rail, slide codes, section tints. The design language lands here.
4. **Presenter view** — sync, notes, timers. *Rehearsal becomes possible — do this before demos, not after.*
5. **Demo harness** — registry, lifecycle, error boundaries, posters, iframe isolation. Proven with one throwaway demo.
6. **Demos** — per SCOPE.md, rough and sequenced first, then tuned to escalate against each other.
7. **Polish** — hero moments, section transitions, material detail. **Time-boxed and abandonable.**

Steps 1–4 are roughly a day and produce a working presentation tool with placeholder content. That is the useful checkpoint: from there, every remaining hour goes into content and demos rather than infrastructure, and there is always a deliverable state.

---

## Open Questions

1. **Brandmark asset.** SCOPE.md §Dependencies needs Folklore vector path data for the particle target. It should also drive the app's own identity — a loading state that assembles the mark from particles would tie chrome and content together for near-zero extra cost.
2. **Typeface licensing.** If commercial faces (Diatype, Suisse, Söhne, Berkeley Mono) are available under an existing Folklore licence, they meaningfully raise the ceiling. Otherwise Inter + JetBrains Mono + Doto is a genuinely strong free stack.
3. **Existing Folklore brand guide.** SCOPE.md §Format says one is to be supplied. If it exists, it outranks this document — this is a proposal, and the section-tint system in particular should be checked against real brand colour before it's built.
4. **Projector test.** The dark palette and hairline details are the two things most likely to fail on real projection hardware. Book time.
5. **Nothing's `Ndot` licence.** Flagged `⚠︎ VERIFY` — confirm before shipping it.
