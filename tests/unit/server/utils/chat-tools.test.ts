import { beforeEach, describe, expect, it, vi } from "vitest";
import { stepCountIs, streamText } from "ai";
import { MockLanguageModelV4, simulateReadableStream } from "ai/test";
import {
  CHAT_NOTES_INSTRUCTIONS,
  createChatNoteTools,
} from "../../../../server/utils/chat-tools";

const reads = vi.hoisted(() => ({
  searchOwnedNotes: vi.fn(),
  readOwnedNote: vi.fn(),
}));
const writes = vi.hoisted(() => ({
  createOwnedNote: vi.fn(),
  updateOwnedNote: vi.fn(),
  deleteOwnedNote: vi.fn(),
}));
vi.mock("../../../../server/utils/note-reads", () => reads);
vi.mock("../../../../server/utils/note-writes", () => writes);
const version = "2026-11-13T00:00:00.000Z";
const note = {
  id: "note",
  title: "Title",
  markdown: "# Note",
  updatedAt: new Date(version),
};
const input = { id: "note", updatedAt: version };
const update = { ...input, title: "Updated", markdown: "# Changed" };
const context = { toolCallId: "call", messages: [] };
const categories = vi.hoisted(() => ({
  findMany: vi.fn(),
  create: vi.fn(),
  deleteMany: vi.fn(),
}));
vi.mock("../../../../server/utils/prisma", () => ({
  getPrisma: () => ({ category: categories }),
}));
function setup(
  owner = "owner",
  allowMutations = true,
  categoryId?: string | null,
) {
  const controller = new AbortController();
  const assertActive = vi.fn().mockResolvedValue(undefined);
  const tools = createChatNoteTools(owner, "https://notes.example", {
    signal: controller.signal,
    assertActive,
    allowMutations,
    categoryId,
  });
  return { tools, controller, assertActive };
}
beforeEach(() => {
  vi.resetAllMocks();
  reads.searchOwnedNotes.mockResolvedValue({ notes: [], nextOffset: null });
  reads.readOwnedNote.mockResolvedValue(note);
  writes.createOwnedNote.mockResolvedValue(note);
  writes.updateOwnedNote.mockResolvedValue(note);
  writes.deleteOwnedNote.mockResolvedValue({ id: "note", deleted: true });
});
describe("in-app Note tools", () => {
  it("deletes a Category for the active session owner", async () => {
    categories.deleteMany.mockResolvedValue({ count: 1 });
    const { tools, assertActive } = setup("owner");
    expect(
      await tools.delete_category!.execute!({ id: "category" }, context),
    ).toMatchObject({
      structuredContent: { id: "category", deleted: true },
    });
    expect(categories.deleteMany).toHaveBeenCalledWith({
      where: { id: "category", userId: "owner" },
    });
    expect(assertActive).toHaveBeenCalledOnce();
  });
  it("clears a successfully deleted Chat category before creating another Note in the same turn", async () => {
    categories.deleteMany.mockResolvedValue({ count: 1 });
    writes.createOwnedNote.mockImplementation(async (_owner, input) => {
      if (input.categoryId === "chat-category")
        throw Object.assign(new Error(), { statusCode: 404 });
      return { ...note, categoryId: input.categoryId ?? null };
    });
    const { tools } = setup("owner", true, "chat-category");
    await tools.delete_category!.execute!({ id: "chat-category" }, context);
    expect(
      await tools.create_note!.execute!(
        { title: "Title", markdown: "Body" },
        context,
      ),
    ).toMatchObject({
      structuredContent: { categoryId: null },
    });
    expect(writes.createOwnedNote).toHaveBeenLastCalledWith("owner", {
      title: "Title",
      markdown: "Body",
    });
    await tools.create_note!.execute!(
      { title: "Explicit", markdown: "Body", categoryId: "other" },
      context,
    );
    expect(writes.createOwnedNote).toHaveBeenLastCalledWith("owner", {
      title: "Explicit",
      markdown: "Body",
      categoryId: "other",
    });
  });
  it.each([
    ["other", 1],
    ["chat-category", 0],
  ])(
    "keeps the Chat category after deletion of %s with count %s",
    async (id, count) => {
      categories.deleteMany.mockResolvedValue({ count });
      const { tools } = setup("owner", true, "chat-category");
      await tools.delete_category!.execute!({ id }, context);
      await tools.create_note!.execute!(
        { title: "Title", markdown: "Body" },
        context,
      );
      expect(writes.createOwnedNote).toHaveBeenCalledWith("owner", {
        title: "Title",
        markdown: "Body",
        categoryId: "chat-category",
      });
    },
  );
  it("validates Category deletion and stops after cancellation or ownership loss", async () => {
    const { tools, controller } = setup();
    await expect(
      tools.delete_category!.execute!(
        { id: "category", userId: "other" } as never,
        context,
      ),
    ).rejects.toThrow();
    await expect(
      tools.delete_category!.execute!({ id: "" }, context),
    ).rejects.toThrow();
    controller.abort();
    await expect(
      tools.delete_category!.execute!({ id: "category" }, context),
    ).rejects.toThrow();
    const inactive = setup();
    inactive.assertActive.mockRejectedValue(new Error("no longer active"));
    await expect(
      inactive.tools.delete_category!.execute!({ id: "category" }, context),
    ).rejects.toThrow();
    expect(categories.deleteMany).not.toHaveBeenCalled();
  });
  it("creates a category and uses its ID for a Note ahead of the chat default", async () => {
    categories.create.mockResolvedValue({
      id: "new-category",
      name: "Ｎｕｘｔ",
    });
    const { tools, assertActive } = setup("owner", true, "chat-category");
    expect(
      await tools.create_category!.execute!({ name: "  Ｎｕｘｔ  " }, context),
    ).toMatchObject({
      structuredContent: { id: "new-category", name: "Ｎｕｘｔ" },
    });
    expect(categories.create).toHaveBeenCalledWith({
      data: { name: "Ｎｕｘｔ", nameKey: "nuxt", userId: "owner" },
      select: { id: true, name: true },
    });
    await tools.create_note!.execute!(
      { title: "Title", markdown: "Body", categoryId: "new-category" },
      context,
    );
    expect(writes.createOwnedNote).toHaveBeenCalledWith("owner", {
      title: "Title",
      markdown: "Body",
      categoryId: "new-category",
    });
    expect(assertActive).toHaveBeenCalledTimes(2);
  });
  it("validates category creation and stops after cancellation or ownership loss", async () => {
    const { tools, controller } = setup();
    await expect(
      tools.create_category!.execute!(
        { name: "Nuxt", userId: "other" } as never,
        context,
      ),
    ).rejects.toThrow();
    await expect(
      tools.create_category!.execute!({ name: " " }, context),
    ).rejects.toThrow();
    controller.abort();
    await expect(
      tools.create_category!.execute!({ name: "Nuxt" }, context),
    ).rejects.toThrow();
    const inactive = setup();
    inactive.assertActive.mockRejectedValue(new Error("no longer active"));
    await expect(
      inactive.tools.create_category!.execute!({ name: "Nuxt" }, context),
    ).rejects.toThrow();
    expect(categories.create).not.toHaveBeenCalled();
  });
  it("lists existing categories for the session owner even during retries", async () => {
    categories.findMany.mockResolvedValue([{ id: "empty", name: "Empty" }]);
    const { tools, assertActive } = setup("owner", false);
    expect(await tools.list_categories.execute!({}, context)).toMatchObject({
      structuredContent: { categories: [{ id: "empty", name: "Empty" }] },
    });
    expect(assertActive).toHaveBeenCalledOnce();
    expect(categories.findMany).toHaveBeenCalledWith({
      where: { userId: "owner" },
      orderBy: [{ nameKey: "asc" }, { id: "asc" }],
      select: { id: true, name: true },
    });
  });
  it.each([
    [undefined, "chat-category"],
    ["explicit", "explicit"],
    [null, null],
  ])(
    "preserves an explicit category %j before the chat default",
    async (categoryId, expected) => {
      const { tools } = setup("owner", true, "chat-category");
      await tools.create_note!.execute!(
        {
          title: "Title",
          markdown: "Body",
          ...(categoryId === undefined ? {} : { categoryId }),
        },
        context,
      );
      expect(writes.createOwnedNote).toHaveBeenCalledWith("owner", {
        title: "Title",
        markdown: "Body",
        categoryId: expected,
      });
    },
  );
  it("stops category reads after cancellation", async () => {
    const { tools, controller } = setup();
    controller.abort();
    await expect(tools.list_categories.execute!({}, context)).rejects.toThrow();
    expect(categories.findMany).not.toHaveBeenCalled();
  });
  it("uses the authenticated owner and validates search defaults", async () => {
    const { tools, assertActive } = setup();
    await tools.list_notes.execute!({}, context);
    expect(assertActive).toHaveBeenCalledOnce();
    expect(reads.searchOwnedNotes).toHaveBeenCalledWith("owner", {
      limit: 20,
      offset: 0,
    });
    await expect(
      tools.list_notes.execute!({ limit: 51 }, context),
    ).rejects.toThrow();
    expect(reads.searchOwnedNotes).toHaveBeenCalledTimes(1);
  });
  it("serializes timestamps and links successful mutations", async () => {
    const { tools } = setup();
    expect(
      await tools.get_note.execute!({ id: "note" }, context),
    ).toMatchObject({
      structuredContent: { updatedAt: version },
    });
    expect(
      await tools.create_note!.execute!(
        { title: "Title", markdown: "# Note" },
        context,
      ),
    ).toMatchObject({
      structuredContent: {
        title: "Title",
        url: "https://notes.example/notes/note",
      },
    });
    expect(writes.createOwnedNote).toHaveBeenCalledWith("owner", {
      title: "Title",
      markdown: "# Note",
    });
    expect(await tools.update_note!.execute!(update, context)).toMatchObject({
      structuredContent: { url: "https://notes.example/notes/note" },
    });
    expect(writes.updateOwnedNote).toHaveBeenCalledWith("owner", update);
  });
  it.each([
    "https://notes.example/notes/note",
    "https://notes.example/notes/note?category=all#heading",
    "/notes/note",
    "/notes/note/",
    "https://notes.example/notes/%6eote",
  ])("reads a known Note link without searching first: %s", async (id) => {
    const { tools } = setup();
    expect(await tools.get_note.execute!({ id }, context)).toMatchObject({
      structuredContent: { id: "note", updatedAt: version },
    });
    expect(reads.readOwnedNote).toHaveBeenCalledExactlyOnceWith(
      "owner",
      "note",
    );
    expect(reads.searchOwnedNotes).not.toHaveBeenCalled();
    expect(await tools.update_note!.execute!(update, context)).toHaveProperty(
      "structuredContent",
    );
    expect(writes.updateOwnedNote).toHaveBeenCalledExactlyOnceWith(
      "owner",
      update,
    );
  });
  it.each([
    "https://external.example/notes/note",
    "https://notes.example.evil.test/notes/note",
    "https://user:password@notes.example/notes/note",
    "https://notes.example/chats/note",
    "/notes/note/another",
    "/notes/%2Fnote",
    "/notes/%ZZ",
    "javascript:alert(1)",
  ])("rejects non-app Note references: %s", async (id) => {
    const { tools } = setup();
    expect(await tools.get_note.execute!({ id }, context)).toMatchObject({
      isError: true,
    });
    expect(reads.readOwnedNote).not.toHaveBeenCalled();
  });
  it("does not retain a write version after a subsequent failed read", async () => {
    const { tools } = setup();
    await tools.get_note.execute!({ id: "note" }, context);
    reads.readOwnedNote.mockRejectedValueOnce({ statusCode: 404 });
    await tools.get_note.execute!({ id: "/notes/note" }, context);
    expect(await tools.update_note!.execute!(update, context)).toHaveProperty(
      "error",
    );
    expect(writes.updateOwnedNote).not.toHaveBeenCalled();
  });
  it.each(["update_note", "delete_note"] as const)(
    "requires reading the exact version before %s",
    async (name) => {
      const { tools } = setup();
      const args = name === "update_note" ? update : input;
      const execute = () => tools[name]!.execute!(args, context);
      expect(await execute()).toMatchObject({
        error: expect.stringContaining("get_note"),
      });
      expect(writes.updateOwnedNote).not.toHaveBeenCalled();
      expect(writes.deleteOwnedNote).not.toHaveBeenCalled();
      await tools.get_note.execute!({ id: "note" }, context);
      expect(await execute()).toHaveProperty("structuredContent");
      expect(await execute()).toHaveProperty("error");
    },
  );
  it("blocks another deletion after a conflict even if the model reads again", async () => {
    const { tools } = setup();
    writes.deleteOwnedNote.mockRejectedValue({ statusCode: 409 });
    await tools.get_note.execute!({ id: "note" }, context);
    expect(await tools.delete_note!.execute!(input, context)).toMatchObject({
      isError: true,
    });
    await tools.get_note.execute!({ id: "note" }, context);
    expect(await tools.delete_note!.execute!(input, context)).toMatchObject({
      error: expect.stringContaining("confirm deletion"),
    });
    expect(writes.deleteOwnedNote).toHaveBeenCalledOnce();
  });
  it("does not grant a version for a missing or foreign Note", async () => {
    const { tools } = setup();
    reads.readOwnedNote.mockRejectedValue({ statusCode: 404 });
    expect(
      await tools.get_note.execute!({ id: "note" }, context),
    ).toMatchObject({ isError: true });
    expect(await tools.delete_note!.execute!(input, context)).toHaveProperty(
      "error",
    );
    expect(writes.deleteOwnedNote).not.toHaveBeenCalled();
  });
  it("isolates owners and read versions between concurrent requests", async () => {
    const a = setup("a").tools;
    const b = setup("b").tools;
    await a.get_note.execute!({ id: "note" }, context);
    expect(await b.update_note!.execute!(update, context)).toHaveProperty(
      "error",
    );
    await b.get_note.execute!({ id: "note" }, context);
    await Promise.all([
      a.update_note!.execute!(update, context),
      b.update_note!.execute!(update, context),
    ]);
    expect(
      writes.updateOwnedNote.mock.calls.map(([owner]) => owner).sort(),
    ).toEqual(["a", "b"]);
  });
  it("hides storage errors and rejects caller-supplied ownership", async () => {
    const { tools } = setup();
    writes.createOwnedNote.mockRejectedValue(
      new Error("private database detail"),
    );
    const result = await tools.create_note!.execute!(
      { title: "Title", markdown: "" },
      context,
    );
    expect(result).toMatchObject({ isError: true });
    expect(JSON.stringify(result)).not.toContain("private database detail");
    await expect(
      tools.create_note!.execute!(
        { title: "Title", markdown: "", userId: "other" } as never,
        context,
      ),
    ).rejects.toThrow();
    expect(writes.createOwnedNote).toHaveBeenCalledTimes(1);
  });
  it("stops before operating after cancellation or loss of generation ownership", async () => {
    const cancelled = setup();
    cancelled.controller.abort();
    await expect(
      cancelled.tools.list_notes.execute!({}, context),
    ).rejects.toThrow();
    const inactive = setup();
    inactive.assertActive.mockRejectedValue(new Error("no longer active"));
    await expect(
      inactive.tools.create_note!.execute!(
        { title: "Title", markdown: "" },
        context,
      ),
    ).rejects.toThrow();
    expect(reads.searchOwnedNotes).not.toHaveBeenCalled();
    expect(writes.createOwnedNote).not.toHaveBeenCalled();
  });
  it("does not expose writes during retries", () => {
    expect(Object.keys(setup("owner", false).tools).sort()).toEqual([
      "get_note",
      "list_categories",
      "list_notes",
    ]);
  });
});

