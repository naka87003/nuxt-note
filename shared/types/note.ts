export interface NoteDraft {
  title: string;
  markdown: string;
  categoryId: string | null;
}
export interface SavedNote extends NoteDraft {
  id: string;
}

export interface NoteDraftTransfer {
  draft: NoteDraft;
  returnTo: { path: string; query: { category: string } };
}
