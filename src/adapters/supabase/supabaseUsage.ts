import type { SupabaseClient } from "@supabase/supabase-js";
import type { UsageRecord } from "../../core/chat/types.js";

/**
 * Records what a call cost. `bookId` is attribution only — it may be null for a
 * cross-book question that matched nothing, and it's cleared rather than
 * cascaded if the book is later deleted, so the spend ledger stays complete.
 */
export async function writeUsageRecord(
  client: SupabaseClient,
  bookId: string | null,
  usage: UsageRecord,
): Promise<void> {
  const { error } = await client.from("usage_records").insert({
    book_id: bookId,
    tokens_in: usage.tokensIn,
    tokens_out: usage.tokensOut,
    model: usage.model,
    cost_usd: usage.costUSD,
  });
  if (error) throw new Error(`Failed to write usage record: ${error.message}`);
}
