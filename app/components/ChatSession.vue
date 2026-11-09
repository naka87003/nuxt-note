<script setup lang="ts">
import type { Conversation } from "~/composables/useChatGeneration";
import type { CategoriesResponse } from "#shared/types/workspace";
import { sortCategoriesByCount } from "#shared/utils/categories";

const props = defineProps<{ chatId: string }>();
const emit = defineEmits<{ created: [id: string] }>();
const activeId = ref(props.chatId);
const navigationFailure = ref("");

const route = useRoute();
const { state, location, categoryId, selectedCategoryName } = useWorkspace();

const chat = ref<Conversation | null>(null);

const {
  draft,
  persisted,
  busy: generating,
  sending,
  waitingForResponse,
  failure: generationFailure,
  canRetry,
  lastReply,
  send,
  generate,
} = useChatGeneration(
  chat,
  () => refreshConversation(true),
  props.chatId
    ? undefined
    : {
        categoryId: () => categoryId.value,
        onCreated(created) {
          activeId.value = created.id;
          emit("created", created.id);
          // URL changes keep this session and its active stream mounted.
          void Promise.resolve()
            .then(() =>
              navigateTo(
                location(
                  `/chats/${created.id}`,
                  created.categoryId ?? "uncategorized",
                ),
                { replace: true },
              ),
            )
            .then((result) => {
              if (result === false || result instanceof Error)
                navigationFailure.value =
                  "Your chat was saved. You can reopen it from the chat list.";
            })
            .catch(() => {
              navigationFailure.value =
                "Your chat was saved. You can reopen it from the chat list.";
            });
        },
      },
);

const requestFetch = useRequestFetch();
const refreshConversation = useChatRefresh(chat, activeId, sending, (id) =>
  requestFetch<Conversation>(`/api/chats/${id}`),
);
const {
  data: initialChat,
  error,
  refresh,
} = await useAsyncData(`chat-session:${useId()}`, () => refreshConversation(), {
  deep: true,
});
// Hydration can use the server snapshot without executing the loader again.
chat.value = initialChat.value ?? null;

function messageClass(role: string) {
  return role === "user" ? "chat-user-message" : "chat-assistant-message";
}

const messagePane = ref<HTMLElement>();
const messageContent = ref<HTMLElement>();
const followBottom = ref(true);
const hasNewMessages = ref(false);
let lastScrollTop = 0;

function scrollToBottom() {
  const pane = messagePane.value;
  if (!pane) return;
  followBottom.value = true;
  hasNewMessages.value = false;
  pane.scrollTop = pane.scrollHeight;
  lastScrollTop = pane.scrollTop;
}

let paneObserver: ResizeObserver | undefined;
watch(
  [messagePane, messageContent],
  ([pane, content]) => {
    paneObserver?.disconnect();
    if (!pane || !content) return;
    scrollToBottom();
    paneObserver = new ResizeObserver(() => {
      if (followBottom.value) scrollToBottom();
      else onScroll();
    });
    paneObserver.observe(pane);
    // Comark can change the content height after the message's nextTick.
    paneObserver.observe(content);
  },
  { flush: "post" },
);
onBeforeUnmount(() => paneObserver?.disconnect());

watch(
  [
    () => chat.value?.messages.map((m) => [m.id, m.content]),
    waitingForResponse,
  ],
  async () => {
    if (!followBottom.value) hasNewMessages.value = true;
    await nextTick();
    if (followBottom.value) scrollToBottom();
  },
);

function onScroll() {
  const pane = messagePane.value;
  if (pane) {
    const atBottom =
      pane.scrollHeight - pane.scrollTop - pane.clientHeight < 80;
    if (atBottom) followBottom.value = true;
    else if (pane.scrollTop < lastScrollTop) followBottom.value = false;
    lastScrollTop = pane.scrollTop;
    if (followBottom.value) hasNewMessages.value = false;
  }
}

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

