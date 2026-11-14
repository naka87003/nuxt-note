import { getAuthenticatedUserId } from "../../utils/auth";
import { createOwnedCategory } from "../../utils/categories";
export default defineEventHandler(async (event) => {
  const userId = await getAuthenticatedUserId(event);
  const category = await createOwnedCategory(userId, await readBody(event));
  setResponseStatus(event, 201);
  return category;
});
