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
    deleteMany: vi.fn(),
  },
}));
vi.mock("../../../../server/utils/prisma", () => ({ getPrisma: () => writes }));
const clients: Client[] = [];
const handlers: ReturnType<typeof createMcpHandler>[] = [];
beforeEach(() => {
  vi.resetAllMocks();
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
      "delete_note",
      "get_note",
      "list_categories",
      "list_notes",
      "update_note",
    ]);
    expect(
      tools
        .filter((t) =>
          ["get_note", "list_categories", "list_notes"].includes(t.name),
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
      if (categoryId)
        expect(writes.category.findFirst).toHaveBeenCalledWith({
          where: { id: "owned", userId: "owner" },
          select: { id: true },
        });
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
      if (stage === "delete") writes.note.deleteMany.mockRejectedValue(error);
      else {
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
