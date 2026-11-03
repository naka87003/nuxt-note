import type { ChatMessage } from "#shared/types/chat";
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
  const failure = ref("");
  const draft = ref("");
  const busy = computed(() => sending.value || !!chat.value?.generationId);
  const lastQuestion = computed(() =>
    chat.value?.messages.filter((m) => m.role === "user").at(-1),
  );
  const lastReply = computed(() =>
    chat.value?.messages.find((m) => m.replyToId === lastQuestion.value?.id),
  );
  const stoppable = computed(
    () => !!chat.value?.generationId || (sending.value && !!controller),
  );
  const canRetry = computed(
    () =>
      !!lastQuestion.value &&
      !busy.value &&
      (!lastReply.value ||
        ["failed", "stopped"].includes(lastReply.value.status)),
  );
  let controller: AbortController | undefined;
  let attemptId = "";
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
    attemptId = crypto.randomUUID();
    controller = new AbortController();
    let shouldSummarizeTitle = false;
    try {
      const response = await fetch(`/api/chats/${target.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: questionId, attemptId }),
        signal: controller.signal,
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
      const reader = response.body
        .pipeThrough(new TextDecoderStream())
        .getReader();
      let buffer = "";
      let reply: ChatMessage | undefined;
      let done = false;
      try {
        while (true) {
          const result = await reader.read();
          if (result.done) break;
          buffer += result.value;
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const data = JSON.parse(line.slice(5).trim());
            if (disposed) continue;
            if (data.type === "start") {
              reply = target.messages.find((m) => m.id === data.messageId);
              if (reply) {
                reply.content = "";
                reply.status = "generating";
              } else {
                reply = {
                  id: data.messageId,
                  role: "assistant",
                  content: "",
                  status: "generating",
                  replyToId: questionId,
                  createdAt: new Date().toISOString(),
                };
                target.messages.push(reply);
                reply = target.messages.at(-1);
              }
            } else if (data.type === "text" && reply)
              reply.content += data.text;
            else if (data.type === "done") {
              done = true;
              if (reply) reply.status = data.status;
              shouldSummarizeTitle =
                data.status === "completed" &&
                reply?.replyToId ===
                  target.messages.find((m) => m.role === "user")?.id;
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
      if (!done)
        throw new Error("The connection was interrupted. Please try again.");
    } catch (error) {
      if (!controller.signal.aborted && !disposed)
        failure.value =
          error instanceof Error
            ? error.message
            : "Could not generate a response. Please try again.";
    } finally {
      controller = undefined;
      if (!disposed) {
        sending.value = false;
        await refresh().catch(() => {
          failure.value = "Could not reload this chat. Please reload the page.";
        });
        await refreshNuxtData(["workspace-list", "workspace-categories"]);
      }
      if (shouldSummarizeTitle) void summarizeTitle(target.id);
    }
  }
  async function send() {
    if (busy.value || !draft.value.trim() || !chat.value) return;
    const content = draft.value.trim();
    if (!pending || pending.content !== content)
      pending = { messageId: crypto.randomUUID(), content };
    sending.value = true;
    failure.value = "";
    try {
      await $fetch(`/api/chats/${chat.value.id}/messages`, {
        method: "POST",
        body: pending,
      });
      await refresh();
      draft.value = "";
      pending = undefined;
    } catch {
      failure.value = "Could not save your message. Please try again.";
      return;
    } finally {
      sending.value = false;
    }
    await generate();
  }
  async function stop() {
    if (!chat.value || !busy.value) return;
    try {
      await $fetch(`/api/chats/${chat.value.id}/stop`, {
        method: "POST",
        body: { attemptId: chat.value.generationId || attemptId },
      });
      controller?.abort();
      await refresh();
    } catch {
      failure.value = "Could not stop the response. Please try again.";
    }
  }
  // A different tab can own generation. Refresh its persisted state without opening another stream.
  let poll: ReturnType<typeof setInterval> | undefined;
  onMounted(() => {
    poll = setInterval(() => {
      if (chat.value?.generationId && !sending.value) void refresh();
    }, 2000);
    if (lastQuestion.value && !lastReply.value && !chat.value?.generationId)
      void generate();
  });
  onBeforeUnmount(() => {
    disposed = true;
    controller?.abort();
    clearInterval(poll);
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
