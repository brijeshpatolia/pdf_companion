import { test } from "vitest";
import { env, pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { paginateChapters } from "../epub/paginate.js";
import { rank } from "./corpus.js";
import { GOLDENS } from "./goldens.js";
import { summarise, type Judged } from "./metrics.js";

/**
 * The comparison the eval exists to make possible.
 *
 * A single number says retrieval is weak. It doesn't say what to change. This
 * sweeps the two levers that cost nothing to pull — the embedding model, and
 * how much text goes into one page — and prints them side by side.
 *
 * Both candidates below produce 384-dimensional vectors, which is not a
 * coincidence: `chunks.embedding` is `vector(384)`, so a model of that width
 * is a drop-in, and a wider one is a schema migration and a re-ingestion of
 * every book anyone owns.
 *
 * Run with `npm run eval:sweep`. Slow — it embeds the corpus once per
 * combination.
 */

env.cacheDir = process.env.TRANSFORMERS_CACHE ?? "/tmp/transformers-cache";

const MODELS = [
  // What shipped before 2026-08-01.
  { id: "Xenova/all-MiniLM-L6-v2", queryPrefix: "", weightsMb: 23 },
  // What ships now. Trained for retrieval rather than general similarity, and
  // asks for a prefix on the query side so questions and passages land in the
  // same space.
  {
    id: "Xenova/bge-small-en-v1.5",
    queryPrefix: "Represent this sentence for searching relevant passages: ",
    weightsMb: 32,
  },
  /*
   * Qwen3-Embedding-0.6B, top of the open-weight MTEB leaderboards and the
   * obvious thing to reach for. Included to be measured rather than assumed —
   * but note the weights column: 585 MB quantized against bge-small's 32.
   *
   * That is the deciding number here regardless of accuracy. Embedding runs
   * *inside* the serverless function, so those megabytes are downloaded on
   * every cold start, into a 60-second budget shared with the work itself. It
   * would only become viable by moving embedding out of the request path
   * altogether, which is a different architecture, not a config change.
   *
   * Its native width is 1024; MRL truncation to 384 keeps the existing column,
   * at some cost to quality. Both are measured below.
   */
  {
    id: "onnx-community/Qwen3-Embedding-0.6B-ONNX",
    queryPrefix: "Instruct: Given a web search query, retrieve relevant passages that answer the query\nQuery: ",
    weightsMb: 585,
    truncateTo: 384,
    // Qwen3-Embedding is a decoder: it is trained so the *final* token carries
    // the sequence representation. Mean-pooling it — which is right for the
    // two encoders above — scores it below MiniLM, and that number says
    // nothing about the model.
    pooling: "last" as const,
  },
];

/** 1800 is production. The rest ask whether a page is simply too much text. */
const PAGE_SIZES = process.env.EVAL_PAGE_SIZES
  ? process.env.EVAL_PAGE_SIZES.split(",").map(Number)
  : [1800, 1200, 800, 500];

const FIXTURE = join(process.cwd(), "src/core/eval/__fixtures__/meditations.txt");
const CHAPTER_BREAK = /\n\n(?=THE \w+ BOOK\b)/;

/**
 * Golden pages are numbered against production's 1800-char pagination, so a
 * different page size has to be scored by *text*: a retrieved page counts if
 * it overlaps the labelled passage. Re-labelling by hand for every page size
 * would be the alternative, and would make the comparison unrepeatable.
 */
function overlapJudge(
  retrievedTexts: string[],
  goldenTexts: string[],
): boolean[] {
  return retrievedTexts.map((text) =>
    goldenTexts.some((golden) => shareASentence(text, golden)),
  );
}

/** Cheap containment test: do these two passages share a distinctive run of words? */
function shareASentence(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]+/g, " ").replace(/\s+/g, " ").trim();
  const shorter = norm(a).length <= norm(b).length ? norm(a) : norm(b);
  const longer = norm(a).length <= norm(b).length ? norm(b) : norm(a);
  const words = shorter.split(" ");
  // A 12-word run appearing in both means one page is part of the other's text.
  for (let i = 0; i + 12 <= words.length; i += 6) {
    if (longer.includes(words.slice(i, i + 12).join(" "))) return true;
  }
  return false;
}

