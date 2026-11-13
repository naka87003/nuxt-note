import { createError } from "nuxt/server";
import { getPrisma } from "./prisma";
import { contentQuery } from "./content-query";
import { contentPreview } from "../../shared/utils/content-preview";

export async function searchOwnedNotes(
  userId: string,
  query: { q?: string; category?: string; limit: number; offset: number },
) {
  // MCP's input schema validates pagination before calling this operation.
  const { limit, offset } = query;
  const notes = await listOwnedNotes(userId, query, { limit, offset });
  return {
    notes: notes.slice(0, limit),
    nextOffset: notes.length > limit ? offset + limit : null,
  };
}

export async function listOwnedNotes(
  userId: string,
  query: Record<string, unknown>,
  page?: { limit: number; offset: number },
) {
  const notes = await getPrisma().note.findMany({
    where: { userId, ...contentQuery(query, "markdown") },
    select: {
      id: true,
      title: true,
      categoryId: true,
      updatedAt: true,
      markdown: true,
    },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    ...(page ? { take: page.limit + 1, skip: page.offset } : {}),
  });
  return Promise.all(
    notes.map(async ({ markdown, ...note }) => ({
      ...note,
      preview: await contentPreview(markdown),
    })),
  );
}

export async function readOwnedNote(userId: string, id: string | undefined) {
  if (!id)
    throw createError({ statusCode: 404, statusMessage: "Note not found" });
  const note = await getPrisma().note.findFirst({
    where: { id, userId },
    select: {
      id: true,
      title: true,
      markdown: true,
      categoryId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!note)
    throw createError({ statusCode: 404, statusMessage: "Note not found" });
  return note;
}
