<script setup lang="ts">
import { INPUT_LIMITS } from "#shared/utils/input-limits";
import type { NoteDraft, SavedNote } from "#shared/types/note";
import type { CategoriesResponse } from "#shared/types/workspace";
import { sortCategoriesByCount } from "#shared/utils/categories";

const props = defineProps<{ note?: SavedNote; initialDraft?: NoteDraft }>();
const emit = defineEmits<{ saved: [note: SavedNote]; cancel: [] }>();

const { loggedIn } = useUserSession();
const { state, categoryId, confirmEdits } = useWorkspace();

// Snapshot once: background refreshes must never replace a local draft.
const supplied = props.note ?? props.initialDraft;
const initial: NoteDraft = {
  title: supplied?.title ?? "",
  markdown: supplied?.markdown ?? "",
  categoryId: supplied ? supplied.categoryId : categoryId.value,
};
const title = ref(initial.title);
const markdown = ref(initial.markdown);
const category = ref(initial.categoryId ?? "uncategorized");
const saving = ref(false);
const saved = ref(false);
const failure = ref("");

const overLimit = computed(
  () =>
    title.value.length > INPUT_LIMITS.noteTitle ||
    markdown.value.length > INPUT_LIMITS.noteBody,
);

const dirty = computed(
  () =>
    !saved.value &&
    (!!props.initialDraft ||
      title.value !== initial.title ||
      markdown.value !== initial.markdown ||
      (category.value === "uncategorized" ? null : category.value) !==
        initial.categoryId),
);

const { data: categories } = useNuxtData<CategoriesResponse>(
  "workspace-categories",
);

const categoryOptions = computed(() => [
  { label: "Uncategorized", value: "uncategorized" },
  ...sortCategoriesByCount(categories.value?.items ?? []).map((item) => ({
    label: item.name,
    value: item.id,
  })),
]);
const view = ref("split");
const mobile = ref(false);
const viewItems = computed(() => [
  { label: "Edit", value: "edit" },
  ...(!mobile.value ? [{ label: "Split view", value: "split" }] : []),
  { label: "Preview", value: "preview" },
]);

// A split view becomes Edit on mobile without changing the stored desktop choice.
const visibleView = computed({
  get: () => (mobile.value && view.value === "split" ? "edit" : view.value),
  set: (value: string) => {
    view.value = value;
  },
});

async function canLeave() {
  if (!loggedIn.value) return true;
  return await confirmEdits();
}

onBeforeRouteLeave(canLeave);

onBeforeRouteUpdate((to, from) => {
  if (to.fullPath !== from.fullPath) return canLeave();
});

watchEffect(() => {
  state.value.editor = { active: true, dirty: dirty.value, busy: saving.value };
});

function beforeUnload(event: BeforeUnloadEvent) {
  if (dirty.value || saving.value) {
    event.preventDefault();
    event.returnValue = "";
  }
}

onMounted(() => {
  const media = window.matchMedia("(max-width: 767px)");
  const update = () => {
    mobile.value = media.matches;
  };
  update();
  media.addEventListener("change", update);
  window.addEventListener("beforeunload", beforeUnload);
  onBeforeUnmount(() => {
    media.removeEventListener("change", update);
    window.removeEventListener("beforeunload", beforeUnload);
  });
});

onBeforeUnmount(() => {
  state.value.editor = { active: false, dirty: false, busy: false };
});

async function cancel() {
  if (await canLeave()) {
    saved.value = true;
    state.value.editor.dirty = false;
    emit("cancel");
  }
}

