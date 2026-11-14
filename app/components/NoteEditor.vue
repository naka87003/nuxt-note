<script setup lang="ts">
import { useEventListener } from "@vueuse/core";
import type { NoteDraft, SavedNote } from "#shared/types/note";
import type { CategoriesResponse } from "#shared/types/workspace";
import { sortCategoriesByCount } from "#shared/utils/categories";

const props = defineProps<{ note?: SavedNote; initialDraft?: NoteDraft }>();
const emit = defineEmits<{
  saved: [note: SavedNote];
  cancel: [];
}>();

const { loggedIn } = useUserSession();
const { state, categoryId, confirmEdits } = useWorkspace();

const {
  title,
  markdown,
  category,
  dirty,
  overLimit,
  saving,
  saved,
  failure,
  unavailable,
  confirmation,
  save,
} = useNoteEditor({
  note: props.note,
  initialDraft: props.initialDraft,
  categoryId: categoryId.value,
  onSaved(note) {
    state.value.editor = { active: false, dirty: false, busy: false };
    emit("saved", note);
  },
});

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
    :save-blocked="unavailable"
    @save="save()"
    @cancel="cancel"
  />
  <NoteConflictDialog
    v-model:open="confirmation"
    :saving="saving"
    :failure="failure"
    @overwrite="save(true)"
  />
</template>
