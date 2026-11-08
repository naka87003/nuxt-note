<script setup lang="ts">
import { contentPreview } from "#shared/utils/content-preview";

type Step = "chat" | "confirm" | "generating" | "edit" | "saving" | "done";
const step = ref<Step>("chat");
const confirmingDiscard = ref(false);
const keepEditingButton = useTemplateRef("keepEditingButton");
let cancelTrigger: HTMLElement | null = null;
const initialTitle = "Nuxt data fetching";
const fetchExample = `\`\`\`ts
const { data } = await useFetch('/api/notes')
\`\`\``;
const categoryFetchExample = `\`\`\`ts
const selectedCategory = ref('Nuxt')
const { data } = await useFetch('/api/notes', {
  query: { category: selectedCategory }
})
\`\`\``;
const fetchAnswer = `Use useFetch when your data comes from a URL.

It combines fetching with Nuxt’s async data handling. For custom async logic, use useAsyncData.

${fetchExample}`;
const categoryAnswer = `Pass the selected category as a reactive query parameter. useFetch will fetch again when it changes.

${categoryFetchExample}`;
const initialMarkdown = `## Overview

Use useFetch for URL-based requests and useAsyncData for custom async logic.

## useFetch

${fetchExample}

## Reactive category filters

Pass the selected category as a reactive query parameter. useFetch fetches again when the category changes.

${categoryFetchExample}

## Checklist

- Define the response type
- Handle loading and errors
- Refresh when filters change`;
const category = ref("Nuxt");
const categoryOptions = ["Uncategorized", "English", "Nuxt", "TypeScript"].map(
  (value) => ({ label: value, value }),
);
const title = ref(initialTitle);
const displayTitle = computed(() => title.value.trim() || "Untitled note");
const markdown = ref(initialMarkdown);
const root = useTemplateRef("root");
const editor = useTemplateRef("editor");
const hintId = useId();
const dialogTitleId = useId();
const editing = computed(
  () => step.value === "edit" || step.value === "saving",
);
const steps: Record<Step, { progress: number; guidance: string }> = {
  chat: {
    progress: 1,
    guidance: "Generate note turns this chat into an editable draft.",
  },
  confirm: { progress: 2, guidance: "Confirm to generate your draft." },
  generating: { progress: 3, guidance: "Preparing your draft…" },
  edit: { progress: 4, guidance: "Edit the draft, then select Save." },
  saving: { progress: 4, guidance: "Saving your note…" },
  done: { progress: 5, guidance: "Your saved note is below." },
};
const totalSteps = steps.done.progress;
const currentStep = computed(() => steps[step.value]);
const guidance = computed(() =>
  confirmingDiscard.value
    ? "Keep editing or discard your draft."
    : currentStep.value.guidance,
);
const showingChat = computed(() => !editing.value && step.value !== "done");
const showingDialog = computed(
  () =>
    confirmingDiscard.value ||
    step.value === "confirm" ||
    step.value === "generating",
);
const dialogTitle = computed(() => {
  if (confirmingDiscard.value) return "Discard unsaved changes?";
  return step.value === "confirm"
    ? "Generate a note from this chat?"
    : "Generating your note…";
});

let transitionTimer: ReturnType<typeof setTimeout>;
onBeforeUnmount(() => clearTimeout(transitionTimer));

function generateDraft() {
  if (step.value !== "confirm") return;
  void go("generating");
  transitionTimer = setTimeout(() => go("edit"), 2000);
}

function saveDraft() {
  if (step.value !== "edit" || confirmingDiscard.value) return;
  step.value = "saving";
  transitionTimer = setTimeout(() => go("done"), 1000);
}

async function cancelDraft() {
  if (step.value !== "edit") return;
  cancelTrigger =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  confirmingDiscard.value = true;
  await nextTick();
  keepEditingButton.value?.focus();
}

async function dismissDialog() {
  if (confirmingDiscard.value) {
    confirmingDiscard.value = false;
    await nextTick();
    cancelTrigger?.focus();
  } else if (step.value === "confirm") {
    await go("chat");
  }
}

