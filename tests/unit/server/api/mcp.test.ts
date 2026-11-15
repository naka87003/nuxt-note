import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { createRemoteNotesServer } from "../../../../server/utils/mcp-notes";
import { validateMcpRequest } from "../../../../server/utils/mcp-http";

const reads = vi.hoisted(() => ({
  searchOwnedNotes: vi.fn(),
  readOwnedNote: vi.fn(),
}));
vi.mock("../../../../server/utils/note-reads", () => reads);
vi.mock("nuxt/server", () => ({
  createError: (details: object) => Object.assign(new Error(), details),
}));
const writes = vi.hoisted(() => ({
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
  chat: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  },
  note: {
    create: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
    findFirst: vi.fn(),
  },
  category: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
}));
vi.mock("../../../../server/utils/prisma", () => ({ getPrisma: () => writes }));
const clients: Client[] = [];
const handlers: ReturnType<typeof createMcpHandler>[] = [];
beforeEach(() => {
  vi.resetAllMocks();
  writes.$transaction.mockImplementation(async (operation) =>
    operation(writes),
  );
  reads.searchOwnedNotes.mockResolvedValue({ notes: [], nextOffset: null });
  reads.readOwnedNote.mockResolvedValue({
    id: "note",
    title: "Title",
    markdown: "# Note",
    categoryId: null,
    updatedAt: new Date("2026-11-13T00:00:00Z"),
  });
});
afterEach(async () => {
  for (const client of clients.splice(0)) await client.close();
  for (const handler of handlers.splice(0)) await handler.close();
});
async function connect(owner: string, siteUrl = "https://notes.example") {
  const handler = createMcpHandler(
    () => createRemoteNotesServer(owner, siteUrl),
    {
      responseMode: "json",
      maxSubscriptions: 0,
    },
  );
  handlers.push(handler);
  const client = new Client({ name: "remote-test", version: "0.1.0" });
  clients.push(client);
  await client.connect(
    new StreamableHTTPClientTransport(new URL("https://notes.example/mcp"), {
      fetch: async (url, init) => handler.fetch(new Request(url, init)),
    }),
  );
  return client;
}

