import { INPUT_LIMITS } from "#shared/utils/input-limits";
import { createError } from "nuxt/server";
import { getPrisma } from "./prisma";
import { categoryIdSchema, categoryNameSchema } from "./input-schemas";

export function categoryName(body: unknown) {
  const parsed = categoryNameSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue?.code === "invalid_type")
      throw createError({
        statusCode: 400,
        statusMessage: issue.path.length
          ? "Invalid category name"
          : "Invalid category",
      });
    throw createError({
      statusCode: 400,
      statusMessage: `Use 1–${INPUT_LIMITS.categoryName} characters for the category name`,
    });
  }
  return parsed.data;
}

export async function ownedCategory(userId: string, value: unknown) {
  const parsed = categoryIdSchema.safeParse(value);
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: "Invalid category" });
  }
  if (parsed.data == null) return null;
  const category = await getPrisma().category.findFirst({
    where: { id: parsed.data, userId },
    select: { id: true },
  });
  if (!category)
    throw createError({ statusCode: 404, statusMessage: "Category not found" });
  return category.id;
}

export function categoryConflict(error: unknown): never {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "P2002"
  )
    throw createError({
      statusCode: 409,
      statusMessage: "A category with this name already exists",
    });
  throw error;
}

export async function createOwnedCategory(userId: string, input: unknown) {
  const data = categoryName(input);
  try {
    return await getPrisma().category.create({
      data: { ...data, userId },
      select: { id: true, name: true },
    });
  } catch (error) {
    categoryConflict(error);
  }
}
