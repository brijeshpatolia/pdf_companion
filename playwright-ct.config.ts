import { defineConfig, devices } from "@playwright/experimental-ct-react";
import { fileURLToPath } from "node:url";

/**
 * Component tests, in a real browser.
 *
 * These exist for behaviour that only *is* behaviour in a browser: text
 * selection, event order, whether a click is dispatched at all. jsdom models
 * none of that, so the reader's selection popover shipped broken twice before
 * anything noticed — once because the browser's own menu covered ours, and
 * once because clearing the selection made the popover unmount between
 * mouseup and click, so no action ever fired.
 *
 * Component tests rather than end-to-end: the reader needs Supabase, a stored
 * book and a rendered PDF before you can select anything in it, none of which
 * belongs in a test of event plumbing. Mounting the component directly keeps
 * the test about the thing that broke, and keeps the harness out of the app —
 * there is no test-only route shipped to production.
 */
export default defineConfig({
  testDir: "./tests/component",
  snapshotDir: "./tests/component/__snapshots__",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // In CI the run is also written out as a report, so a failure arrives with
  // the trace of the retry attached rather than just a line of text.
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }]]
    : [["line"]],
  use: {
    trace: "on-first-retry",
    ctViteConfig: {
      resolve: {
        alias: {
          "@": fileURLToPath(new URL("./src", import.meta.url)),
        },
      },
    },
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          // Set when the sandbox already has a Chromium that Playwright's own
          // version pin doesn't match. CI installs the matching build instead.
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
        },
      },
    },
  ],
});
