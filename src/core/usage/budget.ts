/**
 * Spending limits for AI calls.
 *
 * The app talks to a paid model API on a key the *operator* owns, not the
 * reader's. Without a ceiling, anyone the operator shares the app with can
 * spend their money without limit. This decides, from spend already recorded,
 * whether the next call is allowed.
 *
 * Both windows are rolling rather than calendar-aligned: "the last 24 hours"
 * needs no timezone and can't be gamed by waiting for midnight.
 *
 * The check happens *before* a call, against spend already recorded, so a
 * single request can carry the total slightly past its limit. That's fine —
 * the point is to bound runaway usage, not to bill to the cent.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;
export const MONTH_MS = 30 * DAY_MS;

export interface BudgetLimits {
  /** Ceiling for the last 24 hours. Zero or negative means no limit. */
  dailyUSD: number;
  /** Ceiling for the last 30 days. Zero or negative means no limit. */
  monthlyUSD: number;
}

export interface BudgetSpend {
  /** Recorded spend over the last 24 hours. */
  dayUSD: number;
  /** Recorded spend over the last 30 days. */
  monthUSD: number;
}

export interface BudgetOk {
  allowed: true;
  /** How much room is left under the tighter of the two limits. */
  remainingUSD: number;
}

export interface BudgetExceeded {
  allowed: false;
  window: "day" | "month";
  limitUSD: number;
  spentUSD: number;
  /** Ready to show to the reader — says what ran out and when it returns. */
  message: string;
}

export type BudgetDecision = BudgetOk | BudgetExceeded;

const unlimited = (limit: number) => !Number.isFinite(limit) || limit <= 0;

const usd = (n: number) => `$${n.toFixed(2)}`;

/** Decides whether another AI call is affordable. */
export function evaluateBudget(spend: BudgetSpend, limits: BudgetLimits): BudgetDecision {
  const checks = [
    { window: "day" as const, limit: limits.dailyUSD, spent: spend.dayUSD, resets: "24 hours" },
    {
      window: "month" as const,
      limit: limits.monthlyUSD,
      spent: spend.monthUSD,
      resets: "30 days",
    },
  ];

  for (const c of checks) {
    if (!unlimited(c.limit) && c.spent >= c.limit) {
      return {
        allowed: false,
        window: c.window,
        limitUSD: c.limit,
        spentUSD: c.spent,
        message:
          `You've used ${usd(c.spent)} of your ${usd(c.limit)} AI budget for the last ` +
          `${c.resets}. It frees up as older usage ages out of that window.`,
      };
    }
  }

  const headroom = checks
    .filter((c) => !unlimited(c.limit))
    .map((c) => c.limit - c.spent);

  return {
    allowed: true,
    remainingUSD: headroom.length === 0 ? Infinity : Math.min(...headroom),
  };
}

/** Reads limits from the environment, falling back to conservative defaults. */
export function limitsFromEnv(env: Record<string, string | undefined>): BudgetLimits {
  const read = (name: string, fallback: number) => {
    const raw = env[name];
    if (raw === undefined || raw.trim() === "") return fallback;
    const n = Number(raw);
    // A malformed limit must not silently mean "unlimited".
    return Number.isFinite(n) ? n : fallback;
  };
  return {
    dailyUSD: read("USAGE_DAILY_LIMIT_USD", 1),
    monthlyUSD: read("USAGE_MONTHLY_LIMIT_USD", 10),
  };
}
