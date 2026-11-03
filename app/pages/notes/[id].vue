<script setup lang="ts">
definePageMeta({ middleware: "auth", layout: "workspace" });
const route = useRoute();
const { data: note, error } = await useFetch(
  () => `/api/notes/${route.params.id}`,
);
</script>

<template>
  <div class="note-reader">
    <UAlert
      v-if="error"
      title="Could not open this note"
      description="The note may be unavailable. Return to the list and try again."
      color="error"
    />
    <article v-else-if="note" class="space-y-6">
      <h1 class="break-words text-2xl font-semibold">{{ note.title }}</h1>
      <p class="text-sm text-dimmed">Saved · Markdown source</p>
      <pre class="note-source">{{
        note.markdown || "This note is empty."
      }}</pre>
    </article>
  </div>
</template>
