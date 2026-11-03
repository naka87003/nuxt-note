import { createError } from "nuxt/server";
import { getPrisma } from "../../utils/prisma";
import { getAuthenticatedUserId } from "../../utils/auth";

import { ownedCategory } from "../../utils/categories";

export default defineEventHandler(async (event) => {
  const userId = await getAuthenticatedUserId(event);
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
  const categoryId = await ownedCategory(
    userId,
    (body as Record<string, unknown>).categoryId,
  );
  const note = await getPrisma().note.create({
    data: {
      title: title.trim() || "Untitled note",
      markdown,
      userId,
      categoryId,
    },
    select: { id: true },
  });
  setResponseStatus(event, 201);
  return note;
});
