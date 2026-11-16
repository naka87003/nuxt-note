import { INPUT_LIMITS } from "#shared/utils/input-limits";
import type { ChatMessage, ChatStatus, Conversation } from "#shared/types/chat";
import { readChatStream } from "~/utils/chat-stream";

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
  const canStop = ref(false);
  const stopping = ref(false);
  let activeController: AbortController | undefined;
  const failure = ref("");
  const progressLabel = ref("");
  const draft = ref("");

  const busy = computed(() => sending.value || !!chat.value?.generationId);

  const lastQuestion = computed(() =>
    chat.value?.messages.findLast((m) => m.role === "user"),
  );

  const lastReply = computed(() =>
    chat.value?.messages.find((m) => m.replyToId === lastQuestion.value?.id),
  );

  const showProgressLabel = computed(
    () => sending.value && !failure.value && !!progressLabel.value,
  );

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

      if (!disposed && chat.value?.id === chatId && result.title) {
        chat.value.title = result.title;
      }

      await refreshNuxtData("workspace-list");
    } catch {
      // Keep the existing title; this must not interrupt the conversation.
    }
  }

  async function reloadAfterInterruption(attemptId: string) {
    await refresh();
    if (!stopping.value) return;

    // Disconnecting cancels the provider, but the server still needs to drain
    // its checkpoint and commit the partial answer before another send.
    const deadline = Date.now() + 10_000;

    while (
      !disposed &&
      chat.value?.generationId === attemptId &&
      Date.now() < deadline
    ) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      if (!disposed) await refresh();
    }

    if (!disposed && chat.value?.generationId === attemptId) {
      failure.value =
        "The response is still stopping. Please reload this chat to check its status.";
    }
  }

  async function generate() {
    if (busy.value || !persisted.value || !chat.value || !lastQuestion.value) {
      return;
    }

    const target = chat.value;
    const questionId = lastQuestion.value.id;
    sending.value = true;
    failure.value = "";
    progressLabel.value = "Processing request…";

    const attempt = {
      id: crypto.randomUUID(),
      controller: new AbortController(),
    };

    activeController = attempt.controller;
    let terminalStatus: ChatStatus | undefined;

    try {
      const response = await fetch(`/api/chats/${target.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: questionId, attemptId: attempt.id }),
        signal: attempt.controller.signal,
      });

      if (!response.ok || !response.body) {
        if (response.status === 503) {
          throw new Error(
            "Response generation is currently unavailable. Please try again later.",
          );
        }

        if (response.status === 409) {
          throw new Error("This conversation has changed. Please try again.");
        }

        throw new Error("Could not generate a response. Please try again.");
      }

      let reply: ChatMessage | undefined;

      for await (const data of readChatStream(response.body)) {
        if (disposed || attempt.controller.signal.aborted) continue;

        if (data.type === "start") {
          target.generationId = attempt.id;
          canStop.value = true;
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
        } else if (data.type === "progress") {
          progressLabel.value = data.label;
        } else if (data.type === "text" && reply) {
          if (data.text) progressLabel.value = "";
          reply.content += data.text;
        } else if (data.type === "done") {
          canStop.value = false;
          progressLabel.value = "";
          terminalStatus = data.status;
          if (reply) reply.status = data.status;
          if (data.title !== undefined) target.title = data.title;

          if (data.categoryId !== undefined) {
            target.categoryId = data.categoryId;
          }
        }
      }

      if (!terminalStatus) {
        throw new Error("The connection was interrupted. Please try again.");
      }
    } catch (error) {
      if (!attempt.controller.signal.aborted && !disposed) {
        failure.value =
          error instanceof Error
            ? error.message
            : "Could not generate a response. Please try again.";
      }
    } finally {
      canStop.value = false;
      activeController = undefined;
      progressLabel.value = stopping.value ? "Stopping response…" : "";

      if (!disposed) {
        // A completed stream already contains the saved answer. Only failures
        // and interruptions need to reload the server's partial state.
        if (terminalStatus === "completed") {
          target.generationId = null;
        } else {
          await reloadAfterInterruption(attempt.id).catch(() => {
            failure.value =
              "Could not reload this chat. Please reload the page.";
          });
        }

        void refreshNuxtData(["workspace-list", "workspace-categories"]).catch(
          () => {},
        );
      }

      sending.value = false;
      stopping.value = false;
      progressLabel.value = "";

      if (
        terminalStatus === "completed" &&
        questionId === target.messages.find((m) => m.role === "user")?.id
      ) {
        void summarizeTitle(target.id);
      }
    }
  }

  function stop() {
    if (!canStop.value || stopping.value) return;
    canStop.value = false;
    stopping.value = true;
    progressLabel.value = "Stopping response…";
    activeController?.abort();
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
    ) {
      pending = {
        messageId: crypto.randomUUID(),
        content,
        ...(isNew ? { categoryId } : {}),
      };
    }

    if (isNew) {
      chat.value = {
        id: (pending.chatId ??= crypto.randomUUID()),
        title: null,
        categoryId,
        generationId: null,
        messages: [],
      };
    }

    const target = chat.value;
    if (!target) return;

    const message: ChatMessage = {
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
    progressLabel.value = "Saving message…";

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
      progressLabel.value = "";
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

  function resumeUnansweredQuestion() {
    if (lastQuestion.value && !lastReply.value && !chat.value?.generationId) {
      void generate();
    }
  }

  onMounted(() => {
    if (chat.value) resumeUnansweredQuestion();
    else watch(chat, resumeUnansweredQuestion, { once: true });
  });

  onBeforeUnmount(() => {
    disposed = true;
    activeController?.abort();
  });

  return {
    draft,
    persisted,
    busy,
    showProgressLabel,
    progressLabel,
    sending,
    canStop,
    stopping,
    failure,
    canRetry,
    lastReply,
    send,
    generate,
    stop,
  };
}
