import { createError } from "nuxt/server";
import { getAuthenticatedUserId } from "../../../utils/auth";
import { getPrisma } from "../../../utils/prisma";
import {
  lockIdleChat,
  messageInput,
  recoverGeneration,
  requireChat,
} from "../../../utils/chat-generation";

export default defineEventHandler(async (event) => {
  const userId = await getAuthenticatedUserId(event);
  const id = getRouterParam(event, "id")!;
  await requireChat(userId, id);
  const message = messageInput(await readBody(event));
  await recoverGeneration(userId, id);
  return getPrisma().$transaction(async (tx) => {
    await lockIdleChat(tx, userId, id);
    const existing = await tx.message.findFirst({
      where: { id: message.id, chatId: id, role: "user" },
    });
    if (existing) {
      if (existing.content !== message.content)
        throw createError({
          statusCode: 409,
          statusMessage: "Request already used",
        });
      return { messageId: existing.id };
    }
    const last = await tx.message.findFirst({
      where: { chatId: id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    if (last?.role === "user")
      throw createError({
        statusCode: 409,
        statusMessage: "Retry the unanswered message first",
      });
    await tx.message.create({
      data: {
        ...message,
        role: "user",
        chatId: id,
        createdAt: new Date(
          Math.max(Date.now(), (last?.createdAt.getTime() ?? 0) + 1),
        ),
      },
    });
    return { messageId: message.id };
  });
});
