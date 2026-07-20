import type { NewSavedItem, SavedItem, SavedItemsPort } from "./types.js";

/** Selections can span pages; keep stored items bounded. */
const MAX_TEXT_CHARS = 5000;

export async function saveItem(
  input: NewSavedItem,
  port: SavedItemsPort,
): Promise<SavedItem> {
  const text = input.text.trim();
  if (!text) throw new Error("saved item text must not be empty");
  if (!Number.isInteger(input.page) || input.page < 1) {
    throw new Error("page must be a positive integer");
  }
  if (input.kind !== "highlight" && input.kind !== "answer") {
    throw new Error(`unknown saved item kind: ${input.kind}`);
  }

  const clipped =
    text.length > MAX_TEXT_CHARS ? text.slice(0, MAX_TEXT_CHARS) + "…" : text;
  const question = input.question?.trim() || undefined;

  // Saving the same passage or answer twice is a no-op, not a duplicate.
  const existing = await port.listByBook(input.bookId);
  const duplicate = existing.find(
    (i) => i.kind === input.kind && i.page === input.page && i.text === clipped,
  );
  if (duplicate) return duplicate;

  return port.insert({
    bookId: input.bookId,
    kind: input.kind,
    page: input.page,
    text: clipped,
    question,
  });
}

export async function listSavedItems(
  bookId: string,
  port: SavedItemsPort,
): Promise<SavedItem[]> {
  return port.listByBook(bookId);
}

export async function removeSavedItem(
  id: string,
  port: SavedItemsPort,
): Promise<void> {
  await port.remove(id);
}
