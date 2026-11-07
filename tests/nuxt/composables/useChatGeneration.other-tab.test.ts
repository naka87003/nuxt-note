import { mockNuxtImport } from "@nuxt/test-utils/runtime";
import { mountComposable } from "../helpers/mount-composable";
import { ref } from "vue";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useChatGeneration } from "~/composables/useChatGeneration";

const refreshNuxtData = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
mockNuxtImport("refreshNuxtData", () => refreshNuxtData);

const request = vi.hoisted(() => vi.fn().mockResolvedValue(null));
mockNuxtImport("$fetch", () => request);

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  refreshNuxtData.mockResolvedValue(undefined);
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.useRealTimers();
});

async function setup(generationId: string | null) {
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
  const { result: generation } = await mountComposable(() =>
    useChatGeneration(chat, refresh),
  );
  return { chat, refresh, generation };
}

it.each([
  {
    state: "generating in another tab",
    generationId: "remote-attempt",
    busy: true,
  },
  { state: "idle", generationId: null, busy: false },
])(
  "keeps the $state snapshot without polling",
  async ({ generationId, busy }) => {
    const { chat, refresh, generation } = await setup(generationId);
    await vi.advanceTimersByTimeAsync(6000);
    expect(refresh).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    expect(chat.value.messages[1]!.content).toBe("Partial");
    expect(generation.busy.value).toBe(busy);
    expect(generation.waitingForResponse.value).toBe(false);
    // A manual reload can replace the saved state and enable sending again.
    chat.value.generationId = null;
    chat.value.messages[1]!.status = "completed";
    expect(generation.busy.value).toBe(false);
  },
);

it("does not send or retry a response owned by another tab", async () => {
  const { chat, refresh, generation } = await setup("remote-attempt");
  generation.draft.value = "Another question";
  await generation.send();
  await generation.generate();
  expect(request).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
  expect(refresh).not.toHaveBeenCalled();
  expect(chat.value.generationId).toBe("remote-attempt");
  expect(chat.value.messages).toHaveLength(2);
});
