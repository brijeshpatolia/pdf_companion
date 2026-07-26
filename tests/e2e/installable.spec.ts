import { test, expect } from "@playwright/test";

/**
 * The pieces that let this be added to a home screen.
 *
 * Each of these is a single line somewhere that, if it goes missing, breaks
 * installing the app without breaking anything you'd notice in a browser —
 * which is exactly the kind of thing that rots quietly.
 *
 * The service worker itself isn't asserted here: it only registers in a
 * production build, and this suite runs against `next dev` on purpose so every
 * route is reachable without a database.
 */

test("the manifest describes an installable app", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.status()).toBe(200);

  const manifest = await res.json();
  expect(manifest.name).toBeTruthy();
  // Anything longer is truncated under a launcher icon.
  expect(manifest.short_name.length).toBeLessThanOrEqual(12);
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toBe("/");

  const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
  expect(sizes).toContain("192x192");
  expect(sizes).toContain("512x512");
  // Android crops icons to the launcher's shape; without a maskable one it
  // crops the square art and clips the corners off.
  expect(manifest.icons.some((i: { purpose: string }) => i.purpose === "maskable")).toBe(true);
});

test("every icon the manifest promises actually exists", async ({ request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  for (const icon of manifest.icons as { src: string }[]) {
    const res = await request.get(icon.src);
    expect(res.status(), `${icon.src} is missing`).toBe(200);
    expect(res.headers()["content-type"]).toContain("image/png");
  }
  expect((await request.get("/apple-icon.png")).status()).toBe(200);
});

test("the manifest and service worker are reachable without signing in", async ({ request }) => {
  // The browser fetches both with no session in mind. A redirect to the login
  // page in place of either one breaks installing, silently.
  for (const path of ["/manifest.webmanifest", "/sw.js"]) {
    const res = await request.get(path, { maxRedirects: 0 });
    expect(res.status(), `${path} redirected instead of serving`).toBe(200);
  }
});

test("the page opts into the safe area", async ({ page }) => {
  await page.goto("/welcome");
  const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");

  // Without `viewport-fit=cover`, `env(safe-area-inset-*)` is always zero —
  // and the nav bar is fixed to the bottom of the screen and pads itself with
  // that inset, so it would sit under the home indicator.
  expect(viewport).toContain("viewport-fit=cover");

  await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#141312");
});

test("the offline page says something true", async ({ page }) => {
  await page.goto("/offline");
  await expect(page.getByRole("heading", { name: "No connection" })).toBeVisible();
  // It must not imply anything was lost — the books are on a server, that's all.
  await expect(page.getByText(/nothing you've kept is lost/i)).toBeVisible();
});
