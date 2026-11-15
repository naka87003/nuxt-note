import { getAuthenticatedUserId } from "~~/server/utils/auth";
import { listOwnedCategoriesWithCounts } from "~~/server/utils/category-reads";

export default defineEventHandler(async (event) => {
  const userId = await getAuthenticatedUserId(event);
  return listOwnedCategoriesWithCounts(userId);
});
