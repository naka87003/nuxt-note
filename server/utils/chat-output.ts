interface ChatOutputOptions {
  controller: AbortController;
  save: (content: string) => Promise<boolean>;
  publish: (text: string) => Promise<unknown>;
}

// Deliver provider deltas immediately. A separate writer checkpoints partial
// answers without putting database latency in the display path.
export function createChatOutput({
  controller,
  save,
  publish,
}: ChatOutputOptions) {
  let content = "";
  let saved = 0;
  let pending: Promise<void> | undefined;
  let failed = false;
  // A fixed cadence handles both continuous output and pauses. Idle ticks do
  // no database work, and at most one write can be in flight.
  const timer = setInterval(startCheckpoint, 100);

  function startCheckpoint() {
    if (pending || controller.signal.aborted || content.length === saved)
      return;
    pending = (async () => {
      const snapshot = content;
      if (!(await save(snapshot))) {
        controller.abort();
        return;
      }
      saved = snapshot.length;
    })()
      .catch(() => {
        failed = true;
        controller.abort();
      })
      .finally(() => {
        pending = undefined;
      });
  }

  return {
    get content() {
      return content;
    },
    get failed() {
      return failed;
    },
    async append(text: string) {
      if (controller.signal.aborted) return;
      content += text;
      if (saved === 0) startCheckpoint();
      try {
        // The caller awaits delivery to preserve ordering and backpressure,
        // independently of any checkpoint currently in flight.
        await publish(text);
      } catch {
        failed = true;
        controller.abort();
      }
    },
    async flush() {
      // Drain before a terminal write, including after cancellation. Never let
      // an older checkpoint overwrite completed/stopped/failed content.
      clearInterval(timer);
      await pending;
      startCheckpoint();
      await pending;
    },
  };
}
