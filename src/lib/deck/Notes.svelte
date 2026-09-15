<script>
  /* SPEAKER NOTES — a small rich-text editor over a Markdown file.

     contenteditable with a short toolbar, rather than a library. The
     formatting a speaker note actually needs is bold, italic, a list
     and a bit of emphasis for the thing you must not forget to say;
     that is a few hundred bytes of code against a few hundred
     kilobytes of dependency, and this is the one part of the app the
     audience never sees.

     `execCommand` is formally deprecated and has no replacement for
     this job. Every browser still implements it, and the alternative
     is hand-rolling a selection model. Noted deliberately so nobody
     "fixes" it later and finds out why it was there.

     AUTOSAVE. Key, 2026-09-15, after trying an explicit Save button:
     "lets just make it where the notes autosave … that way i dont have
     to ever think about it." So nothing asks to be saved: an edit is
     written 300 ms after typing pauses, at once when the editor loses
     focus, before the deck moves to another slide (under the slide it
     was typed on), and with a keepalive request when the page is hidden
     or closed. ⌘S still saves immediately for anyone with the habit.

     Still local only — the editor is read-only without the dev API —
     and still Markdown on disk: the editor shows HTML, the file is
     `deck-notes/<slide>.md`, so it can be edited by hand. */
  import { htmlToMarkdown, markdownToHtml } from './markdown.js';

  let { id, markdown = '', editable = false, file = '', onsave } = $props();

  /* Short enough to feel like saving as you type; long enough that a word
     is one write, not six. */
  const DEBOUNCE_MS = 300;

  /** @type {HTMLDivElement | null} */
  let editor = $state(null);
  let status = $state('');
  let dirty = $state(false);
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;
  /** @type {string | null} */
  let shownId = null;
  /** Saves run one after another, so an older write never lands last. */
  let chain = Promise.resolve();

  /** Write one slide's notes. `forId` and `html` are captured at call time,
   *  so a save queued before a slide change still writes the right file.
   *  @param {string} forId @param {string} html @param {boolean} [keepalive] */
  function write(forId, html, keepalive = false) {
    const md = htmlToMarkdown(html);
    chain = chain.then(async () => {
      if (forId === id) status = 'saving…';
      try {
        const r = await onsave?.(md, forId, keepalive);
        if (forId === id) {
          status = r?.file ? `saved · ${r.file}` : 'saved';
        }
      } catch (err) {
        status = `not saved — ${err instanceof Error ? err.message : 'the local notes API is not answering'}`;
      }
    });
    return chain;
  }

  /** Save now whatever is pending for the slide on screen. */
  function flush(keepalive = false) {
    clearTimeout(timer);
    if (!editable || !editor || !dirty || shownId === null) return;
    dirty = false;
    write(shownId, editor.innerHTML, keepalive);
  }

  /* Write into the DOM only when the SLIDE changes, or when its saved
     Markdown changes while nothing is being typed. Rewriting innerHTML
     on every keystroke would move the caret to the start of the field.
     Leaving a slide with unsaved typing saves it first, under that slide. */
  $effect(() => {
    const nextId = id;
    const md = markdown ?? '';
    const isDirty = dirty;
    if (!editor) return;
    if (shownId !== nextId) {
      if (shownId !== null && isDirty) {
        clearTimeout(timer);
        dirty = false;
        write(shownId, editor.innerHTML);
      }
      shownId = nextId;
      editor.innerHTML = markdownToHtml(md);
      status = '';
    } else if (!isDirty && document.activeElement !== editor) {
      editor.innerHTML = markdownToHtml(md);
    }
  });

  /* Closing or hiding the page saves what is pending, with keepalive so
     the request outlives the page. */
  $effect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') flush(true); };
    const onLeave = () => flush(true);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onLeave);
    return () => {
      flush(true);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onLeave);
    };
  });

  /** @param {string} name @param {string} [val] */
  function cmd(name, val) {
    if (!editable) return;
    editor?.focus();
    document.execCommand(name, false, val);
    changed();
  }

  function changed() {
    if (!editable) return;
    dirty = true;
    status = 'editing…';
    clearTimeout(timer);
    timer = setTimeout(() => flush(), DEBOUNCE_MS);
  }

  /** @param {KeyboardEvent} e */
  function keys(e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      flush();
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="notes" class:ro={!editable} data-testid="notes-editor" onkeydown={keys}>
  <div class="tools">
    <button type="button" disabled={!editable} onclick={() => cmd('bold')} title="Bold" data-testid="note-bold"><b>B</b></button>
    <button type="button" disabled={!editable} onclick={() => cmd('italic')} title="Italic" data-testid="note-italic"><i>I</i></button>
    <button type="button" disabled={!editable} onclick={() => cmd('insertUnorderedList')} title="Bullets" data-testid="note-ul">•</button>
    <button type="button" disabled={!editable} onclick={() => cmd('insertOrderedList')} title="Numbered" data-testid="note-ol">1.</button>
    <button type="button" disabled={!editable} onclick={() => cmd('formatBlock', 'blockquote')} title="Emphasis" data-testid="note-quote">❝</button>
    <button type="button" disabled={!editable} onclick={() => cmd('removeFormat')} title="Clear formatting" data-testid="note-clear">⨯</button>
    <span class="status" class:warn={status.startsWith('not saved')} title={file ? `Saves to ${file} as you type` : undefined} data-testid="note-status">{editable ? status : 'read-only · edit locally with bun run dev'}</span>
  </div>

  <div class="body" contenteditable={editable ? 'true' : 'false'} role="textbox" tabindex="0" aria-multiline="true"
       aria-readonly={!editable} aria-label="Speaker notes" bind:this={editor} oninput={changed} onblur={() => flush()}
       data-testid="note-body"></div>
</div>

<style>
  .notes { display: flex; flex-direction: column; gap: 0; }
  .tools { display: flex; align-items: center; gap: 3px; padding: 5px 6px;
    border: var(--hair) solid var(--hz-300); border-bottom: 0;
    border-radius: 6px 6px 0 0; background: var(--hz-100); }
  .tools button { font-family: var(--sans); font-size: 12px; line-height: 1;
    width: 26px; height: 24px; padding: 0; border-radius: 4px;
    border: var(--hair) solid transparent; background: none; color: var(--hz-600);
    cursor: pointer; text-transform: none; letter-spacing: 0; }
  .tools button:hover { background: var(--hz-200); border-color: var(--hz-300); color: var(--hz-900); }
  .tools button:disabled { opacity: 0.35; cursor: default; }
  .tools button:disabled:hover { background: none; border-color: transparent; color: var(--hz-600); }
  .status { margin-left: auto; font-family: var(--mono); font-size: 9px;
    letter-spacing: 0.1em; color: var(--hz-400); padding-right: 4px; }
  .status.warn { color: oklch(0.72 0.14 40); }
  .ro .body { background: var(--hz-100); color: var(--hz-600); }

  .body { min-height: 190px; max-height: 42vh; overflow-y: auto; padding: 11px 12px;
    border: var(--hair) solid var(--hz-300); border-radius: 0 0 6px 6px;
    background: var(--hz-050); color: var(--hz-800);
    font-family: var(--sans); font-size: 13px; line-height: 1.65; }
  .body:focus { outline: none; border-color: var(--hz-500); }
  .body:empty::before { content: 'Speaker notes for this slide…'; color: var(--hz-400); }

  .body :global(ul), .body :global(ol) { margin: 6px 0; padding-left: 20px; }
  .body :global(li) { margin: 2px 0; }
  .body :global(blockquote) { margin: 8px 0; padding-left: 10px;
    border-left: 2px solid var(--tint-svg); color: var(--hz-900); font-weight: 500; }
  .body :global(b), .body :global(strong) { color: var(--hz-900); }
</style>
