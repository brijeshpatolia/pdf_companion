import type { Book, CreateBookDeps, CreateBookInput } from "./types.js";

export async function createBook(
  input: CreateBookInput,
  deps: CreateBookDeps,
): Promise<Book> {
  const meta = await deps.pdfMeta.read(input.fileBytes);
  const { ref } = await deps.storage.put({
    bytes: input.fileBytes,
    filename: input.filename,
  });

  return deps.books.insert({
    ownerId: null,
    title: meta.title ?? stripExtension(input.filename),
    pageCount: meta.pageCount,
    fileRef: ref,
    status: "uploaded",
  });
}

function stripExtension(filename: string): string {
  return filename.replace(/\.[^.]+$/, "");
}
