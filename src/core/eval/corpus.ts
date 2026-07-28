import { readFileSync } from "node:fs";
import { join } from "node:path";
import { paginateChapters } from "../epub/paginate.js";

/**
 * The book the eval runs against, paginated exactly as production would.
 *
 * Deliberately the app's own `paginateChapters` rather than a splitter written
 * for the harness. The pages this yields are the pages the ingester would
 * embed and the reader would show, so a change to pagination shows up in the
 * retrieval number — which is the whole reason to have the number.
 */

const FIXTURE = join(process.cwd(), "src/core/eval/__fixtures__/meditations.txt");

/** Each of the seven books is a chapter, and a page never spans two. */
const CHAPTER_BREAK = /\n\n(?=THE \w+ BOOK\b)/;

export interface Corpus {
  /** Page text, indexed from 0; page *numbers* are these positions plus one. */
  pages: string[];
  title: string;
}

export function loadCorpus(): Corpus {
  const raw = readFileSync(FIXTURE, "utf8");
  return {
    pages: paginateChapters(raw.split(CHAPTER_BREAK)),
    title: "Meditations, Books I–VII (Casaubon translation)",
  };
}

/**
 * Cosine similarity of two embeddings.
 *
 * The embedder normalises its output, so this is a dot product — and the same
 * ordering Postgres produces with `1 - (embedding <=> query)`. It is repeated
 * here rather than reached for through the database because the harness is
 * measuring the *embeddings*, and standing up pgvector to sort a list of 137
 * numbers would only add a reason for the eval not to run.
 */
export function cosine(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i]! * b[i]!;
  return sum;
}

/** Page numbers, best first, for one query embedding. */
export function rank(queryEmbedding: number[], pageEmbeddings: number[][], limit: number): number[] {
  return pageEmbeddings
    .map((embedding, i) => ({ page: i + 1, score: cosine(queryEmbedding, embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((hit) => hit.page);
}
