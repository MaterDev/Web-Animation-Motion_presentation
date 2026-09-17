---
presenter: Key Clark
presented: 2026-09-17
drafted: 2026-08-03
revised: 2026-09-17
---

# Web Animation & Motion

## Overview

This paper was made for my employer, [`Folklore Digital`](https://folklore.digital/). It is the long form of a 35-minute talk given there on 17 September 2026. The talk is in plain language for a mixed room. The paper keeps the detail the talk leaves out. Anyone who wants to go further can use the live site, where every example runs as real code.

There are three layers, and each is compressed from the one before it:

- **The paper** holds the full argument, its evidence and its sources. Where the paper and the talk differ, the paper is the record.
- **The talk** is the compression: one point per slide, with the depth in the speaker notes. Citation markers on slides use this paper's bibliography numbers.
- **The site** holds the tear sheets. Each technique section below links to its sheet, which opens in a new window.

**Where this comes from.** For about the last nine months, the work between design and engineering kept raising the same question: how do you make better animation and motion possible, not as a one-off but as something a team can repeat? This paper grew out of those projects, experiments and pit stops. It is a report from practice, not a proposal. Everything in the project, the examples included, was built with AI assistance. That matters for the closing argument.

**How to read it.** Each section puts the plain version first and the technical detail after it. Data is stated as fact, with a source. Conclusions are offered as readings and labelled as readings. Where we do not know something, we say so. The tear sheets follow one house rule, **measured, not claimed**: a number appears only with the instrument that produced it and that instrument's limits. The paper holds itself to the same rule, and [Notes on evidence](#notes-on-evidence) explains how.

## Why now

**The data.** In the first four months of 2026, 68.01% of US Google searches ended without a click. The figures come from Similarweb's desktop and mobile-web panel, analysed by SparkToro.<sup>[[1]](#ref-1)</sup> In the same study, the share of searches that produced any click at all fell 9.51 points between 2024 and 2026, a relative decline of 22.9%. That metric counts every click, including clicks on ads and on Google's own properties, so it is not a measure of publisher traffic.<sup>[[1]](#ref-1)</sup>

Studies that compare searches with and without an AI summary all find fewer clicks when the summary appears:

- Pew found people clicked a traditional result in 8% of visits with a summary, against 15% without one.<sup>[[2]](#ref-2)</sup>
- Ahrefs measured a 58% lower click-through rate for the top-ranked page.<sup>[[3]](#ref-3)</sup>
- The size of the effect varies by method, and at least one tracker shows the gap narrowing in 2026. The decline has slowed, though click-through is still below where it was before AI summaries.<sup>[[4]](#ref-4)</sup>

**What is disputed.** Google disputes the aggregate picture, not just its size. It says total organic clicks from Search to websites have been "relatively stable year-over-year" and calls reports of dramatic declines inaccurate. The post does not publish a dataset.<sup>[[5]](#ref-5)</sup> The two claims measure different things. Independent studies measure click-through per search; Google describes total volume. Both can be true at once. What is consistently measured is that fewer clicks follow a search when an AI summary answers it.

**The reading.** This part is a reading, not a finding: if the web stops being where people go for answers, it becomes where they go for experiences. A chat can summarise what a page says. What it cannot deliver is **authored sequence**: someone decided what you see, in what order, and how it feels when it arrives. That is not a nicer version of the same thing. It is a different product, and the techniques in this paper are how you build it.

Whether people want those experiences is left open on purpose.

## Decoration vs. infrastructure

From outside, a developer's interest in animation can look like an aesthetic hobby. It is not. **It's not visual interest, it's systems work that happens to be visible.**

- **Decoration** is a one-off added on top. Nobody owns it, it inherits nothing, it ages out, and it gets approved once, as a cost.
- **Infrastructure** is something the rest of the work depends on and builds from. It keeps paying.

A well-built website is already an instance of a design system: colour, type and spacing come from tokens, and components inherit them. Motion that lives outside that system is an orphan. It cannot inherit anything or be updated centrally, so every sweeping change becomes a hand-edit across every instance. Motion built inside the system behaves like any other token: change it once and the change propagates everywhere.

Most of what follows hangs off this distinction: cost per change, portability, motion driven from a CMS, and composites.

**Who owns it.** Vercel describes the *design engineer* as "a new role that is gaining popularity".<sup>[[6]](#ref-6)</sup> That is one company's account, not a measured trend, and the job title is not the argument. The argument is cost per change. Neither discipline is enough alone, but when motion is a system that generates assets rather than a single asset, it needs someone who can build that system and has the taste to tune it.

## The question to carry

This question is planted here and answered at the end, in [Getting it across the line](#getting-it-across-the-line).

The techniques that follow can produce things that are easy to admire. The natural question is how any of it actually gets made. Keep a narrower version in mind while reading:

> *Could I describe this well enough for someone else to build it? Would I need to point, or sketch?*

## The techniques

### Why this order

The techniques run **Layout / CSS → SVG → GIF → Video → Canvas → WebGL and WebGPU**, followed by Composite as the closing argument.

This is a **comprehension ladder, not a cost ladder.** It starts with CSS and layout because everyone already understands a page, so everyone can follow the discussion from there. It climbs through Canvas into WebGL and WebGPU, which non-developers often cannot tell apart. "Complexity" here means complexity to the reader, not rendering cost. Cost is discussed at every step; it just does not set the order. Earlier drafts ran cheap to expensive (Video and GIF first, WebGPU last). The new order is deliberate, so do not "correct" it back.

**The count.** There are seven techniques, with WebGL and WebGPU counted separately. On stage there are six stops, because WebGL and WebGPU are presented together. Composite is not a technique. Scroll-driven animation and View Transitions are left out: both fall inside categories already covered (scroll-driven animation is CSS), so adding them would break the taxonomy rather than extend it. JavaScript is not a technique here either. It runs through several of them.

### Two confusions to clear

**What it looks like.** Canvas and CSS can look identical to someone who doesn't know what to look for. So can a simple shape drawn in CSS and one drawn in SVG. Each section below says plainly what the technique is not, what the difference is, and when you would reach for it.

**What happens underneath.** Two animations that look the same can do very different work. One might run on the CPU and the other on the GPU. One might run on the page's main thread and the other off it. One might block the next paint while the other doesn't, and they can load and cache differently.

This matters to the organisation, not just to engineers. Designers work from reference galleries without knowing which technique a site used. Engineering pushes back late, on performance grounds, after someone is already attached to the design, and there is no shared vocabulary to catch the mismatch early. **The core argument: move performance analysis to the front of the process.** At the end, performance is a diagnosis. At the start, it is a constraint that shapes what is worth building. The vocabulary problem shows up live in meetings: a suggestion to "render it on the GPU so it doesn't block the main thread" can land as arcane.

**Inspection tools, named so they are familiar before they come up in a meeting.** These are where the dev team adds to the *what*.

- **DevTools Performance panel** records a stretch of time and shows what the browser did in it: scripting, layout, paint and compositing.
- **Paint flashing** highlights, in green, any part of the screen being repainted.<sup>[[47]](#ref-47)</sup>
- **Layers panel** shows how the page is split into layers for compositing.<sup>[[48]](#ref-48)</sup>
- **Flame chart** is a view of the performance recording. Wide bars are where time went.
- **Lighthouse** is an automated page audit. By default it simulates a slower device.<sup>[[45]](#ref-45)</sup>
- **PageSpeed Insights** runs Lighthouse against a URL and adds field data from real Chrome users.<sup>[[53]](#ref-53)</sup>

### Layout / CSS

<a href="/sheets/techniques/css.html" target="_blank" rel="noopener">Tear sheet SL-06 · Layout / CSS ↗</a>

**Plain version.** You already know this one. It is the most accessible way to add motion to a website, and the team already uses it, or inherits it through frameworks and kits. A newspaper is fixed by its medium, but a page is not. CSS is the least expensive way to use that difference: it turns static content that reads like print into a page that moves.

**Two jobs on one engine.** The sheet shows CSS doing two different things:

- **Animating structure.** *Timeless* is a fictional newsweekly, and its magazine layout runs no JavaScript at all.
- **Drawing.** A liquid-metal effect (metaballs) comes from `filter: blur(11px) contrast(26)`, a moiré from `mix-blend-mode: difference`, and holographic type from a `conic-gradient` clipped to the text. The drawing half is where the one flagged JavaScript exception lives: the aperture card uses a few lines to move the scrollbar.

The drawing half lands harder with an audience because it is unfamiliar.

**Good at:** it is free and works everywhere. It is also the only rung where the platform still does the layout work for you.

**Costs:** the rendering pipeline. Every change passes through up to four stages: *style → layout → paint → composite*. The sheet explains each stage and what it costs.

**The compositor, and the one portable term.** The compositor is the final assembly step. The browser splits the page into layers and paints each one into its own image. The compositor stacks those images, applies movement and transparency, and hands the frame to the screen.

Think of each layer as a photo the browser has already taken. Sliding the photo across the desk, or laying tracing paper over it, does not change the photo. Making it wider or recolouring something inside it means taking a different photo. And if the size changed, everything next to it shuffles too, so layout runs again.

That is why `transform` and `opacity` are **the two properties browsers reliably hand to the compositor**. Changing either one skips layout and paint entirely.<sup>[[7]](#ref-7)</sup> (The source dates from 2015. Engines have extended compositing since then, but these two are the portable rule.) This is the one piece of technical vocabulary that is genuinely portable: a designer can use it, and it is correct.

Every other surface has its own version of the same mistake:

| Surface | What ruins it |
| --- | --- |
| CSS | animating geometry (`width`, `top`, `left`) instead of `transform` |
| SVG | quantity: every shape is tracked individually |
| Canvas | switching drawing state constantly, and drawing the same pixels over and over |
| GPU | asking it a question: reading results back stalls the frame. Also, many small draw calls where a batch would do |

The lesson is the same across all of them: **the expensive thing is interrupting the machine's flow.**

#### The Web Animations API — CSS animation with a remote control

This is a call-out inside CSS, not an eighth technique.

**What it is.** The Web Animations API (WAAPI) lets JavaScript create animations in the same animation model that CSS Transitions and CSS Animations are defined in.<sup>[[11]](#ref-11)</sup> The call `element.animate(keyframes, timing)` returns an `Animation` object.<sup>[[8]](#ref-8)</sup> That object can play, pause, reverse and cancel, and it exposes a `finished` promise.<sup>[[9]](#ref-9)</sup> Its `currentTime` can be read and also *set*, which is how you seek.<sup>[[10]](#ref-10)</sup><sup>[[11]](#ref-11)</sup>

**What it is for.** Timing computed at runtime, staggers driven by data, knowing exactly when an animation has finished, and interrupting a sequence cleanly.

**A correction to how this is usually told.** The standard example is a side nav that, when closed halfway through opening, jumps to the end and reverses from there. That failure is real, but **not for CSS transitions.** The CSS Transitions spec anticipates interruption. An interrupted transition reverses from its current value, and its duration is shortened to match.<sup>[[12]](#ref-12)</sup> A nav built on `transition` already resumes correctly. The failure belongs to `@keyframes` animations swapped by class, which is how most multi-step and choreographed motion gets written.

Here is the failing version, which is typical of choreographed menus:

```css
.nav         { transform: translateX(-100%); }
.nav.open    { animation: nav-in  400ms ease-out forwards; }
.nav.closing { animation: nav-out 400ms ease-in  forwards; }

@keyframes nav-in  { from { transform: translateX(-100%); } to { transform: translateX(0); } }
@keyframes nav-out { from { transform: translateX(0); }     to { transform: translateX(-100%); } }
```

Close it 150 ms into opening and `nav-out` starts from its own first keyframe, fully open. The panel snaps to the end, then slides away. Nothing in the CSS knows it was mid-flight. On screen this is **pop-in**, and it reads as broken, not fast.

The same motion with WAAPI:

```js
const nav = document.querySelector('[data-testid="side-nav"]');
const slide = nav.animate(
  [{ transform: 'translateX(-100%)' }, { transform: 'translateX(0)' }],
  { duration: 400, easing: 'ease-out', fill: 'both' }
);
slide.pause(); // closed, at time 0

async function setOpen(open) {
  slide.updatePlaybackRate(open ? 1 : -1); // same animation, either direction
  slide.play();                            // continues from wherever it is now
  await slide.finished;                    // a real "done", for focus and state
  nav.inert = !open;
}
```

Close it at 150 ms and it runs backwards from 150 ms. It is one animation object with one timeline, and the object always knows where it is.

**Cost.** WAAPI uses the same animation model as CSS, so there is nothing extra to ship. The only cost is that JavaScript has to have loaded. Page transitions are where interruption matters most, because the transition window is exactly when people click again.

In the talk, only the menu behaviour comes up, not the API.

### SVG

<a href="/sheets/techniques/svg.html" target="_blank" rel="noopener">Tear sheet SL-10 · SVG ↗</a>

**Plain version.** SVG is graphics as instructions: not a picture you load, but a drawing the browser performs at runtime. That suits it to work where the shapes come from information rather than from an artist, such as data visualisation, maps and small icons. Each shape is a real element on the page, so it can be styled, animated and inspected like anything else.

**CSS vs. SVG.** People conflate the two because a simple shape looks identical either way. The difference is this: **CSS animates what's there; SVG lets you define what's there.** CSS moves elements that already exist, such as boxes, text and layout. In SVG the shape itself is what you describe, so you can draw arbitrary forms and change them point by point. The difference only shows when a shape has to be generated from data or morphed into something else.

**Costs:** quantity. The browser tracks every shape individually, and that sets a real ceiling on complexity. The GPU section below comes back to this ceiling.

**The sheet.** A diagram of AI history built from a real dataset: thirty events and twenty-two sourced movements of people between institutions, from 1943 to 2024. The diagram fails to show the second AI winter, because people kept changing institutions straight through it, and the page says so. That is *measured, not claimed* applied to its own example.

A camera bench on the sheet tests three ways of driving the view. All three land within noise of each other. The only control that moves the number is the hairline strategy: the inverse stroke-width row writes 88 values per frame. The sheet states its instrument caveats; see [Notes on evidence](#notes-on-evidence).

### GIF

<a href="/sheets/techniques/gif/index.html" target="_blank" rel="noopener">Tear sheet SL-05 · GIF ↗</a>

**The format on its own terms.** GIF just works, everywhere, with no code: put it in an `<img>` and you are done. The costs are these:

- It is pre-baked pixels with no controls, and a viewer cannot pause it.
- It cannot respect a reduced-motion setting unless you swap the file.
- It has a 256-colour palette, so smooth gradients have to be approximated. Banding is the visible result.

**It is the one format that takes the decision away from you.**

**What GIFs can be for.** Most people meet GIFs as memes. The sheet treats them as **icons and living assets inside a real UI**: a sticker staged in four product contexts, and a roster of eight agents as animated identity cards. Measured, the eight roster files are 41,907 to 83,502 bytes each, with six image frames apiece. (The sheet's own copy currently says otherwise and is being corrected; the method is in [Notes on evidence](#notes-on-evidence).)

For clients, **GIFs can be made from assets they already have.** Existing video, 3D or motion work can become GIFs that decorate or enable a site.

**The part people miss.** These GIFs come out of a rendering pipeline: six generator modules on the sheet produce them. The asset is not a file someone made once. It can be edited at the source: change a value and re-bake. This is the cost-per-change argument on the humblest format there is. Even a GIF can be an output rather than an artefact, if the infrastructure behind it exists.

### Video

<a href="/sheets/techniques/video/index.html" target="_blank" rel="noopener">Tear sheet SL-04 · Video ↗</a>

**Plain version.** Video is the cheapest way to put motion on a screen, and the only pre-baked format a viewer can stop. Its cost is that it is fixed. Put more sharply: **video can't respond**, not to a cursor, a scroll or a click. Once motion has to respond, video is not the cheaper option; it is not an option at all.

**The sheet.** NOVA-7 is a fictional handheld device. Its footage was baked by a custom software rasteriser written for the project (`gen/bake-video.mjs`), with a depth buffer, per-pixel Fresnel reflection, 3× supersampling and a loop where the last frame hands off exactly to the first. The vertical 9:16 cut, at 720×1280, is **generated, not cropped**: a separate render, not a slice of the landscape master. An effects rack runs live on the decoded frame, and one decode is keyed across seven green-screen scenes.

**Three uses the agency has not tried, and could:**

1. **Filters on captured video.** Effects applied to a live camera feed, closest to Instagram-style filters. This is a different product from playback, built with the same family of techniques.
2. **Computer vision on video or live streams.** Not shown on the sheet, but an adjacent possibility.
3. **Video as a component, not "a video".** This is the one people miss. Footage shot against green screen can be keyed so that what remains is layered into the page and reads visually as part of it. Video does not have to mean a YouTube embed or a cinematic piece. **The video is not the content, it's a material.**

#### Cost per change

A static asset is a finished artefact. If someone wants slower timing or a different colour, someone else opens the source, re-renders, re-exports and re-uploads, so each revision costs roughly what the first did. In a living system, the things you would want to change are exposed as parameters, and the same request becomes a value edit and a reload.

**The cost is payroll, not invoice.** Designer hours and coordination, multiplied by rounds of revision, hide inside salaried time. The expensive shape, from practice: a 3D product animation for Scotty Cameron where every revision round was a redo.

The deciding question: *is this a one-off asset, or a system that generates assets?* If it is a system, engineering with taste is the right owner.

#### Portability

The render target is a detail, not the project. The same code and the same brand language can leave as any of these:

- a live page;
- HD video, a YouTube cut or a vertical social spot;
- a broadcast overlay (OBS's browser source is, in its own words, "quite literally, a web browser"<sup>[[14]](#ref-14)</sup>);
- native.

Any of these techniques can simply be captured as rendered video.

The contrast with After Effects settles it. A rendered file is inert: its intelligence is gone the moment it exports, and nothing in it is data you can manipulate. Shader and canvas work stays live. **You're not producing videos, you're producing something that emits them.** That is infrastructure, plainly. The sellable version is "this asset works in five places."

#### Motion driven from a CMS

Much of the agency's work is content-driven sites on platforms like WordPress and Contentful (Bronco is one such system). Code-based motion is made of values, so **those values can be CMS fields**. The client changes a colour, a headline or a speed, and the animation updates: no re-render, no agency ticket, no waiting on a designer's calendar. A video in a CMS is just a file, and swapping it for another file is the whole of the client's control.

**Motion becomes a component like any other**, changed through properties and constants rather than handled as a special kind of deliverable. That closes the loop on [decoration vs. infrastructure](#decoration-vs-infrastructure). A component inherits from the design system, is editable through the CMS and is testable. A video file sits outside all three.

**Brand, briefly.** Motion is a brand property like colour and type: how a thing arrives, how it responds, what its easing feels like. Most brand guidelines say nothing about it, so it gets improvised project by project. Systematised, it becomes recognisably the brand's own across every endpoint.

### Canvas — the surface

<a href="/sheets/techniques/canvas.html" target="_blank" rel="noopener">Tear sheet SL-11 · Canvas ↗</a>

This section sets up WebGL and WebGPU. Its job is to give the reader a way to *read the web* afterwards. People already sense that a canvas experience is a different kind of thing from a CSS layout, without having words for why.

**The test anyone can run on any site: try to select the text.** In a normal layout you can highlight text, drag an image and tab to a link, because those are real elements with built-in behaviour. Inside a canvas none of that works. It looks like content, but there is nothing to grab.

**Why.** A canvas has no scene graph: nothing drawn on it is remembered. There is no element or node the browser knows about, only pixels you put there and must manage yourself.

The sheet's example is ACETATE, a lacquer transfer desk that exists only on the sheet. It shows four things:

- **Persistence.** Nothing stays unless you redraw it.
- **Batching.** A halftone at 20×, in four inks. Only three screens can sit at mutual 30° separation, so yellow takes a 15° collision and runs at 108% of the others' frequency, with dot gain.
- **Hit testing.** A transit map with six lines. Asking "what is under the pointer?" costs a second full draw every frame, because there is nothing to ask.
- **Readback.** `getImageData` reads pixels back out of the canvas.

**Costs:** everything the platform did for you stops. There is no layout engine, no accessibility tree and nothing for automated tests to grab.

**So why would anyone choose it?** Because some of what you might want on a website has nothing to do with a layout system built to present text and images. You might want freedom to work in depth, on the Z axis, or direct access to the pixel data itself, which filtering and advanced effects require. Neither is directly doable in CSS. If you are building typical content experiences, trading the page for a black box is a large loss. If you want to extend what your graphics can do, canvas is the better option.

**Responsiveness without a layout engine.** A canvas resizes, but its content does not reflow. You resize the backing store for the device's pixel ratio and update the projection so the image stays sharp rather than stretched, and composition is up to you. Fully fluid responsiveness is not realistic, so think **film framing, not web layout**:

- compose for the extremes you will ship;
- keep what matters inside a safe area that survives any crop;
- if mobile needs different framing, author it.

This holds for WebGL and WebGPU too. The general pattern explains the rising cost without blaming anyone: **as you climb the ladder, the platform stops doing things for you.**

WebGL and WebGPU are both ways of drawing onto this same surface.

### WebGL and WebGPU

<a href="/sheets/techniques/webgl.html" target="_blank" rel="noopener">Tear sheet SL-12 · WebGL ↗</a> · <a href="/sheets/techniques/webgpu.html" target="_blank" rel="noopener">Tear sheet SL-14 · WebGPU ↗</a>

These are two techniques discussed side by side. On stage they become one subject, "the graphics card", because no difference between them is visible to a viewer. In the paper they stay distinct.

**Plain version.** Both let a web page use the same chip that runs video games. That chip is built for an enormous amount of small work done all at once: a flock of 131,072 birds instead of a dozen. Choosing between the two comes down to two questions:

1. How much simulation or calculation do you need?
2. How much support and developer community do you want to be able to lean on?

**The generational difference.** WebGL exposes OpenGL ES, a mobile graphics API: WebGL 1.0 exposes OpenGL ES 2.0, and WebGL 2.0 exposes ES 3.0.<sup>[[15]](#ref-15)</sup> It was designed around handing the GPU one drawing command at a time. The final WebGL 1.0 specification came out in 2011,<sup>[[16]](#ref-16)</sup> so WebGL has fifteen years of answers behind it. WebGPU was designed for how modern GPUs work: build the work up front, submit it in batches and, the real dividing line, run **compute shaders**.

A compute shader draws nothing. It reads and writes buffers, so the GPU can hold state and evolve it.

- **The plain version.** The GPU is a room of workers. WebGL only lets you ask them to *paint*, so doing maths means disguising it as painting: encode numbers as colours, paint the result into another image, then read it back (the "texture ping-pong" workaround). WebGPU lets you ask them to do maths.
- **In WebGL,** anything that needs shared state (particle A affects particle B) usually lives on the CPU and is uploaded every frame. **That round trip is the bottleneck.**
- **In WebGPU,** the state stays in GPU memory. The CPU still starts each frame and sends small per-frame parameters, but it stops shipping the data back and forth. That is how the sheet's Roost flies 131,072 starlings: every bird reads its neighbours directly in GPU memory. The flocking rule follows Ballerini et al. (2008), in which each bird interacts with a fixed number of neighbours, six or seven, rather than with every bird within a distance.<sup>[[29]](#ref-29)</sup>

Older GPUs were fixed assembly lines, with one station for vertices and another for pixels. Modern GPUs are general-purpose cores that can do any job. WebGL's design addresses the assembly line; WebGPU addresses the whole machine.

**WebGL is not limited to static scenes.** It handles rotating models, scene lighting and shader effects comfortably at full frame rate. The marble bust and the Vermeer loupe are WebGL for exactly that reason. Its limit is motion driven by lots of *interacting* state.

**Which to use.** Use WebGPU where support allows and WebGL as the fallback. WebGL is still often the right default on client work, because it runs almost everywhere and its ecosystem is a real productivity difference: Three.js, shader libraries and years of answered questions. WebGPU is newer, and support has arrived in steps:

| Browser | WebGPU on by default |
| --- | --- |
| Chrome | Chrome 113, announced April 2023; first on ChromeOS, macOS and Windows<sup>[[17]](#ref-17)</sup><sup>[[18]](#ref-18)</sup> |
| Safari | Safari 26.0, September 2025, on macOS, iOS, iPadOS and visionOS<sup>[[19]](#ref-19)</sup> |
| Firefox | Firefox 141 on Windows, July 2025;<sup>[[20]](#ref-20)</sup> Firefox 147 added Apple Silicon Macs, January 2026<sup>[[21]](#ref-21)</sup> |

So WebGPU has been in every major engine for about a year, and the ecosystem is thin by comparison. Three.js ships a `WebGPURenderer` that falls back to a WebGL 2 backend where WebGPU is missing.<sup>[[22]](#ref-22)</sup>

**Worked cases:**

- **A modest data stream feeding a GPU animation** is fine in WebGL. The round trip only hurts when the data is large and constant.
- **Fluid, gas or diffuse point-cloud simulation** is the textbook WebGPU case: every cell reads its neighbours, and every step depends on the last.
- **Gaussian splats** benefit from WebGPU mainly because compute can sort them by depth in place. Splat viewers can be built on WebGL with workarounds, which is the same pattern again: possible in WebGL, natural in WebGPU.

**Context limits.** Browsers cap how many live WebGL contexts a page can hold and silently drop the oldest when the cap is exceeded. Firefox historically allowed 16 for the whole browser on desktop. WebKit has discussed raising its limit to 64, and Chromium sets its cap through a configurable preference. There is no single current number to quote.<sup>[[26]](#ref-26)</sup><sup>[[27]](#ref-27)</sup><sup>[[28]](#ref-28)</sup> WebGPU approaches this differently: a device can be connected to any number of canvases.<sup>[[33]](#ref-33)</sup> Every card on the WebGPU sheet shares one device. Its phone-shaped showcase goes further and runs eight apps through one canvas.

**2D vs. 3D.** It is the same machinery either way; the graphics card does not care whether a thing is flat or deep. 3D is notable because these technologies unlock it more fully. But **2D on the GPU is desirable in its own right once you reach the upper limits of what SVG or CSS can handle.** GPU 2D is not a fallback. It is the way past the quantity ceiling named in the SVG section.

**The sheets.**

- **WebGL.** Every pixel is the value of a function (of position, the light and the eye) evaluated when the frame is drawn and discarded when it is done. There are four experiences:
  - a photogrammetry marble bust (Poly Haven, CC0);
  - Vermeer's *Young Woman with a Water Pitcher* seen through a refracting loupe (The Met, CC0);
  - a bronze medal relief showing a mould seam a tenth of a millimetre high, authored in code (the medal is invented);
  - a 120,000-point rendering of the bust.

  A structural-colour encyclopaedia follows, with five entries. The sheet's history note describes CSS Custom Filters (2012–14), which were built so that page pixels could not be read, to prevent timing attacks.<sup>[[30]](#ref-30)</sup><sup>[[31]](#ref-31)</sup> The sheet states that they were dropped in 2014; we have not found a source for the removal.
- **WebGPU.** The GPU becomes a place things *happen*: compute passes read and write storage buffers that never come back to the CPU, and the cards print passes, not frames. A four-pass inspector runs 200,000 particles. One device runs eight apps through one canvas:
  - **Wallet**, payment cards;
  - **Atlas**, 160,000 grains;
  - **Nectar**, thirty-six thousand bees;
  - **Roost**, 131,072 starlings;
  - **Tessera**, a ray-marched terrain;
  - **Halcyon**, a campaign diorama;
  - **Supercell**, a storm that runs itself;
  - **fPhone Duo**, sphere-traced signed-distance hardware (an invented device).

  Seven of the apps are written in raw WGSL with no library. Supercell is the exception, written with `vgpu` (below).

**The ecosystem, honestly.** Most graphics libraries were designed around WebGL, and some are building WebGPU renderers now. Put plainly, the tools most people build with were designed around the older approach and are slowly being rewritten: you can use the newer thing, but you get less help doing it.

AI changes this in one direction. It broadens what a team can work out for itself, because the barrier was never conceptual. It was the missing answer to your exact problem. The honest caveat runs the other way: models learn from what exists, and what exists is overwhelmingly WebGL, so help is thinnest exactly where you need it most.

#### Why WebGPU runs outside the browser

WebGPU is a specification. A browser does not invent its own implementation from scratch. It embeds a library that implements the spec on top of the operating system's graphics layer (Metal, Vulkan or Direct3D):

- **Dawn** is the implementation inside Chromium. It is open source, cross-platform and usable on its own through a C/C++ API.<sup>[[23]](#ref-23)</sup>
- **wgpu**, written in Rust, is the core of WebGPU in Firefox, Servo and Deno.<sup>[[20]](#ref-20)</sup><sup>[[24]](#ref-24)</sup> The game engine Bevy is built on it.<sup>[[25]](#ref-25)</sup>

These are ordinary libraries, so native programs can link the same ones. WebGPU code, and the WGSL shader language, therefore runs in a desktop app, a game engine, a server-side renderer or a test harness, with no browser involved. The web API and the native API are the same machine behind different doors.

#### Tooling headway

In August 2026 Vercel made **`vgpu`** public. It is a TypeScript WebGPU library that Vercel built to ship the shaders on vercel.com.<sup>[[34]](#ref-34)</sup> The public launch was 27 August 2026, one day after the v0.3.1 release.<sup>[[34]](#ref-34)</sup><sup>[[35]](#ref-35)</sup> It is MIT-licensed and published on npm.<sup>[[34]](#ref-34)</sup><sup>[[36]](#ref-36)</sup> It is also built to be operated by coding agents as well as people.<sup>[[36]](#ref-36)</sup>

The same code runs along two separate headless paths:

- **`vgpu/node`** is backed by Dawn and renders offscreen in Node, with no browser.<sup>[[36]](#ref-36)</sup><sup>[[37]](#ref-37)</sup>
- **`vgpu/mock`** swaps in a deterministic software adapter, so tests and CI never need a GPU.<sup>[[36]](#ref-36)</sup>

**Why it matters.** A shader used to be a black box until someone opened a browser and looked, or fed screenshots back. A screenshot is also one frame at one moment, so it cannot tell a maths error from a timing error. When the same shader code runs headless, an agent can check the consequences of its own changes unattended.

Headless GPU rendering is not new: Blender runs headless, and browsers can be driven with a real GPU. What is new is the packaging: the same WGSL in a browser, in Node or in CI, behind one API. For programmatic asset generation, Blender is still the conventional tool. `vgpu`'s edge comes when the look *is* the shader and the web version and the exported frames need to be the same code, which is the portability argument again.

**Not the same project:** Vercel Labs' **agent-browser** is a separate command-line tool that drives Chromium for AI agents over the DevTools protocol. It refers to page elements by references taken from page snapshots.<sup>[[38]](#ref-38)</sup> The "no GPU required" SwiftShader path mentioned alongside it belongs to agent-browser, not to `vgpu`.<sup>[[38]](#ref-38)</sup>

## Composite

**Don't be a purist.** Composite is not a technique. It has no tear sheet and no demo of its own. It is an argument about approach, made by re-reading what has already been shown. It is separate from Canvas: Canvas is a technical fact about a surface, while composite is a way of deciding what goes on which surface.

**Most of what was built is already a composite.** Look at the tear sheets again: real page elements wherever semantics, interaction and accessibility are needed, a GPU surface wherever they are not, and an alternative for anyone who cannot use the GPU layer.

**Composites are a performance strategy, not only an aesthetic one.** Put each part of a scene on the cheapest surface that can carry it: DOM where you need semantics, GPU where you need pixels. Keep the parts that move out of the expensive pipeline stages. Purism is often where performance problems come from, because it forces one surface to do work it is bad at.

**For a brief, make it a question, not a philosophy:** *which technique carries which part?* The failure mode is a brief that assumes one answer and rules out combining techniques before anyone has looked. One failure mode to keep in mind: many GPU-backed contexts on one page is itself a performance problem (see [context limits](#webgl-and-webgpu)).

### Composite mechanics

- **A canvas is one opaque rectangle to the page.** Nothing inside it can be selected or focused, or read by a screen reader. You cannot put page elements inside a canvas.
- **The pattern is inversion.** The real element sits on top, absolutely positioned over the canvas, where it can be focused, read and navigated with a keyboard. The canvas draws the visuals behind it, and the same code drives both so they stay in sync. The semantic layer never enters the canvas.
- **The accessible layer is ordinary DOM.** Shadow DOM is a way of encapsulating components. It does not make anything accessible on its own.
- **Hybrid interaction.** Keep the real element live where it matters and let the shader take over where it doesn't, swapping on hover, on blur or when an animation starts.
- **Focus rings** render on the real element, in the layer above the canvas, styled by CSS. They look correct but unshaded: a flat rectangle over a spatial scene. That is arguably fine, because focus indicators benefit from being unambiguous.
- **Placing an element over a 3D object.** Project the object's position through the same camera matrix the shader uses to get a screen coordinate, once per frame or only when the camera moves. Under perspective, the footprint is trickier: project the corners of the object's bounding box and fit the element to them.
- **It is cheaper than it sounds if you only use `transform`.** Transforms skip layout and paint; setting `left`, `top`, `width` or `height` forces layout every frame.<sup>[[7]](#ref-7)</sup> Transforms are good; geometry is bad.
- **The real risk is drift.** If the canvas object moves and the element does not follow precisely, the focus ring lands where the user does not expect it. Drive both from one source of truth, and keep the moving parts few.

## Motion craft & restraint

Motion is a communication tool with a cost, so spend it where it does work. More animation is not a better experience. The difference between a site that feels crafted and one that feels exhausting is almost entirely judgement about where motion goes.

**What motion is for.** Six jobs. Together they are the test of whether a given animation deserves to exist:

- **Feedback.** Confirming something happened: a press, a submit, a drag landing. Without it, people repeat actions or assume they failed.
- **Continuity.** Showing where something came from and where it went, so the mental map survives the change.
- **Attention.** Directing the eye to what changed. It only works if one thing moves.
- **Perceived performance.** A staged reveal makes the same wait feel shorter than a frozen screen.
- **Meaning and state.** Relationship, hierarchy, loading vs. settled, valid vs. rejected.
- **Brand and feeling.** The experiential layer. It is what this paper argues for, and it is the easiest to overdo.

**When it backfires:**

- it stands between the user and their task;
- it sits on an action repeated dozens of times, where a flourish charms once and grates by the fortieth;
- several things move at once, so nothing reads as important;
- decorative motion sits next to text someone is reading;
- it overrides expected behaviour, as scroll-jacking does;
- it signals nothing.

**Rules of thumb.** These are heuristics, not laws:

- **Duration.** Most interface animation falls between 100 and 500 ms, with around 200–300 ms for larger changes.<sup>[[13]](#ref-13)</sup> A finer working split (roughly 150–300 ms for small feedback and 300–500 ms for larger transitions) is a rule of thumb, not a sourced figure. Ambient motion plays by different rules.
- **Easing.** Decelerate on arrival and accelerate on exit. Linear motion looks mechanical.
- **Distance affects duration.** Crossing the screen should take longer than nudging 4 px.
- **Reversibility.** If opening animates one way, closing should mirror it.
- **Causality.** Motion starts from where the user acted.
- **One focal point per moment.** Motion needs hierarchy, just as type does.
- **Frequency is inversely proportional to intensity.** The more often an interaction happens, the more restrained its motion must be. This is the most useful rule in the set.

**Two layers, not a spectrum of taste.**

- The **functional layer** is subtle, fast and mostly unnoticed when it works. When it is missing, a product feels cheap.
- The **experiential layer** is where big, authored motion belongs: entry points, hero moments, arrivals.

The two common mistakes mirror each other. One is putting experiential-scale motion inside functional flows. The other is shipping only functional motion and then wondering why the site feels generic.

**Good places for motion:** navigation and state changes, entry and hero moments, empty and loading states, confirmations, transitions between major contexts. **Poor places:** dense reading, data tables, form fields mid-input, critical paths where speed is the whole point, and anything a user meets dozens of times a session.

## Accessibility & reduced motion

This is what separates motion work that is professional from motion work that is only impressive.

- **`prefers-reduced-motion` is a stated preference.** It reflects a setting the user turned on, on their device, to minimise non-essential motion.<sup>[[39]](#ref-39)</sup> Ignoring it overrides an explicit request.
- **The harm is physical.** The W3C describes vestibular reactions to motion that include nausea, migraines and, potentially, needing bed rest to recover, and names parallax and scroll-triggered movement as examples.<sup>[[40]](#ref-40)</sup> Flashing is a separate risk. WCAG 2.3.1, at Level A, requires that nothing flashes more than three times in any one second, unless the flashes stay below the general and red flash thresholds.<sup>[[41]](#ref-41)</sup>
- **Reduced does not mean none.** Transitions often carry meaning, so stripping all motion can hurt comprehension. Substitute rather than delete: swap travel for a cross-fade or an instant change, keeping the news that something changed without the movement through space.
- **Never gate content behind an animation finishing.** The zero-motion path has to be complete.
- **Give control over anything long-running.** WCAG 2.2.2, at Level A, requires a way to pause, stop or hide moving content that meets all three conditions: it starts automatically, lasts more than five seconds and sits alongside other content. The exception is motion that is essential to the activity.<sup>[[42]](#ref-42)</sup>
- **Motion competes for attention.** That matters for cognitive load generally, and for people with attention-related or cognitive disabilities in particular. It is another reason the frequency rule matters.

**How this connects to the techniques:**

- **JavaScript-driven motion** is not covered by a CSS media query. It has to check the preference itself, through `matchMedia`, and opt out.
- **A GIF** cannot honour the preference at all without swapping the file ([GIF](#gif)).
- **On a composite,** the accessible experience lives in the real elements on top of the canvas ([Composite mechanics](#composite-mechanics)). The GPU layer can be switched off entirely without losing anything a screen reader or keyboard needs.

## Fallbacks & the degradation ladder

**Build the static state first and layer motion onto it.** Stripping a rich version back reliably produces broken intermediate states; layering up does not.

This is now **the other half of the budget argument** ([Performance budgets](#performance-budgets-and-performance-as-an-extension-of-qa)). The target device sets the budget, and the degradation ladder handles everyone else. Together they remove the false choice between ambitious and inclusive.

The ladder, top to bottom. Each rung is a complete experience:

1. **Full:** WebGPU compute, high counts.
2. **Reduced:** WebGL, lower counts, simpler simulation.
3. **Static poster frame:** a rendered image, never a blank hole where a canvas failed.
4. **Reduced-motion variant:** cross-fades and instant changes, no travel.

In practice:

- **Detect features; don't sniff devices.** Ask whether WebGPU exists, then WebGL, then fall through. Guessing from the device or user-agent ages badly.
- **Show a poster first and upgrade when ready.** A blank rectangle during start-up reads as broken.
- **Pause when not visible.** Use `IntersectionObserver` for off-screen content and `visibilitychange` for background tabs. Otherwise a GPU simulation runs at full tilt where nobody is looking, draining the battery and heating the device.
- **Use the device's own signals** where they exist, such as memory, core count and data-saver settings, as inputs for choosing a rung.

## Mobile-first vs. mobile-friendly

- **Mobile-friendly** means designed for desktop, then made to survive on a phone. Motion is scaled down or switched off as a cleanup pass.
- **Mobile-first** means the constrained case is the starting point. Motion is designed for a small viewport, touch and a thermal and battery budget, then *enhanced* on capable hardware.

This is now **the structural half of the QA argument**. Scaling up from a constrained baseline avoids most of the trouble. Scaling a complicated build down sends you back to decisions that were already made.

For motion it matters more than for layout:

- **There is no hover on touch.** Hover-driven motion needs a tap, scroll or gesture equivalent, designed on purpose rather than inherited.
- **Heat and battery are real constraints.** A sustained GPU simulation warms a phone, the phone slows itself down, and the user blames the site.
- **Scroll-linked animation** is a common source of jank on mobile, where scrolling is far less forgiving.
- **The viewport moves.** Address bars collapse and reappear, which changes the viewport height mid-scroll.
- **Large-area motion fills more of a person's vision on a small screen**, so vestibular triggers matter more on mobile, not less.

## Performance budgets, and performance as an extension of QA

### The budget

**The problem is not only that the tools are unfriendly. There is no budget.**

Web vitals work because someone decided on a line. For loading, a page should reach Largest Contentful Paint in 2.5 seconds or less, measured at the 75th percentile of page loads.<sup>[[43]](#ref-43)</sup> The number is a choice, but it is *shared*, and that makes it actionable.

**Motion has no equivalent.** The only signals are whether it feels good, whether someone notices dropped frames, and whether the device gets hot. Frame rate is a ceiling: everyone is under it until suddenly they aren't, so it tells you nothing until things are already bad. What is missing is a measure of **headroom**.

- **Without a budget, performance can only be discovered.** You build, then you find out. Every finding-out is a rework cycle, paid in payroll, on work someone is already attached to. **A budget makes it a constraint you design within**, like a grid or a colour palette.
- **The budget is a product decision, not a technical one.** Someone names the device the work is designed for, and in doing so names who the work is prepared to lose.
- **Non-stationarity.** The mix of devices shifts under you, so a budget set once quietly stops being true.
- **Ambitious motion suits brands that know their audience.** Size is not the point; knowing the audience is what lets a brand define the constraint. If a brand lacks the data to decide that objectively, that tells you something about whether to attempt it. A qualifying question for a pitch: *do we know what they are using?*
- **Multiple targets work like breakpoints on a capability axis.** A low-end target defines the compromised experience. **A mid-audience target is the sophisticated baseline**: build the full experience around where most of the audience sits, subtract deliberately below it and scale up above it. Optimising for the weakest device flattens the experience for everyone.
- **Capability responsiveness.** Layout responsiveness adapts to a viewport the browser reports. Capability responsiveness adapts to a budget you have to *infer*, from device memory or measured frame rate. That budget moves while the user is on the site, with battery, heat and other tabs. That is the case for degrading at runtime, not just at load.
- **The running total.** Any single animation is defensible; it is the *list* that spends the budget, and nobody tracks the total. Without a named number, each request is argued on its own merits, on vibes, and engineering's only available control is reluctance. **Give engineering a number and refusal stops being the safe default.**

### Performance as an extension of QA

This is not a call for new infrastructure, a standing performance practice, a specialist hire or a tooling investment. The claim is proportionate: **performance sits alongside quality assurance as a different class of concern, handled with similar approaches.** If there is a target device or a metric to hold, it is treated like any other aspect of a site that can be enforced in code or discovered by analysis. Existing practice extends to a new class of concern.

- **Depth scales with the work.** An isolated effect can be covered by testing at build and deploy. An experience that leans on complex animation needs the target device and metrics agreed **before design starts**, which is the budget point again, this time arriving from the QA side.
- **The instruments already exist:**
  - Lighthouse throttles by default, simulating a CPU four times slower.<sup>[[45]](#ref-45)</sup>
  - The Chrome DevTools Protocol can throttle the CPU of a real, running page from a script.<sup>[[46]](#ref-46)</sup>
  - Real-device clouds such as BrowserStack provide access to physical phones. BrowserStack's App Performance product reports launch time, rendering and resource use for native apps.<sup>[[44]](#ref-44)</sup>

  All of these can be automated. The capability exists; it just isn't pointed at motion yet.
- **The question nobody can currently answer:** *how is the site performing across device types, right now?* The missing piece is a routine, not a platform.
- **Unpredictable in advance, measurable once built.** Nobody can read a brief and say what frame rate it will hit on a four-year-old Android, because that depends on decisions not yet made. Once the thing exists, it can be measured precisely on real devices, and it should be. That is exactly why the target is named up front: measurement tells you whether you are inside the budget, but with no named target you are measuring against nothing.
- **QA's real limit.** QA confirms that the thing looks right on the happy path. It cannot say whether it holds up at scale. On a composite, the DOM layer is testable the usual way, but the GPU layer has nothing to select and nothing to assert against, so it tends to fall out of the test plan. That is a real, nuanced risk worth naming.
- **Over the long term,** performance drifts on long-lived assets as devices change, and monitoring is how you would notice.

### Risk, and building bottom-up

What makes ambitious motion feel risky to an organisation is **uncertainty, not build cost**. You might invest in something fancy, discover late that it performs badly, and have no clear read on whether the team can fix it.

**The answer is iterative, bottom-up building.** Start at the performance threshold that has to hold, something workable on an older device, then add richness upward so every step is already known to be good. You never discover the problem late, because you never left the safe zone. Ambition is **earned step by step rather than gambled on**, which is far easier to approve. Engineering practice provides **buoyancy in the midst of unknown unknowns.**

## Getting it across the line

This section answers [the question to carry](#the-question-to-carry).

**The blocker was never *what*.** Reference galleries are everywhere, and inspiration is cheap. The blocker is getting the work across the line inside a real organisation.

**A case from practice: Inspire Sleep.** Micro-animations, hero animations and responsive motion were all planned, and none shipped. The motion work died on coordination. It was never planned into the schedule, and then engineering raised concerns about bundle size, lazy loading and bloat on a content site where the client's publishing choices were unpredictable. Those concerns were reasonable, and nobody could say in advance what the motion would cost. This is the account of someone who was there, not a published study.

**Three things need solving:**

1. **Technical constraints that engineering owns.** They are real, and engineering's to hold.
2. **Shared vocabulary**, so design and engineering can tune a vision together. The [Glossary](/paper/glossary) collects the terms worth sharing.
3. **Naming precisely.** When AI does the building, speed stops tracking how complex the code is and starts tracking **how precisely you can name what you want**. A vague vision in imprecise language is the new bottleneck, especially for abstract motion you may not know the name for.

**Where vocabulary has to do the work.** CSS, layout and SVG are shaped like the page. A design tool can show two stills, and the motion between them can be inferred. WebGL and WebGPU are not shaped like the page: you cannot hand someone two keyframes of a fluid simulation. So vocabulary has to fill **exactly the gap the tool can no longer show**: words like *volumetric*, the difference between simulation and interaction, how variables influence each other, a feel for physics. This is not jargon for its own sake. It is the only remaining way to point at the thing.

**On design tools, accurately.** Newer Figma and Framer capabilities can often show a motion idea exactly as intended. The open question is whether the way it was made there is already the efficient way to build it, or whether production means going back to the drawing board for a better approach to the same result.

**The question, again.** *Could I describe this well enough for someone else to build it? Would I need to point, or sketch?* This is the same bottleneck as the AI feedback loop, only older, and it arguably sets a higher standard with people. Teams used to paper over it with proximity and repetition. **AI didn't create the need to articulate; it removed the last place it could hide.**

**The client version, which is the bigger question.** Whether *we* can describe the work is a craft problem. The business problem is whether a client who feels friction, or who is neither technical nor designerly, can describe what *they* want, and whether we can facilitate that conversation early enough not to fly blind. The gap between ideation and a real, living experience is where budget quietly goes. The distinction between the craft question and the client question is the point of this section.

**Evidence that it is buildable:**

- **Inspire Sleep did ship a global design-token and component system.** The logic of isolating parts and then combining them transfers to motion, with a different approach for each technology.
- **Animotion** is a gallery, in the style of Storybook, introduced to the design team. It is scoped to CSS, SVG and JavaScript only. It gives visual references for animation variables (easing, duration, Bézier curves) and shows how they compose into common patterns such as nav menus and page transitions. It came out of researching how other companies break animation into primitives, from atoms to molecules to organisms, the same way design tokens do.

Both are reports of what shipped, not proposals. **The gap is opportunity, not skill.** Design's ideas get treated with scepticism because nobody can predict their implications, so they die as maybes. The work is **converting maybes into yeses by speaking truthfully about consequences.**

## Gaps

These are named honestly, and each one was checked rather than assumed where we could check it. They are not the point of the paper, and they are not a call to action. The choice is to live with them or to go looking.

1. **The inspection tools are misaligned, not inaccessible.** The DevTools performance panel, layers view, paint flashing and flame charts are free and universal, but they are built for a developer debugging alone, after the fact. Paint flashing and the layers view come closest to a heat map, since they show what repaints and how the page is layered.<sup>[[47]](#ref-47)</sup><sup>[[48]](#ref-48)</sup> In our reading, though, they show what is happening, not which design decision to blame or what to do instead. **It's not access, it's design intent.**
2. **Building something better looks feasible.** The raw events behind those panels are already exposed:
   - The Chrome DevTools Protocol has stable `Tracing` and `Performance` domains. `Performance.getMetrics` returns current run-time metrics. `PerformanceTimeline` exists too, but is marked experimental.<sup>[[46]](#ref-46)</sup>
   - Chrome ships a DevTools MCP server that lets an AI agent record a performance trace.<sup>[[49]](#ref-49)</sup>
   - Playwright can open a DevTools session (Chromium only)<sup>[[50]](#ref-50)</sup> and record traces with screenshots.<sup>[[51]](#ref-51)</sup>
   - Lighthouse can be driven from Playwright through a community package.<sup>[[52]](#ref-52)</sup>

   What is missing is the last mile, **translation**: turning "42 layout events, 18 forced reflows, transform-only compositing on layer 3" into plain language. That is a translation problem, not a research problem.
3. **Adjacent tools exist.** GTmetrix, PageSpeed Insights<sup>[[53]](#ref-53)</sup> and site crawlers such as Lumar<sup>[[54]](#ref-54)</sup> and Sitebulb<sup>[[55]](#ref-55)</sup>, which collect Core Web Vitals across a whole site, produce readable reports for marketers and agencies. They answer "is this page fast" at the level of the whole page. We have not found a tool that works at the level of a single animation decision: one where you point at *this* hero animation and get back "this part runs on the GPU and is fine, this part forces layout every frame." We have also not yet searched for one systematically, so treat this as a reading, not a finding.
4. **The deeper gap is the budget, not the tool** ([Performance budgets](#performance-budgets-and-performance-as-an-extension-of-qa)). A better inspector still only diagnoses. What is missing is a way to set an allowance up front and see what you build measured against it.

## Notes on evidence

**What *measured, not claimed* means.** A number appears only alongside the instrument that produced it, and that instrument has been shown to be able to see the work being measured. Where an instrument has a limit, the limit is printed next to the number. A count is a claim about a query, so the query is named too.

**Instruments across the tear sheets, and their limits:**

- **Timers.** `performance.now()` is coarsened in browsers to limit timing attacks. The SVG sheet records it as clamped to 1 ms in Firefox and Safari and about 100 µs in Chrome. Sub-millisecond differences on those browsers are noise.
- **SVG geometry.** `getBBox({ stroke: true })` is implemented in Firefox; Chrome and Safari accept the argument and silently ignore it. The sheet's hit-testing approach works in Chrome and Safari but not in Firefox.
- **GPU timing on WebGL.** `EXT_disjoint_timer_query_webgl2` gives precise GPU timestamps, which is exactly why Firefox disabled it over timing-attack concerns.<sup>[[32]](#ref-32)</sup> The WebGL sheet describes it as shipping disabled or coarsened. We have not confirmed its current state in each browser.
- **GPU timing on WebGPU.** The WebGPU sheet prints the time of named passes between two timestamps, never a whole frame. Its "bytes uploaded per frame" figure comes from a counter on the device queue, not an estimate. Supercell reports frame cost from the start of the frame until the GPU reports its work done, with the JavaScript share shown separately. On Metal, timestamp spans can overlap, so they are never summed.
- **Frame meters.** A `requestAnimationFrame` meter cannot see compositor work such as SVG filter rasterisation. It reads the same with the filter on or off, so it is not used as evidence for that kind of cost.
- **GIF roster.** File sizes come from the files on disk. Frame counts come from counting image descriptors with a GIF block parser; frames that repeat content were not deduplicated.

**How the paper's external claims were verified.** Every factual claim in this paper's brief was checked before drafting:

- **Two passes per claim.** One pass tried to confirm each claim and a separate pass tried to break it. Where they disagreed, the disagreement was recorded, not settled by vote.
- **Verbatim evidence.** Every external source was fetched, and each supporting quote had to be found verbatim on the page.
- **Self-validation.** A final pass re-fetched every cited page and re-found each quote. Of 119 quote checks, 5 failed and were dropped, 3 of them quotes that had been presented as verbatim and were not on the page. Bibliography titles were checked against each page's own title.
- **Repository facts** were re-read at their file and line.
- **Corrections.** Where a claim did not survive, the paper uses the corrected version. The side-nav failure is one: it belongs to `@keyframes`, not `transition`. Where a claim could not be sourced, it is cut or offered as a reading.

The full register is kept with the project's planning notes.

**What could not be verified this way:** anything that needs a running browser, anything internal to `Folklore Digital` (the Inspire Sleep account, Animotion), and pages that refuse scripted fetches. GTmetrix is one of those, which is why it is named without a citation.

**On dates.** All sources were accessed on 17 September 2026. Where a page is old, its date is given in the text, as with the 2015 compositor article.

## Bibliography

Accessed 17 September 2026 unless stated. Numbers match the citation markers in the talk.

<a id="ref-1"></a>**[1]** SparkToro. *In 2026, Less than One Third of Google Searches Still Send a Click.* SparkToro blog, 2026. <https://sparktoro.com/blog/in-2026-less-than-one-third-of-google-searches-still-send-a-click/>

<a id="ref-2"></a>**[2]** Pew Research Center. *Do people click on links in Google AI summaries?* Short Reads, 22 July 2025. <https://www.pewresearch.org/short-reads/2025/07/22/google-users-are-less-likely-to-click-on-links-when-an-ai-summary-appears-in-the-results/>

<a id="ref-3"></a>**[3]** Ahrefs. *Update: AI Overviews Reduce Clicks by 58%.* Ahrefs blog. <https://ahrefs.com/blog/ai-overviews-reduce-clicks-update/>

<a id="ref-4"></a>**[4]** Seer Interactive. *AIO Impact on Google CTR: 2026 Update.* Seer Interactive Insights, 2026. <https://www.seerinteractive.com/insights/aio-impact-on-google-ctr-2026-update>

<a id="ref-5"></a>**[5]** Reid, Liz (Google). *AI in Search: Driving more queries and higher quality clicks.* The Keyword, 6 August 2025. <https://blog.google/products-and-platforms/products/search/ai-search-driving-more-queries-higher-quality-clicks/>

<a id="ref-6"></a>**[6]** Vercel. *Design Engineering at Vercel: What we do and how we do it.* Vercel blog. <https://vercel.com/blog/design-engineering-at-vercel>

<a id="ref-7"></a>**[7]** web.dev (Google). *Stick to Compositor-Only Properties and Manage Layer Count.* Last updated 20 March 2015. <https://web.dev/articles/stick-to-compositor-only-properties-and-manage-layer-count>

<a id="ref-8"></a>**[8]** MDN Web Docs. *Element: animate() method.* <https://developer.mozilla.org/en-US/docs/Web/API/Element/animate>

<a id="ref-9"></a>**[9]** MDN Web Docs. *Animation.* <https://developer.mozilla.org/en-US/docs/Web/API/Animation>

<a id="ref-10"></a>**[10]** MDN Web Docs. *Animation: currentTime property.* <https://developer.mozilla.org/en-US/docs/Web/API/Animation/currentTime>

<a id="ref-11"></a>**[11]** W3C. *Web Animations* (Level 1). <https://www.w3.org/TR/web-animations-1/>

<a id="ref-12"></a>**[12]** CSS Working Group. *CSS Transitions Module Level 1* (Editor's Draft). <https://drafts.csswg.org/css-transitions/>

<a id="ref-13"></a>**[13]** Nielsen Norman Group. *Executing UX Animations: Duration and Motion Characteristics.* <https://www.nngroup.com/articles/animation-duration/>

<a id="ref-14"></a>**[14]** OBS Project. *Browser Source.* OBS Studio Knowledge Base. <https://obsproject.com/kb/browser-source>

<a id="ref-15"></a>**[15]** Khronos Group. *WebGL - Low-Level 3D Graphics API Based on OpenGL ES.* <https://www.khronos.org/webgl/>

<a id="ref-16"></a>**[16]** Khronos Group. *Khronos Releases Final WebGL 1.0 Specification.* Press release, 2011. <https://www.khronos.org/news/press/khronos-releases-final-webgl-1.0-specification>

<a id="ref-17"></a>**[17]** Chrome for Developers. *Chrome ships WebGPU.* 6 April 2023. <https://developer.chrome.com/blog/webgpu-release>

<a id="ref-18"></a>**[18]** Jara, Adriana (Chrome for Developers). *New in Chrome 113.* 2023. <https://developer.chrome.com/blog/new-in-chrome-113>

<a id="ref-19"></a>**[19]** WebKit. *WebKit Features in Safari 26.0.* 15 September 2025. <https://webkit.org/blog/17333/webkit-features-in-safari-26-0/>

<a id="ref-20"></a>**[20]** Mozilla Graphics Team. *Shipping WebGPU on Windows in Firefox 141.* 15 July 2025. <https://mozillagfx.wordpress.com/2025/07/15/shipping-webgpu-on-windows-in-firefox-141/>

<a id="ref-21"></a>**[21]** Mozilla. *Firefox 147.0 release notes.* 13 January 2026. <https://www.firefox.com/en-US/firefox/147.0/releasenotes/>

<a id="ref-22"></a>**[22]** three.js. *WebGPURenderer — Three.js Docs.* <https://threejs.org/docs/pages/WebGPURenderer.html>

<a id="ref-23"></a>**[23]** Google. *Dawn: Native WebGPU implementation.* GitHub. <https://github.com/google/dawn>

<a id="ref-24"></a>**[24]** gfx-rs. *wgpu* (README). GitHub. <https://github.com/gfx-rs/wgpu>

<a id="ref-25"></a>**[25]** Bevy. *Bevy + WebGPU.* <https://bevy.org/news/bevy-webgpu/>

<a id="ref-26"></a>**[26]** Mozilla Bugzilla. *Bug 790138 — Exceeded 8 live WebGL contexts for this principal.* 2012. <https://bugzilla.mozilla.org/show_bug.cgi?id=790138>

<a id="ref-27"></a>**[27]** WebKit Bugzilla. *Bug 136551 — Increase number of maximum active WebGL contexts.* <https://bugs.webkit.org/show_bug.cgi?id=136551>

<a id="ref-28"></a>**[28]** The Chromium Authors. *webgl_rendering_context_base.cc* and *content_switches.cc.* Chromium source, `main`. <https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/modules/webgl/webgl_rendering_context_base.cc>

<a id="ref-29"></a>**[29]** Ballerini, M., Cabibbo, N., Candelier, R., et al. *Interaction ruling animal collective behavior depends on topological rather than metric distance: Evidence from a field study.* Proceedings of the National Academy of Sciences 105(4):1232–1237, 2008. doi:10.1073/pnas.0711437105. Preprint: <https://arxiv.org/abs/0709.1916>

<a id="ref-30"></a>**[30]** Chrome for Developers. *Introduction to Custom Filters (aka CSS Shaders).* 2013. <https://developer.chrome.com/blog/introduction-to-custom-filters-aka-css-shaders>

<a id="ref-31"></a>**[31]** blink-dev. *Intent to Implement: CSS Custom Filters (aka CSS Shaders).* 2013. <https://groups.google.com/a/chromium.org/g/blink-dev/c/cl05kpmPTRs/m/N223ukJrVgAJ>

<a id="ref-32"></a>**[32]** Mozilla Bugzilla. *Bug 1442504 — Disable disjoint timer queries to prevent use as a high-precision timer.* <https://bugzilla.mozilla.org/show_bug.cgi?id=1442504>

<a id="ref-33"></a>**[33]** GPU for the Web Community Group. *WebGPU Explainer.* <https://gpuweb.github.io/gpuweb/explainer/>

<a id="ref-34"></a>**[34]** WebGPU.com. *Vercel Opens vgpu 0.3.1 for WebGPU Across Browser, Node, and CI.* Secondary source. <https://www.webgpu.com/news/vercel-vgpu-webgpu-browser-node-ci/>

<a id="ref-35"></a>**[35]** Vercel Labs. *vgpu releases* (GitHub REST API). <https://api.github.com/repos/vercel-labs/vgpu/releases?per_page=100>

<a id="ref-36"></a>**[36]** Vercel Labs. *vgpu* (README). GitHub. <https://github.com/vercel-labs/vgpu>

<a id="ref-37"></a>**[37]** MarkTechPost. *Vercel AI Open-Sources vgpu: A TypeScript WebGPU Library for AI Agent Shaders.* 28 August 2026. Secondary source. <https://www.marktechpost.com/2026/08/28/vercel-vgpu-webgpu-library-open-source/>

<a id="ref-38"></a>**[38]** Vercel Labs. *agent-browser* (README). GitHub. <https://github.com/vercel-labs/agent-browser>

<a id="ref-39"></a>**[39]** MDN Web Docs. *prefers-reduced-motion.* <https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion>

<a id="ref-40"></a>**[40]** W3C WAI. *Understanding Success Criterion 2.3.3: Animation from Interactions.* <https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions.html>

<a id="ref-41"></a>**[41]** W3C WAI. *Understanding Success Criterion 2.3.1: Three Flashes or Below Threshold.* <https://www.w3.org/WAI/WCAG21/Understanding/three-flashes-or-below-threshold.html>

<a id="ref-42"></a>**[42]** W3C WAI. *Understanding Success Criterion 2.2.2: Pause, Stop, Hide.* <https://www.w3.org/WAI/WCAG21/Understanding/pause-stop-hide.html>

<a id="ref-43"></a>**[43]** web.dev (Google). *Largest Contentful Paint (LCP).* <https://web.dev/articles/lcp>

<a id="ref-44"></a>**[44]** BrowserStack. *App Performance Metrics Complete List.* <https://www.browserstack.com/docs/app-performance/app-performance-guides/perf-metrics-list>

<a id="ref-45"></a>**[45]** Google Chrome. *Lighthouse throttling* (docs/throttling.md). GitHub. <https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md>

<a id="ref-46"></a>**[46]** Chrome DevTools. *Chrome DevTools Protocol* (browser_protocol.json). GitHub. <https://github.com/ChromeDevTools/devtools-protocol/blob/master/json/browser_protocol.json>

<a id="ref-47"></a>**[47]** Chrome for Developers. *Discover issues with rendering performance.* <https://developer.chrome.com/docs/devtools/rendering/performance>

<a id="ref-48"></a>**[48]** Chrome for Developers. *Layers panel: Explore the layers of your website.* <https://developer.chrome.com/docs/devtools/layers>

<a id="ref-49"></a>**[49]** Chrome for Developers. *Chrome DevTools (MCP) for your AI agent.* 23 September 2025. <https://developer.chrome.com/blog/chrome-devtools-mcp>

<a id="ref-50"></a>**[50]** Microsoft Playwright. *BrowserContext* (API reference). <https://playwright.dev/docs/api/class-browsercontext>

<a id="ref-51"></a>**[51]** Microsoft Playwright. *Tracing* (API reference). <https://playwright.dev/docs/api/class-tracing>

<a id="ref-52"></a>**[52]** Ghosh, Abhinaba. *playwright-lighthouse* (README). Community package. <https://github.com/abhinaba-ghosh/playwright-lighthouse>

<a id="ref-53"></a>**[53]** Google for Developers. *About PageSpeed Insights.* <https://developers.google.com/speed/docs/insights/v5/about>

<a id="ref-54"></a>**[54]** Lumar. *Lumar | Website Optimization Platform.* <https://lumar.io/>

<a id="ref-55"></a>**[55]** Sitebulb. *Website Performance Audit & Core Web Vitals.* <https://sitebulb.com/product/performance/>

## Acknowledgement

This paper, the talk and every example on the site were made for [`Folklore Digital`](https://folklore.digital/), where I work. The projects, experiments and conversations it reports on happened there, and it is written for the people I build with.

Thank you to Sean Van Dyk, Irene Polo, Aayush Joshi, Tyler Knight, Kyle Johnson, Kayla Long and Mike Matheny for the feedback and collaboration over the last nine months that shaped this work.
