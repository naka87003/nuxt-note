<script setup lang="ts">
import type { SavedNote } from "#shared/types/note";
definePageMeta({
  middleware: "auth",
  layout: "workspace",
  // A new creation destination needs a fresh editor snapshot after route guards.
  key: (route) => route.fullPath,
});
const { categoryId, filter, location } = useWorkspace();
const { consume, returnTo: draftReturnTo } = useNoteDraftHandoff();
// Consume once. Reloading or opening another new-note screen starts a blank note.
const transfer = consume();
draftReturnTo.value = transfer?.returnTo ?? null;
onBeforeUnmount(() => {
  draftReturnTo.value = null;
});
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
  <NoteEditor
    :initial-draft="transfer?.draft"
    @saved="saved"
    @cancel="navigateTo(transfer?.returnTo ?? location('/notes'))"
  />
</template>
