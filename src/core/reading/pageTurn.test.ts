import { describe, it, expect } from "vitest";
import { planTurn } from "./pageTurn.js";

describe("planTurn", () => {
  it("turns one leaf forward", () => {
    expect(planTurn(5, 6)).toEqual({ kind: "turn", direction: "forward" });
  });

  it("turns one leaf back", () => {
    expect(planTurn(6, 5)).toEqual({ kind: "turn", direction: "back" });
  });

  it("does not mime four hundred pages with a single sheet", () => {
    // The gesture means "one page". Using it for a jump would say something
    // false about the distance travelled, so a jump gets its own motion.
    expect(planTurn(12, 412)).toEqual({ kind: "jump", direction: "forward" });
    expect(planTurn(412, 12)).toEqual({ kind: "jump", direction: "back" });
  });

  it("treats two pages as a jump, not a turn", () => {
    // The line is exactly one page wide, because one leaf is exactly one page.
    expect(planTurn(1, 3)?.kind).toBe("jump");
  });

  it("has nothing to say about staying put", () => {
    expect(planTurn(7, 7)).toBeNull();
  });

  it("stays still when the reader has asked for stillness", () => {
    expect(planTurn(5, 6, { reducedMotion: true })).toBeNull();
    expect(planTurn(5, 400, { reducedMotion: true })).toBeNull();
  });

  it("refuses a page number that isn't one", () => {
    expect(planTurn(NaN, 4)).toBeNull();
    expect(planTurn(4, Infinity)).toBeNull();
  });

  it("reads a fractional page as the page it rounds to", () => {
    // Nothing in the reader produces one, but a plan built from a bad number
    // should still be a plan or nothing — never a turn of half a leaf.
    expect(planTurn(5.2, 6.1)).toEqual({ kind: "turn", direction: "forward" });
    expect(planTurn(5.2, 5.4)).toBeNull();
  });
});
