import { noteContent } from "../../utils/notes";
import { getPrisma } from "../../utils/prisma";
import { getAuthenticatedUserId } from "../../utils/auth";

import { ownedCategory } from "../../utils/categories";

export default defineEventHandler(async (event) => {
  const userId = await getAuthenticatedUserId(event);
  const body: unknown = await readBody(event);
  const content = noteContent(body);
  const categoryId = await ownedCategory(
    userId,
    (body as Record<string, unknown>).categoryId,
  );
  const note = await getPrisma().note.create({
    data: {
      ...content,
      userId,
      categoryId,
    },
    select: { id: true },
  });
  setResponseStatus(event, 201);
  return note;
});
