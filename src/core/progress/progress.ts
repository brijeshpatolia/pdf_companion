import type { ReadingProgress, ReadingProgressPort } from "./types.js";

export async function getProgress(
  bookId: string,
  port: ReadingProgressPort,
): Promise<ReadingProgress> {
  const existing = await port.load(bookId);
  return existing ?? { bookId, currentPage: 1, furthestReadPage: 1 };
}

export async function updateReadingProgress(
  bookId: string,
  page: number,
  port: ReadingProgressPort,
): Promise<void> {
  const prev = await getProgress(bookId, port);
  const isContiguous = page === prev.currentPage + 1 || prev.currentPage === 0;
  const furthestReadPage =
    isContiguous && page > prev.furthestReadPage
      ? page
      : prev.furthestReadPage;

  await port.save(bookId, {
    bookId,
    currentPage: page,
    furthestReadPage,
  });
}

export async function markPagesRead(
  bookId: string,
  upToPage: number,
  port: ReadingProgressPort,
): Promise<void> {
  const prev = await getProgress(bookId, port);
  await port.save(bookId, {
    bookId,
    currentPage: prev.currentPage,
    furthestReadPage: Math.max(prev.furthestReadPage, upToPage),
  });
}
