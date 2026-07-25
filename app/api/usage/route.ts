import { NextResponse } from "next/server";
import { supabaseUser } from "@/adapters/supabase/userClient.js";
import { loadUsageRows } from "@/adapters/supabase/supabaseUsageRead.js";
import { summarizeUsage } from "@/core/usage/summarize.js";
import { readSpend } from "@/adapters/supabase/supabaseBudget.js";
import { limitsFromEnv } from "@/core/usage/budget.js";

export const runtime = "nodejs";

/** Aggregated AI usage & cost for the signed-in user, across their books. */
export async function GET() {
  const client = await supabaseUser();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Spend against the budget is reported alongside the history, so the
  // dashboard can show the ceiling before a reader runs into it.
  const [rows, spend] = await Promise.all([loadUsageRows(client), readSpend(client)]);
  const limits = limitsFromEnv(process.env);

  return NextResponse.json({
    ...summarizeUsage(rows),
    budget: {
      dayUsd: spend.dayUSD,
      monthUsd: spend.monthUSD,
      dailyLimitUsd: limits.dailyUSD,
      monthlyLimitUsd: limits.monthlyUSD,
    },
  });
}
