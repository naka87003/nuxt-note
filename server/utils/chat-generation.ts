import { createError } from "nuxt/server";
import type { Prisma } from "../../generated/prisma/client";
import { getPrisma } from "./prisma";
import { messageInputSchema } from "./input-schemas";
import { parseInput } from "./parse-input";

export const GENERATION_TIMEOUT = 120_000;

export const messageOrder = [
  { createdAt: "asc" as const },
  { id: "asc" as const },
];

export const messageSelection = {
  id: true,
  role: true,
  content: true,
  status: true,
  replyToId: true,
  createdAt: true,
} as const;

export function messageInput(body: unknown) {
  const input = parseInput(messageInputSchema, body);
  return { id: input.messageId, content: input.content };
}

export async function requireChat(userId: string, id: string) {
  const chat = await getPrisma().chat.findFirst({ where: { id, userId } });
  if (!chat)
    throw createError({ statusCode: 404, statusMessage: "Chat not found" });
  return chat;
}

// A database row lock serializes sends/generation across tabs and server processes.
export async function lockIdleChat(
  tx: Prisma.TransactionClient,
  userId: string,
  id: string,
) {
  const result = await tx.chat.updateMany({
    where: { id, userId, generationId: null },
    data: { updatedAt: new Date() },
  });
  if (!result.count)
    throw createError({
      statusCode: 409,
      statusMessage: "A response is already being generated",
    });
}

export async function recoverGeneration(userId: string, id: string) {
  await getPrisma().$transaction(async (tx) => {
    const expired = await tx.chat.updateMany({
      where: {
        id,
        userId,
        generationId: { not: null },
        generationStartedAt: {
          lt: new Date(Date.now() - GENERATION_TIMEOUT - 30_000),
        },
      },
      data: { generationId: null, generationStartedAt: null },
    });
    if (expired.count)
      await tx.message.updateMany({
        where: { chatId: id, status: "generating" },
        data: { status: "failed" },
      });
  });
}

// Only the attempt that still owns the chat may write or release its lock.
export async function saveGeneration(
  userId: string,
  chatId: string,
  attemptId: string,
  messageId: string,
  content: string,
  status: string,
) {
  return getPrisma().$transaction(async (tx) => {
    const updated = await tx.chat.updateMany({
      where: { id: chatId, userId, generationId: attemptId },
      data:
        status === "generating"
          ? { updatedAt: new Date() }
          : { generationId: null, generationStartedAt: null },
    });
    if (!updated.count) return false;
    await tx.message.updateMany({
      where: { id: messageId, chatId },
      data: { content, status },
    });
    return true;
  });
}
