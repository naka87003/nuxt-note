import type { CategoriesResponse } from "../types/workspace";

export function sortCategoriesByCount(
  categories: readonly CategoriesResponse["items"][number][],
) {
  // Preserve the source order for ties and leave the shared cache untouched.
  return [...categories].sort(
    (a, b) =>
      b._count.notes + b._count.chats - (a._count.notes + a._count.chats),
  );
}
