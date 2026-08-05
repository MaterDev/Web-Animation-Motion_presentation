/* Prerender everything — the whole site is static (see
   svelte.config.js). Set here rather than per-route so a new route
   is prerendered by default and has to opt *out*, which is the safer
   direction for a site that must deploy as plain files. */
export const prerender = true;
