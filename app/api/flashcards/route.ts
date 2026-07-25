import { NextResponse } from "next/server";
import { supabaseUser } from "@/adapters/supabase/userClient.js";
import { supabaseFlashcards } from "@/adapters/supabase/supabaseFlashcards.js";
import { normalizeCard } from "@/core/flashcards/generate.js";

export const runtime = "nodejs";

async function requireUser() {
  const client = await supabaseUser();
  const {
    data: { user },
  } = await client.auth.getUser();
  return { client, user };
}

export async function GET(req: Request) {
  const bookId = new URL(req.url).searchParams.get("bookId");
  if (!bookId) return NextResponse.json({ error: "missing bookId" }, { status: 400 });

  const { client, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const cards = await supabaseFlashcards(client).listByBook(bookId);
    return NextResponse.json(cards);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** Manually add one card. */
export async function POST(req: Request) {
  const { client, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const { bookId, front, back } = (body ?? {}) as { bookId?: string; front?: string; back?: string };
  if (!bookId) return NextResponse.json({ error: "missing bookId" }, { status: 400 });

  const card = normalizeCard({ front, back });
  if (!card) return NextResponse.json({ error: "front and back are required" }, { status: 400 });

  try {
    const [saved] = await supabaseFlashcards(client).insertMany(bookId, [card]);
    return NextResponse.json(saved, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const { client, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    await supabaseFlashcards(client).remove(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
