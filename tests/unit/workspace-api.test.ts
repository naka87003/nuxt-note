import { beforeEach, describe, expect, it, vi } from "vitest";
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
vi.mock("../../server/utils/prisma", () => ({ getPrisma: () => mocks }));
vi.mock("nuxt/server", () => ({
  createError: (details: object) => Object.assign(new Error(), details),
}));
vi.stubGlobal("defineEventHandler", (handler: unknown) => handler);
vi.stubGlobal("requireUserSession", mocks.session);
vi.stubGlobal("readBody", mocks.body);
vi.stubGlobal("getRouterParam", mocks.param);
vi.stubGlobal("getQuery", mocks.query);
vi.stubGlobal("setResponseStatus", mocks.status);
const { default: create } =
  await import("../../server/api/categories/index.post");
const { default: list } = await import("../../server/api/categories/index.get");
const { default: rename } =
  await import("../../server/api/categories/[id].patch");
const { default: remove } =
  await import("../../server/api/categories/[id].delete");
const { default: chats } = await import("../../server/api/chats/index.get");
const { default: readChat } = await import("../../server/api/chats/[id].get");
const { default: assignChat } =
  await import("../../server/api/chats/[id].patch");
const { default: removeChat } =
  await import("../../server/api/chats/[id].delete");
const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const event = {} as Parameters<typeof create>[0];
beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ user: { id: owner } });
  mocks.body.mockResolvedValue({ name: "  Ｎｕｘｔ  ", userId: other });
  mocks.query.mockReturnValue({});
  mocks.param.mockReturnValue("item");
  mocks.category.create.mockResolvedValue({ id: "category", name: "Ｎｕｘｔ" });
  mocks.category.updateMany.mockResolvedValue({ count: 1 });
  mocks.category.deleteMany.mockResolvedValue({ count: 1 });
  mocks.chat.updateMany.mockResolvedValue({ count: 1 });
  mocks.chat.deleteMany.mockResolvedValue({ count: 1 });
});
const handlers = [
  create,
  list,
  rename,
  remove,
  chats,
  readChat,
  assignChat,
  removeChat,
];
describe("workspace authentication", () => {
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
describe("shared categories", () => {
  it("trims the display name and normalizes the uniqueness key for the session owner", async () => {
    await create(event);
    expect(mocks.category.create).toHaveBeenCalledWith({
      data: { name: "Ｎｕｘｔ", nameKey: "nuxt", userId: owner },
      select: { id: true, name: true },
    });
    expect(mocks.status).toHaveBeenCalledWith(event, 201);
  });
  it.each([
    null,
    [],
    {},
    { name: "  " },
    { name: "a".repeat(101) },
    { name: 4 },
  ])("rejects malformed category names %j", async (body) => {
    mocks.body.mockResolvedValue(body);
    await expect(create(event)).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.category.create).not.toHaveBeenCalled();
  });
  it.each([create, rename])(
    "returns a recoverable conflict for duplicate names",
    async (handler) => {
      mocks.category.create.mockRejectedValue({ code: "P2002" });
      mocks.category.updateMany.mockRejectedValue({ code: "P2002" });
      await expect(handler(event)).rejects.toMatchObject({ statusCode: 409 });
    },
  );
  it("uses the shared order and counts both workspaces only for the owner", async () => {
    mocks.category.findMany.mockResolvedValue([
      { id: "empty", name: "Empty", _count: { notes: 0, chats: 0 } },
    ]);
    mocks.note.count.mockResolvedValueOnce(7).mockResolvedValueOnce(2);
    mocks.chat.count.mockResolvedValueOnce(4).mockResolvedValueOnce(1);
    const result = await list(event);
    expect(result.totals).toEqual({ notes: 7, chats: 4 });
    expect(result.uncategorized).toEqual({ notes: 2, chats: 1 });
    expect(result.items).toHaveLength(1);
    expect(mocks.category.findMany).toHaveBeenCalledWith({
      where: { userId: owner },
      orderBy: [{ nameKey: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            notes: { where: { userId: owner } },
            chats: { where: { userId: owner } },
          },
        },
      },
    });
    expect(mocks.note.count).toHaveBeenCalledWith({
      where: { userId: owner, categoryId: null },
    });
    expect(mocks.chat.count).toHaveBeenCalledWith({
      where: { userId: owner, categoryId: null },
    });
  });
  it.each([rename, remove])(
    "hides another owner's category on mutations",
    async (handler) => {
      mocks.category.updateMany.mockResolvedValue({ count: 0 });
      mocks.category.deleteMany.mockResolvedValue({ count: 0 });
      await expect(handler(event)).rejects.toMatchObject({ statusCode: 404 });
      const calls = [
        ...mocks.category.updateMany.mock.calls,
        ...mocks.category.deleteMany.mock.calls,
      ];
      expect(calls[0]?.[0].where).toEqual({ id: "item", userId: owner });
    },
  );
  it("deletes only the owned category, leaving SET NULL to the database", async () => {
    await remove(event);
    expect(mocks.category.deleteMany).toHaveBeenCalledWith({
      where: { id: "item", userId: owner },
    });
    expect(mocks.note.deleteMany).not.toHaveBeenCalled();
    expect(mocks.chat.deleteMany).not.toHaveBeenCalled();
    expect(mocks.status).toHaveBeenCalledWith(event, 204);
  });
});
describe("chat ownership and category assignment", () => {
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
