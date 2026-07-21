export interface Note {
  id: string;
  bookId: string;
  /** The page the note was written on, if any. */
  page: number | null;
  text: string;
  createdAt: string;
  updatedAt: string;
}

export interface NewNote {
  bookId: string;
  page?: number | null;
  text: string;
}

export interface NotesPort {
  insert(note: { bookId: string; page: number | null; text: string }): Promise<Note>;
  listByBook(bookId: string): Promise<Note[]>;
  update(id: string, text: string): Promise<Note>;
  remove(id: string): Promise<void>;
}
