import { getAuthenticatedUserId } from "../../utils/auth";
import { listOwnedCategoriesWithCounts } from "../../utils/category-reads";

export default defineEventHandler(async (event) => {
  const userId = await getAuthenticatedUserId(event);
  return listOwnedCategoriesWithCounts(userId);
});
