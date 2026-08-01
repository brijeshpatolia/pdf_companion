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
 * It has not always been one here, and the history is the reason this file
 * exists rather than a claim it still makes. The retrieval eval was once
 * unable to give the same answer twice — hit@1 moving six points between
 * identical runs — and int8 embeddings were caught coming back at cosine 0.237,
 * 0.14, and once 15 of 36 comparisons drifting at all. Those were real
 * measurements.
 *
 * They have not reproduced since, across several hundred comparisons in both
 * vitest and plain node, at q8 and fp32, with and without other work
 * interleaved. Every observation of the fault came from a window when large
 * models were also being downloaded and loaded, which points at memory
 * pressure rather than at quantization as such — but that is a hypothesis, not
 * a finding, and an intermittent fault that cannot be reproduced also cannot
 * be verified fixed.
 *
 * So this measures and reports rather than asserting a fault. If it ever comes
 * back the number below says so, which is the most that can honestly be
 * claimed. What is at stake if it does: a page embedded on a bad pass is
 * stored with a vector that means nothing and is unfindable for the life of
 * the book — no error, no retry, nothing to see.
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

  /*
   * Asserted on what production actually ships, in the direction we want it to
   * hold. An earlier version of this test asserted the *fault* — that q8 must
   * drift — which inverted the point of a test: it went red the moment the
   * thing it was watching started behaving.
   */
  expect(PRODUCTION_PRECISION, "if this changes, re-measure before trusting the number above").toBe(
    "q8",
  );
  expect(
    quantized.wrong,
    "an embedding came back unrelated to the same text — the intermittent fault is back",
  ).toBe(0);
});
