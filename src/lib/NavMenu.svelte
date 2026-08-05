<script>
  import { page } from '$app/state';
  import { PAGES, SHEETS, TREATMENTS, sheetHref } from '$lib/sheets.js';

  /* A disclosure, not a custom "menu" widget. The panel contains
     links, so it stays links — real anchors, real focus order, real
     open-in-new-tab. Building it as an ARIA menu/menuitem would mean
     reimplementing focus roving and would tell a screen reader these
     are application commands, which they aren't; they're navigation.

     Keyboard: Escape closes and returns focus to the trigger, arrows
     step through the links, and a click outside dismisses. */

  let open = $state(false);
  /** @type {HTMLElement | null} */
  let root = $state(null);
  /** @type {HTMLButtonElement | null} */
  let trigger = $state(null);

  /* both shapes normalised through mappers so the list isn't a union
     type with half its fields optional at every use site */
  const sections = $derived([
    { label: null, items: PAGES.map(toPage) },
    { label: 'Reference', items: SHEETS.filter((s) => s.group === 'Reference').map(toSheet) },
    { label: 'Techniques', items: SHEETS.filter((s) => s.group === 'Techniques').map(toSheet) },
    { label: 'Treatments', items: TREATMENTS.map(toSheet) },
  ]);

  /** @param {any} p */
  function toPage(p) {
    return { code: p.code, name: p.name, note: p.note, tint: '', href: p.href };
  }

  /** @param {any} s */
  function toSheet(s) {
    return { code: s.code, name: s.name, note: s.note, tint: s.tint ?? '', href: sheetHref(s.code) };
  }

  function close() {
    open = false;
  }

  /** @param {KeyboardEvent} e */
  function onKeydown(e) {
    if (e.key === 'Escape' && open) {
      e.stopPropagation();
      close();
      trigger?.focus();
      return;
    }
    if (!open || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
    const links = [...(root?.querySelectorAll('a.mi') ?? [])];
    if (!links.length) return;
    e.preventDefault();
    const i = links.indexOf(/** @type {any} */ (document.activeElement));
    const next = e.key === 'ArrowDown' ? (i + 1) % links.length : (i - 1 + links.length) % links.length;
    /** @type {HTMLElement} */ (links[i === -1 ? 0 : next]).focus();
  }

  /* Close on any successful navigation. Watching page.url rather
     than wiring an onclick to every link means it also closes for
     keyboard activation and browser back/forward. */
  $effect(() => {
    page.url.pathname;
    page.url.search;
    close();
  });
</script>

<svelte:window
  onkeydown={onKeydown}
  onpointerdown={(e) => {
    if (open && root && !root.contains(/** @type {Node} */ (e.target))) close();
  }}
/>

<div class="navmenu" bind:this={root}>
  <button
    type="button"
    class="navlink trigger"
    class:active={page.url.pathname.startsWith('/design')}
    aria-expanded={open}
    aria-controls="design-menu"
    bind:this={trigger}
    onclick={() => (open = !open)}
    data-testid="nav-ds"
  >
    <span class="navcode">DS</span>
    <span class="navlabel">Design System</span>
    <span class="caret" class:up={open} aria-hidden="true">▾</span>
  </button>

  {#if open}
    <div class="panel plate" id="design-menu" data-testid="design-menu">
      {#each sections as sec, si (sec.label ?? si)}
        {#if sec.label}<p class="grp">{sec.label}</p>{/if}
        <div class="col">
          {#each sec.items as item (item.href)}
            <a
              class="mi"
              href={item.href}
              style={item.tint ? `--ct:${item.tint}` : ''}
              data-testid={`menu-${item.code.toLowerCase()}`}
            >
              <span class="mi-code">{item.code}</span>
              <span class="mi-name">{item.name}</span>
            </a>
          {/each}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .navmenu { position: relative; }
  .trigger { border: 0; background: transparent; cursor: pointer; font: inherit; }
  .caret { font-size: 8px; color: var(--hz-400); transition: transform var(--dur-fast) var(--ease-standard); }
  .caret.up { transform: rotate(180deg); }

  .panel {
    position: absolute; top: calc(100% + 6px); left: 0; z-index: 60;
    min-width: 460px; padding: calc(var(--u) * 2);
    display: grid; grid-template-columns: 1fr 1fr; gap: 2px calc(var(--u) * 3);
    align-content: start;
  }
  /* group label spans both columns so a section reads as a heading
     over its own list rather than sitting in one column */
  .grp {
    grid-column: 1 / -1;
    font-family: var(--mono); font-size: 9px; letter-spacing: 0.18em;
    text-transform: uppercase; color: var(--hz-400);
    margin: calc(var(--u) * 2) 0 calc(var(--u) * 0.5); padding: 0 8px;
  }
  .grp:first-child { margin-top: 0; }
  .col { grid-column: 1 / -1; display: grid; grid-template-columns: 1fr 1fr; gap: 2px calc(var(--u) * 3); }

  .mi {
    display: flex; align-items: baseline; gap: 10px;
    padding: 7px 8px; border-radius: 3px; text-decoration: none;
    transition: background var(--dur-fast) var(--ease-standard);
  }
  .mi:hover { background: var(--hz-200); }
  .mi:focus-visible { outline: 2px solid var(--tint); outline-offset: -2px; }
  .mi-code {
    flex: none; width: 40px;
    font-family: var(--mono); font-size: 9px; letter-spacing: 0.1em;
    color: var(--ct, var(--hz-400));
  }
  .mi-name { font-size: 13px; color: var(--hz-600); }
  .mi:hover .mi-name { color: var(--hz-900); }

  @media (max-width: 720px) {
    .panel { min-width: 280px; grid-template-columns: 1fr; }
    .col { grid-template-columns: 1fr; }
  }
</style>
