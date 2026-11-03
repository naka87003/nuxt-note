import { createError } from "nuxt/server";

export function noteContent(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw createError({ statusCode: 400, statusMessage: "Invalid note" });
  const { title, markdown } = body as Record<string, unknown>;
  if (
    typeof title !== "string" ||
    title.length > 200 ||
    typeof markdown !== "string"
  )
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid title or body",
    });
  return { title: title.trim() || "Untitled note", markdown };
}
