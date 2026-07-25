import { describe, it, expect } from "vitest";
import { readSpend } from "./supabaseBudget.js";
import { DAY_MS } from "../../core/usage/budget.js";
import type { SupabaseClient } from "@supabase/supabase-js";

interface Row {
  cost_usd: number | string;
  created_at: string;
}

/** Captures the `gte` cutoff so we can assert the query window, too. */
function fakeClient(rows: Row[], error?: string) {
  const calls: { cutoff?: string } = {};
  const query = {
    select: () => query,
    gte: async (_col: string, value: string) => {
      calls.cutoff = value;
      return { data: rows, error: error ? { message: error } : null };
    },
  };
  return {
    client: { from: () => query } as unknown as SupabaseClient,
    calls,
  };
}

const NOW = Date.parse("2026-07-25T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe("readSpend", () => {
  it("splits spend into the 24-hour and 30-day windows", async () => {
    const { client } = fakeClient([
      { cost_usd: 0.1, created_at: ago(1 * 60 * 60 * 1000) }, // 1h — both
      { cost_usd: 0.2, created_at: ago(20 * 60 * 60 * 1000) }, // 20h — both
      { cost_usd: 0.5, created_at: ago(5 * DAY_MS) }, // 5d — month only
    ]);

    expect(await readSpend(client, NOW)).toEqual({
      dayUSD: 0.30000000000000004, // float addition; the caller compares against dollars
      monthUSD: 0.8,
    });
  });

  it("counts a row exactly 24 hours old toward the day", async () => {
    const { client } = fakeClient([{ cost_usd: 1, created_at: ago(DAY_MS) }]);
    expect((await readSpend(client, NOW)).dayUSD).toBe(1);
  });

  it("excludes a row just older than the day window", async () => {
    const { client } = fakeClient([{ cost_usd: 1, created_at: ago(DAY_MS + 1000) }]);
    const spend = await readSpend(client, NOW);
    expect(spend.dayUSD).toBe(0);
    expect(spend.monthUSD).toBe(1);
  });

  it("queries only back to the start of the month window", async () => {
    const { client, calls } = fakeClient([]);
    await readSpend(client, NOW);
    expect(calls.cutoff).toBe(new Date(NOW - 30 * DAY_MS).toISOString());
  });

  it("parses numeric costs that arrive as strings", async () => {
    // Postgres numeric() comes back as a string through PostgREST.
    const { client } = fakeClient([{ cost_usd: "0.004821", created_at: ago(1000) }]);
    expect((await readSpend(client, NOW)).dayUSD).toBeCloseTo(0.004821);
  });

  it("ignores an unparseable cost rather than counting it as zero-or-NaN", async () => {
    const { client } = fakeClient([
      { cost_usd: "not a number", created_at: ago(1000) },
      { cost_usd: 0.5, created_at: ago(1000) },
    ]);
    expect((await readSpend(client, NOW)).dayUSD).toBe(0.5);
  });

  it("reports no spend for a reader with no usage", async () => {
    const { client } = fakeClient([]);
    expect(await readSpend(client, NOW)).toEqual({ dayUSD: 0, monthUSD: 0 });
  });

  it("surfaces a read failure instead of reporting zero spend", async () => {
    // Reporting zero would silently hand out an unlimited budget.
    const { client } = fakeClient([], "connection reset");
    await expect(readSpend(client, NOW)).rejects.toThrow(/connection reset/);
  });
});
