import { describe, it, expect } from "vitest";
import { placePopover } from "./selectionPopover.js";

/** A phone-sized pane, scrolled to the top. */
const phone = { left: 0, top: 0, width: 377, height: 600 };
/** Four buttons in a row: most of a phone's width. */
const bar = { width: 330, height: 40 };

/** A selection roughly in the middle of the pane. */
const middle = { left: 120, right: 260, top: 300, bottom: 326 };

describe("placePopover", () => {
  it("centres on the selection when there is room", () => {
    const { left } = placePopover(middle, phone, bar, false);
    expect(left + bar.width / 2).toBe(190); // the selection's own centre
  });

  it("sits above the selection for a mouse", () => {
    const { top } = placePopover(middle, phone, bar, false);
    expect(top + bar.height).toBeLessThan(middle.top);
  });

  it("sits below the selection for a touch", () => {
    // Android draws its own Copy / Share / Select-all bar above the selection,
    // over the top of this one. Ours goes the other way.
    const { top } = placePopover(middle, phone, bar, true);
    expect(top).toBeGreaterThan(middle.bottom);
  });

  it("keeps a selection at the right edge on screen", () => {
    // Centred, this would start at 377 - 20 - 165 = 192 and run to 522, which
    // is 145px past the edge of the phone.
    const edge = { left: 337, right: 377, top: 300, bottom: 326 };
    const { left } = placePopover(edge, phone, bar, true);

    expect(left).toBeGreaterThanOrEqual(0);
    expect(left + bar.width).toBeLessThanOrEqual(phone.width);
  });

  it("keeps a selection at the left edge on screen", () => {
    const edge = { left: 0, right: 40, top: 300, bottom: 326 };
    const { left } = placePopover(edge, phone, bar, true);

    expect(left).toBeGreaterThanOrEqual(0);
    expect(left + bar.width).toBeLessThanOrEqual(phone.width);
  });

  it("flips above when there is no room below", () => {
    const last = { left: 120, right: 260, top: 560, bottom: 586 };
    const { top } = placePopover(last, phone, bar, true);
    expect(top + bar.height).toBeLessThanOrEqual(last.top);
  });

  it("flips below when there is no room above", () => {
    const first = { left: 120, right: 260, top: 4, bottom: 30 };
    const { top } = placePopover(first, phone, bar, false);
    expect(top).toBeGreaterThanOrEqual(first.bottom);
  });

  it("works in a pane that has been scrolled", () => {
    // Everything is in the pane's own coordinates, so a scrolled pane's
    // visible box starts at its scroll offset rather than at zero.
    const scrolled = { left: 0, top: 900, width: 377, height: 600 };
    const selection = { left: 120, right: 260, top: 1200, bottom: 1226 };

    const { top } = placePopover(selection, scrolled, bar, true);
    expect(top).toBeGreaterThan(selection.bottom);
    expect(top + bar.height).toBeLessThanOrEqual(scrolled.top + scrolled.height);
  });

  it("centres a popover too wide to fit rather than jamming it to one side", () => {
    // Nothing satisfies both edges, so it overflows evenly and stays legible
    // instead of hanging off the right.
    const huge = { width: 500, height: 40 };
    const { left } = placePopover(middle, phone, huge, true);
    expect(left).toBe(Math.round((377 - 500) / 2));
  });

  it("returns whole pixels", () => {
    const odd = { left: 121, right: 260, top: 300, bottom: 326 };
    const { left, top } = placePopover(odd, phone, bar, true);
    expect(Number.isInteger(left)).toBe(true);
    expect(Number.isInteger(top)).toBe(true);
  });
});
