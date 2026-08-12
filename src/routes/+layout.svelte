<script>
  import { page } from '$app/state';
  import NavMenu from '$lib/NavMenu.svelte';
  import '../app.css';

  let { children } = $props();

  const NAV = [
    { href: '/paper', code: 'PA', label: 'Full Paper' },
    { href: '/presentation', code: 'PR', label: 'Presentation' },
  ];

  /** @param {string} href */
  const isActive = (href) => page.url.pathname === href || page.url.pathname.startsWith(href + '/');
</script>

<div class="shell">
  <header class="topbar mat-anodised" data-testid="topbar">
    <a class="brand" href="/" data-testid="brand">
      <span class="led" style="--c:var(--tint)" aria-hidden="true"></span>
      <span class="brand-text">WAM<span class="dim">·2026</span></span>
    </a>

    <nav class="mainnav" aria-label="Main">
      <!-- Design System is a menu because the section has real
           sub-pages; the other two are single destinations and stay
           plain links. -->
      <NavMenu />
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

    <span class="mono topmeta" data-testid="topbar-meta">Key Clark · 21 Aug 2026</span>
  </header>

  <main class="content">
    {@render children()}
  </main>
</div>

<style>
  .shell { min-height: 100vh; display: flex; flex-direction: column; }

  /* .mat-anodised carries the surface; only structure is set here */
  .topbar {
    position: sticky; top: 0; z-index: 40;
    display: flex; align-items: center; gap: calc(var(--u) * 3);
    padding: 0 calc(var(--u) * 3);
    height: 52px; flex: none;
    box-shadow: var(--edge), var(--lift-1);
    border-bottom: var(--hair) solid var(--hz-300);
  }

  .brand { display: flex; align-items: center; gap: 10px; text-decoration: none; flex: none; }
  .brand-text {
    font-family: var(--mono); font-size: 12px; letter-spacing: 0.16em;
    color: var(--hz-900); text-transform: uppercase;
  }
  .brand-text .dim { color: var(--hz-400); }

  .mainnav { display: flex; align-items: center; gap: 2px; }
  /* colour comes from .mono (hz-500); an hz-400 override here was
     barely legible against the anodised bar */
  .topmeta { margin-left: auto; flex: none; font-size: 9.5px; }

  .content { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }

  @media (max-width: 720px) {
    .topbar { gap: calc(var(--u) * 1.5); padding: 0 calc(var(--u) * 2); }
    .topmeta { display: none; }
  }
</style>
