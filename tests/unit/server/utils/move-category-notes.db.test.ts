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
import { PrismaClient } from "../../../../generated/prisma/client";
import { getPrisma } from "../../../../server/utils/prisma";
import {
  moveOwnedCategoryNotes,
  updateOwnedNoteTitle,
} from "../../../../server/utils/note-writes";

vi.mock("../../../../server/utils/prisma", () => ({ getPrisma: vi.fn() }));
vi.mock("nuxt/server", () => ({
  createError: (details: object) => Object.assign(new Error(), details),
}));

// Opt-in only; never reads .env or connects to the application's database.
// Apply the initial migration to a disposable local DB named nuxt_note_move_test*, then run:
// NUXT_NOTE_MOVE_TEST_DATABASE_URL=... pnpm test --project unit tests/unit/server/utils/move-category-notes.db.test.ts
const connectionString = process.env.NUXT_NOTE_MOVE_TEST_DATABASE_URL;
describe.skipIf(!connectionString)("bulk Note moves in PostgreSQL", () => {
  let db: PrismaClient;
  const owner = randomUUID();
  const other = randomUUID();
  const source = randomUUID();
  const target = randomUUID();
  const foreign = randomUUID();
  const noteId = randomUUID();
  const uncategorized = randomUUID();
  const applicationName = `bulk-move-test-${randomUUID()}`;
  const version = new Date("2100-01-01T00:00:00.000Z");

  beforeAll(() => {
    if (!connectionString) {
      throw new Error("A disposable database URL is required");
    }
    const url = new URL(connectionString);
    if (
      url.hostname !== "127.0.0.1" ||
      !url.pathname.startsWith("/nuxt_note_move_test")
    ) {
      throw new Error("Use a disposable local nuxt_note_move_test database");
    }
    url.searchParams.set("application_name", applicationName);
    db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url.href, max: 5 }),
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
      data: { userId: owner, categoryId: source, title: "Keep this Chat" },
    });
  });
  afterEach(async () => {
    await db.user.deleteMany({ where: { id: { in: [owner, other] } } });
  });
  afterAll(async () => {
    if (db) await db.$disconnect();
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
