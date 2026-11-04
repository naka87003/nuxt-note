import { afterEach, expect, it, vi } from "vitest";
import { createChatOutput } from "../../server/utils/chat-output";

afterEach(() => vi.useRealTimers());

it("does no database work while idle and stops its timer after flushing", async () => {
  vi.useFakeTimers();
  const save = vi.fn().mockResolvedValue(true);
  const output = createChatOutput({
    controller: new AbortController(),
    save,
    publish: vi.fn().mockResolvedValue(undefined),
  });
  await vi.advanceTimersByTimeAsync(500);
  expect(save).not.toHaveBeenCalled();
  output.append("First");
  await vi.advanceTimersByTimeAsync(0);
  expect(save).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(500);
  expect(save).toHaveBeenCalledTimes(1);
  await output.flush();
  expect(vi.getTimerCount()).toBe(0);
});

it("publishes a buffered delta within the batch interval even when AI pauses", async () => {
  vi.useFakeTimers({ now: 1000 });
  const save = vi.fn().mockResolvedValue(true);
  const publish = vi.fn().mockResolvedValue(undefined);
  const output = createChatOutput({
    controller: new AbortController(),
    save,
    publish,
  });
  output.append("First");
  await vi.advanceTimersByTimeAsync(20);
  output.append(" second");
  await vi.advanceTimersByTimeAsync(100);
  expect(publish.mock.calls.map(([text]) => text)).toEqual([
    "First",
    " second",
  ]);
  await output.flush();
});

it("batches output received during a write instead of continuously writing to the database", async () => {
  vi.useFakeTimers({ now: 1000 });
  const save = vi.fn(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
    return true;
  });
  const publish = vi.fn().mockResolvedValue(undefined);
  const output = createChatOutput({
    controller: new AbortController(),
    save,
    publish,
  });
  output.append("First");
  await vi.advanceTimersByTimeAsync(5);
  output.append(" second");
  await vi.advanceTimersByTimeAsync(15);
  expect(save).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(110);
  expect(publish.mock.calls.map(([text]) => text)).toEqual([
    "First",
    " second",
  ]);
  await output.flush();
});

it("flushes the last batch immediately and cancels its scheduled checkpoint", async () => {
  vi.useFakeTimers({ now: 1000 });
  const save = vi.fn().mockResolvedValue(true);
  const publish = vi.fn().mockResolvedValue(undefined);
  const output = createChatOutput({
    controller: new AbortController(),
    save,
    publish,
  });
  output.append("First");
  await vi.advanceTimersByTimeAsync(20);
  output.append(" second");
  expect(vi.getTimerCount()).toBe(1);
  await output.flush();
  expect(publish.mock.calls.map(([text]) => text)).toEqual([
    "First",
    " second",
  ]);
  expect(vi.getTimerCount()).toBe(0);
  await vi.advanceTimersByTimeAsync(1000);
  expect(save).toHaveBeenCalledTimes(2);
});

it("cancels buffered writes on stop and leaves terminal persistence to the caller", async () => {
  vi.useFakeTimers({ now: 1000 });
  const controller = new AbortController();
  const save = vi.fn().mockResolvedValue(true);
  const publish = vi.fn().mockResolvedValue(undefined);
  const output = createChatOutput({ controller, save, publish });
  output.append("First");
  await vi.advanceTimersByTimeAsync(20);
  output.append(" second");
  controller.abort();
  await output.flush();
  expect(vi.getTimerCount()).toBe(0);
  expect(save).toHaveBeenCalledTimes(1);
  expect(output.content).toBe("First second");
});
