import type { NewNote, Note, NotesPort } from "./types.js";

/** Notes can be long, but keep them bounded. */
const MAX_TEXT_CHARS = 10000;

function normalizeText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("note text must not be empty");
  return trimmed.length > MAX_TEXT_CHARS ? trimmed.slice(0, MAX_TEXT_CHARS) + "…" : trimmed;
}

function normalizePage(page: number | null | undefined): number | null {
  if (page == null) return null;
  if (!Number.isInteger(page) || page < 1) {
    throw new Error("page must be a positive integer");
  }
  return page;
}

export async function createNote(input: NewNote, port: NotesPort): Promise<Note> {
  return port.insert({
    bookId: input.bookId,
    page: normalizePage(input.page),
    text: normalizeText(input.text),
  });
}

export async function updateNote(id: string, text: string, port: NotesPort): Promise<Note> {
  return port.update(id, normalizeText(text));
}

export async function listNotes(bookId: string, port: NotesPort): Promise<Note[]> {
  return port.listByBook(bookId);
}

export async function removeNote(id: string, port: NotesPort): Promise<void> {
  await port.remove(id);
}
