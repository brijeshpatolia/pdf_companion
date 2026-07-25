import { describe, it, expect } from "vitest";
import { computeCostUSD, normalizeModelId, rateFor } from "./pricing.js";

describe("normalizeModelId", () => {
  it("strips an OpenRouter provider prefix", () => {
    expect(normalizeModelId("anthropic/claude-sonnet-4-6")).toBe("claude-sonnet-4-6");
  });

  it("passes a bare Anthropic id through", () => {
    expect(normalizeModelId("claude-sonnet-4-6")).toBe("claude-sonnet-4-6");
  });

  it("strips a dated snapshot suffix and normalizes case/space", () => {
    expect(normalizeModelId("  Claude-Haiku-4-5-20251001 ")).toBe("claude-haiku-4-5");
  });
});

describe("rateFor", () => {
  it("resolves the same rate for both gateways' ids", () => {
    expect(rateFor("claude-sonnet-4-6")).toEqual({ in: 3, out: 15 });
    expect(rateFor("anthropic/claude-sonnet-4-6")).toEqual({ in: 3, out: 15 });
  });

  it("returns null for an unknown model", () => {
    expect(rateFor("some-other-model")).toBeNull();
  });
});

describe("computeCostUSD", () => {
  it("prices a million in / million out at the published rate", () => {
    expect(computeCostUSD("claude-sonnet-4-6", 1_000_000, 1_000_000)).toBeCloseTo(18, 6);
  });

  it("prices a realistic exchange", () => {
    // 699 in + 55 out on Sonnet 4.6 → 699/1e6*3 + 55/1e6*15
    expect(computeCostUSD("claude-sonnet-4-6", 699, 55)).toBeCloseTo(0.002922, 6);
  });

  it("prices OpenRouter-prefixed ids identically", () => {
    expect(computeCostUSD("anthropic/claude-sonnet-4-6", 1000, 500)).toBe(
      computeCostUSD("claude-sonnet-4-6", 1000, 500),
    );
  });

  it("returns 0 for an unpriced model rather than guessing", () => {
    expect(computeCostUSD("mystery-model-9", 10_000, 10_000)).toBe(0);
  });

  it("returns 0 when no tokens were used", () => {
    expect(computeCostUSD("claude-sonnet-4-6", 0, 0)).toBe(0);
  });

  it("weights output tokens more than input", () => {
    const inputHeavy = computeCostUSD("claude-sonnet-4-6", 1000, 0);
    const outputHeavy = computeCostUSD("claude-sonnet-4-6", 0, 1000);
    expect(outputHeavy).toBeGreaterThan(inputHeavy);
  });
});
