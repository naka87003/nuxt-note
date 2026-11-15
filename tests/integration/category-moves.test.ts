import { randomUUID } from "node:crypto";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "~~/generated/prisma/client";
import { getPrisma } from "~~/server/utils/prisma";
import {
  moveOwnedCategoryNotes,
  updateOwnedNoteTitle,
} from "~~/server/utils/note-writes";
import {
  moveOwnedCategoryChats,
  updateOwnedChatTitle,
  deleteOwnedChat,
} from "~~/server/utils/chat-writes";
import { mergeOwnedCategories } from "~~/server/utils/category-merges";
import { saveGeneration } from "~~/server/utils/chat-generation";

vi.mock("~~/server/utils/prisma", () => ({ getPrisma: vi.fn() }));
vi.mock("nuxt/server", () => ({
  createError: (details: object) => Object.assign(new Error(), details),
}));

// Explicit integration suite; never reads .env or uses the application's DB URL.
const connectionString = process.env.NUXT_NOTE_MOVE_TEST_DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "NUXT_NOTE_MOVE_TEST_DATABASE_URL is required for the integration suite.",
  );
}

const databaseUrl = new URL(connectionString);

if (
  databaseUrl.hostname !== "127.0.0.1" ||
  !databaseUrl.pathname.startsWith("/nuxt_note_move_test")
) {
  throw new Error("Use a disposable local nuxt_note_move_test database");
}

