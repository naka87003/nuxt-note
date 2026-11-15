import { Prisma } from "../../generated/prisma/client";
import { normalizeNoteContent, normalizeNoteTitle } from "./notes";
import { ownedCategory } from "./categories";
import { getPrisma } from "./prisma";
import { createError } from "nuxt/server";
import {
  createNoteInputSchema,
  updateNoteInputSchema,
  updateNoteCategoryInputSchema,
  updateNoteTitleInputSchema,
  deleteNoteInputSchema,
  moveCategoryNotesInputSchema,
} from "./input-schemas";
import { parseInput } from "./parse-input";

const savedNoteMetadataSelect = {
  id: true,
  title: true,
  categoryId: true,
  createdAt: true,
  updatedAt: true,
} as const;

const savedNoteSelect = { ...savedNoteMetadataSelect, markdown: true } as const;

export async function moveOwnedCategoryNotes(userId: string, body: unknown) {
  const input = parseInput(moveCategoryNotesInputSchema, body);
  const categoryIds = [input.sourceCategoryId, input.targetCategoryId].filter(
    (id) => id !== null,
  );
  return getPrisma().$transaction(async (tx) => {
    // Keep both Categories owned and present until the move commits.
    const categories = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Category"
      WHERE "userId" = ${userId} AND "id" IN (${Prisma.join(categoryIds)})
      ORDER BY "id" FOR SHARE
    `;
    if (categories.length !== categoryIds.length) {
      throw createError({
        statusCode: 404,
        statusMessage: "Category not found",
      });
    }
    // One atomic update; advance every version even within the same millisecond.
    const movedCount = await tx.$executeRaw`
      UPDATE "Note"
      SET "categoryId" = ${input.targetCategoryId}::text,
          "updatedAt" = GREATEST(
            clock_timestamp() AT TIME ZONE 'UTC',
            "updatedAt" + INTERVAL '1 millisecond'
          )
      WHERE "userId" = ${userId}
        AND "categoryId" IS NOT DISTINCT FROM ${input.sourceCategoryId}::text
    `;
    return { ...input, movedCount };
  });
}

async function throwNoteWriteError(userId: string, id: string): Promise<never> {
  const note = await getPrisma().note.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!note) {
    throw createError({ statusCode: 404, statusMessage: "Note not found" });
  }
  throw createError({ statusCode: 409, statusMessage: "Note has changed" });
}

export async function deleteOwnedNote(userId: string, body: unknown) {
  const input = parseInput(deleteNoteInputSchema, body);
  const db = getPrisma();
  const deleted = await db.note.deleteMany({
    where: { id: input.id, userId, updatedAt: new Date(input.updatedAt) },
  });
  if (deleted.count) return { id: input.id, deleted: true };
  return throwNoteWriteError(userId, input.id);
}

export async function updateOwnedNote(userId: string, body: unknown) {
  const input = parseInput(updateNoteInputSchema, body);
  const content = normalizeNoteContent(input);
  const categoryId =
    input.categoryId === undefined
      ? undefined
      : await ownedCategory(userId, input.categoryId);
  return updateNoteVersion(
    userId,
    input,
    {
      ...content,
      ...(categoryId === undefined ? {} : { categoryId }),
    },
    savedNoteSelect,
  );
}

export async function updateOwnedNoteCategory(userId: string, body: unknown) {
  const input = parseInput(updateNoteCategoryInputSchema, body);
  const categoryId = await ownedCategory(userId, input.categoryId);
  return updateNoteVersion(
    userId,
    input,
    { categoryId },
    savedNoteMetadataSelect,
  );
}

export async function updateOwnedNoteTitle(userId: string, body: unknown) {
  const input = parseInput(updateNoteTitleInputSchema, body);
  return updateNoteVersion(
    userId,
    input,
    {
      title: normalizeNoteTitle(input.title),
    },
    savedNoteMetadataSelect,
  );
}

async function updateNoteVersion<S extends Prisma.NoteSelect>(
  userId: string,
  input: { id: string; updatedAt: string },
  data: { title?: string; markdown?: string; categoryId?: string | null },
  select: S,
) {
  const db = getPrisma();
  const expectedUpdatedAt = new Date(input.updatedAt);
  try {
    return await db.note.update({
      where: { id: input.id, userId, updatedAt: expectedUpdatedAt },
      data: {
        ...data,
        // Advance even if two requests arrive within the same millisecond.
        updatedAt: new Date(
          Math.max(Date.now(), expectedUpdatedAt.getTime() + 1),
        ),
      },
      select,
    });
  } catch (error) {
    if (
      !error ||
      typeof error !== "object" ||
      !("code" in error) ||
      error.code !== "P2025"
    ) {
      throw error;
    }
    return throwNoteWriteError(userId, input.id);
  }
}

export async function createOwnedNote(userId: string, body: unknown) {
  const input = parseInput(createNoteInputSchema, body);
  const content = normalizeNoteContent(input);
  const categoryId = await ownedCategory(userId, input.categoryId);
  return getPrisma().note.create({
    data: { ...content, userId, categoryId },
    select: savedNoteSelect,
  });
}
