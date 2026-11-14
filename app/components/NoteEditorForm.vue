<script setup lang="ts">
import { useMediaQuery } from "@vueuse/core";
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
  saveBlocked?: boolean;
  categoryOptions: { label: string; value: string }[];
}>();
const saveDisabled = computed(
  () =>
    !!(
      props.saving ||
      props.saved ||
      props.overLimit ||
      props.saveBlocked ||
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
// Match the server's split view until hydration completes.
const mobile = useMediaQuery("(max-width: 767px)", { ssrWidth: 768 });
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
.note-editor {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: auto;
}
.note-editor-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 12px 24px;
  border-bottom: 1px solid var(--ui-border);
}
.note-save-status {
  margin-left: auto;
}
.note-editor-fields {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: end;
  gap: 12px;
  padding: 24px 32px;
}
.note-view-tabs {
  flex-shrink: 0;
  padding: 4px 12px;
  background: var(--ui-bg-muted);
}
.note-view-tabs :deep(.note-view-tab-list) {
  height: 36px;
}
.note-view-tabs :deep(.note-view-tab-trigger) {
  height: 28px;
  padding-block: 0;
}
.note-view-tabs :deep(.note-view-tab-indicator) {
  height: 28px;
}
.note-editor-panes {
  display: flex;
  flex: 1 0 360px;
  min-height: 360px;
  height: 360px;
}
.note-source-pane,
.note-preview-pane {
  width: 100%;
  min-width: 0;
  min-height: 0;
  padding: 24px;
}
.note-editor-panes[data-view="split"] > * {
  width: 50%;
}
.note-source-pane {
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: var(--ui-bg-muted);
  border: 1px solid var(--ui-border);
}
.note-markdown-input {
  min-width: 0;
  min-height: 0;
  align-items: stretch;
  display: flex;
  flex: 1;
  width: 100%;
}
.note-editor-footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px;
  padding: 12px;
  padding-bottom: max(12px, env(safe-area-inset-bottom));
  background: var(--ui-bg-muted);
}
.note-preview-pane {
  overflow: auto;
  line-height: 1.7;
  overflow-wrap: anywhere;
}
@media (min-width: 768px) {
  .note-editor-fields {
    grid-template-columns: minmax(0, 1fr) 16rem;
    gap: 16px;
  }
}
@media (max-width: 767px) {
  .note-view-tabs :deep(.note-view-tab-list) {
    height: 44px;
    padding-block: 0;
    background: transparent;
    isolation: isolate;
  }
  .note-view-tabs :deep(.note-view-tab-list::before) {
    content: "";
    position: absolute;
    inset: 4px 0;
    z-index: -1;
    border-radius: 8px;
    background: var(--ui-bg-elevated);
  }
  .note-view-tabs :deep(.note-view-tab-trigger) {
    height: 44px;
  }
  .note-view-tabs :deep(.note-view-tab-indicator) {
    top: 8px;
  }
  .note-editor-actions,
  .note-editor-fields,
  .note-source-pane,
  .note-preview-pane {
    padding: 16px;
  }
  .note-editor-actions :deep(button) {
    min-height: 44px;
  }
  .note-editor-panes[data-view="split"] > * {
    width: 100%;
  }
  .note-editor-panes[data-view="split"] .note-preview-pane {
    display: none;
  }
}

/* Inline menus must stack above the tab indicator that follows the fields. */
.inline-category-fields {
  position: relative;
  z-index: 2;
}
.inline-category-fields + .note-view-tabs {
  isolation: isolate;
}
</style>
