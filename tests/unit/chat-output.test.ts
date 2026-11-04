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
  await output.append("First");
  await vi.advanceTimersByTimeAsync(0);
  expect(save).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(500);
  expect(save).toHaveBeenCalledTimes(1);
  await output.flush();
  expect(vi.getTimerCount()).toBe(0);
});

it("publishes each delta immediately without waiting for a checkpoint tick", async () => {
  vi.useFakeTimers({ now: 1000 });
  const save = vi.fn().mockResolvedValue(true);
  const publish = vi.fn().mockResolvedValue(undefined);
  const output = createChatOutput({
    controller: new AbortController(),
    save,
    publish,
  });
  await output.append("First");
  await vi.advanceTimersByTimeAsync(20);
  await output.append(" second");
  expect(save).toHaveBeenCalledTimes(1);
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
  await output.append("First");
  await vi.advanceTimersByTimeAsync(5);
  await output.append(" second");
  await vi.advanceTimersByTimeAsync(15);
  expect(save).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(110);
  expect(publish.mock.calls.map(([text]) => text)).toEqual([
    "First",
    " second",
  ]);
  await output.flush();
});

it("saves the remaining text on flush and cancels its scheduled checkpoint", async () => {
  vi.useFakeTimers({ now: 1000 });
  const save = vi.fn().mockResolvedValue(true);
  const publish = vi.fn().mockResolvedValue(undefined);
  const output = createChatOutput({
    controller: new AbortController(),
    save,
    publish,
  });
  await output.append("First");
  await vi.advanceTimersByTimeAsync(20);
  await output.append(" second");
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
  await output.append("First");
  await vi.advanceTimersByTimeAsync(20);
  await output.append(" second");
  controller.abort();
  await output.flush();
  expect(vi.getTimerCount()).toBe(0);
  expect(save).toHaveBeenCalledTimes(1);
  expect(output.content).toBe("First second");
});

it("delivers text while a checkpoint is blocked and serializes later saves", async () => {
  vi.useFakeTimers();
  let release!: () => void;
  const save = vi
    .fn()
    .mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        release = () => resolve(true);
      }),
    )
    .mockResolvedValue(true);
  const publish = vi.fn().mockResolvedValue(undefined);
  const output = createChatOutput({
    controller: new AbortController(),
    save,
    publish,
  });
  await output.append("First");
  await output.append(" second");
  await vi.advanceTimersByTimeAsync(500);
  expect(publish.mock.calls.map(([text]) => text)).toEqual([
    "First",
    " second",
  ]);
  expect(save).toHaveBeenCalledTimes(1);
  let flushed = false;
  const flushing = output.flush().then(() => {
    flushed = true;
  });
  await Promise.resolve();
  expect(flushed).toBe(false);
  release();
  await flushing;
  expect(save.mock.calls.map(([text]) => text)).toEqual([
    "First",
    "First second",
  ]);
  expect(vi.getTimerCount()).toBe(0);
});

it("aborts on delivery failure and retains accumulated text for terminal persistence", async () => {
  const controller = new AbortController();
  const publish = vi.fn().mockRejectedValue(new Error("Disconnected"));
  const output = createChatOutput({
    controller,
    save: vi.fn().mockResolvedValue(true),
    publish,
  });
  await output.append("Partial");
  expect(controller.signal.aborted).toBe(true);
  expect(output.failed).toBe(true);
  await output.append(" ignored");
  expect(output.content).toBe("Partial");
  expect(publish).toHaveBeenCalledTimes(1);
  await output.flush();
});
