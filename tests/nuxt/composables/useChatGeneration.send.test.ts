import { mockNuxtImport } from "@nuxt/test-utils/runtime";
import { mountComposable } from "../helpers/mount-composable";
import { ref } from "vue";
import { beforeEach, expect, it, vi } from "vitest";
import type { ChatMessage } from "#shared/types/chat";
import {
  useChatGeneration,
  type Conversation,
} from "~/composables/useChatGeneration";

const refreshNuxtData = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
mockNuxtImport("refreshNuxtData", () => refreshNuxtData);

const save = vi.hoisted(() => vi.fn().mockResolvedValue(null));
mockNuxtImport("$fetch", () => save);
const generate = vi.fn();
beforeEach(() => {
  vi.resetAllMocks();
  refreshNuxtData.mockResolvedValue(undefined);
  vi.stubGlobal("fetch", generate);
  generate.mockImplementation(
    async () =>
      new Response(
        [
          { type: "start", messageId: "reply" },
          { type: "text", text: "Answer" },
          { type: "done", status: "completed" },
        ]
          .map((data) => `data: ${JSON.stringify(data)}\n\n`)
          .join(""),
      ),
  );
});

async function setup(messages: ChatMessage[] = []) {
  const chat = ref({
    id: "chat",
    title: "Title",
    generationId: null,
    messages,
  });
  const refresh = vi.fn().mockResolvedValue(undefined);
  const { result: generation, unmount } = await mountComposable(() =>
    useChatGeneration(chat, refresh),
  );
  return { chat, refresh, generation, unmount };
}

it("shows the question immediately and starts AI after saving without reloading history", async () => {
  let saved!: () => void;
  save.mockReturnValueOnce(new Promise<void>((resolve) => (saved = resolve)));
  const { chat, refresh, generation } = await setup();
  generation.draft.value = " Question ";
  const sending = generation.send();
  expect(chat.value.messages[0]?.content).toBe("Question");
  expect(generation.draft.value).toBe("");
  expect(generation.busy.value).toBe(true);
  expect(generation.waitingForResponse.value).toBe(true);
  expect(generate).not.toHaveBeenCalled();
  await generation.send();
  expect(save).toHaveBeenCalledTimes(1);
  generate.mockImplementationOnce(async (_url, options) => {
    expect(refresh).not.toHaveBeenCalled();
    expect(JSON.parse(options.body).messageId).toBe(chat.value.messages[0]?.id);
    return new Response('data: {"type":"done","status":"failed"}\n\n');
  });
  saved();
  await sending;
  expect(generate).toHaveBeenCalledTimes(1);
  expect(refresh).toHaveBeenCalledTimes(1);
});

it("restores a failed send and reuses its request ID on retry", async () => {
  save.mockRejectedValueOnce(new Error("Lost acknowledgement"));
  const { chat, generation } = await setup();
  generation.draft.value = "Question";
  await generation.send();
  const firstId = save.mock.calls[0]![1].body.messageId;
  expect(chat.value.messages).toEqual([]);
  expect(generation.draft.value).toBe("Question");
  expect(generation.failure.value).toContain("Could not save");
  expect(generation.waitingForResponse.value).toBe(false);
  expect(generate).not.toHaveBeenCalled();
  save.mockResolvedValue(undefined);
  await generation.send();
  expect(save.mock.calls[1]![1].body.messageId).toBe(firstId);
  expect(chat.value.messages.filter((m) => m.role === "user")).toHaveLength(1);
  expect(generation.failure.value).toBe("");
});

it("does not start AI when the user leaves during message persistence", async () => {
  let saved!: () => void;
  save.mockReturnValueOnce(new Promise<void>((resolve) => (saved = resolve)));
  const { generation, unmount } = await setup();
  generation.draft.value = "Question";
  const sending = generation.send();
  unmount();
  saved();
  await sending;
  expect(generate).not.toHaveBeenCalled();
});

it("makes the next send available after completion while sidebar updates are pending", async () => {
  vi.mocked(refreshNuxtData).mockReturnValue(new Promise(() => {}));
  save.mockResolvedValue(undefined);
  const { chat, refresh, generation } = await setup();
  generation.draft.value = "Question";
  await generation.send();
  expect(refresh).not.toHaveBeenCalled();
  expect(chat.value.messages.at(-1)?.content).toBe("Answer");
  expect(chat.value.messages.at(-1)?.status).toBe("completed");
  expect(generation.waitingForResponse.value).toBe(false);
  expect(generation.busy.value).toBe(false);
});

it("keeps sending disabled while reloading after generation has failed", async () => {
  save.mockResolvedValue(undefined);
  let respond!: (response: Response) => void;
  generate.mockReturnValueOnce(
    new Promise<Response>((resolve) => (respond = resolve)),
  );
  const { refresh, generation } = await setup();
  let reloaded!: () => void;
  refresh.mockReturnValueOnce(
    new Promise<void>((resolve) => (reloaded = resolve)),
  );
  generation.draft.value = "Question";
  const sending = generation.send();
  await vi.waitFor(() => expect(generate).toHaveBeenCalledTimes(1));
  expect(generation.waitingForResponse.value).toBe(true);
  respond(new Response("", { status: 503 }));
  await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  expect(generation.busy.value).toBe(true);
  expect(generation.waitingForResponse.value).toBe(false);
  reloaded();
  await sending;
  expect(generation.busy.value).toBe(false);
});

