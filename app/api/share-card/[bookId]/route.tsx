import { ImageResponse } from "next/og";
import { supabaseUser } from "@/adapters/supabase/userClient.js";
import { supabaseProgress } from "@/adapters/supabase/supabaseProgress.js";
import { getProgress } from "@/core/progress/progress.js";
import { buildReadingCard } from "@/core/sharing/readingCard.js";
import { ShareCardArt, CARD_W, CARD_H } from "@/core/sharing/ShareCardArt.js";
import { cardFonts } from "@/core/sharing/cardFont.js";

export const runtime = "nodejs";

/**
 * Renders a shareable card for one book — the reading equivalent of Strava's
 * route map. The quote is the hero because that's the part worth posting; the
 * stats support it.
 *
 * Only ever renders the caller's own book: the data comes through the user
 * client, so RLS refuses anyone else's.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ bookId: string }> },
) {
  const { bookId } = await params;
  const client = await supabaseUser();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const { data: book } = await client
    .from("books")
    .select("id, title, page_count")
    .eq("id", bookId)
    .maybeSingle();
  if (!book) return new Response("not found", { status: 404 });

  const [{ data: saved }, { count: noteCount }, progress] = await Promise.all([
    client.from("saved_items").select("kind, text, page").eq("book_id", bookId),
    client.from("notes").select("id", { count: "exact", head: true }).eq("book_id", bookId),
    getProgress(bookId, supabaseProgress(client)),
  ]);

  const highlights = ((saved ?? []) as { kind: string; text: string; page: number }[]).filter(
    (s) => s.kind === "highlight",
  );

  // A specific highlight can be requested (the reader picks one in the UI);
  // otherwise the longest is the most quotable thing we have.
  const wantedPage = Number(new URL(req.url).searchParams.get("page"));
  const chosen =
    highlights.find((h) => h.page === wantedPage) ??
    highlights.slice().sort((a, b) => b.text.length - a.text.length)[0] ??
    null;

  const card = buildReadingCard(
    {
      title: book.title as string,
      currentPage: progress.furthestReadPage,
      pageCount: book.page_count as number,
      highlightCount: highlights.length,
      noteCount: noteCount ?? 0,
    },
    chosen ? { text: chosen.text, page: chosen.page } : null,
  );

  const fonts = await cardFonts();
  return new ImageResponse(<ShareCardArt card={card} />, {
    width: CARD_W,
    height: CARD_H,
    // Empty when the fetch failed — Satori then uses its own font rather than
    // failing the request.
    ...(fonts.length ? { fonts } : {}),
    headers: { "Cache-Control": "no-store" },
  });
}
