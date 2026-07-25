import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { supabaseServer } from "@/adapters/supabase/serverClient.js";
import { supabaseShares } from "@/adapters/supabase/supabaseShares.js";
import { buildSharedBook } from "@/core/sharing/buildSharedBook.js";
import type { SharedBook } from "@/core/sharing/buildSharedBook.js";
import { isValidTokenFormat } from "@/core/sharing/token.js";
import SharedBookView from "./SharedBookView";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SavedRow {
  kind: string;
  page: number;
  text: string;
  question: string | null;
  created_at: string;
}
interface NoteRow {
  page: number | null;
  text: string;
  updated_at: string;
}
interface CardRow {
  front: string;
  back: string;
}

/**
 * Loads a shared book by its public token. Uses the service-role client (RLS is
 * bypassed) but reads *only* the rows for the one book the token points at, and
 * never the book's file or text — just the reader's own kept annotations.
 */
async function loadShared(token: string): Promise<SharedBook | null> {
  if (!isValidTokenFormat(token)) return null;

  let admin;
  try {
    admin = supabaseServer();
  } catch {
    // Service role not configured (e.g. CI) — treat as not found rather than 500.
    return null;
  }

  const share = await supabaseShares(admin).getByToken(token);
  if (!share) return null;

  const [book, saved, notes, cards] = await Promise.all([
    admin.from("books").select("title").eq("id", share.bookId).maybeSingle(),
    admin.from("saved_items").select("kind, page, text, question, created_at").eq("book_id", share.bookId),
    admin.from("notes").select("page, text, updated_at").eq("book_id", share.bookId),
    admin.from("flashcards").select("front, back").eq("book_id", share.bookId),
  ]);
  if (!book.data) return null;

  const savedRows = (saved.data ?? []) as SavedRow[];
  const noteRows = (notes.data ?? []) as NoteRow[];
  const cardRows = (cards.data ?? []) as CardRow[];

  return buildSharedBook({
    bookTitle: (book.data as { title: string }).title,
    sharedAt: share.createdAt,
    highlights: savedRows
      .filter((r) => r.kind === "highlight")
      .map((r) => ({ page: r.page, text: r.text, createdAt: r.created_at })),
    answers: savedRows
      .filter((r) => r.kind === "answer")
      .map((r) => ({ page: r.page, question: r.question ?? undefined, text: r.text, createdAt: r.created_at })),
    notes: noteRows.map((n) => ({ page: n.page, text: n.text, updatedAt: n.updated_at })),
    flashcards: cardRows.map((c) => ({ front: c.front, back: c.back })),
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const shared = await loadShared(token);
  if (!shared) return { title: "Shared notes · PDF Companion" };
  return {
    title: `${shared.bookTitle} — shared notes · PDF Companion`,
    description: `Highlights, answers, notes, and flashcards kept while reading ${shared.bookTitle}.`,
  };
}

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const shared = await loadShared(token);
  if (!shared) notFound();

  return <SharedBookView shared={shared} />;
}
