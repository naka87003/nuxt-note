import { randomUUID } from "node:crypto";
import { createError } from "nuxt/server";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { getAuthenticatedUserId } from "../../../utils/auth";
import { getPrisma } from "../../../utils/prisma";
import {
  GENERATION_TIMEOUT,
  lockIdleChat,
  messageOrder,
  recoverGeneration,
  requestId,
  requireChat,
  saveGeneration,
} from "../../../utils/chat-generation";

export default defineEventHandler(async (event) => {
  const userId = await getAuthenticatedUserId(event);
  const id = getRouterParam(event, "id")!;
  await requireChat(userId, id);
  const body = await readBody(event);
  const messageId = requestId(body?.messageId);
  const attemptId = requestId(body?.attemptId);
  const config = useRuntimeConfig(event);
  if (!config.openaiApiKey || !config.openaiModel)
    throw createError({
      statusCode: 503,
      statusMessage: "AI is not configured",
    });
  await recoverGeneration(userId, id);
  const { reply, history } = await getPrisma().$transaction(async (tx) => {
    await lockIdleChat(tx, userId, id);
    const messages = await tx.message.findMany({
      where: { chatId: id },
      orderBy: messageOrder,
    });
    const question = messages.filter((m) => m.role === "user").at(-1);
    if (!question || question.id !== messageId)
      throw createError({
        statusCode: 409,
        statusMessage: "Only the latest question can be retried",
      });
    const previous = messages.find((m) => m.replyToId === messageId);
    if (previous?.status === "completed")
      throw createError({
        statusCode: 409,
        statusMessage: "This response is already complete",
      });
    const reply = await tx.message.upsert({
      where: { replyToId: messageId },
      create: {
        id: randomUUID(),
        chatId: id,
        replyToId: messageId,
        role: "assistant",
        content: "",
        status: "generating",
        createdAt: new Date(
          Math.max(Date.now(), question.createdAt.getTime() + 1),
        ),
      },
      update: { content: "", status: "generating" },
    });
    await tx.chat.updateMany({
      where: { id, userId },
      data: { generationId: attemptId, generationStartedAt: new Date() },
    });
    // Include successful/stopped exchanges and the current question. Failed partial text is excluded.
    const history = messages
      .filter(
        (m) =>
          m.id === messageId ||
          (m.role === "assistant"
            ? ["completed", "stopped"].includes(m.status) && !!m.content
            : messages.some(
                (r) =>
                  r.replyToId === m.id &&
                  ["completed", "stopped"].includes(r.status) &&
                  !!r.content,
              )),
      )
      .filter((m) => m.id !== previous?.id)
      .map((m) => ({ role: m.role, content: m.content }));
    if (history.reduce((size, m) => size + m.content.length, 0) > 100_000)
      throw createError({
        statusCode: 413,
        statusMessage: "This conversation is too long. Start a new chat.",
      });
    return { reply, history };
  });
  const controller = new AbortController();
  let timedOut = false;
  let finished = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, GENERATION_TIMEOUT);
  const stream = createEventStream(event, { autoclose: false });
  const disconnected = () => {
    if (!finished) controller.abort();
  };
  event.node.res.once("close", disconnected);
  stream.onClosed(() => {
    if (!finished) controller.abort();
  });
  setResponseHeader(event, "X-Accel-Buffering", "no");
  // Consume provider events on the server, including error/incomplete terminal states.
  const run = async () => {
    let content = "";
    let status = "failed";
    let published = 0;
    let savedAt = 0;
    const publish = async () => {
      if (content.length === published) return;
      if (
        !(await saveGeneration(
          userId,
          id,
          attemptId,
          reply.id,
          content,
          "generating",
        ))
      ) {
        controller.abort();
        return;
      }
      await stream.push(
        JSON.stringify({ type: "text", text: content.slice(published) }),
      );
      published = content.length;
      savedAt = Date.now();
    };
    try {
      await stream.push(JSON.stringify({ type: "start", messageId: reply.id }));
      const response = streamText({
        model: createOpenAI({ apiKey: config.openaiApiKey })(
          config.openaiModel,
        ),
        messages: history,
        abortSignal: controller.signal,
        maxOutputTokens: 4096,
        maxRetries: 0,
        // Provider errors can contain request details; return a generic failure.
        onError: () => {},
        providerOptions: { openai: { store: false } },
      });
      for await (const part of response.fullStream) {
        if (part.type === "text-delta") {
          content += part.text;
          // Batch database writes, then publish only checkpointed text.
          if (Date.now() - savedAt >= 100 || content.length - published >= 256)
            await publish();
          if (controller.signal.aborted) break;
        } else if (part.type === "error") throw part.error;
        else if (part.type === "finish")
          status =
            part.finishReason === "stop" && content.trim()
              ? "completed"
              : "failed";
      }
      if (!controller.signal.aborted) await publish();
    } catch {
      status = controller.signal.aborted && !timedOut ? "stopped" : "failed";
    } finally {
      clearTimeout(timer);
      if (controller.signal.aborted) status = timedOut ? "failed" : "stopped";
      try {
        await saveGeneration(userId, id, attemptId, reply.id, content, status);
        finished = true;
        if (!controller.signal.aborted)
          await stream.push(JSON.stringify({ type: "done", status }));
      } finally {
        finished = true;
        event.node.res.off("close", disconnected);
        await stream.close();
      }
    }
  };
  void run().catch(() => {
    controller.abort();
  });
  return stream.send();
});
