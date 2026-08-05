<script>
  import ScreenCard from '$lib/ScreenCard.svelte';
  import { SHEETS, TREATMENTS } from '$lib/sheets.js';

  /* Deliberately short. This page's whole job is to say what the
     section contains and get you into it — the methodology, which
     used to live here, is now a page in the sidebar alongside
     everything else it talks about. */
  const ENTRIES = [
    {
      href: '/design/methodology',
      code: 'MTH',
      title: 'methodology',
      note: 'Scope, design research, six treatments, extraction into a system — and why the process is built this way.',
    },
    {
      href: '/design/treatments',
      code: 'ITR',
      title: 'treatments',
      meta: `${TREATMENTS.length}`,
      note: 'The competing directions, in the order they were made. Five superseded, one kept.',
    },
    {
      href: '/design/reference?sheet=sys',
      code: 'REF',
      title: 'reference',
      meta: `${SHEETS.length}`,
      note: 'Live sheets — materials, motion, graphic language, layouts, and one demo per rendering technique.',
    },
  ];
</script>

<svelte:head>
  <title>Design System — WAM-2026</title>
  <meta
    name="description"
    content="The design system behind the Web Animation & Motion talk: methodology, treatments, and live reference sheets."
  />
</svelte:head>

<div class="wrap">
  <p class="mono kicker">Design System</p>
  <h1>design system</h1>
  <p class="lead">
    Everything the talk is built from, and the record of how it got decided. The system
    exists to solve the deck's hard problems — legibility, motion, grid — before any slide
    is built, so building one is composition rather than invention.
  </p>

  <div class="cards" data-testid="design-entries">
    {#each ENTRIES as e (e.href)}
      <ScreenCard {...e} testId={`entry-${e.code.toLowerCase()}`} />
    {/each}
  </div>

  <div class="note diff">
    Every sheet is running code, not a screenshot — the demos run, the motion animates, and
    the app you're reading this in loads the same two stylesheets they do.
  </div>
</div>

<style>
  .wrap {
    max-width: 940px; margin: 0 auto; width: 100%;
    padding: calc(var(--u) * 8) calc(var(--u) * 5) calc(var(--u) * 12);
  }
  .kicker { margin: 0 0 calc(var(--u) * 2); }
  h1 { margin-bottom: calc(var(--u) * 3); }
  .lead { max-width: 58ch; margin-bottom: calc(var(--u) * 6); }
  .cards {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: calc(var(--u) * 2.5); margin-bottom: calc(var(--u) * 5);
  }
</style>
