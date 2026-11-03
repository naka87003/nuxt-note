<script setup lang="ts">
import type { SavedNote } from "#shared/types/note";

definePageMeta({
  key: (route) => String(route.params.id),
  middleware: "auth",
  layout: "workspace",
});

const route = useRoute();
const { state, location } = useWorkspace();

const {
  data: note,
  error,
  refresh,
} = await useFetch(() => `/api/notes/${route.params.id}`);

const editing = ref(false);
const deletion = ref(false);
const busy = ref(false);
const failure = ref("");

const { data: categories } = useNuxtData<{
  items: { id: string; name: string }[];
}>("workspace-categories");

const categoryName = computed(
  () =>
    categories.value?.items.find((item) => item.id === note.value?.categoryId)
      ?.name ?? "Uncategorized",
);

async function saved(result: SavedNote) {
  const previousCategory = note.value?.categoryId;
  if (note.value) note.value = { ...note.value, ...result };
  editing.value = false;
  if (result.categoryId !== previousCategory)
    await navigateTo(
      location(route.path, result.categoryId ?? "uncategorized"),
      {
        replace: true,
      },
    );
  await Promise.all([
    refresh(),
    refreshNuxtData("workspace-list"),
    refreshNuxtData("workspace-categories"),
  ]);
}

async function remove() {
  if (busy.value || !note.value) return;
  busy.value = true;
  failure.value = "";
  try {
    await $fetch(`/api/notes/${note.value.id}`, { method: "DELETE" });
    deletion.value = false;
    state.value.notes.selected = "";
    await navigateTo(location("/notes"));
    await Promise.all([
      refreshNuxtData("workspace-list"),
      refreshNuxtData("workspace-categories"),
    ]);
  } catch {
    failure.value = "Could not delete the note. Please try again.";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="note-page">
    <NoteEditor
      v-if="editing && note"
      :note="note"
      @saved="saved"
      @cancel="editing = false"
    />
    <div v-else class="note-reader">
      <UAlert
        v-if="error"
        title="Could not open this note"
        description="The note may be unavailable. Return to the list or try again."
        color="error"
      >
        <template #actions>
          <UButton color="neutral" variant="soft" @click="refresh()">
            Try again
          </UButton>
        </template>
      </UAlert>
      <article v-else-if="note" class="space-y-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="text-sm text-dimmed">{{ categoryName }}</p>
          <div class="flex gap-2 note-reader-actions">
            <UButton color="neutral" variant="soft" @click="editing = true">
              Edit
            </UButton>
            <UButton
              color="neutral"
              variant="soft"
              @click="
                failure = '';
                deletion = true;
              "
            >
              Delete
            </UButton>
          </div>
        </div>
        <h1 class="wrap-break-word text-2xl font-semibold">{{ note.title }}</h1>
        <MarkdownContent v-if="note.markdown" :content="note.markdown" />
        <p v-else class="text-dimmed">This note is empty.</p>
      </article>
    </div>
    <UModal
      v-model:open="deletion"
      title="Delete note"
      :dismissible="!busy"
      :close="!busy"
    >
      <template #body>
        <UAlert
          v-if="failure"
          :title="failure"
          color="error"
          class="mb-4"
          role="alert"
        />
        <p>Permanently delete “{{ note?.title }}”? This cannot be undone.</p>
      </template>
      <template #footer>
        <UButton
          color="neutral"
          variant="ghost"
          class="min-h-11"
          :disabled="busy"
          @click="deletion = false"
        >
          Cancel
        </UButton>
        <UButton color="error" class="min-h-11" :loading="busy" @click="remove">
          Delete note
        </UButton>
      </template>
    </UModal>
  </div>
</template>
