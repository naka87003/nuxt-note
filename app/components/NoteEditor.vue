<script setup lang="ts">
import { useEventListener } from "@vueuse/core";
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

useEventListener("beforeunload", beforeUnload);

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
  <NoteEditorForm
    v-model:title="title"
    v-model:markdown="markdown"
    v-model:category="category"
    :category-options="categoryOptions"
    :note="!!note"
    :dirty="dirty"
    :saving="saving"
    :saved="saved"
    :failure="failure"
    :over-limit="overLimit"
    @save="save"
    @cancel="cancel"
  />
</template>
