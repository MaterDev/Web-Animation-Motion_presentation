---
title: Glossary
revised: 2026-09-17
---

# Glossary

The paper ends on a claim: motion work gets across the line when design and engineering share a vocabulary, and can name precisely what they want ([Getting it across the line](/paper#getting-it-across-the-line)). This page is that vocabulary. The first ten terms change conversations about motion the most, and they are the ones most often used loosely. The twenty after them are worth knowing whatever your role. Each entry puts the plain version first. Where the paper uses a term, the entry links to the section, and where a definition comes from outside the paper, the source is listed at the foot of the page.

## The ten to understand

### Rendering pipeline

The steps a browser takes to turn a change on the page into pixels on the screen: *style → layout → paint → composite*. Style works out which rules apply, layout works out where everything sits and how big it is, paint draws each part, and composite assembles the painted parts into the frame.<sup>[[8]](#source-8)</sup> Every change passes through up to four of these stages, and the fewer it touches, the cheaper it is.

**Often confused with:** "rendering" in the 3D or video sense, meaning producing a finished image or file, or "render" meaning the whole page load. In a performance conversation it means this sequence, run for every frame that changes.

**Why it matters:** two animations that look identical can stop at different stages, and that is most of the difference in what they cost. "Which stages does this touch?" is a question design and engineering can ask together.

**In the paper:** [Layout / CSS](/paper#layout-css)

### Compositor

The final assembly step. The browser splits the page into layers and paints each one into its own image. The compositor stacks those images, applies movement and transparency, and hands the frame to the screen. `transform` and `opacity` are the two properties browsers reliably hand to the compositor: changing either one skips layout and paint entirely.<sup>[[1]](#source-1)</sup>

**Often confused with:** "hardware-accelerated" or "on the GPU" as a general promise. The portable rule is narrower: two properties. The source for it dates from 2015, and engines have extended compositing since then, but these two are the ones to rely on. Also not the same as *composite* in the paper's sense, which is an approach (see [Composite](#composite)).

**Why it matters:** it is the one piece of rendering vocabulary that a designer can use and be correct. "Can this move with `transform` and `opacity`?" is a question anyone can ask. Moving something by changing its `width`, `top` or `left` instead makes the browser redo layout on every frame.

**In the paper:** [Layout / CSS](/paper#layout-css) · [Composite mechanics](/paper#composite-mechanics)

### Main thread

The single line of work where the browser processes user input and paints, and where, by default, it runs all of a page's JavaScript and performs layout.<sup>[[9]](#source-9)</sup> It does one thing at a time, so a long task anywhere on it makes everything else wait: the click, the scroll and the next frame.

**Often confused with:** the CPU/GPU split. "Off the main thread" is not the same as "on the GPU". Script can leave the main thread and still run on the CPU, in a web worker for example.<sup>[[9]](#source-9)</sup>

**Why it matters:** it is why a heavy script can make a simple animation stutter, and why engineers say "don't block the main thread". The paper uses that phrase as its example of vocabulary that lands as arcane in a meeting.

**In the paper:** [Two confusions to clear](/paper#two-confusions-to-clear)

### GPU and CPU

The CPU is the general-purpose processor that runs a page's code. The GPU, the graphics card, is the same kind of chip that runs video games, and it is built for an enormous amount of small work done all at once. WebGL and WebGPU are how a web page uses it directly.

**Often confused with:** "faster". The GPU is not a faster CPU; it is fast at doing a great many small jobs at once. Using it has costs of its own: shipping data to it every frame is a bottleneck, and asking it a question (reading results back) stalls the frame.

**Why it matters:** choosing a technique is partly choosing which chip does the work. "Render it on the GPU" is a real option with a real price, not a switch that makes the work free.

**In the paper:** [WebGL and WebGPU](/paper#webgl-and-webgpu)

### Frame rate and frame budget

Frame rate is how many frames, new images on the screen, the browser produces each second.<sup>[[10]](#source-10)</sup> The frame budget is the time available to produce each one. On a display that refreshes 60 times a second, that works out at about 16.7 milliseconds per frame, and the browser has its own overhead to fit inside that too.<sup>[[8]](#source-8)</sup> A display that refreshes faster leaves less time per frame.

**Often confused with:** a measure of quality or of headroom. Frame rate is a ceiling: everyone is under it until suddenly they aren't, so it tells you nothing until things are already bad. What it does not show is how close each frame came to missing.

**Why it matters:** a frame that misses its budget is what people see as a stutter. The planning question is not "does it hit 60?" but "how much room is left, on the device this is designed for?"

**In the paper:** [The budget](/paper#the-budget)

### Jank

Visible stutter or sluggishness in an interface: an animation that hitches, a scroll that catches, a tap that takes a beat to answer. It is usually caused by long tasks on the main thread, by blocked rendering, or by too much processing power spent on work in the background.<sup>[[11]](#source-11)</sup>

**Often confused with:** slow loading. A page can load quickly and still be janky, and a slow page can animate smoothly once it arrives. Jank is about how the page behaves while someone is using it.

**Why it matters:** it is the word for what people feel and blame on the brand. Scroll-linked animation is a common source of it on mobile, where scrolling is far less forgiving.

**In the paper:** [Mobile-first vs. mobile-friendly](/paper#mobile-first-vs-mobile-friendly)

### Reduced motion

`prefers-reduced-motion` reflects a setting a person turned on, on their device, to minimise non-essential motion.<sup>[[2]](#source-2)</sup> Honouring it means substituting calmer motion, such as a cross-fade or an instant change, for movement through space.

**Often confused with:** "no motion". Reduced does not mean none: transitions often carry meaning, so stripping all motion can hurt comprehension. It is also not automatic. Motion driven by JavaScript has to check the preference itself, and a GIF cannot honour it without swapping the file.

**Why it matters:** the harm is physical. The W3C describes vestibular reactions to motion that include nausea and migraines, and names parallax and scroll-triggered movement as examples.<sup>[[3]](#source-3)</sup> Ignoring the setting overrides an explicit request.

**In the paper:** [Accessibility & reduced motion](/paper#accessibility-reduced-motion)

### Performance budget

A set of limits on the measurements that affect a site's performance, agreed in advance.<sup>[[12]](#source-12)</sup> Web vitals are the familiar example: a page should reach Largest Contentful Paint in 2.5 seconds or less, measured at the 75th percentile of page loads.<sup>[[4]](#source-4)</sup> The number is a choice, but it is shared, and that makes it actionable.

**Often confused with:** a technical target engineering polishes toward at the end. A budget is set before design starts, and it is a product decision: naming the device the work is designed for also names who the work is prepared to lose.

**Why it matters:** without a budget, performance can only be discovered after the thing is built, and every discovery is rework. With one, it becomes a constraint to design within, like a grid or a colour palette. Motion has no shared equivalent yet.

**In the paper:** [Performance budgets, and performance as an extension of QA](/paper#performance-budgets-and-performance-as-an-extension-of-qa)

### Progressive enhancement and graceful degradation

Two routes to the same goal. Progressive enhancement starts from a baseline that works for as many people as possible, then layers a richer experience on top for devices that can run it.<sup>[[13]](#source-13)</sup> Graceful degradation starts from the full experience and falls back to something simpler that still delivers the essentials.<sup>[[14]](#source-14)</sup>

**Often confused with:** each other. The difference is where you start. The paper's advice is to build the static state first and layer motion onto it, because stripping a rich version back reliably produces broken intermediate states. Its degradation ladder uses both ideas: it is built upward, and every rung is a complete experience for whoever lands on it.

**Why it matters:** it decides whether the fallback is designed or discovered. A poster frame is a designed fallback. A blank rectangle where a canvas failed is a discovered one.

**In the paper:** [Fallbacks & the degradation ladder](/paper#fallbacks-the-degradation-ladder)

### Canvas vs. the DOM

The DOM is the page as the browser knows it: real elements, such as headings, links, buttons and images, each with built-in behaviour.<sup>[[16]](#source-16)</sup> A canvas is one rectangle of pixels that code paints into. On its own it is just a bitmap, and it carries no information about what is drawn on it.<sup>[[15]](#source-15)</sup> The test anyone can run on any site: try to select the text.

**Often confused with:** CSS, because canvas and CSS can look identical to someone who doesn't know what to look for. And WebGL and WebGPU also draw onto a canvas, so "it's a canvas" and "it's 3D" are different statements.

**Why it matters:** inside a canvas, everything the platform did for you stops. There is no layout engine, no accessibility tree and nothing for automated tests to grab. Sometimes that trade is right, and it should always be made on purpose.

**In the paper:** [Canvas — the surface](/paper#canvas-the-surface) · [Composite mechanics](/paper#composite-mechanics)

## Twenty more worth knowing

### Forced reflow

Reflow, also called layout, is the browser recalculating the position and size of parts of the page.<sup>[[17]](#source-17)</sup> A forced reflow happens when code changes the page and then immediately asks for a measurement, so the browser has to do layout on the spot instead of once at the right moment. Doing that over and over is called layout thrashing.<sup>[[18]](#source-18)</sup>

### Accessibility tree

The version of the page that the browser builds from the DOM for assistive technology such as screen readers, giving each item a name, a role, a state and a description.<sup>[[16]](#source-16)</sup> Anything drawn on a canvas is not in it. Shadow DOM is a way of encapsulating components and does not make anything accessible on its own.

### Composite

In the paper, composite is not a technique but an approach: put each part of a scene on the cheapest surface that can carry it, with DOM where you need semantics and the GPU where you need pixels. For a brief, it becomes a question: *which technique carries which part?* It shares a root with the compositor, the rendering step, but the two words name different things. See [Composite](/paper#composite).

### Easing

The curve that describes how a value changes over the course of an animation: whether it starts slowly, stops gently, overshoots or runs at a constant speed.<sup>[[19]](#source-19)</sup> The rule of thumb is to decelerate on arrival and accelerate on exit, because linear motion looks mechanical. Easing is often mixed up with duration; one is the shape of the change, the other its length.

### Keyframes and interpolation

Keyframes are the waypoints of an animation: the values at chosen moments.<sup>[[20]](#source-20)</sup> Interpolation is the calculation of every value in between, and easing shapes how that in-between progresses.<sup>[[21]](#source-21)</sup> Motion can only be handed over as keyframes when the in-between can be inferred, which is why you cannot hand someone two keyframes of a fluid simulation.

### Simulation vs. animation

In the sense the paper uses: an animation is authored, with its values decided in advance, while a simulation is a set of rules applied step by step, where every step depends on the last, as in a fluid or a flock. Interaction is a third thing, input changing what happens next, and it can drive either. You describe a simulation not with keyframes but with its rules, its variables and how they influence each other. See [Getting it across the line](/paper#getting-it-across-the-line).

### Real-time vs. pre-rendered

Pre-rendered, or pre-baked, motion is computed once and shipped as pixels, such as a GIF or a video. Real-time motion is computed on the viewer's device as it plays, as with CSS, SVG, canvas and shaders. Pre-rendered is often cheaper, but video can't respond to a cursor, a scroll or a click. Once motion has to respond, it is not an option at all. See [Video](/paper#video).

### Shader

A small program that runs on the GPU. The two kinds most used on the web position shapes (vertex shaders) and work out the colour of each pixel (fragment shaders).<sup>[[22]](#source-22)</sup> WebGL shaders are written in GLSL, WebGPU shaders in WGSL. A shader is not a baked filter: it computes the image, so its look is made of parameters that can change live.

### Compute shader

A shader that draws nothing. It reads and writes data held on the GPU, so the GPU can hold state and evolve it from frame to frame. Compute shaders are the real dividing line between WebGPU, which has them, and WebGL, which does not. See [WebGL and WebGPU](/paper#webgl-and-webgpu).

### WebGL and WebGPU

Two ways for a web page to use the GPU, both drawing onto a canvas. WebGL exposes OpenGL ES, a mobile graphics API, and its final 1.0 specification came out in 2011.<sup>[[6]](#source-6)</sup><sup>[[7]](#source-7)</sup> WebGPU was designed for how modern GPUs work and adds compute shaders. It is newer and its ecosystem is thinner, so the paper's advice is WebGPU where support allows and WebGL as the fallback. Neither is only for 3D. See [WebGL and WebGPU](/paper#webgl-and-webgpu).

### Device pixel ratio

How many physical screen pixels are used to draw one CSS pixel. Zooming the page changes it.<sup>[[23]](#source-23)</sup> It is why a canvas looks blurry on a high-density screen unless its backing store is resized to match. It is often confused with screen resolution: two phones with the same layout width can have very different pixel counts.

### Design token

A named design decision, such as a colour, a size or a duration, stored once in a platform-agnostic form so it can be shared across disciplines, tools and code.<sup>[[24]](#source-24)</sup> The token format includes durations and cubic Bézier easing curves, so motion can be tokens too.<sup>[[24]](#source-24)</sup> Components inherit tokens, which is how a change made once propagates everywhere. See [Decoration vs. infrastructure](/paper#decoration-vs-infrastructure).

### Cost per change

What each revision costs, rather than what the first version cost. A static asset has to be reopened, re-rendered and re-exported for every change, so each round costs roughly what the first did. A living system exposes the things you would want to change as parameters, so the same request becomes a value edit and a reload. The cost hides in payroll, not on an invoice. See [Cost per change](/paper#cost-per-change).

### Feature detection

Checking whether the browser supports a capability before using it, and running different code depending on the answer.<sup>[[25]](#source-25)</sup> Ask whether WebGPU exists, then WebGL, then fall through. It is the opposite of device sniffing, which guesses capability from the device or user agent and ages badly. See [Fallbacks & the degradation ladder](/paper#fallbacks-the-degradation-ladder).

### Mobile-first vs. mobile-friendly

Mobile-friendly means designed for desktop, then made to survive on a phone, with motion scaled down or switched off as a clean-up pass. Mobile-first means the constrained case is the starting point: motion is designed for a small viewport, touch and a thermal and battery budget, then enhanced on capable hardware. See [Mobile-first vs. mobile-friendly](/paper#mobile-first-vs-mobile-friendly).

### Core Web Vitals

Google's three user-experience metrics that apply to every web page: Largest Contentful Paint for loading, Interaction to Next Paint for interactivity, and Cumulative Layout Shift for visual stability.<sup>[[26]](#source-26)</sup> None of them measures whether an animation is smooth, though animation can still affect them: web.dev's advice for avoiding layout shifts is to animate with `transform` rather than `top` or `left`.<sup>[[27]](#source-27)</sup>

### Lab data vs. field data

Lab data is collected in a controlled environment with fixed device and network settings; field data comes from real people visiting the site.<sup>[[28]](#source-28)</sup> Lighthouse produces lab data, and PageSpeed Insights adds field data from real Chrome users.<sup>[[5]](#source-5)</sup> The two can disagree about the same page, so a good Lighthouse score is not proof of a good experience.<sup>[[28]](#source-28)</sup>

### Bundle size

How much code, mostly JavaScript, a site ships to the browser. Code splitting divides it into separate bundles that load independently, so a page loads only the code it needs at that moment.<sup>[[29]](#source-29)</sup> An animation library adds to the bundle of every page that includes it unless it is split out. See [Getting it across the line](/paper#getting-it-across-the-line).

### Lazy loading

Treating a resource as non-critical and loading it only when it is needed, typically as someone scrolls or navigates, rather than up front.<sup>[[30]](#source-30)</sup> It shortens the initial load. It moves a cost rather than removing it.

### Headless

Running a browser or other rendering software with no visible interface, so scripts can drive it for testing, automation or CI.<sup>[[31]](#source-31)</sup> Headless does not mean "no GPU" or "no rendering": it still renders, and it is how the same shader code can be checked unattended. See [Tooling headway](/paper#tooling-headway).

## Sources

All accessed 17 September 2026. Entries marked "Paper bibliography" point to the paper's own, verified bibliography.

<a id="source-1"></a>**[1]** Paper bibliography [[7]](/paper#ref-7). web.dev (Google). *Stick to Compositor-Only Properties and Manage Layer Count.* Last updated 20 March 2015.

<a id="source-2"></a>**[2]** Paper bibliography [[39]](/paper#ref-39). MDN Web Docs. *prefers-reduced-motion.*

<a id="source-3"></a>**[3]** Paper bibliography [[40]](/paper#ref-40). W3C WAI. *Understanding Success Criterion 2.3.3: Animation from Interactions.*

<a id="source-4"></a>**[4]** Paper bibliography [[43]](/paper#ref-43). web.dev (Google). *Largest Contentful Paint (LCP).*

<a id="source-5"></a>**[5]** Paper bibliography [[53]](/paper#ref-53). Google for Developers. *About PageSpeed Insights.*

<a id="source-6"></a>**[6]** Paper bibliography [[15]](/paper#ref-15). Khronos Group. *WebGL - Low-Level 3D Graphics API Based on OpenGL ES.*

<a id="source-7"></a>**[7]** Paper bibliography [[16]](/paper#ref-16). Khronos Group. *Khronos Releases Final WebGL 1.0 Specification.* 2011.

<a id="source-8"></a>**[8]** web.dev (Google). *Rendering performance.* <https://web.dev/articles/rendering-performance>

<a id="source-9"></a>**[9]** MDN Web Docs. *Main thread* (Glossary). <https://developer.mozilla.org/en-US/docs/Glossary/Main_thread>

<a id="source-10"></a>**[10]** MDN Web Docs. *Frame rate (FPS)* (Glossary). <https://developer.mozilla.org/en-US/docs/Glossary/FPS>

<a id="source-11"></a>**[11]** MDN Web Docs. *Jank* (Glossary). <https://developer.mozilla.org/en-US/docs/Glossary/Jank>

<a id="source-12"></a>**[12]** web.dev (Google). *Performance budgets 101.* <https://web.dev/articles/performance-budgets-101>

<a id="source-13"></a>**[13]** MDN Web Docs. *Progressive enhancement* (Glossary). <https://developer.mozilla.org/en-US/docs/Glossary/Progressive_Enhancement>

<a id="source-14"></a>**[14]** MDN Web Docs. *Graceful degradation* (Glossary). <https://developer.mozilla.org/en-US/docs/Glossary/Graceful_degradation>

<a id="source-15"></a>**[15]** MDN Web Docs. *&lt;canvas&gt;: The Graphics Canvas element* (Accessibility). <https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/canvas>

<a id="source-16"></a>**[16]** MDN Web Docs. *Accessibility tree* (Glossary). <https://developer.mozilla.org/en-US/docs/Glossary/Accessibility_tree>

<a id="source-17"></a>**[17]** MDN Web Docs. *Reflow* (Glossary). <https://developer.mozilla.org/en-US/docs/Glossary/Reflow>

<a id="source-18"></a>**[18]** web.dev (Google). *Avoid large, complex layouts and layout thrashing.* <https://web.dev/articles/avoid-large-complex-layouts-and-layout-thrashing>

<a id="source-19"></a>**[19]** MDN Web Docs. *&lt;easing-function&gt;.* <https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/easing-function>

<a id="source-20"></a>**[20]** MDN Web Docs. *@keyframes.* <https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@keyframes>

<a id="source-21"></a>**[21]** MDN Web Docs. *Interpolation* (Glossary). <https://developer.mozilla.org/en-US/docs/Glossary/Interpolation>

<a id="source-22"></a>**[22]** MDN Web Docs. *GLSL shaders.* <https://developer.mozilla.org/en-US/docs/Games/Techniques/3D_on_the_web/GLSL_Shaders>

<a id="source-23"></a>**[23]** MDN Web Docs. *Window: devicePixelRatio property.* <https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio>

<a id="source-24"></a>**[24]** Design Tokens Community Group. *Design Tokens Format Module 2025.10.* A community group specification, not a W3C Standard. <https://www.designtokens.org/tr/2025.10/format/>

<a id="source-25"></a>**[25]** MDN Web Docs. *Implementing feature detection.* <https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Testing/Feature_detection>

<a id="source-26"></a>**[26]** web.dev (Google). *Web Vitals.* <https://web.dev/articles/vitals>

<a id="source-27"></a>**[27]** web.dev (Google). *Cumulative Layout Shift (CLS).* <https://web.dev/articles/cls>

<a id="source-28"></a>**[28]** web.dev (Google). *Why lab and field data can be different (and what to do about it).* <https://web.dev/articles/lab-and-field-data-differences>

<a id="source-29"></a>**[29]** MDN Web Docs. *Code splitting* (Glossary). <https://developer.mozilla.org/en-US/docs/Glossary/Code_splitting>

<a id="source-30"></a>**[30]** MDN Web Docs. *Lazy loading.* <https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/Lazy_loading>

<a id="source-31"></a>**[31]** Chrome for Developers. *Chrome Headless mode.* <https://developer.chrome.com/docs/automation-and-testing/headless>
