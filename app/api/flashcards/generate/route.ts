import { NextResponse } from "next/server";
import { supabaseUser } from "@/adapters/supabase/userClient.js";
import { supabaseSavedItems } from "@/adapters/supabase/supabaseSavedItems.js";
import { supabaseNotes } from "@/adapters/supabase/supabaseNotes.js";
import { supabaseFlashcards } from "@/adapters/supabase/supabaseFlashcards.js";
import { writeUsageRecord } from "@/adapters/supabase/supabaseUsage.js";
import { createOpenRouterGateway } from "@/adapters/openrouter/gateway.js";
import { createAnthropicGateway } from "@/adapters/anthropic/gateway.js";
import { buildFlashcardMessages, parseFlashcards, hasKeptContent } from "@/core/flashcards/generate.js";
import type { KeptContent } from "@/core/flashcards/generate.js";
import type { GatewayPort } from "@/core/chat/types.js";

export const runtime = "nodejs";
export const maxDuration = 60;

const OPENROUTER_MODEL = "anthropic/claude-sonnet-4-6";
const ANTHROPIC_MODEL = "claude-sonnet-4-6";

function resolveGateway(): { gateway: GatewayPort; model: string } {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) return { gateway: createAnthropicGateway(anthropicKey), model: ANTHROPIC_MODEL };
  return { gateway: createOpenRouterGateway(process.env.OPENROUTER_API_KEY), model: OPENROUTER_MODEL };
}

/** Generate flashcards from a book's saved highlights, answers, and notes. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const bookId = (body ?? {}).bookId as string | undefined;
  if (!bookId) return NextResponse.json({ error: "missing bookId" }, { status: 400 });

  const client = await supabaseUser();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: book } = await client.from("books").select("title").eq("id", bookId).single();
  if (!book) return NextResponse.json({ error: "book not found" }, { status: 404 });

  const [savedItems, notes] = await Promise.all([
    supabaseSavedItems(client).listByBook(bookId),
    supabaseNotes(client).listByBook(bookId),
  ]);

  const kept: KeptContent = {
    bookTitle: book.title as string,
    highlights: savedItems.filter((i) => i.kind === "highlight").map((i) => i.text),
    answers: savedItems
      .filter((i) => i.kind === "answer")
      .map((i) => ({ question: i.question, text: i.text })),
    notes: notes.map((n) => n.text),
  };

  if (!hasKeptContent(kept)) {
    return NextResponse.json(
      { error: "Save some highlights, answers, or notes first — flashcards are built from what you keep." },
      { status: 422 },
    );
  }

  const { gateway, model } = resolveGateway();
  const messages = buildFlashcardMessages(kept);

  let text = "";
  let usage: { tokensIn: number; tokensOut: number; costUSD: number } | null = null;
  try {
    for await (const event of gateway.complete(messages, model)) {
      if (event.type === "chunk") text += event.text;
      else if (event.type === "usage") usage = event;
    }
  } catch (e) {
    const code = (e as { code?: string }).code;
    const status = code === "missing-key" ? 400 : 502;
    return NextResponse.json({ error: (e as Error).message, code }, { status });
  }

  // Record spend as soon as tokens are consumed — independent of whether the
  // output parses into cards or the insert succeeds, so real cost is never lost.
  if (usage) {
    await writeUsageRecord(client, bookId, { ...usage, model }).catch(() => {});
  }

  const cards = parseFlashcards(text);
  if (cards.length === 0) {
    return NextResponse.json({ error: "The model didn't return any usable flashcards. Try again." }, { status: 502 });
  }

  const inserted = await supabaseFlashcards(client).insertMany(bookId, cards);

  return NextResponse.json({ cards: inserted, count: inserted.length }, { status: 201 });
}
