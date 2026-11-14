import { getAuthenticatedUserId } from "../../utils/auth";
import { readOwnedChat } from "../../utils/chat-reads";

export default defineEventHandler(async (event) => {
  const userId = await getAuthenticatedUserId(event);
  return readOwnedChat(userId, getRouterParam(event, "id"));
});
