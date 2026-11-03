import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findMany: vi.fn(),
  findFirst: vi.fn(),
  session: vi.fn(),
  body: vi.fn(),
  status: vi.fn(),
  param: vi.fn(),
}));
vi.mock("../../server/utils/prisma", () => ({
  getPrisma: () => ({ note: mocks }),
}));
vi.mock("nuxt/server", () => ({
  createError: (details: object) => Object.assign(new Error(), details),
}));
vi.stubGlobal("defineEventHandler", (handler: unknown) => handler);
vi.stubGlobal("requireUserSession", mocks.session);
vi.stubGlobal("readBody", mocks.body);
vi.stubGlobal("setResponseStatus", mocks.status);
vi.stubGlobal("getRouterParam", mocks.param);

const { default: create } = await import("../../server/api/notes/index.post");
const { default: list } = await import("../../server/api/notes/index.get");
const { default: read } = await import("../../server/api/notes/[id].get");
const event = {} as Parameters<typeof create>[0];

beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ user: { id: "owner" } });
  mocks.body.mockResolvedValue({
    title: "  ",
    markdown: "# Hello",
    userId: "other",
  });
  mocks.create.mockResolvedValue({ id: "note" });
  mocks.param.mockReturnValue("note");
});

describe("notes API ownership and validation", () => {
  it("assigns ownership from the session and defaults a blank title", async () => {
    await expect(create(event)).resolves.toEqual({ id: "note" });
    expect(mocks.create).toHaveBeenCalledWith({
      data: { title: "Untitled note", markdown: "# Hello", userId: "owner" },
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
  it.each([create, list, read])(
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
      where: { userId: "owner" },
      select: { id: true, title: true, updatedAt: true },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    });
  });
  it("returns 404 for another user's or missing note", async () => {
    mocks.findFirst.mockResolvedValue(null);
    await expect(read(event)).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "note", userId: "owner" } }),
    );
  });
});
