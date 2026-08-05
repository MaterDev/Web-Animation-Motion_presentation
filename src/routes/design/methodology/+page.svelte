<script>
  import { TREATMENTS } from '$lib/sheets.js';

  const kept = TREATMENTS.find((t) => t.kept);
</script>

<svelte:head>
  <title>Methodology — Design System — WAM-2026</title>
  <meta
    name="description"
    content="How this design system was made: design research, disposable treatments, agent-driven iteration verified in a real browser, and extraction into a system."
  />
</svelte:head>

<div class="wrap">
  <p class="mono kicker">Design System · Methodology</p>
  <h1>how this was made</h1>
  <p class="lead">
    The design system isn't decoration applied at the end. It's where the talk's hard
    problems get solved first — legibility at projection distance, motion that survives
    <code>prefers-reduced-motion</code>, a grid that doesn't fall apart when content changes
    — so that by the time a slide gets built, those questions already have answers.
  </p>

  <section>
    <div class="sec-head">
      <span class="idx">01</span><h2>the sequence</h2><span class="rule"></span><span class="ref">Four artefacts</span>
    </div>
    <p class="lead">
      Each one is the input to the next. The order matters more than any individual step:
      every stage narrows what the next stage is allowed to decide.
    </p>

    <ol class="steps" data-testid="method-steps">
      <li>
        <span class="n">01</span>
        <div>
          <b>Scope</b> — <a href="/paper">the paper</a>. What the talk argues, what it shows,
          how long it runs, what it deliberately excludes. Written before any design or code
          existed, and still the document everything defers to. When a design decision and
          the scope disagree, the scope wins or the scope gets edited — never silently
          diverged from.
        </div>
      </li>
      <li>
        <span class="n">02</span>
        <div>
          <b>Design research</b> — a design document derived from the scope, not from taste.
          It starts by naming the problem with the obvious reference set (every "technical"
          deck looks like a terminal or a blueprint) and only then proposes a direction. It
          also sets a reflexive constraint that does most of the work: a talk arguing craft
          is the differentiator has to be crafted, and a talk arguing for reduced-motion
          support has to honour it in its own chrome.
        </div>
      </li>
      <li>
        <span class="n">03</span>
        <div>
          <b>Treatments</b> — six complete, competing directions, built as real running pages
          rather than mockups. Five were superseded. That's the point of making them: cheap
          enough to throw away, which is what makes it possible to find out a direction is
          wrong by <em>looking at it</em> instead of arguing about it.
          <a href="/design/treatments">See all six →</a>
        </div>
      </li>
      <li>
        <span class="n">04</span>
        <div>
          <b>Extraction into a system</b> — the kept treatment's values pulled into shared
          tokens and components, so there is exactly one definition of every colour, curve,
          material and module. The app and the reference sheets load the same two CSS files.
          They can't drift apart, because there's nothing to drift.
        </div>
      </li>
    </ol>
  </section>

  <section>
    <div class="sec-head">
      <span class="idx">02</span><h2>divergent, then convergent</h2><span class="rule"></span><span class="ref">Why this order</span>
    </div>
    <p class="lead">
      The treatments phase and the system phase pull in opposite directions on purpose.
      Treatments are allowed to contradict each other — different palettes, different
      material metaphors, different levels of ornament — because the goal is coverage of the
      possibility space, not consistency. Extraction is where consistency gets imposed, once
      there's something worth being consistent about.
    </p>
    <div class="note">
      Doing it the other way round — building a token system first and designing within it —
      sounds tidier and reliably encodes whatever the first guess happened to be. Every
      constraint in this system was earned by a specific failure in a specific treatment.
      {kept?.code} exists because five other grounds were tried against real content first.
    </div>
  </section>

  <section>
    <div class="sec-head">
      <span class="idx">03</span><h2>iteration, verified in a browser</h2><span class="rule"></span><span class="ref">The loop</span>
    </div>
    <p class="lead">
      The build is agent-driven — vibe coding, if you like — but the phrase undersells the
      part that makes it work. Letting a model write the implementation is only useful with a
      way to find out, quickly and honestly, whether what it wrote is any good. Here that's
      the browser: every change is loaded, screenshotted, and inspected with real computed
      styles and real measured geometry before it counts as done.
    </p>
    <p class="lead">
      That loop is where most of the actual design decisions got made, because a surprising
      number of ideas that read as obviously correct in source are wrong on screen. Three
      from this build, all found by looking rather than reasoning:
    </p>
    <ul class="findings">
      <li>
        <b>Knurl became moiré.</b> A grip texture legible as machining at swatch size read as
        interference on a 36px knob. Cut — then cut again later when it was proposed for the
        scrollbar thumb, for the same reason at the same size.
      </li>
      <li>
        <b>Seven motions read as seven widgets.</b> Per-topic idle animations looked like
        variety in the abstract and like unrelated components on the page. Replaced with one
        shared curve; differentiation moved entirely to colour, shape and pattern.
      </li>
      <li>
        <b>A transition that flew to the corner.</b> Blocks shot to the bottom-right and
        snapped back. The cause was three layers down: the animation library positions
        elements <code>fixed</code> mid-flight, and a <code>transform</code> on any ancestor
        both re-roots that positioning and scales the offset. Only findable by reading the
        inline styles the library writes frame by frame.
      </li>
    </ul>
    <div class="note diff">
      That last one is the clearest case for the whole approach. It's a constraint on how the
      real presentation app can be architected — found in a throwaway reference page, weeks
      before it could have derailed the build. It's now recorded in the paper's risk list.
    </div>
  </section>

  <section>
    <div class="sec-head">
      <span class="idx">04</span><h2>developer tooling, not a black box</h2><span class="rule"></span><span class="ref">Why</span>
    </div>
    <p class="lead">
      This is built with an agent working directly against ordinary developer tooling — a
      repo, an editor, a browser, git — rather than through a hosted design-to-code product.
      The reasons are practical rather than ideological.
    </p>
    <div class="reasons">
      <div><b>The output is the source.</b> No export step, no generated layer to re-generate. What you're reading and what runs are the same files.</div>
      <div><b>The process is inspectable.</b> Every decision is a commit with the reasoning written down, reversals included — several parts of this system carry comments explaining what was tried first and why it was replaced.</div>
      <div><b>The harness is swappable.</b> Nothing depends on a particular assistant, vendor or editor. The repo is the interface; change the model or the tool and the work carries over, because the work is files.</div>
      <div><b>Full access to the platform.</b> Hosted generators are good at the shapes they know. This deck needs compute shaders, canvas particle fields, a variable-axis dot-matrix font and a bespoke LED pixel grid — none of which are anybody's template.</div>
    </div>
  </section>

  <section>
    <div class="sec-head">
      <span class="idx">05</span><h2>what it buys</h2><span class="rule"></span><span class="ref">The point</span>
    </div>
    <p class="lead">
      All of it exists to make something a slide tool can't. PowerPoint and Keynote are
      excellent at arranging static content on a fixed canvas. They can't run a compute
      shader, or show one particle system rebuilt in six technologies at genuinely
      escalating counts, or respond to a viewer's motion preferences, or degrade down a
      ladder when the hardware can't cope, or be shared as a link that behaves identically
      for everyone who opens it.
    </p>
    <p class="lead">
      A talk about what the web can do should be built out of what the web can do. The design
      system is what makes that affordable: because the materials, motion and grid are
      already decided and already proven, building a slide is composition rather than
      invention.
    </p>
    <div class="note warn">
      <b>Read the sources.</b> The <a href="/paper">full paper</a> is the scope everything
      defers to. The design research it produced lives in the repo as <code>DESIGN.md</code>
      — visual language, motion system, architecture and conventions, written before the
      treatments were built.
    </div>
  </section>
