import { createError } from "nuxt/server";
import type { Prisma } from "../../generated/prisma/client";
import { getPrisma } from "./prisma";

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

export function requestId(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw createError({ statusCode: 400, statusMessage: "Invalid request ID" });
  return value;
}
export function messageInput(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw createError({ statusCode: 400, statusMessage: "Invalid message" });
  const data = body as Record<string, unknown>;
  const id = requestId(data.messageId);
  if (
    typeof data.content !== "string" ||
    !data.content.trim() ||
    data.content.length > 20_000
  )
    throw createError({
      statusCode: 400,
      statusMessage: "Use 1–20,000 characters for the message",
    });
  return { id, content: data.content.trim() };
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
