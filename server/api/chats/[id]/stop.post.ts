import { getAuthenticatedUserId } from "../../../utils/auth";
import { getPrisma } from "../../../utils/prisma";
import { requestId, requireChat } from "../../../utils/chat-generation";

export default defineEventHandler(async (event) => {
  const userId = await getAuthenticatedUserId(event);
  const id = getRouterParam(event, "id")!;
  await requireChat(userId, id);
  const body = await readBody(event);
  const attemptId = requestId(body?.attemptId);
  await getPrisma().$transaction(async (tx) => {
    const result = await tx.chat.updateMany({
      where: { id, userId, generationId: attemptId },
      data: { generationId: null, generationStartedAt: null },
    });
    if (result.count)
      await tx.message.updateMany({
        where: { chatId: id, status: "generating" },
        data: { status: "stopped" },
      });
  });
  setResponseStatus(event, 204);
});
