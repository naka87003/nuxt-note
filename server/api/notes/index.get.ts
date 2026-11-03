import { getPrisma } from "../../utils/prisma";
import { getAuthenticatedUserId } from "../../utils/auth";
import { contentPreview } from "../../utils/content-preview";

import { contentQuery } from "../../utils/content-query";

export default defineEventHandler(async (event) => {
  const userId = await getAuthenticatedUserId(event);
  const notes = await getPrisma().note.findMany({
    where: { userId, ...contentQuery(getQuery(event), "markdown") },
    select: {
      id: true,
      title: true,
      categoryId: true,
      updatedAt: true,
      markdown: true,
    },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
  });
  return notes.map(({ markdown, ...note }) => ({
    ...note,
    preview: contentPreview(markdown),
  }));
});
