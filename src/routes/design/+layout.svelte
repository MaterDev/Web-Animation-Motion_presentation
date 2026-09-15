<script>
  import { page } from '$app/state';
  import { browser } from '$app/environment';
  import { PAGES, SHEETS, TREATMENTS, sheetHref } from '$lib/sheets.js';

  let { children } = $props();

  /* One sidebar for the whole section, so the methodology, the
     treatments write-up and every live sheet are siblings in the same
     place. The methodology used to be the section's landing page;
     moving it here makes it a page you navigate to like any other,
     and leaves the landing page free to be short. */

  /* Reading url.searchParams during prerender throws — a prerendered
     page has to be byte-identical whatever query string requests it.
     Guarding on `browser` means the sidebar prerenders with nothing
     marked current and resolves the highlight on hydration, which is
     the same trade the viewer itself makes. */
  const sheetParam = $derived(
    browser ? (page.url.searchParams.get('sheet') ?? '').toLowerCase() : ''
  );

  const groups = $derived([
    /* PAGES and sheets are mapped through the same shape rather than
       spread as-is: mixing two object shapes in one list gives the
       sidebar a union type where half the fields only exist on one
       branch, and every access has to be guarded. Normalising once
       here is cheaper than guarding at every use site. */
    { label: 'Section', items: PAGES.map(toPage) },
    { label: 'Reference', items: SHEETS.filter((s) => s.group === 'Reference').map(toItem) },
    { label: 'Techniques', items: SHEETS.filter((s) => s.group === 'Techniques').map(toItem) },
    { label: 'Treatments', items: TREATMENTS.map(toItem) },
  ]);

  /** @param {any} p */
  function toPage(p) {
    return {
      code: p.code,
      name: p.name,
      note: p.note,
      tint: '',
      kept: false,
      href: p.href,
      current: page.url.pathname === p.href,
    };
  }

  /** @param {any} s */
  function toItem(s) {
    const href = sheetHref(s.code);
    return {
      code: s.code,
      name: s.name,
      note: s.note,
      tint: s.tint ?? '',
      kept: Boolean(s.kept),
      href,
      /* a sheet is current only when the viewer is open on it —
         compare the param, not the path, since every sheet shares
         the /design/reference route */
      current: page.url.pathname === '/design/reference' && sheetParam === s.code.toLowerCase(),
    };
  }
</script>

<div class="section">
  <aside class="side" data-testid="design-sidebar">
    {#each groups as g (g.label)}
      <p class="grp">{g.label}</p>
      {#each g.items as item (item.href)}
        <a
          class="item"
          class:active={item.current}
          href={item.href}
          style={item.tint ? `--ct:${item.tint}` : ''}
          aria-current={item.current ? 'page' : undefined}
          data-testid={`side-${item.code.toLowerCase()}`}
        >
          <span class="item-code">{item.code}</span>
          <span class="item-name">
            {item.name}{#if item.kept}<span class="kept" data-testid={`side-${item.code.toLowerCase()}-kept`}>chosen</span>{/if}
          </span>
          {#if item.note}<span class="item-note">{item.note}</span>{/if}
        </a>
      {/each}
    {/each}
  </aside>

  <div class="pane">
    {@render children()}
  </div>
</div>

<style>
  .section { display: grid; grid-template-columns: 280px minmax(0, 1fr); flex: 1 1 auto; min-height: 0; }

  .side {
    display: flex; flex-direction: column; gap: 1px;
    padding: calc(var(--u) * 2) calc(var(--u) * 1.5) calc(var(--u) * 5);
    background: var(--hz-050);
    border-right: var(--hair) solid var(--hz-300);
    overflow-y: auto;
    height: calc(100vh - 52px); position: sticky; top: 52px;
  }
  .grp {
    font-family: var(--mono); font-size: 9px; letter-spacing: 0.18em;
    text-transform: uppercase; color: var(--hz-400);
    margin: calc(var(--u) * 2.5) 0 calc(var(--u) * 0.75); padding: 0 calc(var(--u) * 1.5);
  }
  .grp:first-child { margin-top: calc(var(--u) * 0.5); }

  .item {
    display: grid; grid-template-columns: 44px minmax(0, 1fr); gap: 3px 8px;
    padding: 8px calc(var(--u) * 1.5); border-radius: 4px; text-decoration: none;
    transition: background var(--dur-fast) var(--ease-standard);
  }
  .item:hover { background: var(--hz-100); }
  .item:focus-visible { outline: 2px solid var(--tint); outline-offset: -2px; }
  .item-code {
    font-family: var(--mono); font-size: 9px; letter-spacing: 0.1em;
    color: var(--ct, var(--hz-400)); padding-top: 2px;
  }
  .item-name { font-size: 13px; color: var(--hz-700); display: flex; align-items: baseline; gap: 7px; }
  /* same decision marker as the treatments list, at sidebar scale */
  .kept {
    align-self: center;
    font-family: var(--mono); font-size: 9px; font-weight: 600; letter-spacing: 0.12em;
    text-transform: uppercase; color: var(--hz-000); background: var(--ok);
    padding: 2px 6px; border-radius: 3px;
  }
  .item-note {
    grid-column: 2; font-family: var(--mono); font-size: 8.5px; line-height: 1.55;
    color: var(--hz-400);
  }
  .item.active { background: color-mix(in oklch, var(--ct, var(--tint)) 16%, var(--hz-100)); }
  .item.active .item-name { color: var(--hz-900); }

  .pane { display: flex; flex-direction: column; min-width: 0; }

  @media (max-width: 980px) {
    .section { grid-template-columns: 1fr; }
    .side {
      height: auto; position: static; border-right: 0;
      border-bottom: var(--hair) solid var(--hz-300);
    }
  }
</style>
