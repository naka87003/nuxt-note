import { createError } from "nuxt/server";
import { getAuthenticatedUserId } from "~~/server/utils/auth";
import { deleteOwnedNote } from "~~/server/utils/note-writes";
import { deleteNoteBodySchema } from "~~/server/utils/input-schemas";
import { parseInput } from "~~/server/utils/parse-input";

export default defineEventHandler(async (event) => {
  const userId = await getAuthenticatedUserId(event);
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 404, statusMessage: "Note not found" });
  }

  const input = parseInput(deleteNoteBodySchema, await readBody(event));
  await deleteOwnedNote(userId, { ...input, id });
  setResponseStatus(event, 204);
});
