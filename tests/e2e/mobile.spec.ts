import { test, expect, type Page } from "@playwright/test";

/**
 * Every screen, at phone size.
 *
 * The nav bar once sat exactly one viewport below the fold, and the reader
 * stretched the document wider than the screen. Both shipped. Both were
 * invisible to the checks in place, because those were full-page screenshots —
 * which capture the whole document, so anything pushed past the viewport still
 * appears in them, looking fine.
 *
 * So these assert on the *viewport*: what fits on the screen, and what you can
 * reach without scrolling sideways.
 */

/** Routes reachable without a database. */
const SHELL_ROUTES = ["/", "/catalog", "/ask", "/usage"];
const BARE_ROUTES = ["/welcome", "/login"];

const books = [
  { id: "aa11", title: "The Republic", page_count: 879, status: "ready", current_page: 5 },
  {
    id: "cc33",
    title: "Critique of Pure Reason",
    page_count: 640,
    status: "processing",
    pages_done: 318,
  },
  { id: "ee55", title: "An Enquiry Concerning Human Understanding", page_count: 210, status: "failed" },
];

/**
 * The API is stubbed rather than seeded: these are layout tests, and a page
 * with rows in it exercises the layout that an empty one doesn't.
 */
async function stubApi(page: Page) {
  await page.route("**/api/books", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(books) }),
  );
  await page.route("**/api/catalog", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        source: "Project Gutenberg",
        books: [
          {
            id: "c1",
            title: "Meditations",
            author: "Marcus Aurelius",
            subject: "Philosophy",
            gutenbergId: 2680,
            description: "The private notebook of a Roman emperor, never meant for us.",
          },
          {
            id: "c2",
            title: "On the Origin of Species",
            author: "Charles Darwin",
            subject: "Science",
            gutenbergId: 1228,
            description: "The long argument, laid out slowly and with an almost apologetic care.",
          },
        ],
      }),
    }),
  );
  await page.route("**/api/catalog/search**", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ results: [], hasMore: false }) }),
  );
  await page.route("**/api/usage", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        totalCostUsd: 0.4137,
        totalTokensIn: 812_400,
        totalTokensOut: 96_210,
        chatCount: 148,
        byBook: [
          { bookId: "b1", title: "The Republic", costUsd: 0.17, tokensIn: 331000, tokensOut: 40100, count: 61 },
        ],
        byModel: [{ model: "claude-sonnet-4-5", costUsd: 0.39, count: 141 }],
        byDay: [
          { day: "2026-07-24", costUsd: 0.01 },
          { day: "2026-07-25", costUsd: 0.04 },
          { day: "2026-07-26", costUsd: 0.02 },
        ],
        budget: { dayUsd: 0.047, monthUsd: 0.41, dailyLimitUsd: 0.5, monthlyLimitUsd: 5 },
      }),
    }),
  );
  await page.route("**/api/flashcards**", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        cards: [
          { id: "1", front: "What does Plato mean by the Form of the Good?", back: "The source of intelligibility." },
        ],
      }),
    }),
  );
}

/** How far the document runs past the right edge of the screen. */
const overflowX = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/**
 * Any element whose box crosses the right edge. Reported by selector so a
 * failure names the thing to fix rather than just the page it's on.
 */
const spillingElements = (page: Page) =>
  page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      // A hidden overflow container clips its own children, so only the
      // outermost offender is worth reporting.
      if (r.right > width + 1) {
        const cls = el.className?.toString().trim().split(/\s+/)[0] ?? "";
        out.push(`${el.tagName.toLowerCase()}${cls ? "." + cls : ""} → ${Math.round(r.right)}px`);
      }
    }
    return out.slice(0, 8);
  });

for (const path of [...BARE_ROUTES, ...SHELL_ROUTES, "/reader/aa11/flashcards"]) {
  test(`${path} fits the screen`, async ({ page }) => {
    await stubApi(page);
    await page.goto(path);
    await page.waitForLoadState("networkidle");

    expect(await spillingElements(page), `${path} has elements past the right edge`).toEqual([]);
    expect(await overflowX(page), `${path} scrolls sideways`).toBe(0);
  });
}

for (const path of SHELL_ROUTES) {
  test(`${path} keeps the nav bar on screen`, async ({ page }) => {
    await stubApi(page);
    await page.goto(path);
    await page.waitForLoadState("networkidle");

    // Not `toBeVisible` — an element one viewport below the fold is "visible"
    // in the DOM sense. This is the check that was missing.
    await expect(page.locator(".app-rail")).toBeInViewport();

    // And every destination in it is actually tappable.
    const items = page.locator(".rail-item");
    await expect(items).toHaveCount(4);
    for (let i = 0; i < 4; i++) {
      const box = (await items.nth(i).boundingBox())!;
      expect(box.height, "nav items need a real tap target").toBeGreaterThanOrEqual(40);
    }
  });
}

test("the library shows a book's whole name", async ({ page }) => {
  await stubApi(page);
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // "The Republic" once rendered as "The R…" — the row's fixed columns left
  // the title as the only thing that could give.
  await expect(page.getByText("The Republic", { exact: true })).toBeVisible();
  await expect(page.getByText("Critique of Pure Reason", { exact: true })).toBeVisible();
});

test("controls are big enough to hit", async ({ page }) => {
  await stubApi(page);
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // Delete, Resume and Retry were 26px tall — comfortable under a mouse, a
  // miss under a thumb. 40 is the floor here; the guidelines say 44, and the
  // nav bar and primary actions clear that on their own.
  // Scoped to the app's own shell: the dev server injects its own overlay
  // button, and Playwright's locators pierce its shadow root.
  const app = page.locator(".rail-layout");
  const small: string[] = [];
  for (const control of await app.locator("button:visible, a.btn-primary:visible").all()) {
    const box = await control.boundingBox();
    if (box && box.height < 40) {
      small.push(`${(await control.textContent())?.trim() || "?"} (${Math.round(box.height)}px)`);
    }
  }
  expect(small, "controls under 40px tall").toEqual([]);
});