describe("bulk category moves in PostgreSQL", () => {
  let db: PrismaClient;
  const owner = randomUUID();
  const other = randomUUID();
  const source = randomUUID();
  const target = randomUUID();
  const foreign = randomUUID();
  const noteId = randomUUID();
  const chatId = randomUUID();
  const uncategorized = randomUUID();
  const applicationName = `bulk-move-test-${randomUUID()}`;
  const version = new Date("2100-01-01T00:00:00.000Z");

  beforeAll(() => {
    databaseUrl.searchParams.set("application_name", applicationName);
    db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: databaseUrl.href, max: 5 }),
    });
    vi.mocked(getPrisma).mockReturnValue(db);
  });

  beforeEach(async () => {
    await db.user.createMany({
      data: [owner, other].map((id) => ({
        id,
        githubId: id,
        githubLogin: id,
        name: "Test",
      })),
    });
    await db.category.createMany({
      data: [
        { id: source, userId: owner, name: "Source", nameKey: "source" },
        { id: target, userId: owner, name: "Target", nameKey: "target" },
        { id: foreign, userId: other, name: "Foreign", nameKey: "foreign" },
      ],
    });
    await db.note.createMany({
      data: [
        {
          id: noteId,
          userId: owner,
          categoryId: source,
          title: "Original title",
          markdown: "# Original",
          updatedAt: version,
        },
        {
          userId: owner,
          categoryId: target,
          title: "Target note",
          markdown: "Target",
          updatedAt: version,
        },
        {
          id: uncategorized,
          userId: owner,
          categoryId: null,
          title: "Uncategorized",
          markdown: "Uncategorized",
          updatedAt: version,
        },
        {
          userId: other,
          categoryId: source,
          title: "Other owner",
          markdown: "Secret",
          updatedAt: version,
        },
      ],
    });
    await db.chat.create({
      data: {
        id: chatId,
        userId: owner,
        categoryId: source,
        title: "Keep this Chat",
        updatedAt: version,
        generationId: "attempt",
        generationStartedAt: version,
        messages: {
          create: [
            { role: "user", content: "Original question" },
            {
              role: "assistant",
              content: "Partial answer",
              status: "generating",
            },
          ],
        },
      },
    });
  });
  afterEach(async () => {
    await db.user.deleteMany({ where: { id: { in: [owner, other] } } });
  });
  afterAll(async () => {
    if (db) await db.$disconnect();
  });

  it("merges Notes and Chats, deletes only the source, and preserves content and active generation", async () => {
    // Remove the deliberately invalid cross-owner assignment from the move fixture.
    await db.note.deleteMany({ where: { userId: other, categoryId: source } });

    const beforeNote = await db.note.findUniqueOrThrow({
      where: { id: noteId },
    });

    const beforeChat = await db.chat.findUniqueOrThrow({
      where: { id: chatId },
      include: { messages: { orderBy: { id: "asc" } } },
    });

    const beforeTarget = await db.category.findUniqueOrThrow({
      where: { id: target },
    });

    const untouched = await db.note.findMany({
      where: { id: { not: noteId } },
      orderBy: { id: "asc" },
    });

    expect(
      await mergeOwnedCategories(
        owner,
        { sourceCategoryId: source, targetCategoryId: target },
        chatId,
      ),
    ).toEqual({
      sourceCategoryId: source,
      targetCategoryId: target,
      movedNoteCount: 1,
      movedChatCount: 1,
      currentChatMoved: true,
    });
    expect(await db.category.findUnique({ where: { id: source } })).toBeNull();
    expect(await db.category.findUnique({ where: { id: target } })).toEqual(
      beforeTarget,
    );
    expect(await db.note.findUniqueOrThrow({ where: { id: noteId } })).toEqual({
      ...beforeNote,
      categoryId: target,
      updatedAt: new Date(version.getTime() + 1),
    });
    expect(
      await db.chat.findUniqueOrThrow({
        where: { id: chatId },
        include: { messages: { orderBy: { id: "asc" } } },
      }),
    ).toEqual({
      ...beforeChat,
      categoryId: target,
      updatedAt: new Date(version.getTime() + 1),
    });
    expect(
      await db.note.findMany({
        where: { id: { not: noteId } },
        orderBy: { id: "asc" },
      }),
    ).toEqual(untouched);
    await expect(
      updateOwnedNoteTitle(owner, {
        id: noteId,
        title: "Stale title",
        updatedAt: version.toISOString(),
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    await expect(
      updateOwnedChatTitle(owner, {
        id: chatId,
        title: "Stale title",
        updatedAt: version.toISOString(),
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    const reply = beforeChat.messages.find(
      (message) => message.role === "assistant",
    );

    if (!reply) throw new Error("Missing fixture reply");
    expect(
      await saveGeneration(
        owner,
        chatId,
        "attempt",
        reply.id,
        "Continued answer",
        "generating",
      ),
    ).toBe(true);
    expect(
      await db.chat.findUniqueOrThrow({ where: { id: chatId } }),
    ).toMatchObject({ categoryId: target, generationId: "attempt" });
  });

  it("deletes an empty source without changing the current Chat or existing content", async () => {
    const empty = await db.category.create({
      data: { userId: owner, name: "Empty", nameKey: "empty" },
    });

    expect(
      await mergeOwnedCategories(
        owner,
        { sourceCategoryId: empty.id, targetCategoryId: target },
        chatId,
      ),
    ).toEqual({
      sourceCategoryId: empty.id,
      targetCategoryId: target,
      movedNoteCount: 0,
      movedChatCount: 0,
      currentChatMoved: false,
    });
    expect(
      await db.category.findUnique({ where: { id: empty.id } }),
    ).toBeNull();
    expect(
      await db.note.findUniqueOrThrow({ where: { id: noteId } }),
    ).toMatchObject({ categoryId: source, updatedAt: version });
    expect(
      await db.chat.findUniqueOrThrow({ where: { id: chatId } }),
    ).toMatchObject({ categoryId: source, updatedAt: version });
  });

  it("rolls back both moves if any assignment remains at deletion, preserving other owners", async () => {
    const notes = await db.note.findMany({ orderBy: { id: "asc" } });

    const chats = await db.chat.findMany({
      include: { messages: true },
      orderBy: { id: "asc" },
    });

    const categories = await db.category.findMany({ orderBy: { id: "asc" } });
    // The move fixture intentionally includes another owner's Note linked to the source.
    await expect(
      mergeOwnedCategories(
        owner,
        { sourceCategoryId: source, targetCategoryId: target },
        chatId,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(await db.note.findMany({ orderBy: { id: "asc" } })).toEqual(notes);
    expect(
      await db.chat.findMany({
        include: { messages: true },
        orderBy: { id: "asc" },
      }),
    ).toEqual(chats);
    expect(await db.category.findMany({ orderBy: { id: "asc" } })).toEqual(
      categories,
    );
  });

  it.each(["source", "target", "missing"])(
    "rejects merges with foreign or missing Categories (%s)",
    async (kind) => {
      const notes = await db.note.findMany({ orderBy: { id: "asc" } });
      const chats = await db.chat.findMany({ orderBy: { id: "asc" } });
      await expect(
        mergeOwnedCategories(owner, {
          sourceCategoryId: kind === "source" ? foreign : source,
          targetCategoryId:
            kind === "target"
              ? foreign
              : kind === "missing"
                ? randomUUID()
                : target,
        }),
      ).rejects.toMatchObject({ statusCode: 404 });
      expect(await db.note.findMany({ orderBy: { id: "asc" } })).toEqual(notes);
      expect(await db.chat.findMany({ orderBy: { id: "asc" } })).toEqual(chats);
      expect(await db.category.count({ where: { userId: owner } })).toBe(2);
    },
  );

  it("blocks new assignments to the source during a merge instead of silently uncategorizing them", async () => {
    await db.note.deleteMany({ where: { userId: other, categoryId: source } });
    const locked = Promise.withResolvers<undefined>();
    const release = Promise.withResolvers<undefined>();

    const holding = db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Note" WHERE "id" = ${noteId} FOR UPDATE`;
      locked.resolve(undefined);
      await release.promise;
    });

    await locked.promise;

    const merging = mergeOwnedCategories(
      owner,
      { sourceCategoryId: source, targetCategoryId: target },
      chatId,
    );

    let inserting: Promise<unknown> | undefined;

    try {
      await vi.waitFor(
        async () => {
          const [activity] = await db.$queryRaw<{ waiting: boolean }[]>`
          SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE application_name = ${applicationName}
            AND wait_event_type = 'Lock' AND query LIKE '%UPDATE "Note"%') AS waiting
        `;

          expect(activity?.waiting).toBe(true);
        },
        { timeout: 2000, interval: 25 },
      );
      inserting = db.note
        .create({
          data: { userId: owner, categoryId: source, title: "Concurrent Note" },
        })
        .then(
          () => ({ created: true }),
          (error: unknown) => error,
        );
      await vi.waitFor(
        async () => {
          const [activity] = await db.$queryRaw<{ waiting: boolean }[]>`
          SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE application_name = ${applicationName}
            AND wait_event_type = 'Lock' AND query LIKE '%INSERT INTO%Note%') AS waiting
        `;

          expect(activity?.waiting).toBe(true);
        },
        { timeout: 2000, interval: 25 },
      );
    } finally {
      release.resolve(undefined);
      await holding;
      await merging;
    }

    expect(await merging).toMatchObject({
      movedNoteCount: 1,
      movedChatCount: 1,
      currentChatMoved: true,
    });
    expect(await inserting).toMatchObject({ code: "P2003" });
    expect(await db.note.count({ where: { title: "Concurrent Note" } })).toBe(
      0,
    );
    expect(await db.category.findUnique({ where: { id: source } })).toBeNull();
  });

  it("moves only owned Chats, preserving messages, generation state, Notes, and Categories", async () => {
    const otherChat = await db.chat.create({
      data: { userId: other, categoryId: source, title: "Other owner's Chat" },
    });

    const before = await db.chat.findUniqueOrThrow({
      where: { id: chatId },
      include: { messages: { orderBy: { id: "asc" } } },
    });

    const notes = await db.note.findMany({ orderBy: { id: "asc" } });
    expect(
      await moveOwnedCategoryChats(
        owner,
        { sourceCategoryId: source, targetCategoryId: target },
        chatId,
      ),
    ).toEqual({
      sourceCategoryId: source,
      targetCategoryId: target,
      movedCount: 1,
      currentChatMoved: true,
    });
    expect(
      await db.chat.findUniqueOrThrow({
        where: { id: chatId },
        include: { messages: { orderBy: { id: "asc" } } },
      }),
    ).toEqual({
      ...before,
      categoryId: target,
      updatedAt: new Date(version.getTime() + 1),
    });
    expect(
      await db.chat.findUniqueOrThrow({ where: { id: otherChat.id } }),
    ).toMatchObject({ categoryId: source, title: "Other owner's Chat" });
    expect(await db.note.findMany({ orderBy: { id: "asc" } })).toEqual(notes);
    expect(await db.category.count({ where: { userId: owner } })).toBe(2);
    await expect(
      updateOwnedChatTitle(owner, {
        id: chatId,
        title: "Stale title",
        updatedAt: version.toISOString(),
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    await expect(
      deleteOwnedChat(owner, chatId, { updatedAt: version.toISOString() }),
    ).rejects.toMatchObject({ statusCode: 409 });

    const reply = before.messages.find(
      (message) => message.role === "assistant",
    );

    if (!reply) throw new Error("Missing fixture reply");
    expect(
      await saveGeneration(
        owner,
        chatId,
        "attempt",
        reply.id,
        "Continued answer",
        "generating",
      ),
    ).toBe(true);
    expect(
      await db.chat.findUniqueOrThrow({ where: { id: chatId } }),
    ).toMatchObject({ categoryId: target, generationId: "attempt" });
    expect(
      await db.message.findUniqueOrThrow({ where: { id: reply.id } }),
    ).toMatchObject({ content: "Continued answer", status: "generating" });
  });

  it("handles Uncategorized Chats and identifies whether the current Chat actually moved", async () => {
    const uncategorizedChat = await db.chat.create({
      data: { userId: owner, title: "Uncategorized Chat", updatedAt: version },
    });

    expect(
      await moveOwnedCategoryChats(
        owner,
        { sourceCategoryId: null, targetCategoryId: target },
        chatId,
      ),
    ).toEqual({
      sourceCategoryId: null,
      targetCategoryId: target,
      movedCount: 1,
      currentChatMoved: false,
    });
    expect(
      await moveOwnedCategoryChats(
        owner,
        { sourceCategoryId: source, targetCategoryId: null },
        chatId,
      ),
    ).toEqual({
      sourceCategoryId: source,
      targetCategoryId: null,
      movedCount: 1,
      currentChatMoved: true,
    });
    expect(
      await db.chat.findUniqueOrThrow({ where: { id: uncategorizedChat.id } }),
    ).toMatchObject({
      categoryId: target,
      updatedAt: new Date(version.getTime() + 1),
    });
    expect(
      await moveOwnedCategoryChats(
        owner,
        { sourceCategoryId: source, targetCategoryId: target },
        chatId,
      ),
    ).toEqual({
      sourceCategoryId: source,
      targetCategoryId: target,
      movedCount: 0,
      currentChatMoved: false,
    });
  });

  it.each(["source", "target", "missing"])(
    "does not change Chats when a Category is foreign or missing: %s",
    async (kind) => {
      const before = await db.chat.findMany({ orderBy: { id: "asc" } });
      await expect(
        moveOwnedCategoryChats(
          owner,
          {
            sourceCategoryId: kind === "source" ? foreign : source,
            targetCategoryId:
              kind === "target"
                ? foreign
                : kind === "missing"
                  ? randomUUID()
                  : target,
          },
          chatId,
        ),
      ).rejects.toMatchObject({ statusCode: 404 });
      expect(await db.chat.findMany({ orderBy: { id: "asc" } })).toEqual(
        before,
      );
    },
  );

  it("does not pull back a Chat concurrently moved out of the source", async () => {
    const locked = Promise.withResolvers<undefined>();
    const release = Promise.withResolvers<undefined>();

    const concurrentMove = db.$transaction(async (tx) => {
      await tx.chat.update({
        where: { id: chatId },
        data: { categoryId: null },
      });
      locked.resolve(undefined);
      await release.promise;
    });

    await locked.promise;

    const bulkMove = moveOwnedCategoryChats(
      owner,
      { sourceCategoryId: source, targetCategoryId: target },
      chatId,
    );

    try {
      await vi.waitFor(
        async () => {
          const [activity] = await db.$queryRaw<{ waiting: boolean }[]>`
          SELECT EXISTS (
            SELECT 1 FROM pg_stat_activity WHERE application_name = ${applicationName}
              AND wait_event_type = 'Lock' AND query LIKE '%UPDATE "Chat"%'
          ) AS waiting
        `;

          expect(activity?.waiting).toBe(true);
        },
        { timeout: 2000, interval: 25 },
      );
    } finally {
      release.resolve(undefined);
      await concurrentMove;
      await bulkMove;
    }

    expect(await bulkMove).toMatchObject({
      movedCount: 0,
      currentChatMoved: false,
    });
    expect(
      await db.chat.findUniqueOrThrow({ where: { id: chatId } }),
    ).toMatchObject({ categoryId: null, generationId: "attempt" });
  });

  it("moves only matching owned Notes, preserves content and Chats, and advances future timestamps", async () => {
    expect(
      await moveOwnedCategoryNotes(owner, {
        sourceCategoryId: source,
        targetCategoryId: target,
      }),
    ).toEqual({
      sourceCategoryId: source,
      targetCategoryId: target,
      movedCount: 1,
    });
    expect(await db.note.findUnique({ where: { id: noteId } })).toMatchObject({
      title: "Original title",
      markdown: "# Original",
      categoryId: target,
      updatedAt: new Date(version.getTime() + 1),
    });
    expect(await db.note.findMany({ where: { userId: other } })).toMatchObject([
      { categoryId: source, markdown: "Secret", updatedAt: version },
    ]);
    expect(await db.chat.findMany({ where: { userId: owner } })).toMatchObject([
      { categoryId: source, title: "Keep this Chat" },
    ]);
    expect(await db.category.count({ where: { userId: owner } })).toBe(2);
    await expect(
      updateOwnedNoteTitle(owner, {
        id: noteId,
        title: "Stale edit",
        updatedAt: version.toISOString(),
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("moves Uncategorized Notes and can move Notes back to Uncategorized", async () => {
    expect(
      (
        await moveOwnedCategoryNotes(owner, {
          sourceCategoryId: null,
          targetCategoryId: source,
        })
      ).movedCount,
    ).toBe(1);
    expect(
      (
        await moveOwnedCategoryNotes(owner, {
          sourceCategoryId: source,
          targetCategoryId: null,
        })
      ).movedCount,
    ).toBe(2);
    expect(
      await db.note.findUnique({ where: { id: uncategorized } }),
    ).toMatchObject({
      categoryId: null,
      updatedAt: new Date(version.getTime() + 2),
    });
  });

  it.each(["source", "target", "missing"])(
    "does not change Notes when a Category is foreign or missing: %s",
    async (kind) => {
      const before = await db.note.findMany({ orderBy: { id: "asc" } });
      await expect(
        moveOwnedCategoryNotes(owner, {
          sourceCategoryId: kind === "source" ? foreign : source,
          targetCategoryId:
            kind === "target"
              ? foreign
              : kind === "missing"
                ? randomUUID()
                : target,
        }),
      ).rejects.toMatchObject({ statusCode: 404 });
      expect(await db.note.findMany({ orderBy: { id: "asc" } })).toEqual(
        before,
      );
    },
  );

  it("returns zero without changing versions for an empty source", async () => {
    const empty = await db.category.create({
      data: { userId: owner, name: "Empty", nameKey: "empty" },
    });

    expect(
      (
        await moveOwnedCategoryNotes(owner, {
          sourceCategoryId: empty.id,
          targetCategoryId: target,
        })
      ).movedCount,
    ).toBe(0);
    expect(await db.note.findUnique({ where: { id: noteId } })).toMatchObject({
      updatedAt: version,
      categoryId: source,
    });
  });

  it("does not pull back a Note concurrently moved out of the source", async () => {
    const locked = Promise.withResolvers<undefined>();
    const release = Promise.withResolvers<undefined>();

    const concurrentMove = db.$transaction(async (tx) => {
      await tx.note.update({
        where: { id: noteId },
        data: { categoryId: null },
      });
      locked.resolve(undefined);
      await release.promise;
    });

    await locked.promise;

    const bulkMove = moveOwnedCategoryNotes(owner, {
      sourceCategoryId: source,
      targetCategoryId: target,
    });

    try {
      await vi.waitFor(
        async () => {
          const [activity] = await db.$queryRaw<{ waiting: boolean }[]>`
          SELECT EXISTS (
            SELECT 1 FROM pg_stat_activity
            WHERE application_name = ${applicationName}
              AND wait_event_type = 'Lock' AND query LIKE '%UPDATE "Note"%'
          ) AS waiting
        `;

          expect(activity?.waiting).toBe(true);
        },
        { timeout: 2000, interval: 25 },
      );
    } finally {
      release.resolve(undefined);
      await concurrentMove;
      await bulkMove;
    }

    expect((await bulkMove).movedCount).toBe(0);
    expect(await db.note.findUnique({ where: { id: noteId } })).toMatchObject({
      categoryId: null,
    });
  });
});
