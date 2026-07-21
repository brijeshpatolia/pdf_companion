import type { SupabaseClient } from "@supabase/supabase-js";
import type { UsageRow } from "../../core/usage/summarize.js";

interface UsageRecordRow {
  book_id: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  model: string;
  created_at: string;
  books: { title: string | null } | { title: string | null }[] | null;
}

function bookTitle(books: UsageRecordRow["books"]): string | null {
  if (!books) return null;
  const first = Array.isArray(books) ? books[0] : books;
  return first?.title ?? null;
}

/**
 * Reads the caller's usage records (joined to book titles). RLS scopes rows
 * to books the user owns, so this is inherently per-user.
 */
export async function loadUsageRows(client: SupabaseClient): Promise<UsageRow[]> {
  const { data, error } = await client
    .from("usage_records")
    .select("book_id, tokens_in, tokens_out, cost_usd, model, created_at, books(title)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`usage.load failed: ${error.message}`);

  return (data as UsageRecordRow[]).map((r) => ({
    bookId: r.book_id,
    bookTitle: bookTitle(r.books),
    tokensIn: r.tokens_in,
    tokensOut: r.tokens_out,
    costUsd: r.cost_usd,
    model: r.model,
    createdAt: r.created_at,
  }));
}
