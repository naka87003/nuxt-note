import { beforeEach, describe, expect, it, vi } from "vitest";
import { simulateReadableStream, stepCountIs, streamText } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { createWorkspaceTools } from "~~/server/utils/workspace-tools";
import {
  CHAT_NOTES_INSTRUCTIONS,
  createChatNoteTools,
} from "~~/server/utils/chat-tools";

const reads = vi.hoisted(() => ({
  searchOwnedNotes: vi.fn(),
  readOwnedNote: vi.fn(),
}));

const chatReads = vi.hoisted(() => ({
  searchOwnedChats: vi.fn(),
  readOwnedChatPage: vi.fn(),
}));

vi.mock("~~/server/utils/chat-reads", () => chatReads);

const chatWrites = vi.hoisted(() => ({
  updateOwnedChatCategory: vi.fn(),
  updateOwnedChatTitle: vi.fn(),
  deleteOwnedChat: vi.fn(),
  moveOwnedCategoryChats: vi.fn(),
}));

vi.mock("~~/server/utils/chat-writes", () => chatWrites);

const writes = vi.hoisted(() => ({
  createOwnedNote: vi.fn(),
  updateOwnedNote: vi.fn(),
  updateOwnedNoteCategory: vi.fn(),
  updateOwnedNoteTitle: vi.fn(),
  moveOwnedCategoryNotes: vi.fn(),
  deleteOwnedNote: vi.fn(),
}));

vi.mock("~~/server/utils/note-reads", () => reads);
vi.mock("~~/server/utils/note-writes", () => writes);
const merges = vi.hoisted(() => ({ mergeOwnedCategories: vi.fn() }));
vi.mock("~~/server/utils/category-merges", () => merges);
const version = "2026-11-13T00:00:00.000Z";

const note = {
  id: "note",
  title: "Title",
  markdown: "# Note",
  updatedAt: new Date(version),
};

const input = { id: "note", updatedAt: version };
const update = { ...input, title: "Updated", markdown: "# Changed" };
const context = { toolCallId: "call", messages: [], context: {} };

const categories = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  updateMany: vi.fn(),
  deleteMany: vi.fn(),
}));

vi.mock("~~/server/utils/prisma", () => ({
  getPrisma: () => ({ category: categories }),
}));

function setup(
  owner = "owner",
  allowMutations = true,
  categoryId?: string | null,
  chatId?: string,
) {
  const controller = new AbortController();
  const assertActive = vi.fn().mockResolvedValue(undefined);

  const tools = createChatNoteTools(owner, "https://notes.example", {
    signal: controller.signal,
    assertActive,
    allowMutations,
    categoryId,
    chatId,
  });

  return { tools, controller, assertActive };
}

