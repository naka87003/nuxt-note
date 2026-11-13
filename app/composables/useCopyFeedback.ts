import type { MaybeRefOrGetter, Ref } from "vue";

export function useCopyFeedback(
  value: Readonly<Ref<string>>,
  copiedMessage: MaybeRefOrGetter<string> = "Copied to clipboard.",
) {
  const pending = ref(false);
  const state = ref<"idle" | "copied" | "failed">("idle");
  const feedbackByState = {
    idle: { icon: "i-lucide-copy", color: "neutral", message: "" },
    copied: {
      icon: "i-lucide-check",
      color: "success",
      message: "",
    },
    failed: {
      icon: "i-lucide-x",
      color: "error",
      message:
        "Unable to copy. Try again or select the code and copy it manually.",
    },
  } as const;
  const feedback = computed(() => ({
    ...feedbackByState[state.value],
    message:
      state.value === "copied"
        ? toValue(copiedMessage)
        : feedbackByState[state.value].message,
  }));
  let timer: ReturnType<typeof setTimeout>;
  let disposed = false;

  watch(value, () => {
    clearTimeout(timer);
    state.value = "idle";
  });
  onBeforeUnmount(() => {
    disposed = true;
    clearTimeout(timer);
  });

  async function copy() {
    if (pending.value) return;
    clearTimeout(timer);
    const source = value.value;
    state.value = "idle";
    pending.value = true;
    let copied = false;
    try {
      await navigator.clipboard.writeText(source);
      copied = true;
    } catch {
      // Clipboard permission failures and unsupported browsers allow a retry.
    } finally {
      pending.value = false;
    }
    if (disposed || source !== value.value) return;
    state.value = copied ? "copied" : "failed";
    timer = setTimeout(() => {
      state.value = "idle";
    }, 2000);
  }

  return { state, pending, feedback, copy };
}
