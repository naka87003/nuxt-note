<script setup lang="ts">
import { INPUT_LIMITS } from "#shared/utils/input-limits";

const props = defineProps<{
  note?: boolean;
  headingTag?: "h1" | "h2" | "h3";
  inlineCategoryMenu?: boolean;
  dirty: boolean;
  saving?: boolean;
  saved?: boolean;
  failure?: string;
  overLimit?: boolean;
  categoryOptions: { label: string; value: string }[];
}>();
const saveDisabled = computed(
  () =>
    !!(
      props.saving ||
      props.saved ||
      props.overLimit ||
      (props.note && !props.dirty)
    ),
);
const previewHeadingTag = computed(() => {
  if (props.headingTag === "h3") return "h4";
  if (props.headingTag === "h2") return "h3";
  return "h2";
});

function submit() {
  if (!saveDisabled.value) emit("save");
}

const markdownId = useId();
const titleInput = useTemplateRef("titleInput");
defineExpose({
  focusTitle: () => titleInput.value?.inputRef?.focus({ preventScroll: true }),
});
const emit = defineEmits<{ save: []; cancel: [] }>();
const title = defineModel<string>("title", { required: true });
const markdown = defineModel<string>("markdown", { required: true });
const category = defineModel<string>("category", { required: true });
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

onMounted(() => {
  const media = window.matchMedia("(max-width: 767px)");
  const update = () => {
    mobile.value = media.matches;
  };
  update();
  media.addEventListener("change", update);
  onBeforeUnmount(() => media.removeEventListener("change", update));
});
</script>

<template>
  <form class="note-editor" @submit.prevent="submit">
    <div class="note-editor-actions">
      <component :is="headingTag ?? 'h1'" class="font-medium">
        {{ note ? "Edit note" : "New note" }}
      </component>
      <span class="note-save-status text-xs text-dimmed" role="status">
        {{ dirty ? "Unsaved changes" : "" }}
      </span>
      <UButton
        type="button"
        color="neutral"
        variant="outline"
        :disabled="saving || saved"
        @click="emit('cancel')"
      >
        Cancel
      </UButton>
      <slot name="save-action" :disabled="saveDisabled" :loading="saving">
        <UButton type="submit" :loading="saving" :disabled="saveDisabled">
          Save
        </UButton>
      </slot>
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
    <div
      class="note-editor-fields"
      :class="{ 'inline-category-fields': inlineCategoryMenu }"
    >
      <UFormField
        label="Title"
        name="title"
        class="min-w-0"
        :hint="`${title.length} / ${INPUT_LIMITS.noteTitle}`"
      >
        <UInput
          ref="titleInput"
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
          :portal="!inlineCategoryMenu"
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
        <label :for="markdownId" class="text-xs text-dimmed">MARKDOWN</label>
        <UTextarea
          :id="markdownId"
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
        <component
          :is="previewHeadingTag"
          class="mb-6 text-2xl font-semibold wrap-break-word"
        >
          {{ title.trim() || "Untitled note" }}
        </component>
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

<style scoped>
/* Inline menus must stack above the tab indicator that follows the fields. */
.inline-category-fields {
  position: relative;
  z-index: 2;
}
.inline-category-fields + .note-view-tabs {
  isolation: isolate;
}
</style>
