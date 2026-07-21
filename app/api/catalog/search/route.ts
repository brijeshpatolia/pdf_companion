import { NextResponse } from "next/server";
import { supabaseUser } from "@/adapters/supabase/userClient.js";
import { gutendexSearchUrl, mapGutendexBooks } from "@/core/catalog/gutendex.js";
import { archiveSearchUrl, mapArchiveSearch } from "@/core/catalog/archive.js";

export const runtime = "nodejs";

/**
 * Live search over a public-domain book source. `source=gutenberg` (default)
 * uses Gutendex; `source=archive` uses the Internet Archive, scoped by the
 * archive module's public-domain filter.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const source = searchParams.get("source") === "archive" ? "archive" : "gutenberg";

  if (!q) return NextResponse.json({ results: [], hasMore: false });

  const client = await supabaseUser();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = source === "archive" ? archiveSearchUrl(q, page) : gutendexSearchUrl(q, page);

  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) throw new Error(`upstream responded ${res.status}`);
    const json = await res.json();
    const page = source === "archive" ? mapArchiveSearch(json) : mapGutendexBooks(json);
    return NextResponse.json(page);
  } catch (e) {
    return NextResponse.json(
      { error: `Search is unavailable right now: ${(e as Error).message}` },
      { status: 502 },
    );
  }
}
