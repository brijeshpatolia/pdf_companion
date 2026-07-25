/**
 * Token pricing for the models this app calls, so every answer records what it
 * actually cost. Both gateways previously reported `costUSD: 0`, which made the
 * usage dashboard's headline spend permanently $0.
 *
 * Rates are USD per **million** tokens, from Anthropic's published pricing.
 * OpenRouter bills Anthropic models at the same per-token rates, so one table
 * serves both gateways once the provider prefix is stripped.
 */

export interface ModelRate {
  /** USD per 1M input tokens. */
  in: number;
  /** USD per 1M output tokens. */
  out: number;
}

const PER_MILLION: Record<string, ModelRate> = {
  "claude-opus-4-6": { in: 5, out: 25 },
  "claude-sonnet-4-6": { in: 3, out: 15 },
  "claude-haiku-4-5": { in: 1, out: 5 },
};

/**
 * Strips a provider prefix ("anthropic/claude-sonnet-4-6") and any date suffix
 * so OpenRouter and Anthropic model ids resolve to the same rate.
 */
export function normalizeModelId(model: string): string {
  const withoutProvider = model.includes("/") ? model.slice(model.lastIndexOf("/") + 1) : model;
  return withoutProvider.trim().toLowerCase().replace(/-\d{8}$/, "");
}

/** The published rate for a model, or null if we don't have one on file. */
export function rateFor(model: string): ModelRate | null {
  return PER_MILLION[normalizeModelId(model)] ?? null;
}

/**
 * Cost of one exchange in USD. Returns 0 for an unpriced model rather than
 * guessing — an honest zero beats an invented number in a spend dashboard.
 */
export function computeCostUSD(model: string, tokensIn: number, tokensOut: number): number {
  const rate = rateFor(model);
  if (!rate) return 0;
  const cost = (tokensIn / 1_000_000) * rate.in + (tokensOut / 1_000_000) * rate.out;
  // Sub-cent answers are normal here; keep enough precision to accumulate.
  return Math.round(cost * 1e6) / 1e6;
}
