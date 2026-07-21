import { describe, it, expect } from "vitest";
import { summarizeUsage } from "./summarize.js";
import type { UsageRow } from "./summarize.js";

const rows: UsageRow[] = [
  { bookId: "b1", bookTitle: "The Republic", tokensIn: 100, tokensOut: 50, costUsd: 0.01, model: "claude-sonnet-4-6", createdAt: "2026-07-20T10:00:00Z" },
  { bookId: "b1", bookTitle: "The Republic", tokensIn: 200, tokensOut: 80, costUsd: 0.02, model: "claude-sonnet-4-6", createdAt: "2026-07-20T12:00:00Z" },
  { bookId: "b2", bookTitle: "Meditations", tokensIn: 50, tokensOut: 25, costUsd: 0.05, model: "anthropic/claude-sonnet-4-6", createdAt: "2026-07-21T09:00:00Z" },
];

describe("summarizeUsage", () => {
  it("totals cost, tokens, and chat count", () => {
    const s = summarizeUsage(rows);
    expect(s.chatCount).toBe(3);
    expect(s.totalCostUsd).toBeCloseTo(0.08, 6);
    expect(s.totalTokensIn).toBe(350);
    expect(s.totalTokensOut).toBe(155);
  });

  it("groups by book, sorted by cost descending", () => {
    const s = summarizeUsage(rows);
    expect(s.byBook).toHaveLength(2);
    // b2 cost 0.05 > b1 cost 0.03
    expect(s.byBook[0]!.bookId).toBe("b2");
    expect(s.byBook[0]!.costUsd).toBeCloseTo(0.05, 6);
    const republic = s.byBook.find((b) => b.bookId === "b1")!;
    expect(republic.title).toBe("The Republic");
    expect(republic.count).toBe(2);
    expect(republic.tokensIn).toBe(300);
  });

  it("groups by model", () => {
    const s = summarizeUsage(rows);
    expect(s.byModel).toHaveLength(2);
    const sonnet = s.byModel.find((m) => m.model === "claude-sonnet-4-6")!;
    expect(sonnet.count).toBe(2);
  });

  it("builds a daily cost series sorted ascending", () => {
    const s = summarizeUsage(rows);
    expect(s.byDay.map((d) => d.day)).toEqual(["2026-07-20", "2026-07-21"]);
    expect(s.byDay[0]!.costUsd).toBeCloseTo(0.03, 6);
    expect(s.byDay[1]!.costUsd).toBeCloseTo(0.05, 6);
  });

  it("falls back to 'Untitled' and ignores non-numeric values", () => {
    const s = summarizeUsage([
      { bookId: "x", bookTitle: null, tokensIn: NaN as unknown as number, tokensOut: 10, costUsd: 0.01, model: "m", createdAt: "2026-07-21T00:00:00Z" },
    ]);
    expect(s.byBook[0]!.title).toBe("Untitled");
    expect(s.totalTokensIn).toBe(0);
    expect(s.totalTokensOut).toBe(10);
  });

  it("handles no usage", () => {
    const s = summarizeUsage([]);
    expect(s).toMatchObject({ totalCostUsd: 0, chatCount: 0, byBook: [], byModel: [], byDay: [] });
  });
});
