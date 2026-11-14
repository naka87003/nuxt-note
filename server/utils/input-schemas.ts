import { z } from "zod";
import { INPUT_LIMITS } from "#shared/utils/input-limits";

// Zod's max uses Unicode code points; the app uses HTML maxlength (UTF-16 units).
// Keep max for the published JSON Schema and enforce the app's limit at runtime.
function limitedText(maximum: number, label: string) {
  const error = `${label} must be at most ${maximum} characters`;
  return z
    .string({
      error: (issue) =>
        issue.input === undefined
          ? `${label} is required`
          : `${label} must be a string`,
    })
    .max(maximum, { error })
    .refine((value) => value.length <= maximum, { error });
}

// Keep transport schemas free of transforms so MCP can publish their JSON Schema.
export const noteContentShape = {
  title: limitedText(INPUT_LIMITS.noteTitle, "Title"),
  markdown: limitedText(INPUT_LIMITS.noteBody, "Markdown body"),
};

export const noteContentSchema = z.object(noteContentShape, {
  error: "Invalid note",
});
export type NoteContentInput = z.infer<typeof noteContentSchema>;

// Limits apply before trimming, matching browser maxlength and existing API input.
export const createCategoryInputSchema = z.object({
  name: limitedText(INPUT_LIMITS.categoryName, "Category name")
    .refine((name) => !!name.trim(), {
      error: "Category name must not be blank",
    })
    .refine(
      (name) => name.trim().normalize("NFKC").toLowerCase().length <= 100,
      {
        error: "Normalized category name must be at most 100 characters",
      },
    ),
});

export const categoryNameSchema = createCategoryInputSchema.transform(
  ({ name }) => ({
    name: name.trim(),
    nameKey: name.trim().normalize("NFKC").toLowerCase(),
  }),
);

export const categoryIdSchema = z
  .string({ error: "Invalid category" })
  .min(1, { error: "Invalid category" })
  .nullish();

const noteCategoryIdSchema = z
  .string({
    error: (issue) =>
      issue.input === undefined
        ? "Category is required"
        : "Category ID must be a string or null",
  })
  .min(1, { error: "Category ID must not be empty" })
  .nullable();

// The browser replaces the category on update; MCP may omit it to keep it.
export const createNoteInputSchema = noteContentSchema.extend({
  categoryId: noteCategoryIdSchema.optional(),
});
export const updateNoteBodySchema = noteContentSchema.extend({
  categoryId: noteCategoryIdSchema,
});

export const noteVersionShape = {
  id: z.string().min(1).max(100),
  updatedAt: z.iso
    .datetime({ precision: 3 })
    .describe("Exact updatedAt returned by get_note"),
};
export const noteToolCategoryIdSchema = noteCategoryIdSchema
  .unwrap()
  .max(100)
  .nullable()
  .optional();
export const updateNoteInputSchema = noteContentSchema
  .extend({
    ...noteVersionShape,
    categoryId: noteToolCategoryIdSchema,
  })
  .strict();

export const contentQueryShape = {
  category: z.string().optional(),
  q: limitedText(INPUT_LIMITS.search, "Search text").optional(),
};
export const contentQuerySchema = z.object(contentQueryShape);

export const requestIdSchema = z
  .string({ error: "Invalid request ID" })
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    { error: "Invalid request ID" },
  );

export const messageInputSchema = z.object(
  {
    messageId: requestIdSchema,
    content: limitedText(INPUT_LIMITS.chatMessage, "Message")
      .trim()
      .min(1, { error: "Message must not be empty" }),
  },
  { error: "Invalid message" },
);

export const createChatInputSchema = messageInputSchema.extend({
  chatId: requestIdSchema,
  categoryId: categoryIdSchema,
});

export const generateChatInputSchema = z.object(
  {
    messageId: requestIdSchema,
    attemptId: requestIdSchema,
  },
  { error: "Invalid generation request" },
);

export const updateChatCategorySchema = z.object(
  {
    categoryId: z
      .string({ error: "Invalid category" })
      .min(1, { error: "Invalid category" })
      .nullable(),
  },
  { error: "Invalid category" },
);

export const agentTokenInputSchema = z.object({
  name: limitedText(50, "Token name").trim().min(1),
});
