import { test, expect, type Page } from "@playwright/test";

/**
 * What the outside world can see.
 *
 * The whole site was `noindex`, set once in the root layout and inherited by
 * everything under it — including the landing page, which is the only surface
 * written to explain the product to someone who has never heard of it. It was
 * unfindable by construction.
 *
 * The half of that rule which was right is the half that is easy to break by
 * accident: a library is private, and a shared book is someone's reading
 * behind a link they chose who to give out. So this asserts both directions —
 * that the landing page is open, and that nothing else is.
 */

const meta = (page: Page, name: string) =>
  page.locator(`meta[name="${name}"]`).getAttribute("content");
const property = (page: Page, name: string) =>
  page.locator(`meta[property="${name}"]`).getAttribute("content");

test("the landing page can be found", async ({ page }) => {
  await page.goto("/welcome");

  const robots = (await meta(page, "robots")) ?? "";
  expect(robots, "the one page written for strangers must be indexable").toContain("index");
  expect(robots).not.toContain("noindex");

  // Pointing at itself on the real domain, so a preview deployment or an
  // alternate hostname doesn't become a second copy competing with it.
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://studiolo.test/welcome",
  );

  // Says what the thing is, in the words someone would use to look for it.
  const description = (await meta(page, "description")) ?? "";
  expect(description).toMatch(/reading companion/i);
  expect(description.length, "long enough to be useful, short enough to survive").toBeGreaterThan(
    70,
  );
  expect(description.length).toBeLessThan(320);
});

test("the link has a preview card", async ({ page }) => {
  // Worth more here than any amount of keyword work: this product gets found
  // because someone pastes the link into a chat, and this is what that chat
  // shows. Without it, a grey box and a hostname.
  await page.goto("/welcome");

  expect(await property(page, "og:title")).toContain("Studiolo");
  expect(await property(page, "og:type")).toBe("website");
  expect(await property(page, "og:description")).toBeTruthy();

  const image = await property(page, "og:image");
  expect(image, "no image means no card").toBeTruthy();
  // Absolute, because it is read by a crawler that arrived from elsewhere.
  // The host itself is deliberately not asserted: `next dev` resolves a
  // file-convention image against the request origin rather than
  // `metadataBase`, so pinning it here would only test the dev server.
  expect(image).toMatch(/^https?:\/\/[^/]+\/welcome\/opengraph-image/);
  expect(await property(page, "og:image:width")).toBe("1200");
  expect(await property(page, "og:image:height")).toBe("630");

  // A card that is announced but doesn't render is worse than none.
  const response = await page.request.get(new URL(image!).pathname + new URL(image!).search);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("image/png");
  const bytes = (await response.body()).length;
  expect(bytes, "a 1200x630 PNG that small is a blank one").toBeGreaterThan(5_000);

  expect(await meta(page, "twitter:card")).toBe("summary_large_image");
});

test("the app itself stays out of the index", async ({ page }) => {
  // The default the landing page opts out of. Everything else inherits it, and
  // a library is private by construction.
  await page.goto("/ask");
  expect(await meta(page, "robots")).toContain("noindex");
});

test("a private link stays out of the index", async ({ request }) => {
  // Someone's reading room, reachable by anyone holding the link and no one
  // else. Stated on the page rather than inherited, so that changing the
  // default can't quietly publish it — which is what this checks.
  //
  // Asserted against the served HTML rather than the rendered DOM: without a
  // database this route fails to render, and the point here is what a crawler
  // is *sent*, which it is either way.
  const html = await (await request.get("/room/aaaaaaaaaaaaaaaaaaaaaaaa")).text();

  const robots = [...html.matchAll(/<meta name="robots" content="([^"]*)"/g)].map((m) => m[1]!);
  expect(robots.length, "no robots directive at all").toBeGreaterThan(0);
  expect(robots.every((r) => r.includes("noindex"))).toBe(true);
  expect(robots.some((r) => r.includes("noarchive"))).toBe(true);
});

test("crawlers are told where to go and where not to", async ({ request }) => {
  const robots = await (await request.get("/robots.txt")).text();

  expect(robots).toContain("Allow: /welcome");
  // The private surfaces, by name.
  expect(robots).toContain("Disallow: /share/");
  expect(robots).toContain("Disallow: /room/");
  expect(robots).toContain("Disallow: /api/");
  expect(robots).toContain("Disallow: /reader/");

  // Not a blanket `Disallow: /` — whether a later `Allow` beats it depends on
  // the crawler, and the landing page is not worth betting on that. The root
  // redirects a visitor with no session to /welcome, so leaving it crawlable
  // is how a crawler arriving at the bare domain finds anything at all.
  expect(robots).not.toMatch(/^Disallow: \/$/m);

  expect(robots).toContain("Sitemap: https://studiolo.test/sitemap.xml");
});

test("the sitemap lists the page worth listing, and nothing private", async ({ request }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();

  expect(sitemap).toContain("<loc>https://studiolo.test/welcome</loc>");
  for (const secret of ["/share/", "/room/", "/reader/", "/usage"]) {
    expect(sitemap, `${secret} must not be advertised`).not.toContain(secret);
  }
});
