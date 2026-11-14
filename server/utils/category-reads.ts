import { getPrisma } from "./prisma";

export async function listOwnedCategories(userId: string) {
  const categories = await getPrisma().category.findMany({
    where: { userId },
    orderBy: [{ nameKey: "asc" }, { id: "asc" }],
    select: { id: true, name: true },
  });
  return { categories };
}

export async function listOwnedCategoriesWithCounts(userId: string) {
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
}
