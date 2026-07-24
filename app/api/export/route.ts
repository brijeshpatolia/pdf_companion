import { NextResponse } from "next/server";
import { supabaseUser } from "@/adapters/supabase/userClient.js";
import { supabaseSavedItems } from "@/adapters/supabase/supabaseSavedItems.js";
import { supabaseNotes } from "@/adapters/supabase/supabaseNotes.js";
import { buildExportMarkdown, exportFilename } from "@/core/export/buildMarkdown.js";

export const runtime = "nodejs";

/** Download a book's highlights, saved answers, and notes as a Markdown file. */
export async function GET(req: Request) {
  const bookId = new URL(req.url).searchParams.get("bookId");
  if (!bookId) return NextResponse.json({ error: "missing bookId" }, { status: 400 });

  const client = await supabaseUser();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // RLS scopes each of these to the caller.
  const { data: book } = await client.from("books").select("title").eq("id", bookId).single();
  if (!book) return NextResponse.json({ error: "book not found" }, { status: 404 });

  const [savedItems, notes] = await Promise.all([
    supabaseSavedItems(client).listByBook(bookId),
    supabaseNotes(client).listByBook(bookId),
  ]);

  const markdown = buildExportMarkdown({
    bookTitle: book.title as string,
    highlights: savedItems
      .filter((i) => i.kind === "highlight")
      .map((i) => ({ page: i.page, text: i.text, createdAt: i.createdAt })),
    answers: savedItems
      .filter((i) => i.kind === "answer")
      .map((i) => ({ page: i.page, question: i.question, text: i.text, createdAt: i.createdAt })),
    notes: notes.map((n) => ({ page: n.page, text: n.text, updatedAt: n.updatedAt })),
  });

  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFilename(book.title as string)}"`,
    },
  });
}
