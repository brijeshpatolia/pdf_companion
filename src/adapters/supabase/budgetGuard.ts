import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluateBudget, limitsFromEnv, type BudgetExceeded } from "../../core/usage/budget.js";
import { readSpend } from "./supabaseBudget.js";

/**
 * The single gate every paid AI call goes through. Returns the refusal when the
 * caller is out of budget, or `null` when the call may proceed.
 *
 * Failing open on a read error is deliberate: a transient Supabase hiccup
 * should not take the whole app down. The ceiling is a guard against sustained
 * spend, and sustained spend needs the reads to keep failing to slip past it.
 */
export async function checkBudget(client: SupabaseClient): Promise<BudgetExceeded | null> {
  const limits = limitsFromEnv(process.env);
  if (limits.dailyUSD <= 0 && limits.monthlyUSD <= 0) return null;

  let spend;
  try {
    spend = await readSpend(client);
  } catch {
    return null;
  }

  const decision = evaluateBudget(spend, limits);
  return decision.allowed ? null : decision;
}

/** HTTP shape for a refusal: 429, with the reason the client can display. */
export function budgetResponse(exceeded: BudgetExceeded): Response {
  return new Response(
    JSON.stringify({ error: exceeded.message, code: "budget-exceeded", window: exceeded.window }),
    { status: 429, headers: { "Content-Type": "application/json" } },
  );
}
