import { getAuthenticatedUserId } from "../../utils/auth";
import { listOwnedNotes } from "../../utils/note-reads";

export default defineEventHandler(async (event) => {
  const userId = await getAuthenticatedUserId(event);
  return listOwnedNotes(userId, getQuery(event));
});
