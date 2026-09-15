<script>
  /* One slide's own URL: /presentation/<slide id>. The same deck as
     /presentation, opened on that slide. */
  import Deck from '$lib/deck/Deck.svelte';

  let { data } = $props();
</script>

<Deck start={data.i} />
