export interface Share {
  id: string;
  token: string;
  bookId: string;
  createdAt: string;
}

export interface SharesPort {
  /** The book's current share, or null if it isn't shared. */
  getByBook(bookId: string): Promise<Share | null>;
  /** Start sharing a book under the given token. */
  create(bookId: string, token: string): Promise<Share>;
  /** Stop sharing a book (removes its share row). */
  removeByBook(bookId: string): Promise<void>;
  /** Look up a share by its public token — powers the read-only public page. */
  getByToken(token: string): Promise<Share | null>;
}
