import { createError } from "nuxt/server";
import { getPrisma } from "../../utils/prisma";
import { getAuthenticatedUserId } from "../../utils/auth";
import { ownedCategory } from "../../utils/categories";
import { updateChatCategorySchema } from "../../utils/input-schemas";
import { parseInput } from "../../utils/parse-input";
export default defineEventHandler(async (event) => {
  const userId = await getAuthenticatedUserId(event);
  const id = getRouterParam(event, "id");
  const db = getPrisma();
  if (
    !id ||
    !(await db.chat.findFirst({ where: { id, userId }, select: { id: true } }))
  )
    throw createError({ statusCode: 404, statusMessage: "Chat not found" });
  const body: unknown = await readBody(event);
  const input = parseInput(updateChatCategorySchema, body);
  const categoryId = await ownedCategory(userId, input.categoryId);
  const result = await db.chat.updateMany({
    where: { id, userId },
    data: { categoryId },
  });
  if (!result.count)
    throw createError({ statusCode: 404, statusMessage: "Chat not found" });
  return { id, categoryId };
});
