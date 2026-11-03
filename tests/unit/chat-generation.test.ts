import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  body: vi.fn(),
  config: vi.fn(),
  streamText: vi.fn(),
  chat: { findFirst: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
  category: { findFirst: vi.fn() },
  message: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    upsert: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
  },
  $transaction: vi.fn(),
  push: vi.fn(),
  close: vi.fn(),
  send: vi.fn(),
  onClosed: vi.fn(),
}));
vi.mock("../../server/utils/prisma", () => ({ getPrisma: () => mocks }));
vi.mock("nuxt/server", () => ({
  createError: (details: object) => Object.assign(new Error(), details),
}));
vi.mock("ai", () => ({ streamText: mocks.streamText }));
vi.mock("@ai-sdk/openai", () => ({ createOpenAI: () => () => "model" }));
vi.stubGlobal("defineEventHandler", (handler: unknown) => handler);
vi.stubGlobal("requireUserSession", mocks.session);
vi.stubGlobal("getRouterParam", () => "chat");
vi.stubGlobal("readBody", mocks.body);
vi.stubGlobal("useRuntimeConfig", mocks.config);
vi.stubGlobal("setResponseHeader", vi.fn());
vi.stubGlobal("setResponseStatus", vi.fn());
vi.stubGlobal("createEventStream", () => mocks);
const { default: generate } =
  await import("../../server/api/chats/[id]/generate.post");
const { default: stop } = await import("../../server/api/chats/[id]/stop.post");
const { default: sendMessage } =
  await import("../../server/api/chats/[id]/messages.post");
const { default: createChat } =
  await import("../../server/api/chats/index.post");
const { saveGeneration, recoverGeneration } =
  await import("../../server/utils/chat-generation");
