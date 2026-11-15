import { createError } from "nuxt/server";
import { getPrisma } from "./prisma";
import { contentQuery } from "./content-query";
import { contentPreview } from "#shared/utils/content-preview";
import {
  recoverGeneration,
  messageSelection,
  messageOrder,
} from "./chat-generation";

export async function searchOwnedChats(
  userId: string,
  query: { q?: string; category?: string; limit: number; offset: number },
) {
  const { limit, offset } = query;
  const chats = await listOwnedChats(userId, query, { limit, offset });
  return {
    chats: chats.slice(0, limit),
    nextOffset: chats.length > limit ? offset + limit : null,
  };
}

export async function listOwnedChats(
  userId: string,
  query: Record<string, unknown>,
  page?: { limit: number; offset: number },
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
        orderBy: messageOrder,
        take: 1,
        select: { content: true },
      },
    },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    ...(page ? { take: page.limit + 1, skip: page.offset } : {}),
  });
  return Promise.all(
    chats.map(async ({ messages, ...chat }) => ({
      ...chat,
      preview: await contentPreview(messages[0]?.content ?? ""),
    })),
  );
}

// Tool reads must not recover or otherwise mutate generation state.
export async function readOwnedChatPage(
  userId: string,
  input: { id: string; limit: number; offset: number },
) {
  const { id, limit, offset } = input;
  const chat = await getPrisma().chat.findFirst({
    where: { id, userId },
    select: {
      id: true,
      title: true,
      categoryId: true,
      updatedAt: true,
      messages: {
        select: messageSelection,
        orderBy: messageOrder,
        take: limit + 1,
        skip: offset,
      },
    },
  });
  if (!chat) {
    throw createError({ statusCode: 404, statusMessage: "Chat not found" });
  }
  return {
    ...chat,
    messages: chat.messages.slice(0, limit),
    nextOffset: chat.messages.length > limit ? offset + limit : null,
  };
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
        orderBy: messageOrder,
      },
    },
  });
  if (!chat) {
    throw createError({ statusCode: 404, statusMessage: "Chat not found" });
  }
  return chat;
}
