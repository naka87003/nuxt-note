import { getPrisma } from "../../utils/prisma";
import { getAuthenticatedUserId } from "../../utils/auth";
import { contentQuery } from "../../utils/content-query";
export default defineEventHandler(async (event) => {
  const userId = await getAuthenticatedUserId(event);
  return getPrisma().chat.findMany({
    where: { userId, ...contentQuery(getQuery(event), "messages") },
    select: { id: true, title: true, categoryId: true, updatedAt: true },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
  });
});
