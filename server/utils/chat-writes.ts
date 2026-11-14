import { createError } from "nuxt/server";
import { getPrisma } from "./prisma";
import { ownedCategory } from "./categories";
import { updateChatCategorySchema } from "./input-schemas";
import { parseInput } from "./parse-input";

export async function updateOwnedChatCategory(
  userId: string,
  id: string | undefined,
  body: unknown,
) {
  const db = getPrisma();
  if (
    !id ||
    !(await db.chat.findFirst({ where: { id, userId }, select: { id: true } }))
  ) {
    throw createError({ statusCode: 404, statusMessage: "Chat not found" });
  }
  const input = parseInput(updateChatCategorySchema, body);
  const categoryId = await ownedCategory(userId, input.categoryId);
  const result = await db.chat.updateMany({
    where: { id, userId },
    data: { categoryId },
  });
  if (!result.count) {
    throw createError({ statusCode: 404, statusMessage: "Chat not found" });
  }
  return { id, categoryId };
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
