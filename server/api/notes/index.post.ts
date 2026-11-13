import { createOwnedNote } from "../../utils/note-writes";
import { getAuthenticatedUserId } from "../../utils/auth";

export default defineEventHandler(async (event) => {
  const userId = await getAuthenticatedUserId(event);
  const body: unknown = await readBody(event);
  const note = await createOwnedNote(userId, body);
  setResponseStatus(event, 201);
  return { id: note.id };
});
