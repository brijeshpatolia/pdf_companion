import { test, expect } from "@playwright/experimental-ct-react";
import type { Page } from "playwright";
import type { Locator } from "@playwright/experimental-ct-core";
import PageTurnHarness from "./PageTurnHarness.js";

/**
 * Turning a page.
 *
 * The turn works by copying the page you are leaving and animating the copy,
 * so almost everything worth asserting here is something jsdom has no opinion
 * about: whether `cloneNode` brought the drawn pixels with it, which element
 * the browser is actually animating, and whether the copy is ever cleaned up.
 *
 * Most of these tests hold the animation still first. A turn lasts about half
 * a second and then removes its own evidence, so freezing it is the only way
 * to look at the thing being tested rather than at a race.
 */

/**
 * Pauses every turn, so the leaf stays put and can be examined.
 *
 * The hook waits on the Web Animations API, and a paused animation never
 * finishes — which is precisely the hold we want, and also why the one test
 * about cleanup does not call this.
 */
async function holdTheTurn(page: Page) {
  await page.addStyleTag({
    content: `.leaf, .reader-paper.is-arriving { animation-play-state: paused !important; }`,
  });
}

const leaf = (component: Locator) => component.locator(".leaf");
const paper = (component: Locator) => component.locator(".reader-paper").first();

/** The colour painted on a canvas, as "r,g,b". */
const painted = (canvas: Locator) =>
  canvas.evaluate((el: HTMLCanvasElement) => {
    const d = el.getContext("2d")!.getImageData(1, 1, 1, 1).data;
    return `${d[0]},${d[1]},${d[2]}`;
  });

test("turning forward lifts away the page you were on", async ({ page, mount }) => {
  const component = await mount(<PageTurnHarness />);
  await holdTheTurn(page);

  await component.getByRole("button", { name: "Next" }).click();

  // The copy shows the page being left; the live page has already moved on.
  await expect(leaf(component)).toHaveClass(/leaf-forward/);
  await expect(leaf(component).getByTestId("prose")).toHaveText("Page 5 of the fixture.");
  await expect(paper(component).getByTestId("prose")).toHaveText("Page 6 of the fixture.");

  // Forward, it is the copy that moves and the live page that lies still.
  await expect(paper(component)).not.toHaveClass(/is-arriving/);
});

test("the copy carries the rendered page, not a blank sheet the same size", async ({
  page,
  mount,
}) => {
  // The reason the turn clones at all. `cloneNode` copies a <canvas> element
  // but not what has been drawn on it, so without the blit a PDF turns a sheet
  // of cream with a running head on it and no book.
  const component = await mount(<PageTurnHarness />);
  await holdTheTurn(page);
  await expect(painted(paper(component).locator("canvas"))).resolves.toBe("255,64,0");

  await component.getByRole("button", { name: "Next" }).click();

  expect(await painted(leaf(component).locator("canvas"))).toBe("255,64,0");
  expect(await painted(paper(component).locator("canvas"))).toBe("0,128,255");
});

test("turning back brings the page in over the one you were on", async ({ page, mount }) => {
  const component = await mount(<PageTurnHarness />);
  await holdTheTurn(page);

  await component.getByRole("button", { name: "Back" }).click();

  // Back, the roles swap: the copy is the page you were on and lies still
  // underneath, and the page you are returning to is the one that moves.
  await expect(paper(component)).toHaveClass(/is-arriving/);
  await expect(leaf(component)).toHaveClass(/leaf-back/);
  await expect(leaf(component).getByTestId("prose")).toHaveText("Page 5 of the fixture.");
  await expect(paper(component).getByTestId("prose")).toHaveText("Page 4 of the fixture.");

  // And it really is underneath — otherwise the arriving page lands behind the
  // one it is replacing and the turn plays out invisibly.
  await expect(component.locator(".page-leaf")).toHaveClass(/is-behind/);
  const [above, below] = await Promise.all([
    paper(component).evaluate((el) => getComputedStyle(el).zIndex),
    component.locator(".page-leaf").evaluate((el) => getComputedStyle(el).zIndex),
  ]);
  expect(Number(above)).toBeGreaterThan(Number(below));
});

