import { computed, ref } from "vue";
import { beforeEach, expect, it, vi } from "vitest";
import { useChatGeneration } from "../../app/composables/useChatGeneration";

const titleRequest = vi.fn();
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("ref", ref);
  vi.stubGlobal("computed", computed);
  vi.stubGlobal("onMounted", vi.fn());
  vi.stubGlobal("onBeforeUnmount", vi.fn());
  vi.stubGlobal("$fetch", titleRequest);
  vi.stubGlobal("refreshNuxtData", vi.fn().mockResolvedValue(undefined));
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        [
          { type: "start", messageId: "reply" },
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
  return ref({
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
    ],
  });
}

it("allows the next message while a title is pending and updates the refreshed chat", async () => {
  const chat = conversation();
  let resolveTitle!: (value: { title: string }) => void;
  titleRequest.mockReturnValue(
    new Promise((resolve) => {
      resolveTitle = resolve;
    }),
  );
  const refresh = vi.fn().mockResolvedValue(undefined);
  const generation = useChatGeneration(chat, refresh);
  await generation.generate();
  expect(titleRequest).toHaveBeenCalledWith("/api/chats/chat/title", {
    method: "POST",
  });
  expect(generation.busy.value).toBe(false);
  expect(chat.value.title).toBeNull();
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
  const generation = useChatGeneration(
    chat,
    vi.fn().mockResolvedValue(undefined),
  );
  await generation.generate();
  expect(chat.value.title).toBeNull();
  expect(generation.failure.value).toBe("");
  expect(generation.busy.value).toBe(false);
});

it("does not regenerate the title after subsequent questions", async () => {
  const chat = conversation();
  chat.value.messages.push({
    ...chat.value.messages[0]!,
    id: "second-question",
  });
  const generation = useChatGeneration(
    chat,
    vi.fn().mockResolvedValue(undefined),
  );
  await generation.generate();
  expect(titleRequest).not.toHaveBeenCalled();
});
