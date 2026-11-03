import { getPrisma } from "../../utils/prisma";

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event);
  return getPrisma().note.findMany({
    where: { userId: user.id },
    select: { id: true, title: true, updatedAt: true },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
  });
});
