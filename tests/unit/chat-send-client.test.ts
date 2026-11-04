import { computed, ref } from "vue";
import { beforeEach, expect, it, vi } from "vitest";
import type { ChatMessage } from "../../shared/types/chat";
import { useChatGeneration } from "../../app/composables/useChatGeneration";

const save = vi.fn();
const generate = vi.fn();
let unmount: () => void;
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("ref", ref);
  vi.stubGlobal("computed", computed);
  vi.stubGlobal("onMounted", vi.fn());
  vi.stubGlobal("onBeforeUnmount", (callback: () => void) => {
    unmount = callback;
  });
  vi.stubGlobal("$fetch", save);
  vi.stubGlobal("refreshNuxtData", vi.fn().mockResolvedValue(undefined));
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

function setup() {
  const chat = ref({
    id: "chat",
    title: "Title",
    generationId: null,
    messages: [] as ChatMessage[],
  });
  const refresh = vi.fn().mockResolvedValue(undefined);
  return { chat, refresh, generation: useChatGeneration(chat, refresh) };
}

it("shows the question immediately and starts AI after saving without reloading history", async () => {
  let saved!: () => void;
  save.mockReturnValueOnce(new Promise<void>((resolve) => (saved = resolve)));
  const { chat, refresh, generation } = setup();
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
  const { chat, generation } = setup();
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
  const { generation } = setup();
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
  const { chat, refresh, generation } = setup();
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
  const { refresh, generation } = setup();
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
  const { chat, refresh, generation } = setup();
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
  const { chat, refresh, generation } = setup();
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
