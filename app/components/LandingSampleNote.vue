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
  <div class="sample-note">
    <p class="sample-note-meta">
      <span>Nuxt</span>
      <span aria-hidden="true">·</span>
      <span>Created Nov 1</span>
      <span aria-hidden="true">·</span>
      <span>Updated Nov 3, 10:24</span>
    </p>
    <LandingMarkdownContent variant="note" :content="content" />
  </div>
</template>

<style scoped>
.sample-note {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 32px;
  --landing-code-radius: 4px;
  --landing-code-size: 14px;
  --landing-code-white-space: pre;
  --landing-code-wrap: normal;
}
.sample-note-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  column-gap: 4px;
  margin-bottom: 24px;
  color: var(--ui-text-dimmed);
  font-size: 12px;
  line-height: 16px;
  overflow-wrap: anywhere;
}
@media (max-width: 767px) {
  .sample-note {
    padding: 16px;
  }
}
</style>
