import { test as setup, expect } from "@playwright/test";

/**
 * Compiles every route once before the suite fans out.
 *
 * These tests run against `next dev`, which builds a route the first time it's
 * asked for. With tests running in parallel that cost lands on whichever test
 * happens to be first, and on a cold `.next` it can take tens of seconds — so
 * a test fails on a timeout that has nothing to do with what it's checking.
 *
 * Paying it once, up front, in a step that is allowed to be slow. This is a
 * warm-up, not an assertion: a route that is briefly unhappy while the server
 * is still starting gets another go, and the real tests are what decide
 * whether the app works.
 */
const ROUTES = [
  "/welcome",
  "/login",
  "/",
  "/catalog",
  "/ask",
  "/usage",
  "/offline",
  "/reader/warm/flashcards",
];

const ATTEMPTS = 5;

setup("warm the routes", async ({ request }) => {
  setup.setTimeout(300_000);

  const cold: string[] = [];
  for (const route of ROUTES) {
    let status = 0;
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      status = (await request.get(route)).status();
      if (status < 500) break;
      await new Promise((r) => setTimeout(r, 2000));
    }
    if (status >= 500) cold.push(`${route} → ${status}`);
  }

  // Every route failing means something is actually wrong, not slow.
  expect(cold, "routes never compiled").toEqual([]);
});
