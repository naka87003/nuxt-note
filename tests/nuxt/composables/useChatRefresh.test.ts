import { mountComposable } from "../helpers/mount-composable";
import { ref } from "vue";
import { beforeEach, expect, it, vi } from "vitest";
import type { Conversation } from "#shared/types/chat";
import { useChatRefresh } from "~/composables/useChatRefresh";

const fetchChat = vi.fn();
beforeEach(() => {
  vi.resetAllMocks();
});

async function setup(id = "chat") {
  const chat = ref<Conversation | null>({
    id: "chat",
    title: null,
    generationId: null,
    messages: [],
  });

  const activeId = ref(id);
  const sending = ref(false);

  const { result: refresh } = await mountComposable(() =>
    useChatRefresh(chat, activeId, sending, (id) =>
      fetchChat(`/api/chats/${id}`),
    ),
  );

  return { chat, sending, refresh };
}

it("does not fetch the chat list when global data is refreshed in an empty new session", async () => {
  const { chat, refresh } = await setup("");
  chat.value = null;
  expect(await refresh()).toBeNull();
  expect(fetchChat).not.toHaveBeenCalled();
});

it("preserves an optimistic new question during a global refresh", async () => {
  const { chat, sending, refresh } = await setup("");
  sending.value = true;
  const optimistic = chat.value;
  expect(await refresh()).toBe(optimistic);
  expect(chat.value).toBe(optimistic);
  expect(fetchChat).not.toHaveBeenCalled();
});

it("preserves a streaming answer during a global refresh", async () => {
  const { chat, sending, refresh } = await setup();
  sending.value = true;
  const streaming = chat.value;
  expect(await refresh()).toBe(streaming);
  expect(fetchChat).not.toHaveBeenCalled();
});

it("discards a stale snapshot if sending begins while the request is pending", async () => {
  const { promise, resolve } = Promise.withResolvers<Conversation>();
  fetchChat.mockReturnValue(promise);
  const { chat, sending, refresh } = await setup();
  const pending = refresh();
  const streaming = chat.value;
  sending.value = true;
  resolve({ id: "chat", title: "Stale", generationId: null, messages: [] });
  await pending;
  expect(chat.value).toBe(streaming);
});

it("reloads the persisted partial state explicitly while failure recovery is busy", async () => {
  const { chat, sending, refresh } = await setup();
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
  const { promise, resolve } = Promise.withResolvers<Conversation>();
  fetchChat.mockReturnValue(promise);
  const { chat, sending, refresh } = await setup();
  const pending = refresh();
  const completed = chat.value;
  sending.value = true;
  sending.value = false;
  resolve({ id: "chat", title: "Stale", generationId: null, messages: [] });
  await pending;
  expect(chat.value).toBe(completed);
});

it("updates an idle conversation after a shared category refresh", async () => {
  const { chat, refresh } = await setup();

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

it.each([
  [false, false],
  [false, true],
  [true, false],
  [true, true],
])(
  "preserves the latest snapshot when an older request finishes last (force: %s → %s)",
  async (firstForce, secondForce) => {
    const first = Promise.withResolvers<Conversation>();
    const second = Promise.withResolvers<Conversation>();
    fetchChat
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { chat, refresh } = await setup();
    const older = refresh(firstForce);
    const newer = refresh(secondForce);

    const latest: Conversation = {
      id: "chat",
      title: "Latest",
      generationId: null,
      messages: [],
    };

    second.resolve(latest);
    await newer;
    expect(chat.value).toEqual(latest);

    first.resolve({ ...latest, title: "Stale" });
    expect(await older).toEqual(latest);
    expect(chat.value).toEqual(latest);
  },
);

it("ignores an older snapshot while the latest request is still pending", async () => {
  const first = Promise.withResolvers<Conversation>();
  const second = Promise.withResolvers<Conversation>();
  fetchChat
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise);
  const { chat, refresh } = await setup();
  const initial = chat.value;
  const older = refresh();
  const newer = refresh();

  const latest: Conversation = {
    id: "chat",
    title: "Latest",
    generationId: null,
    messages: [],
  };

  first.resolve({ ...latest, title: "Stale" });
  await older;
  expect(chat.value).toBe(initial);

  second.resolve(latest);
  await newer;
  expect(chat.value).toEqual(latest);
});
