import { NextResponse } from "next/server";
import { supabaseUser } from "@/adapters/supabase/userClient.js";
import { supabaseShares } from "@/adapters/supabase/supabaseShares.js";
import { newShareToken } from "@/core/sharing/token.js";

export const runtime = "nodejs";

async function requireUser() {
  const client = await supabaseUser();
  const {
    data: { user },
  } = await client.auth.getUser();
  return { client, user };
}

/** Current share status for a book. */
export async function GET(req: Request) {
  const bookId = new URL(req.url).searchParams.get("bookId");
  if (!bookId) return NextResponse.json({ error: "missing bookId" }, { status: 400 });

  const { client, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const share = await supabaseShares(client).getByBook(bookId);
    return NextResponse.json({ shared: !!share, token: share?.token ?? null });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** Start sharing a book — idempotent, returns the existing token if already shared. */
export async function POST(req: Request) {
  const { client, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const bookId = (body ?? {}).bookId as string | undefined;
  if (!bookId) return NextResponse.json({ error: "missing bookId" }, { status: 400 });

  try {
    const shares = supabaseShares(client);
    // RLS scopes this to the caller; confirms the book exists and is theirs.
    const { data: book } = await client.from("books").select("id").eq("id", bookId).maybeSingle();
    if (!book) return NextResponse.json({ error: "book not found" }, { status: 404 });

    const existing = await shares.getByBook(bookId);
    const share = existing ?? (await shares.create(bookId, newShareToken()));
    return NextResponse.json({ shared: true, token: share.token }, { status: existing ? 200 : 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** Stop sharing a book. */
export async function DELETE(req: Request) {
  const bookId = new URL(req.url).searchParams.get("bookId");
  if (!bookId) return NextResponse.json({ error: "missing bookId" }, { status: 400 });

  const { client, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    await supabaseShares(client).removeByBook(bookId);
    return NextResponse.json({ shared: false });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
