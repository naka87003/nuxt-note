import type { Conversation } from "./useChatGeneration";
import { watch } from "vue";

// Shared category operations refresh Nuxt data globally. Keep those refreshes
// from replacing an optimistic question or an answer that is still streaming.
export function useChatRefresh(
  chat: Ref<Conversation | null | undefined>,
  activeId: Ref<string>,
  sending: Ref<boolean>,
  load: (id: string) => Promise<Conversation>,
) {
  let revision = 0;
  watch(sending, () => revision++, { flush: "sync" });
  return async (force = false) => {
    if (!activeId.value || (!force && sending.value)) return chat.value;
    const startedAt = revision;
    const snapshot = await load(activeId.value);
    if (force || (startedAt === revision && !sending.value))
      chat.value = snapshot;
    return chat.value;
  };
}
