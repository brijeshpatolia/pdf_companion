import { describe, it, expect } from "vitest";
import { evaluateBudget, limitsFromEnv, DAY_MS, MONTH_MS } from "./budget.js";

const limits = { dailyUSD: 1, monthlyUSD: 10 };

describe("evaluateBudget", () => {
  it("allows a call well under both limits", () => {
    const decision = evaluateBudget({ dayUSD: 0.2, monthUSD: 3 }, limits);
    expect(decision).toEqual({ allowed: true, remainingUSD: 0.8 });
  });

  it("reports headroom under the tighter limit", () => {
    // $0.05 left on the day, $2 left on the month — the day is what binds.
    const decision = evaluateBudget({ dayUSD: 0.95, monthUSD: 8 }, limits);
    expect(decision).toMatchObject({ allowed: true });
    expect((decision as { remainingUSD: number }).remainingUSD).toBeCloseTo(0.05);
  });

  it("blocks once the daily limit is reached", () => {
    const decision = evaluateBudget({ dayUSD: 1, monthUSD: 2 }, limits);
    expect(decision).toMatchObject({ allowed: false, window: "day", limitUSD: 1, spentUSD: 1 });
  });

  it("blocks on the monthly limit even when the day is quiet", () => {
    const decision = evaluateBudget({ dayUSD: 0, monthUSD: 10.5 }, limits);
    expect(decision).toMatchObject({ allowed: false, window: "month", limitUSD: 10 });
  });

  it("explains what ran out and that it comes back", () => {
    const decision = evaluateBudget({ dayUSD: 1.25, monthUSD: 2 }, limits);
    expect(decision).toMatchObject({ allowed: false });
    const { message } = decision as { message: string };
    expect(message).toContain("$1.25");
    expect(message).toContain("$1.00");
    expect(message).toContain("24 hours");
  });

  it("treats a zero or negative limit as no limit", () => {
    const decision = evaluateBudget(
      { dayUSD: 999, monthUSD: 999 },
      { dailyUSD: 0, monthlyUSD: -1 },
    );
    expect(decision).toEqual({ allowed: true, remainingUSD: Infinity });
  });

  it("still enforces the month when only the day is unlimited", () => {
    const decision = evaluateBudget({ dayUSD: 50, monthUSD: 50 }, { dailyUSD: 0, monthlyUSD: 10 });
    expect(decision).toMatchObject({ allowed: false, window: "month" });
  });

  it("reports the day first when both limits are blown", () => {
    // The day is the one that frees up soonest, so it's the more useful thing
    // to tell the reader about.
    const decision = evaluateBudget({ dayUSD: 5, monthUSD: 50 }, limits);
    expect(decision).toMatchObject({ allowed: false, window: "day" });
  });
});

describe("limitsFromEnv", () => {
  it("defaults to a real ceiling rather than unlimited", () => {
    expect(limitsFromEnv({})).toEqual({ dailyUSD: 1, monthlyUSD: 10 });
  });

  it("reads configured limits", () => {
    expect(limitsFromEnv({ USAGE_DAILY_LIMIT_USD: "0.5", USAGE_MONTHLY_LIMIT_USD: "25" })).toEqual({
      dailyUSD: 0.5,
      monthlyUSD: 25,
    });
  });

  it("lets an explicit 0 disable a limit", () => {
    expect(limitsFromEnv({ USAGE_DAILY_LIMIT_USD: "0" }).dailyUSD).toBe(0);
  });

  it("falls back to the default rather than unlimited when a limit is malformed", () => {
    // A typo in an env var must not quietly remove the ceiling.
    expect(limitsFromEnv({ USAGE_DAILY_LIMIT_USD: "one dollar" }).dailyUSD).toBe(1);
    expect(limitsFromEnv({ USAGE_MONTHLY_LIMIT_USD: "  " }).monthlyUSD).toBe(10);
  });
});

describe("window constants", () => {
  it("are a rolling day and a rolling 30 days", () => {
    expect(DAY_MS).toBe(86_400_000);
    expect(MONTH_MS).toBe(30 * DAY_MS);
  });
});
