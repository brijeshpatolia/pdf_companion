import { test, expect } from "vitest";
import { createLocalEmbedder, PRODUCTION_PRECISION } from "../../adapters/embedder/localEmbedder.js";
import { loadCorpus } from "./corpus.js";

/**
 * Is the same text always the same vector?
 *
 * It should be a silly question. An embedding is a pure function of its input,
 * and everything downstream assumes so: a page embedded at ingestion is
 * compared against a question embedded months later, and cosine similarity
 * between them only means anything if both are what the model would produce.
 *
 * It is not a silly question here. This was found by the retrieval eval
 * refusing to give the same answer twice — hit@1 moving six points between
 * identical runs — and it traces to the quantized weights the app ships in
 * order to fit a serverless memory limit. int8 inference in this stack is
 * intermittently wrong: usually the vector is right, occasionally it is barely
 * related to the one the same text produced a moment earlier.
 *
 * The consequence in production is quiet and permanent. A page embedded on a
 * bad pass is stored with a vector that means nothing, and that page is then
 * unfindable for the life of the book — no error, no retry, nothing to see. A
 * question embedded on a bad pass simply retrieves the wrong pages once.
 */

const REPEATS = 12;
/** Anything below this is not the same vector by any useful definition. */
const SAME = 0.9999;

const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i]!, 0);

async function drift(precision: "q8" | "fp32", samples: string[]) {
  const embed = createLocalEmbedder(precision);
  const reference = await embed.embed(samples);

  const similarities: number[] = [];
  for (let i = 0; i < REPEATS; i++) {
    const again = await embed.embed(samples);
    for (let j = 0; j < samples.length; j++) {
      similarities.push(dot(reference[j]!, again[j]!));
    }
  }

  const sorted = [...similarities].sort((a, b) => a - b);
  const below = (threshold: number) => similarities.filter((s) => s < threshold).length;
  return {
    total: similarities.length,
    worst: sorted[0]!,
    median: sorted[Math.floor(sorted.length / 2)]!,
    // Three thresholds, because "not identical" and "not the same vector" are
    // very different complaints and the difference decides how much this
    // matters. Drift at the fourth decimal is noise; 0.9 is a different page.
    drifted: below(SAME),
    degraded: below(0.99),
    wrong: below(0.9),
  };
}

test("the same text embeds to the same vector", { timeout: 900_000 }, async () => {
  // Real pages, not toy strings — the length of the input is part of what is
  // being exercised.
  const samples = loadCorpus().pages.slice(0, 3);

  const quantized = await drift("q8", samples);
  const full = await drift("fp32", samples);

  console.log(
    [
      "",
      "  Embedding stability — same text, embedded repeatedly",
      `  ${quantized.total} comparisons per precision`,
      "",
      "  precision      median    worst   not-identical   <0.99    <0.9",
      `  q8 (ships)    ${quantized.median.toFixed(4)}   ${quantized.worst.toFixed(4)}   ${String(quantized.drifted).padStart(9)}/${quantized.total}   ${String(quantized.degraded).padStart(5)}   ${String(quantized.wrong).padStart(5)}`,
      `  fp32          ${full.median.toFixed(4)}   ${full.worst.toFixed(4)}   ${String(full.drifted).padStart(9)}/${full.total}   ${String(full.degraded).padStart(5)}   ${String(full.wrong).padStart(5)}`,
      "",
    ].join("\n"),
  );

  // fp32 is the control, and it is what makes this a bug report rather than a
  // complaint about floating point: the same graph at full precision is exact.
  expect(full.worst, "fp32 should be exactly reproducible").toBeGreaterThan(SAME);

  // Deliberately asserted against the *known* broken behaviour rather than the
  // behaviour we want. Flipping this to `toBeGreaterThan(SAME)` is the check to
  // make once q8 is either fixed upstream or abandoned; until then, a passing
  // assertion here would be a lie about what ships.
  expect(
    PRODUCTION_PRECISION,
    "production precision changed — revisit this test's expectations",
  ).toBe("q8");
  expect(
    quantized.drifted,
    "q8 has become stable — good news; tighten this test",
  ).toBeGreaterThan(0);
});