async function embedderFor(
  modelId: string,
  truncateTo?: number,
  pooling: "mean" | "last" = "mean",
) {
  // fp32 for the same reason the retrieval eval uses it: a comparison drawn
  // from a non-reproducible measurement is not a comparison.
  const pipe = (await pipeline("feature-extraction", modelId, {
    dtype: "fp32",
  })) as FeatureExtractionPipeline;
  return async (texts: string[]): Promise<number[][]> => {
    const out: number[][] = [];
    for (const text of texts) {
      let v: number[];
      if (pooling === "last") {
        // [1, tokens, dim] — take the final token's row.
        const r = await pipe(text, { pooling: "none", normalize: false });
        const dims = r.dims as number[];
        const dim = dims[dims.length - 1]!;
        const tokens = dims[dims.length - 2]!;
        const all = r.data as Float32Array;
        v = Array.from(all.slice((tokens - 1) * dim, tokens * dim));
        const n0 = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
        v = v.map((x) => x / n0);
      } else {
        const r = await pipe(text, { pooling: "mean", normalize: true });
        v = Array.from(r.data as Float32Array);
      }
      if (truncateTo && v.length > truncateTo) {
        // Matryoshka: the first N dimensions are trained to stand alone, but
        // truncating denormalises, so the vector has to be re-normalised for
        // cosine to mean what it means everywhere else here.
        v = v.slice(0, truncateTo);
        const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
        v = v.map((x) => x / n);
      }
      out.push(v);
    }
    return out;
  };
}

test("which model and page size retrieve best", { timeout: 3_600_000 }, async () => {
  const raw = readFileSync(FIXTURE, "utf8");
  const chapters = raw.split(CHAPTER_BREAK);

  // The labelled passages, as text, taken from production's pagination.
  const productionPages = paginateChapters(chapters, 1800);
  const goldenTexts = GOLDENS.map((g) => g.pages.map((p) => productionPages[p - 1] ?? ""));

  const rows: string[] = [];
  for (const model of MODELS) {
    const embed = await embedderFor(model.id, model.truncateTo, model.pooling);
    const queries = await embed(GOLDENS.map((g) => model.queryPrefix + g.question));

    for (const size of PAGE_SIZES) {
      const pages = paginateChapters(chapters, size);
      const pageEmbeddings = await embed(pages);

      const judged: Judged[] = GOLDENS.map((_, i) => {
        const top = rank(queries[i]!, pageEmbeddings, 10);
        const good = overlapJudge(
          top.map((p) => pages[p - 1]!),
          goldenTexts[i]!,
        );
        // Re-expressed as page numbers so the shared metrics apply unchanged:
        // "relevant" is whichever of the returned pages overlapped the label.
        // Note this makes `relevant` a subset of `retrieved`, so *recall* is
        // meaningless here and is not reported — only hit rate and MRR, which
        // depend on whether and where a good page appeared.
        return {
          retrieved: top,
          relevant: top.filter((_, j) => good[j]),
        };
      });

      const report = summarise(judged, [1, 5, 10]);
      const at = (k: number) => report.cutoffs.find((c) => c.k === k)!.hitRate;
      rows.push(
        `  ${model.id.replace("Xenova/", "").padEnd(20)} ${String(size).padStart(5)}` +
          `   ${(at(1) * 100).toFixed(1).padStart(5)}%` +
          `   ${(at(5) * 100).toFixed(1).padStart(5)}%` +
          `   ${(at(10) * 100).toFixed(1).padStart(5)}%` +
          `   ${report.mrr.toFixed(3)}   (${pages.length} pages, ${model.weightsMb} MB)`,
      );
      console.log(rows[rows.length - 1]);
    }
  }

  console.log(
    ["", "  model                page chars    hit@1    hit@5   hit@10     MRR", ...rows, ""].join("\n"),
  );
});
