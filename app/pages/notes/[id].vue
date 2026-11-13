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
        class="note-reader-error"
      >
        <template #actions>
          <UButton color="neutral" variant="soft" @click="refresh()">
            Try again
          </UButton>
        </template>
      </UAlert>
      <article v-else-if="note">
        <div class="note-reader-toolbar">
          <p
            class="note-reader-meta flex flex-wrap items-baseline gap-x-1 text-xs text-dimmed"
          >
            <span class="wrap-break-word">{{ categoryName }}</span>
            <span aria-hidden="true">·</span>
            <span>
              Created
              <NuxtTime
                :datetime="note.createdAt"
                locale="en-US"
                month="short"
                day="numeric"
              />
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Updated
              <NuxtTime
                :datetime="note.updatedAt"
                locale="en-US"
                month="short"
                day="numeric"
                hour="2-digit"
                minute="2-digit"
                hour-cycle="h23"
              />
            </span>
          </p>
          <div class="ml-auto flex shrink-0 gap-2 note-reader-actions">
            <UButton
              color="primary"
              variant="solid"
              class="min-w-20 justify-center"
              @click="editing = true"
            >
              Edit
            </UButton>
            <UButton
              :to="{
                path: '/chats/new',
                query: {
                  category: note.categoryId ?? 'uncategorized',
                  note: note.id,
                },
              }"
              color="neutral"
              variant="soft"
              icon="i-lucide-message-circle"
              :ui="{ leadingIcon: 'size-4' }"
              class="justify-center"
            >
              Ask AI
            </UButton>
            <UButton
              color="neutral"
              variant="soft"
              class="min-w-16 justify-center"
              @click="
                failure = '';
                deletion = true;
              "
            >
              Delete
            </UButton>
          </div>
        </div>
        <div class="note-reader-body space-y-6">
          <h1 class="wrap-break-word text-2xl font-semibold">
            {{ note.title }}
          </h1>
          <MarkdownContent v-if="note.markdown" :content="note.markdown" />
          <p v-else class="text-dimmed">This note is empty.</p>
        </div>
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

<style scoped>
.note-reader {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.note-reader-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  min-height: 64px;
  padding: 12px 24px;
  border-bottom: 1px solid var(--ui-border);
  justify-content: space-between;
}
.note-reader-meta {
  flex: 1 1 240px;
  min-width: 0;
  overflow-wrap: anywhere;
}
.note-reader-body {
  padding: 32px;
}
.note-reader-error {
  width: auto;
  margin: 32px;
}
@media (max-width: 767px) {
  .note-reader-actions :deep(button),
  .note-reader-actions :deep(a) {
    min-height: 44px;
  }
  .note-reader-body {
    padding: 16px;
  }
  .note-reader-error {
    margin: 60px 16px 16px;
  }
  .note-reader-toolbar {
    padding: 8px 16px;
  }
  .note-reader-meta {
    flex-basis: 100%;
    order: 1;
  }
}
.note-page {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
}
</style>
