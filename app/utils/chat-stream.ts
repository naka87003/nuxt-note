import { chatStreamEventSchema } from "../../shared/schemas/chat-stream";

function parseEvent(data: string) {
  try {
    return chatStreamEventSchema.parse(JSON.parse(data));
  } catch {
    throw new Error("Invalid response data. Please try again.");
  }
}

// The chat endpoint sends one JSON event per SSE data line. Network chunks
// can split a line or contain several events, independently of token boundaries.
export async function* readChatStream(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.startsWith("data:")) {
          yield parseEvent(line.slice(5).trim());
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
