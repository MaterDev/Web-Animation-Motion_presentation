import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { deckApi } from './scripts/deck-api.js';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

/* Config lives here rather than in a svelte.config.js — that's the
   current SvelteKit shape (verified against what `sv create`
   generates on the latest CLI, not from memory). The adapter and the
   Svelte compiler options are both passed to the sveltekit() plugin.

   Static output: every route is prerenderable (see
   src/routes/+layout.js). The app is a reference site plus a
   presenter-driven deck with no server-side anything, which is what
   SCOPE.md's "Out of Scope" already commits to. Static also means it
   deploys identically to Netlify, Render, or a plain file server, so
   the hosting decision stays open instead of being baked in now.

   `strict: true` makes the build fail if a route can't be
   prerendered, rather than silently shipping a broken page. */
export default defineConfig({
  server: {
    // SvelteKit's default fs.allow only covers src/, .svelte-kit/ and
    // node_modules — src/app.css @imports design/system/fonts.css,
    // whose url()s resolve to design/vendor/fonts/*.woff2 (gitignored,
    // built by `bun run vendor`). Those requests 403'd with "outside
    // of Vite serving allow list" until the project root itself was
    // added here; confirmed live in a browser, not assumed from docs.
    fs: { allow: [projectRoot] },
    // The phone runs the remote control, so the dev server has to be
    // reachable from the LAN rather than only from localhost.
    host: true,
  },
  plugins: [
    // Presenter-only, dev-only: remote control and notes storage. It
    // is `apply: 'serve'`, so the static build is untouched.
    deckApi(),
    sveltekit({
      compilerOptions: {
        // Force runes mode project-wide, except for libraries.
        // Can be removed in Svelte 6.
        runes: ({ filename }) =>
          filename.split(/[/\\]/).includes('node_modules') ? undefined : true,
      },
      adapter: adapter({
        pages: 'build',
        assets: 'build',
        precompress: false,
        strict: true,
      }),
    }),
  ],
});
