import { createError } from "nuxt/server";
import { getPrisma } from "../../utils/prisma";
import { getAuthenticatedUserId } from "../../utils/auth";
export default defineEventHandler(async (event) => {
  const userId = await getAuthenticatedUserId(event);
  const id = getRouterParam(event, "id");
  if (!id)
    throw createError({ statusCode: 404, statusMessage: "Chat not found" });
  const chat = await getPrisma().chat.findFirst({
    where: { id, userId },
    select: {
      id: true,
      title: true,
      categoryId: true,
      updatedAt: true,
      messages: {
        select: { id: true, role: true, content: true, createdAt: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      },
    },
  });
  if (!chat)
    throw createError({ statusCode: 404, statusMessage: "Chat not found" });
  return chat;
});
