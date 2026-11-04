import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generate: vi.fn(),
  findFirst: vi.fn(),
  recover: vi.fn(),
  session: vi.fn(),
  config: vi.fn(),
}));
vi.mock("@ai-sdk/openai", () => ({ createOpenAI: () => () => "test-model" }));
vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("ai")>()),
  generateText: mocks.generate,
}));
vi.mock("nuxt/server", () => ({
  createError: (details: object) => Object.assign(new Error(), details),
}));
vi.mock("../../server/utils/prisma", () => ({
  getPrisma: () => ({ chat: { findFirst: mocks.findFirst } }),
}));
vi.mock("../../server/utils/chat-generation", () => ({
  recoverGeneration: mocks.recover,
  messageOrder: [{ createdAt: "asc" }, { id: "asc" }],
}));
vi.stubGlobal("defineEventHandler", (handler: unknown) => handler);
vi.stubGlobal("requireUserSession", mocks.session);
vi.stubGlobal("getRouterParam", () => "chat");
vi.stubGlobal("useRuntimeConfig", mocks.config);

const { createChatNoteDraft } = await import("../../server/utils/chat-note");
const { default: handler } =
  await import("../../server/api/chats/[id]/note-draft.post");
const config = { openaiApiKey: "test", openaiModel: "test" };
const owner = "11111111-1111-4111-8111-111111111111";
const history = [
  { role: "user", content: "Question" },
  { role: "assistant", content: "Answer" },
];
const goodDraft = { title: "Title", markdown: "# Summary\n\nUseful content." };
const response = (draft: unknown, finishReason = "stop") => ({
  output: draft,
  finishReason,
});
const event = () =>
  ({ node: { res: new EventEmitter() } }) as Parameters<typeof handler>[0];

beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ user: { id: owner } });
  mocks.config.mockReturnValue(config);
  mocks.findFirst.mockResolvedValue({
    categoryId: "category",
    generationId: null,
    messages: history.map((m) => ({ ...m, status: "completed" })),
  });
  mocks.generate.mockResolvedValue(response(goodDraft));
});

describe("AI Note draft output", () => {
  it("returns complete Markdown and disables provider retries and storage", async () => {
    const signal = new AbortController().signal;
    await expect(createChatNoteDraft(history, config, signal)).resolves.toEqual(
      goodDraft,
    );
    expect(mocks.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        abortSignal: signal,
        maxRetries: 0,
        providerOptions: { openai: { store: false } },
        prompt: JSON.stringify({ conversation: history }),
        output: expect.objectContaining({ name: "json" }),
      }),
    );
  });
  it("shortens oversized content once instead of cutting Markdown", async () => {
    const long = { title: "Long", markdown: "# " + "あ".repeat(3000) };
    mocks.generate
      .mockResolvedValueOnce(response(long))
      .mockResolvedValueOnce(response(goodDraft));
    await expect(
      createChatNoteDraft(history, config, new AbortController().signal),
    ).resolves.toEqual(goodDraft);
    expect(mocks.generate).toHaveBeenCalledTimes(2);
    expect(JSON.parse(mocks.generate.mock.calls[1]![0].prompt)).toMatchObject({
      draft: long,
    });
    expect(mocks.generate.mock.calls[1]![0].instructions).toContain(
      "Shorten the supplied note draft",
    );
  });
  it("counts Unicode characters, including Markdown and newlines, within 3000", async () => {
    const draft = {
      title: "Title",
      markdown: "#\n" + "😀".repeat(1499) + "あ".repeat(1499),
    };
    mocks.generate.mockResolvedValue(response(draft));
    await expect(
      createChatNoteDraft(history, config, new AbortController().signal),
    ).resolves.toEqual(draft);
    expect(mocks.generate).toHaveBeenCalledTimes(1);
  });
  it.each([
    { title: "x".repeat(51), markdown: "Body" },
    { title: "Title", markdown: "x".repeat(3001) },
    { title: "Title", markdown: "😀".repeat(2501) },
  ])(
    "rejects output still exceeding limits after shortening",
    async (draft) => {
      mocks.generate.mockResolvedValue(response(draft));
      await expect(
        createChatNoteDraft(history, config, new AbortController().signal),
      ).rejects.toThrow();
      expect(mocks.generate).toHaveBeenCalledTimes(2);
    },
  );
  it.each([
    response(goodDraft, "length"),
    response(goodDraft, "error"),
    response({ title: "", markdown: "Body" }),
    response({ title: "Title", markdown: " " }),
    response([]),
    response(null),
  ])("does not return incomplete or invalid drafts", async (result) => {
    mocks.generate.mockResolvedValue(result);
    await expect(
      createChatNoteDraft(history, config, new AbortController().signal),
    ).rejects.toThrow();
  });
});

