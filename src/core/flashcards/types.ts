export interface Flashcard {
  id: string;
  bookId: string;
  front: string;
  back: string;
  createdAt: string;
}

export interface NewCard {
  front: string;
  back: string;
}

export interface FlashcardsPort {
  insertMany(bookId: string, cards: NewCard[]): Promise<Flashcard[]>;
  listByBook(bookId: string): Promise<Flashcard[]>;
  remove(id: string): Promise<void>;
}
