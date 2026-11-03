import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  updateMany: vi.fn(),
  deleteMany: vi.fn(),
  findMany: vi.fn(),
  findFirst: vi.fn(),
  session: vi.fn(),
  body: vi.fn(),
  status: vi.fn(),
  param: vi.fn(),
  query: vi.fn(),
  category: vi.fn(),
}));
vi.mock("../../server/utils/prisma", () => ({
  getPrisma: () => ({ note: mocks, category: { findFirst: mocks.category } }),
}));
vi.mock("nuxt/server", () => ({
  createError: (details: object) => Object.assign(new Error(), details),
}));
vi.stubGlobal("defineEventHandler", (handler: unknown) => handler);
vi.stubGlobal("requireUserSession", mocks.session);
vi.stubGlobal("readBody", mocks.body);
vi.stubGlobal("setResponseStatus", mocks.status);
vi.stubGlobal("getRouterParam", mocks.param);
vi.stubGlobal("getQuery", mocks.query);

const { default: create } = await import("../../server/api/notes/index.post");
const { default: list } = await import("../../server/api/notes/index.get");
const { default: read } = await import("../../server/api/notes/[id].get");
const { default: update } = await import("../../server/api/notes/[id].patch");
const { default: remove } = await import("../../server/api/notes/[id].delete");
const ownerId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const event = {} as Parameters<typeof create>[0];

beforeEach(() => {
  vi.resetAllMocks();
  mocks.query.mockReturnValue({});
  mocks.session.mockResolvedValue({ user: { id: ownerId } });
  mocks.body.mockResolvedValue({
    title: "  ",
    markdown: "# Hello",
    userId: otherId,
  });
  mocks.create.mockResolvedValue({ id: "note" });
  mocks.param.mockReturnValue("note");
});

describe("notes API ownership and validation", () => {
  it("assigns ownership from the session and defaults a blank title", async () => {
    await expect(create(event)).resolves.toEqual({ id: "note" });
    expect(mocks.create).toHaveBeenCalledWith({
      data: {
        title: "Untitled note",
        markdown: "# Hello",
        userId: ownerId,
        categoryId: null,
      },
      select: { id: true },
    });
    expect(mocks.status).toHaveBeenCalledWith(event, 201);
  });
  it.each([
    null,
    [],
    { title: 1, markdown: "" },
    { title: "x".repeat(201), markdown: "" },
    { title: "title" },
  ])("rejects invalid input %j", async (body) => {
    mocks.body.mockResolvedValue(body);
    await expect(create(event)).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it.each([create, list, read, update, remove])(
    "requires authentication before touching data",
    async (handler) => {
      mocks.session.mockRejectedValue(
        Object.assign(new Error(), { statusCode: 401 }),
      );
      await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 });
      expect(mocks.create).not.toHaveBeenCalled();
      expect(mocks.findMany).not.toHaveBeenCalled();
      expect(mocks.findFirst).not.toHaveBeenCalled();
    },
  );
  it("lists only the current user's notes without fetching note bodies", async () => {
    await list(event);
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { userId: ownerId },
      select: { id: true, title: true, categoryId: true, updatedAt: true },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    });
  });
  it("returns 404 for another user's or missing note", async () => {
    mocks.findFirst.mockResolvedValue(null);
    await expect(read(event)).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "note", userId: ownerId } }),
    );
  });

  it.each([create, list, read, update, remove])(
    "rejects malformed session IDs before a database query",
    async (handler) => {
      mocks.session.mockResolvedValue({ user: {}, databaseUserId: ownerId });
      await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 });
      expect(mocks.create).not.toHaveBeenCalled();
      expect(mocks.findMany).not.toHaveBeenCalled();
      expect(mocks.findFirst).not.toHaveBeenCalled();
      expect(mocks.body).not.toHaveBeenCalled();
    },
  );

  it("prevents a second user from reading the first user's note", async () => {
    const note = {
      id: "note",
      userId: ownerId,
      title: "Private",
      markdown: "secret",
    };
    mocks.findFirst.mockImplementation(({ where }) =>
      where.id === note.id && where.userId === note.userId ? note : null,
    );
    await expect(read(event)).resolves.toMatchObject({ title: "Private" });
    mocks.session.mockResolvedValue({ user: { id: otherId } });
    await expect(read(event)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("note categories and search", () => {
  it("rejects a category owned by another user before creating a note", async () => {
    mocks.body.mockResolvedValue({
      title: "Private",
      markdown: "",
      categoryId: "foreign",
    });
    mocks.category.mockResolvedValue(null);
    await expect(create(event)).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.category).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "foreign", userId: ownerId } }),
    );
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("assigns an owned category", async () => {
    mocks.category.mockResolvedValue({ id: "owned" });
    mocks.body.mockResolvedValue({
      title: "Note",
      markdown: "",
      categoryId: "owned",
    });
    await create(event);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          title: "Note",
          markdown: "",
          categoryId: "owned",
          userId: ownerId,
        },
      }),
    );
  });
  it("keeps literal wildcard search and the selected category within the owner", async () => {
    mocks.query.mockReturnValue({ category: "uncategorized", q: "50%_" });
    await list(event);
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: ownerId,
          categoryId: null,
          OR: [
            { title: { contains: "50\\%\\_", mode: "insensitive" } },
            { markdown: { contains: "50\\%\\_", mode: "insensitive" } },
          ],
        },
      }),
    );
  });
});

