import { createError } from "nuxt/server";
import { lockOwnedCategories } from "./categories";
import { moveCategoryNotes } from "./note-writes";
import { moveCategoryChats } from "./chat-writes";
import { mergeCategoriesInputSchema } from "./input-schemas";
import { parseInput } from "./parse-input";
import { getPrisma } from "./prisma";

export async function mergeOwnedCategories(
  userId: string,
  body: unknown,
  currentChatId?: string,
) {
  const input = parseInput(mergeCategoriesInputSchema, body);

  return getPrisma().$transaction(async (tx) => {
    const { sourceCategoryId, targetCategoryId } = input;
    // Block new foreign-key assignments until the source has been removed.
    await lockOwnedCategories(
      tx,
      userId,
      [sourceCategoryId, targetCategoryId],
      "update",
    );

    const movedNoteCount = await moveCategoryNotes(
      tx,
      userId,
      sourceCategoryId,
      targetCategoryId,
    );

    const { movedCount: movedChatCount, currentChatMoved } =
      await moveCategoryChats(
        tx,
        userId,
        sourceCategoryId,
        targetCategoryId,
        currentChatId,
      );

    // Never let ON DELETE SET NULL silently detach any remaining assignments.
    const deleted = await tx.category.deleteMany({
      where: {
        id: sourceCategoryId,
        userId,
        notes: { none: {} },
        chats: { none: {} },
      },
    });

    if (!deleted.count) {
      throw createError({
        statusCode: 409,
        statusMessage: "Category could not be emptied",
      });
    }

    return { ...input, movedNoteCount, movedChatCount, currentChatMoved };
  });
}
