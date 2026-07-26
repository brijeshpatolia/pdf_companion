import { test, expect } from "@playwright/experimental-ct-react";
// `playwright` is already a direct devDependency; `@playwright/test` is not,
// and the component-test package only re-exports Locator.
import type { Page } from "playwright";
import type { Locator } from "@playwright/experimental-ct-core";
import SelectionHarness from "./SelectionHarness.js";

/**
 * The reader's select-to-ask popover.
 *
 * Every assertion here is about something jsdom cannot model: a real text
 * selection made by dragging, and whether the browser dispatches a click at
 * all. Both shipped broken before, and neither was catchable by the unit
 * tests.
 */

/**
 * Drag across the prose the way a reader does, and return the text that got
 * selected — derived from the same range the drag traces, so an assertion
 * about it can't drift out of step with the fixture's wording.
 */
async function dragSelect(page: Page, component: Locator, from = 10, to = 49) {
  const target = await component
    .getByTestId("prose")
    .evaluate(
      (el: HTMLElement, [start, end]: [number, number]) => {
        const range = new Range();
        range.setStart(el.firstChild!, start);
        range.setEnd(el.firstChild!, end);
        const rects = [...range.getClientRects()];
        const first = rects[0]!;
        const last = rects[rects.length - 1]!;
        return {
          text: range.toString(),
          x1: first.left + 1,
          y1: first.top + first.height / 2,
          x2: last.right - 1,
          y2: last.top + last.height / 2,
        };
      },
      [from, to] as [number, number],
    );

  await page.mouse.move(target.x1, target.y1);
  await page.mouse.down();
  // Stepped, so the browser treats it as a drag rather than a jump.
  await page.mouse.move(target.x2, target.y2, { steps: 12 });
  await page.mouse.up();
  return target.text;
}

const calls = (component: Locator) => component.getByTestId("calls");

test("selecting a passage raises the popover and marks what you picked", async ({
  page,
  mount,
}) => {
  const component = await mount(<SelectionHarness />);
  await dragSelect(page, component);
  await expect(component.locator("[data-selection-tooltip]")).toBeVisible();

  // We clear the real selection so the browser can't put its own menu on it,
  // which means these marks are the only thing showing what you chose. If they
  // stop being drawn, the selection looks like it silently vanished.
  await expect(component.locator(".sel-mark").first()).toBeVisible();

  // And the native selection really is gone — that's the point of the marks.
  expect(await page.evaluate(() => window.getSelection()?.toString() ?? "")).toBe("");
});

test("a one-character drag is not a selection worth acting on", async ({ page, mount }) => {
  const component = await mount(<SelectionHarness />);
  const text = await dragSelect(page, component, 10, 11);

  expect(text).toHaveLength(1);
  await expect(component.locator("[data-selection-tooltip]")).toHaveCount(0);
  await expect(component.locator(".sel-mark")).toHaveCount(0);
});

/**
 * The regression that prompted all of this.
 *
 * The popover sits inside the container that listens for mouseup, so releasing
 * the mouse on one of its buttons bubbles into that handler. Once the handler
 * started clearing the selection, it read "no text" on that bubbled mouseup,
 * unmounted the popover, and the browser had no connected target left to
 * dispatch the click to — so every action silently did nothing.
 */
for (const { label, expected } of [
  { label: "Highlight", expected: "highlight:" },
  { label: "Define", expected: "select:define:" },
  { label: "Deep Dive", expected: "select:deep-dive:" },
  { label: "ELI5", expected: "select:eli5:" },
]) {
  test(`${label} runs its action and closes the popover`, async ({ page, mount }) => {
    const component = await mount(<SelectionHarness />);
    const text = await dragSelect(page, component);

    await component.getByRole("button", { name: label, exact: true }).click();

    // The whole selection reaches the handler, not a truncated or stale copy.
    await expect(calls(component)).toHaveText(expected + text);
    // Nothing is selected any more, so nothing should still be marked as such.
    await expect(component.locator("[data-selection-tooltip]")).toHaveCount(0);
    await expect(component.locator(".sel-mark")).toHaveCount(0);
  });
}

test("the popover works without a mouse", async ({ page, mount }) => {
  // Actions are wired to click rather than mousedown for exactly this reason:
  // Enter on a focused button dispatches click and never mousedown.
  const component = await mount(<SelectionHarness />);
  const text = await dragSelect(page, component);

  await component.getByRole("button", { name: "Highlight", exact: true }).focus();
  await page.keyboard.press("Enter");

  await expect(calls(component)).toHaveText("highlight:" + text);
});

test("Escape dismisses without running anything", async ({ page, mount }) => {
  const component = await mount(<SelectionHarness />);
  await dragSelect(page, component);
  await expect(component.locator("[data-selection-tooltip]")).toBeVisible();

  await page.keyboard.press("Escape");

  await expect(component.locator("[data-selection-tooltip]")).toHaveCount(0);
  await expect(calls(component)).toHaveText("");
});

test("clicking away dismisses without running anything", async ({ page, mount }) => {
  const component = await mount(<SelectionHarness />);
  await dragSelect(page, component);
  await expect(component.locator("[data-selection-tooltip]")).toBeVisible();

  await page.mouse.click(20, 600);

  await expect(component.locator("[data-selection-tooltip]")).toHaveCount(0);
  await expect(calls(component)).toHaveText("");
});

/**
 * Touch selection.
 *
 * On a phone you long-press to select, then drag the handles to extend. That
 * gesture belongs to the browser's own selection UI: `touchend` frequently
 * never reaches the page, and adjusting a handle produces no touch event on
 * the container at all. A popover that only listens for mouseup and touchend
 * therefore never appears — which is exactly what was reported from the
 * installed app.
 *
 * `selectionchange` is the one signal that fires however the selection was
 * made, so that is what this asserts on.
 */
test("a selection made without a mouse still raises the popover", async ({ page, mount }) => {
  const component = await mount(<SelectionHarness />);

  // A long-press does fire touchstart on the container — it's the touchend
  // afterwards that never reliably arrives, because the browser has taken the
  // gesture over by then.
  await component.getByTestId("prose").dispatchEvent("touchstart");

  await component.getByTestId("prose").evaluate((el: HTMLElement) => {
    const range = new Range();
    range.setStart(el.firstChild!, 10);
    range.setEnd(el.firstChild!, 49);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
  });

  await expect(component.locator("[data-selection-tooltip]")).toBeVisible();
  await expect(component.getByRole("button", { name: "Highlight", exact: true })).toBeVisible();

  // The selection is left alone on touch. Clearing it destroys the drag
  // handles, so the reader could never extend past the first long-pressed word.
  expect(await page.evaluate(() => window.getSelection()?.toString().trim() ?? "")).not.toBe("");
  // And no marks of our own, which would just double the real highlight.
  await expect(component.locator(".sel-mark")).toHaveCount(0);
});

test("adjusting a touch selection keeps one popover, not a trail of them", async ({ mount }) => {
  const component = await mount(<SelectionHarness />);
  await component.getByTestId("prose").dispatchEvent("touchstart");

  for (const end of [20, 30, 49]) {
    await component.getByTestId("prose").evaluate((el: HTMLElement, to: number) => {
      const range = new Range();
      range.setStart(el.firstChild!, 10);
      range.setEnd(el.firstChild!, to);
      const sel = window.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(range);
    }, end);
  }

  await expect(component.locator("[data-selection-tooltip]")).toHaveCount(1);
});
