export type ChatStatus = "completed" | "generating" | "stopped" | "failed";
export type ChatStreamEvent =
  | { type: "start"; messageId: string }
  | { type: "text"; text: string }
  | { type: "done"; status: Exclude<ChatStatus, "generating"> };
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: string;
  replyToId: string | null;
  createdAt: string;
}
