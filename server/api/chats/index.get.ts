import { getAuthenticatedUserId } from "../../utils/auth";
import { listOwnedChats } from "../../utils/chat-reads";

export default defineEventHandler(async (event) => {
  const userId = await getAuthenticatedUserId(event);
  return listOwnedChats(userId, getQuery(event));
});
