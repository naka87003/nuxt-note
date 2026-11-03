export interface NoteDraft {
  title: string;
  markdown: string;
  categoryId: string | null;
}
export interface SavedNote extends NoteDraft {
  id: string;
}