async function save() {
  if (saving.value || saved.value || overLimit.value) return;
  saving.value = true;
  failure.value = "";
  const body: NoteDraft = {
    title: title.value,
    markdown: markdown.value,
    categoryId: category.value === "uncategorized" ? null : category.value,
  };
  try {
    const result = props.note
      ? await $fetch(`/api/notes/${props.note.id}`, { method: "PATCH", body })
      : await $fetch("/api/notes", { method: "POST", body });
    saved.value = true;
    saving.value = false;
    state.value.editor = { active: false, dirty: false, busy: false };
    emit("saved", {
      ...body,
      title: body.title.trim() || "Untitled note",
      id: result.id,
    });
  } catch {
    failure.value =
      "Could not save your note. Your changes are still here. Please try again.";
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <form class="note-editor" @submit.prevent="save">
    <div class="note-editor-actions">
      <h1 class="font-medium">{{ note ? "Edit note" : "New note" }}</h1>
      <span class="note-save-status text-xs text-dimmed" role="status">
        {{ dirty ? "Unsaved changes" : "" }}
      </span>
      <UButton
        type="button"
        color="neutral"
        variant="outline"
        :disabled="saving || saved"
        @click="cancel"
      >
        Cancel
      </UButton>
      <UButton
        type="submit"
        :loading="saving"
        :disabled="saved || overLimit || (!!note && !dirty)"
      >
        Save
      </UButton>
    </div>
    <UAlert
      v-if="failure"
      title="Save failed"
      :description="failure"
      color="error"
      role="alert"
      class="m-4"
    />
    <UAlert
      v-if="overLimit"
      color="error"
      title="This note exceeds the character limit"
      :description="`Shorten the title to ${INPUT_LIMITS.noteTitle} characters and the body to ${INPUT_LIMITS.noteBody.toLocaleString('en-US')} characters before saving. Your existing content has been preserved.`"
      role="alert"
      class="m-4"
    />
    <div class="note-editor-fields">
      <UFormField
        label="Title"
        name="title"
        class="min-w-0"
        :hint="`${title.length} / ${INPUT_LIMITS.noteTitle}`"
      >
        <UInput
          v-model="title"
          :maxlength="INPUT_LIMITS.noteTitle"
          :disabled="saving || saved"
          placeholder="Untitled note"
          size="xl"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Category" name="category" class="min-w-0">
        <USelect
          v-model="category"
          :items="categoryOptions"
          :disabled="saving || saved"
          size="xl"
          class="w-full"
        />
      </UFormField>
    </div>
    <UTabs
      v-model="visibleView"
      :items="viewItems"
      :content="false"
      variant="pill"
      size="sm"
      class="note-view-tabs"
      :ui="{
        list: 'note-view-tab-list',
        trigger: 'note-view-tab-trigger font-bold',
        indicator: 'note-view-tab-indicator',
      }"
      aria-label="Editor view"
    />
    <div class="note-editor-panes" :data-view="visibleView">
      <div v-show="visibleView !== 'preview'" class="note-source-pane">
        <label for="note-markdown" class="text-xs text-dimmed">MARKDOWN</label>
        <UTextarea
          id="note-markdown"
          v-model="markdown"
          :maxlength="INPUT_LIMITS.noteBody"
          :disabled="saving || saved"
          :rows="18"
          placeholder="Start writing…"
          class="note-markdown-input"
          :ui="{ base: 'font-mono flex-1 min-h-0 self-stretch resize-none' }"
        />
      </div>
      <section
        v-show="visibleView !== 'edit'"
        class="note-preview-pane"
        aria-label="Markdown preview"
      >
        <p class="mb-4 text-xs text-dimmed">PREVIEW</p>
        <h2 class="mb-6 text-2xl font-semibold wrap-break-word">
          {{ title.trim() || "Untitled note" }}
        </h2>
        <MarkdownContent v-if="markdown" :content="markdown" />
        <p v-else class="text-dimmed">This note is empty.</p>
      </section>
    </div>
    <footer class="note-editor-footer text-xs text-dimmed">
      <span>
        Markdown · {{ markdown.length.toLocaleString("en-US") }} /
        {{ INPUT_LIMITS.noteBody.toLocaleString("en-US") }} characters
      </span>
      <span>Save to apply your changes</span>
    </footer>
  </form>
</template>
