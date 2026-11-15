import { getAuthenticatedUserId } from "~~/server/utils/auth";
import { listOwnedNotes } from "~~/server/utils/note-reads";

export default defineEventHandler(async (event) => {
  const userId = await getAuthenticatedUserId(event);

  return listOwnedNotes(userId, getQuery(event));
});
