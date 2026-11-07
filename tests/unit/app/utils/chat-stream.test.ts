import { expect, it } from "vitest";
import { readChatStream } from "../../../../app/utils/chat-stream";
import type { ChatStreamEvent } from "../../../../shared/types/chat";

it.each([1, 7, 10_000])(
  "reads events and UTF-8 characters split across chunks of %i bytes",
  async (chunkSize) => {
    const events: ChatStreamEvent[] = [
      { type: "start", messageId: "reply" },
      { type: "text", text: "こんにちは 👋\nSecond line" },
      { type: "done", status: "completed" },
    ];
    const bytes = new TextEncoder().encode(
      ": keep-alive\r\n\r\n" +
        events
          .map((event) => `data: ${JSON.stringify(event)}\r\n\r\n`)
          .join(""),
    );
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let offset = 0; offset < bytes.length; offset += chunkSize)
          controller.enqueue(bytes.slice(offset, offset + chunkSize));
        controller.close();
      },
    });
    const received = [];
    for await (const event of readChatStream(body)) received.push(event);
    expect(received).toEqual(events);
  },
);

it("propagates malformed event errors so the conversation can reload saved state", async () => {
  const body = new Response("data: invalid JSON\n\n").body!;
  const reading = async () => {
    for await (const event of readChatStream(body)) void event;
  };
  await expect(reading()).rejects.toThrow(SyntaxError);
});