describe("remote MCP tools", () => {
  it.each([0, 2])(
    "merges Categories atomically without reading bodies (%s Notes)",
    async (movedNoteCount) => {
      const client = await connect("owner");
      const { tools } = await client.listTools();
      const definition = tools.find((tool) => tool.name === "merge_categories");
      expect(definition?.inputSchema.required?.slice().sort()).toEqual([
        "sourceCategoryId",
        "targetCategoryId",
      ]);
      expect(definition?.annotations).toMatchObject({
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
      });
      writes.$queryRaw
        .mockResolvedValueOnce([{ id: "source" }, { id: "target" }])
        .mockResolvedValueOnce([{ movedCount: 1, currentChatMoved: false }]);
      writes.$executeRaw.mockResolvedValueOnce(movedNoteCount);
      writes.category.deleteMany.mockResolvedValueOnce({ count: 1 });
      const args = { sourceCategoryId: "source", targetCategoryId: "target" };
      expect(
        await client.callTool({ name: "merge_categories", arguments: args }),
      ).toMatchObject({
        structuredContent: { ...args, movedNoteCount, movedChatCount: 1 },
      });
      expect(writes.$transaction).toHaveBeenCalledOnce();
      expect(writes.$executeRaw.mock.calls[0]?.slice(1)).toEqual([
        "target",
        "owner",
        "source",
      ]);
      expect(writes.$queryRaw.mock.calls[1]?.slice(1)).toEqual([
        "target",
        "owner",
        "source",
        null,
      ]);
      expect(writes.category.deleteMany).toHaveBeenCalledExactlyOnceWith({
        where: {
          id: "source",
          userId: "owner",
          notes: { none: {} },
          chats: { none: {} },
        },
      });
      expect(writes.note.findFirst).not.toHaveBeenCalled();
      expect(writes.chat.findMany).not.toHaveBeenCalled();
    },
  );
  it("rejects a merge before moving content if either Category is missing or foreign", async () => {
    const client = await connect("owner");
    writes.$queryRaw.mockResolvedValueOnce([{ id: "source" }]);
    expect(
      await client.callTool({
        name: "merge_categories",
        arguments: { sourceCategoryId: "source", targetCategoryId: "foreign" },
      }),
    ).toMatchObject({
      isError: true,
      content: [{ text: "Category not found." }],
    });
    expect(writes.$executeRaw).not.toHaveBeenCalled();
    expect(writes.category.deleteMany).not.toHaveBeenCalled();
  });
  it.each(["move", "delete"])(
    "hides merge failures and does not retry (%s)",
    async (stage) => {
      const client = await connect("owner");
      writes.$queryRaw
        .mockResolvedValueOnce([{ id: "source" }, { id: "target" }])
        .mockResolvedValueOnce([{ movedCount: 1, currentChatMoved: false }]);
      if (stage === "move") {
        writes.$executeRaw.mockRejectedValueOnce(
          new Error("private database details"),
        );
      } else {
        writes.$executeRaw.mockResolvedValueOnce(1);
        writes.category.deleteMany.mockResolvedValueOnce({ count: 0 });
      }
      expect(
        await client.callTool({
          name: "merge_categories",
          arguments: { sourceCategoryId: "source", targetCategoryId: "target" },
        }),
      ).toMatchObject({
        isError: true,
        content: [
          { text: expect.stringContaining("Could not merge Categories.") },
        ],
      });
      expect(writes.$transaction).toHaveBeenCalledOnce();
    },
  );
  it.each([
    {},
    { sourceCategoryId: "source" },
    { sourceCategoryId: null, targetCategoryId: "target" },
    { sourceCategoryId: "source", targetCategoryId: null },
    { sourceCategoryId: "same", targetCategoryId: "same" },
    { sourceCategoryId: "", targetCategoryId: "target" },
    { sourceCategoryId: "source", targetCategoryId: 1 },
    { sourceCategoryId: "x".repeat(101), targetCategoryId: "target" },
    { sourceCategoryId: "source", targetCategoryId: "target", userId: "other" },
  ])("rejects invalid merge input %j", async (args) => {
    const client = await connect("owner");
    expect(
      (await client.callTool({ name: "merge_categories", arguments: args }))
        .isError,
    ).toBe(true);
    expect(writes.$transaction).not.toHaveBeenCalled();
  });
  it.each([
    ["source", "target", 2],
    [null, "target", 0],
    ["source", null, 3],
  ] as const)(
    "moves Chats from %j to %j without exposing messages or internal context",
    async (sourceCategoryId, targetCategoryId, movedCount) => {
      const client = await connect("owner");
      const { tools } = await client.listTools();
      const definition = tools.find(
        (tool) => tool.name === "move_category_chats",
      );
      expect(definition?.inputSchema.required?.slice().sort()).toEqual([
        "sourceCategoryId",
        "targetCategoryId",
      ]);
      expect(definition?.annotations).toMatchObject({
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
      });
      writes.$queryRaw
        .mockResolvedValueOnce(
          [sourceCategoryId, targetCategoryId]
            .filter((id) => id !== null)
            .map((id) => ({ id })),
        )
        .mockResolvedValueOnce([{ movedCount, currentChatMoved: false }]);
      const result = await client.callTool({
        name: "move_category_chats",
        arguments: { sourceCategoryId, targetCategoryId },
      });
      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toEqual({
        sourceCategoryId,
        targetCategoryId,
        movedCount,
      });
      expect(writes.$transaction).toHaveBeenCalledOnce();
      expect(writes.$queryRaw).toHaveBeenCalledTimes(2);
      expect(writes.$queryRaw.mock.calls[0]?.[1]).toBe("owner");
      expect(writes.$queryRaw.mock.calls[1]?.slice(1)).toEqual([
        targetCategoryId,
        "owner",
        sourceCategoryId,
        null,
      ]);
      expect(writes.$executeRaw).not.toHaveBeenCalled();
      expect(writes.chat.findFirst).not.toHaveBeenCalled();
      expect(writes.chat.findMany).not.toHaveBeenCalled();
      expect(writes.category.deleteMany).not.toHaveBeenCalled();
      expect(writes.note.update).not.toHaveBeenCalled();
    },
  );
  it("does not move Chats when either Category is missing or foreign", async () => {
    const client = await connect("owner");
    writes.$queryRaw.mockResolvedValue([{ id: "source" }]);
    expect(
      await client.callTool({
        name: "move_category_chats",
        arguments: { sourceCategoryId: "source", targetCategoryId: "foreign" },
      }),
    ).toMatchObject({
      isError: true,
      content: [{ text: "Category not found." }],
    });
    expect(writes.$queryRaw).toHaveBeenCalledOnce();
  });
  it("hides Chat move failures without automatic retries", async () => {
    const client = await connect("owner");
    writes.$queryRaw
      .mockResolvedValueOnce([{ id: "source" }, { id: "target" }])
      .mockRejectedValueOnce(new Error("private database details"));
    expect(
      await client.callTool({
        name: "move_category_chats",
        arguments: { sourceCategoryId: "source", targetCategoryId: "target" },
      }),
    ).toMatchObject({
      isError: true,
      content: [{ text: expect.stringContaining("Could not move Chats.") }],
    });
    expect(writes.$transaction).toHaveBeenCalledOnce();
  });
  it.each([
    {},
    { sourceCategoryId: "source" },
    { targetCategoryId: null },
    { sourceCategoryId: "same", targetCategoryId: "same" },
    { sourceCategoryId: null, targetCategoryId: null },
    { sourceCategoryId: "", targetCategoryId: "target" },
    { sourceCategoryId: "source", targetCategoryId: 1 },
    { sourceCategoryId: "x".repeat(101), targetCategoryId: null },
    { sourceCategoryId: "source", targetCategoryId: "x".repeat(101) },
    { sourceCategoryId: "source", targetCategoryId: null, userId: "other" },
    {
      sourceCategoryId: "source",
      targetCategoryId: null,
      currentChatId: "chat",
    },
    { sourceCategoryId: "source", targetCategoryId: null, messages: [] },
  ])("rejects invalid Chat move input %j", async (args) => {
    const client = await connect("owner");
    expect(
      (await client.callTool({ name: "move_category_chats", arguments: args }))
        .isError,
    ).toBe(true);
    expect(writes.$transaction).not.toHaveBeenCalled();
  });
  it.each([
    ["source", "target", 2],
    [null, "target", 0],
    ["source", null, 3],
  ] as const)(
    "moves Notes from %j to %j and returns the actual count",
    async (sourceCategoryId, targetCategoryId, movedCount) => {
      const client = await connect("owner");
      const { tools } = await client.listTools();
      const definition = tools.find(
        (tool) => tool.name === "move_category_notes",
      );
      expect(definition?.inputSchema.required?.slice().sort()).toEqual([
        "sourceCategoryId",
        "targetCategoryId",
      ]);
      expect(definition?.annotations).toMatchObject({
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
      });
      writes.$queryRaw.mockResolvedValue(
        [sourceCategoryId, targetCategoryId]
          .filter((id) => id !== null)
          .map((id) => ({ id })),
      );
      writes.$executeRaw.mockResolvedValue(movedCount);
      const result = await client.callTool({
        name: "move_category_notes",
        arguments: { sourceCategoryId, targetCategoryId },
      });
      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toEqual({
        sourceCategoryId,
        targetCategoryId,
        movedCount,
      });
      expect(writes.$transaction).toHaveBeenCalledOnce();
      expect(writes.$executeRaw).toHaveBeenCalledOnce();
      expect(writes.$queryRaw.mock.calls[0]?.[1]).toBe("owner");
      expect(writes.$executeRaw.mock.calls[0]?.slice(1)).toEqual([
        targetCategoryId,
        "owner",
        sourceCategoryId,
      ]);
      expect(reads.readOwnedNote).not.toHaveBeenCalled();
      expect(reads.searchOwnedNotes).not.toHaveBeenCalled();
      expect(writes.category.deleteMany).not.toHaveBeenCalled();
      expect(writes.chat.update).not.toHaveBeenCalled();
    },
  );
  it("does not move Notes when either Category is missing or foreign", async () => {
    const client = await connect("owner");
    writes.$queryRaw.mockResolvedValue([{ id: "source" }]);
    expect(
      await client.callTool({
        name: "move_category_notes",
        arguments: { sourceCategoryId: "source", targetCategoryId: "foreign" },
      }),
    ).toMatchObject({
      isError: true,
      content: [{ text: "Category not found." }],
    });
    expect(writes.$executeRaw).not.toHaveBeenCalled();
  });
  it("hides bulk move storage errors without automatically retrying", async () => {
    const client = await connect("owner");
    writes.$queryRaw.mockResolvedValue([{ id: "source" }, { id: "target" }]);
    writes.$executeRaw.mockRejectedValue(new Error("private database details"));
    expect(
      await client.callTool({
        name: "move_category_notes",
        arguments: { sourceCategoryId: "source", targetCategoryId: "target" },
      }),
    ).toMatchObject({
      isError: true,
      content: [{ text: expect.stringContaining("Could not move Notes.") }],
    });
    expect(writes.$transaction).toHaveBeenCalledOnce();
    expect(writes.$executeRaw).toHaveBeenCalledOnce();
  });
  it.each([
    {},
    { sourceCategoryId: "source" },
    { targetCategoryId: null },
    { sourceCategoryId: "same", targetCategoryId: "same" },
    { sourceCategoryId: null, targetCategoryId: null },
    { sourceCategoryId: "", targetCategoryId: "target" },
    { sourceCategoryId: "source", targetCategoryId: 1 },
    { sourceCategoryId: "x".repeat(101), targetCategoryId: null },
    { sourceCategoryId: "source", targetCategoryId: "x".repeat(101) },
    { sourceCategoryId: "source", targetCategoryId: null, userId: "other" },
    { sourceCategoryId: "source", targetCategoryId: null, markdown: "Changed" },
  ])("rejects invalid bulk move input %j", async (args) => {
    const client = await connect("owner");
    expect(
      (await client.callTool({ name: "move_category_notes", arguments: args }))
        .isError,
    ).toBe(true);
    expect(writes.$transaction).not.toHaveBeenCalled();
  });
  const noteTitleInput = {
    id: "note",
    title: "  New title  ",
    updatedAt: "2026-11-15T00:00:00.000Z",
  };
  it.each([
    ["  New title  ", "New title"],
    ["", "Untitled note"],
    [" \t\n ", "Untitled note"],
    ["😀".repeat(25), "😀".repeat(25)],
  ])(
    "updates only a Note title from %j, without selecting its body",
    async (title, savedTitle) => {
      const client = await connect("owner");
      const { tools } = await client.listTools();
      const definition = tools.find(
        (tool) => tool.name === "update_note_title",
      );
      expect(definition?.inputSchema.required?.slice().sort()).toEqual([
        "id",
        "title",
        "updatedAt",
      ]);
      expect(definition?.annotations).toMatchObject({
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
      });
      writes.note.update.mockResolvedValue({
        id: "note",
        title: savedTitle,
        categoryId: "existing",
        updatedAt: new Date("2026-11-15T00:00:00.001Z"),
      });
      const clock = vi
        .spyOn(Date, "now")
        .mockReturnValue(new Date(noteTitleInput.updatedAt).getTime());
      try {
        const result = await client.callTool({
          name: "update_note_title",
          arguments: { ...noteTitleInput, title },
        });
        expect(result.isError).toBeFalsy();
        expect(result.structuredContent).toEqual({
          id: "note",
          title: savedTitle,
          categoryId: "existing",
          updatedAt: "2026-11-15T00:00:00.001Z",
          url: "https://notes.example/notes/note",
        });
        expect(writes.note.update).toHaveBeenCalledExactlyOnceWith({
          where: {
            id: "note",
            userId: "owner",
            updatedAt: new Date(noteTitleInput.updatedAt),
          },
          data: {
            title: savedTitle,
            updatedAt: new Date("2026-11-15T00:00:00.001Z"),
          },
          select: {
            id: true,
            title: true,
            categoryId: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        expect(reads.readOwnedNote).not.toHaveBeenCalled();
        expect(writes.note.findFirst).not.toHaveBeenCalled();
        expect(writes.category.findFirst).not.toHaveBeenCalled();
      } finally {
        clock.mockRestore();
      }
    },
  );
  it.each([null, { id: "note" }])(
    "distinguishes missing/foreign Notes from rename conflicts: %j",
    async (existing) => {
      const client = await connect("owner");
      writes.note.update.mockRejectedValue({ code: "P2025" });
      writes.note.findFirst.mockResolvedValue(existing);
      expect(
        await client.callTool({
          name: "update_note_title",
          arguments: noteTitleInput,
        }),
      ).toMatchObject({
        isError: true,
        content: [
          {
            text: existing
              ? expect.stringContaining("Note has changed.")
              : "Note not found.",
          },
        ],
      });
      expect(writes.note.findFirst).toHaveBeenCalledExactlyOnceWith({
        where: { id: "note", userId: "owner" },
        select: { id: true },
      });
      expect(writes.note.update).toHaveBeenCalledTimes(1);
    },
  );
  it("hides storage errors when renaming a Note", async () => {
    const client = await connect("owner");
    writes.note.update.mockRejectedValue(new Error("private database details"));
    expect(
      await client.callTool({
        name: "update_note_title",
        arguments: noteTitleInput,
      }),
    ).toMatchObject({
      isError: true,
      content: [{ text: "Could not update Note title. Please try again." }],
    });
  });
  it.each([
    {},
    { ...noteTitleInput, id: "" },
    { ...noteTitleInput, id: "x".repeat(101) },
    { ...noteTitleInput, title: undefined },
    { ...noteTitleInput, title: null },
    { ...noteTitleInput, title: 1 },
    { ...noteTitleInput, title: "x".repeat(51) },
    { ...noteTitleInput, title: "😀".repeat(26) },
    { ...noteTitleInput, updatedAt: undefined },
    { ...noteTitleInput, updatedAt: "2026-02-30T00:00:00.000Z" },
    { ...noteTitleInput, updatedAt: "2026-11-15T00:00:00Z" },
    { ...noteTitleInput, userId: "other" },
    { ...noteTitleInput, markdown: "Body" },
    { ...noteTitleInput, categoryId: null },
  ])("rejects invalid Note title input %j", async (args) => {
    const client = await connect("owner");
    expect(
      (await client.callTool({ name: "update_note_title", arguments: args }))
        .isError,
    ).toBe(true);
    expect(writes.note.update).not.toHaveBeenCalled();
  });
  it("isolates Note rename owners between MCP clients", async () => {
    const [a, b] = await Promise.all([connect("a"), connect("b")]);
    writes.note.update.mockResolvedValue({ id: "note", title: "New title" });
    await Promise.all(
      [a, b].map((client) =>
        client.callTool({
          name: "update_note_title",
          arguments: noteTitleInput,
        }),
      ),
    );
    expect(
      writes.note.update.mock.calls.map(([args]) => args.where.userId).sort(),
    ).toEqual(["a", "b"]);
  });
  const deleteChatInput = { id: "chat", updatedAt: "2026-11-15T00:00:00.000Z" };
  it("deletes only the Chat owner and expected version without returning messages", async () => {
    const client = await connect("owner");
    const { tools } = await client.listTools();
    const definition = tools.find((tool) => tool.name === "delete_chat");
    expect(definition?.inputSchema.required?.slice().sort()).toEqual([
      "id",
      "updatedAt",
    ]);
    expect(definition?.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    });
    writes.chat.deleteMany.mockResolvedValue({ count: 1 });
    const result = await client.callTool({
      name: "delete_chat",
      arguments: deleteChatInput,
    });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({ id: "chat", deleted: true });
    expect(result.content).toEqual([
      { type: "text", text: JSON.stringify(result.structuredContent, null, 2) },
    ]);
    expect(writes.chat.deleteMany).toHaveBeenCalledExactlyOnceWith({
      where: {
        id: "chat",
        userId: "owner",
        updatedAt: new Date(deleteChatInput.updatedAt),
      },
    });
    expect(writes.chat.findFirst).not.toHaveBeenCalled();
    expect(writes.chat.findMany).not.toHaveBeenCalled();
    expect(writes.category.deleteMany).not.toHaveBeenCalled();
    expect(writes.note.deleteMany).not.toHaveBeenCalled();
  });
  it.each(["missing", "foreign", "already-deleted"])(
    "hides a %s Chat on deletion",
    async (id) => {
      const client = await connect("owner");
      writes.chat.deleteMany.mockResolvedValue({ count: 0 });
      writes.chat.findFirst.mockResolvedValue(null);
      expect(
        await client.callTool({
          name: "delete_chat",
          arguments: { ...deleteChatInput, id },
        }),
      ).toMatchObject({
        isError: true,
        content: [{ text: "Chat not found." }],
      });
      expect(writes.chat.deleteMany).toHaveBeenCalledExactlyOnceWith({
        where: {
          id,
          userId: "owner",
          updatedAt: new Date(deleteChatInput.updatedAt),
        },
      });
      expect(writes.chat.findFirst).toHaveBeenCalledWith({
        where: { id, userId: "owner" },
        select: { id: true },
      });
    },
  );
  it("rejects concurrent Chat changes and requests a new confirmation without retrying", async () => {
    const client = await connect("owner");
    writes.chat.deleteMany.mockResolvedValue({ count: 0 });
    writes.chat.findFirst.mockResolvedValue({ id: "chat" });
    expect(
      await client.callTool({
        name: "delete_chat",
        arguments: deleteChatInput,
      }),
    ).toMatchObject({
      isError: true,
      content: [
        {
          text: expect.stringContaining(
            "ask the user to confirm deletion in a new message",
          ),
        },
      ],
    });
    expect(writes.chat.deleteMany).toHaveBeenCalledTimes(1);
  });
  it.each(["delete", "lookup"])(
    "hides storage errors during Chat deletion (%s)",
    async (stage) => {
      const client = await connect("owner");
      const error = new Error("private database details");
      if (stage === "delete") {
        writes.chat.deleteMany.mockRejectedValue(error);
      } else {
        writes.chat.deleteMany.mockResolvedValue({ count: 0 });
        writes.chat.findFirst.mockRejectedValue(error);
      }
      expect(
        await client.callTool({
          name: "delete_chat",
          arguments: deleteChatInput,
        }),
      ).toMatchObject({
        isError: true,
        content: [{ text: "Could not delete Chat. Please try again." }],
      });
    },
  );
  it.each([
    {},
    { id: "chat" },
    { updatedAt: deleteChatInput.updatedAt },
    { ...deleteChatInput, id: "" },
    { ...deleteChatInput, id: "x".repeat(101) },
    { ...deleteChatInput, id: 1 },
    { ...deleteChatInput, updatedAt: null },
    { ...deleteChatInput, updatedAt: "2026-02-30T00:00:00.000Z" },
    { ...deleteChatInput, updatedAt: "2026-11-15T00:00:00Z" },
    { ...deleteChatInput, userId: "other" },
    { ...deleteChatInput, confirm: true },
    { ...deleteChatInput, messages: [] },
  ])("rejects invalid Chat deletion input %j", async (args) => {
    const client = await connect("owner");
    expect(
      (await client.callTool({ name: "delete_chat", arguments: args })).isError,
    ).toBe(true);
    expect(writes.chat.deleteMany).not.toHaveBeenCalled();
    expect(writes.chat.findFirst).not.toHaveBeenCalled();
  });
  it("keeps deletion owners separate across MCP clients", async () => {
    const [a, b] = await Promise.all([connect("a"), connect("b")]);
    writes.chat.deleteMany.mockResolvedValue({ count: 1 });
    await Promise.all(
      [a, b].map((client) =>
        client.callTool({ name: "delete_chat", arguments: deleteChatInput }),
      ),
    );
    expect(
      writes.chat.deleteMany.mock.calls
        .map(([args]) => args.where.userId)
        .sort(),
    ).toEqual(["a", "b"]);
  });
  const chatTitleInput = {
    id: "chat",
    title: "  New title  ",
    updatedAt: "2026-11-15T00:00:00.000Z",
  };
  it.each(["New title", "😀".repeat(80)])(
    "updates only the Chat title with a monotonically advancing version",
    async (title) => {
      const client = await connect("owner");
      const { tools } = await client.listTools();
      const definition = tools.find(
        (tool) => tool.name === "update_chat_title",
      );
      expect(definition?.inputSchema.required?.slice().sort()).toEqual([
        "id",
        "title",
        "updatedAt",
      ]);
      expect(definition?.annotations).toMatchObject({
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
      });
      writes.chat.update.mockResolvedValue({
        id: "chat",
        title,
        categoryId: "existing",
        updatedAt: new Date("2026-11-15T00:00:00.001Z"),
      });
      const clock = vi
        .spyOn(Date, "now")
        .mockReturnValue(new Date(chatTitleInput.updatedAt).getTime());
      try {
        const result = await client.callTool({
          name: "update_chat_title",
          arguments: {
            ...chatTitleInput,
            title: title === "New title" ? chatTitleInput.title : title,
          },
        });
        expect(result.isError).toBeFalsy();
        expect(result.structuredContent).toEqual({
          id: "chat",
          title,
          categoryId: "existing",
          updatedAt: "2026-11-15T00:00:00.001Z",
          url: "https://notes.example/chats/chat",
        });
        expect(writes.chat.update).toHaveBeenCalledExactlyOnceWith({
          where: {
            id: "chat",
            userId: "owner",
            updatedAt: new Date(chatTitleInput.updatedAt),
          },
          data: { title, updatedAt: new Date("2026-11-15T00:00:00.001Z") },
          select: { id: true, title: true, categoryId: true, updatedAt: true },
        });
        expect(writes.chat.findFirst).not.toHaveBeenCalled();
        expect(writes.category.findFirst).not.toHaveBeenCalled();
      } finally {
        clock.mockRestore();
      }
    },
  );
  it.each([null, { id: "chat" }])(
    "distinguishes missing/foreign Chats from title update conflicts: %j",
    async (existing) => {
      const client = await connect("owner");
      writes.chat.update.mockRejectedValue({ code: "P2025" });
      writes.chat.findFirst.mockResolvedValue(existing);
      expect(
        await client.callTool({
          name: "update_chat_title",
          arguments: chatTitleInput,
        }),
      ).toMatchObject({
        isError: true,
        content: [
          {
            text: existing
              ? expect.stringContaining("Chat has changed.")
              : "Chat not found.",
          },
        ],
      });
      expect(writes.chat.findFirst).toHaveBeenCalledExactlyOnceWith({
        where: { id: "chat", userId: "owner" },
        select: { id: true },
      });
      expect(writes.chat.update).toHaveBeenCalledTimes(1);
    },
  );
  it("hides storage failures during Chat title updates", async () => {
    const client = await connect("owner");
    writes.chat.update.mockRejectedValue(new Error("private database details"));
    expect(
      await client.callTool({
        name: "update_chat_title",
        arguments: chatTitleInput,
      }),
    ).toMatchObject({
      isError: true,
      content: [{ text: "Could not update Chat title. Please try again." }],
    });
  });
  it.each([
    {},
    { ...chatTitleInput, id: "" },
    { ...chatTitleInput, id: "x".repeat(101) },
    { ...chatTitleInput, title: undefined },
    { ...chatTitleInput, title: null },
    { ...chatTitleInput, title: 1 },
    { ...chatTitleInput, title: "" },
    { ...chatTitleInput, title: " \n\t " },
    { ...chatTitleInput, title: "x".repeat(81) },
    { ...chatTitleInput, title: "😀".repeat(81) },
    { ...chatTitleInput, updatedAt: undefined },
    { ...chatTitleInput, updatedAt: "2026-02-30T00:00:00.000Z" },
    { ...chatTitleInput, updatedAt: "2026-11-15T00:00:00Z" },
    { ...chatTitleInput, userId: "other" },
    { ...chatTitleInput, categoryId: null },
    { ...chatTitleInput, messages: [] },
  ])("rejects invalid title-only input %j", async (args) => {
    const client = await connect("owner");
    expect(
      (await client.callTool({ name: "update_chat_title", arguments: args }))
        .isError,
    ).toBe(true);
    expect(writes.chat.update).not.toHaveBeenCalled();
  });
  const chatCategoryInput = {
    id: "chat",
    categoryId: "owned",
    updatedAt: "2026-11-15T00:00:00.000Z",
  };
  it.each([null, "owned"])(
    "changes only a Chat category to %j with ownership and version checks",
    async (categoryId) => {
      const client = await connect("owner");
      const { tools } = await client.listTools();
      const definition = tools.find(
        (tool) => tool.name === "update_chat_category",
      );
      expect(definition?.inputSchema.required?.slice().sort()).toEqual([
        "categoryId",
        "id",
        "updatedAt",
      ]);
      expect(definition?.annotations).toMatchObject({
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
      });
      writes.chat.findFirst.mockResolvedValue({ id: "chat" });
      writes.category.findFirst.mockResolvedValue({ id: "owned" });
      writes.chat.update.mockResolvedValue({
        id: "chat",
        title: null,
        categoryId,
        updatedAt: new Date("2026-11-15T00:00:00.001Z"),
      });
      const clock = vi
        .spyOn(Date, "now")
        .mockReturnValue(new Date(chatCategoryInput.updatedAt).getTime());
      try {
        const result = await client.callTool({
          name: "update_chat_category",
          arguments: { ...chatCategoryInput, categoryId },
        });
        expect(result.isError).toBeFalsy();
        expect(result.structuredContent).toEqual({
          id: "chat",
          title: null,
          categoryId,
          updatedAt: "2026-11-15T00:00:00.001Z",
          url: "https://notes.example/chats/chat",
        });
        expect(writes.chat.update).toHaveBeenCalledExactlyOnceWith({
          where: {
            id: "chat",
            userId: "owner",
            updatedAt: new Date(chatCategoryInput.updatedAt),
          },
          data: { categoryId, updatedAt: new Date("2026-11-15T00:00:00.001Z") },
          select: { id: true, title: true, categoryId: true, updatedAt: true },
        });
        expect(writes.chat.findFirst).toHaveBeenCalledExactlyOnceWith({
          where: { id: "chat", userId: "owner" },
          select: { id: true },
        });
        if (categoryId) {
          expect(writes.category.findFirst).toHaveBeenCalledWith({
            where: { id: "owned", userId: "owner" },
            select: { id: true },
          });
        } else {
          expect(writes.category.findFirst).not.toHaveBeenCalled();
        }
      } finally {
        clock.mockRestore();
      }
    },
  );
  it.each(["missing", "foreign"])(
    "hides a %s Chat before resolving its destination category",
    async (id) => {
      const client = await connect("owner");
      writes.chat.findFirst.mockResolvedValue(null);
      expect(
        await client.callTool({
          name: "update_chat_category",
          arguments: { ...chatCategoryInput, id },
        }),
      ).toMatchObject({
        isError: true,
        content: [{ text: "Chat or category not found." }],
      });
      expect(writes.category.findFirst).not.toHaveBeenCalled();
      expect(writes.chat.update).not.toHaveBeenCalled();
    },
  );
  it("rejects a missing or foreign destination category", async () => {
    const client = await connect("owner");
    writes.chat.findFirst.mockResolvedValue({ id: "chat" });
    writes.category.findFirst.mockResolvedValue(null);
    expect(
      await client.callTool({
        name: "update_chat_category",
        arguments: chatCategoryInput,
      }),
    ).toMatchObject({
      isError: true,
      content: [{ text: "Chat or category not found." }],
    });
    expect(writes.chat.update).not.toHaveBeenCalled();
  });
  it.each([null, { id: "chat" }])(
    "distinguishes a deleted Chat from a concurrent update: %j",
    async (existing) => {
      const client = await connect("owner");
      writes.chat.findFirst
        .mockResolvedValueOnce({ id: "chat" })
        .mockResolvedValueOnce(existing);
      writes.chat.update.mockRejectedValue({ code: "P2025" });
      expect(
        await client.callTool({
          name: "update_chat_category",
          arguments: { ...chatCategoryInput, categoryId: null },
        }),
      ).toMatchObject({
        isError: true,
        content: [
          {
            text: existing
              ? expect.stringContaining("Chat has changed.")
              : "Chat or category not found.",
          },
        ],
      });
      expect(writes.chat.update).toHaveBeenCalledTimes(1);
      expect(writes.chat.findFirst).toHaveBeenLastCalledWith({
        where: { id: "chat", userId: "owner" },
        select: { id: true },
      });
    },
  );
  it("hides storage errors during Chat category updates", async () => {
    const client = await connect("owner");
    writes.chat.findFirst.mockResolvedValue({ id: "chat" });
    writes.chat.update.mockRejectedValue(new Error("private database details"));
    expect(
      await client.callTool({
        name: "update_chat_category",
        arguments: { ...chatCategoryInput, categoryId: null },
      }),
    ).toMatchObject({
      isError: true,
      content: [{ text: "Could not update Chat category. Please try again." }],
    });
  });
  it.each([
    {},
    { ...chatCategoryInput, id: "" },
    { ...chatCategoryInput, id: "x".repeat(101) },
    { ...chatCategoryInput, categoryId: undefined },
    { ...chatCategoryInput, categoryId: "" },
    { ...chatCategoryInput, categoryId: "x".repeat(101) },
    { ...chatCategoryInput, updatedAt: undefined },
    { ...chatCategoryInput, updatedAt: "2026-02-30T00:00:00.000Z" },
    { ...chatCategoryInput, updatedAt: "2026-11-15T00:00:00Z" },
    { ...chatCategoryInput, userId: "other" },
    { ...chatCategoryInput, title: "Changed" },
    { ...chatCategoryInput, messages: [] },
  ])("rejects invalid Chat category input %j", async (args) => {
    const client = await connect("owner");
    expect(
      (await client.callTool({ name: "update_chat_category", arguments: args }))
        .isError,
    ).toBe(true);
    expect(writes.chat.findFirst).not.toHaveBeenCalled();
    expect(writes.chat.update).not.toHaveBeenCalled();
  });
  it("searches saved Chats with bounded defaults, owner filters, previews, and URLs", async () => {
    const client = await connect("owner");
    writes.chat.findMany.mockResolvedValue([
      {
        id: "chat",
        title: null,
        categoryId: null,
        updatedAt: new Date("2026-11-15T00:00:00Z"),
        messages: [{ content: "A **question**" }],
      },
    ]);
    const result = await client.callTool({
      name: "list_chats",
      arguments: { q: "50%_", category: "uncategorized" },
    });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({
      chats: [
        {
          id: "chat",
          title: null,
          categoryId: null,
          updatedAt: "2026-11-15T00:00:00.000Z",
          preview: "A question",
          url: "https://notes.example/chats/chat",
        },
      ],
      nextOffset: null,
    });
    expect(writes.chat.findMany).toHaveBeenCalledExactlyOnceWith({
      where: {
        userId: "owner",
        categoryId: null,
        OR: [
          { title: { contains: "50\\%\\_", mode: "insensitive" } },
          {
            messages: {
              some: { content: { contains: "50\\%\\_", mode: "insensitive" } },
            },
          },
        ],
      },
      select: {
        id: true,
        title: true,
        categoryId: true,
        updatedAt: true,
        messages: {
          where: { role: "user" },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          take: 1,
          select: { content: true },
        },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: 21,
      skip: 0,
    });
  });
  it("returns bounded Chat pages with nextOffset and an empty final page", async () => {
    const client = await connect("owner");
    const chats = ["a", "b", "c"].map((id) => ({
      id,
      title: id,
      messages: [],
    }));
    writes.chat.findMany.mockImplementation(async ({ skip, take }) =>
      chats.slice(skip, skip + take),
    );
    const first = await client.callTool({
      name: "list_chats",
      arguments: { limit: 2 },
    });
    expect(first.structuredContent).toMatchObject({
      chats: [{ id: "a", preview: "" }, { id: "b" }],
      nextOffset: 2,
    });
    expect(first.structuredContent?.chats).toHaveLength(2);
    expect(
      (
        await client.callTool({
          name: "list_chats",
          arguments: { limit: 2, offset: 2 },
        })
      ).structuredContent,
    ).toMatchObject({ chats: [{ id: "c" }], nextOffset: null });
    expect(
      (
        await client.callTool({
          name: "list_chats",
          arguments: { limit: 2, offset: 3 },
        })
      ).structuredContent,
    ).toEqual({ chats: [], nextOffset: null });
  });
  it("reads Chat messages in bounded chronological pages without recovering generation state", async () => {
    const client = await connect("owner");
    const messages = ["user", "assistant", "user"].map((role, index) => ({
      id: `m${index}`,
      role,
      content: `Message ${index}`,
      status: "completed",
      replyToId: null,
      createdAt: new Date("2026-11-15T00:00:00Z"),
    }));
    writes.chat.findFirst.mockImplementation(async ({ select }) => ({
      id: "chat",
      title: "Chat title",
      categoryId: "category",
      updatedAt: new Date("2026-11-15T00:00:00Z"),
      messages: messages.slice(
        select.messages.skip,
        select.messages.skip + select.messages.take,
      ),
    }));
    const first = await client.callTool({
      name: "get_chat",
      arguments: { id: "chat", limit: 2 },
    });
    expect(first.isError).toBeFalsy();
    expect(first.structuredContent).toMatchObject({
      id: "chat",
      url: "https://notes.example/chats/chat",
      updatedAt: "2026-11-15T00:00:00.000Z",
      messages: [
        { id: "m0", role: "user", createdAt: "2026-11-15T00:00:00.000Z" },
        { id: "m1", role: "assistant" },
      ],
      nextOffset: 2,
    });
    expect(first.structuredContent?.messages).toHaveLength(2);
    expect(writes.chat.findFirst).toHaveBeenCalledExactlyOnceWith({
      where: { id: "chat", userId: "owner" },
      select: {
        id: true,
        title: true,
        categoryId: true,
        updatedAt: true,
        messages: {
          select: {
            id: true,
            role: true,
            content: true,
            status: true,
            replyToId: true,
            createdAt: true,
          },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          take: 3,
          skip: 0,
        },
      },
    });
    const last = await client.callTool({
      name: "get_chat",
      arguments: { id: "chat", limit: 2, offset: 2 },
    });
    expect(last.structuredContent).toMatchObject({
      messages: [{ id: "m2" }],
      nextOffset: null,
    });
    const empty = await client.callTool({
      name: "get_chat",
      arguments: { id: "chat", offset: 3 },
    });
    expect(empty.structuredContent).toMatchObject({
      messages: [],
      nextOffset: null,
    });
    expect(writes.chat.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          messages: expect.objectContaining({ take: 21, skip: 3 }),
        }),
      }),
    );
  });
  it.each(["missing", "foreign"])(
    "hides a %s Chat and its messages",
    async (id) => {
      const client = await connect("owner");
      writes.chat.findFirst.mockResolvedValue(null);
      expect(
        await client.callTool({ name: "get_chat", arguments: { id } }),
      ).toMatchObject({
        isError: true,
        content: [{ text: "Chat not found." }],
      });
      expect(writes.chat.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id, userId: "owner" } }),
      );
    },
  );
  it("isolates Chat owners across clients", async () => {
    const [a, b] = await Promise.all([connect("a"), connect("b")]);
    writes.chat.findMany.mockResolvedValue([]);
    writes.chat.findFirst.mockResolvedValue({ id: "chat", messages: [] });
    await Promise.all(
      [a, b].map(async (client) => {
        await client.callTool({ name: "list_chats", arguments: {} });
        await client.callTool({ name: "get_chat", arguments: { id: "chat" } });
      }),
    );
    expect(
      writes.chat.findMany.mock.calls.map(([args]) => args.where.userId).sort(),
    ).toEqual(["a", "b"]);
    expect(
      writes.chat.findFirst.mock.calls
        .map(([args]) => args.where.userId)
        .sort(),
    ).toEqual(["a", "b"]);
  });
  it.each(["list_chats", "get_chat"])(
    "hides storage errors for %s",
    async (name) => {
      const client = await connect("owner");
      writes.chat.findMany.mockRejectedValue(
        new Error("private database details"),
      );
      writes.chat.findFirst.mockRejectedValue(
        new Error("private database details"),
      );
      expect(
        await client.callTool({
          name,
          arguments: name === "get_chat" ? { id: "chat" } : {},
        }),
      ).toMatchObject({
        isError: true,
        content: [
          {
            text:
              name === "get_chat"
                ? "Could not read Chat. Please try again."
                : "Could not read Chats. Please try again.",
          },
        ],
      });
    },
  );
  it.each([
    { limit: 0 },
    { limit: 51 },
    { limit: 1.5 },
    { offset: -1 },
    { offset: 1_000_001 },
    { userId: "other" },
  ])(
    "rejects invalid pagination or ownership for both Chat tools %j",
    async (args) => {
      const client = await connect("owner");
      for (const name of ["list_chats", "get_chat"]) {
        expect(
          (
            await client.callTool({
              name,
              arguments: {
                ...(name === "get_chat" ? { id: "chat" } : {}),
                ...args,
              },
            })
          ).isError,
        ).toBe(true);
      }
      expect(writes.chat.findMany).not.toHaveBeenCalled();
      expect(writes.chat.findFirst).not.toHaveBeenCalled();
    },
  );
  it.each([{}, { id: "" }, { id: "x".repeat(101) }, { id: 1 }])(
    "rejects invalid Chat IDs %j",
    async (args) => {
      const client = await connect("owner");
      expect(
        (await client.callTool({ name: "get_chat", arguments: args })).isError,
      ).toBe(true);
      expect(writes.chat.findFirst).not.toHaveBeenCalled();
    },
  );
  it.each([
    { q: "x".repeat(51) },
    { q: 1 },
    { category: 1 },
    { category: "x".repeat(101) },
  ])("rejects invalid Chat search input %j", async (args) => {
    const client = await connect("owner");
    expect(
      (await client.callTool({ name: "list_chats", arguments: args })).isError,
    ).toBe(true);
    expect(writes.chat.findMany).not.toHaveBeenCalled();
  });
  it.each([0, 3])(
    "reads Category metadata and owner-scoped counts (%s Notes)",
    async (noteCount) => {
      for (const owner of ["a", "b"]) {
        const client = await connect(owner);
        writes.category.findFirst.mockResolvedValue({
          id: "category",
          name: "Nuxt",
          _count: { notes: noteCount, chats: 0 },
        });
        const { tools } = await client.listTools();
        expect(
          tools.find((tool) => tool.name === "get_category")?.annotations,
        ).toMatchObject({ readOnlyHint: true, openWorldHint: false });
        const result = await client.callTool({
          name: "get_category",
          arguments: { id: "category" },
        });
        expect(result.isError).toBeFalsy();
        expect(result.structuredContent).toEqual({
          id: "category",
          name: "Nuxt",
          noteCount,
          chatCount: 0,
        });
        expect(result.content).toEqual([
          {
            type: "text",
            text: JSON.stringify(result.structuredContent, null, 2),
          },
        ]);
        expect(writes.category.findFirst).toHaveBeenLastCalledWith({
          where: { id: "category", userId: owner },
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
      }
      expect(reads.readOwnedNote).not.toHaveBeenCalled();
      expect(reads.searchOwnedNotes).not.toHaveBeenCalled();
    },
  );
  it.each(["missing", "foreign"])("hides a %s Category on read", async (id) => {
    const client = await connect("owner");
    writes.category.findFirst.mockResolvedValue(null);
    expect(
      await client.callTool({ name: "get_category", arguments: { id } }),
    ).toMatchObject({
      isError: true,
      content: [{ text: "Category not found." }],
    });
    expect(writes.category.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id, userId: "owner" } }),
    );
  });
  it("hides storage errors on Category read", async () => {
    const client = await connect("owner");
    writes.category.findFirst.mockRejectedValue(
      new Error("private database details"),
    );
    expect(
      await client.callTool({
        name: "get_category",
        arguments: { id: "category" },
      }),
    ).toMatchObject({
      isError: true,
      content: [{ text: "Could not read Category. Please try again." }],
    });
  });
  it.each([
    {},
    { id: "" },
    { id: "x".repeat(101) },
    { id: null },
    { id: 1 },
    { id: "category", userId: "other" },
  ])("rejects invalid Category read input %j", async (args) => {
    const client = await connect("owner");
    expect(
      (await client.callTool({ name: "get_category", arguments: args }))
        .isError,
    ).toBe(true);
    expect(writes.category.findFirst).not.toHaveBeenCalled();
  });
  it("renames only the token owner's Category using browser normalization", async () => {
    writes.category.updateMany.mockResolvedValue({ count: 1 });
    for (const owner of ["a", "b"]) {
      const client = await connect(owner);
      const { tools } = await client.listTools();
      expect(
        tools.find((tool) => tool.name === "update_category")?.annotations,
      ).toMatchObject({
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      });
      expect(
        await client.callTool({
          name: "update_category",
          arguments: { id: "category", name: "  Ｎｕｘｔ  " },
        }),
      ).toMatchObject({
        structuredContent: { id: "category", name: "Ｎｕｘｔ" },
      });
      expect(writes.category.updateMany).toHaveBeenLastCalledWith({
        where: { id: "category", userId: owner },
        data: { name: "Ｎｕｘｔ", nameKey: "nuxt" },
      });
    }
  });
  it.each([
    {},
    { id: "category" },
    { name: "Nuxt" },
    { id: "", name: "Nuxt" },
    { id: "x".repeat(101), name: "Nuxt" },
    { id: null, name: "Nuxt" },
    { id: "category", name: " " },
    { id: "category", name: "a".repeat(21) },
    { id: "category", name: "😀".repeat(11) },
    { id: "category", name: "ﷺ".repeat(6) },
    { id: "category", name: 123 },
    { id: "category", name: "Nuxt", userId: "other" },
  ])("rejects invalid Category rename arguments %j", async (args) => {
    const client = await connect("owner");
    expect(
      await client.callTool({ name: "update_category", arguments: args }),
    ).toMatchObject({ isError: true });
    expect(writes.category.updateMany).not.toHaveBeenCalled();
  });
  it("reports missing and duplicate Categories and hides rename storage errors", async () => {
    const client = await connect("owner");
    writes.category.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockRejectedValueOnce({ code: "P2002" })
      .mockRejectedValueOnce(new Error("private database details"));
    for (const message of [
      "Category not found.",
      "A Category with this name already exists. Use list_categories to find its ID.",
      "Could not update Category. Please try again.",
    ]) {
      expect(
        await client.callTool({
          name: "update_category",
          arguments: { id: "category", name: "Nuxt" },
        }),
      ).toMatchObject({
        isError: true,
        content: [{ text: message }],
      });
    }
  });
  it("deletes only the token owner's Category and declares destructive behavior", async () => {
    writes.category.deleteMany.mockResolvedValue({ count: 1 });
    for (const owner of ["a", "b"]) {
      const client = await connect(owner);
      const { tools } = await client.listTools();
      expect(
        tools.find((t) => t.name === "delete_category")?.annotations,
      ).toMatchObject({
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      });
      expect(
        await client.callTool({
          name: "delete_category",
          arguments: { id: "category" },
        }),
      ).toMatchObject({
        structuredContent: { id: "category", deleted: true },
      });
      expect(writes.category.deleteMany).toHaveBeenLastCalledWith({
        where: { id: "category", userId: owner },
      });
    }
    expect(writes.note.deleteMany).not.toHaveBeenCalled();
  });
  it.each([
    { id: "" },
    { id: "x".repeat(101) },
    {},
    { id: null },
    { id: "category", userId: "other" },
  ])("rejects invalid Category deletion arguments %j", async (args) => {
    const client = await connect("owner");
    expect(
      await client.callTool({ name: "delete_category", arguments: args }),
    ).toMatchObject({ isError: true });
    expect(writes.category.deleteMany).not.toHaveBeenCalled();
  });
  it("hides missing or foreign Categories and sanitizes deletion errors", async () => {
    const client = await connect("owner");
    writes.category.deleteMany
      .mockResolvedValueOnce({ count: 0 })
      .mockRejectedValueOnce(new Error("private database details"));
    expect(
      await client.callTool({
        name: "delete_category",
        arguments: { id: "foreign" },
      }),
    ).toMatchObject({
      isError: true,
      content: [{ text: "Category not found." }],
    });
    expect(
      await client.callTool({
        name: "delete_category",
        arguments: { id: "category" },
      }),
    ).toMatchObject({
      isError: true,
      content: [{ text: "Could not delete Category. Please try again." }],
    });
  });
  it("creates normalized categories for each token owner and exposes safe annotations", async () => {
    writes.category.create.mockImplementation(async ({ data }) => ({
      id: `${data.userId}-category`,
      name: data.name,
    }));
    for (const owner of ["a", "b"]) {
      const client = await connect(owner);
      const result = await client.callTool({
        name: "create_category",
        arguments: { name: "  Ｎｕｘｔ  " },
      });
      expect(result).toMatchObject({
        structuredContent: { id: `${owner}-category`, name: "Ｎｕｘｔ" },
      });
      expect(writes.category.create).toHaveBeenCalledWith({
        data: { name: "Ｎｕｘｔ", nameKey: "nuxt", userId: owner },
        select: { id: true, name: true },
      });
      const { tools } = await client.listTools();
      expect(
        tools.find((tool) => tool.name === "create_category")?.annotations,
      ).toMatchObject({
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      });
    }
  });
  it.each(["a".repeat(20), "😀".repeat(10)])(
    "accepts a category name at the UTF-16 limit: %s",
    async (name) => {
      writes.category.create.mockResolvedValue({ id: "category", name });
      const client = await connect("owner");
      expect(
        await client.callTool({ name: "create_category", arguments: { name } }),
      ).toMatchObject({
        structuredContent: { id: "category", name },
      });
      expect(writes.category.create).toHaveBeenCalledWith({
        data: {
          name,
          nameKey: name.normalize("NFKC").toLowerCase(),
          userId: "owner",
        },
        select: { id: true, name: true },
      });
      const { tools } = await client.listTools();
      expect(
        tools.find((tool) => tool.name === "create_category")?.inputSchema,
      ).toMatchObject({
        type: "object",
        required: ["name"],
        additionalProperties: false,
        properties: { name: { type: "string", maxLength: 20 } },
      });
    },
  );
  it.each([
    {},
    { name: " " },
    { name: "a".repeat(21) },
    { name: "😀".repeat(11) },
    { name: "ﷺ".repeat(6) },
    { name: 123 },
    { name: "Nuxt", userId: "other" },
    { name: "Nuxt", id: "chosen" },
  ])("rejects invalid category creation arguments %j", async (args) => {
    const client = await connect("owner");
    expect(
      await client.callTool({ name: "create_category", arguments: args }),
    ).toMatchObject({ isError: true });
    expect(writes.category.create).not.toHaveBeenCalled();
  });
  it("reports duplicate categories and hides database errors", async () => {
    const client = await connect("owner");
    writes.category.create
      .mockRejectedValueOnce({ code: "P2002" })
      .mockRejectedValueOnce(new Error("private database details"));
    expect(
      await client.callTool({
        name: "create_category",
        arguments: { name: "Nuxt" },
      }),
    ).toMatchObject({
      isError: true,
      content: [
        {
          text: "A Category with this name already exists. Use list_categories to find its ID.",
        },
      ],
    });
    expect(
      await client.callTool({
        name: "create_category",
        arguments: { name: "Nuxt" },
      }),
    ).toMatchObject({
      isError: true,
      content: [{ text: "Could not create Category. Please try again." }],
    });
  });
  it("lists all categories, including empty categories, scoped to each token owner", async () => {
    writes.category.findMany.mockImplementation(async ({ where }) => [
      { id: `${where.userId}-category`, name: "Empty category" },
    ]);
    const [a, b] = await Promise.all([connect("a"), connect("b")]);
    const [first, second] = await Promise.all(
      [a, b].map((client) =>
        client.callTool({ name: "list_categories", arguments: {} }),
      ),
    );
    expect(first.structuredContent).toEqual({
      categories: [{ id: "a-category", name: "Empty category" }],
    });
    expect(second.structuredContent).toEqual({
      categories: [{ id: "b-category", name: "Empty category" }],
    });
    expect(writes.category.findMany).toHaveBeenCalledWith({
      where: { userId: "a" },
      orderBy: [{ nameKey: "asc" }, { id: "asc" }],
      select: { id: true, name: true },
    });
    const { tools } = await a.listTools();
    expect(
      tools.find((t) => t.name === "list_categories")?.annotations,
    ).toMatchObject({ readOnlyHint: true, openWorldHint: false });
  });
  it("returns empty categories and sanitizes list failures", async () => {
    const client = await connect("owner");
    writes.category.findMany
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error("private database details"));
    expect(
      await client.callTool({ name: "list_categories", arguments: {} }),
    ).toMatchObject({ structuredContent: { categories: [] } });
    expect(
      await client.callTool({ name: "list_categories", arguments: {} }),
    ).toMatchObject({
      isError: true,
      content: [{ text: "Could not read Categories. Please try again." }],
    });
  });
  it("rejects owner injection into category listing", async () => {
    const client = await connect("owner");
    expect(
      (
        await client.callTool({
          name: "list_categories",
          arguments: { userId: "other" },
        })
      ).isError,
    ).toBe(true);
    expect(writes.category.findMany).not.toHaveBeenCalled();
  });
  it("discovers read and write tools and supplies bounded search defaults", async () => {
    const client = await connect("owner");
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "create_category",
      "create_note",
      "delete_category",
      "delete_chat",
      "delete_note",
      "get_category",
      "get_chat",
      "get_note",
      "list_categories",
      "list_chats",
      "list_notes",
      "merge_categories",
      "move_category_chats",
      "move_category_notes",
      "update_category",
      "update_chat_category",
      "update_chat_title",
      "update_note",
      "update_note_category",
      "update_note_title",
    ]);
    expect(
      tools
        .filter((t) =>
          [
            "get_category",
            "get_chat",
            "get_note",
            "list_categories",
            "list_chats",
            "list_notes",
          ].includes(t.name),
        )
        .every((t) => t.annotations?.readOnlyHint),
    ).toBe(true);
    await client.callTool({ name: "list_notes", arguments: { q: "Nuxt" } });
    expect(reads.searchOwnedNotes).toHaveBeenCalledWith("owner", {
      q: "Nuxt",
      limit: 20,
      offset: 0,
    });
  });
  it("exposes create for every token and stores content for the token owner", async () => {
    const client = await connect("owner", "https://my-notes.example/");
    const { tools } = await client.listTools();
    expect(
      tools.find((t) => t.name === "create_note")?.annotations,
    ).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    });
    writes.note.create.mockResolvedValue({
      id: "new",
      title: "Untitled note",
      markdown: "# Saved",
      categoryId: null,
      createdAt: new Date("2026-11-13T00:00:00Z"),
    });
    const result = await client.callTool({
      name: "create_note",
      arguments: { title: "  ", markdown: "# Saved" },
    });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({
      id: "new",
      url: "https://my-notes.example/notes/new",
      title: "Untitled note",
      createdAt: "2026-11-13T00:00:00.000Z",
    });
    expect(result.content).toEqual([
      { type: "text", text: JSON.stringify(result.structuredContent, null, 2) },
    ]);
    expect(writes.note.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          title: "Untitled note",
          markdown: "# Saved",
          categoryId: null,
          userId: "owner",
        },
      }),
    );
  });
  it.each([
    {},
    { title: "New" },
    { title: 1, markdown: "" },
    { title: "x".repeat(51), markdown: "" },
    { title: "New", markdown: "あ".repeat(5001) },
    { title: "New", markdown: "", categoryId: "" },
    { title: "New", markdown: "", userId: "other" },
    { title: "New", markdown: "", id: "existing" },
  ])("rejects invalid create arguments %j", async (args) => {
    const client = await connect("owner");
    expect(
      (await client.callTool({ name: "create_note", arguments: args })).isError,
    ).toBe(true);
    expect(writes.note.create).not.toHaveBeenCalled();
  });
  it("validates category ownership before creating and hides storage errors", async () => {
    const client = await connect("owner");
    const call = () =>
      client.callTool({
        name: "create_note",
        arguments: { title: "New", markdown: "", categoryId: "category" },
      });
    writes.category.findFirst.mockResolvedValue(null);
    expect(await call()).toMatchObject({
      isError: true,
      content: [{ text: "Category not found." }],
    });
    expect(writes.category.findFirst).toHaveBeenCalledWith({
      where: { id: "category", userId: "owner" },
      select: { id: true },
    });
    expect(writes.note.create).not.toHaveBeenCalled();
    writes.category.findFirst.mockResolvedValue({ id: "category" });
    writes.note.create.mockResolvedValue({ id: "new" });
    expect((await call()).isError).toBeFalsy();
    expect(writes.note.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          title: "New",
          markdown: "",
          categoryId: "category",
          userId: "owner",
        },
      }),
    );
    writes.note.create.mockRejectedValue(new Error("private database details"));
    const result = await call();
    expect(result).toMatchObject({
      isError: true,
      content: [{ text: "Could not create Note. Please try again." }],
    });
    expect(JSON.stringify(result)).not.toContain("private database details");
  });
  const updateInput = {
    id: "note",
    title: "  Updated  ",
    markdown: "# Changed",
    updatedAt: "2026-11-13T00:00:00.000Z",
  };
  it("updates only the owner and expected version and returns the saved Note URL", async () => {
    const client = await connect("owner", "https://my-notes.example/");
    writes.note.update.mockResolvedValue({
      id: "note",
      title: "Updated",
      markdown: "# Changed",
      categoryId: "existing",
      createdAt: new Date("2026-11-12T00:00:00Z"),
      updatedAt: new Date("2026-11-13T00:00:01Z"),
    });
    const { tools } = await client.listTools();
    expect(
      tools.find((t) => t.name === "update_note")?.annotations,
    ).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    });
    const result = await client.callTool({
      name: "update_note",
      arguments: updateInput,
    });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({
      title: "Updated",
      markdown: "# Changed",
      categoryId: "existing",
      updatedAt: "2026-11-13T00:00:01.000Z",
      url: "https://my-notes.example/notes/note",
    });
    const args = writes.note.update.mock.calls[0]![0];
    expect(args.where).toEqual({
      id: "note",
      userId: "owner",
      updatedAt: new Date(updateInput.updatedAt),
    });
    expect(args.data).toEqual({
      title: "Updated",
      markdown: "# Changed",
      updatedAt: expect.any(Date),
    });
    expect(args.data.updatedAt.getTime()).toBeGreaterThan(
      new Date(updateInput.updatedAt).getTime(),
    );
    expect(args.select).not.toHaveProperty("userId");
    expect(writes.category.findFirst).not.toHaveBeenCalled();
  });
  it("advances the version even when the clock has not moved forward", async () => {
    const client = await connect("owner");
    const expectedTime = new Date(updateInput.updatedAt).getTime();
    const clock = vi.spyOn(Date, "now").mockReturnValue(expectedTime);
    writes.note.update.mockResolvedValue({ id: "note" });
    try {
      await client.callTool({ name: "update_note", arguments: updateInput });
      expect(writes.note.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            updatedAt: new Date(expectedTime + 1),
          }),
        }),
      );
    } finally {
      clock.mockRestore();
    }
  });
  it.each([null, "owned"])(
    "updates an explicit category %j",
    async (categoryId) => {
      const client = await connect("owner");
      writes.category.findFirst.mockResolvedValue({ id: "owned" });
      writes.note.update.mockResolvedValue({ id: "note" });
      expect(
        (
          await client.callTool({
            name: "update_note",
            arguments: { ...updateInput, categoryId },
          })
        ).isError,
      ).toBeFalsy();
      expect(writes.note.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ categoryId }),
        }),
      );
      if (categoryId) {
        expect(writes.category.findFirst).toHaveBeenCalledWith({
          where: { id: "owned", userId: "owner" },
          select: { id: true },
        });
      }
    },
  );
  it("rejects missing and foreign categories before writing", async () => {
    const client = await connect("owner");
    writes.category.findFirst.mockResolvedValue(null);
    const result = await client.callTool({
      name: "update_note",
      arguments: { ...updateInput, categoryId: "foreign" },
    });
    expect(result).toMatchObject({
      isError: true,
      content: [{ text: "Note or category not found." }],
    });
    expect(writes.note.update).not.toHaveBeenCalled();
  });
  it.each(["missing", "foreign"])("hides a %s Note on update", async (id) => {
    const client = await connect("owner");
    writes.note.update.mockRejectedValue({ code: "P2025" });
    writes.note.findFirst.mockResolvedValue(null);
    expect(
      await client.callTool({
        name: "update_note",
        arguments: { ...updateInput, id },
      }),
    ).toMatchObject({
      isError: true,
      content: [{ text: "Note or category not found." }],
    });
    expect(writes.note.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id,
          userId: "owner",
          updatedAt: new Date(updateInput.updatedAt),
        },
      }),
    );
    expect(writes.note.findFirst).toHaveBeenCalledWith({
      where: { id, userId: "owner" },
      select: { id: true },
    });
  });
  it("rejects stale updates and hides database failures", async () => {
    const client = await connect("owner");
    writes.note.update.mockRejectedValueOnce({ code: "P2025" });
    writes.note.findFirst.mockResolvedValue({ id: "note" });
    const result = await client.callTool({
      name: "update_note",
      arguments: updateInput,
    });
    expect(result).toMatchObject({
      isError: true,
      content: [{ text: expect.stringContaining("Note has changed.") }],
    });
    expect(writes.note.update).toHaveBeenCalledTimes(1);
    writes.note.update.mockRejectedValueOnce(
      new Error("private database details"),
    );
    expect(
      await client.callTool({ name: "update_note", arguments: updateInput }),
    ).toMatchObject({
      isError: true,
      content: [{ text: "Could not update Note. Please try again." }],
    });
  });
  it.each([
    {},
    { ...updateInput, id: "" },
    { ...updateInput, title: "x".repeat(51) },
    { ...updateInput, markdown: "x".repeat(5001) },
    { ...updateInput, updatedAt: undefined },
    { ...updateInput, updatedAt: "not-a-date" },
    { ...updateInput, updatedAt: "2026-02-30T00:00:00.000Z" },
    { ...updateInput, categoryId: "" },
    { ...updateInput, userId: "other" },
    { ...updateInput, extra: true },
  ])("rejects invalid update arguments %j", async (args) => {
    const client = await connect("owner");
    expect(
      (await client.callTool({ name: "update_note", arguments: args })).isError,
    ).toBe(true);
    expect(writes.note.update).not.toHaveBeenCalled();
  });
  it("keeps concurrent update owners separate", async () => {
    const [a, b] = await Promise.all([connect("a"), connect("b")]);
    writes.note.update.mockResolvedValue({ id: "note" });
    await Promise.all(
      [a, b].map((client) =>
        client.callTool({ name: "update_note", arguments: updateInput }),
      ),
    );
    expect(
      writes.note.update.mock.calls.map(([args]) => args.where.userId).sort(),
    ).toEqual(["a", "b"]);
  });
  const categoryInput = {
    id: "note",
    categoryId: "owned",
    updatedAt: "2026-11-13T00:00:00.000Z",
  };
  it.each([null, "owned"])(
    "changes only the category to %j without selecting the body",
    async (categoryId) => {
      const client = await connect("owner");
      const { tools } = await client.listTools();
      const definition = tools.find(
        (tool) => tool.name === "update_note_category",
      );
      expect(definition?.inputSchema.required?.slice().sort()).toEqual([
        "categoryId",
        "id",
        "updatedAt",
      ]);
      expect(definition?.annotations).toMatchObject({
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
      });
      writes.category.findFirst.mockResolvedValue({ id: "owned" });
      writes.note.update.mockResolvedValue({
        id: "note",
        title: "Title",
        categoryId,
        updatedAt: new Date("2026-11-13T00:00:00.001Z"),
      });
      const clock = vi
        .spyOn(Date, "now")
        .mockReturnValue(new Date(categoryInput.updatedAt).getTime());
      try {
        const result = await client.callTool({
          name: "update_note_category",
          arguments: { ...categoryInput, categoryId },
        });
        expect(result.isError).toBeFalsy();
        expect(result.structuredContent).toMatchObject({
          categoryId,
          url: "https://notes.example/notes/note",
          updatedAt: "2026-11-13T00:00:00.001Z",
        });
        expect(writes.note.update).toHaveBeenCalledExactlyOnceWith({
          where: {
            id: "note",
            userId: "owner",
            updatedAt: new Date(categoryInput.updatedAt),
          },
          data: { categoryId, updatedAt: new Date("2026-11-13T00:00:00.001Z") },
          select: {
            id: true,
            title: true,
            categoryId: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        if (categoryId) {
          expect(writes.category.findFirst).toHaveBeenCalledWith({
            where: { id: categoryId, userId: "owner" },
            select: { id: true },
          });
        } else {
          expect(writes.category.findFirst).not.toHaveBeenCalled();
        }
        expect(reads.readOwnedNote).not.toHaveBeenCalled();
        expect(writes.note.findFirst).not.toHaveBeenCalled();
      } finally {
        clock.mockRestore();
      }
    },
  );
  it("rejects a foreign category before updating a Note category", async () => {
    const client = await connect("owner");
    writes.category.findFirst.mockResolvedValue(null);
    expect(
      await client.callTool({
        name: "update_note_category",
        arguments: categoryInput,
      }),
    ).toMatchObject({
      isError: true,
      content: [{ text: "Note or category not found." }],
    });
    expect(writes.note.update).not.toHaveBeenCalled();
  });
  it.each([null, { id: "note" }])(
    "distinguishes inaccessible Notes from category update conflicts: %j",
    async (existing) => {
      const client = await connect("owner");
      writes.note.update.mockRejectedValue({ code: "P2025" });
      writes.note.findFirst.mockResolvedValue(existing);
      expect(
        await client.callTool({
          name: "update_note_category",
          arguments: { ...categoryInput, categoryId: null },
        }),
      ).toMatchObject({
        isError: true,
        content: [
          {
            text: existing
              ? expect.stringContaining("Note has changed.")
              : "Note or category not found.",
          },
        ],
      });
      expect(writes.note.update).toHaveBeenCalledTimes(1);
      expect(writes.note.findFirst).toHaveBeenCalledWith({
        where: { id: "note", userId: "owner" },
        select: { id: true },
      });
    },
  );
  it("hides storage errors during category-only updates", async () => {
    const client = await connect("owner");
    writes.note.update.mockRejectedValue(new Error("private database details"));
    expect(
      await client.callTool({
        name: "update_note_category",
        arguments: { ...categoryInput, categoryId: null },
      }),
    ).toMatchObject({
      isError: true,
      content: [{ text: "Could not update Note category. Please try again." }],
    });
  });
  it.each([
    {},
    { ...categoryInput, categoryId: undefined },
    { ...categoryInput, categoryId: "" },
    { ...categoryInput, categoryId: "x".repeat(101) },
    { ...categoryInput, categoryId: 1 },
    { ...categoryInput, id: "" },
    { ...categoryInput, updatedAt: undefined },
    { ...categoryInput, updatedAt: "2026-02-30T00:00:00.000Z" },
    { ...categoryInput, title: "Changed" },
    { ...categoryInput, markdown: "Changed" },
    { ...categoryInput, userId: "other" },
  ])("rejects invalid category-only update input %j", async (args) => {
    const client = await connect("owner");
    expect(
      (await client.callTool({ name: "update_note_category", arguments: args }))
        .isError,
    ).toBe(true);
    expect(writes.note.update).not.toHaveBeenCalled();
  });
  const deleteInput = {
    id: "note",
    updatedAt: "2026-11-13T00:00:00.000Z",
  };
  it("deletes only the owner and expected version without returning content", async () => {
    const client = await connect("owner");
    const { tools } = await client.listTools();
    expect(
      tools.find((t) => t.name === "delete_note")?.annotations,
    ).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    });
    writes.note.deleteMany.mockResolvedValue({ count: 1 });
    const result = await client.callTool({
      name: "delete_note",
      arguments: deleteInput,
    });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({ id: "note", deleted: true });
    expect(result.content).toEqual([
      { type: "text", text: JSON.stringify(result.structuredContent, null, 2) },
    ]);
    expect(writes.note.deleteMany).toHaveBeenCalledExactlyOnceWith({
      where: {
        id: "note",
        userId: "owner",
        updatedAt: new Date(deleteInput.updatedAt),
      },
    });
    expect(writes.note.findFirst).not.toHaveBeenCalled();
  });
  it.each(["missing", "foreign", "already-deleted"])(
    "hides a %s Note on deletion",
    async (id) => {
      const client = await connect("owner");
      writes.note.deleteMany.mockResolvedValue({ count: 0 });
      writes.note.findFirst.mockResolvedValue(null);
      expect(
        await client.callTool({
          name: "delete_note",
          arguments: { ...deleteInput, id },
        }),
      ).toMatchObject({
        isError: true,
        content: [{ text: "Note not found." }],
      });
      expect(writes.note.deleteMany).toHaveBeenCalledExactlyOnceWith({
        where: {
          id,
          userId: "owner",
          updatedAt: new Date(deleteInput.updatedAt),
        },
      });
      expect(writes.note.findFirst).toHaveBeenCalledWith({
        where: { id, userId: "owner" },
        select: { id: true },
      });
    },
  );
  it("requires user confirmation after a deletion conflict without retrying", async () => {
    const client = await connect("owner");
    writes.note.deleteMany.mockResolvedValue({ count: 0 });
    writes.note.findFirst.mockResolvedValue({ id: "note" });
    const result = await client.callTool({
      name: "delete_note",
      arguments: deleteInput,
    });
    expect(result).toMatchObject({
      isError: true,
      content: [
        { text: expect.stringContaining("ask the user to confirm deletion") },
      ],
    });
    expect(writes.note.deleteMany).toHaveBeenCalledTimes(1);
  });
  it.each(["delete", "lookup"])(
    "hides database failures during deletion %s",
    async (stage) => {
      const client = await connect("owner");
      const error = new Error("private database details");
      if (stage === "delete") {
        writes.note.deleteMany.mockRejectedValue(error);
      } else {
        writes.note.deleteMany.mockResolvedValue({ count: 0 });
        writes.note.findFirst.mockRejectedValue(error);
      }
      const result = await client.callTool({
        name: "delete_note",
        arguments: deleteInput,
      });
      expect(result).toMatchObject({
        isError: true,
        content: [{ text: "Could not delete Note. Please try again." }],
      });
      expect(JSON.stringify(result)).not.toContain("private database details");
    },
  );
  it.each([
    {},
    { updatedAt: deleteInput.updatedAt },
    { ...deleteInput, id: "" },
    { ...deleteInput, id: "x".repeat(101) },
    { ...deleteInput, id: 1 },
    { id: "note" },
    { ...deleteInput, updatedAt: "not-a-date" },
    { ...deleteInput, updatedAt: "2026-02-30T00:00:00.000Z" },
    { ...deleteInput, updatedAt: "2026-11-13T00:00:00Z" },
    { ...deleteInput, userId: "other" },
    { ...deleteInput, confirm: true },
  ])("rejects invalid delete arguments %j", async (args) => {
    const client = await connect("owner");
    expect(
      (await client.callTool({ name: "delete_note", arguments: args })).isError,
    ).toBe(true);
    expect(writes.note.deleteMany).not.toHaveBeenCalled();
    expect(writes.note.findFirst).not.toHaveBeenCalled();
  });
  it("keeps concurrent deletion owners separate", async () => {
    const [a, b] = await Promise.all([connect("a"), connect("b")]);
    writes.note.deleteMany.mockResolvedValue({ count: 1 });
    await Promise.all(
      [a, b].map((client) =>
        client.callTool({ name: "delete_note", arguments: deleteInput }),
      ),
    );
    expect(
      writes.note.deleteMany.mock.calls
        .map(([args]) => args.where.userId)
        .sort(),
    ).toEqual(["a", "b"]);
  });
  it("keeps concurrent creation owners separate", async () => {
    const [a, b] = await Promise.all([connect("a"), connect("b")]);
    writes.note.create.mockResolvedValue({ id: "new" });
    await Promise.all(
      [a, b].map((c) =>
        c.callTool({
          name: "create_note",
          arguments: { title: "New", markdown: "" },
        }),
      ),
    );
    expect(
      writes.note.create.mock.calls.map(([args]) => args.data.userId).sort(),
    ).toEqual(["a", "b"]);
  });
  it("keeps concurrent owners separate and serializes dates", async () => {
    const [a, b] = await Promise.all([connect("a"), connect("b")]);
    const results = await Promise.all([
      a.callTool({ name: "get_note", arguments: { id: "note" } }),
      b.callTool({ name: "get_note", arguments: { id: "note" } }),
    ]);
    expect(reads.readOwnedNote).toHaveBeenCalledWith("a", "note");
    expect(reads.readOwnedNote).toHaveBeenCalledWith("b", "note");
    expect(results[0]?.structuredContent?.updatedAt).toBe(
      "2026-11-13T00:00:00.000Z",
    );
  });
  it.each([
    { limit: 51 },
    { offset: -1 },
    { q: "x".repeat(51) },
    { category: 123 },
  ])("rejects invalid search input %j", async (args) => {
    const client = await connect("owner");
    const result = await client.callTool({
      name: "list_notes",
      arguments: args,
    });
    expect(result.isError).toBe(true);
    expect(reads.searchOwnedNotes).not.toHaveBeenCalled();
  });
  it("sanitizes storage errors and distinguishes missing notes", async () => {
    const client = await connect("owner");
    reads.readOwnedNote.mockRejectedValueOnce({ statusCode: 404 });
    expect(
      await client.callTool({ name: "get_note", arguments: { id: "missing" } }),
    ).toMatchObject({
      isError: true,
      content: [{ type: "text", text: "Note not found." }],
    });
    reads.readOwnedNote.mockRejectedValueOnce(
      new Error("private connection information"),
    );
    const result = await client.callTool({
      name: "get_note",
      arguments: { id: "note" },
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).not.toContain(
      "private connection information",
    );
  });
});