const owner = "11111111-1111-4111-8111-111111111111";
const questionId = "11111111-1111-4111-8111-111111111112";
const attemptId = "11111111-1111-4111-8111-111111111113";
const event = {
  node: { res: { once: vi.fn(), off: vi.fn() } },
} as unknown as Parameters<typeof generate>[0];
let complete: () => void;
const question = {
  id: questionId,
  role: "user",
  status: "completed",
  content: "hello",
  replyToId: null,
  createdAt: new Date(),
};
async function run() {
  await generate(event);
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ user: { id: owner } });
  mocks.config.mockReturnValue({
    openaiApiKey: "test-only",
    openaiModel: "test-model",
  });
  mocks.body.mockResolvedValue({ messageId: questionId, attemptId });
  mocks.$transaction.mockImplementation((fn) => fn(mocks));
  mocks.chat.findFirst.mockResolvedValue({ id: "chat", userId: owner });
  mocks.chat.updateMany.mockImplementation(({ where }) =>
    Promise.resolve({ count: where.generationStartedAt ? 0 : 1 }),
  );
  mocks.message.findMany.mockResolvedValue([question]);
  mocks.message.upsert.mockResolvedValue({ id: "reply" });
  mocks.message.updateMany.mockResolvedValue({ count: 1 });
  mocks.push.mockResolvedValue(undefined);
  mocks.send.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        complete = resolve;
      }),
  );
  mocks.close.mockImplementation(async () => {
    complete();
  });
  mocks.streamText.mockReturnValue({
    fullStream: (async function* () {
      yield { type: "text-delta", text: "Hello" };
      yield { type: "finish", finishReason: "stop" };
    })(),
  });
});
describe("Chat generation", () => {
  it.each([generate, stop, sendMessage, createChat])(
    "requires authentication before touching chat data",
    async (handler) => {
      mocks.session.mockRejectedValue({ statusCode: 401 });
      await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 });
      expect(mocks.chat.findFirst).not.toHaveBeenCalled();
      expect(mocks.body).not.toHaveBeenCalled();
    },
  );
  it.each([generate, stop, sendMessage])(
    "hides foreign conversations before parsing input or calling AI",
    async (handler) => {
      mocks.chat.findFirst.mockResolvedValue(null);
      await expect(handler(event)).rejects.toMatchObject({ statusCode: 404 });
      expect(mocks.chat.findFirst).toHaveBeenCalledWith({
        where: { id: "chat", userId: owner },
      });
      expect(mocks.streamText).not.toHaveBeenCalled();
      expect(mocks.body).not.toHaveBeenCalled();
    },
  );
  it("rejects missing server credentials without starting a generation", async () => {
    mocks.config.mockReturnValue({ openaiApiKey: "" });
    await expect(generate(event)).rejects.toMatchObject({ statusCode: 503 });
    expect(mocks.message.upsert).not.toHaveBeenCalled();
  });
  it("rejects a concurrent attempt before calling AI", async () => {
    mocks.chat.updateMany.mockResolvedValue({ count: 0 });
    await expect(generate(event)).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.streamText).not.toHaveBeenCalled();
  });
  it("checkpoints text before delivering it and commits completion before done", async () => {
    await run();
    expect(mocks.message.updateMany).toHaveBeenCalledWith({
      where: { id: "reply", chatId: "chat" },
      data: { content: "Hello", status: "completed" },
    });
    expect(
      mocks.push.mock.calls.map(([data]) => JSON.parse(data).type),
    ).toEqual(["start", "text", "done"]);
    expect(mocks.message.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.push.mock.invocationCallOrder[1]!,
    );
    expect(
      mocks.message.updateMany.mock.invocationCallOrder.at(-1),
    ).toBeLessThan(mocks.push.mock.invocationCallOrder.at(-1)!);
    expect(mocks.streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        maxRetries: 0,
        providerOptions: { openai: { store: false } },
      }),
    );
  });
  it("preserves partial text when the provider fails", async () => {
    mocks.streamText.mockReturnValue({
      fullStream: (async function* () {
        yield { type: "text-delta", text: "Partial" };
        yield { type: "error", error: new Error("private provider detail") };
      })(),
    });
    await run();
    expect(mocks.message.updateMany).toHaveBeenLastCalledWith({
      where: { id: "reply", chatId: "chat" },
      data: { content: "Partial", status: "failed" },
    });
    expect(JSON.stringify(mocks.push.mock.calls)).not.toContain(
      "private provider detail",
    );
  });
  it("marks a timed-out stream failed and releases the guard", async () => {
    vi.useFakeTimers();
    try {
      mocks.streamText.mockImplementation(({ abortSignal }) => ({
        fullStream: (async function* () {
          yield { type: "text-delta", text: "Partial" };
          await new Promise((_, reject) =>
            abortSignal.addEventListener(
              "abort",
              () => reject(new Error("timeout")),
              { once: true },
            ),
          );
        })(),
      }));
      const running = run();
      await vi.advanceTimersByTimeAsync(120_000);
      await running;
      expect(mocks.message.updateMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: { content: "Partial", status: "failed" },
        }),
      );
      expect(mocks.chat.updateMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: { generationId: null, generationStartedAt: null },
        }),
      );
    } finally {
      vi.useRealTimers();
    }
  });
  it("marks length-limited responses as incomplete", async () => {
    mocks.streamText.mockReturnValue({
      fullStream: (async function* () {
        yield { type: "text-delta", text: "Partial" };
        yield { type: "finish", finishReason: "length" };
      })(),
    });
    await run();
    expect(mocks.message.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: { content: "Partial", status: "failed" },
      }),
    );
  });
  it("forwards disconnection to the provider and saves a stopped response", async () => {
    mocks.streamText.mockImplementation(({ abortSignal }) => ({
      fullStream: (async function* () {
        yield { type: "text-delta", text: "Partial" };
        mocks.onClosed.mock.calls[0]![0]();
        expect(abortSignal.aborted).toBe(true);
        throw new Error("aborted");
      })(),
    }));
    await run();
    expect(mocks.message.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: { content: "Partial", status: "stopped" },
      }),
    );
  });
  it("retries in the same answer slot and excludes the prior partial answer", async () => {
    mocks.message.findMany.mockResolvedValue([
      question,
      {
        id: "reply",
        role: "assistant",
        content: "old partial",
        status: "failed",
        replyToId: questionId,
      },
    ]);
    await run();
    expect(mocks.message.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { replyToId: questionId },
        update: { content: "", status: "generating" },
      }),
    );
    expect(mocks.message.create).not.toHaveBeenCalled();
    expect(mocks.streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: "user", content: "hello" }],
      }),
    );
  });
  it("rejects retrying a completed response", async () => {
    mocks.message.findMany.mockResolvedValue([
      question,
      { id: "reply", status: "completed", replyToId: questionId },
    ]);
    await expect(generate(event)).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.streamText).not.toHaveBeenCalled();
  });
  it("does not allow an old worker to overwrite a later attempt", async () => {
    mocks.chat.updateMany.mockResolvedValue({ count: 0 });
    expect(
      await saveGeneration(
        owner,
        "chat",
        attemptId,
        "reply",
        "stale",
        "completed",
      ),
    ).toBe(false);
    expect(mocks.message.updateMany).not.toHaveBeenCalled();
    expect(mocks.chat.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "chat", userId: owner, generationId: attemptId },
      }),
    );
  });
  it("stop only releases the specified owner's attempt", async () => {
    await stop(event);
    expect(mocks.chat.updateMany).toHaveBeenCalledWith({
      where: { id: "chat", userId: owner, generationId: attemptId },
      data: { generationId: null, generationStartedAt: null },
    });
    expect(mocks.message.updateMany).toHaveBeenCalledWith({
      where: { chatId: "chat", status: "generating" },
      data: { status: "stopped" },
    });
  });
  it("recovers expired workers without modifying a live attempt", async () => {
    await recoverGeneration(owner, "chat");
    expect(mocks.message.updateMany).not.toHaveBeenCalled();
    mocks.chat.updateMany.mockResolvedValue({ count: 1 });
    await recoverGeneration(owner, "chat");
    expect(mocks.message.updateMany).toHaveBeenCalledWith({
      where: { chatId: "chat", status: "generating" },
      data: { status: "failed" },
    });
  });
  it("does not duplicate a user message after a lost acknowledgement", async () => {
    mocks.body.mockResolvedValue({ messageId: questionId, content: "hello" });
    mocks.message.findFirst.mockResolvedValue(question);
    await sendMessage(event);
    expect(mocks.message.create).not.toHaveBeenCalled();
  });
  it("reuses a created conversation after a lost acknowledgement", async () => {
    mocks.body.mockResolvedValue({
      chatId: attemptId,
      messageId: questionId,
      content: "hello",
    });
    mocks.chat.findFirst.mockResolvedValue({
      id: attemptId,
      messages: [question],
    });
    expect(await createChat(event)).toEqual({
      id: attemptId,
      messageId: questionId,
    });
    expect(mocks.chat.create).not.toHaveBeenCalled();
  });
  it("rejects another owner's category when creating a conversation", async () => {
    mocks.body.mockResolvedValue({
      chatId: attemptId,
      messageId: questionId,
      content: "hello",
      categoryId: "foreign",
    });
    mocks.chat.findFirst.mockResolvedValue(null);
    mocks.category.findFirst.mockResolvedValue(null);
    await expect(createChat(event)).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.chat.create).not.toHaveBeenCalled();
  });
});
