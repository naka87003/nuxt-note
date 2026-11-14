import { beforeEach, describe, expect, it, vi } from "vitest";

import create from "../../../../server/api/notes/index.post";
import list from "../../../../server/api/notes/index.get";
import read from "../../../../server/api/notes/[id].get";
import update from "../../../../server/api/notes/[id].patch";
import remove from "../../../../server/api/notes/[id].delete";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
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
vi.mock("../../../../server/utils/prisma", () => ({
  getPrisma: () => ({ note: mocks, category: { findFirst: mocks.category } }),
}));
vi.mock("nuxt/server", () => ({
  createError: (details: object) => Object.assign(new Error(), details),
}));
vi.hoisted(() => {
  vi.stubGlobal("defineEventHandler", (handler: unknown) => handler);
  vi.stubGlobal("requireUserSession", mocks.session);
  vi.stubGlobal("readBody", mocks.body);
  vi.stubGlobal("setResponseStatus", mocks.status);
  vi.stubGlobal("getRouterParam", mocks.param);
  vi.stubGlobal("getQuery", mocks.query);
});
const ownerId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const version = "2026-11-13T00:00:00.000Z";
const event = {} as Parameters<typeof create>[0];

beforeEach(() => {
  vi.resetAllMocks();
  mocks.query.mockReturnValue({});
  mocks.findMany.mockResolvedValue([]);
  mocks.session.mockResolvedValue({ user: { id: ownerId } });
  mocks.body.mockResolvedValue({
    title: "  ",
    markdown: "# Hello",
    userId: otherId,
  });
  mocks.create.mockResolvedValue({ id: "note", updatedAt: new Date(version) });
  mocks.param.mockReturnValue("note");
});

