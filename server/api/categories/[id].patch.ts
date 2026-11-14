import { createError } from "nuxt/server";
import { getAuthenticatedUserId } from "../../utils/auth";
import { updateOwnedCategory } from "../../utils/categories";
export default defineEventHandler(async (event) => {
  const userId = await getAuthenticatedUserId(event);
  const id = getRouterParam(event, "id");
  if (!id)
    throw createError({ statusCode: 404, statusMessage: "Category not found" });
  return updateOwnedCategory(userId, id, await readBody(event));
});
