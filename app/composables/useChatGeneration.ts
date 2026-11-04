import { INPUT_LIMITS } from "#shared/utils/input-limits";
import type { ChatMessage, ChatStatus } from "#shared/types/chat";
import { shallowRef } from "vue";
import { readChatStream } from "../utils/chat-stream";
export interface Conversation {
  id: string;
  title: string | null;
  categoryId?: string | null;
  generationId: string | null;
  messages: ChatMessage[];
}
export function useChatGeneration(
  chat: Ref<Conversation | null | undefined>,
  refresh: () => Promise<unknown>,
  creation?: {
    categoryId: () => string | null;
    onCreated: (chat: Conversation) => void;
  },
) {
  const persisted = ref(!creation || !!chat.value);
  const sending = ref(false);
  const activeGeneration = shallowRef<{
    id: string;
    controller: AbortController;
  }>();
  const failure = ref("");
  const draft = ref("");
  const busy = computed(() => sending.value || !!chat.value?.generationId);
  const lastQuestion = computed(() =>
    chat.value?.messages.filter((m) => m.role === "user").at(-1),
  );
  const lastReply = computed(() =>
    chat.value?.messages.find((m) => m.replyToId === lastQuestion.value?.id),
  );
  const waitingForResponse = computed(() => sending.value && !failure.value);
  const canRetry = computed(
    () =>
      !!lastQuestion.value &&
      persisted.value &&
      !busy.value &&
      (!lastReply.value ||
        ["failed", "stopped"].includes(lastReply.value.status)),
  );
  let pending:
    | {
        messageId: string;
        content: string;
        chatId?: string;
        categoryId?: string | null;
      }
    | undefined;
  let disposed = false;
  async function summarizeTitle(chatId: string) {
    try {
      const result = await $fetch(`/api/chats/${chatId}/title`, {
        method: "POST",
      });
      if (!disposed && chat.value?.id === chatId && result.title)
        chat.value.title = result.title;
      await refreshNuxtData("workspace-list");
    } catch {
      // Keep the existing title; this must not interrupt the conversation.
    }
  }
  async function generate() {
    if (busy.value || !persisted.value || !chat.value || !lastQuestion.value)
      return;
    const target = chat.value;
    const questionId = lastQuestion.value.id;
    sending.value = true;
    failure.value = "";
    const attempt = {
      id: crypto.randomUUID(),
      controller: new AbortController(),
    };
    activeGeneration.value = attempt;
    let terminalStatus: ChatStatus | undefined;
    try {
      const response = await fetch(`/api/chats/${target.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: questionId, attemptId: attempt.id }),
        signal: attempt.controller.signal,
      });
      if (!response.ok || !response.body) {
        if (response.status === 503)
          throw new Error(
            "AI is not configured. Please contact the administrator.",
          );
        if (response.status === 409)
          throw new Error("This conversation has changed. Please try again.");
        throw new Error("Could not generate a response. Please try again.");
      }
      let reply: ChatMessage | undefined;
      for await (const data of readChatStream(response.body)) {
        if (disposed) continue;
        if (data.type === "start") {
          reply = target.messages.find((m) => m.id === data.messageId);
          if (reply) {
            reply.content = "";
            reply.status = "generating";
          } else {
            target.messages.push({
              id: data.messageId,
              role: "assistant",
              content: "",
              status: "generating",
              replyToId: questionId,
              createdAt: new Date().toISOString(),
            });
            reply = target.messages.at(-1);
          }
        } else if (data.type === "text" && reply) reply.content += data.text;
        else if (data.type === "done") {
          terminalStatus = data.status;
          if (reply) reply.status = data.status;
        }
      }
      if (!terminalStatus)
        throw new Error("The connection was interrupted. Please try again.");
    } catch (error) {
      if (!attempt.controller.signal.aborted && !disposed)
        failure.value =
          error instanceof Error
            ? error.message
            : "Could not generate a response. Please try again.";
    } finally {
      activeGeneration.value = undefined;
      if (!disposed) {
        // A completed stream already contains the saved answer. Only failures
        // and interruptions need to reload the server's partial state.
        if (terminalStatus === "completed") target.generationId = null;
        else
          await refresh().catch(() => {
            failure.value =
              "Could not reload this chat. Please reload the page.";
          });
        void refreshNuxtData(["workspace-list", "workspace-categories"]).catch(
          () => {},
        );
      }
      sending.value = false;
      if (
        terminalStatus === "completed" &&
        questionId === target.messages.find((m) => m.role === "user")?.id
      )
        void summarizeTitle(target.id);
    }
  }
  async function send() {
    if (busy.value || !draft.value.trim() || (!chat.value && !creation)) return;
    if (draft.value.length > INPUT_LIMITS.chatMessage) {
      failure.value = `Use at most ${INPUT_LIMITS.chatMessage.toLocaleString("en-US")} characters for the message.`;
      return;
    }
    const isNew = !persisted.value;
    const content = draft.value.trim();
    const categoryId = creation?.categoryId() ?? null;
    if (
      !pending ||
      pending.content !== content ||
      (isNew && pending.categoryId !== categoryId)
    )
      pending = {
        messageId: crypto.randomUUID(),
        content,
        ...(isNew ? { chatId: crypto.randomUUID(), categoryId } : {}),
      };
    if (isNew)
      chat.value = {
        id: pending.chatId!,
        title: null,
        categoryId,
        generationId: null,
        messages: [],
      };
    const target = chat.value!;
    const message = {
      id: pending.messageId,
      role: "user" as const,
      content,
      status: "completed",
      replyToId: null,
      createdAt: new Date().toISOString(),
    };
    target.messages.push(message);
    draft.value = "";
    sending.value = true;
    failure.value = "";
    try {
      await $fetch(isNew ? "/api/chats" : `/api/chats/${target.id}/messages`, {
        method: "POST",
        body: pending,
      });
      persisted.value = true;
      pending = undefined;
    } catch {
      if (isNew) chat.value = null;
      else target.messages = target.messages.filter((m) => m.id !== message.id);
      if (!disposed && !draft.value) draft.value = content;
      failure.value = isNew
        ? "Could not create your chat. Please try again."
        : "Could not save your message. Please try again.";
      return;
    } finally {
      sending.value = false;
    }
    if (!disposed && chat.value?.id === target.id) {
      if (isNew) {
        creation?.onCreated(target);
        void refreshNuxtData(["workspace-list", "workspace-categories"]).catch(
          () => {},
        );
      }
      await generate();
    }
  }
  onMounted(() => {
    if (lastQuestion.value && !lastReply.value && !chat.value?.generationId)
      void generate();
  });
  onBeforeUnmount(() => {
    disposed = true;
    activeGeneration.value?.controller.abort();
  });
  return {
    draft,
    persisted,
    busy,
    waitingForResponse,
    sending,
    failure,
    canRetry,
    lastReply,
    send,
    generate,
  };
}
