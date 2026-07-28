import { describe, it, expect } from "vitest";
import { hitAtK, recallAtK, reciprocalRank, summarise } from "./metrics.js";

describe("hitAtK", () => {
  it("is true when a relevant page is inside the cutoff", () => {
    expect(hitAtK({ retrieved: [9, 4, 7], relevant: [7] }, 3)).toBe(true);
  });

  it("is false when the relevant page is just past it", () => {
    // The distinction the whole measure exists for: a page ranked fourth is a
    // page the model never saw.
    expect(hitAtK({ retrieved: [9, 4, 2, 7], relevant: [7] }, 3)).toBe(false);
  });

  it("counts any one of several relevant pages", () => {
    expect(hitAtK({ retrieved: [8, 3], relevant: [3, 42, 51] }, 2)).toBe(true);
  });

  it("is false for a question with nothing to find", () => {
    // A question labelled with no relevant page is a labelling mistake, not a
    // free pass — it must never count as a hit.
    expect(hitAtK({ retrieved: [1, 2], relevant: [] }, 2)).toBe(false);
  });

  it("treats a nonsensical cutoff as retrieving nothing", () => {
    expect(hitAtK({ retrieved: [7], relevant: [7] }, 0)).toBe(false);
    expect(hitAtK({ retrieved: [7], relevant: [7] }, -3)).toBe(false);
  });
});

describe("recallAtK", () => {
  it("is the share of relevant pages found", () => {
    expect(recallAtK({ retrieved: [3, 9, 51], relevant: [3, 42, 51] }, 3)).toBeCloseTo(2 / 3);
  });

  it("is 1 when everything relevant is inside the cutoff", () => {
    expect(recallAtK({ retrieved: [3, 51], relevant: [51, 3] }, 2)).toBe(1);
  });

  it("does not reward retrieving the same page twice", () => {
    // A retriever returning duplicates must not be able to inflate its score.
    expect(recallAtK({ retrieved: [7, 7, 7], relevant: [7, 8] }, 3)).toBe(0.5);
  });

  it("is 0 when nothing relevant was found", () => {
    expect(recallAtK({ retrieved: [1, 2, 3], relevant: [99] }, 3)).toBe(0);
  });
});

describe("reciprocalRank", () => {
  it("is 1 when the right page is first", () => {
    expect(reciprocalRank({ retrieved: [7, 1, 2], relevant: [7] })).toBe(1);
  });

  it("falls off with the rank of the first relevant page", () => {
    expect(reciprocalRank({ retrieved: [1, 7], relevant: [7] })).toBe(0.5);
    expect(reciprocalRank({ retrieved: [1, 2, 7], relevant: [7] })).toBeCloseTo(1 / 3);
  });

  it("takes the *first* relevant page, not the best-numbered one", () => {
    expect(reciprocalRank({ retrieved: [42, 7], relevant: [7, 42] })).toBe(1);
  });

  it("is 0 when the page never appears", () => {
    expect(reciprocalRank({ retrieved: [1, 2, 3], relevant: [7] })).toBe(0);
  });
});

describe("summarise", () => {
  it("averages across questions at each cutoff", () => {
    const report = summarise(
      [
        { retrieved: [7, 1, 2], relevant: [7] }, // hit at 1
        { retrieved: [1, 2, 7], relevant: [7] }, // hit at 3 only
      ],
      [1, 3],
    );

    expect(report.questions).toBe(2);
    expect(report.cutoffs.find((c) => c.k === 1)!.hitRate).toBe(0.5);
    expect(report.cutoffs.find((c) => c.k === 3)!.hitRate).toBe(1);
    // (1 + 1/3) / 2
    expect(report.mrr).toBeCloseTo(2 / 3);
  });

  it("reports zeroes rather than dividing by nothing", () => {
    const report = summarise([], [5]);
    expect(report.questions).toBe(0);
    expect(report.mrr).toBe(0);
    expect(report.cutoffs[0]!.hitRate).toBe(0);
  });
});
