export interface ReadingRoom {
  id: string;
  bookId: string;
  token: string;
  bookTitle: string;
  createdAt: string;
}

export interface RoomsPort {
  /** Open a room over a book, or return the one already open for it. */
  open(bookId: string, token: string, bookTitle: string): Promise<ReadingRoom>;
  getByBook(bookId: string): Promise<ReadingRoom | null>;
  getByToken(token: string): Promise<ReadingRoom | null>;
  close(bookId: string): Promise<void>;
}

/** One participant, as derived from the channel's presence state. */
export interface Participant {
  /** Stable per-connection id, so the same person in two tabs is two entries. */
  key: string;
  userId: string;
  name: string;
  page: number;
  /** True for the entry belonging to this client. */
  isSelf: boolean;
}

/** A highlight a peer just made, seen live. Never persisted on our side. */
export interface LiveHighlight {
  id: string;
  userId: string;
  name: string;
  page: number;
  text: string;
  at: number;
}