describe("notes API ownership and validation", () => {
  it("keeps the AI draft length limit separate from manual Note creation", async () => {
    const markdown = "# Manual note\n\n" + "あ".repeat(3001);
    mocks.body.mockResolvedValue({ title: "Manual note", markdown });
    await create(event);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ markdown }),
      }),
    );
  });
  it("assigns ownership from the session and defaults a blank title", async () => {
    await expect(create(event)).resolves.toEqual({
      id: "note",
      updatedAt: new Date(version),
    });
    expect(mocks.create).toHaveBeenCalledWith({
      data: {
        title: "Untitled note",
        markdown: "# Hello",
        userId: ownerId,
        categoryId: null,
      },
      select: {
        id: true,
        title: true,
        markdown: true,
        categoryId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    expect(mocks.status).toHaveBeenCalledWith(event, 201);
  });
  it.each([
    null,
    [],
    { title: 1, markdown: "" },
    { title: "x".repeat(51), markdown: "" },
    { title: "title" },
    { title: "Title", markdown: "あ".repeat(5001) },
  ])("rejects invalid input %j", async (body) => {
    mocks.body.mockResolvedValue(body);
    await expect(create(event)).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it.each([
    [{ title: 42, markdown: "" }, "Title must be a string"],
    [{ title: "Title" }, "Markdown body is required"],
    [{ title: "Title", markdown: false }, "Markdown body must be a string"],
    [
      { title: "x".repeat(51), markdown: "" },
      "Title must be at most 50 characters",
    ],
    [
      { title: "😀".repeat(25) + "x", markdown: "" },
      "Title must be at most 50 characters",
    ],
    [
      { title: "Title", markdown: "x".repeat(5001) },
      "Markdown body must be at most 5000 characters",
    ],
    [
      { title: "Title", markdown: "", categoryId: 42 },
      "Category ID must be a string or null",
    ],
    [
      { title: "Title", markdown: "", categoryId: "" },
      "Category ID must not be empty",
    ],
  ])(
    "explains the invalid field before looking up categories: %j",
    async (body, statusMessage) => {
      mocks.body.mockResolvedValue(body);
      await expect(create(event)).rejects.toMatchObject({
        statusCode: 400,
        statusMessage,
      });
      expect(mocks.category).not.toHaveBeenCalled();
      expect(mocks.create).not.toHaveBeenCalled();
    },
  );
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
  it("lists only the current user's notes with content for previews", async () => {
    await list(event);
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { userId: ownerId },
      select: {
        id: true,
        title: true,
        categoryId: true,
        updatedAt: true,
        markdown: true,
      },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    });
  });
  it("returns a plain text preview without exposing the full note body", async () => {
    mocks.findMany.mockResolvedValue([
      { id: "note", title: "Note", markdown: "# Hello\n\nA **useful** note." },
      { id: "empty", title: "Empty", markdown: "" },
    ]);
    await expect(list(event)).resolves.toEqual([
      { id: "note", title: "Note", preview: "Hello A useful note." },
      { id: "empty", title: "Empty", preview: "" },
    ]);
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
  const input = {
    title: "  ",
    markdown: "# Changed",
    categoryId: null,
    updatedAt: version,
  };
  beforeEach(() => {
    mocks.findFirst.mockResolvedValue({ id: "note" });
    mocks.update.mockImplementation(async ({ data }) => ({
      id: "note",
      ...data,
    }));
    mocks.deleteMany.mockResolvedValue({ count: 1 });
    mocks.body.mockResolvedValue(input);
  });
  it("updates the session owner's exact version and advances updatedAt", async () => {
    const result = await update(event);
    expect(result).toMatchObject({
      id: "note",
      title: "Untitled note",
      markdown: "# Changed",
      categoryId: null,
    });
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "note", userId: ownerId, updatedAt: new Date(version) },
        data: {
          title: "Untitled note",
          markdown: "# Changed",
          categoryId: null,
          updatedAt: expect.any(Date),
        },
      }),
    );
    expect(result.updatedAt.getTime()).toBeGreaterThan(
      new Date(version).getTime(),
    );
  });
  it("ignores caller ownership and ID fields in favor of the session and route", async () => {
    mocks.body.mockResolvedValue({ ...input, id: "foreign", userId: otherId });
    await update(event);
    expect(mocks.update.mock.calls[0]![0].where).toEqual({
      id: "note",
      userId: ownerId,
      updatedAt: new Date(version),
    });
  });
  it("requires an explicit category on browser updates", async () => {
    mocks.body.mockResolvedValue({
      title: "Title",
      markdown: "",
      updatedAt: version,
    });
    await expect(update(event)).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: "Category is required",
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("allows manually edited bodies longer than the AI draft limit", async () => {
    const markdown = "# Edited note\n\n" + "あ".repeat(3001);
    mocks.body.mockResolvedValue({ ...input, markdown });
    await update(event);
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ markdown }) }),
    );
  });
  it("validates reassignment ownership", async () => {
    mocks.body.mockResolvedValue({ ...input, categoryId: "owned" });
    mocks.category.mockResolvedValue({ id: "owned" });
    await update(event);
    expect(mocks.category).toHaveBeenCalledWith({
      where: { id: "owned", userId: ownerId },
      select: { id: true },
    });
    expect(mocks.update.mock.calls[0]![0].data.categoryId).toBe("owned");
  });
  it("rejects a foreign category without changing the note", async () => {
    mocks.body.mockResolvedValue({ ...input, categoryId: "foreign" });
    mocks.category.mockResolvedValue(null);
    await expect(update(event)).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it.each([
    null,
    [],
    {},
    { ...input, title: "x".repeat(51) },
    { ...input, markdown: 42 },
    { ...input, markdown: "あ".repeat(5001) },
  ])("rejects invalid updates %j", async (body) => {
    mocks.body.mockResolvedValue(body);
    await expect(update(event)).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it.each([
    undefined,
    null,
    "not-a-date",
    "2026-02-30T00:00:00.000Z",
    "2026-11-13T00:00:00Z",
  ])(
    "rejects missing or malformed versions for both update and deletion: %j",
    async (updatedAt) => {
      mocks.body.mockResolvedValue({ ...input, updatedAt });
      await expect(update(event)).rejects.toMatchObject({ statusCode: 400 });
      mocks.body.mockResolvedValue({ updatedAt });
      await expect(remove(event)).rejects.toMatchObject({ statusCode: 400 });
      expect(mocks.update).not.toHaveBeenCalled();
      expect(mocks.deleteMany).not.toHaveBeenCalled();
    },
  );
  it.each([404, 409])(
    "distinguishes missing/foreign notes from changed notes on update: %s",
    async (statusCode) => {
      mocks.update.mockRejectedValue({ code: "P2025" });
      mocks.findFirst.mockResolvedValue(
        statusCode === 404 ? null : { id: "note" },
      );
      await expect(update(event)).rejects.toMatchObject({ statusCode });
      expect(mocks.findFirst).toHaveBeenCalledWith({
        where: { id: "note", userId: ownerId },
        select: { id: true },
      });
    },
  );
  it("allows only one concurrent update of the same version", async () => {
    let current = version;
    mocks.update.mockImplementation(async ({ where, data }) => {
      if (where.updatedAt.toISOString() !== current) throw { code: "P2025" };
      current = data.updatedAt.toISOString();
      return { id: "note", ...data };
    });
    const results = await Promise.allSettled([update(event), update(event)]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.find((result) => result.status === "rejected"),
    ).toMatchObject({ reason: { statusCode: 409 } });
  });
  it("deletes only the session-owned, exact version", async () => {
    mocks.body.mockResolvedValue({ updatedAt: version });
    await remove(event);
    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: { id: "note", userId: ownerId, updatedAt: new Date(version) },
    });
    expect(mocks.status).toHaveBeenCalledWith(event, 204);
  });
  it.each([404, 409])(
    "distinguishes missing/foreign notes from changed notes on deletion: %s",
    async (statusCode) => {
      mocks.body.mockResolvedValue({ updatedAt: version });
      mocks.deleteMany.mockResolvedValue({ count: 0 });
      mocks.findFirst.mockResolvedValue(
        statusCode === 404 ? null : { id: "note" },
      );
      await expect(remove(event)).rejects.toMatchObject({ statusCode });
      expect(mocks.status).not.toHaveBeenCalled();
    },
  );
});
