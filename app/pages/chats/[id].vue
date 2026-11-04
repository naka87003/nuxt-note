<script setup lang="ts">
import type { CategoriesResponse } from "#shared/types/workspace";
import { sortCategoriesByCount } from "#shared/utils/categories";

definePageMeta({
  key: (route) => String(route.params.id),
  middleware: "auth",
  layout: "workspace",
});

const route = useRoute();
const { state, location } = useWorkspace();

const {
  data: chat,
  error,
  refresh,
} = await useFetch(() => `/api/chats/${route.params.id}`, { deep: true });

const {
  draft,
  busy: generating,
  sending,
  stoppable,
  failure: generationFailure,
  canRetry,
  lastReply,
  send,
  generate,
  stop,
} = useChatGeneration(chat, refresh);

const retryLabel = computed(() =>
  lastReply.value?.status === "stopped" ? "Generate again" : "Try again",
);

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
onMounted(() => {
  scrollToBottom();
  if (!messagePane.value) return;
  paneObserver = new ResizeObserver(() => {
    if (followBottom.value) scrollToBottom();
    else onScroll();
  });
  paneObserver.observe(messagePane.value);
});
onBeforeUnmount(() => paneObserver?.disconnect());

watch(
  () => chat.value?.messages.map((m) => m.content).join(""),
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
    if (!chat.value) return;
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
          :disabled="generating"
          @click="assign"
        >
          Category: {{ categoryName }}
        </UButton>
        <UButton
          color="neutral"
          variant="soft"
          size="xs"
          class="font-bold"
          :disabled="generating"
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
                v-if="message.status === 'generating'"
                class="text-sm text-dimmed"
                role="status"
              >
                Generating…
              </p>
              <p
                v-else-if="message.status === 'stopped'"
                class="text-sm text-dimmed"
              >
                Response stopped.
              </p>
              <p
                v-else-if="message.status === 'failed'"
                class="text-sm text-error"
              >
                Could not complete the response.
              </p>
            </template>
          </div>
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
            {{ retryLabel }}
          </UButton>
          <ChatComposer
            v-model="draft"
            :busy="sending"
            :can-stop="stoppable"
            :disabled="generating || (canRetry && !lastReply)"
            @send="send"
            @stop="stop"
          />
        </div>
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
