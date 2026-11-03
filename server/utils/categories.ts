import { createError } from "nuxt/server";
import { getPrisma } from "./prisma";

export function categoryName(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw createError({ statusCode: 400, statusMessage: "Invalid category" });
  const { name } = body as Record<string, unknown>;
  if (typeof name !== "string")
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid category name",
    });
  const trimmed = name.trim();
  const nameKey = trimmed.normalize("NFKC").toLowerCase();
  if (!trimmed || trimmed.length > 100 || nameKey.length > 100)
    throw createError({
      statusCode: 400,
      statusMessage: "Use 1–100 characters for the category name",
    });
  return { name: trimmed, nameKey };
}

export async function ownedCategory(userId: string, value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || !value)
    throw createError({ statusCode: 400, statusMessage: "Invalid category" });
  const category = await getPrisma().category.findFirst({
    where: { id: value, userId },
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
