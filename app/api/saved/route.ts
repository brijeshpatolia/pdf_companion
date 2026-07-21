import { NextResponse } from "next/server";
import { supabaseUser } from "@/adapters/supabase/userClient.js";
import { supabaseSavedItems } from "@/adapters/supabase/supabaseSavedItems.js";
import { saveItem, listSavedItems, removeSavedItem } from "@/core/saved/saved.js";
import type { SavedItemKind } from "@/core/saved/types.js";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const bookId = searchParams.get("bookId");
  if (!bookId) return NextResponse.json({ error: "missing bookId" }, { status: 400 });

  const client = await supabaseUser();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const port = supabaseSavedItems(client);
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

  const client = await supabaseUser();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const port = supabaseSavedItems(client);
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

  const client = await supabaseUser();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const port = supabaseSavedItems(client);
  await removeSavedItem(id, port);
  return NextResponse.json({ ok: true });
}
