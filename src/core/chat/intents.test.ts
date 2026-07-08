import { describe, it, expect } from "vitest";
import { buildIntentQuestion } from "./intents.js";

describe("buildIntentQuestion", () => {
  it("define wraps selection in a definition prompt", () => {
    const q = buildIntentQuestion("define", "categorical imperative");
    expect(q).toContain('"categorical imperative"');
    expect(q.toLowerCase()).toContain("define");
  });

  it("deep-dive asks for in-depth explanation", () => {
    const q = buildIntentQuestion("deep-dive", "The soul is immortal");
    expect(q).toContain('"The soul is immortal"');
    expect(q.toLowerCase()).toContain("depth");
  });

  it("eli5 asks for simple explanation", () => {
    const q = buildIntentQuestion("eli5", "quantum entanglement");
    expect(q).toContain('"quantum entanglement"');
    expect(q.toLowerCase()).toMatch(/simple|5/);
  });

  it("trims whitespace from selection", () => {
    const q = buildIntentQuestion("define", "  padded text  ");
    expect(q).toContain('"padded text"');
  });
});
