import { defineConfig } from "vitest/config";

/**
 * The retrieval eval, kept separate from the unit suite.
 *
 * It downloads the embedding model and embeds a whole book, so it wants the
 * network and about a minute — neither of which belongs in the run that gates
 * a deploy. `npm run eval` when you have changed something that could move
 * retrieval: pagination, the embedding model, the page size.
 */
export default defineConfig({
  test: {
    globals: true,
    include: ["src/**/*.eval.ts"],
    // One test that embeds ~140 pages, plus a cold model download.
    testTimeout: 600_000,
    hookTimeout: 600_000,
  },
});
