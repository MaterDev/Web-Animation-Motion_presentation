import { Marked } from 'marked';
import { slug, sections } from '$lib/paper.js';

/* THE PAPER'S MARKDOWN RENDERER, shared by /paper and /paper/glossary so the
   two documents slug, number and read their front matter the same way.
   Rendered at build time (the routes' load functions run during prerender),
   so no markdown parser ships to the client. */

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
   by hand because that is all the documents carry. */
const FRONT = /^---\n([\s\S]*?)\n---\n/;

const FIELDS = [
  ['presenter', 'Presenter'],
  ['presented', 'Presented'],
  ['drafted', 'Drafted'],
  ['revised', 'Revised'],
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* ISO dates read as "17 Sep 2026". Split by hand, not new Date(): a bare
   ISO date parses as UTC midnight and prints as the day before west of
   Greenwich. */
/** @param {string} v */
const readout = (v) => {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : v;
};

/**
 * @param {string} raw  the markdown source
 * @param {{ landmarks?: Record<string, string[] | true> }} [opts]
 *   landmarks: which `##` sections list their `###` children in the
 *   contents, and which children (true = all of them)
 */
export function renderDoc(raw, { landmarks = {} } = {}) {
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

  const html = /** @type {string} */ (marked.parse(body));
  const toc = outline(body, landmarks);
  return { html, toc, title, front };
}

/**
 * The contents: every `##`, and under the landmark ones only the `###`
 * children named for them. A contents list of every subheading is an
 * index, not a map; landmarks are the places a reader actually jumps to.
 * @param {string} body @param {Record<string, string[] | true>} landmarks
 */
export function outline(body, landmarks) {
  /** @type {{ title: string, id: string, children: { title: string, id: string }[] }[]} */
  const out = [];
  for (const line of body.split('\n')) {
    if (line.startsWith('## ')) {
      const title = line.slice(3).trim();
      out.push({ title, id: slug(title), children: [] });
    } else if (line.startsWith('### ') && out.length) {
      const parent = out[out.length - 1];
      const want = landmarks[parent.title];
      const title = line.slice(4).trim();
      if (want === true || (Array.isArray(want) && want.includes(title))) parent.children.push({ title, id: slug(title) });
    }
  }
  return out;
}

export { sections };
