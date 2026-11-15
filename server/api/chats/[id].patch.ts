import { getAuthenticatedUserId } from "~~/server/utils/auth";
import { updateOwnedChatCategory } from "~~/server/utils/chat-writes";

export default defineEventHandler(async (event) => {
  const userId = await getAuthenticatedUserId(event);

  return updateOwnedChatCategory(
    userId,
    getRouterParam(event, "id"),
    await readBody(event),
  );
});