it("clears the cursor and permits retry after an interrupted partial response", async () => {
  save.mockResolvedValue(undefined);
  generate.mockResolvedValueOnce(
    new Response(
      [
        { type: "start", messageId: "reply" },
        { type: "text", text: "Partial answer" },
      ]
        .map((data) => `data: ${JSON.stringify(data)}\n\n`)
        .join(""),
    ),
  );
  const { chat, refresh, generation } = await setup();
  refresh.mockImplementation(async () => {
    expect(generation.waitingForResponse.value).toBe(false);
    expect(generation.busy.value).toBe(true);
    chat.value.messages.at(-1)!.status = "stopped";
    chat.value.generationId = null;
  });
  generation.draft.value = "Question";
  await generation.send();
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(chat.value.messages.at(-1)?.content).toBe("Partial answer");
  expect(generation.failure.value).toContain("connection was interrupted");
  expect(generation.waitingForResponse.value).toBe(false);
  expect(generation.busy.value).toBe(false);
  expect(generation.canRetry.value).toBe(true);
  await generation.generate();
  expect(chat.value.messages).toHaveLength(2);
  expect(chat.value.messages.at(-1)?.content).toBe("Answer");
  expect(generation.failure.value).toBe("");
  expect(generation.canRetry.value).toBe(false);
});

it("aborts its own stream on navigation and preserves the displayed partial answer", async () => {
  save.mockResolvedValue(undefined);
  generate.mockImplementationOnce(async (_url, options) => {
    const encoder = new TextEncoder();
    return new Response(
      new ReadableStream({
        start(controller) {
          for (const event of [
            { type: "start", messageId: "reply" },
            { type: "text", text: "Partial answer" },
          ])
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
            );
          options.signal.addEventListener(
            "abort",
            () => controller.error(new DOMException("Stopped", "AbortError")),
            { once: true },
          );
        },
      }),
    );
  });
  const { chat, refresh, generation, unmount } = await setup();
  generation.draft.value = "Question";
  const sending = generation.send();
  await vi.waitFor(() =>
    expect(chat.value.messages.at(-1)?.content).toBe("Partial answer"),
  );
  expect(generation.waitingForResponse.value).toBe(true);
  unmount();
  await sending;
  expect(generate.mock.calls[0]![1].signal.aborted).toBe(true);
  expect(chat.value.messages.at(-1)?.content).toBe("Partial answer");
  expect(refresh).not.toHaveBeenCalled();
  expect(generation.failure.value).toBe("");
  expect(generation.waitingForResponse.value).toBe(false);
});

it("preserves an oversized draft without saving or starting AI", async () => {
  const { chat, generation } = await setup();
  const content = "あ".repeat(2001);
  generation.draft.value = content;
  await generation.send();
  expect(generation.draft.value).toBe(content);
  expect(generation.failure.value).toContain("2,000");
  expect(chat.value.messages).toEqual([]);
  expect(save).not.toHaveBeenCalled();
  expect(generate).not.toHaveBeenCalled();
});

it("starts an unanswered saved question when mounted", async () => {
  save.mockResolvedValue({ title: "Summary" });
  const { chat, generation } = await setup([
    {
      id: "question",
      role: "user",
      content: "Question",
      status: "completed",
      replyToId: null,
      createdAt: new Date().toISOString(),
    },
  ]);
  await vi.waitFor(() => {
    expect(generation.sending.value).toBe(false);
    expect(chat.value.messages.at(-1)?.content).toBe("Answer");
    expect(chat.value.title).toBe("Summary");
  });
  expect(generate).toHaveBeenCalledTimes(1);
});

it("starts an unanswered question loaded after mounting only once", async () => {
  const chat = ref<Conversation | null>(null);
  await mountComposable(() => useChatGeneration(chat, vi.fn()));
  expect(generate).not.toHaveBeenCalled();
  const saved: Conversation = {
    id: "delayed-chat",
    title: "Loaded chat",
    generationId: null,
    messages: [
      {
        id: "question",
        role: "user",
        content: "Question",
        status: "completed",
        replyToId: null,
        createdAt: new Date().toISOString(),
      },
    ],
  };
  chat.value = structuredClone(saved);
  await vi.waitFor(() => {
    expect(chat.value?.messages.at(-1)?.content).toBe("Answer");
  });
  // A later refresh must not automatically retry an unanswered snapshot.
  chat.value = structuredClone(saved);
  await new Promise<void>((resolve) => queueMicrotask(resolve));
  expect(generate).toHaveBeenCalledTimes(1);
});
