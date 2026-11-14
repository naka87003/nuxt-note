import { INPUT_LIMITS } from "#shared/utils/input-limits";
import type { NoteDraft, SavedNote } from "#shared/types/note";

type NoteSaveResult = Pick<SavedNote, "id" | "updatedAt">;

interface NoteEditorOptions {
  note?: SavedNote;
  initialDraft?: NoteDraft;
  categoryId: string | null;
  onSaved: (note: SavedNote) => void;
}

export function useNoteEditor(options: NoteEditorOptions) {
  // Snapshot once: background refreshes must never replace a local draft.
  const supplied = options.note ?? options.initialDraft;
  const initial: NoteDraft = {
    title: supplied?.title ?? "",
    markdown: supplied?.markdown ?? "",
    categoryId: supplied ? supplied.categoryId : options.categoryId,
  };
  const noteId = options.note?.id;
  const version = options.note?.updatedAt;
  const conflicted = ref(false);
  const unavailable = ref(false);
  const confirmation = ref(false);
  const overwriteVersion = ref<string>();
  const title = ref(initial.title);
  const markdown = ref(initial.markdown);
  const category = ref(initial.categoryId ?? "uncategorized");
  const saving = ref(false);
  const saved = ref(false);
  const failure = ref("");

  const overLimit = computed(
    () =>
      title.value.length > INPUT_LIMITS.noteTitle ||
      markdown.value.length > INPUT_LIMITS.noteBody,
  );

  const dirty = computed(
    () =>
      !saved.value &&
      (!!options.initialDraft ||
        title.value !== initial.title ||
        markdown.value !== initial.markdown ||
        (category.value === "uncategorized" ? null : category.value) !==
          initial.categoryId),
  );

  const draft = computed<NoteDraft>(() => ({
    title: title.value,
    markdown: markdown.value,
    categoryId: category.value === "uncategorized" ? null : category.value,
  }));

  async function prepareOverwrite() {
    if (saving.value || !noteId || unavailable.value || saved.value) return;
    saving.value = true;
    overwriteVersion.value = undefined;
    try {
      const latest = await $fetch<SavedNote>(`/api/notes/${noteId}`, {
        retry: 0,
      });
      overwriteVersion.value = latest.updatedAt;
      failure.value = "";
      confirmation.value = true;
    } catch (error) {
      unavailable.value = (error as { statusCode?: number }).statusCode === 404;
      failure.value = unavailable.value
        ? "This note was deleted or is no longer available. Your changes are still here."
        : "Could not prepare overwrite. Your changes are still here. Save again to try.";
    } finally {
      saving.value = false;
    }
  }

  async function save(overwrite = false) {
    if (saving.value || saved.value || overLimit.value || unavailable.value)
      return;
    if (confirmation.value && !overwrite) return;
    if (conflicted.value && !overwrite) return prepareOverwrite();
    const expectedVersion = overwrite ? overwriteVersion.value : version;
    if (overwrite && (!confirmation.value || !expectedVersion)) return;
    saving.value = true;
    failure.value = "";
    const body = draft.value;
    let needsConfirmation = false;
    let result: NoteSaveResult | undefined;
    try {
      result = noteId
        ? await $fetch<NoteSaveResult>(`/api/notes/${noteId}`, {
            method: "PATCH",
            body: { ...body, updatedAt: expectedVersion },
            retry: 0,
          })
        : await $fetch<NoteSaveResult>("/api/notes", {
            method: "POST",
            body,
            retry: 0,
          });
    } catch (error) {
      const code = (error as { statusCode?: number }).statusCode;
      if (code === 409) {
        conflicted.value = true;
        confirmation.value = false;
        overwriteVersion.value = undefined;
        needsConfirmation = true;
        failure.value =
          "This note was updated elsewhere. Your changes are still here. Save again to confirm overwrite.";
      } else if (code === 404) {
        // A removed category can also cause 404, including while creating a new Note.
        confirmation.value = false;
        failure.value = noteId
          ? "This note or its category is no longer available. Your changes are still here. Choose another category or reopen the note."
          : "The selected category is no longer available. Your changes are still here. Choose another category and try again.";
      } else {
        failure.value =
          "Could not save your note. Your changes are still here. Please try again.";
      }
    } finally {
      saving.value = false;
    }
    if (result) {
      saved.value = true;
      confirmation.value = false;
      options.onSaved({
        ...body,
        title: body.title.trim() || "Untitled note",
        id: result.id,
        updatedAt: result.updatedAt,
      });
    } else if (needsConfirmation) await prepareOverwrite();
  }
  return {
    title,
    markdown,
    category,
    dirty,
    overLimit,
    saving,
    saved,
    failure,
    unavailable,
    confirmation,
    save,
  };
}