describe("saved-note mutations", () => {
  beforeEach(() => {
    mocks.findFirst.mockResolvedValue({ id: "note" });
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.deleteMany.mockResolvedValue({ count: 1 });
    mocks.body.mockResolvedValue({
      title: "  ",
      markdown: "# Changed",
      categoryId: null,
      userId: otherId,
    });
  });
  it("updates the session owner's note with a normalized title and explicit category", async () => {
    await expect(update(event)).resolves.toMatchObject({
      id: "note",
      title: "Untitled note",
    });
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: "note", userId: ownerId },
      data: { title: "Untitled note", markdown: "# Changed", categoryId: null },
    });
  });
  it("validates reassignment ownership", async () => {
    mocks.body.mockResolvedValue({
      title: "Note",
      markdown: "",
      categoryId: "owned",
    });
    mocks.category.mockResolvedValue({ id: "owned" });
    await update(event);
    expect(mocks.category).toHaveBeenCalledWith({
      where: { id: "owned", userId: ownerId },
      select: { id: true },
    });
    expect(mocks.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { title: "Note", markdown: "", categoryId: "owned" },
      }),
    );
  });
  it("rejects a foreign category without changing the note", async () => {
    mocks.body.mockResolvedValue({
      title: "Note",
      markdown: "",
      categoryId: "foreign",
    });
    mocks.category.mockResolvedValue(null);
    await expect(update(event)).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
  it.each([
    null,
    [],
    {},
    { title: "x".repeat(201), markdown: "", categoryId: null },
    { title: "x", markdown: 42, categoryId: null },
    { title: "x", markdown: "" },
  ])("rejects invalid updates %j", async (body) => {
    mocks.body.mockResolvedValue(body);
    await expect(update(event)).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
  it("hides foreign or missing notes before reading an update body", async () => {
    mocks.findFirst.mockResolvedValue(null);
    await expect(update(event)).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.body).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
  it("handles deletion racing an update", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });
    await expect(update(event)).rejects.toMatchObject({ statusCode: 404 });
  });
  it("deletes only a session-owned note", async () => {
    await remove(event);
    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: { id: "note", userId: ownerId },
    });
    expect(mocks.status).toHaveBeenCalledWith(event, 204);
  });
  it("returns 404 when deletion matches no owned note", async () => {
    mocks.deleteMany.mockResolvedValue({ count: 0 });
    await expect(remove(event)).rejects.toMatchObject({ statusCode: 404 });
  });
});
