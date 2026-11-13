import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import {
  readOwnedNote,
  searchOwnedNotes,
} from "../../../../server/utils/note-reads";
import issue from "../../../../server/api/agent-tokens/index.post";
import tokens from "../../../../server/api/agent-tokens/index.get";
import remove from "../../../../server/api/agent-tokens/[id].delete";
import {
  getAgentUserId,
  newAgentToken,
} from "../../../../server/utils/agent-auth";

const mocks = vi.hoisted(() => ({
  agentToken: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  note: { findMany: vi.fn(), findFirst: vi.fn() },
  session: vi.fn(),
  header: vi.fn(),
  setHeader: vi.fn(),
  param: vi.fn(),
  body: vi.fn(),
  status: vi.fn(),
}));
vi.mock("../../../../server/utils/prisma", () => ({ getPrisma: () => mocks }));
vi.mock("nuxt/server", () => ({
  createError: (details: object) => Object.assign(new Error(), details),
}));
vi.hoisted(() => {
  vi.stubGlobal("defineEventHandler", (handler: unknown) => handler);
  vi.stubGlobal("requireUserSession", mocks.session);
  vi.stubGlobal("getHeader", mocks.header);
  vi.stubGlobal("setHeader", mocks.setHeader);
  vi.stubGlobal("getRouterParam", mocks.param);
  vi.stubGlobal("readBody", mocks.body);
  vi.stubGlobal("setResponseStatus", mocks.status);
});
const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const token = `nnr_${"a".repeat(43)}`;
const event = {} as Parameters<typeof getAgentUserId>[0];
beforeEach(() => {
  vi.resetAllMocks();
  mocks.header.mockReturnValue(`Bearer ${token}`);
  mocks.agentToken.findUnique.mockResolvedValue({
    userId: owner,
  });
  mocks.note.findMany.mockResolvedValue([]);
  mocks.param.mockReturnValue("note");
  mocks.session.mockResolvedValue({ user: { id: owner } });
  mocks.body.mockResolvedValue({ name: " Local agent ", userId: other });
  mocks.agentToken.create.mockResolvedValue({
    id: "token-id",
    name: "Local agent",
  });
  mocks.agentToken.deleteMany.mockResolvedValue({ count: 1 });
});

describe("bearer authentication", () => {
  it("looks up a SHA-256 hash and returns only the token owner", async () => {
    await expect(getAgentUserId(event)).resolves.toBe(owner);
    expect(mocks.agentToken.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: createHash("sha256").update(token).digest("hex") },
      select: { userId: true },
    });
    expect(mocks.session).not.toHaveBeenCalled();
    expect(mocks.setHeader).toHaveBeenCalledWith(
      event,
      "Cache-Control",
      "private, no-store",
    );
  });
  it.each([undefined, "", "Basic abc", "Bearer bad", `Bearer ${token} extra`])(
    "rejects malformed credentials without using a session: %s",
    async (value) => {
      mocks.header.mockReturnValue(value);
      await expect(getAgentUserId(event)).rejects.toMatchObject({
        statusCode: 401,
      });
      expect(mocks.agentToken.findUnique).not.toHaveBeenCalled();
      expect(mocks.note.findMany).not.toHaveBeenCalled();
      expect(mocks.session).not.toHaveBeenCalled();
    },
  );
  it("rejects unknown or deleted credentials", async () => {
    mocks.agentToken.findUnique.mockResolvedValue(null);
    await expect(getAgentUserId(event)).rejects.toMatchObject({
      statusCode: 401,
    });
    expect(mocks.note.findFirst).not.toHaveBeenCalled();
  });
});

