import { createError } from "nuxt/server";
import { getPrisma } from "./prisma";
import { contentQuery } from "./content-query";
import { contentPreview } from "#shared/utils/content-preview";
import { recoverGeneration, messageSelection } from "./chat-generation";

export async function listOwnedChats(
  userId: string,
  query: Record<string, unknown>,
) {
  const chats = await getPrisma().chat.findMany({
    where: { userId, ...contentQuery(query, "messages") },
    select: {
      id: true,
      title: true,
      categoryId: true,
      updatedAt: true,
      messages: {
        where: { role: "user" },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 1,
        select: { content: true },
      },
    },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
  });
  return Promise.all(
    chats.map(async ({ messages, ...chat }) => ({
      ...chat,
      preview: await contentPreview(messages[0]?.content ?? ""),
    })),
  );
}

export async function readOwnedChat(userId: string, id: string | undefined) {
  if (!id) {
    throw createError({ statusCode: 404, statusMessage: "Chat not found" });
  }
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
  if (!chat) {
    throw createError({ statusCode: 404, statusMessage: "Chat not found" });
  }
  return chat;
}
