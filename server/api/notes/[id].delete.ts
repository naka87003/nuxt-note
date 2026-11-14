import { createError } from "nuxt/server";
import { getAuthenticatedUserId } from "../../utils/auth";
import { deleteOwnedNote } from "../../utils/note-writes";
import { deleteNoteBodySchema } from "../../utils/input-schemas";
import { parseInput } from "../../utils/parse-input";

export default defineEventHandler(async (event) => {
  const userId = await getAuthenticatedUserId(event);
  const id = getRouterParam(event, "id");
  if (!id)
    throw createError({ statusCode: 404, statusMessage: "Note not found" });
  const input = parseInput(deleteNoteBodySchema, await readBody(event));
  await deleteOwnedNote(userId, { ...input, id });
  setResponseStatus(event, 204);
});
