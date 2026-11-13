import type { NoteDraft } from "#shared/types/note";

export function useChatNoteDraft(
  chatId: () => string,
  openDraft: (draft: NoteDraft) => Promise<void>,
) {
  const phase = ref<"closed" | "confirm" | "generating" | "failed">("closed");
  const failure = ref("");
  const prepared = shallowRef<NoteDraft>();
  const failureTitle = computed(() =>
    prepared.value
      ? "Could not open your draft"
      : "Could not generate your draft",
  );
  const busy = computed(() => phase.value === "generating");
  const open = computed({
    get: () => phase.value !== "closed",
    set: (value: boolean) => {
      if (!value && !busy.value) phase.value = "closed";
    },
  });
  let disposed = false;
  let controller: AbortController | undefined;

  function confirm() {
    if (busy.value) return;
    prepared.value = undefined;
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
      prepared.value ??= await $fetch<NoteDraft>(
        `/api/chats/${id}/note-draft`,
        {
          method: "POST",
          signal: controller.signal,
          timeout: 130_000,
          retry: 0,
        },
      );
      if (disposed || id !== chatId()) return;
      await openDraft(prepared.value);
      phase.value = "closed";
    } catch (error) {
      if (disposed || id !== chatId()) return;
      const code = (error as { statusCode?: number }).statusCode;
      failure.value = prepared.value
        ? "Could not open your draft. Please try again."
        : code === 413
          ? "This conversation is too long to organize into a draft. Please use a shorter conversation."
          : code === 409
            ? "Wait for the current response to finish, then try again."
            : code === 503
              ? "Draft generation is currently unavailable. Please try again later."
              : "Could not generate your draft. Your conversation is still here. Please try again.";
      phase.value = "failed";
    }
  }

  onBeforeUnmount(() => {
    disposed = true;
    controller?.abort();
  });

  return { phase, busy, open, failure, failureTitle, confirm, create };
}
