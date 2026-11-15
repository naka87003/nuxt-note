import type { Prisma } from "../../generated/prisma/client";
import { normalizeNoteContent } from "./notes";
import { ownedCategory } from "./categories";
import { getPrisma } from "./prisma";
import { createError } from "nuxt/server";
import {
  createNoteInputSchema,
  updateNoteInputSchema,
  updateNoteCategoryInputSchema,
  deleteNoteInputSchema,
} from "./input-schemas";
import { parseInput } from "./parse-input";

const savedNoteSelect = {
  id: true,
  title: true,
  markdown: true,
  categoryId: true,
  createdAt: true,
  updatedAt: true,
} as const;

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
    {
      id: true,
      title: true,
      categoryId: true,
      createdAt: true,
      updatedAt: true,
    },
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
