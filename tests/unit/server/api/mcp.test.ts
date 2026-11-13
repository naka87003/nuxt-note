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
  note: { create: vi.fn() },
  category: { findFirst: vi.fn() },
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
async function connect(owner: string) {
  const handler = createMcpHandler(() => createRemoteNotesServer(owner), {
    responseMode: "json",
    maxSubscriptions: 0,
  });
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
  it("discovers read and create tools and supplies bounded search defaults", async () => {
    const client = await connect("owner");
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "create_note",
      "get_note",
      "list_notes",
    ]);
    expect(
      tools
        .filter((t) => t.name !== "create_note")
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
    const client = await connect("owner");
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
      title: "Untitled note",
      createdAt: "2026-11-13T00:00:00.000Z",
    });
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