const config = { siteUrl: "https://notes.example", allowedOrigins: "" };
describe("MCP HTTP boundary", () => {
  it("accepts native clients without Origin and same-site browser clients", () => {
    expect(
      validateMcpRequest(new Request("https://notes.example/mcp"), config),
    ).toBeNull();
    expect(
      validateMcpRequest(
        new Request("https://notes.example/mcp", {
          headers: { Origin: "https://notes.example" },
        }),
        config,
      ),
    ).toBe("https://notes.example");
  });
  it.each([
    "https://evil.example",
    "null",
    "https://notes.example.evil.example",
  ])("rejects foreign origins: %s", (origin) => {
    expect(() =>
      validateMcpRequest(
        new Request("https://notes.example/mcp", {
          headers: { Origin: origin },
        }),
        config,
      ),
    ).toThrow();
  });
  it("rejects DNS rebinding hosts while permitting loopback development", () => {
    expect(() =>
      validateMcpRequest(new Request("http://evil.example:3001/mcp"), config),
    ).toThrow();
    expect(
      validateMcpRequest(
        new Request("http://localhost:3001/mcp", {
          headers: { Origin: "http://localhost:3001" },
        }),
        config,
      ),
    ).toBe("http://localhost:3001");
  });
  it("allows configured browser origins and the trusted Vercel deployment host", () => {
    expect(
      validateMcpRequest(
        new Request("https://preview.vercel.app/mcp", {
          headers: { Origin: "https://inspector.example" },
        }),
        {
          ...config,
          deploymentUrl: "preview.vercel.app",
          allowedOrigins: "https://inspector.example",
        },
      ),
    ).toBe("https://inspector.example");
  });
});
