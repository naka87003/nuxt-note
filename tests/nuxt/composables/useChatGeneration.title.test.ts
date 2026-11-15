import { mockNuxtImport } from "@nuxt/test-utils/runtime";
import { mountComposable } from "../helpers/mount-composable";
import { ref } from "vue";
import { beforeEach, expect, it, vi } from "vitest";
import { useChatGeneration } from "~/composables/useChatGeneration";
import type { Conversation } from "#shared/types/chat";

const refreshNuxtData = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
mockNuxtImport("refreshNuxtData", () => refreshNuxtData);

const titleRequest = vi.hoisted(() => vi.fn().mockResolvedValue(null));
mockNuxtImport("$fetch", () => titleRequest);
beforeEach(() => {
  vi.resetAllMocks();
  refreshNuxtData.mockResolvedValue(undefined);
  let replies = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(
      () =>
        new Response(
          [
            {
              type: "start",
              messageId: ++replies === 1 ? "reply" : `reply-${replies}`,
            },
            { type: "text", text: "Answer" },
            { type: "done", status: "completed" },
          ]
            .map((data) => `data: ${JSON.stringify(data)}\n\n`)
            .join(""),
        ),
    ),
  );
});

function conversation() {
  return ref<Conversation>({
    id: "chat",
    title: null as string | null,
    generationId: null,
    messages: [
      {
        id: "question",
        role: "user" as const,
        content: "Question",
        status: "completed",
        replyToId: null,
        createdAt: new Date().toISOString(),
      },
      {
        id: "reply",
        role: "assistant",
        content: "",
        status: "failed",
        replyToId: "question",
        createdAt: new Date().toISOString(),
      },
    ],
  });
}

it.each([undefined, "Saved title"])(
  "reflects an optional saved title from done without reloading the conversation: %s",
  async (title) => {
    const chat = conversation();
    chat.value.title = "Old title";
    chat.value.messages.push(
      { ...chat.value.messages[0]!, id: "second-question" },
      {
        ...chat.value.messages[1]!,
        id: "second-reply",
        replyToId: "second-question",
      },
    );
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        [
          { type: "start", messageId: "second-reply" },
          { type: "text", text: "Answer" },
          { type: "done", status: "completed", title },
        ]
          .map((data) => `data: ${JSON.stringify(data)}\n\n`)
          .join(""),
      ),
    );
    const refresh = vi.fn().mockResolvedValue(undefined);
    const { result: generation } = await mountComposable(() =>
      useChatGeneration(chat, refresh),
    );
    await generation.generate();
    expect(chat.value.title).toBe(title ?? "Old title");
    expect(chat.value.messages.at(-1)?.content).toBe("Answer");
    expect(chat.value.messages.at(-1)?.status).toBe("completed");
    expect(refresh).not.toHaveBeenCalled();
    expect(titleRequest).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledOnce();
  },
);

it.each([undefined, null, "target"])(
  "applies a changed Category from done without reloading messages: %s",
  async (categoryId) => {
    const chat = conversation();
    chat.value.title = "Keep title";
    chat.value.categoryId = "source";
    chat.value.messages.push(
      { ...chat.value.messages[0]!, id: "second-question" },
      {
        ...chat.value.messages[1]!,
        id: "second-reply",
        replyToId: "second-question",
      },
    );
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        [
          { type: "start", messageId: "second-reply" },
          { type: "text", text: "Answer" },
          { type: "done", status: "completed", categoryId },
        ]
          .map((data) => `data: ${JSON.stringify(data)}\n\n`)
          .join(""),
      ),
    );
    const refresh = vi.fn().mockResolvedValue(undefined);
    const { result: generation } = await mountComposable(() =>
      useChatGeneration(chat, refresh),
    );
    await generation.generate();
    expect(chat.value.categoryId).toBe(
      categoryId === undefined ? "source" : categoryId,
    );
    expect(chat.value.title).toBe("Keep title");
    expect(chat.value.messages.at(-1)?.content).toBe("Answer");
    expect(chat.value.messages.at(-1)?.status).toBe("completed");
    expect(refresh).not.toHaveBeenCalled();
    expect(titleRequest).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledOnce();
  },
);

it("allows the next message while a title is pending and updates the refreshed chat", async () => {
  const chat = conversation();
  let resolveTitle!: (value: { title: string }) => void;
  const pendingTitle = new Promise<{ title: string }>((resolve) => {
    resolveTitle = resolve;
  });
  titleRequest.mockImplementation((url: string) =>
    url.endsWith("/title") ? pendingTitle : Promise.resolve({}),
  );
  const refresh = vi.fn().mockResolvedValue(undefined);
  const { result: generation } = await mountComposable(() =>
    useChatGeneration(chat, refresh),
  );
  await generation.generate();
  expect(titleRequest).toHaveBeenCalledWith("/api/chats/chat/title", {
    method: "POST",
  });
  expect(generation.busy.value).toBe(false);
  expect(chat.value.title).toBeNull();
  generation.draft.value = "Follow-up while the title is pending";
  await generation.send();
  expect(chat.value.messages.at(-2)?.content).toBe(
    "Follow-up while the title is pending",
  );
  expect(chat.value.messages.at(-1)?.status).toBe("completed");
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(generation.busy.value).toBe(false);
  // A separate refresh can replace the conversation while title generation runs.
  chat.value = {
    ...chat.value,
    messages: chat.value.messages.map((message) => ({ ...message })),
  };
  resolveTitle({ title: "Summary" });
  await vi.waitFor(() => expect(chat.value.title).toBe("Summary"));
});

it("keeps title failures separate from answer failures", async () => {
  titleRequest.mockRejectedValue(new Error("Title unavailable"));
  const chat = conversation();
  const { result: generation } = await mountComposable(() =>
    useChatGeneration(chat, vi.fn().mockResolvedValue(undefined)),
  );
  await generation.generate();
  expect(chat.value.title).toBeNull();
  expect(generation.failure.value).toBe("");
  expect(generation.busy.value).toBe(false);
});

it("does not regenerate the title after subsequent questions", async () => {
  const chat = conversation();
  chat.value.messages.push(
    { ...chat.value.messages[0]!, id: "second-question" },
    {
      ...chat.value.messages[1]!,
      id: "second-reply",
      replyToId: "second-question",
    },
  );
  const { result: generation } = await mountComposable(() =>
    useChatGeneration(chat, vi.fn().mockResolvedValue(undefined)),
  );
  await generation.generate();
  expect(titleRequest).not.toHaveBeenCalled();
});