it.each([false, true])(
  "edits a Note through the AI SDK loop (known link from creation: %s)",
  async (knownLink) => {
    if (knownLink) {
      const creator = setup().tools;
      await creator.create_note!.execute!(
        { title: "Title", markdown: "# Note" },
        context,
      );
    }
    // Every new chat message receives a fresh tool instance and must read again.
    const { tools } = setup();
    reads.searchOwnedNotes.mockResolvedValue({
      notes: [{ id: "note", title: "Title" }],
      nextOffset: null,
    });
    const usage = {
      inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 1, text: 1, reasoning: 0 },
    };
    function toolStep(toolName: string, args: object, index: number) {
      return {
        stream: simulateReadableStream({
          chunks: [
            {
              type: "tool-call" as const,
              toolCallId: `call-${index}`,
              toolName,
              input: JSON.stringify(args),
            },
            {
              type: "finish" as const,
              finishReason: { unified: "tool-calls" as const, raw: undefined },
              usage,
            },
          ],
          initialDelayInMs: null,
          chunkDelayInMs: null,
        }),
      };
    }
    const model = new MockLanguageModelV4({
      doStream: [
        ...(knownLink ? [] : [toolStep("list_notes", { q: "Title" }, 1)]),
        toolStep(
          "get_note",
          { id: knownLink ? "https://notes.example/notes/note" : "note" },
          2,
        ),
        toolStep("update_note", update, 3),
        {
          stream: simulateReadableStream({
            chunks: [
              { type: "text-start", id: "answer" },
              {
                type: "text-delta",
                id: "answer",
                delta: "Updated [Title](https://notes.example/notes/note).",
              },
              { type: "text-end", id: "answer" },
              {
                type: "finish",
                finishReason: { unified: "stop", raw: undefined },
                usage,
              },
            ],
            initialDelayInMs: null,
            chunkDelayInMs: null,
          }),
        },
      ],
    });
    const result = streamText({
      model,
      tools,
      system: CHAT_NOTES_INSTRUCTIONS,
      messages: knownLink
        ? [
            { role: "user", content: "この内容をノートに保存して" },
            {
              role: "assistant",
              content:
                "[Title](https://notes.example/notes/note) に保存しました。",
            },
            { role: "user", content: "先ほど作成したノートに説明を追記して" },
          ]
        : [{ role: "user", content: "Find Title and update its content." }],
      stopWhen: stepCountIs(8),
      maxRetries: 0,
    });
    const parts = [];
    for await (const part of result.fullStream) parts.push(part);
    expect(parts.filter((part) => part.type === "tool-result")).toHaveLength(
      knownLink ? 2 : 3,
    );
    expect(
      parts.filter(
        (part) => part.type === "tool-error" || part.type === "error",
      ),
    ).toEqual([]);
    expect(await result.text).toBe(
      "Updated [Title](https://notes.example/notes/note).",
    );
    expect(writes.updateOwnedNote).toHaveBeenCalledExactlyOnceWith(
      "owner",
      update,
    );
    expect(model.doStreamCalls).toHaveLength(knownLink ? 3 : 4);
    if (knownLink) expect(reads.searchOwnedNotes).not.toHaveBeenCalled();
    expect(JSON.stringify(model.doStreamCalls.at(-1)!.prompt)).toContain(
      "https://notes.example/notes/note",
    );
  },
);
