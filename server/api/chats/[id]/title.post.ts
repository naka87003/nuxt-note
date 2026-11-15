import { createError } from "nuxt/server";
import { getAuthenticatedUserId } from "~~/server/utils/auth";
import { messageOrder, requireChat } from "~~/server/utils/chat-generation";
import { summarizeChatTitle } from "~~/server/utils/chat-title";
import { getPrisma } from "~~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  const userId = await getAuthenticatedUserId(event);
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 404, statusMessage: "Chat not found" });
  }
  const chat = await requireChat(userId, id);
  if (chat.title !== null) {
    return { title: chat.title };
  }
  const prisma = getPrisma();
  const question = await prisma.message.findFirst({
    where: { chatId: id, role: "user" },
    orderBy: messageOrder,
  });
  if (!question) {
    return { title: chat.title };
  }
  const reply = await prisma.message.findFirst({
    where: { chatId: id, replyToId: question.id, status: "completed" },
  });
  const config = useRuntimeConfig(event);
  if (!reply || !config.openaiApiKey || !config.openaiModel) {
    return { title: chat.title };
  }

  // Title failures must never affect the completed answer or its existing title.
  try {
    const title = await summarizeChatTitle(
      question.content,
      reply.content,
      config,
    );
    if (!title) {
      return { title: chat.title };
    }
    const updated = await prisma.chat.updateMany({
      // Preserve any title changed while this request was in flight.
      where: { id, userId, title: null },
      data: { title },
    });
    return { title: updated.count ? title : null };
  } catch {
    return { title: chat.title };
  }
});
