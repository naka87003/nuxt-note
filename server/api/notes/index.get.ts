import { getPrisma } from "../../utils/prisma";
import { getAuthenticatedUserId } from "../../utils/auth";
import { contentPreview } from "../../../shared/utils/content-preview";

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
  return Promise.all(
    notes.map(async ({ markdown, ...note }) => ({
      ...note,
      preview: await contentPreview(markdown),
    })),
  );
});
