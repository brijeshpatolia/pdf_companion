import type { SupabaseClient } from "@supabase/supabase-js";
import { DAY_MS, MONTH_MS, type BudgetSpend } from "../../core/usage/budget.js";

/**
 * Sums the caller's recorded AI spend over the two budget windows. RLS scopes
 * `usage_records` to the owner, so this is inherently per-user.
 *
 * One query covers both windows: the 30-day rows are fetched and the 24-hour
 * subset is summed from them, rather than paying for two round trips.
 */
export async function readSpend(
  client: SupabaseClient,
  now: number = Date.now(),
): Promise<BudgetSpend> {
  const monthStart = new Date(now - MONTH_MS).toISOString();
  const dayStart = now - DAY_MS;

  const { data, error } = await client
    .from("usage_records")
    .select("cost_usd, created_at")
    .gte("created_at", monthStart);
  if (error) throw new Error(`Failed to read usage totals: ${error.message}`);

  let dayUSD = 0;
  let monthUSD = 0;
  for (const row of (data ?? []) as { cost_usd: number | string; created_at: string }[]) {
    // numeric() comes back as a string from PostgREST.
    const cost = Number(row.cost_usd);
    if (!Number.isFinite(cost)) continue;
    monthUSD += cost;
    if (Date.parse(row.created_at) >= dayStart) dayUSD += cost;
  }

  return { dayUSD, monthUSD };
}
