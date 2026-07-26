import { defineConfig, devices } from "@playwright/test";

/**
 * Whole-page tests, against a running app.
 *
 * These complement the component tests: those mount one component in
 * isolation, these load the real routes and assert on how the page as a whole
 * behaves at a given size. That distinction matters, because the layout bugs
 * this suite exists to catch were never in a component — they were in how a
 * component's CSS interacted with the shell around it.
 *
 * The dev server runs with no Supabase credentials, which is deliberate:
 * `middleware.ts` doesn't gate anything when auth isn't configured, so every
 * route is reachable without standing up a database. Routes whose *server*
 * component needs Supabase (the reader, the share page) can't be reached this
 * way and are covered by component tests instead.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["line"]],
  use: {
    baseURL: "http://127.0.0.1:3212",
    trace: "on-first-retry",
    launchOptions: {
      // Set when the sandbox has a Chromium that Playwright's version pin
      // doesn't match. CI installs the matching build instead.
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
    },
  },
  projects: [
    {
      // Compiles every route before the suite fans out, so no test pays the
      // dev server's first-build cost and fails on a timeout for it.
      name: "warm",
      testMatch: /warm\.setup\.ts/,
    },
    {
      name: "phone",
      dependencies: ["warm"],
      // A common Android viewport, and the one the layout bugs were reported
      // from. Testing at a real device size rather than a round number keeps
      // the assertions honest about what actually fits.
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    command: "npx next dev -p 3212",
    url: "http://127.0.0.1:3212/welcome",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      // Belt and braces: even if the developer has a .env.local, these tests
      // must run unauthenticated so every route is reachable.
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
    },
  },
});
