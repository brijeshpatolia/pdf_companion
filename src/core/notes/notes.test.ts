import { describe, it, expect } from "vitest";
import { createNote, updateNote, listNotes, removeNote } from "./notes.js";
import type { Note, NotesPort } from "./types.js";

function fakeNotesStore(): NotesPort {
  const items: Note[] = [];
  let nextId = 1;
  return {
    async insert(note) {
      const now = new Date().toISOString();
      const saved: Note = { ...note, id: `note-${nextId++}`, createdAt: now, updatedAt: now };
      items.push(saved);
      return saved;
    },
    async listByBook(bookId) {
      return items.filter((n) => n.bookId === bookId);
    },
    async update(id, text) {
      const note = items.find((n) => n.id === id);
      if (!note) throw new Error("not found");
      note.text = text;
      note.updatedAt = new Date().toISOString();
      return note;
    },
    async remove(id) {
      const idx = items.findIndex((n) => n.id === id);
      if (idx >= 0) items.splice(idx, 1);
    },
  };
}

describe("createNote", () => {
  it("creates a page-anchored note", async () => {
    const port = fakeNotesStore();
    const note = await createNote({ bookId: "b1", page: 12, text: "  Socrates on the soul  " }, port);
    expect(note.id).toBeTruthy();
    expect(note.page).toBe(12);
    expect(note.text).toBe("Socrates on the soul"); // trimmed
    expect(await listNotes("b1", port)).toHaveLength(1);
  });

  it("allows a book-level note with no page", async () => {
    const port = fakeNotesStore();
    const note = await createNote({ bookId: "b1", text: "general thought" }, port);
    expect(note.page).toBeNull();
  });

  it("rejects empty text", async () => {
    const port = fakeNotesStore();
    await expect(createNote({ bookId: "b1", page: 1, text: "   " }, port)).rejects.toThrow(/empty/);
  });

  it("rejects an invalid page", async () => {
    const port = fakeNotesStore();
    await expect(createNote({ bookId: "b1", page: 0, text: "x" }, port)).rejects.toThrow(/page/);
    await expect(createNote({ bookId: "b1", page: 2.5, text: "x" }, port)).rejects.toThrow(/page/);
  });

  it("clips very long notes", async () => {
    const port = fakeNotesStore();
    const note = await createNote({ bookId: "b1", text: "x".repeat(12000) }, port);
    expect(note.text.length).toBeLessThanOrEqual(10001);
    expect(note.text.endsWith("…")).toBe(true);
  });
});

describe("updateNote", () => {
  it("updates text and rejects empty edits", async () => {
    const port = fakeNotesStore();
    const note = await createNote({ bookId: "b1", page: 3, text: "first" }, port);
    const updated = await updateNote(note.id, "second", port);
    expect(updated.text).toBe("second");
    await expect(updateNote(note.id, "  ", port)).rejects.toThrow(/empty/);
  });
});

describe("removeNote", () => {
  it("removes a note", async () => {
    const port = fakeNotesStore();
    const note = await createNote({ bookId: "b1", page: 1, text: "gone soon" }, port);
    await removeNote(note.id, port);
    expect(await listNotes("b1", port)).toHaveLength(0);
  });
});
