import { computed, ref } from "vue";
import { beforeEach, expect, it, vi } from "vitest";
import { useChatNoteDraft } from "../../app/composables/useChatNoteDraft";

const request = vi.fn();
let dispose: () => void;
const draft = { title: "Summary", markdown: "# Summary", categoryId: "nuxt" };

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("ref", ref);
  vi.stubGlobal("computed", computed);
  vi.stubGlobal("onBeforeUnmount", (fn: () => void) => {
    dispose = fn;
  });
  vi.stubGlobal("$fetch", request);
  request.mockResolvedValue(draft);
});

it("waits for confirmation and can dismiss before starting AI", async () => {
  const openDraft = vi.fn();
  const flow = useChatNoteDraft(() => "chat", openDraft);
  flow.confirm();
  expect(flow.phase.value).toBe("confirm");
  expect(request).not.toHaveBeenCalled();
  flow.open.value = false;
  await flow.create();
  expect(request).not.toHaveBeenCalled();
});

it("blocks dismissal and duplicate submissions during generation, then opens the draft", async () => {
  let resolve!: (value: typeof draft) => void;
  request.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const openDraft = vi.fn().mockResolvedValue(undefined);
  const flow = useChatNoteDraft(() => "chat", openDraft);
  flow.confirm();
  const pending = flow.create();
  flow.open.value = false;
  flow.confirm();
  await flow.create();
  expect(flow.busy.value).toBe(true);
  expect(flow.open.value).toBe(true);
  expect(request).toHaveBeenCalledTimes(1);
  resolve(draft);
  await pending;
  expect(openDraft).toHaveBeenCalledWith(draft);
  expect(flow.open.value).toBe(false);
});

it("allows manual retry after an error without creating a blank draft", async () => {
  request.mockRejectedValueOnce({ statusCode: 413 });
  const openDraft = vi.fn().mockResolvedValue(undefined);
  const flow = useChatNoteDraft(() => "chat", openDraft);
  flow.confirm();
  await flow.create();
  expect(flow.phase.value).toBe("failed");
  expect(flow.failure.value).toContain("too long");
  expect(openDraft).not.toHaveBeenCalled();
  await flow.create();
  expect(openDraft).toHaveBeenCalledWith(draft);
});

it("ignores late responses after leaving and aborts the local request", async () => {
  let resolve!: (value: typeof draft) => void;
  request.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const openDraft = vi.fn();
  const flow = useChatNoteDraft(() => "chat", openDraft);
  flow.confirm();
  const pending = flow.create();
  dispose();
  expect(request.mock.calls[0]![1].signal.aborted).toBe(true);
  resolve(draft);
  await pending;
  expect(openDraft).not.toHaveBeenCalled();
});

it("does not regenerate paid output if opening the editor fails", async () => {
  const openDraft = vi
    .fn()
    .mockRejectedValueOnce(new Error("Could not open the note draft"))
    .mockResolvedValue(undefined);
  const flow = useChatNoteDraft(() => "chat", openDraft);
  flow.confirm();
  await flow.create();
  expect(flow.phase.value).toBe("failed");
  await flow.create();
  expect(request).toHaveBeenCalledTimes(1);
  expect(openDraft).toHaveBeenCalledTimes(2);
});
