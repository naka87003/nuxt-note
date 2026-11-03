import { createError } from "nuxt/server";
import { getPrisma } from "../../utils/prisma";
import { getAuthenticatedUserId } from "../../utils/auth";
import {
  recoverGeneration,
  messageSelection,
} from "../../utils/chat-generation";
export default defineEventHandler(async (event) => {
  const userId = await getAuthenticatedUserId(event);
  const id = getRouterParam(event, "id");
  if (!id)
    throw createError({ statusCode: 404, statusMessage: "Chat not found" });
  await recoverGeneration(userId, id);
  const chat = await getPrisma().chat.findFirst({
    where: { id, userId },
    select: {
      id: true,
      title: true,
      categoryId: true,
      updatedAt: true,
      generationId: true,
      messages: {
        select: messageSelection,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      },
    },
  });
  if (!chat)
    throw createError({ statusCode: 404, statusMessage: "Chat not found" });
  return chat;
});
