import { expect, it } from "vitest";
import { readChatStream } from "@/utils/chat-stream";
import type { ChatStreamEvent } from "#shared/types/chat";

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

it.each(["invalid JSON", '{"type":"text","text":"unfinished', ""])(
  "reports malformed JSON with a user-facing error: %j",
  async (data) => {
    const body = new Response(`data: ${data}\n\n`).body!;
    const reading = async () => {
      for await (const event of readChatStream(body)) void event;
    };
    await expect(reading()).rejects.toThrow(
      "Invalid response data. Please try again.",
    );
    expect(body.locked).toBe(false);
  },
);

it.each([
  null,
  [],
  {},
  { type: "unknown" },
  { type: "start" },
  { type: "start", messageId: "" },
  { type: "start", messageId: 42 },
  { type: "text" },
  { type: "text", text: null },
  { type: "done" },
  { type: "done", status: "generating" },
  { type: "done", status: "unknown" },
])("rejects an invalid event without yielding it: %j", async (event) => {
  const body = new Response(`data: ${JSON.stringify(event)}\n\n`).body!;
  const received = [];
  const reading = async () => {
    for await (const value of readChatStream(body)) received.push(value);
  };
  await expect(reading()).rejects.toThrow(
    "Invalid response data. Please try again.",
  );
  expect(received).toEqual([]);
  expect(body.locked).toBe(false);
});

it.each(["completed", "stopped", "failed"])(
  "accepts terminal status %s and preserves text whitespace",
  async (status) => {
    const events = [
      { type: "start", messageId: "reply", extra: "ignored" },
      { type: "text", text: "" },
      { type: "text", text: " \n😀 " },
      { type: "done", status },
    ];
    const body = new Response(
      events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""),
    ).body!;
    const received = [];
    for await (const event of readChatStream(body)) received.push(event);
    expect(received).toEqual([
      { type: "start", messageId: "reply" },
      ...events.slice(1),
    ]);
  },
);
