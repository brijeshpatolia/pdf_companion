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

/** A long-press and drag, as far as anything in the page can observe it. */
async function touchSelect(component: Locator, to = 49) {
  // A long-press does fire touchstart on the container — it's the touchend
  // afterwards that never reliably arrives, because the browser has taken the
  // gesture over by then.
  await component.getByTestId("prose").dispatchEvent("touchstart");
  await component.getByTestId("prose").evaluate((el: HTMLElement, end: number) => {
    const range = new Range();
    range.setStart(el.firstChild!, 10);
    range.setEnd(el.firstChild!, end);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
  }, to);
}

test("a selection made without a mouse still raises the popover", async ({ mount }) => {
  const component = await mount(<SelectionHarness />);
  await touchSelect(component);

  await expect(component.locator("[data-selection-tooltip]")).toBeVisible();
  await expect(component.getByRole("button", { name: "Highlight", exact: true })).toBeVisible();
});

/**
 * The regression behind the screenshot from the phone.
 *
 * Leaving the selection alive on touch kept the drag handles — and kept
 * Android's Copy / Share / Select-all bar, which the system draws straight
 * over this popover, and Chrome's touch-to-search panel along the bottom. The
 * app's own actions were on screen and unreachable.
 *
 * So touch now does what the mouse does, once the selection stops moving:
 * takes it over and draws its own marks.
 */
test("a settled touch selection is taken over, so the platform's menu goes with it", async ({
  page,
  mount,
}) => {
  const component = await mount(<SelectionHarness />);
  await touchSelect(component);

  await expect(component.locator("[data-selection-tooltip]")).toBeVisible();
  await expect(component.locator(".sel-mark").first()).toBeVisible();
  expect(await page.evaluate(() => window.getSelection()?.toString() ?? "")).toBe("");
});

test("the popover survives the selection being taken over", async ({ page, mount }) => {
  // Clearing the selection fires `selectionchange`, which is the very signal
  // the touch path listens on. Left unguarded it answers its own event: the
  // next capture finds nothing selected and dismisses the popover it had just
  // raised, half a second after the reader watched it appear.
  const component = await mount(<SelectionHarness />);
  await touchSelect(component);
  await expect(component.locator("[data-selection-tooltip]")).toBeVisible();

  // Comfortably past the settle window, so a rescheduled capture would have
  // run by now.
  await page.waitForTimeout(1200);
  await expect(component.locator("[data-selection-tooltip]")).toBeVisible();
  await expect(component.getByRole("button", { name: "Highlight", exact: true })).toBeVisible();
});

test("on touch the popover goes below the selection, out of the platform's way", async ({
  mount,
}) => {
  const component = await mount(<SelectionHarness />);
  await touchSelect(component);

  const popover = component.locator("[data-selection-tooltip]");
  await expect(popover).toBeVisible();

  const [pop, mark] = await Promise.all([
    popover.boundingBox(),
    component.locator(".sel-mark").first().boundingBox(),
  ]);
  // Android anchors its own bar above the selection, which is where this used
  // to sit — and it lost.
  expect(pop!.y).toBeGreaterThanOrEqual(mark!.y + mark!.height);
});

test("a selection at the edge of a narrow pane keeps the popover on screen", async ({
  page,
  mount,
}) => {
  await page.setViewportSize({ width: 393, height: 760 });
  try {
    const component = await mount(<SelectionHarness narrow />);
    await touchSelect(component, 20);

    const popover = component.locator("[data-selection-tooltip]");
    await expect(popover).toBeVisible();

    const box = (await popover.boundingBox())!;
    expect(box.x, "the popover runs off the left").toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, "the popover runs off the right").toBeLessThanOrEqual(393);
  } finally {
    await page.setViewportSize({ width: 1280, height: 720 });
  }
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