const categoryName = computed(
  () =>
    categoryOptions.value.find(
      (item) => item.value === (chat.value?.categoryId ?? "uncategorized"),
    )?.label ?? "Uncategorized",
);

const assignment = ref(false);
const deletion = ref(false);
const target = ref("uncategorized");
const busy = ref(false);
const failure = ref("");
const noteHandoff = useNoteDraftHandoff();

const {
  phase: notePhase,
  busy: creatingNote,
  open: noteDialog,
  failure: noteFailure,
  confirm: confirmNote,
  create: createNote,
} = useChatNoteDraft(
  () => activeId.value,
  (draft) =>
    noteHandoff.open({
      draft,
      returnTo: location(
        `/chats/${activeId.value}`,
        chat.value?.categoryId ?? "uncategorized",
      ),
    }),
);
const canCreateNote = computed(
  () =>
    persisted.value &&
    !generating.value &&
    !creatingNote.value &&
    !!chat.value?.messages.some(
      (m) =>
        m.role === "assistant" && m.status === "completed" && m.content.trim(),
    ),
);

watch(
  () => chat.value?.id,
  async () => {
    if (!chat.value || route.path !== `/chats/${chat.value.id}`) return;
    const filter = chat.value.categoryId ?? "uncategorized";
    state.value.filter = filter;
    if (route.query.category !== filter)
      await navigateTo(location(route.path, filter), { replace: true });
  },
  { immediate: true },
);

function assign() {
  target.value = chat.value?.categoryId ?? "uncategorized";
  failure.value = "";
  assignment.value = true;
}

async function saveCategory() {
  if (busy.value || !chat.value) return;
  busy.value = true;
  failure.value = "";
  try {
    const categoryId = target.value === "uncategorized" ? null : target.value;
    await $fetch(`/api/chats/${chat.value.id}`, {
      method: "PATCH",
      body: { categoryId },
    });
    state.value.filter = categoryId ?? "uncategorized";
    await navigateTo(location(route.path, state.value.filter), {
      replace: true,
    });
    assignment.value = false;
    await refreshNuxtData();
  } catch {
    failure.value = "Could not change the category. Please try again.";
  } finally {
    busy.value = false;
  }
}

