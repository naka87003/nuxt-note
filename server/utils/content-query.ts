import { createError } from "nuxt/server";
import { contentQuerySchema } from "./input-schemas";

export function contentQuery(
  query: Record<string, unknown>,
  field: "markdown" | "messages",
) {
  const parsed = contentQuerySchema.safeParse(query);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid filter or search",
    });
  }
  const { category, q } = parsed.data;
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