async function go(next: Step) {
  clearTimeout(transitionTimer);
  if (next === "chat" && (step.value === "done" || step.value === "edit")) {
    category.value = "Nuxt";
    title.value = initialTitle;
    markdown.value = initialMarkdown;
  }
  // Generation and saving finish asynchronously. Keep focus on the page if the visitor has moved on.
  const shouldFocus =
    (step.value !== "generating" && step.value !== "saving") ||
    root.value?.contains(document.activeElement);
  confirmingDiscard.value = false;
  step.value = next;
  if (!shouldFocus) return;
  await nextTick();
  if (next === "edit") {
    editor.value?.focusTitle();
  } else {
    root.value
      ?.querySelector<HTMLElement>("[data-demo-focus]:not([inert] *)")
      ?.focus({ preventScroll: true });
  }
}
</script>

<template>
  <div ref="root" class="note-demo">
    <div class="demo-guide">
      <div role="status" aria-live="polite" aria-atomic="true">
        <p class="demo-label">
          Interactive demo ·
          {{ `Step ${currentStep.progress} of ${totalSteps}` }}
          <template v-if="step === 'done'"> · Complete</template>
        </p>
        <strong :id="hintId">
          {{ guidance }}
        </strong>
      </div>
      <div class="demo-progress" aria-hidden="true">
        <span
          v-for="n in totalSteps"
          :key="n"
          :class="{ filled: n <= currentStep.progress }"
        />
      </div>
    </div>
    <LandingWorkspacePreview
      :mode="editing || step === 'done' ? 'notes' : 'chat'"
      note-draft
      :saved-category="step === 'done' ? category : undefined"
      :preview-content="step === 'done' ? contentPreview(markdown) : undefined"
      :preview-title="step === 'done' ? displayTitle : undefined"
    >
      <template #content>
        <div class="demo-content">
          <div v-if="showingChat" class="demo-chat" :inert="step !== 'chat'">
            <div class="chat-actions">
              <UButton
                type="button"
                color="primary"
                variant="solid"
                class="min-w-20 justify-center"
                :class="{ 'demo-highlight': step === 'chat' }"
                data-demo-focus
                :aria-describedby="hintId"
                @click="go('confirm')"
              >
                Generate note
                <LandingClickCue v-if="step === 'chat'" />
              </UButton>
              <div class="chat-secondary-actions" aria-hidden="true">
                <UButton
                  as="span"
                  color="neutral"
                  variant="soft"
                  class="chat-category-action"
                >
                  <span class="truncate">
                    <span class="chat-category-prefix">Category: </span>
                    Nuxt
                  </span>
                </UButton>
                <UButton
                  as="span"
                  color="neutral"
                  variant="soft"
                  class="min-w-16 justify-center"
                  >Delete</UButton
                >
              </div>
            </div>
            <div class="demo-conversation">
              <h3>Understanding useFetch</h3>
              <p class="demo-question">
                When should I use useFetch instead of useAsyncData?
              </p>
              <LandingMarkdownContent variant="chat" :content="fetchAnswer" />
              <p class="demo-question">
                What if the request depends on a selected category?
              </p>
              <LandingMarkdownContent
                variant="chat"
                :content="categoryAnswer"
              />
              <div class="demo-composer" aria-hidden="true">
                <span>Ask a follow-up…</span>
                <UButton
                  type="button"
                  class="chat-send"
                  aria-label="Send message"
                  disabled
                >
                  <img
                    src="/icons/chat-send.svg"
                    alt=""
                    width="20"
                    height="20"
                  />
                </UButton>
              </div>
            </div>
          </div>
          <NoteEditorForm
            v-if="editing"
            ref="editor"
            v-model:title="title"
            v-model:markdown="markdown"
            v-model:category="category"
            heading-tag="h3"
            :inert="confirmingDiscard"
            :category-options="categoryOptions"
            dirty
            inline-category-menu
            :saving="step === 'saving'"
            @save="saveDraft"
            @cancel="cancelDraft"
          >
            <template #save-action="{ disabled, loading }">
              <UButton
                type="submit"
                class="demo-modal-target"
                :disabled="disabled || loading"
                :loading="loading"
                :aria-describedby="hintId"
              >
                {{ loading ? "Saving…" : "Save" }}
                <LandingClickCue v-if="!loading" />
              </UButton>
            </template>
          </NoteEditorForm>
          <div v-if="step === 'done'" class="demo-saved">
            <div class="note-reader-toolbar shrink-0">
              <span class="demo-saved-label">
                <LandingDemoSuccess /> Saved to Notes
              </span>
              <UButton
                type="button"
                color="primary"
                variant="soft"
                icon="i-lucide-rotate-ccw"
                class="min-h-11"
                data-demo-focus
                @click="go('chat')"
              >
                Try again
              </UButton>
            </div>
            <div class="demo-note">
              <span class="demo-category">{{ category }}</span>
              <h3>{{ displayTitle }}</h3>
              <LandingMarkdownContent v-if="markdown" :content="markdown" />
              <p v-else class="demo-empty">This note is empty.</p>
            </div>
          </div>
        </div>
      </template>
      <template #overlay>
        <LandingNoteDraftConfirmation
          v-if="showingDialog"
          interactive
          :title="dialogTitle"
          :title-id="dialogTitleId"
          :focus-title="step === 'generating'"
          @click.self="dismissDialog"
          @keydown.esc.stop="dismissDialog"
        >
          <template v-if="confirmingDiscard || step === 'generating'" #default>
            <p v-if="confirmingDiscard">
              Your note has changes that have not been saved.
            </p>
            <template v-else-if="step === 'generating'">
              <p>
                AI is organizing this conversation into a draft. You can review,
                edit or discard it when ready.
              </p>
              <p
                class="mt-4 flex items-center gap-2 text-primary"
                role="status"
              >
                <UIcon
                  name="i-lucide-loader-circle"
                  class="motion-safe:animate-spin"
                />
                Organizing conversation…
              </p>
            </template>
          </template>
          <template v-if="confirmingDiscard || step === 'confirm'" #actions>
            <template v-if="confirmingDiscard">
              <button
                ref="keepEditingButton"
                type="button"
                class="demo-button"
                @click="dismissDialog"
              >
                Keep editing
              </button>
              <UButton color="error" class="min-h-11" @click="go('chat')">
                Discard changes
              </UButton>
            </template>
            <template v-else>
              <UButton
                color="neutral"
                variant="outline"
                class="min-h-11"
                @click="go('chat')"
              >
                Cancel
              </UButton>
              <UButton
                class="min-h-11 demo-modal-target"
                data-demo-focus
                @click="generateDraft"
              >
                Generate
                <LandingClickCue />
              </UButton>
            </template>
          </template>
        </LandingNoteDraftConfirmation>
      </template>
    </LandingWorkspacePreview>
    <p class="demo-disclaimer">
      A hands-on preview. No sign-in needed. Changes stay in this demo.
    </p>
  </div>
