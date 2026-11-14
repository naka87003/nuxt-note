import { normalizeNoteContent } from "./notes";
import { ownedCategory } from "./categories";
import { getPrisma } from "./prisma";
import { createError } from "nuxt/server";
import {
  createNoteInputSchema,
  updateNoteInputSchema,
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
  if (!note)
    throw createError({ statusCode: 404, statusMessage: "Note not found" });
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
  const db = getPrisma();
  const expectedUpdatedAt = new Date(input.updatedAt);
  try {
    return await db.note.update({
      where: { id: input.id, userId, updatedAt: expectedUpdatedAt },
      data: {
        ...content,
        ...(categoryId === undefined ? {} : { categoryId }),
        // Advance even if two requests arrive within the same millisecond.
        updatedAt: new Date(
          Math.max(Date.now(), expectedUpdatedAt.getTime() + 1),
        ),
      },
      select: savedNoteSelect,
    });
  } catch (error) {
    if (
      !error ||
      typeof error !== "object" ||
      !("code" in error) ||
      error.code !== "P2025"
    )
      throw error;
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
