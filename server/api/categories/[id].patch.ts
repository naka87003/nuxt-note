import { createError } from "nuxt/server";
import { getPrisma } from "../../utils/prisma";
import { getAuthenticatedUserId } from "../../utils/auth";
import { categoryName, categoryConflict } from "../../utils/categories";
export default defineEventHandler(async (event) => {
  const userId = await getAuthenticatedUserId(event);
  const id = getRouterParam(event, "id");
  if (!id)
    throw createError({ statusCode: 404, statusMessage: "Category not found" });
  const data = categoryName(await readBody(event));
  try {
    const result = await getPrisma().category.updateMany({
      where: { id, userId },
      data,
    });
    if (!result.count)
      throw createError({
        statusCode: 404,
        statusMessage: "Category not found",
      });
    return { id, name: data.name };
  } catch (error) {
    categoryConflict(error);
  }
});
