import { createError } from "nuxt/server";
import { getPrisma } from "../../utils/prisma";

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event);
  const body: unknown = await readBody(event);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid note" });
  }
  const { title, markdown } = body as Record<string, unknown>;
  if (
    typeof title !== "string" ||
    title.length > 200 ||
    typeof markdown !== "string"
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid title or body",
    });
  }
  const note = await getPrisma().note.create({
    data: { title: title.trim() || "Untitled note", markdown, userId: user.id },
    select: { id: true },
  });
  setResponseStatus(event, 201);
  return note;
});
