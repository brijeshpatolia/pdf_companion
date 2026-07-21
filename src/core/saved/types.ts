export type SavedItemKind = "highlight" | "answer";

export interface SavedItem {
  id: string;
  bookId: string;
  kind: SavedItemKind;
  page: number;
  text: string;
  /** The question that produced a saved answer. Absent for highlights. */
  question?: string;
  createdAt: string;
}

export interface NewSavedItem {
  bookId: string;
  kind: SavedItemKind;
  page: number;
  text: string;
  question?: string;
}

export interface SavedItemsPort {
  insert(item: NewSavedItem): Promise<SavedItem>;
  listByBook(bookId: string): Promise<SavedItem[]>;
  remove(id: string): Promise<void>;
}
