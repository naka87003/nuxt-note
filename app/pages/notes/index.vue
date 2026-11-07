<script setup lang="ts">
definePageMeta({ middleware: "auth", layout: "workspace" });
const { filter, createLocation } = useWorkspace();
</script>

<template>
  <div class="workspace-empty">
    <UIcon name="i-lucide-notebook-pen" class="size-10 text-primary" />
    <h2 class="w-full text-2xl font-semibold wrap-anywhere">
      Your new note starts here.
    </h2>
    <p class="text-sm text-dimmed md:text-base">
      Select a note or create a new one.
    </p>
    <UButton
      :to="createLocation(filter)"
      icon="i-lucide-plus"
      class="font-bold"
    >
      New note
    </UButton>
  </div>
</template>
