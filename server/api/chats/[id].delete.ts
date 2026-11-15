import { getAuthenticatedUserId } from "~~/server/utils/auth";
import { deleteOwnedChat } from "~~/server/utils/chat-writes";

export default defineEventHandler(async (event) => {
  const userId = await getAuthenticatedUserId(event);
  await deleteOwnedChat(userId, getRouterParam(event, "id"));
  setResponseStatus(event, 204);
});
