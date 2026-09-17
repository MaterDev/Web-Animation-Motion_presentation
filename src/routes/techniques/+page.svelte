<script>
  /* The technique sheets, one per rendering technique, in the talk's
     comprehension-ladder order. */
  import SheetViewer from '$lib/SheetViewer.svelte';
  import { TECHNIQUES } from '$lib/sheets.js';
</script>

<SheetViewer sheets={TECHNIQUES} section="Techniques" />
