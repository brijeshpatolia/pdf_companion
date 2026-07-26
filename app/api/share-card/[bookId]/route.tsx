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

  const [{ data: saved }, { data: notes }, progress] = await Promise.all([
    client.from("saved_items").select("id, kind, text, page").eq("book_id", bookId),
    client.from("notes").select("id, text, page").eq("book_id", bookId),
    getProgress(bookId, supabaseProgress(client)),
  ]);

  const highlights = (
    (saved ?? []) as { id: string; kind: string; text: string; page: number }[]
  ).filter((s) => s.kind === "highlight");
  const noteRows = (notes ?? []) as { id: string; text: string; page: number | null }[];

  // The reader picks one in the UI. `item` names it exactly, which matters
  // once there are several on the same page; `page` is the softer hint used
  // when the panel opens on whatever they're reading.
  const query = new URL(req.url).searchParams;
  const wantedId = query.get("item");
  const wantedPage = Number(query.get("page"));

  const asQuote = (
    row: { text: string; page: number | null },
    source: "highlight" | "note",
  ) => ({ text: row.text, page: row.page ?? 0, source });

  const picked =
    (wantedId
      ? (highlights.find((h) => h.id === wantedId) &&
          asQuote(highlights.find((h) => h.id === wantedId)!, "highlight")) ||
        (noteRows.find((n) => n.id === wantedId) &&
          asQuote(noteRows.find((n) => n.id === wantedId)!, "note"))
      : null) ?? null;

  // Nothing named, so choose: the highlight where they're reading, else the
  // longest one — the most quotable thing available.
  const chosen =
    picked ??
    (highlights.find((h) => h.page === wantedPage)
      ? asQuote(highlights.find((h) => h.page === wantedPage)!, "highlight")
      : null) ??
    (highlights.length
      ? asQuote(highlights.slice().sort((a, b) => b.text.length - a.text.length)[0]!, "highlight")
      : null);

  const card = buildReadingCard(
    {
      title: book.title as string,
      currentPage: progress.furthestReadPage,
      pageCount: book.page_count as number,
      highlightCount: highlights.length,
      noteCount: noteRows.length,
    },
    chosen,
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