test("a jump doesn't pretend to be a single page", async ({ page, mount }) => {
  const component = await mount(<PageTurnHarness />);
  await holdTheTurn(page);

  await component.getByRole("button", { name: "Jump ahead" }).click();

  await expect(leaf(component)).toHaveClass(/leaf-jump/);
  await expect(leaf(component)).not.toHaveClass(/leaf-forward/);
  await expect(paper(component)).not.toHaveClass(/is-arriving/);
});

test("the browser is really animating the element that carries the turn", async ({
  page,
  mount,
}) => {
  // A class that names a keyframes rule that doesn't exist is still a class,
  // and would pass every assertion above while nothing moved.
  const component = await mount(<PageTurnHarness />);
  await holdTheTurn(page);

  await component.getByRole("button", { name: "Next" }).click();
  expect(
    await leaf(component).evaluate((el) => el.getAnimations().map((a) => a.playState)),
  ).toEqual(["paused"]);

  // And it pivots on the spine rather than sliding: a page is bound at one edge.
  expect(await leaf(component).evaluate((el) => getComputedStyle(el).transformOrigin)).toMatch(
    /^0px /,
  );
});

test("the copy is cleared away once the page has settled", async ({ mount }) => {
  // Not held: this is the one test about the turn ending. A copy left behind
  // sits over the live page, and the reader is looking at the previous page
  // with no way to tell.
  const component = await mount(<PageTurnHarness />);

  await component.getByRole("button", { name: "Next" }).click();
  await expect(leaf(component)).toHaveCount(1);
  await expect(leaf(component)).toHaveCount(0);

  // Turning back leaves the copy standing still, so its removal is driven by
  // the live page's animation instead — a separate path, and worth its own go.
  await component.getByRole("button", { name: "Back" }).click();
  await expect(leaf(component)).toHaveCount(1);
  await expect(leaf(component)).toHaveCount(0);
  await expect(paper(component)).not.toHaveClass(/is-arriving/);
});

test("turning again mid-turn replaces the copy rather than stacking copies", async ({
  page,
  mount,
}) => {
  const component = await mount(<PageTurnHarness />);
  await holdTheTurn(page);

  await component.getByRole("button", { name: "Next" }).click();
  await component.getByRole("button", { name: "Next" }).click();
  await component.getByRole("button", { name: "Next" }).click();

  await expect(leaf(component)).toHaveCount(1);
  // Copied from the page that was on screen a moment ago, not from the page
  // the first tap started at — taps outrun React's commits, and the turn is
  // meant to track what was actually being looked at.
  await expect(leaf(component).getByTestId("prose")).toHaveText("Page 7 of the fixture.");
  await expect(paper(component).getByTestId("prose")).toHaveText("Page 8 of the fixture.");
});

test("staying on the same page turns nothing", async ({ page, mount }) => {
  const component = await mount(<PageTurnHarness />);
  await holdTheTurn(page);

  await component.getByRole("button", { name: "Stay" }).click();

  await expect(leaf(component)).toHaveCount(0);
  await expect(paper(component).getByTestId("prose")).toHaveText("Page 5 of the fixture.");
});

test("a reader who asked for less motion gets the page without the turn", async ({
  page,
  mount,
}) => {
  // `page.emulateMedia` rather than `test.use({ reducedMotion })`: the
  // component runner mounts into a page it keeps for the whole worker, and the
  // context-level option never reaches `matchMedia` there — a version of this
  // test written the shorter way passed while the preference did nothing.
  await page.emulateMedia({ reducedMotion: "reduce" });
  try {
    const component = await mount(<PageTurnHarness />);
    await component.getByRole("button", { name: "Next" }).click();

    // No copy is made at all, rather than one that animates instantly.
    await expect(leaf(component)).toHaveCount(0);
    await expect(paper(component)).not.toHaveClass(/is-arriving/);
    await expect(paper(component).getByTestId("prose")).toHaveText("Page 6 of the fixture.");
  } finally {
    // The page outlives this test, so the preference must not.
    await page.emulateMedia({ reducedMotion: null });
  }
});
