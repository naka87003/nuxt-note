import { createError } from "nuxt/server";
import { getPrisma } from "../../utils/prisma";
import { getAuthenticatedUserId } from "../../utils/auth";
import { ownedCategory } from "../../utils/categories";
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
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    !("categoryId" in body)
  )
    throw createError({ statusCode: 400, statusMessage: "Invalid category" });
  const categoryId = await ownedCategory(userId, body.categoryId);
  const result = await db.chat.updateMany({
    where: { id, userId },
    data: { categoryId },
  });
  if (!result.count)
    throw createError({ statusCode: 404, statusMessage: "Chat not found" });
  return { id, categoryId };
});
