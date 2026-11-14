import { createError } from "nuxt/server";
import { deleteOwnedCategory } from "../../utils/categories";
import { getAuthenticatedUserId } from "../../utils/auth";
export default defineEventHandler(async (event) => {
  const userId = await getAuthenticatedUserId(event);
  const id = getRouterParam(event, "id");
  if (!id)
    throw createError({ statusCode: 404, statusMessage: "Category not found" });
  await deleteOwnedCategory(userId, id);
  setResponseStatus(event, 204);
});
