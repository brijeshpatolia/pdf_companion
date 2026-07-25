/**
 * Aggregates raw usage rows (one per answered question) into the shape the
 * dashboard renders. Pure — the adapter reads rows, this summarizes them.
 */

export interface UsageRow {
  /** Null for spend not attributable to one book, or whose book was deleted. */
  bookId: string | null;
  bookTitle: string | null;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  model: string;
  createdAt: string; // ISO timestamp
}

export interface BookUsage {
  bookId: string | null;
  title: string;
  costUsd: number;
  tokensIn: number;
  tokensOut: number;
  count: number;
}

export interface ModelUsage {
  model: string;
  costUsd: number;
  count: number;
}

export interface DayUsage {
  day: string; // YYYY-MM-DD (UTC)
  costUsd: number;
}

export interface UsageSummary {
  totalCostUsd: number;
  totalTokensIn: number;
  totalTokensOut: number;
  chatCount: number;
  byBook: BookUsage[];
  byModel: ModelUsage[];
  byDay: DayUsage[];
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Groups spend with no surviving book under one honest label. */
const UNATTRIBUTED = "Across your library";

export function summarizeUsage(rows: UsageRow[]): UsageSummary {
  const byBookMap = new Map<string | null, BookUsage>();
  const byModelMap = new Map<string, ModelUsage>();
  const byDayMap = new Map<string, number>();

  let totalCostUsd = 0;
  let totalTokensIn = 0;
  let totalTokensOut = 0;

  for (const row of rows) {
    const cost = num(row.costUsd);
    const tin = num(row.tokensIn);
    const tout = num(row.tokensOut);

    totalCostUsd += cost;
    totalTokensIn += tin;
    totalTokensOut += tout;

    const book = byBookMap.get(row.bookId) ?? {
      bookId: row.bookId,
      title: row.bookTitle?.trim() || (row.bookId === null ? UNATTRIBUTED : "Untitled"),
      costUsd: 0,
      tokensIn: 0,
      tokensOut: 0,
      count: 0,
    };
    book.costUsd += cost;
    book.tokensIn += tin;
    book.tokensOut += tout;
    book.count += 1;
    byBookMap.set(row.bookId, book);

    const model = byModelMap.get(row.model) ?? { model: row.model, costUsd: 0, count: 0 };
    model.costUsd += cost;
    model.count += 1;
    byModelMap.set(row.model, model);

    const day = (row.createdAt ?? "").slice(0, 10);
    if (day) byDayMap.set(day, (byDayMap.get(day) ?? 0) + cost);
  }

  return {
    totalCostUsd,
    totalTokensIn,
    totalTokensOut,
    chatCount: rows.length,
    byBook: [...byBookMap.values()].sort((a, b) => b.costUsd - a.costUsd),
    byModel: [...byModelMap.values()].sort((a, b) => b.costUsd - a.costUsd),
    byDay: [...byDayMap.entries()]
      .map(([day, costUsd]) => ({ day, costUsd }))
      .sort((a, b) => a.day.localeCompare(b.day)),
  };
}
