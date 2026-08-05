<script>
  import { SHEETS, TREATMENTS, base } from '$lib/sheets.js';

  const kept = TREATMENTS.filter((t) => t.kept);
  const superseded = TREATMENTS.filter((t) => !t.kept);
</script>

<svelte:head>
  <title>Design System — WAM-2026</title>
  <meta
    name="description"
    content="How this presentation's design system was made: design research, disposable treatments, agent-driven iteration verified in a real browser, and extraction into a system."
  />
</svelte:head>

<div class="wrap">
  <header class="head">
    <p class="kicker">Design System · Methodology &amp; Reference</p>
    <h1>how this was made</h1>
    <p class="dek">
      The design system isn't decoration applied to the talk at the end. It's the place the
      talk's hard problems get solved first — legibility at projection distance, motion that
      survives <code>prefers-reduced-motion</code>, a grid that doesn't fall apart when
      content changes — so that by the time a slide gets built, those questions already have
      answers. This page is the method. The <a href="/design/reference">reference</a> is the
      result.
    </p>
  </header>

  <section class="prose">
    <h2>The sequence</h2>
    <p>
      Four artefacts, in order, each one the input to the next. The order matters more than
      any individual step: every stage narrows what the next stage is allowed to decide.
    </p>

    <ol class="steps" data-testid="method-steps">
      <li>
        <span class="step-n">01</span>
        <div>
          <b>Scope</b> — <a href="/paper">the paper</a>. What the talk argues, what it shows,
          how long it runs, what it deliberately excludes. Written before any design or code
          existed, and still the document everything else defers to. When a design decision
          and the scope disagree, the scope wins or the scope gets edited — never silently
          diverged from.
        </div>
      </li>
      <li>
        <span class="step-n">02</span>
        <div>
          <b>Design research</b> — a design document derived from the scope, not from taste.
          It starts by naming the problem with the obvious reference set (every "technical"
          deck looks like a terminal or a blueprint), and only then proposes a direction. It
          also sets a reflexive constraint that turns out to do most of the work: a talk
          arguing that craft is the differentiator has to be crafted, and a talk arguing for
          reduced-motion support has to honour it in its own chrome.
        </div>
      </li>
      <li>
        <span class="step-n">03</span>
        <div>
          <b>Treatments</b> — six complete, competing visual directions, built as real
          running pages rather than mockups. Five were superseded. That is the point of
          making them: they're cheap enough to throw away, which is what makes it possible to
          find out that a direction is wrong by <em>looking at it</em> instead of arguing
          about it.
        </div>
      </li>
      <li>
        <span class="step-n">04</span>
        <div>
          <b>Extraction into a system</b> — the kept treatment's values pulled out into
          shared tokens and components, so there is exactly one definition of every colour,
          curve, material and module. The app and the reference sheets load the same two CSS
          files. They cannot drift apart, because there is nothing to drift.
        </div>
      </li>
    </ol>

    <h2>Divergent, then convergent</h2>
    <p>
      The treatments phase and the system phase pull in opposite directions on purpose.
      Treatments are allowed to contradict each other — different palettes, different
      material metaphors, different levels of ornament — because the goal is coverage of the
      possibility space, not consistency. Extraction is where consistency gets imposed, once
      there's something worth being consistent about.
    </p>
    <p>
      Doing it the other way round — building a token system first and then designing within
      it — sounds tidier and reliably produces a system that encodes whatever the first
      guess happened to be. Every constraint in this one was earned by a specific failure in
      a specific treatment.
    </p>

    <div class="treatments" data-testid="treatment-strip">
      {#each superseded as t (t.code)}
        <a class="tr" href={base(t.file)} target="_blank" rel="noopener">
          <span class="tr-code">{t.code}</span>
          <span class="tr-name">{t.name}</span>
          <span class="tr-state">superseded</span>
        </a>
      {/each}
      {#each kept as t (t.code)}
        <a class="tr is-kept" href={base(t.file)} target="_blank" rel="noopener">
          <span class="tr-code">{t.code}</span>
          <span class="tr-name">Field unit (dark)</span>
          <span class="tr-state">kept</span>
        </a>
      {/each}
    </div>

    <h2>Iterative development, with the model doing the typing</h2>
    <p>
      The build is agent-driven — vibe coding, if you like — but the phrase undersells the
      part that makes it work. Letting a model write the implementation is only useful if
      you have a way to find out, quickly and honestly, whether what it wrote is any good.
      Here that mechanism is the browser: every change is loaded, screenshotted, and
      inspected with real computed styles and real measured geometry before it counts as
      done.
    </p>
    <p>
      That loop is not a formality. It is where most of the actual design decisions got
      made, because a surprising number of ideas that read as obviously correct in source
      turn out to be wrong on screen. A few from this build, all found by looking rather
      than reasoning:
    </p>
    <ul>
      <li>
        A knurled grip texture that was legible as machining at swatch size and read as
        moiré on a 36px knob. Cut, then cut again later when it was proposed for the
        scrollbar thumb for the same reason.
      </li>
      <li>
        Per-topic idle animations — seven different motion signatures — which looked like
        variety in the abstract and like seven unrelated widgets on the page. Replaced with
        one shared curve; differentiation moved entirely to colour, shape and pattern.
      </li>
      <li>
        A layout transition that flew every block to the bottom-right and snapped back. The
        cause was three layers down: the animation library positions elements
        <code>fixed</code> mid-flight, and a <code>transform</code> on an ancestor both
        re-roots that positioning and scales the offset. Only findable by reading the inline
        styles the library was writing frame by frame.
      </li>
    </ul>
    <p>
      That last one is the clearest example of the whole argument. It's a constraint on how
      the real presentation app can be architected — discovered in a throwaway reference
      page, weeks before it could have derailed the build.
    </p>

    <h2>Why developer tooling, not a design-to-code product</h2>
    <p>
      This is built with an agent working directly against ordinary developer tooling — a
      repo, a text editor, a browser, git. Not through a hosted design-to-code product.
      The distinction matters for reasons that are practical rather than ideological:
    </p>
    <ul>
      <li>
        <b>The output is the source.</b> There's no export step and no generated layer to
        re-generate. What you're reading and what runs are the same files.
      </li>
      <li>
        <b>The process is inspectable.</b> Every decision is a commit with the reasoning
        written down, including the reversals — several sections of this system carry
        comments explaining what was tried first and why it was replaced. A black box that
        emits a good result teaches you nothing about which of its constraints you can push
        on.
      </li>
      <li>
        <b>The harness is swappable.</b> Nothing here depends on a particular assistant,
        vendor, or editor. The repo is the interface. Change the model or the tool and the
        work carries over, because the work is files.
      </li>
      <li>
        <b>Full access to the platform.</b> Hosted generators are good at the shapes they
        know. This deck needs WebGPU compute shaders, canvas particle fields, a
        variable-axis dot-matrix font, and a bespoke LED pixel grid — none of which are
        anybody's template.
      </li>
    </ul>

    <h2>What it buys: presentations that are actually web pages</h2>
    <p>
      All of this exists to make something a slide tool can't. PowerPoint and Keynote are
      excellent at what they do, and what they do is arrange static content on a fixed
      canvas. They can't run a compute shader. They can't show the same particle system
      rebuilt in six technologies at genuinely escalating counts. They can't respond to a
      viewer's motion preferences, or degrade down a ladder when the hardware can't cope, or
      be shared as a link that behaves identically for everyone who opens it.
    </p>
    <p>
      A talk about what the web can do should be built out of what the web can do. The
      design system is what makes that affordable: because the materials, motion and grid
      are already decided and already proven, building a slide is composition rather than
      invention.
    </p>

    <div class="note diff">
      <b>Read the two source documents.</b> The <a href="/paper">full paper</a> is the scope
      the whole thing defers to. The design research document it produced lives in the repo
      as <code>DESIGN.md</code> — the visual language, motion system, architecture and
      conventions, written before the treatments were built.
    </div>
  </section>

  <section class="ref-cta">
    <div class="ref-head">
      <h2>The reference</h2>
      <a class="ibtn primary" href="/design/reference" data-testid="open-reference">Open reference →</a>
    </div>
    <p class="sec-note">
      {SHEETS.length} live sheets. Everything is running code — the demos actually run, the
      motion actually animates, and the sheets use the same stylesheets the app you're
      reading this in does.
    </p>
    <div class="sheet-grid" data-testid="sheet-grid">
      {#each SHEETS as s (s.code)}
        <a class="sheet" href={`/design/reference?sheet=${s.code.toLowerCase()}`} style={s.tint ? `--ct:${s.tint}` : ''}>
          <span class="sheet-code">{s.code}</span>
          <span class="sheet-name">{s.name}</span>
          <span class="sheet-note">{s.note}</span>
        </a>
      {/each}
    </div>
  </section>
</div>

<style>
  .wrap { max-width: 1100px; margin: 0 auto; padding: calc(var(--u) * 7) calc(var(--u) * 5) calc(var(--u) * 14); width: 100%; }
  .kicker {
    font-family: var(--mono); font-size: 10px; letter-spacing: 0.2em;
    text-transform: uppercase; color: var(--hz-400); margin: 0 0 calc(var(--u) * 2);
  }
  .head h1 { margin-bottom: calc(var(--u) * 2.5); }
  .dek { color: var(--hz-500); font-size: 15px; max-width: 66ch; margin: 0 0 calc(var(--u) * 6); }

  .steps { list-style: none; padding: 0; margin: 0 0 calc(var(--u) * 4); }
  .steps li { display: flex; gap: calc(var(--u) * 2.5); margin-bottom: calc(var(--u) * 3); }
  .step-n {
    flex: none; width: 34px;
    font-family: var(--mono); font-size: 10px; letter-spacing: 0.12em;
    color: var(--hz-200); background: var(--hz-900);
    padding: 4px 0; border-radius: 2px; text-align: center; height: fit-content;
  }
  .steps div { color: var(--hz-600); font-size: 14.5px; line-height: 1.75; }
  .steps b { color: var(--hz-900); font-weight: 500; }

  .treatments { display: flex; gap: 8px; flex-wrap: wrap; margin: calc(var(--u) * 3) 0 calc(var(--u) * 4); }
  .tr {
    display: flex; flex-direction: column; gap: 3px;
    padding: 11px 14px; border-radius: 4px; text-decoration: none; border: 0;
    background: var(--hz-100); box-shadow: var(--edge);
    transition: transform var(--dur-fast) var(--ease-standard), box-shadow var(--dur-fast) var(--ease-standard);
  }
  .tr:hover { transform: translateY(-2px); box-shadow: var(--edge), var(--lift-2); }
  .tr-code { font-family: var(--mono); font-size: 9px; letter-spacing: 0.14em; color: var(--hz-400); }
  .tr-name { font-size: 12.5px; color: var(--hz-600); }
  .tr-state { font-family: var(--mono); font-size: 8px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--hz-400); }
  .tr.is-kept { background: color-mix(in oklch, var(--tint) 16%, var(--hz-100)); }
  .tr.is-kept .tr-name { color: var(--hz-900); }
  .tr.is-kept .tr-state, .tr.is-kept .tr-code { color: var(--tint); }

  .ref-cta { margin-top: calc(var(--u) * 9); }
  .ref-head { display: flex; align-items: center; justify-content: space-between; gap: calc(var(--u) * 3); flex-wrap: wrap; }
  .ref-head h2 {
    font-size: 22px; margin: 0 0 calc(var(--u) * 1.5);
    padding-bottom: calc(var(--u) * 1.5); flex: 1 1 auto;
    border-bottom: var(--hair) solid var(--hz-300);
  }
  .sec-note { color: var(--hz-500); font-size: 13.5px; max-width: 66ch; margin: 0 0 calc(var(--u) * 3); }

  .sheet-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(228px, 1fr)); gap: calc(var(--u) * 2); }
  .sheet {
    position: relative; display: flex; flex-direction: column; gap: 7px;
    padding: calc(var(--u) * 2.5); border-radius: 5px; text-decoration: none; border: 0;
    background: linear-gradient(180deg, var(--hz-200), var(--hz-100));
    box-shadow: var(--edge), var(--lift-1);
    transition: transform var(--dur-fast) var(--ease-standard), box-shadow var(--dur-fast) var(--ease-standard);
  }
  .sheet::before {
    content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 2px;
    border-radius: 5px 0 0 5px; background: var(--ct, var(--hz-400));
  }
  .sheet:hover { transform: translateY(-3px); box-shadow: var(--edge), var(--lift-3); }
  .sheet-code { font-family: var(--mono); font-size: 9px; letter-spacing: 0.16em; color: var(--ct, var(--hz-400)); }
  .sheet-name { font-size: 15px; color: var(--hz-900); text-transform: lowercase; }
  .sheet-note { font-size: 12px; color: var(--hz-500); line-height: 1.6; }
</style>
