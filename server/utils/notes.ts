import type { NoteContentInput } from "./input-schemas";

export function normalizeNoteContent({ title, markdown }: NoteContentInput) {
  return { title: title.trim() || "Untitled note", markdown };
}