async function remove() {
  if (busy.value || !chat.value) return;
  busy.value = true;
  failure.value = "";
  try {
    await $fetch(`/api/chats/${chat.value.id}`, { method: "DELETE" });
    deletion.value = false;
    state.value.chats.selected = "";
    await refreshNuxtData();
    await navigateTo(location("/chats"));
  } catch {
    failure.value = "Could not delete the chat. Please try again.";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="chat-page">
    <UAlert
      v-if="error"
      title="Could not open this chat"
      color="error"
      class="m-4"
    >
      <template #description>
        <UButton color="neutral" variant="link" @click="refresh()">
          Try again
        </UButton>
      </template>
    </UAlert>
    <div v-else-if="chat" class="chat-session">
      <div class="chat-actions">
        <UButton
          color="primary"
          variant="solid"
          class="min-w-20 justify-center"
          :disabled="!canCreateNote"
          @click="confirmNote"
        >
          Generate note
        </UButton>
        <div class="chat-secondary-actions">
          <UButton
            color="neutral"
            variant="soft"
            class="chat-category-action"
            :title="`Category: ${categoryName}`"
            :aria-label="`Category: ${categoryName}`"
            :disabled="generating || creatingNote || !persisted"
            @click="assign"
          >
            <span class="truncate">
              <span class="chat-category-prefix">Category: </span>
              {{ categoryName }}
            </span>
          </UButton>
          <UButton
            color="neutral"
            variant="soft"
            class="min-w-16 justify-center"
            :disabled="generating || creatingNote || !persisted"
            @click="
              failure = '';
              deletion = true;
            "
          >
            Delete
          </UButton>
        </div>
      </div>
      <div ref="messagePane" class="chat-messages" @scroll="onScroll">
        <div ref="messageContent" class="chat-inner space-y-6">
          <h1 class="text-2xl font-semibold wrap-break-word">
            <TypewriterText :text="chat.title || 'Untitled chat'" />
          </h1>
          <div
            v-for="message in chat.messages"
            :key="message.id"
            :class="messageClass(message.role)"
          >
            <template v-if="message.role === 'user'">
              {{ message.content }}
            </template>
            <template v-else>
              <MarkdownContent
                :content="message.content"
                :streaming="message.status === 'streaming'"
              />
              <p
                v-if="message.status === 'stopped'"
                class="text-sm text-dimmed"
              >
                The connection was interrupted. Please try again.
              </p>
              <p
                v-else-if="message.status === 'failed'"
                class="text-sm text-error"
              >
                Could not complete the response.
              </p>
            </template>
          </div>
          <Transition
            :duration="{
              enter: 0,
              leave:
                !generationFailure && lastReply?.status === 'completed'
                  ? 250
                  : 0,
            }"
          >
            <ChatResponseCursor v-if="waitingForResponse" />
          </Transition>
        </div>
      </div>
      <div class="chat-composer-container">
        <UButton
          v-if="!followBottom"
          type="button"
          color="neutral"
          variant="outline"
          icon="i-lucide-arrow-down"
          class="chat-scroll-bottom"
          aria-label="Scroll to latest message"
          title="Scroll to latest message"
          @click="scrollToBottom"
        >
          <span v-if="hasNewMessages">New messages</span>
        </UButton>
        <div class="chat-inner space-y-3">
          <p
            v-if="chat.generationId && !sending"
            class="text-sm text-dimmed"
            role="status"
          >
            This conversation has an active response. Reload this page to check
            for updates.
          </p>
          <UAlert
            v-if="navigationFailure"
            :title="navigationFailure"
            color="error"
          />
          <UAlert
            v-if="generationFailure"
            :title="generationFailure"
            color="error"
            role="alert"
          />
          <UButton
            v-if="canRetry"
            color="neutral"
            variant="soft"
            @click="generate"
          >
            Try again
          </UButton>
          <ChatComposer
            v-model="draft"
            :busy="sending"
            :disabled="generating || creatingNote || (canRetry && !lastReply)"
            @send="send"
          />
        </div>
      </div>
    </div>
    <div v-else class="new-chat">
      <UBadge
        v-if="selectedCategoryName"
        color="neutral"
        variant="outline"
        icon="i-lucide-folder"
        class="new-chat-category"
        :title="selectedCategoryName"
        :aria-label="`Category: ${selectedCategoryName}`"
        :ui="{ leadingIcon: 'size-4 shrink-0 text-dimmed' }"
      >
        <span class="min-w-0 truncate">{{ selectedCategoryName }}</span>
      </UBadge>
      <div class="new-chat-card">
        <h1 class="mb-4 text-center text-xl font-medium wrap-anywhere">
          Start your chat
        </h1>
        <UAlert
          v-if="generationFailure"
          :title="generationFailure"
          color="error"
          class="mb-4"
          role="alert"
        />
        <ChatComposer v-model="draft" :busy="sending" @send="send" />
      </div>
    </div>
    <UModal
      v-model:open="noteDialog"
      :title="
        notePhase === 'generating'
          ? 'Generating your note…'
          : notePhase === 'failed'
            ? 'Could not generate your note'
            : 'Generate a note from this chat?'
      "
      :dismissible="!creatingNote"
      :close="false"
    >
      <template #body>
        <template v-if="creatingNote">
          <p>
            AI is organizing this conversation into a draft. You can review,
            edit or discard it when ready.
          </p>
          <p
            class="mt-4 flex items-center gap-2 text-primary"
            role="status"
            aria-live="polite"
          >
            <UIcon
              name="i-lucide-loader-circle"
              class="motion-safe:animate-spin"
            />
            Organizing conversation…
          </p>
        </template>
        <UAlert
          v-else-if="notePhase === 'failed'"
          :title="noteFailure"
          color="error"
          role="alert"
        />
        <p v-else>
          AI will organize this conversation into a draft. You can review and
          edit it before saving.
        </p>
      </template>
      <template v-if="!creatingNote" #footer>
        <UButton
          color="neutral"
          variant="outline"
          class="min-h-11"
          @click="noteDialog = false"
        >
          {{ notePhase === "failed" ? "Back to chat" : "Cancel" }}
        </UButton>
        <UButton class="min-h-11" @click="createNote">
          {{ notePhase === "failed" ? "Try again" : "Generate" }}
        </UButton>
      </template>
    </UModal>
    <UModal
      v-model:open="assignment"
      title="Change category"
      :dismissible="!busy"
      :close="!busy"
    >
      <template #body>
        <UAlert v-if="failure" :title="failure" color="error" class="mb-4" />
        <UFormField label="Category">
          <USelect
            v-model="target"
            :items="categoryOptions"
            :disabled="busy"
            class="w-full"
          />
        </UFormField>
      </template>
      <template #footer>
        <UButton
          color="neutral"
          variant="ghost"
          :disabled="busy"
          @click="assignment = false"
        >
          Cancel
        </UButton>
        <UButton :loading="busy" @click="saveCategory">Save</UButton>
      </template>
    </UModal>
    <UModal
      v-model:open="deletion"
      title="Delete chat"
      :dismissible="!busy"
      :close="!busy"
    >
      <template #body>
        <UAlert v-if="failure" :title="failure" color="error" class="mb-4" />
        <p>
          Permanently delete this conversation and all its messages? This cannot
          be undone.
        </p>
      </template>
      <template #footer>
        <UButton
          color="neutral"
          variant="ghost"
          :disabled="busy"
          @click="deletion = false"
        >
          Cancel
        </UButton>
        <UButton color="error" :loading="busy" @click="remove">
          Delete chat
        </UButton>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
.chat-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-height: 64px;
  padding: 12px 24px;
  border-bottom: 1px solid var(--ui-border);
  justify-content: flex-end;
  flex-shrink: 0;
}
.new-chat {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px 32px;
}
.new-chat-category {
  position: absolute;
  top: 12px;
  right: 32px;
  max-width: calc(100% - 64px);
  gap: 6px;
  padding: 6px 10px;
  border-radius: 6px;
  background: var(--ui-bg-muted);
  font-size: 12px;
  line-height: 16px;
}
.new-chat-card {
  width: 100%;
  max-width: 800px;
  padding: 24px;
  background: var(--ui-bg-elevated);
}
.chat-session {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
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
.chat-messages {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.chat-inner {
  width: 100%;
  max-width: 800px;
  margin-inline: auto;
  padding: 16px 32px;
}
.chat-user-message {
  width: 70%;
  margin-left: auto;
  padding: 16px;
  background: var(--ui-bg-muted);
  border: 1px solid var(--ui-border);
  border-radius: 4px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.chat-assistant-message {
  padding-block: 16px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.6;
}
.chat-composer-container {
  position: relative;
  flex-shrink: 0;
  padding-bottom: env(safe-area-inset-bottom);
}
.chat-scroll-bottom {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  min-width: 44px;
  min-height: 44px;
  justify-content: center;
  border-radius: 999px;
  background: var(--ui-bg);
  box-shadow: 0 2px 8px rgb(0 0 0 / 15%);
}
@media (max-width: 767px) {
  .chat-actions :deep(button) {
    min-height: 44px;
  }
  .chat-actions {
    padding: 8px 16px 8px 72px;
  }
  .chat-actions :deep(> button) {
    flex-shrink: 0;
  }
  .chat-category-prefix {
    display: none;
  }
  .new-chat {
    padding: 8px;
  }
  .new-chat-category {
    right: 16px;
    max-width: calc(100% - 88px);
  }
  .new-chat-card {
    padding: 24px 12px;
  }
  .chat-inner {
    padding: 16px;
  }
}
.chat-page {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
}
</style>