</template>

<style scoped>
.note-reader-toolbar,
.chat-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  min-height: 64px;
  padding: 12px 24px;
  border-bottom: 1px solid var(--ui-border);
}
.note-reader-toolbar {
  justify-content: space-between;
}
.chat-send {
  flex-shrink: 0;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 6px;
  border-radius: 999px;
}
.chat-actions {
  justify-content: flex-end;
  gap: 8px;
  flex-shrink: 0;
}
.chat-secondary-actions {
  display: flex;
  gap: 8px;
  min-width: 0;
  max-width: 100%;
}
.chat-secondary-actions :deep(> button) {
  flex-shrink: 0;
}
.chat-secondary-actions :deep(> .chat-category-action) {
  min-width: 0;
  flex-shrink: 1;
}
@media (max-width: 767px) {
  .chat-actions :deep(button) {
    min-height: 44px;
  }
  .note-reader-toolbar,
  .chat-actions {
    padding: 8px 16px;
  }
  .chat-actions {
    padding-left: 72px;
  }
  .chat-actions :deep(> button) {
    flex-shrink: 0;
  }
  .chat-category-prefix {
    display: none;
  }
  .chat-send {
    width: 44px;
    height: 44px;
  }
}

.note-demo {
  width: 100%;
  text-align: left;
  container-type: inline-size;
  --spotlight-color: #f7faff;
  --spotlight-glow:
    0 0 0 5px rgb(32 42 55 / 25%), 0 0 16px 3px rgb(247 250 255 / 55%);
}
/* Scale the workspace as one surface, including its editor and dialogs. */
.note-demo :deep(.product-preview) {
  width: auto;
  isolation: isolate;
  zoom: 0.86;
}
@container (max-width: 900px) {
  .note-demo :deep(.product-preview) {
    zoom: 0.8;
  }
}
.demo-guide {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 20px 24px;
  margin-bottom: 16px;
  border: 1px solid var(--ui-border);
  border-radius: 8px;
  background: var(--ui-bg-muted);
}
.demo-label {
  color: var(--ui-primary);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 6px;
}
.demo-guide strong {
  font-size: 16px;
}
.demo-progress {
  display: flex;
  gap: 5px;
  flex-shrink: 0;
}
.demo-progress span {
  width: 20px;
  height: 4px;
  border-radius: 3px;
  background: var(--ui-border-accented);
}
.demo-progress .filled {
  background: var(--ui-primary);
}
.demo-content {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  font-size: 13px;
}
.demo-chat,
.demo-saved {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
.demo-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 8px 12px;
  border: 1px solid var(--ui-border-accented);
  border-radius: 6px;
  background: var(--ui-bg);
  font: inherit;
  font-weight: 600;
  line-height: 1.4;
  cursor: pointer;
}
.demo-button:hover {
  filter: brightness(0.94);
}
.demo-modal-target,
.demo-highlight {
  position: relative;
  z-index: 1;
  outline: 2px solid var(--spotlight-color);
  outline-offset: 4px;
  box-shadow: var(--spotlight-glow);
}
.demo-highlight {
  box-shadow:
    var(--spotlight-glow),
    0 0 0 200vmax rgb(8 14 20 / 28%);
}
@media (prefers-reduced-motion: no-preference) {
  .demo-modal-target,
  .demo-highlight {
    animation: spotlight-pulse 2.4s ease-in-out infinite;
  }
  @keyframes spotlight-pulse {
    0%,
    100% {
      outline-color: var(--spotlight-color);
    }
    50% {
      outline-color: color-mix(
        in srgb,
        var(--spotlight-color) 50%,
        transparent
      );
    }
  }
}
.demo-button:focus-visible {
  outline: 3px solid var(--ui-text);
  outline-offset: 3px;
}
.demo-conversation {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  gap: 18px;
  padding: 24px;
  overflow: auto;
}
h3 {
  font-size: 20px;
  font-weight: 600;
  line-height: 1.4;
  overflow-wrap: anywhere;
}
.demo-question {
  align-self: flex-end;
  max-width: 85%;
  padding: 14px;
  border: 1px solid var(--ui-border);
  border-radius: 8px;
  background: var(--ui-bg-muted);
}
.demo-composer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  gap: 12px;
  min-height: 56px;
  margin-top: auto;
  padding: 12px 12px 12px 19.2px;
  border: 1px solid var(--ui-border);
  border-radius: 28px;
  color: var(--ui-text-dimmed);
}
.demo-category {
  color: var(--ui-text-muted);
  font-size: 12px;
}
.demo-saved-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--ui-primary);
}
.demo-note {
  padding: 24px;
  overflow: auto;
  overflow-wrap: anywhere;
}
.demo-note h3 {
  margin: 8px 0 20px;
}
.demo-disclaimer {
  text-align: center;
  color: var(--ui-text-muted);
  font-size: 12px;
  margin-top: 12px;
}
@media (max-width: 767px) {
  .chat-secondary-actions > span {
    min-height: 44px;
  }
}
</style>
