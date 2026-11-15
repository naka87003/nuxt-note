import { createError } from "nuxt/server";
import { getPrisma } from "./prisma";
import { ownedCategory, lockOwnedCategories } from "./categories";
import {
  updateChatCategorySchema,
  updateChatTitleInputSchema,
  deleteChatBodySchema,
  moveCategoryInputSchema,
} from "./input-schemas";
import { parseInput } from "./parse-input";

export async function moveOwnedCategoryChats(
  userId: string,
  body: unknown,
  currentChatId?: string,
) {
  const input = parseInput(moveCategoryInputSchema, body);
  return getPrisma().$transaction(async (tx) => {
    await lockOwnedCategories(tx, userId, [
      input.sourceCategoryId,
      input.targetCategoryId,
    ]);
    // Aggregate on the server rather than returning every moved Chat ID.
    const [moved] = await tx.$queryRaw<
      { movedCount: number; currentChatMoved: boolean }[]
    >`
      WITH moved AS (
        UPDATE "Chat"
        SET "categoryId" = ${input.targetCategoryId}::text,
            "updatedAt" = GREATEST(
              clock_timestamp() AT TIME ZONE 'UTC',
              "updatedAt" + INTERVAL '1 millisecond'
            )
        WHERE "userId" = ${userId}
          AND "categoryId" IS NOT DISTINCT FROM ${input.sourceCategoryId}::text
        RETURNING "id"
      )
      SELECT COUNT(*)::integer AS "movedCount",
             COALESCE(bool_or("id" = ${currentChatId ?? null}::text), false) AS "currentChatMoved"
      FROM moved
    `;
    if (!moved) {
      throw createError({
        statusCode: 500,
        statusMessage: "Could not move Chats",
      });
    }
    return { ...input, ...moved };
  });
}

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
  return updateChatVersion(
    userId,
    { id, updatedAt: input.updatedAt },
    { categoryId },
  );
}

export async function updateOwnedChatTitle(userId: string, body: unknown) {
  const input = parseInput(updateChatTitleInputSchema, body);
  return updateChatVersion(userId, input, { title: input.title.trim() });
}

async function updateChatVersion(
  userId: string,
  input: { id: string; updatedAt?: string },
  data: { title?: string; categoryId?: string | null },
) {
  const { id } = input;
  const expectedUpdatedAt =
    input.updatedAt === undefined ? undefined : new Date(input.updatedAt);
  // Without a version, preserve the existing browser API's automatic timestamp.
  // With a version, advance even within the same millisecond.
  const updatedAt = expectedUpdatedAt
    ? new Date(Math.max(Date.now(), expectedUpdatedAt.getTime() + 1))
    : undefined;
  try {
    return await getPrisma().chat.update({
      where: { id, userId, updatedAt: expectedUpdatedAt },
      data: { ...data, updatedAt },
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

export async function deleteOwnedChat(
  userId: string,
  id: string | undefined,
  body: unknown = {},
) {
  if (!id) {
    throw createError({ statusCode: 404, statusMessage: "Chat not found" });
  }
  const input = parseInput(deleteChatBodySchema, body);
  const result = await getPrisma().chat.deleteMany({
    where: {
      id,
      userId,
      ...(input.updatedAt === undefined
        ? {}
        : { updatedAt: new Date(input.updatedAt) }),
    },
  });
  if (result.count) return { id, deleted: true };
  if (input.updatedAt !== undefined) {
    return throwChatWriteError(userId, id);
  }
  throw createError({ statusCode: 404, statusMessage: "Chat not found" });
}
