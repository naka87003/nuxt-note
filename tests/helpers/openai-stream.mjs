// Loaded only by scripts/test-chat.mjs in its isolated server subprocess.
// No provider requests leave this process and no real API key is loaded.
import { setTimeout as delay } from "node:timers/promises";
const originalFetch = globalThis.fetch;
let failures = 0;
globalThis.fetch = async (input, init) => {
  if (!String(input).startsWith("https://api.openai.com/"))
    return originalFetch(input, init);
  const body = JSON.parse(init.body);
  const prompt = JSON.stringify(body.input);
  const fail = prompt.includes("FAIL") && failures++ === 0;
  const slow = prompt.includes("SLOW");
  const signal = init.signal;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      try {
        send({
          type: "response.created",
          response: { id: "resp-test", created_at: 1, model: "test-model" },
        });
        send({
          type: "response.output_item.added",
          output_index: 0,
          item: { type: "message", id: "msg-test" },
        });
        send({
          type: "response.output_text.delta",
          item_id: "msg-test",
          delta: "Partial",
        });
        await delay(slow ? 3000 : 30, undefined, { signal });
        if (fail)
          send({
            type: "response.failed",
            sequence_number: 3,
            response: {
              error: { code: "test_error", message: "Test provider error" },
            },
          });
        else {
          send({
            type: "response.output_text.delta",
            item_id: "msg-test",
            delta: " answer",
          });
          send({
            type: "response.output_item.done",
            output_index: 0,
            item: { type: "message", id: "msg-test" },
          });
          send({
            type: "response.completed",
            response: { usage: { input_tokens: 1, output_tokens: 2 } },
          });
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream" },
  });
};
