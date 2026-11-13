import { createError } from "nuxt/server";
import { getAuthenticatedUserId } from "../../../utils/auth";
import { getPrisma } from "../../../utils/prisma";
import { listOwnedCategories } from "../../../utils/category-reads";
import {
  messageOrder,
  recoverGeneration,
} from "../../../utils/chat-generation";
import {
  createChatNoteDraft,
  NOTE_DRAFT_INPUT_LIMIT,
  NOTE_DRAFT_TIMEOUT,
} from "../../../utils/chat-note";

export default defineEventHandler(async (event) => {
  const userId = await getAuthenticatedUserId(event);
  const id = getRouterParam(event, "id")!;
  await recoverGeneration(userId, id);
  const chat = await getPrisma().chat.findFirst({
    where: { id, userId },
    select: {
      categoryId: true,
      generationId: true,
      messages: {
        select: { role: true, content: true, status: true },
        orderBy: messageOrder,
      },
    },
  });
  if (!chat)
    throw createError({ statusCode: 404, statusMessage: "Chat not found" });
  if (chat.generationId)
    throw createError({
      statusCode: 409,
      statusMessage: "Wait for the current response to finish",
    });
  const messages = chat.messages
    .filter(
      (m) =>
        (m.role === "user" || m.status === "completed") && m.content.trim(),
    )
    .map(({ role, content }) => ({ role, content }));
  if (!messages.some((m) => m.role === "assistant"))
    throw createError({
      statusCode: 400,
      statusMessage: "A completed response is required",
    });
  if (
    messages.reduce((size, m) => size + m.content.length, 0) >
    NOTE_DRAFT_INPUT_LIMIT
  )
    throw createError({
      statusCode: 413,
      statusMessage: "This conversation is too long to organize into a note",
    });
  const config = useRuntimeConfig(event);
  if (!config.openaiApiKey || !config.openaiModel)
    throw createError({
      statusCode: 503,
      statusMessage: "AI is not configured",
    });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NOTE_DRAFT_TIMEOUT);
  // Leaving/reloading does not produce a background draft or navigate back later.
  const disconnected = () => controller.abort();
  event.node.res.once("close", disconnected);
  try {
    const { categories } = await listOwnedCategories(userId);
    const draft = await createChatNoteDraft(
      messages,
      config,
      controller.signal,
      { categories, chatCategoryId: chat.categoryId },
    );
    if (controller.signal.aborted) throw new Error("Draft request ended");
    return draft;
  } catch {
    throw createError({
      statusCode: controller.signal.aborted ? 504 : 502,
      statusMessage: "Could not create the note draft. Please try again.",
    });
  } finally {
    clearTimeout(timer);
    event.node.res.off("close", disconnected);
  }
});
