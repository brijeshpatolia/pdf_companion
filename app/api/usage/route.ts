import { NextResponse } from "next/server";
import { supabaseUser } from "@/adapters/supabase/userClient.js";
import { loadUsageRows } from "@/adapters/supabase/supabaseUsageRead.js";
import { summarizeUsage } from "@/core/usage/summarize.js";

export const runtime = "nodejs";

/** Aggregated AI usage & cost for the signed-in user, across their books. */
export async function GET() {
  const client = await supabaseUser();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rows = await loadUsageRows(client);
  return NextResponse.json(summarizeUsage(rows));
}
