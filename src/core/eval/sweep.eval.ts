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
  // What ships today.
  { id: "Xenova/all-MiniLM-L6-v2", queryPrefix: "" },
  // Trained for retrieval rather than general similarity, and asks for a
  // prefix on the query side so questions and passages land in the same space.
  {
    id: "Xenova/bge-small-en-v1.5",
    queryPrefix: "Represent this sentence for searching relevant passages: ",
  },
];

/** 1800 is production. The rest ask whether a page is simply too much text. */
const PAGE_SIZES = [1800, 1200, 800, 500];

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

async function embedderFor(modelId: string) {
  // fp32 for the same reason the retrieval eval uses it: a comparison drawn
  // from a non-reproducible measurement is not a comparison.
  const pipe = (await pipeline("feature-extraction", modelId, {
    dtype: "fp32",
  })) as FeatureExtractionPipeline;
  return async (texts: string[]): Promise<number[][]> => {
    const out: number[][] = [];
    for (const text of texts) {
      const r = await pipe(text, { pooling: "mean", normalize: true });
      out.push(Array.from(r.data as Float32Array));
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
    const embed = await embedderFor(model.id);
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
          `   ${report.mrr.toFixed(3)}   (${pages.length} pages)`,
      );
      console.log(rows[rows.length - 1]);
    }
  }

  console.log(
    ["", "  model                page chars    hit@1    hit@5   hit@10     MRR", ...rows, ""].join("\n"),
  );
});
