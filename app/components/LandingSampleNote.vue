<script setup lang="ts">
const content = `### Nuxt data fetching

#### Overview

Use useFetch for URL-based requests and useAsyncData for custom async logic. Keep these patterns handy while building your application.

#### useFetch

Fetch data from a URL with built-in support for SSR and hydration.

\`\`\`ts
const { data } = await useFetch('/api/notes')
// Keep the response in your note
\`\`\`

#### Checklist

- Define the response type
- Handle loading and errors
- Refresh when filters change

> Keep each note focused so it is easy to revisit.`;
</script>

<template>
  <LandingMarkdownContent
    class="sample-note"
    variant="note"
    :content="content"
  />
</template>

<style scoped>
.sample-note {
  min-height: 0;
  overflow: auto;
  padding: 32px;
  --landing-code-radius: 4px;
  --landing-code-size: 14px;
  --landing-code-white-space: pre;
  --landing-code-wrap: normal;
}
</style>
