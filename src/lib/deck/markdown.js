/* SPEAKER NOTES AS MARKDOWN.

   The editor is WYSIWYG, the file is Markdown: notes are written in the
   deck, and also by hand and with Claude in `deck-notes/<slide>.md`, so
   what is on disk has to read as a document rather than as markup.

   `htmlToMarkdown` covers exactly what the editor's toolbar can make —
   bold, italic, bullet and numbered lists (nested), the emphasis quote,
   headings a paste might bring, line breaks — and flattens anything else
   to its text rather than guessing. `markdownToHtml` is `marked`, which
   already ships with the app. It runs in the browser only: it needs a DOM. */
import { marked } from 'marked';

const BLOCK = new Set(['P', 'DIV', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'PRE']);

/** @param {string} md @returns {string} */
export function markdownToHtml(md) {
  return /** @type {string} */ (marked.parse(md ?? '', { async: false, gfm: true }));
}

/** @param {string} s */
const escapeText = (s) => s.replace(/ /g, ' ').replace(/[ \t\r\n]+/g, ' ').replace(/([\\`*_])/g, '\\$1');

/** Wrap with a marker, keeping edge spaces outside it — `** x**` is not bold.
 *  @param {string} inner @param {string} mark */
function wrap(inner, mark) {
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(inner);
  if (!m || !m[2]) return inner;
  return `${m[1]}${mark}${m[2]}${mark}${m[3]}`;
}

/** @param {Node} node @returns {string} */
function inline(node) {
  let out = '';
  for (const n of node.childNodes) {
    if (n.nodeType === Node.TEXT_NODE) out += escapeText(n.textContent ?? '');
    else if (n.nodeType === Node.ELEMENT_NODE) {
      const el = /** @type {Element} */ (n);
      const t = el.tagName;
      if (t === 'BR') out += '  \n';
      else if (t === 'B' || t === 'STRONG') out += wrap(inline(el), '**');
      else if (t === 'I' || t === 'EM') out += wrap(inline(el), '*');
      else if (t === 'CODE') out += '`' + (el.textContent ?? '') + '`';
      else if (t === 'A') out += `[${inline(el)}](${el.getAttribute('href') ?? ''})`;
      else out += inline(el);
    }
  }
  return out;
}

/** @param {Element} list @param {boolean} ordered @param {number} depth @returns {string} */
function listOf(list, ordered, depth) {
  /** @type {string[]} */
  const lines = [];
  let n = 1;
  for (const li of list.children) {
    if (li.tagName !== 'LI') continue;
    const nested = [...li.children].filter((c) => c.tagName === 'UL' || c.tagName === 'OL');
    const own = /** @type {Element} */ (li.cloneNode(true));
    for (const c of [...own.children]) if (c.tagName === 'UL' || c.tagName === 'OL') c.remove();
    const text = blocksOf(own).join(' ').trim();
    lines.push(`${'   '.repeat(depth)}${ordered ? `${n++}.` : '-'} ${text}`);
    for (const sub of nested) lines.push(listOf(sub, sub.tagName === 'OL', depth + 1));
  }
  return lines.join('\n');
}

/** @param {Node} node @returns {string[]} */
function blocksOf(node) {
  /** @type {string[]} */
  const out = [];
  /** @type {Node[]} */
  let run = [];
  const flush = () => {
    if (!run.length) return;
    const span = document.createElement('span');
    for (const r of run) span.appendChild(r.cloneNode(true));
    const text = inline(span).replace(/ +\n/g, '  \n').trim();
    if (text) out.push(text);
    run = [];
  };
  for (const n of node.childNodes) {
    const el = n.nodeType === Node.ELEMENT_NODE ? /** @type {Element} */ (n) : null;
    if (!el || !BLOCK.has(el.tagName)) {
      run.push(n);
      continue;
    }
    flush();
    const t = el.tagName;
    if (t === 'UL' || t === 'OL') out.push(listOf(el, t === 'OL', 0));
    else if (t === 'BLOCKQUOTE') {
      const inner = blocksOf(el).join('\n\n');
      if (inner.trim()) out.push(inner.split('\n').map((l) => (l ? `> ${l}` : '>')).join('\n'));
    } else if (/^H[1-6]$/.test(t)) {
      const s = inline(el).trim();
      if (s) out.push(`${'#'.repeat(Number(t[1]))} ${s}`);
    } else if (t === 'PRE') out.push('```\n' + (el.textContent ?? '') + '\n```');
    else out.push(...blocksOf(el));
  }
  flush();
  return out;
}

/** @param {string} html @returns {string} Markdown, no trailing newline; '' when empty. */
export function htmlToMarkdown(html) {
  const root = document.createElement('div');
  root.innerHTML = html ?? '';
  return blocksOf(root).join('\n\n').trim();
}
