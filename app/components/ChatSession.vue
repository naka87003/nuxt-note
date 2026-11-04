<script setup lang="ts">
import type { Conversation } from "~/composables/useChatGeneration";
import type { CategoriesResponse } from "#shared/types/workspace";
import { sortCategoriesByCount } from "#shared/utils/categories";

const props = defineProps<{ chatId: string }>();
const emit = defineEmits<{ created: [id: string] }>();
const activeId = ref(props.chatId);
const navigationFailure = ref("");

const route = useRoute();
const { state, location, categoryId } = useWorkspace();

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
const followBottom = ref(true);
const hasNewMessages = ref(false);

function scrollToBottom() {
  const pane = messagePane.value;
  if (!pane) return;
  followBottom.value = true;
  hasNewMessages.value = false;
  pane.scrollTop = pane.scrollHeight;
}

let paneObserver: ResizeObserver | undefined;
watch(messagePane, (pane) => {
  paneObserver?.disconnect();
  if (!pane) return;
  scrollToBottom();
  paneObserver = new ResizeObserver(() => {
    if (followBottom.value) scrollToBottom();
    else onScroll();
  });
  paneObserver.observe(pane);
});
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
    followBottom.value =
      pane.scrollHeight - pane.scrollTop - pane.clientHeight < 80;
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
          color="neutral"
          variant="soft"
          size="xs"
          class="font-bold"
          :disabled="generating || !persisted"
          @click="assign"
        >
          Category: {{ categoryName }}
        </UButton>
        <UButton
          color="neutral"
          variant="soft"
          size="xs"
          class="font-bold"
          :disabled="generating || !persisted"
          @click="
            failure = '';
            deletion = true;
          "
        >
          Delete
        </UButton>
      </div>
      <div ref="messagePane" class="chat-messages" @scroll="onScroll">
        <div class="chat-inner space-y-6">
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
              <MarkdownContent :content="message.content" />
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
          <ChatResponseCursor v-if="waitingForResponse" />
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
            :disabled="generating || (canRetry && !lastReply)"
            @send="send"
          />
        </div>
      </div>
    </div>
    <div v-else class="new-chat">
      <div class="new-chat-card">
        <h1 class="mb-8 text-center text-xl">Start your chat</h1>
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
