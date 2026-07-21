import { NextResponse } from "next/server";
import { supabaseUser } from "@/adapters/supabase/userClient.js";
import { supabaseProgress } from "@/adapters/supabase/supabaseProgress.js";
import { getProgress, updateReadingProgress, markPagesRead } from "@/core/progress/progress.js";

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

  const port = supabaseProgress(client);
  const progress = await getProgress(bookId, port);
  return NextResponse.json(progress);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { bookId, page, markRead } = body as {
    bookId: string;
    page: number;
    markRead?: boolean;
  };
  if (!bookId || typeof page !== "number") {
    return NextResponse.json({ error: "missing bookId or page" }, { status: 400 });
  }

  const client = await supabaseUser();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const port = supabaseProgress(client);

  if (markRead) {
    await markPagesRead(bookId, page, port);
  } else {
    await updateReadingProgress(bookId, page, port);
  }

  const progress = await getProgress(bookId, port);
  return NextResponse.json(progress);
}
