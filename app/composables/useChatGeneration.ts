import type { ChatMessage, ChatStatus } from "#shared/types/chat";
import { shallowRef } from "vue";
import { readChatStream } from "../utils/chat-stream";
interface Conversation {
  id: string;
  title: string | null;
  generationId: string | null;
  messages: ChatMessage[];
}
export function useChatGeneration(
  chat: Ref<Conversation | null | undefined>,
  refresh: () => Promise<unknown>,
) {
  const sending = ref(false);
  const stopping = ref(false);
  const activeGeneration = shallowRef<{
    id: string;
    controller: AbortController;
  }>();
  const failure = ref("");
  const draft = ref("");
  const busy = computed(
    () => sending.value || stopping.value || !!chat.value?.generationId,
  );
  const lastQuestion = computed(() =>
    chat.value?.messages.filter((m) => m.role === "user").at(-1),
  );
  const lastReply = computed(() =>
    chat.value?.messages.find((m) => m.replyToId === lastQuestion.value?.id),
  );
  const stoppable = computed(() => !stopping.value && !!activeGeneration.value);
  const canRetry = computed(
    () =>
      !!lastQuestion.value &&
      !busy.value &&
      (!lastReply.value ||
        ["failed", "stopped"].includes(lastReply.value.status)),
  );
  let pending: { messageId: string; content: string } | undefined;
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
    if (busy.value || !chat.value || !lastQuestion.value) return;
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
        sending.value = false;
        void refreshNuxtData(["workspace-list", "workspace-categories"]).catch(
          () => {},
        );
      }
      if (
        terminalStatus === "completed" &&
        questionId === target.messages.find((m) => m.role === "user")?.id
      )
        void summarizeTitle(target.id);
    }
  }
  async function send() {
    if (busy.value || !draft.value.trim() || !chat.value) return;
    const content = draft.value.trim();
    if (!pending || pending.content !== content)
      pending = { messageId: crypto.randomUUID(), content };
    const target = chat.value;
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
      await $fetch(`/api/chats/${target.id}/messages`, {
        method: "POST",
        body: pending,
      });
      pending = undefined;
    } catch {
      target.messages = target.messages.filter((m) => m.id !== message.id);
      if (!disposed && !draft.value) draft.value = content;
      failure.value = "Could not save your message. Please try again.";
      return;
    } finally {
      sending.value = false;
    }
    if (!disposed && chat.value?.id === target.id) await generate();
  }
  async function stop() {
    const attempt = activeGeneration.value;
    if (!chat.value || !stoppable.value || !attempt) return;
    const target = chat.value;
    stopping.value = true;
    try {
      await $fetch(`/api/chats/${target.id}/stop`, {
        method: "POST",
        body: { attemptId: attempt.id },
      });
      attempt.controller.abort();
      await refresh();
    } catch {
      failure.value = "Could not stop the response. Please try again.";
    } finally {
      stopping.value = false;
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
    busy,
    stoppable,
    sending,
    failure,
    canRetry,
    lastReply,
    send,
    generate,
    stop,
  };
}
