import { createError } from "nuxt/server";
import { getPrisma } from "./prisma";
import { ownedCategory } from "./categories";
import { updateChatCategorySchema } from "./input-schemas";
import { parseInput } from "./parse-input";

async function throwChatWriteError(userId: string, id: string): Promise<never> {
  const chat = await getPrisma().chat.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!chat) {
    throw createError({ statusCode: 404, statusMessage: "Chat not found" });
  }
  throw createError({ statusCode: 409, statusMessage: "Chat has changed" });
}

export async function updateOwnedChatCategory(
  userId: string,
  id: string | undefined,
  body: unknown,
) {
  const db = getPrisma();
  if (!id) {
    throw createError({ statusCode: 404, statusMessage: "Chat not found" });
  }
  const chat = await db.chat.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!chat) {
    throw createError({ statusCode: 404, statusMessage: "Chat not found" });
  }
  const input = parseInput(updateChatCategorySchema, body);
  const categoryId = await ownedCategory(userId, input.categoryId);
  const expectedUpdatedAt =
    input.updatedAt === undefined ? undefined : new Date(input.updatedAt);
  // Without a version, preserve the existing browser API's automatic timestamp.
  // With a version, advance even within the same millisecond.
  const updatedAt = expectedUpdatedAt
    ? new Date(Math.max(Date.now(), expectedUpdatedAt.getTime() + 1))
    : undefined;
  try {
    return await db.chat.update({
      where: { id, userId, updatedAt: expectedUpdatedAt },
      data: { categoryId, updatedAt },
      select: { id: true, title: true, categoryId: true, updatedAt: true },
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
    return throwChatWriteError(userId, id);
  }
}

export async function deleteOwnedChat(userId: string, id: string | undefined) {
  if (!id) {
    throw createError({ statusCode: 404, statusMessage: "Chat not found" });
  }
  const result = await getPrisma().chat.deleteMany({ where: { id, userId } });
  if (!result.count) {
    throw createError({ statusCode: 404, statusMessage: "Chat not found" });
  }
  return { id, deleted: true };
}
