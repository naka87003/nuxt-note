import { INPUT_LIMITS } from "#shared/utils/input-limits";
import { createError } from "nuxt/server";

export function noteContent(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw createError({ statusCode: 400, statusMessage: "Invalid note" });
  const { title, markdown } = body as Record<string, unknown>;
  if (
    typeof title !== "string" ||
    title.length > INPUT_LIMITS.noteTitle ||
    typeof markdown !== "string" ||
    markdown.length > INPUT_LIMITS.noteBody
  )
    throw createError({
      statusCode: 400,
      statusMessage: `Use at most ${INPUT_LIMITS.noteTitle} characters for the title and ${INPUT_LIMITS.noteBody} for the body`,
    });
  return { title: title.trim() || "Untitled note", markdown };
}
