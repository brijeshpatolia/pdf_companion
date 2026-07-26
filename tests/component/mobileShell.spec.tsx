import { test, expect } from "@playwright/experimental-ct-react";
import MobileShellHarness from "./MobileShellHarness.js";

/**
 * The app's navigation, on a phone.
 *
 * The rail used to sit after the main column in normal flow. Every page under
 * the shell is at least `100dvh` tall, so the bar landed exactly one viewport
 * below the fold: on a short library there was no visible way to reach Free,
 * Ask or Usage at all. Nothing caught it, because a full-page screenshot
 * captures the whole document and the bar looks present in one.
 *
 * So the assertion is deliberately about the viewport, not the document.
 */
test.use({ viewport: { width: 393, height: 852 } });

test("the nav bar is reachable without scrolling", async ({ page, mount }) => {
  await mount(<MobileShellHarness />);
  const rail = page.locator(".app-rail");

  const box = (await rail.boundingBox())!;
  const viewport = page.viewportSize()!;

  expect(box.y).toBeLessThan(viewport.height);
  expect(box.y + box.height).toBeGreaterThan(0);
  // Along the bottom, not floating somewhere in the middle of the page.
  expect(box.y).toBeGreaterThan(viewport.height / 2);
  await expect(rail).toBeInViewport();
});

test("the page reserves room for the bar it floats over", async ({ page, mount }) => {
  const component = await mount(<MobileShellHarness />);
  await page.mouse.wheel(0, 20000);
  await page.waitForTimeout(200);

  // The last line of a screen must not end up underneath the fixed bar.
  const last = (await component.getByTestId("last").boundingBox())!;
  const rail = (await page.locator(".app-rail").boundingBox())!;
  expect(last.y + last.height).toBeLessThanOrEqual(rail.y);
});

test("nothing scrolls sideways at phone width", async ({ page, mount }) => {
  await mount(<MobileShellHarness />);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});
