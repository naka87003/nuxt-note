import type { NoteDraftTransfer } from "#shared/types/note";

export function useNoteDraftHandoff() {
  const router = useRouter();
  const pending = useState<NoteDraftTransfer | null>(
    "chat-note-transfer",
    () => null,
  );
  const returnTo = useState<NoteDraftTransfer["returnTo"] | null>(
    "note-draft-return",
    () => null,
  );

  function consume() {
    const transfer = pending.value;
    pending.value = null;
    return transfer;
  }

  async function open(transfer: NoteDraftTransfer) {
    pending.value = transfer;
    // Capture the reactive value, rather than comparing it with the raw object.
    const handoff = pending.value;
    try {
      const result = await navigateTo({
        path: "/notes/new",
        query: { category: transfer.draft.categoryId ?? "uncategorized" },
      });
      if (
        result === false ||
        result instanceof Error ||
        router.currentRoute.value.path !== "/notes/new"
      )
        throw new Error("Could not open the note draft");
    } catch (error) {
      // A rejected/aborted navigation must not seed a later ordinary New note.
      // Do not clear a newer handoff made while this navigation was pending.
      if (pending.value === handoff) pending.value = null;
      throw error;
    }
  }

  return { open, consume, returnTo };
}
