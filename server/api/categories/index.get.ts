import { getPrisma } from "../../utils/prisma";
import { getAuthenticatedUserId } from "../../utils/auth";

export default defineEventHandler(async (event) => {
  const userId = await getAuthenticatedUserId(event);
  const db = getPrisma();
  const [items, notes, chats, uncategorizedNotes, uncategorizedChats] =
    await Promise.all([
      db.category.findMany({
        where: { userId },
        orderBy: [{ nameKey: "asc" }, { id: "asc" }],
        select: {
          id: true,
          name: true,
          _count: {
            select: {
              notes: { where: { userId } },
              chats: { where: { userId } },
            },
          },
        },
      }),
      db.note.count({ where: { userId } }),
      db.chat.count({ where: { userId } }),
      db.note.count({ where: { userId, categoryId: null } }),
      db.chat.count({ where: { userId, categoryId: null } }),
    ]);
  return {
    items,
    totals: { notes, chats },
    uncategorized: { notes: uncategorizedNotes, chats: uncategorizedChats },
  };
});
