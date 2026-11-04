import { computed, ref } from "vue";
import { beforeEach, expect, it, vi } from "vitest";
import {
  useChatGeneration,
  type Conversation,
} from "../../app/composables/useChatGeneration";

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
  save.mockResolvedValue({});
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
  const chat = ref<Conversation | null>(null);
  const category = ref<string | null>("category");
  const onCreated = vi.fn();
  const refresh = vi.fn().mockResolvedValue(undefined);
  const generation = useChatGeneration(chat, refresh, {
    categoryId: () => category.value,
    onCreated,
  });
  return { chat, category, onCreated, refresh, generation };
}

it("shows the first question and cursor immediately, then generates in the same conversation", async () => {
  let acknowledge!: () => void;
  save.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      acknowledge = resolve;
    }),
  );
  const { chat, onCreated, refresh, generation } = setup();
  generation.draft.value = " First question ";
  const sending = generation.send();
  const optimistic = chat.value;
  expect(optimistic?.messages[0]?.content).toBe("First question");
  expect(generation.draft.value).toBe("");
  expect(generation.waitingForResponse.value).toBe(true);
  expect(generation.persisted.value).toBe(false);
  expect(generation.canRetry.value).toBe(false);
  await generation.send();
  await generation.generate();
  expect(save).toHaveBeenCalledTimes(1);
  expect(generate).not.toHaveBeenCalled();
  expect(onCreated).not.toHaveBeenCalled();
  acknowledge();
  await sending;
  expect(onCreated).toHaveBeenCalledWith(optimistic);
  expect(chat.value).toBe(optimistic);
  expect(chat.value?.messages).toHaveLength(2);
  expect(chat.value?.messages.at(-1)?.content).toBe("Answer");
  expect(refresh).not.toHaveBeenCalled();
  expect(generation.persisted.value).toBe(true);
  expect(generation.busy.value).toBe(false);
  expect(save.mock.calls[0]![0]).toBe("/api/chats");
  expect(save.mock.calls[0]![1].body).toMatchObject({
    chatId: chat.value?.id,
    messageId: chat.value?.messages[0]?.id,
    content: "First question",
    categoryId: "category",
  });
  generation.draft.value = "Follow-up";
  await generation.send();
  expect(save.mock.calls[2]![0]).toBe(`/api/chats/${chat.value?.id}/messages`);
  expect(onCreated).toHaveBeenCalledTimes(1);
});

it("restores the first draft after a lost acknowledgement and reuses both request IDs", async () => {
  save.mockRejectedValueOnce(new Error("Lost acknowledgement"));
  const { chat, onCreated, generation } = setup();
  generation.draft.value = "Question";
  await generation.send();
  const first = save.mock.calls[0]![1].body;
  expect(chat.value).toBeNull();
  expect(generation.draft.value).toBe("Question");
  expect(generation.failure.value).toContain("Could not create");
  expect(generation.waitingForResponse.value).toBe(false);
  expect(onCreated).not.toHaveBeenCalled();
  expect(generate).not.toHaveBeenCalled();
  await generation.send();
  expect(save.mock.calls[1]![1].body).toEqual(first);
});

it("uses a new request when the category changes after a failed creation", async () => {
  save.mockRejectedValueOnce(new Error("Save failed"));
  const { category, generation } = setup();
  generation.draft.value = "Question";
  await generation.send();
  const firstId = save.mock.calls[0]![1].body.chatId;
  category.value = null;
  await generation.send();
  expect(save.mock.calls[1]![1].body.chatId).not.toBe(firstId);
  expect(save.mock.calls[1]![1].body.categoryId).toBeNull();
});

it("does not navigate or start generation if the user leaves while creation is pending", async () => {
  let acknowledge!: () => void;
  save.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      acknowledge = resolve;
    }),
  );
  const { onCreated, generation } = setup();
  generation.draft.value = "Question";
  const sending = generation.send();
  unmount();
  acknowledge();
  await sending;
  expect(onCreated).not.toHaveBeenCalled();
  expect(generate).not.toHaveBeenCalled();
});

it("starts generation without waiting for list refreshes or URL navigation", async () => {
  vi.mocked(refreshNuxtData).mockReturnValue(new Promise(() => {}));
  const { onCreated, generation } = setup();
  onCreated.mockReturnValue(new Promise(() => {}));
  generation.draft.value = "Question";
  await generation.send();
  expect(generate).toHaveBeenCalledTimes(1);
  expect(generation.busy.value).toBe(false);
});

it("retries a failed first answer without creating another chat or question", async () => {
  generate.mockResolvedValueOnce(new Response("", { status: 503 }));
  const { chat, onCreated, generation } = setup();
  generation.draft.value = "Question";
  await generation.send();
  const id = chat.value?.id;
  expect(generation.persisted.value).toBe(true);
  expect(generation.canRetry.value).toBe(true);
  expect(chat.value?.messages).toHaveLength(1);
  await generation.generate();
  expect(chat.value?.id).toBe(id);
  expect(chat.value?.messages).toHaveLength(2);
  expect(chat.value?.messages.at(-1)?.content).toBe("Answer");
  expect(onCreated).toHaveBeenCalledTimes(1);
  expect(save.mock.calls.filter(([url]) => url === "/api/chats")).toHaveLength(
    1,
  );
});
