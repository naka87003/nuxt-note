import { noteContent } from "./notes";
import { ownedCategory } from "./categories";
import { getPrisma } from "./prisma";

export async function createOwnedNote(userId: string, body: unknown) {
  const content = noteContent(body);
  const categoryId = await ownedCategory(
    userId,
    (body as Record<string, unknown>).categoryId,
  );
  return getPrisma().note.create({
    data: { ...content, userId, categoryId },
    select: {
      id: true,
      title: true,
      markdown: true,
      categoryId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}
