<script>
  import DocPage from '$lib/DocPage.svelte';
  let { data } = $props();
</script>

<DocPage
  {data}
  headTitle="Full Paper — WAM-2026"
  description="The paper behind the Web Animation & Motion talk: the techniques on a comprehension ladder, composites, performance budgets, getting motion shipped, and a verified bibliography."
  heroLink={{ href: '/paper/glossary', kicker: 'Sub-page · 30 terms', title: 'Glossary' }}
  callout={{ after: 'Getting it across the line', href: '/paper/glossary', title: 'Glossary', note: 'The ten terms to understand, and twenty more worth knowing.' }}
/>
