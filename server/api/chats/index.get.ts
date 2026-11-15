import { getAuthenticatedUserId } from "~~/server/utils/auth";
import { listOwnedChats } from "~~/server/utils/chat-reads";

export default defineEventHandler(async (event) => {
  const userId = await getAuthenticatedUserId(event);

  return listOwnedChats(userId, getQuery(event));
});
