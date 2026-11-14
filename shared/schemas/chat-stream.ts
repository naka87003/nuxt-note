import { z } from "zod";

export const chatStreamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("start"), messageId: z.string().min(1) }),
  z.object({ type: z.literal("text"), text: z.string() }),
  z.object({
    type: z.literal("done"),
    status: z.enum(["completed", "stopped", "failed"]),
  }),
]);

export type ChatStreamEvent = z.infer<typeof chatStreamEventSchema>;
