import type { NoteDraft } from "#shared/types/note";

export function useChatNoteDraft(
  chatId: () => string,
  openDraft: (draft: NoteDraft) => Promise<void>,
) {
  const phase = ref<"closed" | "confirm" | "generating" | "failed">("closed");
  const failure = ref("");
  const busy = computed(() => phase.value === "generating");
  const open = computed({
    get: () => phase.value !== "closed",
    set: (value: boolean) => {
      if (!value && !busy.value) phase.value = "closed";
    },
  });
  let disposed = false;
  let controller: AbortController | undefined;
  let prepared: NoteDraft | undefined;

  function confirm() {
    if (busy.value) return;
    prepared = undefined;
    failure.value = "";
    phase.value = "confirm";
  }

  async function create() {
    if (disposed || (phase.value !== "confirm" && phase.value !== "failed"))
      return;
    const id = chatId();
    phase.value = "generating";
    failure.value = "";
    controller = new AbortController();
    try {
      prepared ??= await $fetch<NoteDraft>(`/api/chats/${id}/note-draft`, {
        method: "POST",
        signal: controller.signal,
        timeout: 130_000,
        retry: 0,
      });
      if (disposed || id !== chatId()) return;
      await openDraft(prepared);
      phase.value = "closed";
    } catch (error) {
      if (disposed || id !== chatId()) return;
      const code = (error as { statusCode?: number }).statusCode;
      failure.value =
        code === 413
          ? "This conversation is too long to organize into a note. Please use a shorter conversation."
          : code === 409
            ? "Wait for the current response to finish, then try again."
            : code === 503
              ? "AI is not configured. Please try again later."
              : "Could not create your note. Your conversation is still here. Please try again.";
      phase.value = "failed";
    }
  }

  onBeforeUnmount(() => {
    disposed = true;
    controller?.abort();
  });

  return { phase, busy, open, failure, confirm, create };
}
