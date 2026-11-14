<script setup lang="ts">
import type { SavedNote } from "#shared/types/note";
import { assertNavigationSucceeded } from "~/utils/navigation";
definePageMeta({
  middleware: "auth",
  layout: "workspace",
  // A new creation destination needs a fresh editor snapshot after route guards.
  key: (route) => route.fullPath,
});
const { categoryId, filter, location } = useWorkspace();
const toast = useToast();
const { consume } = useNoteDraftHandoff();
// Consume once. Reloading or opening another new-note screen starts a blank note.
const transfer = consume();
async function saved(note: SavedNote) {
  const destination = location(
    `/notes/${note.id}`,
    note.categoryId === categoryId.value
      ? filter.value
      : (note.categoryId ?? "uncategorized"),
  );
  try {
    assertNavigationSucceeded(await navigateTo(destination));
    await Promise.all([
      refreshNuxtData("workspace-list"),
      refreshNuxtData("workspace-categories"),
    ]);
  } catch {
    toast.add({
      title: "Note saved",
      description:
        "The note was saved, but the view could not be refreshed. Open the saved note or reload.",
      color: "warning",
      actions: [{ label: "Open note", to: destination }],
    });
  }
}
</script>

<template>
  <NoteEditor
    :initial-draft="transfer?.draft"
    @saved="saved"
    @cancel="navigateTo(transfer?.returnTo ?? location('/notes'))"
  />
</template>
