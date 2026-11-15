import { createError } from "nuxt/server";
import { getAuthenticatedUserId } from "~~/server/utils/auth";
import { updateOwnedNote } from "~~/server/utils/note-writes";
import { updateNoteBodySchema } from "~~/server/utils/input-schemas";
import { parseInput } from "~~/server/utils/parse-input";

export default defineEventHandler(async (event) => {
  const userId = await getAuthenticatedUserId(event);
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 404, statusMessage: "Note not found" });
  }

  const input = parseInput(updateNoteBodySchema, await readBody(event));

  return updateOwnedNote(userId, { ...input, id });
});