describe("Chat Note draft API", () => {
  it("requires authentication before accessing conversation data", async () => {
    mocks.session.mockRejectedValue(
      Object.assign(new Error(), { statusCode: 401 }),
    );
    await expect(handler(event())).rejects.toMatchObject({ statusCode: 401 });
    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.recover).not.toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("uses only owner-scoped server history and returns an unsaved draft with category", async () => {
    const e = event();
    await expect(handler(e)).resolves.toEqual({
      ...goodDraft,
      categoryId: "category",
    });
    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "chat", userId: owner } }),
    );
    expect(e.node.res.listenerCount("close")).toBe(0);
  });
  it("hides foreign and missing chats", async () => {
    mocks.findFirst.mockResolvedValue(null);
    await expect(handler(event())).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("excludes failed, stopped and generating assistant messages", async () => {
    mocks.findFirst.mockResolvedValue({
      categoryId: null,
      generationId: null,
      messages: [
        ...history.map((m) => ({ ...m, status: "completed" })),
        ...["failed", "stopped", "generating"].map((status) => ({
          role: "assistant",
          content: "private partial " + status,
          status,
        })),
      ],
    });
    await handler(event());
    expect(JSON.parse(mocks.generate.mock.calls[0]![0].prompt)).toEqual({
      conversation: history,
    });
  });
  it.each([
    [{ categoryId: null, generationId: "active", messages: [] }, 409],
    [{ categoryId: null, generationId: null, messages: [] }, 400],
    [
      {
        categoryId: null,
        generationId: null,
        messages: [
          { role: "user", status: "completed", content: "x".repeat(100_000) },
          { role: "assistant", status: "completed", content: "answer" },
        ],
      },
      413,
    ],
  ])(
    "rejects unavailable or oversized conversations before AI processing",
    async (chat, code) => {
      mocks.findFirst.mockResolvedValue(chat);
      await expect(handler(event())).rejects.toMatchObject({
        statusCode: code,
      });
      expect(mocks.generate).not.toHaveBeenCalled();
    },
  );
  it("reports missing AI configuration", async () => {
    mocks.config.mockReturnValue({ ...config, openaiApiKey: "" });
    await expect(handler(event())).rejects.toMatchObject({ statusCode: 503 });
  });
  it("sanitizes provider failures", async () => {
    mocks.generate.mockRejectedValue(new Error("secret provider detail"));
    await expect(handler(event())).rejects.toMatchObject({
      statusCode: 502,
      statusMessage: "Could not create the note draft. Please try again.",
    });
  });
  it("times out all generation attempts within a single budget and cleans up", async () => {
    vi.useFakeTimers();
    try {
      mocks.generate.mockImplementation(
        ({ abortSignal }) =>
          new Promise((_, reject) =>
            abortSignal.addEventListener(
              "abort",
              () => reject(new Error("aborted")),
              { once: true },
            ),
          ),
      );
      const e = event();
      const check = expect(handler(e)).rejects.toMatchObject({
        statusCode: 504,
      });
      await vi.advanceTimersByTimeAsync(120_000);
      await check;
      expect(e.node.res.listenerCount("close")).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
  it("aborts abandoned requests without returning a background draft", async () => {
    const e = event();
    mocks.generate.mockImplementation(async ({ abortSignal }) => {
      e.node.res.emit("close");
      expect(abortSignal.aborted).toBe(true);
      return response(goodDraft);
    });
    await expect(handler(e)).rejects.toMatchObject({ statusCode: 504 });
  });
  it("does not reset the timeout budget for the shortening request", async () => {
    vi.useFakeTimers();
    try {
      mocks.generate
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              setTimeout(
                () =>
                  resolve(
                    response({ title: "Title", markdown: "x".repeat(3001) }),
                  ),
                90_000,
              );
            }),
        )
        .mockImplementationOnce(
          ({ abortSignal }) =>
            new Promise((_, reject) => {
              abortSignal.addEventListener(
                "abort",
                () => reject(new Error("aborted")),
                { once: true },
              );
            }),
        );
      const check = expect(handler(event())).rejects.toMatchObject({
        statusCode: 504,
      });
      await vi.advanceTimersByTimeAsync(90_000);
      expect(mocks.generate).toHaveBeenCalledTimes(2);
      expect(mocks.generate.mock.calls[1]![0].abortSignal.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(30_000);
      await check;
      expect(mocks.generate.mock.calls[1]![0].abortSignal.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
