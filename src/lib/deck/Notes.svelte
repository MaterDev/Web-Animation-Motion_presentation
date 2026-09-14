<script>
  /* SPEAKER NOTES — a small rich-text editor.

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

     Notes save to the dev API (a real file on disk) so the phone can
     read them and so they survive the browser. Saving is debounced,
     and a failed save says so rather than pretending. */
  let { id, html = '', onsave } = $props();

  /** @type {HTMLDivElement | null} */
  let editor = $state(null);
  let status = $state('');
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;

  /* Only write into the DOM when the SLIDE changes. Rewriting
     innerHTML on every keystroke would move the caret to the start of
     the field on every character typed. */
  $effect(() => {
    void id;
    if (editor) editor.innerHTML = html ?? '';
    status = '';
  });

  /** @param {string} name @param {string} [val] */
  function cmd(name, val) {
    editor?.focus();
    document.execCommand(name, false, val);
    queue();
  }

  function queue() {
    clearTimeout(timer);
    status = 'editing…';
    timer = setTimeout(async () => {
      const body = editor?.innerHTML ?? '';
      try {
        await onsave?.(body);
        status = 'saved';
      } catch {
        status = 'not saved — dev server only';
      }
    }, 450);
  }
</script>

<div class="notes" data-testid="notes-editor">
  <div class="tools">
    <button type="button" onclick={() => cmd('bold')} title="Bold" data-testid="note-bold"><b>B</b></button>
    <button type="button" onclick={() => cmd('italic')} title="Italic" data-testid="note-italic"><i>I</i></button>
    <button type="button" onclick={() => cmd('insertUnorderedList')} title="Bullets" data-testid="note-ul">•</button>
    <button type="button" onclick={() => cmd('insertOrderedList')} title="Numbered" data-testid="note-ol">1.</button>
    <button type="button" onclick={() => cmd('formatBlock', 'blockquote')} title="Emphasis" data-testid="note-quote">❝</button>
    <button type="button" onclick={() => cmd('removeFormat')} title="Clear formatting" data-testid="note-clear">⨯</button>
    <span class="status" data-testid="note-status">{status}</span>
  </div>

  <div class="body" contenteditable="true" role="textbox" tabindex="0" aria-multiline="true"
       aria-label="Speaker notes" bind:this={editor} oninput={queue}
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
  .status { margin-left: auto; font-family: var(--mono); font-size: 9px;
    letter-spacing: 0.1em; color: var(--hz-400); padding-right: 4px; }

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
