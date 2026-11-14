import { getPrisma } from "../../utils/prisma";
import { getAuthenticatedUserId } from "../../utils/auth";
import { contentQuery } from "../../utils/content-query";
import { contentPreview } from "#shared/utils/content-preview";
export default defineEventHandler(async (event) => {
  const userId = await getAuthenticatedUserId(event);
  const chats = await getPrisma().chat.findMany({
    where: { userId, ...contentQuery(getQuery(event), "messages") },
    select: {
      id: true,
      title: true,
      categoryId: true,
      updatedAt: true,
      messages: {
        where: { role: "user" },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 1,
        select: { content: true },
      },
    },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
  });
  return Promise.all(
    chats.map(async ({ messages, ...chat }) => ({
      ...chat,
      preview: await contentPreview(messages[0]?.content ?? ""),
    })),
  );
});