beforeEach(() => {
  vi.resetAllMocks();
  writes.updateOwnedNoteTitle.mockResolvedValue({
    id: "note",
    title: "Saved title",
    categoryId: "existing",
    updatedAt: new Date(version),
  });
  chatWrites.deleteOwnedChat.mockResolvedValue({ id: "chat", deleted: true });
  chatWrites.updateOwnedChatTitle.mockImplementation(async (_owner, input) => ({
    id: input.id,
    title: input.title.trim(),
    categoryId: "existing",
    updatedAt: new Date(version),
  }));
  chatWrites.updateOwnedChatCategory.mockImplementation(
    async (_owner, id, input) => ({
      id,
      title: "Chat title",
      categoryId: input.categoryId,
      updatedAt: new Date(version),
    }),
  );
  chatReads.searchOwnedChats.mockResolvedValue({ chats: [], nextOffset: null });
  chatReads.readOwnedChatPage.mockResolvedValue({
    id: "chat",
    title: "Chat title",
    updatedAt: new Date(version),
    messages: [
      { role: "user", content: "Question", createdAt: new Date(version) },
    ],
    nextOffset: null,
  });
  reads.searchOwnedNotes.mockResolvedValue({ notes: [], nextOffset: null });
  reads.readOwnedNote.mockResolvedValue(note);
  writes.createOwnedNote.mockResolvedValue(note);
  writes.updateOwnedNote.mockResolvedValue(note);
  writes.updateOwnedNoteCategory.mockResolvedValue({
    ...note,
    markdown: undefined,
  });
  writes.deleteOwnedNote.mockResolvedValue({ id: "note", deleted: true });
});
describe("in-app Note tools", () => {
  describe("Read results and version metadata", () => {
    it.each(["list_notes", "list_chats"] as const)(
      "preserves the full serialized %s result, including extra fields and pagination",
      async (name) => {
        const item = { ...note, preview: "Preview", metadata: { flag: true } };
        reads.searchOwnedNotes.mockResolvedValue({
          notes: [item],
          nextOffset: 20,
        });
        chatReads.searchOwnedChats.mockResolvedValue({
          chats: [item],
          nextOffset: 20,
        });

        const definitions = createWorkspaceTools(
          "owner",
          "https://notes.example",
        );

        const expected: unknown = JSON.parse(
          JSON.stringify(await definitions[name].execute({})),
        );

        const { tools } = setup();
        expect(await tools[name].execute({}, context)).toEqual(expected);
      },
    );

    it.each(["get_note", "get_chat"] as const)(
      "preserves the full serialized %s result and nested dates",
      async (name) => {
        const item = {
          ...note,
          createdAt: new Date(version),
          messages: [
            { role: "user", content: "Question", createdAt: new Date(version) },
          ],
          nextOffset: 20,
          metadata: { flag: true },
        };

        reads.readOwnedNote.mockResolvedValue(item);
        chatReads.readOwnedChatPage.mockResolvedValue(item);

        const definitions = createWorkspaceTools(
          "owner",
          "https://notes.example",
        );

        const expected: unknown = JSON.parse(
          JSON.stringify(await definitions[name].execute({ id: "note" })),
        );

        const { tools } = setup();
        expect(await tools[name].execute({ id: "note" }, context)).toEqual(
          expected,
        );
      },
    );

    it.each(["get_note", "get_chat"] as const)(
      "preserves the %s error result without requiring version metadata",
      async (name) => {
        reads.readOwnedNote.mockRejectedValue({ statusCode: 404 });
        chatReads.readOwnedChatPage.mockRejectedValue({ statusCode: 404 });

        const definitions = createWorkspaceTools(
          "owner",
          "https://notes.example",
        );

        const expected = await definitions[name].execute({ id: "note" });
        const { tools } = setup();
        expect(expected.isError).toBe(true);
        expect(await tools[name].execute({ id: "note" }, context)).toEqual(
          expected,
        );
      },
    );

    it.each([undefined, "invalid", 123])(
      "rejects malformed Note list versions atomically (%j)",
      async (updatedAt) => {
        const { tools } = setup();
        reads.searchOwnedNotes.mockResolvedValueOnce({
          notes: [note, { id: "malformed", updatedAt }],
          nextOffset: null,
        });
        await expect(tools.list_notes.execute({}, context)).rejects.toThrow();
        expect(
          await tools.update_note_title!.execute(
            { ...input, title: "Changed" },
            context,
          ),
        ).toHaveProperty("error");
        expect(writes.updateOwnedNoteTitle).not.toHaveBeenCalled();
      },
    );

    it.each([undefined, "invalid", 123])(
      "rejects malformed Chat list versions atomically (%j)",
      async (updatedAt) => {
        const { tools } = setup();
        chatReads.searchOwnedChats.mockResolvedValueOnce({
          chats: [
            { id: "chat", updatedAt: new Date(version) },
            { id: "malformed", updatedAt },
          ],
          nextOffset: null,
        });
        await expect(tools.list_chats.execute({}, context)).rejects.toThrow();
        expect(
          await tools.update_chat_title!.execute(
            { id: "chat", updatedAt: version, title: "Changed" },
            context,
          ),
        ).toHaveProperty("error");
        expect(chatWrites.updateOwnedChatTitle).not.toHaveBeenCalled();
      },
    );

    it("does not retain a Note version after reading invalid metadata", async () => {
      const { tools } = setup();
      await tools.get_note.execute({ id: "note" }, context);
      reads.readOwnedNote.mockResolvedValueOnce({
        ...note,
        updatedAt: "invalid",
      });
      await expect(
        tools.get_note.execute({ id: "note" }, context),
      ).rejects.toThrow();
      expect(await tools.update_note!.execute(update, context)).toHaveProperty(
        "error",
      );
      expect(writes.updateOwnedNote).not.toHaveBeenCalled();
    });

    it("does not retain a Chat version after reading invalid metadata", async () => {
      const { tools } = setup();
      await tools.get_chat.execute({ id: "chat" }, context);
      chatReads.readOwnedChatPage.mockResolvedValueOnce({
        id: "chat",
        updatedAt: "invalid",
      });
      await expect(
        tools.get_chat.execute({ id: "chat" }, context),
      ).rejects.toThrow();
      expect(
        await tools.update_chat_title!.execute(
          { id: "chat", updatedAt: version, title: "Changed" },
          context,
        ),
      ).toHaveProperty("error");
      expect(chatWrites.updateOwnedChatTitle).not.toHaveBeenCalled();
    });
  });

  describe("Category merges", () => {
    it.each([true, false])(
      "reflects the current Chat only after it was actually merged (%s)",
      async (currentChatMoved) => {
        const onChatCategoryUpdated = vi.fn();

        const tools = createChatNoteTools("owner", "https://notes.example", {
          signal: new AbortController().signal,
          assertActive: async () => {},
          allowMutations: true,
          categoryId: "source",
          chatId: "current",
          onChatCategoryUpdated,
        });

        const args = { sourceCategoryId: "source", targetCategoryId: "target" };
        merges.mergeOwnedCategories.mockResolvedValueOnce({
          ...args,
          movedNoteCount: 2,
          movedChatCount: 1,
          currentChatMoved,
        });
        const result = await tools.merge_categories!.execute(args, context);
        expect(result).toMatchObject({
          structuredContent: { ...args, movedNoteCount: 2, movedChatCount: 1 },
        });
        expect(result).not.toHaveProperty("structuredContent.currentChatMoved");
        expect(merges.mergeOwnedCategories).toHaveBeenCalledExactlyOnceWith(
          "owner",
          args,
          "current",
        );
        await tools.create_note!.execute(
          { title: "Title", markdown: "Body" },
          context,
        );
        expect(writes.createOwnedNote).toHaveBeenCalledWith("owner", {
          title: "Title",
          markdown: "Body",
          categoryId: currentChatMoved ? "target" : "source",
        });

        if (currentChatMoved) {
          expect(onChatCategoryUpdated).toHaveBeenCalledExactlyOnceWith(
            "target",
          );
        } else {
          expect(onChatCategoryUpdated).not.toHaveBeenCalled();
        }

        expect(chatReads.readOwnedChatPage).not.toHaveBeenCalled();
      },
    );

    it.each([
      [0, 0, true],
      [1, 0, true],
      [0, 1, true],
      [1, 1, true],
      [1, 1, false],
    ] as const)(
      "invalidates only changed version caches after a successful merge (%s Notes, %s Chats, %s)",
      async (movedNoteCount, movedChatCount, succeeds) => {
        const { tools } = setup();
        await tools.get_note.execute({ id: "note" }, context);
        await tools.get_chat.execute({ id: "chat" }, context);
        const args = { sourceCategoryId: "source", targetCategoryId: "target" };

        if (succeeds) {
          merges.mergeOwnedCategories.mockResolvedValueOnce({
            ...args,
            movedNoteCount,
            movedChatCount,
            currentChatMoved: false,
          });
        } else {
          merges.mergeOwnedCategories.mockRejectedValueOnce(
            new Error("storage failed"),
          );
        }

        await tools.merge_categories!.execute(args, context);
        expect(
          await tools.update_note!.execute(update, context),
        ).toHaveProperty(
          succeeds && movedNoteCount ? "error" : "structuredContent",
        );
        expect(
          await tools.update_chat_title!.execute(
            { id: "chat", title: "New title", updatedAt: version },
            context,
          ),
        ).toHaveProperty(
          succeeds && movedChatCount ? "error" : "structuredContent",
        );
        expect(merges.mergeOwnedCategories).toHaveBeenCalledOnce();
      },
    );

    it("clears listed Note metadata after a nonempty merge", async () => {
      const { tools } = setup();
      reads.searchOwnedNotes.mockResolvedValueOnce({
        notes: [note],
        nextOffset: null,
      });
      await tools.list_notes.execute({}, context);
      const args = { sourceCategoryId: "source", targetCategoryId: "target" };
      merges.mergeOwnedCategories.mockResolvedValueOnce({
        ...args,
        movedNoteCount: 1,
        movedChatCount: 0,
        currentChatMoved: false,
      });
      await tools.merge_categories!.execute(args, context);
      expect(
        await tools.update_note_title!.execute(
          { ...input, title: "New title" },
          context,
        ),
      ).toHaveProperty("error");
      await tools.get_note.execute({ id: "note" }, context);
      expect(
        await tools.update_note_title!.execute(
          { ...input, title: "New title" },
          context,
        ),
      ).toHaveProperty("structuredContent");
    });

    it("validates merges and stops after cancellation or generation ownership loss", async () => {
      const args = { sourceCategoryId: "source", targetCategoryId: "target" };
      const { tools, controller } = setup();
      await expect(
        tools.merge_categories!.execute(
          { ...args, targetCategoryId: "source" },
          context,
        ),
      ).rejects.toThrow();
      controller.abort();
      await expect(
        tools.merge_categories!.execute(args, context),
      ).rejects.toThrow();
      const inactive = setup();
      inactive.assertActive.mockRejectedValueOnce(
        new Error("no longer active"),
      );
      await expect(
        inactive.tools.merge_categories!.execute(args, context),
      ).rejects.toThrow();
      expect(merges.mergeOwnedCategories).not.toHaveBeenCalled();
    });
  });

  describe("Bulk Chat moves", () => {
    it.each([true, false])(
      "updates the current Category only if that Chat was actually moved: %s",
      async (currentChatMoved) => {
        const onChatCategoryUpdated = vi.fn();

        const tools = createChatNoteTools("owner", "https://notes.example", {
          signal: new AbortController().signal,
          assertActive: async () => {},
          allowMutations: true,
          chatId: "current",
          categoryId: "source",
          onChatCategoryUpdated,
        });

        const args = { sourceCategoryId: "source", targetCategoryId: null };
        chatWrites.moveOwnedCategoryChats.mockResolvedValueOnce({
          ...args,
          movedCount: 2,
          currentChatMoved,
        });
        expect(
          await tools.move_category_chats!.execute(args, context),
        ).toMatchObject({ structuredContent: { ...args, movedCount: 2 } });
        expect(
          chatWrites.moveOwnedCategoryChats,
        ).toHaveBeenCalledExactlyOnceWith("owner", args, "current");
        await tools.create_note!.execute(
          { title: "Title", markdown: "Body" },
          context,
        );
        expect(writes.createOwnedNote).toHaveBeenCalledWith("owner", {
          title: "Title",
          markdown: "Body",
          ...(currentChatMoved ? {} : { categoryId: "source" }),
        });

        if (currentChatMoved) {
          expect(onChatCategoryUpdated).toHaveBeenCalledExactlyOnceWith(null);
        } else {
          expect(onChatCategoryUpdated).not.toHaveBeenCalled();
        }

        expect(chatReads.readOwnedChatPage).not.toHaveBeenCalled();
      },
    );

    it.each([0, 2])(
      "discards cached Chat versions only after nonempty moves, preserving Note versions: %s",
      async (movedCount) => {
        const { tools } = setup();
        const args = { sourceCategoryId: "source", targetCategoryId: "target" };
        chatReads.searchOwnedChats.mockResolvedValueOnce({
          chats: [{ id: "chat", updatedAt: new Date(version) }],
          nextOffset: null,
        });
        await tools.list_chats.execute({}, context);
        await tools.get_note.execute({ id: "note" }, context);
        chatWrites.moveOwnedCategoryChats.mockResolvedValueOnce({
          ...args,
          movedCount,
          currentChatMoved: false,
        });
        await tools.move_category_chats!.execute(args, context);
        expect(
          await tools.update_chat_title!.execute(
            { id: "chat", title: "New title", updatedAt: version },
            context,
          ),
        ).toHaveProperty(movedCount ? "error" : "structuredContent");
        expect(
          await tools.update_note_title!.execute(
            { ...input, title: "New title" },
            context,
          ),
        ).toHaveProperty("structuredContent");
        expect(chatReads.readOwnedChatPage).not.toHaveBeenCalled();
      },
    );

    it("retains the current Category and cached versions on a failed Chat move", async () => {
      const { tools } = setup("owner", true, "source", "chat");
      await tools.get_chat.execute({ id: "chat" }, context);
      chatWrites.moveOwnedCategoryChats.mockRejectedValueOnce({
        statusCode: 404,
      });
      expect(
        await tools.move_category_chats!.execute(
          { sourceCategoryId: "source", targetCategoryId: null },
          context,
        ),
      ).toMatchObject({ isError: true });
      expect(
        await tools.update_chat_title!.execute(
          { id: "chat", title: "New title", updatedAt: version },
          context,
        ),
      ).toHaveProperty("structuredContent");
      await tools.create_note!.execute(
        { title: "Title", markdown: "Body" },
        context,
      );
      expect(writes.createOwnedNote).toHaveBeenCalledWith("owner", {
        title: "Title",
        markdown: "Body",
        categoryId: "source",
      });
      expect(chatWrites.moveOwnedCategoryChats).toHaveBeenCalledOnce();
    });

    it("validates Chat moves and stops after cancellation or generation ownership loss", async () => {
      const args = { sourceCategoryId: "source", targetCategoryId: null };
      const { tools, controller } = setup();
      await expect(
        tools.move_category_chats!.execute(
          { ...args, targetCategoryId: "source" },
          context,
        ),
      ).rejects.toThrow();
      controller.abort();
      await expect(
        tools.move_category_chats!.execute(args, context),
      ).rejects.toThrow();
      const inactive = setup();
      inactive.assertActive.mockRejectedValue(new Error("no longer active"));
      await expect(
        inactive.tools.move_category_chats!.execute(args, context),
      ).rejects.toThrow();
      expect(chatWrites.moveOwnedCategoryChats).not.toHaveBeenCalled();
    });
  });

  describe("Bulk Note moves", () => {
    it.each([0, 2])(
      "moves all Notes for the session owner and invalidates read versions only when changed: %s",
      async (movedCount) => {
        const { tools } = setup();
        const args = { sourceCategoryId: "source", targetCategoryId: null };
        writes.moveOwnedCategoryNotes.mockResolvedValueOnce({
          ...args,
          movedCount,
        });
        await tools.get_note.execute({ id: "note" }, context);
        expect(
          await tools.move_category_notes!.execute(args, context),
        ).toMatchObject({ structuredContent: { ...args, movedCount } });
        expect(writes.moveOwnedCategoryNotes).toHaveBeenCalledExactlyOnceWith(
          "owner",
          args,
        );

        const result = await tools.update_note_title!.execute(
          { ...input, title: "New title" },
          context,
        );

        expect(result).toHaveProperty(
          movedCount ? "error" : "structuredContent",
        );

        if (movedCount) {
          expect(
            await tools.update_note!.execute(update, context),
          ).toHaveProperty("error");
          expect(
            await tools.update_note_category!.execute(
              { ...input, categoryId: null },
              context,
            ),
          ).toHaveProperty("error");
          expect(
            await tools.delete_note!.execute(input, context),
          ).toHaveProperty("error");
        }

        expect(reads.readOwnedNote).toHaveBeenCalledOnce();
      },
    );

    it("keeps cached versions after a failed move and does not change the Chat's default Category", async () => {
      const { tools } = setup("owner", true, "chat-category");
      await tools.get_note.execute({ id: "note" }, context);
      writes.moveOwnedCategoryNotes.mockRejectedValueOnce({ statusCode: 404 });
      expect(
        await tools.move_category_notes!.execute(
          { sourceCategoryId: "source", targetCategoryId: null },
          context,
        ),
      ).toMatchObject({ isError: true });
      expect(
        await tools.update_note_title!.execute(
          { ...input, title: "New title" },
          context,
        ),
      ).toHaveProperty("structuredContent");
      await tools.create_note!.execute(
        { title: "Title", markdown: "Body" },
        context,
      );
      expect(writes.createOwnedNote).toHaveBeenCalledWith("owner", {
        title: "Title",
        markdown: "Body",
        categoryId: "chat-category",
      });
      expect(writes.moveOwnedCategoryNotes).toHaveBeenCalledOnce();
    });

    it("validates bulk moves and stops after cancellation or generation ownership loss", async () => {
      const args = { sourceCategoryId: "source", targetCategoryId: null };
      const { tools, controller } = setup();
      await expect(
        tools.move_category_notes!.execute(
          { ...args, targetCategoryId: "source" },
          context,
        ),
      ).rejects.toThrow();
      controller.abort();
      await expect(
        tools.move_category_notes!.execute(args, context),
      ).rejects.toThrow();
      const inactive = setup();
      inactive.assertActive.mockRejectedValue(new Error("no longer active"));
      await expect(
        inactive.tools.move_category_notes!.execute(args, context),
      ).rejects.toThrow();
      expect(writes.moveOwnedCategoryNotes).not.toHaveBeenCalled();
    });
  });

  describe("Note titles", () => {
    it("renames a Note from a listed version without fetching its body or granting body-edit access", async () => {
      const { tools } = setup();
      const args = { ...input, title: "Requested title" };
      expect(
        await tools.update_note_title!.execute(args, context),
      ).toHaveProperty("error");
      reads.searchOwnedNotes.mockResolvedValueOnce({
        notes: [{ id: "note", updatedAt: new Date(version) }],
        nextOffset: 1,
      });
      await tools.list_notes.execute({ limit: 1 }, context);
      await tools.list_notes.execute({ limit: 1, offset: 1 }, context);
      expect(
        await tools.update_note_title!.execute(
          { ...args, updatedAt: "2026-11-13T00:00:01.000Z" },
          context,
        ),
      ).toHaveProperty("error");
      expect(await tools.update_note!.execute(update, context)).toHaveProperty(
        "error",
      );
      expect(await tools.delete_note!.execute(input, context)).toHaveProperty(
        "error",
      );
      expect(
        await tools.update_note_title!.execute(args, context),
      ).toMatchObject({
        structuredContent: {
          title: "Saved title",
          categoryId: "existing",
          updatedAt: version,
          url: "https://notes.example/notes/note",
        },
      });
      expect(writes.updateOwnedNoteTitle).toHaveBeenCalledExactlyOnceWith(
        "owner",
        args,
      );
      expect(reads.readOwnedNote).not.toHaveBeenCalled();
      expect(writes.updateOwnedNote).not.toHaveBeenCalled();
      expect(writes.deleteOwnedNote).not.toHaveBeenCalled();
      expect(
        await tools.update_note_title!.execute(args, context),
      ).toHaveProperty("error");
    });

    it("consumes both full-read and metadata versions on rename, including after a conflict", async () => {
      const { tools } = setup();
      const args = { ...input, title: "New title" };
      await tools.get_note.execute({ id: "note" }, context);
      writes.updateOwnedNoteTitle.mockRejectedValueOnce({ statusCode: 409 });
      expect(
        await tools.update_note_title!.execute(args, context),
      ).toMatchObject({ isError: true });
      expect(
        await tools.update_note_title!.execute(args, context),
      ).toHaveProperty("error");
      expect(
        await tools.update_note_category!.execute(
          { ...input, categoryId: null },
          context,
        ),
      ).toHaveProperty("error");
      expect(await tools.update_note!.execute(update, context)).toHaveProperty(
        "error",
      );
      expect(await tools.delete_note!.execute(input, context)).toHaveProperty(
        "error",
      );
      const nextVersion = "2026-11-13T00:00:01.000Z";
      reads.searchOwnedNotes.mockResolvedValueOnce({
        notes: [{ id: "note", updatedAt: new Date(nextVersion) }],
        nextOffset: null,
      });
      await tools.list_notes.execute({}, context);
      expect(
        await tools.update_note_title!.execute(
          { ...args, updatedAt: nextVersion },
          context,
        ),
      ).toHaveProperty("structuredContent");
      expect(writes.updateOwnedNoteTitle).toHaveBeenCalledTimes(2);
    });

    it("requires a new read before renaming after another Note mutation or a failed read", async () => {
      const { tools } = setup();
      const args = { ...input, title: "New title" };
      await tools.get_note.execute({ id: "note" }, context);
      await tools.update_note_category!.execute(
        { ...input, categoryId: null },
        context,
      );
      expect(
        await tools.update_note_title!.execute(args, context),
      ).toHaveProperty("error");
      await tools.get_note.execute({ id: "note" }, context);
      reads.readOwnedNote.mockRejectedValueOnce({ statusCode: 404 });
      await tools.get_note.execute({ id: "note" }, context);
      expect(
        await tools.update_note_title!.execute(args, context),
      ).toHaveProperty("error");
      expect(writes.updateOwnedNoteTitle).not.toHaveBeenCalled();
    });

    it("isolates Note rename versions from other owners and Chat versions", async () => {
      const a = setup("a").tools;
      const b = setup("b").tools;
      const args = { ...input, title: "New title" };
      await a.get_note.execute({ id: "note" }, context);
      expect(await b.update_note_title!.execute(args, context)).toHaveProperty(
        "error",
      );
      chatReads.readOwnedChatPage.mockResolvedValueOnce({
        id: "note",
        updatedAt: new Date(version),
        messages: [],
        nextOffset: null,
      });
      await b.get_chat.execute({ id: "note" }, context);
      expect(await b.update_note_title!.execute(args, context)).toHaveProperty(
        "error",
      );
      await b.get_note.execute({ id: "note" }, context);
      await a.update_note_title!.execute(args, context);
      await b.update_note_title!.execute(args, context);
      expect(
        writes.updateOwnedNoteTitle.mock.calls.map(([owner]) => owner),
      ).toEqual(["a", "b"]);
    });

    it("validates Note renaming and stops after cancellation or generation ownership loss", async () => {
      const { tools, controller } = setup();
      const args = { ...input, title: "New title" };
      await expect(
        tools.update_note_title!.execute(
          { ...args, markdown: "Body" },
          context,
        ),
      ).rejects.toThrow();
      controller.abort();
      await expect(
        tools.update_note_title!.execute(args, context),
      ).rejects.toThrow();
      const inactive = setup();
      inactive.assertActive.mockRejectedValue(new Error("no longer active"));
      await expect(
        inactive.tools.update_note_title!.execute(args, context),
      ).rejects.toThrow();
      expect(writes.updateOwnedNoteTitle).not.toHaveBeenCalled();
    });
  });

  describe("Chat deletion", () => {
    it("deletes a Chat using a listed version without reading messages, and consumes the version", async () => {
      const { tools } = setup("owner", true, null, "current");
      const args = { id: "chat", updatedAt: version };
      expect(await tools.delete_chat!.execute(args, context)).toHaveProperty(
        "error",
      );
      chatReads.searchOwnedChats.mockResolvedValueOnce({
        chats: [{ id: "chat", updatedAt: new Date(version) }],
        nextOffset: 1,
      });
      await tools.list_chats.execute({ limit: 1 }, context);
      await tools.list_chats.execute({ limit: 1, offset: 1 }, context);
      expect(
        await tools.delete_chat!.execute(
          { ...args, updatedAt: "2026-11-13T00:00:01.000Z" },
          context,
        ),
      ).toHaveProperty("error");
      expect(await tools.delete_chat!.execute(args, context)).toMatchObject({
        structuredContent: { id: "chat", deleted: true },
      });
      expect(chatWrites.deleteOwnedChat).toHaveBeenCalledExactlyOnceWith(
        "owner",
        "chat",
        { updatedAt: version },
      );
      expect(chatReads.readOwnedChatPage).not.toHaveBeenCalled();
      expect(await tools.delete_chat!.execute(args, context)).toHaveProperty(
        "error",
      );
      expect(
        await tools.update_chat_title!.execute(
          { ...args, title: "New title" },
          context,
        ),
      ).toHaveProperty("error");
    });

    it("blocks deletion of the current Chat even after reading it", async () => {
      const { tools, assertActive } = setup("owner", true, null, "chat");
      await tools.get_chat.execute({ id: "chat" }, context);
      expect(
        await tools.delete_chat!.execute(
          { id: "chat", updatedAt: version },
          context,
        ),
      ).toMatchObject({
        error: expect.stringContaining(
          "Cannot delete the Chat currently being used",
        ),
      });
      expect(chatWrites.deleteOwnedChat).not.toHaveBeenCalled();
      expect(assertActive).toHaveBeenCalledTimes(2);
    });

    it("requires a new user message after a deletion conflict even if a new version is read", async () => {
      const { tools } = setup();
      const args = { id: "chat", updatedAt: version };
      chatWrites.deleteOwnedChat.mockRejectedValueOnce({ statusCode: 409 });
      await tools.get_chat.execute({ id: "chat" }, context);
      expect(await tools.delete_chat!.execute(args, context)).toMatchObject({
        isError: true,
      });
      expect(await tools.delete_chat!.execute(args, context)).toMatchObject({
        error: expect.stringContaining("confirm deletion"),
      });
      const newerVersion = "2026-11-13T00:00:01.000Z";
      chatReads.readOwnedChatPage.mockResolvedValueOnce({
        id: "chat",
        updatedAt: new Date(newerVersion),
        messages: [],
        nextOffset: null,
      });
      await tools.get_chat.execute({ id: "chat" }, context);
      expect(
        await tools.delete_chat!.execute(
          { id: "chat", updatedAt: newerVersion },
          context,
        ),
      ).toMatchObject({ error: expect.stringContaining("in a new message") });
      expect(chatWrites.deleteOwnedChat).toHaveBeenCalledOnce();
      const nextTurn = setup().tools;
      await nextTurn.get_chat.execute({ id: "chat" }, context);
      expect(await nextTurn.delete_chat!.execute(args, context)).toHaveProperty(
        "structuredContent",
      );
      expect(chatWrites.deleteOwnedChat).toHaveBeenCalledTimes(2);
    });

    it("keeps Chat deletion versions separate from other owners and Note versions", async () => {
      const a = setup("a").tools;
      const b = setup("b").tools;
      const args = { id: "chat", updatedAt: version };
      await a.get_chat.execute({ id: "chat" }, context);
      expect(await b.delete_chat!.execute(args, context)).toHaveProperty(
        "error",
      );
      reads.readOwnedNote.mockResolvedValueOnce({ ...note, id: "chat" });
      await b.get_note.execute({ id: "chat" }, context);
      expect(await b.delete_chat!.execute(args, context)).toHaveProperty(
        "error",
      );
      await b.get_chat.execute({ id: "chat" }, context);
      await a.delete_chat!.execute(args, context);
      await b.delete_chat!.execute(args, context);
      expect(
        chatWrites.deleteOwnedChat.mock.calls.map(([owner]) => owner),
      ).toEqual(["a", "b"]);
    });

    it("invalidates a Chat deletion version after a failed read or another mutation", async () => {
      const { tools } = setup();
      const args = { id: "chat", updatedAt: version };
      await tools.get_chat.execute({ id: "chat" }, context);
      chatReads.readOwnedChatPage.mockRejectedValueOnce({ statusCode: 404 });
      await tools.get_chat.execute({ id: "chat" }, context);
      expect(await tools.delete_chat!.execute(args, context)).toHaveProperty(
        "error",
      );
      await tools.get_chat.execute({ id: "chat" }, context);
      await tools.update_chat_title!.execute(
        { ...args, title: "New title" },
        context,
      );
      expect(await tools.delete_chat!.execute(args, context)).toHaveProperty(
        "error",
      );
      expect(chatWrites.deleteOwnedChat).not.toHaveBeenCalled();
    });

    it("validates Chat deletion and stops after cancellation or generation ownership loss", async () => {
      const { tools, controller } = setup();
      const args = { id: "chat", updatedAt: version };
      await expect(
        tools.delete_chat!.execute({ ...args, userId: "other" }, context),
      ).rejects.toThrow();
      controller.abort();
      await expect(tools.delete_chat!.execute(args, context)).rejects.toThrow();
      const inactive = setup();
      inactive.assertActive.mockRejectedValue(new Error("no longer active"));
      await expect(
        inactive.tools.delete_chat!.execute(args, context),
      ).rejects.toThrow();
      expect(chatWrites.deleteOwnedChat).not.toHaveBeenCalled();
    });
  });

  describe("Chat titles", () => {
    it.each([
      ["chat", true],
      ["other", true],
      ["chat", false],
    ] as const)(
      "notifies only a successful rename of the current Chat (%s, success: %s)",
      async (id, succeeds) => {
        const onChatTitleUpdated = vi.fn();

        const tools = createChatNoteTools("owner", "https://notes.example", {
          signal: new AbortController().signal,
          assertActive: async () => {},
          allowMutations: true,
          chatId: "chat",
          onChatTitleUpdated,
        });

        chatReads.readOwnedChatPage.mockResolvedValueOnce({
          id,
          updatedAt: new Date(version),
          messages: [],
          nextOffset: null,
        });
        await tools.get_chat.execute({ id }, context);

        if (succeeds) {
          chatWrites.updateOwnedChatTitle.mockResolvedValueOnce({
            id,
            title: "Saved title",
            updatedAt: new Date(version),
          });
        } else {
          chatWrites.updateOwnedChatTitle.mockRejectedValueOnce({
            statusCode: 409,
          });
        }

        await tools.update_chat_title!.execute(
          { id, title: "Requested title", updatedAt: version },
          context,
        );

        if (succeeds && id === "chat") {
          expect(onChatTitleUpdated).toHaveBeenCalledExactlyOnceWith(
            "Saved title",
          );
        } else {
          expect(onChatTitleUpdated).not.toHaveBeenCalled();
        }
      },
    );

    it("renames a Chat from a listed version without reading messages or changing the Note category default", async () => {
      const { tools } = setup("owner", true, "existing", "chat");
      const args = { id: "chat", title: "New title", updatedAt: version };
      expect(
        await tools.update_chat_title!.execute(args, context),
      ).toHaveProperty("error");
      chatReads.searchOwnedChats.mockResolvedValueOnce({
        chats: [{ id: "chat", updatedAt: new Date(version) }],
        nextOffset: 1,
      });
      await tools.list_chats.execute({ limit: 1 }, context);
      await tools.list_chats.execute({ limit: 1, offset: 1 }, context);
      expect(
        await tools.update_chat_title!.execute(
          { ...args, updatedAt: "2026-11-13T00:00:01.000Z" },
          context,
        ),
      ).toHaveProperty("error");
      expect(
        await tools.update_chat_title!.execute(args, context),
      ).toMatchObject({
        structuredContent: {
          title: "New title",
          updatedAt: version,
          url: "https://notes.example/chats/chat",
        },
      });
      expect(chatWrites.updateOwnedChatTitle).toHaveBeenCalledExactlyOnceWith(
        "owner",
        args,
      );
      expect(chatReads.readOwnedChatPage).not.toHaveBeenCalled();
      expect(
        await tools.update_chat_title!.execute(args, context),
      ).toHaveProperty("error");
      expect(
        await tools.update_chat_category!.execute(
          { id: "chat", categoryId: null, updatedAt: version },
          context,
        ),
      ).toHaveProperty("error");
      await tools.create_note!.execute(
        { title: "Title", markdown: "Body" },
        context,
      );
      expect(writes.createOwnedNote).toHaveBeenCalledWith("owner", {
        title: "Title",
        markdown: "Body",
        categoryId: "existing",
      });
    });

    it("requires a fresh Chat version after a category change or failed rename", async () => {
      const { tools } = setup();
      const args = { id: "chat", title: "New title", updatedAt: version };
      await tools.get_chat.execute({ id: "chat" }, context);
      await tools.update_chat_category!.execute(
        { id: "chat", categoryId: null, updatedAt: version },
        context,
      );
      expect(
        await tools.update_chat_title!.execute(args, context),
      ).toHaveProperty("error");
      await tools.get_chat.execute({ id: "chat" }, context);
      chatWrites.updateOwnedChatTitle.mockRejectedValueOnce({
        statusCode: 409,
      });
      expect(
        await tools.update_chat_title!.execute(args, context),
      ).toMatchObject({ isError: true });
      expect(
        await tools.update_chat_title!.execute(args, context),
      ).toHaveProperty("error");
      await tools.get_chat.execute({ id: "chat" }, context);
      expect(
        await tools.update_chat_title!.execute(args, context),
      ).toHaveProperty("structuredContent");
      expect(chatWrites.updateOwnedChatTitle).toHaveBeenCalledTimes(2);
    });

    it("keeps rename versions isolated and invalidates them on failed reads", async () => {
      const a = setup("a").tools;
      const b = setup("b").tools;
      const args = { id: "chat", title: "New title", updatedAt: version };
      await a.get_chat.execute({ id: "chat" }, context);
      expect(await b.update_chat_title!.execute(args, context)).toHaveProperty(
        "error",
      );
      chatReads.readOwnedChatPage.mockRejectedValueOnce({ statusCode: 404 });
      await a.get_chat.execute({ id: "chat" }, context);
      expect(await a.update_chat_title!.execute(args, context)).toHaveProperty(
        "error",
      );
      expect(chatWrites.updateOwnedChatTitle).not.toHaveBeenCalled();
    });

    it("validates rename inputs and stops after cancellation or generation ownership loss", async () => {
      const { tools, controller } = setup();
      const args = { id: "chat", title: "New title", updatedAt: version };
      await expect(
        tools.update_chat_title!.execute({ ...args, title: " " }, context),
      ).rejects.toThrow();
      controller.abort();
      await expect(
        tools.update_chat_title!.execute(args, context),
      ).rejects.toThrow();
      const inactive = setup();
      inactive.assertActive.mockRejectedValue(new Error("no longer active"));
      await expect(
        inactive.tools.update_chat_title!.execute(args, context),
      ).rejects.toThrow();
      expect(chatWrites.updateOwnedChatTitle).not.toHaveBeenCalled();
    });
  });

  describe("Chat categories", () => {
    it.each([null, "category"])(
      "changes a Chat category to %j using a listed version without reading messages",
      async (categoryId) => {
        const { tools } = setup();
        const args = { id: "chat", categoryId, updatedAt: version };
        expect(
          await tools.update_chat_category!.execute(args, context),
        ).toHaveProperty("error");
        chatReads.searchOwnedChats.mockResolvedValueOnce({
          chats: [{ id: "chat", updatedAt: new Date(version) }],
          nextOffset: 1,
        });
        await tools.list_chats.execute({ limit: 1 }, context);
        // Reading another page must preserve earlier page versions.
        await tools.list_chats.execute({ limit: 1, offset: 1 }, context);
        expect(
          await tools.update_chat_category!.execute(
            { ...args, updatedAt: "2026-11-13T00:00:01.000Z" },
            context,
          ),
        ).toHaveProperty("error");
        expect(
          await tools.update_chat_category!.execute(args, context),
        ).toMatchObject({
          structuredContent: {
            id: "chat",
            categoryId,
            updatedAt: version,
            url: "https://notes.example/chats/chat",
          },
        });
        expect(
          chatWrites.updateOwnedChatCategory,
        ).toHaveBeenCalledExactlyOnceWith("owner", "chat", args);
        expect(chatReads.readOwnedChatPage).not.toHaveBeenCalled();
        expect(
          await tools.update_chat_category!.execute(args, context),
        ).toHaveProperty("error");
      },
    );

    it("requires a fresh Chat read after conflict and invalidates versions on failed reads", async () => {
      const { tools } = setup();
      const args = { id: "chat", categoryId: null, updatedAt: version };
      await tools.get_chat.execute({ id: "chat" }, context);
      chatWrites.updateOwnedChatCategory.mockRejectedValueOnce({
        statusCode: 409,
      });
      expect(
        await tools.update_chat_category!.execute(args, context),
      ).toMatchObject({ isError: true });
      expect(
        await tools.update_chat_category!.execute(args, context),
      ).toHaveProperty("error");
      await tools.get_chat.execute({ id: "chat" }, context);
      chatReads.readOwnedChatPage.mockRejectedValueOnce({ statusCode: 404 });
      await tools.get_chat.execute({ id: "chat" }, context);
      expect(
        await tools.update_chat_category!.execute(args, context),
      ).toHaveProperty("error");
      await tools.get_chat.execute({ id: "chat" }, context);
      expect(
        await tools.update_chat_category!.execute(args, context),
      ).toHaveProperty("structuredContent");
      expect(chatWrites.updateOwnedChatCategory).toHaveBeenCalledTimes(2);
    });

    it("keeps Chat write versions separate between owners and from Note versions", async () => {
      const a = setup("a").tools;
      const b = setup("b").tools;
      const args = { id: "chat", categoryId: null, updatedAt: version };
      await a.get_chat.execute({ id: "chat" }, context);
      expect(
        await b.update_chat_category!.execute(args, context),
      ).toHaveProperty("error");
      reads.readOwnedNote.mockResolvedValueOnce({ ...note, id: "chat" });
      await b.get_note.execute({ id: "chat" }, context);
      expect(
        await b.update_chat_category!.execute(args, context),
      ).toHaveProperty("error");
      await b.get_chat.execute({ id: "chat" }, context);
      await a.update_chat_category!.execute(args, context);
      await b.update_chat_category!.execute(args, context);
      expect(
        chatWrites.updateOwnedChatCategory.mock.calls.map(([owner]) => owner),
      ).toEqual(["a", "b"]);
    });

    it.each([
      ["chat", true, null, undefined],
      ["chat", true, "new-category", "new-category"],
      ["other", true, "new-category", "old-category"],
      ["chat", false, "new-category", "old-category"],
    ] as const)(
      "updates the default Note category only after moving the active Chat: %s, success %s",
      async (id, succeeds, categoryId, expected) => {
        const { tools } = setup("owner", true, "old-category", "chat");
        chatReads.readOwnedChatPage.mockResolvedValueOnce({
          id,
          updatedAt: new Date(version),
          messages: [],
          nextOffset: null,
        });
        await tools.get_chat.execute({ id }, context);

        if (!succeeds) {
          chatWrites.updateOwnedChatCategory.mockRejectedValueOnce({
            statusCode: 409,
          });
        }

        await tools.update_chat_category!.execute(
          { id, categoryId, updatedAt: version },
          context,
        );
        await tools.create_note!.execute(
          { title: "Title", markdown: "Body" },
          context,
        );
        expect(writes.createOwnedNote).toHaveBeenCalledWith("owner", {
          title: "Title",
          markdown: "Body",
          ...(expected ? { categoryId: expected } : {}),
        });
      },
    );

    it("validates Chat category changes and blocks execution after cancellation or generation ownership loss", async () => {
      const { tools, controller } = setup();
      const args = { id: "chat", categoryId: null, updatedAt: version };
      await expect(
        tools.update_chat_category!.execute({ ...args, messages: [] }, context),
      ).rejects.toThrow();
      controller.abort();
      await expect(
        tools.update_chat_category!.execute(args, context),
      ).rejects.toThrow();
      const inactive = setup();
      inactive.assertActive.mockRejectedValue(new Error("no longer active"));
      await expect(
        inactive.tools.update_chat_category!.execute(args, context),
      ).rejects.toThrow();
      expect(chatWrites.updateOwnedChatCategory).not.toHaveBeenCalled();
    });
  });

  describe("Chat reads", () => {
    it.each([true, false])(
      "searches and reads saved Chats during normal turns and retries (%s)",
      async (allowMutations) => {
        const { tools, assertActive } = setup("owner", allowMutations);
        await tools.list_chats.execute({ q: "Question" }, context);
        expect(chatReads.searchOwnedChats).toHaveBeenCalledExactlyOnceWith(
          "owner",
          { q: "Question", limit: 20, offset: 0 },
        );
        expect(
          await tools.get_chat.execute({ id: "chat" }, context),
        ).toMatchObject({
          structuredContent: {
            id: "chat",
            updatedAt: version,
            url: "https://notes.example/chats/chat",
            messages: [{ content: "Question", createdAt: version }],
          },
        });
        expect(chatReads.readOwnedChatPage).toHaveBeenCalledExactlyOnceWith(
          "owner",
          { id: "chat", limit: 20, offset: 0 },
        );
        expect(assertActive).toHaveBeenCalledTimes(2);
      },
    );

    it("stops Chat reads on cancellation or loss of generation ownership", async () => {
      const cancelled = setup();
      cancelled.controller.abort();
      await expect(
        cancelled.tools.list_chats.execute({}, context),
      ).rejects.toThrow();
      await expect(
        cancelled.tools.get_chat.execute({ id: "chat" }, context),
      ).rejects.toThrow();
      const inactive = setup();
      inactive.assertActive.mockRejectedValue(new Error("no longer active"));
      await expect(
        inactive.tools.list_chats.execute({}, context),
      ).rejects.toThrow();
      await expect(
        inactive.tools.get_chat.execute({ id: "chat" }, context),
      ).rejects.toThrow();
      expect(chatReads.searchOwnedChats).not.toHaveBeenCalled();
      expect(chatReads.readOwnedChatPage).not.toHaveBeenCalled();
    });
  });

  describe("Category management and defaults", () => {
    it.each([true, false])(
      "reads Category counts for the session owner (mutations allowed: %s)",
      async (allowMutations) => {
        categories.findFirst.mockResolvedValue({
          id: "category",
          name: "Nuxt",
          _count: { notes: 2, chats: 4 },
        });
        const { tools, assertActive } = setup("owner", allowMutations);
        expect(
          await tools.get_category.execute({ id: "category" }, context),
        ).toMatchObject({
          structuredContent: {
            id: "category",
            name: "Nuxt",
            noteCount: 2,
            chatCount: 4,
          },
        });
        expect(categories.findFirst).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: "category", userId: "owner" },
          }),
        );
        expect(assertActive).toHaveBeenCalledOnce();
        expect(reads.readOwnedNote).not.toHaveBeenCalled();
        expect(CHAT_NOTES_INSTRUCTIONS).toContain("Use get_category");
      },
    );

    it("validates Category reads and stops after cancellation or generation ownership loss", async () => {
      const { tools, controller } = setup();
      await expect(
        tools.get_category.execute({ id: "" }, context),
      ).rejects.toThrow();
      controller.abort();
      await expect(
        tools.get_category.execute({ id: "category" }, context),
      ).rejects.toThrow();
      const inactive = setup();
      inactive.assertActive.mockRejectedValue(new Error("no longer active"));
      await expect(
        inactive.tools.get_category.execute({ id: "category" }, context),
      ).rejects.toThrow();
      expect(categories.findFirst).not.toHaveBeenCalled();
    });

    it("renames a Category for the active session owner and keeps the Chat category", async () => {
      categories.updateMany.mockResolvedValue({ count: 1 });
      const { tools, assertActive } = setup("owner", true, "chat-category");
      expect(
        await tools.update_category!.execute(
          { id: "chat-category", name: "  Ｎｕｘｔ  " },
          context,
        ),
      ).toMatchObject({
        structuredContent: { id: "chat-category", name: "Ｎｕｘｔ" },
      });
      expect(categories.updateMany).toHaveBeenCalledWith({
        where: { id: "chat-category", userId: "owner" },
        data: { name: "Ｎｕｘｔ", nameKey: "nuxt" },
      });
      expect(assertActive).toHaveBeenCalledOnce();
      await tools.create_note!.execute(
        { title: "Title", markdown: "Body" },
        context,
      );
      expect(writes.createOwnedNote).toHaveBeenCalledWith("owner", {
        title: "Title",
        markdown: "Body",
        categoryId: "chat-category",
      });
      expect(CHAT_NOTES_INSTRUCTIONS).toContain("Use update_category");
      expect(CHAT_NOTES_INSTRUCTIONS).not.toContain("Never rename Categories");
    });

    it("validates Category renaming and stops after cancellation or ownership loss", async () => {
      const input = { id: "category", name: "Nuxt" };
      const { tools, controller } = setup();
      await expect(
        tools.update_category!.execute({ ...input, userId: "other" }, context),
      ).rejects.toThrow();
      await expect(
        tools.update_category!.execute({ ...input, name: " " }, context),
      ).rejects.toThrow();
      controller.abort();
      await expect(
        tools.update_category!.execute(input, context),
      ).rejects.toThrow();
      const inactive = setup();
      inactive.assertActive.mockRejectedValue(new Error("no longer active"));
      await expect(
        inactive.tools.update_category!.execute(input, context),
      ).rejects.toThrow();
      expect(categories.updateMany).not.toHaveBeenCalled();
    });

    it("deletes a Category for the active session owner", async () => {
      categories.deleteMany.mockResolvedValue({ count: 1 });
      const { tools, assertActive } = setup("owner");
      expect(
        await tools.delete_category!.execute({ id: "category" }, context),
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
        if (input.categoryId === "chat-category") {
          throw Object.assign(new Error(), { statusCode: 404 });
        }

        return { ...note, categoryId: input.categoryId ?? null };
      });
      const { tools } = setup("owner", true, "chat-category");
      await tools.delete_category!.execute({ id: "chat-category" }, context);
      expect(
        await tools.create_note!.execute(
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
      await tools.create_note!.execute(
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
        await tools.delete_category!.execute({ id }, context);
        await tools.create_note!.execute(
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
        tools.delete_category!.execute(
          { id: "category", userId: "other" },
          context,
        ),
      ).rejects.toThrow();
      await expect(
        tools.delete_category!.execute({ id: "" }, context),
      ).rejects.toThrow();
      controller.abort();
      await expect(
        tools.delete_category!.execute({ id: "category" }, context),
      ).rejects.toThrow();
      const inactive = setup();
      inactive.assertActive.mockRejectedValue(new Error("no longer active"));
      await expect(
        inactive.tools.delete_category!.execute({ id: "category" }, context),
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
        await tools.create_category!.execute({ name: "  Ｎｕｘｔ  " }, context),
      ).toMatchObject({
        structuredContent: { id: "new-category", name: "Ｎｕｘｔ" },
      });
      expect(categories.create).toHaveBeenCalledWith({
        data: { name: "Ｎｕｘｔ", nameKey: "nuxt", userId: "owner" },
        select: { id: true, name: true },
      });
      await tools.create_note!.execute(
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
        tools.create_category!.execute(
          { name: "Nuxt", userId: "other" },
          context,
        ),
      ).rejects.toThrow();
      await expect(
        tools.create_category!.execute({ name: " " }, context),
      ).rejects.toThrow();
      controller.abort();
      await expect(
        tools.create_category!.execute({ name: "Nuxt" }, context),
      ).rejects.toThrow();
      const inactive = setup();
      inactive.assertActive.mockRejectedValue(new Error("no longer active"));
      await expect(
        inactive.tools.create_category!.execute({ name: "Nuxt" }, context),
      ).rejects.toThrow();
      expect(categories.create).not.toHaveBeenCalled();
    });

    it("lists existing categories for the session owner even during retries", async () => {
      categories.findMany.mockResolvedValue([{ id: "empty", name: "Empty" }]);
      const { tools, assertActive } = setup("owner", false);
      expect(await tools.list_categories.execute({}, context)).toMatchObject({
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
        await tools.create_note!.execute(
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
      await expect(
        tools.list_categories.execute({}, context),
      ).rejects.toThrow();
      expect(categories.findMany).not.toHaveBeenCalled();
    });
  });

  describe("Note reads and versioned mutations", () => {
    it("uses the authenticated owner and validates search defaults", async () => {
      const { tools, assertActive } = setup();
      await tools.list_notes.execute({}, context);
      expect(assertActive).toHaveBeenCalledOnce();
      expect(reads.searchOwnedNotes).toHaveBeenCalledWith("owner", {
        limit: 20,
        offset: 0,
      });
      await expect(
        tools.list_notes.execute({ limit: 51 }, context),
      ).rejects.toThrow();
      expect(reads.searchOwnedNotes).toHaveBeenCalledTimes(1);
    });

    it("serializes timestamps and links successful mutations", async () => {
      const { tools } = setup();
      expect(
        await tools.get_note.execute({ id: "note" }, context),
      ).toMatchObject({
        structuredContent: { updatedAt: version },
      });
      expect(
        await tools.create_note!.execute(
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
      expect(await tools.update_note!.execute(update, context)).toMatchObject({
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
      expect(await tools.get_note.execute({ id }, context)).toMatchObject({
        structuredContent: { id: "note", updatedAt: version },
      });
      expect(reads.readOwnedNote).toHaveBeenCalledExactlyOnceWith(
        "owner",
        "note",
      );
      expect(reads.searchOwnedNotes).not.toHaveBeenCalled();
      expect(await tools.update_note!.execute(update, context)).toHaveProperty(
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
      expect(await tools.get_note.execute({ id }, context)).toMatchObject({
        isError: true,
      });
      expect(reads.readOwnedNote).not.toHaveBeenCalled();
    });

    it("does not retain a write version after a subsequent failed read", async () => {
      const { tools } = setup();
      await tools.get_note.execute({ id: "note" }, context);
      reads.readOwnedNote.mockRejectedValueOnce({ statusCode: 404 });
      await tools.get_note.execute({ id: "/notes/note" }, context);
      expect(await tools.update_note!.execute(update, context)).toHaveProperty(
        "error",
      );
      expect(writes.updateOwnedNote).not.toHaveBeenCalled();
    });

    it.each(["update_note", "delete_note"] as const)(
      "requires reading the exact version before %s",
      async (name) => {
        const { tools } = setup();
        const args = name === "update_note" ? update : input;
        const execute = () => tools[name]!.execute(args, context);
        expect(await execute()).toMatchObject({
          error: expect.stringContaining("get_note"),
        });
        expect(writes.updateOwnedNote).not.toHaveBeenCalled();
        expect(writes.deleteOwnedNote).not.toHaveBeenCalled();
        await tools.get_note.execute({ id: "note" }, context);
        expect(await execute()).toHaveProperty("structuredContent");
        expect(await execute()).toHaveProperty("error");
      },
    );

    it.each([null, "category"])(
      "changes only the category to %j using a listed version without reading the body",
      async (categoryId) => {
        reads.searchOwnedNotes.mockResolvedValue({
          notes: [{ id: "note", updatedAt: new Date(version) }],
          nextOffset: null,
        });
        const { tools, assertActive } = setup();
        const args = { ...input, categoryId };
        expect(
          await tools.update_note_category!.execute(args, context),
        ).toHaveProperty("error");
        await tools.list_notes.execute({}, context);
        expect(
          await tools.update_note_category!.execute(
            { ...args, updatedAt: "2026-11-13T00:00:01.000Z" },
            context,
          ),
        ).toHaveProperty("error");
        expect(
          await tools.update_note!.execute(update, context),
        ).toHaveProperty("error");
        expect(await tools.delete_note!.execute(input, context)).toHaveProperty(
          "error",
        );
        expect(
          await tools.update_note_category!.execute(args, context),
        ).toMatchObject({
          structuredContent: {
            updatedAt: version,
            url: "https://notes.example/notes/note",
          },
        });
        expect(writes.updateOwnedNoteCategory).toHaveBeenCalledExactlyOnceWith(
          "owner",
          args,
        );
        expect(reads.readOwnedNote).not.toHaveBeenCalled();
        expect(assertActive).toHaveBeenCalled();
        expect(
          await tools.update_note_category!.execute(args, context),
        ).toHaveProperty("error");
      },
    );

    it("keeps earlier page versions and refreshes Notes returned by a later list", async () => {
      const { tools } = setup();
      const newerVersion = "2026-11-13T00:00:01.000Z";
      reads.searchOwnedNotes
        .mockResolvedValueOnce({
          notes: [{ id: "note", updatedAt: new Date(version) }],
          nextOffset: 1,
        })
        .mockResolvedValueOnce({
          notes: [{ id: "second", updatedAt: new Date(version) }],
          nextOffset: null,
        });
      const firstPage = await tools.list_notes.execute({ limit: 1 }, context);

      if (!("structuredContent" in firstPage)) {
        throw new Error("Expected a Note list result.");
      }

      const nextOffset = firstPage.structuredContent?.nextOffset;

      if (typeof nextOffset !== "number") {
        throw new Error("Expected another page of Notes.");
      }

      await tools.list_notes.execute({ limit: 1, offset: nextOffset }, context);
      const args = { ...input, categoryId: null };
      expect(
        await tools.update_note_category!.execute(args, context),
      ).toHaveProperty("structuredContent");
      expect(writes.updateOwnedNoteCategory).toHaveBeenCalledExactlyOnceWith(
        "owner",
        args,
      );
      reads.searchOwnedNotes.mockResolvedValueOnce({
        notes: [{ id: "second", updatedAt: new Date(newerVersion) }],
        nextOffset: null,
      });
      await tools.list_notes.execute({}, context);
      expect(
        await tools.update_note_category!.execute(
          { ...args, id: "second" },
          context,
        ),
      ).toHaveProperty("error");
      expect(
        await tools.update_note_category!.execute(
          {
            ...args,
            id: "second",
            updatedAt: newerVersion,
          },
          context,
        ),
      ).toHaveProperty("structuredContent");
      expect(reads.readOwnedNote).not.toHaveBeenCalled();
    });

    it("consumes category and full-read versions on conflict and permits reassessment from a fresh list", async () => {
      const { tools } = setup();
      const args = { ...input, categoryId: null };
      await tools.get_note.execute({ id: "note" }, context);
      writes.updateOwnedNoteCategory.mockRejectedValueOnce({ statusCode: 409 });
      expect(
        await tools.update_note_category!.execute(args, context),
      ).toMatchObject({ isError: true });
      expect(
        await tools.update_note_category!.execute(args, context),
      ).toHaveProperty("error");
      expect(await tools.update_note!.execute(update, context)).toHaveProperty(
        "error",
      );
      expect(await tools.delete_note!.execute(input, context)).toHaveProperty(
        "error",
      );
      reads.searchOwnedNotes.mockResolvedValue({
        notes: [{ id: "note", updatedAt: new Date(version) }],
        nextOffset: null,
      });
      await tools.list_notes.execute({}, context);
      expect(
        await tools.update_note_category!.execute(args, context),
      ).toHaveProperty("structuredContent");
      expect(writes.updateOwnedNoteCategory).toHaveBeenCalledTimes(2);
    });

    it("isolates category versions and invalidates them after a failed read", async () => {
      const a = setup("a").tools;
      const b = setup("b").tools;
      const args = { ...input, categoryId: null };
      await a.get_note.execute({ id: "note" }, context);
      expect(
        await b.update_note_category!.execute(args, context),
      ).toHaveProperty("error");
      reads.readOwnedNote.mockRejectedValueOnce({ statusCode: 404 });
      await a.get_note.execute({ id: "note" }, context);
      expect(
        await a.update_note_category!.execute(args, context),
      ).toHaveProperty("error");
      expect(writes.updateOwnedNoteCategory).not.toHaveBeenCalled();
    });

    it("validates category-only changes and stops after cancellation or generation ownership loss", async () => {
      const { tools, controller } = setup();
      const args = { ...input, categoryId: null };
      await expect(
        tools.update_note_category!.execute(
          { ...args, markdown: "body" },
          context,
        ),
      ).rejects.toThrow();
      controller.abort();
      await expect(
        tools.update_note_category!.execute(args, context),
      ).rejects.toThrow();
      const inactive = setup();
      inactive.assertActive.mockRejectedValue(new Error("no longer active"));
      await expect(
        inactive.tools.update_note_category!.execute(args, context),
      ).rejects.toThrow();
      expect(writes.updateOwnedNoteCategory).not.toHaveBeenCalled();
    });

    it("blocks another deletion after a conflict even if the model reads again", async () => {
      const { tools } = setup();
      writes.deleteOwnedNote.mockRejectedValue({ statusCode: 409 });
      await tools.get_note.execute({ id: "note" }, context);
      expect(await tools.delete_note!.execute(input, context)).toMatchObject({
        isError: true,
      });
      await tools.get_note.execute({ id: "note" }, context);
      expect(await tools.delete_note!.execute(input, context)).toMatchObject({
        error: expect.stringContaining("confirm deletion"),
      });
      expect(writes.deleteOwnedNote).toHaveBeenCalledOnce();
    });

    it("does not grant a version for a missing or foreign Note", async () => {
      const { tools } = setup();
      reads.readOwnedNote.mockRejectedValue({ statusCode: 404 });
      expect(
        await tools.get_note.execute({ id: "note" }, context),
      ).toMatchObject({ isError: true });
      expect(await tools.delete_note!.execute(input, context)).toHaveProperty(
        "error",
      );
      expect(writes.deleteOwnedNote).not.toHaveBeenCalled();
    });

    it("isolates owners and read versions between concurrent requests", async () => {
      const a = setup("a").tools;
      const b = setup("b").tools;
      await a.get_note.execute({ id: "note" }, context);
      expect(await b.update_note!.execute(update, context)).toHaveProperty(
        "error",
      );
      await b.get_note.execute({ id: "note" }, context);
      await Promise.all([
        a.update_note!.execute(update, context),
        b.update_note!.execute(update, context),
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

      const result = await tools.create_note!.execute(
        { title: "Title", markdown: "" },
        context,
      );

      expect(result).toMatchObject({ isError: true });
      expect(JSON.stringify(result)).not.toContain("private database detail");
      await expect(
        tools.create_note!.execute(
          { title: "Title", markdown: "", userId: "other" },
          context,
        ),
      ).rejects.toThrow();
      expect(writes.createOwnedNote).toHaveBeenCalledTimes(1);
    });
  });

  describe("Cancellation and retry permissions", () => {
    it("stops before operating after cancellation or loss of generation ownership", async () => {
      const cancelled = setup();
      cancelled.controller.abort();
      await expect(
        cancelled.tools.list_notes.execute({}, context),
      ).rejects.toThrow();
      const inactive = setup();
      inactive.assertActive.mockRejectedValue(new Error("no longer active"));
      await expect(
        inactive.tools.create_note!.execute(
          { title: "Title", markdown: "" },
          context,
        ),
      ).rejects.toThrow();
      expect(reads.searchOwnedNotes).not.toHaveBeenCalled();
      expect(writes.createOwnedNote).not.toHaveBeenCalled();
    });

    it("does not expose writes during retries", () => {
      expect(Object.keys(setup("owner", false).tools).sort()).toEqual([
        "get_category",
        "get_chat",
        "get_note",
        "list_categories",
        "list_chats",
        "list_notes",
      ]);
    });
  });
});

it.each([
  [false, false],
  [true, false],
  [false, true],
])(
  "edits a Note through the AI SDK loop (known link: %s, category only: %s)",
  async (knownLink, categoryOnly) => {
    if (knownLink) {
      const creator = setup().tools;
      await creator.create_note!.execute(
        { title: "Title", markdown: "# Note" },
        context,
      );
    }

    // Every new chat message receives a fresh tool instance and must read again.
    const { tools } = setup();
    reads.searchOwnedNotes.mockResolvedValue({
      notes: [{ id: "note", title: "Title", updatedAt: new Date(version) }],
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
        ...(categoryOnly
          ? []
          : [
              toolStep(
                "get_note",
                { id: knownLink ? "https://notes.example/notes/note" : "note" },
                2,
              ),
            ]),
        toolStep(
          categoryOnly ? "update_note_category" : "update_note",
          categoryOnly ? { ...input, categoryId: null } : update,
          3,
        ),
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
        : [
            {
              role: "user",
              content: categoryOnly
                ? "Find Title and move it to Uncategorized."
                : "Find Title and update its content.",
            },
          ],
      stopWhen: stepCountIs(8),
      maxRetries: 0,
    });

    const parts = [];
    for await (const part of result.stream) parts.push(part);
    expect(parts.filter((part) => part.type === "tool-result")).toHaveLength(
      knownLink || categoryOnly ? 2 : 3,
    );
    expect(
      parts.filter(
        (part) => part.type === "tool-error" || part.type === "error",
      ),
    ).toEqual([]);
    expect(await result.text).toBe(
      "Updated [Title](https://notes.example/notes/note).",
    );

    if (categoryOnly) {
      expect(writes.updateOwnedNoteCategory).toHaveBeenCalledExactlyOnceWith(
        "owner",
        { ...input, categoryId: null },
      );
      expect(reads.readOwnedNote).not.toHaveBeenCalled();
      expect(writes.updateOwnedNote).not.toHaveBeenCalled();
    } else {
      expect(writes.updateOwnedNote).toHaveBeenCalledExactlyOnceWith(
        "owner",
        update,
      );
    }

    expect(model.doStreamCalls).toHaveLength(knownLink || categoryOnly ? 3 : 4);
    if (knownLink) expect(reads.searchOwnedNotes).not.toHaveBeenCalled();
    expect(JSON.stringify(model.doStreamCalls.at(-1)!.prompt)).toContain(
      "https://notes.example/notes/note",
    );
  },
);
