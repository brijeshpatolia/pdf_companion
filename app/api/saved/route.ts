import { NextResponse } from "next/server";
import { supabaseServer } from "@/adapters/supabase/serverClient.js";
import { supabaseSavedItems } from "@/adapters/supabase/supabaseSavedItems.js";
import { saveItem, listSavedItems, removeSavedItem } from "@/core/saved/saved.js";
import type { SavedItemKind } from "@/core/saved/types.js";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const bookId = searchParams.get("bookId");
  if (!bookId) return NextResponse.json({ error: "missing bookId" }, { status: 400 });

  const port = supabaseSavedItems(supabaseServer());
  const items = await listSavedItems(bookId, port);
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const { bookId, kind, page, text, question } = (body ?? {}) as {
    bookId?: string;
    kind?: SavedItemKind;
    page?: number;
    text?: string;
    question?: string;
  };
  if (!bookId || !kind || typeof page !== "number" || !text) {
    return NextResponse.json(
      { error: "missing bookId, kind, page, or text" },
      { status: 400 },
    );
  }

  const port = supabaseSavedItems(supabaseServer());
  try {
    const saved = await saveItem({ bookId, kind, page, text, question }, port);
    return NextResponse.json(saved, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const port = supabaseSavedItems(supabaseServer());
  await removeSavedItem(id, port);
  return NextResponse.json({ ok: true });
}
