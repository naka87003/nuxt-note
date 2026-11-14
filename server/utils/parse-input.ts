import type { z } from "zod";
import { createError } from "nuxt/server";

// Keep Zod details internal and return one actionable input error to API callers.
export function parseInput<S extends z.ZodType>(
  schema: S,
  value: unknown,
): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: result.error.issues[0]?.message ?? "Invalid input",
    });
  }
  return result.data;
}
