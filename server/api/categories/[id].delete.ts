import { createError } from "nuxt/server";
import { getPrisma } from "../../utils/prisma";
import { getAuthenticatedUserId } from "../../utils/auth";
export default defineEventHandler(async (event) => {
  const userId = await getAuthenticatedUserId(event);
  const id = getRouterParam(event, "id");
  if (!id)
    throw createError({ statusCode: 404, statusMessage: "Category not found" });
  const result = await getPrisma().category.deleteMany({
    where: { id, userId },
  });
  if (!result.count)
    throw createError({ statusCode: 404, statusMessage: "Category not found" });
  setResponseStatus(event, 204);
});