describe("owner-scoped Note reads", () => {
  it("keeps literal search and bounded pagination within the owner", async () => {
    mocks.note.findMany.mockResolvedValue([
      { id: "one", title: "First", markdown: "# Hello" },
      { id: "two", title: "Next", markdown: "hidden body" },
    ]);
    await expect(
      searchOwnedNotes(owner, {
        q: "50%_",
        category: "uncategorized",
        limit: 1,
        offset: 2,
      }),
    ).resolves.toEqual({
      notes: [{ id: "one", title: "First", preview: "Hello" }],
      nextOffset: 3,
    });
    expect(mocks.note.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: owner,
          categoryId: null,
          OR: [
            { title: { contains: "50\\%\\_", mode: "insensitive" } },
            { markdown: { contains: "50\\%\\_", mode: "insensitive" } },
          ],
        },
        take: 2,
        skip: 2,
      }),
    );
  });
  it("returns a null nextOffset for the final page", async () => {
    await expect(
      searchOwnedNotes(owner, { limit: 20, offset: 0 }),
    ).resolves.toEqual({ notes: [], nextOffset: null });
  });
  it("hides another owner's Note with the same 404 as a missing Note", async () => {
    mocks.note.findFirst.mockImplementation(({ where }) =>
      where.userId === other ? { id: "note", markdown: "Private" } : null,
    );
    await expect(readOwnedNote(owner, "note")).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(mocks.note.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "note", userId: owner } }),
    );
  });
});

describe("session-only token management", () => {
  it("generates unique tokens without an expiration date", () => {
    const a = newAgentToken();
    const b = newAgentToken();
    expect(a.token).toMatch(/^nnr_[A-Za-z0-9_-]{43}$/);
    expect(a.token).not.toBe(b.token);
    expect(a.tokenHash).toBe(
      createHash("sha256").update(a.token).digest("hex"),
    );
    expect(a).not.toHaveProperty("expiresAt");
  });
  it("stores only the hash and assigns the session owner", async () => {
    const result = await issue(event);
    expect(result.token).toMatch(/^nnr_/);
    const data = mocks.agentToken.create.mock.calls[0]![0].data;
    expect(data).toMatchObject({
      userId: owner,
      name: "Local agent",
      tokenHash: createHash("sha256").update(result.token).digest("hex"),
    });
    expect(data).not.toHaveProperty("token");
    expect(result).not.toHaveProperty("tokenHash");
    expect(data).not.toHaveProperty("expiresAt");
    expect(data).not.toHaveProperty("revokedAt");
  });
  it.each([null, {}, [], { name: " " }, { name: "x".repeat(51) }])(
    "rejects invalid token names %j",
    async (body) => {
      mocks.body.mockResolvedValue(body);
      await expect(issue(event)).rejects.toMatchObject({ statusCode: 400 });
      expect(mocks.agentToken.create).not.toHaveBeenCalled();
    },
  );
  it.each([issue, tokens, remove])(
    "does not accept a bearer token as a browser session",
    async (handler) => {
      mocks.session.mockRejectedValue(
        Object.assign(new Error(), { statusCode: 401 }),
      );
      await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 });
      expect(mocks.agentToken.create).not.toHaveBeenCalled();
      expect(mocks.agentToken.findMany).not.toHaveBeenCalled();
      expect(mocks.agentToken.deleteMany).not.toHaveBeenCalled();
    },
  );
  it("lists only metadata for the session owner", async () => {
    await tokens(event);
    const args = mocks.agentToken.findMany.mock.calls[0]![0];
    expect(args.where).toEqual({ userId: owner });
    expect(args.select).not.toHaveProperty("tokenHash");
    expect(args.select).not.toHaveProperty("token");
  });
  it("permanently deletes only the session owner's token", async () => {
    await remove(event);
    expect(mocks.agentToken.deleteMany).toHaveBeenCalledWith({
      where: { id: "note", userId: owner },
    });
    expect(mocks.status).toHaveBeenCalledWith(event, 204);
  });
  it("returns 404 for a missing or another owner's token", async () => {
    mocks.agentToken.deleteMany.mockResolvedValue({ count: 0 });
    await expect(remove(event)).rejects.toMatchObject({ statusCode: 404 });
  });
});
