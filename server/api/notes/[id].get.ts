import { getAuthenticatedUserId } from "../../utils/auth";
import { readOwnedNote } from "../../utils/note-reads";

export default defineEventHandler(async (event) => {
  const userId = await getAuthenticatedUserId(event);
  return readOwnedNote(userId, getRouterParam(event, "id"));
});