</div>

<style>
  .wrap {
    max-width: 860px; margin: 0 auto; width: 100%;
    padding: calc(var(--u) * 8) calc(var(--u) * 5) calc(var(--u) * 14);
  }
  .kicker { margin: 0 0 calc(var(--u) * 2); }
  h1 { font-size: clamp(38px, 6vw, 68px); margin-bottom: calc(var(--u) * 3); }
  .wrap > .lead { max-width: 62ch; margin-bottom: calc(var(--u) * 8); }
  section { margin-bottom: calc(var(--u) * 9); }
  section .lead { margin-bottom: calc(var(--u) * 3); }

  .steps { list-style: none; padding: 0; margin: 0; }
  .steps li { display: flex; gap: calc(var(--u) * 2.5); margin-bottom: calc(var(--u) * 3); }
  .steps .n {
    flex: none; width: 32px; height: fit-content; text-align: center;
    font-family: var(--mono); font-size: 10px; letter-spacing: 0.1em;
    color: var(--hz-200); background: var(--hz-900); padding: 4px 0; border-radius: 2px;
  }
  .steps div { color: var(--hz-500); font-size: 14px; line-height: 1.75; }
  .steps b { color: var(--hz-900); font-weight: 500; }

  .findings { list-style: none; padding: 0; margin: 0 0 calc(var(--u) * 2); }
  .findings li {
    color: var(--hz-500); font-size: 14px; line-height: 1.7;
    padding-left: calc(var(--u) * 2); margin-bottom: calc(var(--u) * 2);
    border-left: var(--hair) solid var(--hz-300);
  }
  .findings b { color: var(--hz-900); font-weight: 500; }

  .reasons { display: grid; gap: calc(var(--u) * 2); }
  .reasons div {
    color: var(--hz-500); font-size: 14px; line-height: 1.7;
    padding-left: calc(var(--u) * 2); border-left: 2px solid var(--hz-300);
  }
  .reasons b { color: var(--hz-900); font-weight: 500; }
</style>
