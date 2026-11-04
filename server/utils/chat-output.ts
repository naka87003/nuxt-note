interface ChatOutputOptions {
  controller: AbortController;
  save: (content: string) => Promise<boolean>;
  publish: (text: string) => Promise<unknown>;
}

// One writer owns the saved/published offsets. AI reads can continue while it
// saves, but clients only receive text from a successfully saved snapshot.
export function createChatOutput({
  controller,
  save,
  publish,
}: ChatOutputOptions) {
  let content = "";
  let published = 0;
  let pending: Promise<void> | undefined;
  let failed = false;
  // A fixed cadence handles both continuous output and pauses. Idle ticks do
  // no database work, and at most one write can be in flight.
  const timer = setInterval(startCheckpoint, 100);

  function startCheckpoint() {
    if (pending || controller.signal.aborted || content.length === published)
      return;
    pending = (async () => {
      const snapshot = content;
      if (!(await save(snapshot))) {
        controller.abort();
        return;
      }
      await publish(snapshot.slice(published));
      published = snapshot.length;
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
    append(text: string) {
      content += text;
      // Do not wait for the first timer tick to display the first text.
      if (published === 0) startCheckpoint();
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
