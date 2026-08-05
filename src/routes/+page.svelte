<script>
  const SECTIONS = [
    {
      href: '/design',
      code: 'DS',
      title: 'Design System',
      note: 'The methodology, and the working reference: treatments, materials, motion, graphic language, layouts.',
    },
    {
      href: '/paper',
      code: 'PA',
      title: 'Full Paper',
      note: 'The complete scope — thesis, content outline, motion craft, accessibility, architecture, risks.',
    },
    {
      href: '/presentation',
      code: 'PR',
      title: 'Presentation',
      note: 'The deck itself, delivered as running code rather than slides. Viewer in progress.',
    },
  ];
</script>

<svelte:head><title>Web Animation &amp; Motion — WAM-2026</title></svelte:head>

<div class="wrap">
  <div class="hero">
    <p class="kicker">Folklore · Talk · 21 August 2026</p>
    <h1>web animation<br />&amp; motion</h1>
    <p class="dek">
      A tour through web animation and motion, built and delivered as a custom interactive
      app rather than slides — so every example is real, running code instead of a
      screenshot or a description. This site is the working record: the design system it's
      built on, the paper behind it, and the deck itself.
    </p>
  </div>

  <div class="cards">
    {#each SECTIONS as s (s.href)}
      <a class="card" href={s.href} data-testid={`home-card-${s.code.toLowerCase()}`}>
        <span class="card-code">{s.code}</span>
        <span class="card-title">{s.title}</span>
        <span class="card-note">{s.note}</span>
        <span class="card-go" aria-hidden="true">→</span>
      </a>
    {/each}
  </div>
</div>

<style>
  .wrap { max-width: 1100px; margin: 0 auto; padding: calc(var(--u) * 9) calc(var(--u) * 5) calc(var(--u) * 12); width: 100%; }
  .kicker {
    font-family: var(--mono); font-size: 10px; letter-spacing: 0.2em;
    text-transform: uppercase; color: var(--hz-400); margin: 0 0 calc(var(--u) * 2);
  }
  .hero h1 { margin-bottom: calc(var(--u) * 3); }
  .dek { color: var(--hz-500); font-size: 15px; max-width: 60ch; margin: 0 0 calc(var(--u) * 8); }

  .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: calc(var(--u) * 2.5); }
  .card {
    position: relative; display: flex; flex-direction: column; gap: 10px;
    padding: calc(var(--u) * 3); border-radius: 6px; text-decoration: none;
    background: linear-gradient(180deg, var(--hz-200), var(--hz-100));
    box-shadow: var(--edge), var(--lift-1);
    transition: transform var(--dur-fast) var(--ease-standard),
                box-shadow var(--dur-fast) var(--ease-standard);
  }
  .card:hover { transform: translateY(-3px); box-shadow: var(--edge), var(--lift-3); }
  .card:focus-visible { outline: 2px solid var(--tint); outline-offset: 2px; }
  .card-code {
    font-family: var(--mono); font-size: 9px; letter-spacing: 0.16em;
    text-transform: uppercase; color: var(--tint);
  }
  .card-title { font-size: 19px; color: var(--hz-900); text-transform: lowercase; }
  .card-note { font-size: 13px; color: var(--hz-500); line-height: 1.65; }
  .card-go {
    position: absolute; right: calc(var(--u) * 3); bottom: calc(var(--u) * 3);
    color: var(--hz-400); font-family: var(--mono); font-size: 13px;
    transition: transform var(--dur-fast) var(--ease-standard), color var(--dur-fast) var(--ease-standard);
  }
  .card:hover .card-go { color: var(--tint); transform: translateX(3px); }

  @media (max-width: 860px) { .cards { grid-template-columns: 1fr; } }
</style>
