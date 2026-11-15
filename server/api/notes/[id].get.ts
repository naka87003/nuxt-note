import { getAuthenticatedUserId } from "~~/server/utils/auth";
import { readOwnedNote } from "~~/server/utils/note-reads";

export default defineEventHandler(async (event) => {
  const userId = await getAuthenticatedUserId(event);
  return readOwnedNote(userId, getRouterParam(event, "id"));
});
