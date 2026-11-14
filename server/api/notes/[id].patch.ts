import { createError } from "nuxt/server";
import { getPrisma } from "../../utils/prisma";
import { getAuthenticatedUserId } from "../../utils/auth";
import { ownedCategory } from "../../utils/categories";
import { normalizeNoteContent } from "../../utils/notes";
import { updateNoteBodySchema } from "../../utils/input-schemas";
import { parseInput } from "../../utils/parse-input";

export default defineEventHandler(async (event) => {
  const userId = await getAuthenticatedUserId(event);
  const id = getRouterParam(event, "id");
  const db = getPrisma();
  if (
    !id ||
    !(await db.note.findFirst({ where: { id, userId }, select: { id: true } }))
  )
    throw createError({ statusCode: 404, statusMessage: "Note not found" });
  const body: unknown = await readBody(event);
  const input = parseInput(updateNoteBodySchema, body);
  const content = normalizeNoteContent(input);
  const categoryId = await ownedCategory(userId, input.categoryId);
  const result = await db.note.updateMany({
    where: { id, userId },
    data: { ...content, categoryId },
  });
  if (!result.count)
    throw createError({ statusCode: 404, statusMessage: "Note not found" });
  return { id, ...content, categoryId };
});
