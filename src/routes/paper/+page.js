import { Marked } from 'marked';
import raw from '../../../SCOPE.md?raw';
import { slug, sections } from '$lib/paper.js';

/* Rendered at build time, not runtime: `?raw` inlines the file into
   the bundle and this module runs during prerender, so the shipped
   page is plain HTML with no markdown parser in the client payload.

   SCOPE.md stays the single source — it's the working document that
   gets edited during the build, and this route is a view of it
   rather than a copy. Edit the markdown, rebuild, the page follows. */

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

/* Front matter: flat `key: value` lines between `---` fences. Parsed
   by hand because that is all the paper carries, and a YAML
   dependency for four dates would be most of this module's weight. */
const FRONT = /^---\n([\s\S]*?)\n---\n/;

/* The readout, in reading order. Keys the paper doesn't set are
   skipped rather than printed blank. */
const FIELDS = [
  ['presenter', 'Presenter'],
  ['presented', 'Presented'],
  ['drafted', 'Drafted'],
  ['revised', 'Revised'],
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* ISO dates read as "17 Sep 2026", the form the rest of the site's
   readouts use. Split by hand, not new Date(): a bare ISO date parses
   as UTC midnight and prints as the day before west of Greenwich. */
/** @param {string} v */
const readout = (v) => {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : v;
};

export function load() {
  const fm = raw.match(FRONT);
  /** @type {Record<string, string>} */
  const meta = {};
  for (const line of (fm?.[1] ?? '').split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  const front = FIELDS.filter(([k]) => meta[k]).map(([key, label]) => ({ key, label, value: readout(meta[key]) }));

  /* The title moves into the front panel, so it comes out of the body
     rather than rendering twice. */
  let body = fm ? raw.slice(fm[0].length) : raw;
  const h1 = body.match(/^\s*# (.+)\n/);
  const title = h1 ? h1[1].trim() : '';
  if (h1) body = body.slice(h1[0].length);

  const html = marked.parse(body);

  const toc = sections(body);

  return { html, toc, title, front };
}
