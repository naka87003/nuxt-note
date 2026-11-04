import { ref } from "vue";
import { beforeEach, expect, it, vi } from "vitest";
import type { Conversation } from "../../app/composables/useChatGeneration";
import { useChatRefresh } from "../../app/composables/useChatRefresh";

const fetchChat = vi.fn();
beforeEach(() => {
  vi.resetAllMocks();
});

function setup(id = "chat") {
  const chat = ref<Conversation | null>({
    id: "chat",
    title: null,
    generationId: null,
    messages: [],
  });
  const activeId = ref(id);
  const sending = ref(false);
  return {
    chat,
    sending,
    refresh: useChatRefresh(chat, activeId, sending, (id) =>
      fetchChat(`/api/chats/${id}`),
    ),
  };
}

it("does not fetch the chat list when global data is refreshed in an empty new session", async () => {
  const { chat, refresh } = setup("");
  chat.value = null;
  expect(await refresh()).toBeNull();
  expect(fetchChat).not.toHaveBeenCalled();
});

it("preserves an optimistic new question during a global refresh", async () => {
  const { chat, sending, refresh } = setup("");
  sending.value = true;
  const optimistic = chat.value;
  expect(await refresh()).toBe(optimistic);
  expect(chat.value).toBe(optimistic);
  expect(fetchChat).not.toHaveBeenCalled();
});

it("preserves a streaming answer during a global refresh", async () => {
  const { chat, sending, refresh } = setup();
  sending.value = true;
  const streaming = chat.value;
  expect(await refresh()).toBe(streaming);
  expect(fetchChat).not.toHaveBeenCalled();
});

it("discards a stale snapshot if sending begins while the request is pending", async () => {
  let resolve!: (value: Conversation) => void;
  fetchChat.mockReturnValue(
    new Promise<Conversation>((done) => {
      resolve = done;
    }),
  );
  const { chat, sending, refresh } = setup();
  const pending = refresh();
  const streaming = chat.value;
  sending.value = true;
  resolve({ id: "chat", title: "Stale", generationId: null, messages: [] });
  await pending;
  expect(chat.value).toBe(streaming);
});

it("reloads the persisted partial state explicitly while failure recovery is busy", async () => {
  const { chat, sending, refresh } = setup();
  sending.value = true;
  const snapshot = {
    id: "chat",
    title: "Saved",
    generationId: null,
    messages: [],
  };
  fetchChat.mockResolvedValue(snapshot);
  await refresh(true);
  expect(fetchChat).toHaveBeenCalledWith("/api/chats/chat");
  expect(chat.value).toEqual(snapshot);
});

it("discards an older snapshot even if the new response finishes before it arrives", async () => {
  let resolve!: (value: Conversation) => void;
  fetchChat.mockReturnValue(
    new Promise<Conversation>((done) => {
      resolve = done;
    }),
  );
  const { chat, sending, refresh } = setup();
  const pending = refresh();
  const completed = chat.value;
  sending.value = true;
  sending.value = false;
  resolve({ id: "chat", title: "Stale", generationId: null, messages: [] });
  await pending;
  expect(chat.value).toBe(completed);
});

it("updates an idle conversation after a shared category refresh", async () => {
  const { chat, refresh } = setup();
  const snapshot = {
    id: "chat",
    title: null,
    categoryId: null,
    generationId: null,
    messages: [],
  };
  fetchChat.mockResolvedValue(snapshot);
  await refresh();
  expect(chat.value).toEqual(snapshot);
});
