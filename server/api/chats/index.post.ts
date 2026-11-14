import { createError } from "nuxt/server";
import { getAuthenticatedUserId } from "../../utils/auth";
import { ownedCategory } from "../../utils/categories";
import { getPrisma } from "../../utils/prisma";
import { createChatInputSchema } from "../../utils/input-schemas";
import { parseInput } from "../../utils/parse-input";

export default defineEventHandler(async (event) => {
  const userId = await getAuthenticatedUserId(event);
  const body: unknown = await readBody(event);
  const input = parseInput(createChatInputSchema, body);
  const message = { id: input.messageId, content: input.content };
  const id = input.chatId;
  const prisma = getPrisma();
  const existing = await prisma.chat.findFirst({
    where: { id, userId },
    include: { messages: { where: { id: message.id } } },
  });
  if (existing) {
    if (existing.messages[0]?.content !== message.content)
      throw createError({
        statusCode: 409,
        statusMessage: "Request already used",
      });
    return { id, messageId: message.id };
  }
  const categoryId = await ownedCategory(userId, input.categoryId);
  try {
    await prisma.chat.create({
      data: {
        id,
        userId,
        categoryId,
        title: null,
        messages: { create: { ...message, role: "user" } },
      },
    });
  } catch (error) {
    // Concurrent repeats never create another chat or user message.
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    )
      throw createError({
        statusCode: 409,
        statusMessage: "Request already received. Please try again.",
      });
    throw error;
  }
  setResponseStatus(event, 201);
  return { id, messageId: message.id };
});
