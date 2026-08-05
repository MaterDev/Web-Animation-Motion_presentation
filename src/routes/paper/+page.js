import { Marked } from 'marked';
import raw from '../../../SCOPE.md?raw';

/* Rendered at build time, not runtime: `?raw` inlines the file into
   the bundle and this module runs during prerender, so the shipped
   page is plain HTML with no markdown parser in the client payload.

   SCOPE.md stays the single source — it's the working document that
   gets edited during the build, and this route is a view of it
   rather than a copy. Edit the markdown, rebuild, the page follows. */

/* One slug function, used by BOTH the heading renderer and the table
   of contents. They have to agree, and the way they stop agreeing is
   by being written twice. The first version had no renderer at all
   and relied on marked adding ids — it doesn't — so every TOC link
   pointed at nothing. Caught by SvelteKit's prerender anchor check,
   which is the reason that check is left switched on. */
/** @param {string} s */
const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');

const marked = new Marked({ gfm: true, breaks: false });

marked.use({
  renderer: {
    heading({ tokens, text, depth }) {
      /* Slug from the token's RAW text, not from the parsed inline
         HTML. Slugging the rendered output looked equivalent and
         wasn't: "Format & Delivery" renders as "Format &amp;
         Delivery", which slugged to `format-amp-delivery` while the
         TOC — reading the markdown source — produced
         `format-delivery`. Every heading containing an entity was
         silently unreachable. Using token.text means both sides
         slug the identical string by construction. */
      const id = slug(text);
      return `<h${depth} id="${id}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
    },
  },
});

export function load() {
  const html = marked.parse(raw);

  /* TOC off the source rather than the rendered HTML: the source is
     stable, and re-parsing our own output to find headings would be
     a second place for the two to drift. */
  const toc = raw
    .split('\n')
    .filter((l) => l.startsWith('## '))
    .map((l) => l.slice(3).trim())
    .map((title) => ({ title, id: slug(title) }));

  return { html, toc };
}
