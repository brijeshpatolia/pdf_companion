import { NextResponse } from "next/server";
import { supabaseUser } from "@/adapters/supabase/userClient.js";
import { supabaseNotes } from "@/adapters/supabase/supabaseNotes.js";
import { createNote, listNotes, updateNote, removeNote } from "@/core/notes/notes.js";

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

  const notes = await listNotes(bookId, supabaseNotes(client));
  return NextResponse.json(notes);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const { bookId, page, text } = (body ?? {}) as { bookId?: string; page?: number | null; text?: string };
  if (!bookId || !text) {
    return NextResponse.json({ error: "missing bookId or text" }, { status: 400 });
  }

  const { client, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const note = await createNote({ bookId, page: page ?? null, text }, supabaseNotes(client));
    return NextResponse.json(note, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null);
  const { id, text } = (body ?? {}) as { id?: string; text?: string };
  if (!id || !text) {
    return NextResponse.json({ error: "missing id or text" }, { status: 400 });
  }

  const { client, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const note = await updateNote(id, text, supabaseNotes(client));
    return NextResponse.json(note);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const { client, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await removeNote(id, supabaseNotes(client));
  return NextResponse.json({ ok: true });
}
