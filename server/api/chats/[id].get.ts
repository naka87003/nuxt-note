import { getAuthenticatedUserId } from "~~/server/utils/auth";
import { readOwnedChat } from "~~/server/utils/chat-reads";

export default defineEventHandler(async (event) => {
  const userId = await getAuthenticatedUserId(event);

  return readOwnedChat(userId, getRouterParam(event, "id"));
});
