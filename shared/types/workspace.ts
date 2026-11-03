export interface CategoriesResponse {
  items: {
    id: string;
    name: string;
    _count: { notes: number; chats: number };
  }[];
  totals: { notes: number; chats: number };
  uncategorized: { notes: number; chats: number };
}
export interface WorkspaceItem {
  id: string;
  title: string | null;
  preview: string;
  categoryId: string | null;
  updatedAt: string;
}
