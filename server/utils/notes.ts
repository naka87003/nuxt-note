import type { NoteContentInput } from "./input-schemas";

export function normalizeNoteTitle(title: string) {
  return title.trim() || "Untitled note";
}

export function normalizeNoteContent({ title, markdown }: NoteContentInput) {
  return { title: normalizeNoteTitle(title), markdown };
}
