import { createError } from "nuxt/server";

export function contentQuery(
  query: Record<string, unknown>,
  field: "markdown" | "messages",
) {
  const category = query.category;
  const q = query.q;
  if (
    (category !== undefined && typeof category !== "string") ||
    (q !== undefined && (typeof q !== "string" || q.length > 500))
  )
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid filter or search",
    });
  // PostgreSQL LIKE metacharacters are literal search text, including backslashes.
  const text = typeof q === "string" ? q.replace(/[\\%_]/g, "\\$&") : "";
  const contains = { contains: text, mode: "insensitive" as const };
  return {
    ...(category && category !== "all"
      ? { categoryId: category === "uncategorized" ? null : category }
      : {}),
    ...(text
      ? {
          OR: [
            { title: contains },
            field === "markdown"
              ? { markdown: contains }
              : { messages: { some: { content: contains } } },
          ],
        }
      : {}),
  };
}
