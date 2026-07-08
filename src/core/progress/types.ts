export interface ReadingProgress {
  bookId: string;
  currentPage: number;
  furthestReadPage: number;
}

export interface ReadingProgressPort {
  load(bookId: string): Promise<ReadingProgress | null>;
  save(bookId: string, progress: ReadingProgress): Promise<void>;
}
