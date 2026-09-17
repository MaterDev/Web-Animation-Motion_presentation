<script>
  /* The design system's reference sheets. Old ?sheet= links to a
     technique sheet are forwarded to /techniques, where those live now. */
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import SheetViewer from '$lib/SheetViewer.svelte';
  import { VIEWABLE, TECHNIQUES, indexIn, techniqueHref } from '$lib/sheets.js';

  $effect(() => {
    const code = page.url.searchParams.get('sheet');
    if (indexIn(VIEWABLE, code) < 0 && indexIn(TECHNIQUES, code) >= 0) goto(techniqueHref(String(code)), { replaceState: true });
  });
</script>

<SheetViewer sheets={VIEWABLE} section="Design Reference" />
