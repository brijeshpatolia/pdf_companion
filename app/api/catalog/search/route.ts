import { NextResponse } from "next/server";
import { supabaseUser } from "@/adapters/supabase/userClient.js";
import { gutendexSearchUrl, mapGutendexBooks } from "@/core/catalog/gutendex.js";

export const runtime = "nodejs";

/** Live search over the full Project Gutenberg catalog via Gutendex. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  if (!q) return NextResponse.json({ results: [], hasMore: false });

  const client = await supabaseUser();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const res = await fetch(gutendexSearchUrl(q, page), { redirect: "follow" });
    if (!res.ok) throw new Error(`Gutendex responded ${res.status}`);
    const json = await res.json();
    return NextResponse.json(mapGutendexBooks(json));
  } catch (e) {
    return NextResponse.json(
      { error: `Search is unavailable right now: ${(e as Error).message}` },
      { status: 502 },
    );
  }
}
