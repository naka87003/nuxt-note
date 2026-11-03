<script setup lang="ts">
import type { SavedNote } from "#shared/types/note";
definePageMeta({ middleware: "auth", layout: "workspace" });
const { categoryId, filter, location } = useWorkspace();
async function saved(note: SavedNote) {
  await navigateTo(
    location(
      `/notes/${note.id}`,
      note.categoryId === categoryId.value
        ? filter.value
        : (note.categoryId ?? "uncategorized"),
    ),
  );
  await refreshNuxtData("workspace-list");
  await refreshNuxtData("workspace-categories");
}
</script>

<template>
  <NoteEditor @saved="saved" @cancel="navigateTo(location('/notes'))" />
</template>
