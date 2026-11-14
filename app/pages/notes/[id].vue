<script setup lang="ts">
import type { SavedNote } from "#shared/types/note";
import { assertNavigationSucceeded } from "~/utils/navigation";

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
  status,
  refresh,
} = await useFetch(() => `/api/notes/${route.params.id}`, { lazy: true });

const editing = ref(false);
const deletion = ref(false);
const deleteTarget = ref<SavedNote | null>(null);
const busy = ref(false);
const failure = ref("");
const deleted = ref(false);
const toast = useToast();

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
  const savedSnapshot = note.value;
  editing.value = false;
  try {
    if (result.categoryId !== previousCategory) {
      assertNavigationSucceeded(
        await navigateTo(
          location(route.path, result.categoryId ?? "uncategorized"),
          { replace: true },
        ),
      );
    }
    await Promise.all([
      refresh(),
      refreshNuxtData("workspace-list"),
      refreshNuxtData("workspace-categories"),
    ]);
    if (error.value) throw error.value;
  } catch {
    if (!note.value) note.value = savedSnapshot;
    toast.add({
      title: "Note saved",
      description:
        "The note was saved, but the view could not be refreshed. Reload to see the latest content.",
      color: "warning",
    });
  }
}

function startDeletion() {
  if (busy.value || error.value || !note.value) return;
  failure.value = "";
  deleteTarget.value = { ...note.value };
  deletion.value = true;
}

async function loadLatestAfterDeletionConflict() {
  await refresh();
  if (!error.value && note.value)
    failure.value =
      "Review the latest content below, then choose Delete again if you still want to delete it.";
}

async function remove() {
  if (busy.value || !deletion.value || !deleteTarget.value) return;
  busy.value = true;
  failure.value = "";
  try {
    await $fetch(`/api/notes/${deleteTarget.value.id}`, {
      method: "DELETE",
      body: { updatedAt: deleteTarget.value.updatedAt },
      retry: 0,
    });
  } catch (cause) {
    const code = (cause as { statusCode?: number }).statusCode;
    if (code === 409 || code === 404) {
      deletion.value = false;
      deleteTarget.value = null;
      await refresh();
      failure.value =
        code === 404 || error.value?.statusCode === 404
          ? "This note was deleted or is no longer available."
          : error.value
            ? "Deletion stopped because this note changed. Could not load the latest version. Try loading it again before deleting."
            : "This note was updated elsewhere and was not deleted. Review the latest content below, then choose Delete again if you still want to delete it.";
    } else {
      failure.value = "Could not delete the note. Please try again.";
    }
    return;
  } finally {
    busy.value = false;
  }
  deleted.value = true;
  deletion.value = false;
  deleteTarget.value = null;
  note.value = undefined;
  state.value.notes.selected = "";
  try {
    assertNavigationSucceeded(await navigateTo(location("/notes")));
    await Promise.all([
      refreshNuxtData("workspace-list"),
      refreshNuxtData("workspace-categories"),
    ]);
  } catch {
    failure.value =
      "The note was deleted, but the view could not be refreshed. Return to the note list or reload.";
  }
}
</script>

<template>
  <div class="note-page">
    <ContentLoading
      v-if="!note && (status === 'idle' || status === 'pending')"
    />
    <NoteEditor
      v-else-if="editing && note"
      :note="note"
      @saved="saved"
      @cancel="editing = false"
    />
    <div v-else class="note-reader">
      <UAlert
        v-if="failure && !deletion"
        :title="deleted ? 'Note deleted' : 'Deletion stopped'"
        :description="failure"
        color="warning"
        role="alert"
        class="note-reader-error"
      >
        <template v-if="deleted || error" #actions>
          <UButton
            v-if="deleted"
            :to="location('/notes')"
            color="neutral"
            variant="outline"
          >
            Back to notes
          </UButton>
          <UButton
            v-else
            color="neutral"
            variant="outline"
            :disabled="status === 'pending'"
            @click="loadLatestAfterDeletionConflict"
          >
            Load latest version
          </UButton>
        </template>
      </UAlert>
      <UAlert
        v-if="error && !note"
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
      <article v-else-if="note" class="note-reader-article">
        <div class="note-reader-toolbar">
          <div
            class="flex max-w-full flex-wrap justify-end gap-2 note-reader-actions"
          >
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
              :disabled="busy || !!error"
              @click="startDeletion"
            >
              Delete
            </UButton>
          </div>
        </div>
        <div class="note-reader-body space-y-6">
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
        <p>
          Permanently delete “{{ deleteTarget?.title }}”? This cannot be undone.
        </p>
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
        <UButton
          color="error"
          class="min-h-11"
          :loading="busy"
          :disabled="busy"
          @click="remove"
        >
          Delete note
        </UButton>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
.note-page,
.note-reader,
.note-reader-article {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
.note-reader {
  overflow-y: auto;
}
.note-reader-toolbar {
  display: flex;
  align-items: center;
  min-height: 64px;
  padding: 12px 24px;
  border-bottom: 1px solid var(--ui-border);
  justify-content: flex-end;
  flex-shrink: 0;
}
.note-reader-meta {
  overflow-wrap: anywhere;
}
.note-reader-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 32px;
}
.note-reader-error {
  flex-shrink: 0;
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
    padding: 8px 16px 8px 72px;
  }
}
</style>
