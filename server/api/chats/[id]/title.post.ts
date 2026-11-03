import { getAuthenticatedUserId } from "../../../utils/auth";
import { messageOrder, requireChat } from "../../../utils/chat-generation";
import { legacyChatTitle, summarizeChatTitle } from "../../../utils/chat-title";
import { getPrisma } from "../../../utils/prisma";

export default defineEventHandler(async (event) => {
  const userId = await getAuthenticatedUserId(event);
  const id = getRouterParam(event, "id")!;
  const chat = await requireChat(userId, id);
  const prisma = getPrisma();
  const question = await prisma.message.findFirst({
    where: { chatId: id, role: "user" },
    orderBy: messageOrder,
  });
  if (
    !question ||
    (chat.title !== null && chat.title !== legacyChatTitle(question.content))
  )
    return { title: chat.title };
  const reply = await prisma.message.findFirst({
    where: { chatId: id, replyToId: question.id, status: "completed" },
  });
  const config = useRuntimeConfig(event);
  if (!reply || !config.openaiApiKey || !config.openaiModel)
    return { title: chat.title };

  // Title failures must never affect the completed answer or its existing title.
  try {
    const title = await summarizeChatTitle(
      question.content,
      reply.content,
      config,
    );
    if (!title) return { title: chat.title };
    const updated = await prisma.chat.updateMany({
      // Preserve any title changed while this request was in flight.
      where: { id, userId, title: chat.title },
      data: { title },
    });
    return { title: updated.count ? title : null };
  } catch {
    return { title: chat.title };
  }
});
