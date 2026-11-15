import { z } from "zod";
import { chatStatusSchema } from "./chat";

export const chatStreamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("start"), messageId: z.string().min(1) }),
  z.object({ type: z.literal("text"), text: z.string() }),
  z.object({
    type: z.literal("done"),
    status: chatStatusSchema.exclude(["generating"]),
    title: z.string().optional(),
    categoryId: z.string().nullable().optional(),
  }),
]);

export type ChatStreamEvent = z.infer<typeof chatStreamEventSchema>;
