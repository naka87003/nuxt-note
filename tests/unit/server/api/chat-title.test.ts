import { beforeEach, describe, expect, it, vi } from "vitest";
import createChat from "../../../../server/api/chats/index.post";
import summarizeTitle from "../../../../server/api/chats/[id]/title.post";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  body: vi.fn(),
  config: vi.fn(),
  generateText: vi.fn(),
  chat: { findFirst: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
  category: { findFirst: vi.fn() },
  message: {
    findFirst: vi.fn(),
  },
  $transaction: vi.fn(),
}));
vi.mock("../../../../server/utils/prisma", () => ({ getPrisma: () => mocks }));
vi.mock("nuxt/server", () => ({
  createError: (details: object) => Object.assign(new Error(), details),
}));
vi.mock("ai", () => ({
  generateText: mocks.generateText,
}));
vi.mock("@ai-sdk/openai", () => ({ createOpenAI: () => () => "model" }));
vi.hoisted(() => {
  vi.stubGlobal("defineEventHandler", (handler: unknown) => handler);
  vi.stubGlobal("requireUserSession", mocks.session);
  vi.stubGlobal("getRouterParam", () => "chat");
  vi.stubGlobal("readBody", mocks.body);
  vi.stubGlobal("useRuntimeConfig", mocks.config);
  vi.stubGlobal("setResponseStatus", vi.fn());
});
const owner = "11111111-1111-4111-8111-111111111111";
const questionId = "11111111-1111-4111-8111-111111111112";
const attemptId = "11111111-1111-4111-8111-111111111113";
const event = {} as Parameters<typeof summarizeTitle>[0];
const question = {
  id: questionId,
  role: "user",
  status: "completed",
  content: "hello",
  replyToId: null,
  createdAt: new Date(),
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ user: { id: owner } });
  mocks.config.mockReturnValue({
    openaiApiKey: "test-only",
    openaiModel: "test-model",
  });
  mocks.$transaction.mockImplementation((fn) => fn(mocks));
  mocks.chat.updateMany.mockResolvedValue({ count: 1 });
});
describe("Chat titles", () => {
  beforeEach(() => {
    mocks.chat.findFirst.mockResolvedValue({
      id: "chat",
      userId: owner,
      title: null,
    });
    mocks.message.findFirst
      .mockResolvedValueOnce(question)
      .mockResolvedValueOnce({ content: "Hello", status: "completed" });
    mocks.generateText.mockResolvedValue({
      text: "「挨拶のやり取り」",
      finishReason: "stop",
    });
  });

  it("summarizes the first completed exchange and saves a normalized title", async () => {
    expect(await summarizeTitle(event)).toEqual({ title: "挨拶のやり取り" });
    expect(mocks.message.findFirst).toHaveBeenNthCalledWith(2, {
      where: { chatId: "chat", replyToId: questionId, status: "completed" },
    });
    expect(mocks.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: JSON.stringify({ question: "hello", answer: "Hello" }),
        maxRetries: 0,
        abortSignal: expect.any(AbortSignal),
        providerOptions: { openai: { store: false } },
      }),
    );
    expect(mocks.chat.updateMany).toHaveBeenCalledWith({
      where: { id: "chat", userId: owner, title: null },
      data: { title: "挨拶のやり取り" },
    });
  });

  it("creates a chat without using the question as its title", async () => {
    mocks.body.mockResolvedValue({
      chatId: attemptId,
      messageId: questionId,
      content: "hello",
    });
    mocks.chat.findFirst.mockResolvedValue(null);
    await createChat(event);
    expect(mocks.chat.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: null }),
      }),
    );
  });

  it("still summarizes a legacy question-excerpt title", async () => {
    mocks.chat.findFirst.mockResolvedValue({ title: "hello" });
    expect(await summarizeTitle(event)).toEqual({ title: "挨拶のやり取り" });
    expect(mocks.chat.updateMany).toHaveBeenCalledWith({
      where: { id: "chat", userId: owner, title: "hello" },
      data: { title: "挨拶のやり取り" },
    });
  });

  it("keeps an already summarized or edited title without calling AI", async () => {
    mocks.chat.findFirst.mockResolvedValue({ title: "Existing summary" });
    expect(await summarizeTitle(event)).toEqual({ title: "Existing summary" });
    expect(mocks.generateText).not.toHaveBeenCalled();
  });

  it("does not summarize a failed, stopped, or missing first answer", async () => {
    mocks.message.findFirst
      .mockReset()
      .mockResolvedValueOnce(question)
      .mockResolvedValueOnce(null);
    expect(await summarizeTitle(event)).toEqual({ title: null });
    expect(mocks.generateText).not.toHaveBeenCalled();
  });

  it.each([
    { text: "", finishReason: "stop" },
    { text: "x".repeat(81), finishReason: "stop" },
    { text: "Partial title", finishReason: "length" },
  ])(
    "leaves the title unset for invalid or incomplete output",
    async (result) => {
      mocks.generateText.mockResolvedValue(result);
      expect(await summarizeTitle(event)).toEqual({ title: null });
      expect(mocks.chat.updateMany).not.toHaveBeenCalled();
    },
  );

  it("leaves the title unset when the provider fails or times out", async () => {
    mocks.generateText.mockRejectedValue(new Error("private provider detail"));
    expect(await summarizeTitle(event)).toEqual({ title: null });
    expect(mocks.chat.updateMany).not.toHaveBeenCalled();
  });

  it("does not return a stale title when another request changed it", async () => {
    mocks.chat.updateMany.mockResolvedValue({ count: 0 });
    expect(await summarizeTitle(event)).toEqual({ title: null });
  });
});
