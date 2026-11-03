import { getPrisma } from "../../utils/prisma";
import { getAuthenticatedUserId } from "../../utils/auth";

export default defineEventHandler(async (event) => {
  const userId = await getAuthenticatedUserId(event);
  return getPrisma().note.findMany({
    where: { userId },
    select: { id: true, title: true, updatedAt: true },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
  });
});
