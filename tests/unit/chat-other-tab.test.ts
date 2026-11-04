import { computed, ref } from "vue";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useChatGeneration } from "../../app/composables/useChatGeneration";

let mount: () => void;
let unmount: () => void;
const request = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.stubGlobal("ref", ref);
  vi.stubGlobal("computed", computed);
  vi.stubGlobal("onMounted", (callback: () => void) => (mount = callback));
  vi.stubGlobal(
    "onBeforeUnmount",
    (callback: () => void) => (unmount = callback),
  );
  vi.stubGlobal("$fetch", request);
  vi.stubGlobal("refreshNuxtData", vi.fn().mockResolvedValue(undefined));
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  unmount();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function setup(generationId: string | null) {
  const chat = ref({
    id: "chat",
    title: "Conversation",
    generationId,
    messages: [
      {
        id: "question",
        role: "user" as const,
        content: "Question",
        status: "completed",
        replyToId: null,
        createdAt: "2026-11-04T00:00:00Z",
      },
      {
        id: "reply",
        role: "assistant" as const,
        content: "Partial",
        status: generationId ? "generating" : "completed",
        replyToId: "question",
        createdAt: "2026-11-04T00:00:01Z",
      },
    ],
  });
  const refresh = vi.fn().mockResolvedValue(undefined);
  const generation = useChatGeneration(chat, refresh);
  mount();
  return { chat, refresh, generation };
}

it("shows a saved snapshot without polling when another tab owns generation", async () => {
  const { chat, refresh, generation } = setup("remote-attempt");
  await vi.advanceTimersByTimeAsync(6000);
  expect(refresh).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
  expect(chat.value.messages[1]!.content).toBe("Partial");
  expect(generation.busy.value).toBe(true);
  expect(generation.waitingForResponse.value).toBe(false);
  // A manual reload can replace the saved state and enable sending again.
  chat.value.generationId = null;
  chat.value.messages[1]!.status = "completed";
  expect(generation.busy.value).toBe(false);
});

it("does not discover a generation started elsewhere after an idle tab has already opened", async () => {
  const { refresh, generation } = setup(null);
  await vi.advanceTimersByTimeAsync(6000);
  expect(refresh).not.toHaveBeenCalled();
  expect(generation.busy.value).toBe(false);
  expect(generation.waitingForResponse.value).toBe(false);
});

it("does not send or retry a response owned by another tab", async () => {
  const { chat, refresh, generation } = setup("remote-attempt");
  generation.draft.value = "Another question";
  await generation.send();
  await generation.generate();
  expect(request).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
  expect(refresh).not.toHaveBeenCalled();
  expect(chat.value.generationId).toBe("remote-attempt");
  expect(chat.value.messages).toHaveLength(2);
});
