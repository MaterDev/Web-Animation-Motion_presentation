import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

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
  plugins: [
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
