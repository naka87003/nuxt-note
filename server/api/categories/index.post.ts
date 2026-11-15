import { getAuthenticatedUserId } from "~~/server/utils/auth";
import { createOwnedCategory } from "~~/server/utils/categories";
export default defineEventHandler(async (event) => {
  const userId = await getAuthenticatedUserId(event);
  const category = await createOwnedCategory(userId, await readBody(event));
  setResponseStatus(event, 201);
  return category;
});
