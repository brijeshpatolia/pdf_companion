import { NextResponse } from "next/server";
import { supabaseUser } from "@/adapters/supabase/userClient.js";

export const runtime = "nodejs";

/**
 * Returns the text of a single page for the text-based (EPUB) reader. Reads
 * the ingested chunk for that page — for EPUBs each synthetic page maps to
 * exactly one chunk. RLS scopes this to books the caller owns.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const bookId = searchParams.get("bookId");
  const page = Number(searchParams.get("page"));
  if (!bookId || !Number.isInteger(page) || page < 1) {
    return NextResponse.json({ error: "missing bookId or page" }, { status: 400 });
  }

  const client = await supabaseUser();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await client
    .from("chunks")
    .select("text")
    .eq("book_id", bookId)
    .eq("page", page)
    .order("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const text = (data ?? []).map((r) => r.text as string).join("\n\n");
  return NextResponse.json({ page, text });
}
