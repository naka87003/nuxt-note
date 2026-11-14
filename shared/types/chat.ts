export type ChatStatus = "completed" | "generating" | "stopped" | "failed";
export type { ChatStreamEvent } from "#shared/schemas/chat-stream";
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: string;
  replyToId: string | null;
  createdAt: string;
}
