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
  it("discovers only read-only tools and supplies bounded search defaults", async () => {
    const client = await connect("owner");
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["get_note", "list_notes"]);
    expect(tools.every((t) => t.annotations?.readOnlyHint)).toBe(true);
    await client.callTool({ name: "list_notes", arguments: { q: "Nuxt" } });
    expect(reads.searchOwnedNotes).toHaveBeenCalledWith("owner", {
      q: "Nuxt",
      limit: 20,
      offset: 0,
    });
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
