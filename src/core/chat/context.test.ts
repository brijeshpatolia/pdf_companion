import { describe, it, expect } from "vitest";
import { assembleContext } from "./context.js";
import type { ContextSlots, ContextConfig } from "./context.js";

const BASE_SLOTS: ContextSlots = {
  currentPageText: "Socrates spoke of the soul.",
  currentPage: 42,
  retrievedChunks: [],
  recentTurns: [],
  question: "What is the soul?",
};

const SMALL_CONFIG: ContextConfig = {
  maxTokens: 2000,
  pageReserve: 500,
  turnsReserve: 300,
  retrievalReserve: 500,
  questionReserve: 200,
};

describe("assembleContext", () => {
  it("includes current page text and page number", () => {
    const ctx = assembleContext(BASE_SLOTS, SMALL_CONFIG);
    expect(ctx).toContain("page 42");
    expect(ctx).toContain("Socrates spoke of the soul.");
  });

  it("includes no-spoiler instruction", () => {
    const ctx = assembleContext(BASE_SLOTS, SMALL_CONFIG);
    expect(ctx).toMatch(/do not reveal/i);
  });

  it("includes retrieved chunks with page references", () => {
    const ctx = assembleContext(
      {
        ...BASE_SLOTS,
        retrievedChunks: [
          { page: 10, text: "Earlier discussion of forms.", score: 0.9 },
          { page: 5, text: "Introduction to Plato.", score: 0.8 },
        ],
      },
      SMALL_CONFIG,
    );
    expect(ctx).toContain("[Page 10]: Earlier discussion of forms.");
    expect(ctx).toContain("[Page 5]: Introduction to Plato.");
  });

  it("drops retrieval chunks that exceed budget", () => {
    const ctx = assembleContext(
      {
        ...BASE_SLOTS,
        retrievedChunks: [
          { page: 1, text: "First chunk fits.", score: 0.95 },
          { page: 2, text: "x".repeat(2000), score: 0.5 },
        ],
      },
      { ...SMALL_CONFIG, retrievalReserve: 20 },
    );
    expect(ctx).toContain("[Page 1]: First chunk fits.");
    expect(ctx).not.toContain("[Page 2]");
  });

  it("includes recent turns most-recent-first priority", () => {
    const ctx = assembleContext(
      {
        ...BASE_SLOTS,
        recentTurns: [
          { role: "user", content: "Old question" },
          { role: "assistant", content: "Old answer" },
          { role: "user", content: "Recent question" },
          { role: "assistant", content: "Recent answer" },
        ],
      },
      SMALL_CONFIG,
    );
    expect(ctx).toContain("Recent question");
    expect(ctx).toContain("Recent answer");
  });

  it("drops oldest turns when over budget", () => {
    const ctx = assembleContext(
      {
        ...BASE_SLOTS,
        recentTurns: [
          { role: "user", content: "A".repeat(1000) },
          { role: "assistant", content: "B".repeat(1000) },
          { role: "user", content: "Latest question" },
          { role: "assistant", content: "Latest answer" },
        ],
      },
      { ...SMALL_CONFIG, turnsReserve: 100 },
    );
    expect(ctx).toContain("Latest question");
    expect(ctx).not.toContain("A".repeat(1000));
  });

  it("truncates page text when over page reserve", () => {
    const longPage = "W".repeat(10000);
    const ctx = assembleContext(
      { ...BASE_SLOTS, currentPageText: longPage },
      { ...SMALL_CONFIG, pageReserve: 50 },
    );
    expect(ctx).toContain("…");
    expect(ctx.length).toBeLessThan(longPage.length);
  });
});
