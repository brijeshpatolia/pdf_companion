import { NextResponse } from "next/server";
import { supabaseUser } from "@/adapters/supabase/userClient.js";
import { supabaseServer } from "@/adapters/supabase/serverClient.js";
import { supabaseRooms } from "@/adapters/supabase/supabaseRooms.js";
import { newShareToken, isValidTokenFormat } from "@/core/sharing/token.js";
import { findOwnCopy } from "@/core/rooms/matchBook.js";

export const runtime = "nodejs";

async function requireUser() {
  const client = await supabaseUser();
  const {
    data: { user },
  } = await client.auth.getUser();
  return { client, user };
}

/**
 * Two questions, depending on the parameter:
 *
 * - `?bookId=` — "is a room open on my book?" (host view)
 * - `?token=`  — "I followed a link; what book is this and do I have it?"
 *
 * The token path resolves the room with the service-role client, because the
 * joiner doesn't own the host's book row. It deliberately returns only the
 * title and the joiner's *own* matching copy — never the host's book id.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const bookId = searchParams.get("bookId");
  const token = searchParams.get("token");

  const { client, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    if (bookId) {
      const room = await supabaseRooms(client).getByBook(bookId);
      return NextResponse.json({ open: !!room, token: room?.token ?? null });
    }

    if (!isValidTokenFormat(token)) {
      return NextResponse.json({ error: "missing or malformed token" }, { status: 400 });
    }

    const room = await supabaseRooms(supabaseServer()).getByToken(token);
    if (!room) return NextResponse.json({ error: "room not found" }, { status: 404 });

    // The joiner reads their own copy — we never hand over the host's file.
    const { data: books } = await client.from("books").select("id, title, status");
    const own = findOwnCopy(
      ((books ?? []) as { id: string; title: string; status: string }[]).filter(
        (b) => b.status === "ready",
      ),
      room.bookTitle,
    );

    return NextResponse.json({
      token: room.token,
      bookTitle: room.bookTitle,
      ownBookId: own?.id ?? null,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** Open a room over a book — idempotent, returns the existing token if already open. */
export async function POST(req: Request) {
  const { client, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const bookId = (body ?? {}).bookId as string | undefined;
  if (!bookId) return NextResponse.json({ error: "missing bookId" }, { status: 400 });

  try {
    const rooms = supabaseRooms(client);
    // RLS scopes this to the caller; confirms the book exists and is theirs.
    const { data: book } = await client
      .from("books")
      .select("id, title")
      .eq("id", bookId)
      .maybeSingle();
    if (!book) return NextResponse.json({ error: "book not found" }, { status: 404 });

    const existing = await rooms.getByBook(bookId);
    const room = existing ?? (await rooms.open(bookId, newShareToken(), book.title as string));
    return NextResponse.json({ open: true, token: room.token }, { status: existing ? 200 : 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** Close the room. Participants' channels go quiet; nothing was stored to clean up. */
export async function DELETE(req: Request) {
  const bookId = new URL(req.url).searchParams.get("bookId");
  if (!bookId) return NextResponse.json({ error: "missing bookId" }, { status: 400 });

  const { client, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    await supabaseRooms(client).close(bookId);
    return NextResponse.json({ open: false });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
