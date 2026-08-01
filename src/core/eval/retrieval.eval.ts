import { test, expect } from "vitest";
import { AutoTokenizer } from "@huggingface/transformers";
import { createLocalEmbedder, MODEL_ID, QUERY_PREFIX } from "../../adapters/embedder/localEmbedder.js";
import { loadCorpus, rank } from "./corpus.js";
import { GOLDENS } from "./goldens.js";
import { summarise, hitAtK, reciprocalRank, type Judged } from "./metrics.js";

/**
 * Does retrieval actually work?
 *
 * Run with `npm run eval`. Kept out of `npm test` on purpose: it downloads the
 * embedding model and embeds the whole corpus, so it needs the network and
 * about a minute. Putting that in the CI critical path would mean a deployment
 * can fail because Hugging Face is having a bad afternoon.
 *
 * What it measures is the *embedding and pagination* — the part where the
 * quality actually lives. It does not go through pgvector, and the difference
 * is worth being honest about in both directions: ivfflat is an approximate
 * index, so live recall can only be equal to or worse than this, and the
 * production `max_page` spoiler filter shrinks the candidate set, which can
 * only help. This number is the ceiling, measured exactly.
 */

const CUTOFFS = [1, 3, 5, 10];
/** What the reader's chat actually asks for. */
const PRODUCTION_K = 5;

/** The model's context. Anything past this is silently dropped before embedding. */
const MODEL_TOKEN_LIMIT = 512;

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

test("retrieval finds the page that answers the question", { timeout: 600_000 }, async () => {
  const corpus = loadCorpus();
  // fp32, while production ships q8. Not because q8 is known bad — it measures
  // clean now — but because a benchmark should not be able to move for reasons
  // unrelated to what it claims to measure, and int8 was once caught doing
  // exactly that. `embedding.eval.ts` watches that separately.
  const embedder = createLocalEmbedder("fp32");

  const pageEmbeddings = await embedder.embed(corpus.pages);
  // Prefixed exactly as `embedSingle` prefixes a real question, so the eval
  // measures the asymmetry production actually uses rather than a fairer or
  // kinder version of it.
  const queryEmbeddings = await embedder.embed(
    GOLDENS.map((g) => QUERY_PREFIX + g.question),
  );

  const judged: Judged[] = GOLDENS.map((golden, i) => ({
    retrieved: rank(queryEmbeddings[i]!, pageEmbeddings, Math.max(...CUTOFFS)),
    relevant: golden.pages,
  }));

  const report = summarise(judged, CUTOFFS);

  const lines: string[] = [
    "",
    `Retrieval eval — ${corpus.title}`,
    `${corpus.pages.length} pages · ${GOLDENS.length} hand-labelled questions`,
    `${MODEL_ID}`,
    "",
    "   k   hit rate    recall",
    ...report.cutoffs.map(
      (c) => `  ${String(c.k).padStart(2)}   ${pct(c.hitRate).padStart(7)}   ${pct(c.recall).padStart(7)}`,
    ),
    "",
    `  MRR  ${report.mrr.toFixed(3)}`,
    "",
  ];

  // The questions it gets wrong are the only part of this worth acting on.
  const missed = GOLDENS.map((golden, i) => ({ golden, j: judged[i]! }))
    .filter(({ j }) => !hitAtK(j, PRODUCTION_K))
    .map(({ golden, j }) => `  · "${golden.question}"\n      want ${golden.pages.join("/")}, got ${j.retrieved.slice(0, 5).join(", ")}`);

  lines.push(
    missed.length === 0
      ? `  Nothing missed at k=${PRODUCTION_K}.`
      : `  Missed at k=${PRODUCTION_K} (${missed.length}/${GOLDENS.length}):`,
    ...missed,
    "",
  );

  // Pages longer than the model's context are truncated before they are
  // embedded — the tail of such a page is not represented in its vector at
  // all, and cannot be retrieved by anything only that tail says. Reported
  // because ingestion embeds one vector per *page*, and a PDF page is whatever
  // length the PDF happens to have.
  const tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID);
  const tokenCounts = corpus.pages.map(
    (page) => (tokenizer.encode(page) as unknown[]).length,
  );
  const truncated = tokenCounts.filter((n) => n > MODEL_TOKEN_LIMIT).length;
  lines.push(
    `  Pages over the model's ${MODEL_TOKEN_LIMIT}-token context: ${truncated}/${corpus.pages.length}` +
      ` (longest ${Math.max(...tokenCounts)} tokens)`,
    "",
  );

  console.log(lines.join("\n"));

  /*
   * A floor, not a target — and derived from a measurement rather than a hope.
   * Measured 75.0% at k=5 on 2026-08-01: bge-small-en-v1.5, 1800-char pages,
   * fp32, query prefix applied. Deterministic, so the floor can sit close
   * underneath without flapping; it is here to make a change that wrecks
   * retrieval fail loudly rather than be noticed months later.
   *
   * It was 0.45 against MiniLM's 51.9%. Raised with the number, which is the
   * only honest direction for a floor to move — lowering one to make a run
   * pass is how an eval stops meaning anything.
   */
  const atProductionK = report.cutoffs.find((c) => c.k === PRODUCTION_K)!;
  expect(atProductionK.hitRate, `hit rate at k=${PRODUCTION_K} collapsed`).toBeGreaterThan(0.7);
});
