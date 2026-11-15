import { createError } from "nuxt/server";
import { getPrisma } from "./prisma";

export async function readOwnedCategory(userId: string, id: string) {
  const category = await getPrisma().category.findFirst({
    where: { id, userId },
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
  });

  if (!category) {
    throw createError({ statusCode: 404, statusMessage: "Category not found" });
  }

  return {
    id: category.id,
    name: category.name,
    noteCount: category._count.notes,
    chatCount: category._count.chats,
  };
}

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
