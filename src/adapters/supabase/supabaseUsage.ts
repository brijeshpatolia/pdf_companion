import type { SupabaseClient } from "@supabase/supabase-js";
import type { UsageRecord } from "../../core/chat/types.js";

export async function writeUsageRecord(
  client: SupabaseClient,
  bookId: string,
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
