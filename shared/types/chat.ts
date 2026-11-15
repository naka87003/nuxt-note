import type { z } from "zod";
import type { chatStatusSchema } from "#shared/schemas/chat";

export type ChatStatus = z.infer<typeof chatStatusSchema>;

export type { ChatStreamEvent } from "#shared/schemas/chat-stream";

export interface Conversation {
  id: string;
  title: string | null;
  categoryId?: string | null;
  generationId: string | null;
  messages: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: ChatStatus;
  replyToId: string | null;
  createdAt: string;
}
