/* The paper's section list, read one way for every consumer. The
   /paper route builds its table of contents from this and the home
   page's paper card builds its readout from it, so the two cannot
   disagree about what the sections are called or how many there are.

   One slug function, used by the heading renderer AND the contents.
   They have to agree, and the way they stop agreeing is by being
   written twice. */

/** @param {string} s */
export const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');

/* Off the markdown source rather than rendered HTML: the source is
   stable, and re-parsing rendered output would be a second place for
   the two to drift. */
/** @param {string} raw */
export const sections = (raw) =>
  raw
    .split('\n')
    .filter((l) => l.startsWith('## '))
    .map((l) => l.slice(3).trim())
    .map((title) => ({ title, id: slug(title) }));
