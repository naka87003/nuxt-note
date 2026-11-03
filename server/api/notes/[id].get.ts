import { createError } from "nuxt/server";
import { getPrisma } from "../../utils/prisma";
import { getAuthenticatedUserId } from "../../utils/auth";

export default defineEventHandler(async (event) => {
  const userId = await getAuthenticatedUserId(event);
  const id = getRouterParam(event, "id");
  if (!id)
    throw createError({ statusCode: 404, statusMessage: "Note not found" });
  const note = await getPrisma().note.findFirst({
    where: { id, userId },
    select: {
      id: true,
      title: true,
      markdown: true,
      categoryId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!note)
    throw createError({ statusCode: 404, statusMessage: "Note not found" });
  return note;
});
