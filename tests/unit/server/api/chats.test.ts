import { beforeEach, describe, expect, it, vi } from "vitest";
import chats from "../../../../server/api/chats/index.get";
import readChat from "../../../../server/api/chats/[id].get";
import assignChat from "../../../../server/api/chats/[id].patch";
import removeChat from "../../../../server/api/chats/[id].delete";

const mocks = vi.hoisted(() => {
  const model = () => ({
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  });
  return {
    $transaction: vi.fn(),
    message: model(),
    category: model(),
    note: model(),
    chat: model(),
    session: vi.fn(),
    body: vi.fn(),
    param: vi.fn(),
    query: vi.fn(),
    status: vi.fn(),
  };
});
vi.mock("../../../../server/utils/prisma", () => ({ getPrisma: () => mocks }));
vi.mock("nuxt/server", () => ({
  createError: (details: object) => Object.assign(new Error(), details),
}));
vi.hoisted(() => {
  vi.stubGlobal("defineEventHandler", (handler: unknown) => handler);
  vi.stubGlobal("requireUserSession", mocks.session);
  vi.stubGlobal("readBody", mocks.body);
  vi.stubGlobal("getRouterParam", mocks.param);
  vi.stubGlobal("getQuery", mocks.query);
  vi.stubGlobal("setResponseStatus", mocks.status);
});
const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const event = {} as Parameters<typeof chats>[0];
beforeEach(() => {
  vi.resetAllMocks();
  mocks.$transaction.mockImplementation((fn) => fn(mocks));
  mocks.session.mockResolvedValue({ user: { id: owner } });
  mocks.body.mockResolvedValue({});
  mocks.query.mockReturnValue({});
  mocks.chat.findMany.mockResolvedValue([]);
  mocks.param.mockReturnValue("item");
  mocks.chat.updateMany.mockResolvedValue({ count: 1 });
  mocks.chat.deleteMany.mockResolvedValue({ count: 1 });
});
const handlers = [chats, readChat, assignChat, removeChat];
describe("Chat API authentication", () => {
  it.each(handlers)(
    "rejects unauthenticated requests before data access",
    async (handler) => {
      mocks.session.mockRejectedValue(
        Object.assign(new Error(), { statusCode: 401 }),
      );
      await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 });
      for (const model of [mocks.category, mocks.note, mocks.chat])
        for (const method of Object.values(model))
          expect(method).not.toHaveBeenCalled();
      expect(mocks.body).not.toHaveBeenCalled();
    },
  );
});
describe("chat ownership and category assignment", () => {
  it.each([
    null,
    [],
    {},
    { categoryId: "" },
    { categoryId: 42 },
    { categoryId: [] },
  ])(
    "rejects invalid category changes before looking up a category: %j",
    async (body) => {
      mocks.chat.findFirst.mockResolvedValue({ id: "item" });
      mocks.body.mockResolvedValue(body);
      await expect(assignChat(event)).rejects.toMatchObject({
        statusCode: 400,
        statusMessage: "Invalid category",
      });
      expect(mocks.category.findFirst).not.toHaveBeenCalled();
      expect(mocks.chat.updateMany).not.toHaveBeenCalled();
    },
  );
  it("returns a preview from the first user message without exposing messages", async () => {
    mocks.chat.findMany.mockResolvedValue([
      {
        id: "chat",
        title: "Question",
        messages: [{ content: "How does **Nuxt** work?" }],
      },
      { id: "empty", title: null, messages: [] },
    ]);
    await expect(chats(event)).resolves.toEqual([
      { id: "chat", title: "Question", preview: "How does Nuxt work?" },
      { id: "empty", title: null, preview: "" },
    ]);
    expect(mocks.chat.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          messages: {
            where: { role: "user" },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            take: 1,
            select: { content: true },
          },
        }),
      }),
    );
  });
  it("does not return another owner's chat or messages", async () => {
    mocks.chat.findFirst.mockImplementation(({ where }) =>
      where.userId === other
        ? { id: "item", messages: [{ content: "secret" }] }
        : null,
    );
    await expect(readChat(event)).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.chat.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "item", userId: owner } }),
    );
  });
  it("validates chat ownership before checking a category", async () => {
    mocks.chat.findFirst.mockResolvedValue(null);
    await expect(assignChat(event)).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.category.findFirst).not.toHaveBeenCalled();
    expect(mocks.chat.updateMany).not.toHaveBeenCalled();
  });
  it("rejects reassignment to another owner's category", async () => {
    mocks.chat.findFirst.mockResolvedValue({ id: "item" });
    mocks.body.mockResolvedValue({ categoryId: "foreign" });
    mocks.category.findFirst.mockResolvedValue(null);
    await expect(assignChat(event)).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.category.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "foreign", userId: owner } }),
    );
    expect(mocks.chat.updateMany).not.toHaveBeenCalled();
  });
  it.each([null, "owned"])(
    "changes only categoryId to %j",
    async (categoryId) => {
      mocks.chat.findFirst.mockResolvedValue({ id: "item" });
      mocks.category.findFirst.mockResolvedValue({ id: "owned" });
      mocks.body.mockResolvedValue({
        categoryId,
        userId: other,
        title: "ignored",
        messages: [],
      });
      await assignChat(event);
      expect(mocks.chat.updateMany).toHaveBeenCalledWith({
        where: { id: "item", userId: owner },
        data: { categoryId },
      });
    },
  );
  it("hides foreign chats on deletion", async () => {
    mocks.chat.deleteMany.mockResolvedValue({ count: 0 });
    await expect(removeChat(event)).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.chat.deleteMany).toHaveBeenCalledWith({
      where: { id: "item", userId: owner },
    });
  });
  it("lists only the owner's filtered conversation history", async () => {
    mocks.query.mockReturnValue({ category: "owned", q: "50%_" });
    await chats(event);
    expect(mocks.chat.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: owner,
          categoryId: "owned",
          OR: [
            { title: { contains: "50\\%\\_", mode: "insensitive" } },
            {
              messages: {
                some: {
                  content: { contains: "50\\%\\_", mode: "insensitive" },
                },
              },
            },
          ],
        },
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      }),
    );
  });
});
