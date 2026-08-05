<script>
  import { page } from '$app/state';
  import '../app.css';

  let { children } = $props();

  const NAV = [
    { href: '/design', code: 'DS', label: 'Design System' },
    { href: '/paper', code: 'PA', label: 'Full Paper' },
    { href: '/presentation', code: 'PR', label: 'Presentation' },
  ];

  /* startsWith rather than equality so /design/anything keeps the
     section lit — the design section will grow sub-routes. Guarded
     against '/' matching everything. */
  /** @param {string} href */
  const isActive = (href) => page.url.pathname === href || page.url.pathname.startsWith(href + '/');
</script>

<div class="shell">
  <header class="topbar" data-testid="topbar">
    <a class="brand" href="/" data-testid="brand">
      <span class="brand-mark" aria-hidden="true"></span>
      <span class="brand-text">WAM<span class="dim">·2026</span></span>
    </a>
    <nav class="mainnav" aria-label="Main">
      {#each NAV as item (item.href)}
        <a
          href={item.href}
          class="navlink"
          class:active={isActive(item.href)}
          aria-current={isActive(item.href) ? 'page' : undefined}
          data-testid={`nav-${item.code.toLowerCase()}`}
        >
          <span class="navcode">{item.code}</span>
          <span class="navlabel">{item.label}</span>
        </a>
      {/each}
    </nav>
    <span class="topmeta" data-testid="topbar-meta">Folklore · 21 Aug 2026</span>
  </header>

  <main class="content">
    {@render children()}
  </main>
</div>

<style>
  .shell { min-height: 100vh; display: flex; flex-direction: column; }

  .topbar {
    position: sticky; top: 0; z-index: 40;
    display: flex; align-items: center; gap: calc(var(--u) * 4);
    padding: 0 calc(var(--u) * 3);
    height: 52px; flex: none;
    background: linear-gradient(180deg, var(--hz-200), var(--hz-100));
    box-shadow: var(--edge), var(--lift-1);
    border-bottom: var(--hair) solid var(--hz-300);
  }

  .brand { display: flex; align-items: center; gap: 9px; text-decoration: none; flex: none; }
  .brand-mark {
    width: 11px; height: 11px; border-radius: 2px; background: var(--tint);
    box-shadow: 0 0 10px color-mix(in oklch, var(--tint) 60%, transparent);
  }
  .brand-text {
    font-family: var(--mono); font-size: 12px; letter-spacing: 0.16em;
    color: var(--hz-900); text-transform: uppercase;
  }
  .brand-text .dim { color: var(--hz-400); }

  .mainnav { display: flex; align-items: center; gap: 2px; }
  .navlink {
    display: flex; align-items: baseline; gap: 8px;
    padding: 7px 12px; border-radius: 4px; text-decoration: none;
    transition: background var(--dur-fast) var(--ease-standard),
                color var(--dur-fast) var(--ease-standard);
  }
  .navcode {
    font-family: var(--mono); font-size: 9px; letter-spacing: 0.14em;
    color: var(--hz-400); text-transform: uppercase;
  }
  .navlabel { font-size: 13.5px; color: var(--hz-600); }
  .navlink:hover { background: var(--hz-200); }
  .navlink:hover .navlabel { color: var(--hz-800); }
  .navlink:focus-visible { outline: 2px solid var(--tint); outline-offset: 1px; }

  /* active gets the tint, matching every other "engaged" control in
     the system — colour is reserved for state, not decoration */
  .navlink.active { background: color-mix(in oklch, var(--tint) 15%, var(--hz-100)); }
  .navlink.active .navlabel { color: var(--hz-900); }
  .navlink.active .navcode { color: var(--tint); }

  .topmeta {
    margin-left: auto; flex: none;
    font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.14em;
    color: var(--hz-400); text-transform: uppercase;
  }

  .content { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }

  @media (max-width: 720px) {
    .topbar { gap: calc(var(--u) * 2); padding: 0 calc(var(--u) * 2); }
    .navlabel { display: none; }
    .topmeta { display: none; }
  }
</style>
