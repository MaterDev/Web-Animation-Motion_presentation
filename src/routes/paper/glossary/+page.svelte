<script>
  import DocPage from '$lib/DocPage.svelte';
  let { data } = $props();
</script>

<DocPage
  {data}
  label="Paper · Glossary"
  testid="glossary"
  variant="glossary"
  headTitle="Glossary — Full Paper — WAM-2026"
  description="Shared language for web animation and motion: the ten terms to understand, and twenty more worth knowing, for every role on a project."
  back={{ href: '/paper', label: 'Full paper' }}
/>
