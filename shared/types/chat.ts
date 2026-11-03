export type ChatStatus = "completed" | "generating" | "stopped" | "failed";
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: string;
  replyToId: string | null;
  createdAt: string;
}
