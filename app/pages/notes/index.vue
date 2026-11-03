<script setup lang="ts">
definePageMeta({ middleware: "auth", layout: "workspace" });
const { location } = useWorkspace();
</script>

<template>
  <div class="workspace-empty">
    <UIcon name="i-lucide-notebook-pen" class="size-10 text-primary" />
    <h2 class="text-2xl font-semibold">Your notebook starts here.</h2>
    <p class="text-dimmed">Select a note or capture a new idea.</p>
    <UButton :to="location('/notes/new')" icon="i-lucide-plus" class="font-bold"
      >New note</UButton
    >
  </div>
</template>
