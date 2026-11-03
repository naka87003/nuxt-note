<script setup lang="ts">
definePageMeta({ middleware: "auth" });
const route = useRoute();
const { data: note, error } = await useFetch(
  () => `/api/notes/${route.params.id}`,
);
</script>

<template>
  <UContainer class="max-w-4xl space-y-6 py-8 sm:py-12">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <UButton
        to="/notes"
        variant="ghost"
        color="neutral"
        icon="i-lucide-arrow-left"
        class="min-h-11"
        >All notes</UButton
      >
      <UButton to="/notes/new" icon="i-lucide-plus" class="min-h-11"
        >New note</UButton
      >
    </div>
    <UAlert
      v-if="error"
      title="Could not open this note"
      description="The note may be unavailable. Return to All notes and try again."
      color="error"
    />
    <article v-else-if="note" class="space-y-6">
      <h1 class="break-words text-3xl font-bold">{{ note.title }}</h1>
      <p class="text-sm text-dimmed">Saved · Markdown source</p>
      <div
        class="whitespace-pre-wrap break-words rounded-lg border border-default bg-muted p-5 font-mono text-sm leading-relaxed"
      >
        {{ note.markdown || "This note is empty." }}
      </div>
    </article>
  </UContainer>
</template>
