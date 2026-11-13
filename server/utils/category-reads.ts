import { getPrisma } from "./prisma";

export async function listOwnedCategories(userId: string) {
  const categories = await getPrisma().category.findMany({
    where: { userId },
    orderBy: [{ nameKey: "asc" }, { id: "asc" }],
    select: { id: true, name: true },
  });
  return { categories };
}
