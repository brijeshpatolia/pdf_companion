import { describe, it, expect } from "vitest";
import { maybeFoldSummary } from "./fold.js";
import type { FoldDeps, RollingSummary, SummaryPort, SummaryGatewayPort } from "./types.js";
import type { PageTextPort } from "../chat/types.js";

function fakeSummaryPort(): SummaryPort & { stored: Map<string, RollingSummary> } {
  const stored = new Map<string, RollingSummary>();
  return {
    stored,
    async load(bookId) {
      return stored.get(bookId) ?? null;
    },
    async save(bookId, summary) {
      stored.set(bookId, summary);
    },
  };
}

function fakePageText(pages: Record<number, string>): PageTextPort {
  return {
    async getText(_bookId, page) {
      return pages[page] ?? "";
    },
  };
}

function fakeGateway(response: string): SummaryGatewayPort & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async summarize(prompt) {
      calls.push(prompt);
      return response;
    },
  };
}

function makeDeps(overrides: Partial<FoldDeps> = {}): FoldDeps {
  return {
    summaryPort: fakeSummaryPort(),
    pageText: fakePageText({ 1: "Page one text", 2: "Page two text", 3: "Page three text", 4: "Page four text", 5: "Page five text" }),
    gateway: fakeGateway("Summarized content."),
    pageThreshold: 3,
    ...overrides,
  };
}

describe("maybeFoldSummary", () => {
  it("does not fold when unread pages are below threshold", async () => {
    const deps = makeDeps();
    const result = await maybeFoldSummary("book-1", 2, deps);
    expect(result).toBeNull();
    expect((deps.gateway as any).calls.length).toBe(0);
  });

  it("folds when unread pages reach threshold", async () => {
    const deps = makeDeps();
    const result = await maybeFoldSummary("book-1", 3, deps);
    expect(result).not.toBeNull();
    expect(result!.summary).toBe("Summarized content.");
    expect(result!.coveredUpToPage).toBe(3);
  });

  it("sends page texts and previous summary to gateway", async () => {
    const port = fakeSummaryPort();
    port.stored.set("book-1", { bookId: "book-1", summary: "Prior summary.", coveredUpToPage: 2 });
    const gw = fakeGateway("Updated summary.");
    const deps = makeDeps({ summaryPort: port, gateway: gw, pageThreshold: 2 });

    await maybeFoldSummary("book-1", 5, deps);

    expect(gw.calls.length).toBe(1);
    expect(gw.calls[0]).toContain("Prior summary.");
    expect(gw.calls[0]).toContain("[Page 3]");
  });

  it("persists the folded summary", async () => {
    const port = fakeSummaryPort();
    const deps = makeDeps({ summaryPort: port });

    await maybeFoldSummary("book-1", 3, deps);

    const saved = port.stored.get("book-1");
    expect(saved).toBeDefined();
    expect(saved!.summary).toBe("Summarized content.");
    expect(saved!.coveredUpToPage).toBe(3);
  });

  it("caps fold to MAX_PAGES_PER_FOLD pages", async () => {
    const manyPages: Record<number, string> = {};
    for (let i = 1; i <= 20; i++) manyPages[i] = `Page ${i} content`;

    const gw = fakeGateway("Big fold.");
    const deps = makeDeps({
      pageText: fakePageText(manyPages),
      gateway: gw,
      pageThreshold: 3,
    });

    const result = await maybeFoldSummary("book-1", 20, deps);
    expect(result!.coveredUpToPage).toBe(10);
    expect(gw.calls[0]).toContain("[Page 1]");
    expect(gw.calls[0]).toContain("[Page 10]");
    expect(gw.calls[0]).not.toContain("[Page 11]");
  });

  it("incremental fold continues from previous coveredUpToPage", async () => {
    const port = fakeSummaryPort();
    port.stored.set("book-1", { bookId: "book-1", summary: "First fold.", coveredUpToPage: 3 });
    const gw = fakeGateway("Second fold.");
    const deps = makeDeps({
      summaryPort: port,
      gateway: gw,
      pageText: fakePageText({ 4: "Four", 5: "Five" }),
      pageThreshold: 2,
    });

    const result = await maybeFoldSummary("book-1", 5, deps);
    expect(result!.coveredUpToPage).toBe(5);
    expect(gw.calls[0]).toContain("[Page 4]");
    expect(gw.calls[0]).not.toContain("[Page 3]");
  });
});
