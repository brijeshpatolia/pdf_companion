/**
 * How good is retrieval?
 *
 * Until now the honest answer was that nobody knew. Retrieval either felt
 * right or it didn't, and every change to chunking, page size or the embedding
 * model was made on the strength of an anecdote. These are the standard
 * information-retrieval measures, kept pure so the harness that produces the
 * numbers is separable from the arithmetic that interprets them.
 *
 * The unit of relevance is a *page*, because that is what the app retrieves
 * and what it cites: `match_chunks` returns pages, and an answer links to one.
 */

export interface Judged {
  /** Pages the retriever returned, best first. */
  retrieved: number[];
  /** Pages that genuinely answer the question. */
  relevant: number[];
}

/**
 * Did anything useful reach the top k?
 *
 * The measure that matters most for this product. A reader asks one question
 * and gets one answer built from a handful of pages — so what counts is
 * whether the passage was in front of the model at all, not how many of its
 * neighbours came too.
 */
export function hitAtK({ retrieved, relevant }: Judged, k: number): boolean {
  if (relevant.length === 0) return false;
  const top = retrieved.slice(0, Math.max(0, k));
  return top.some((page) => relevant.includes(page));
}

/** The share of the relevant pages that reached the top k. */
export function recallAtK({ retrieved, relevant }: Judged, k: number): number {
  if (relevant.length === 0) return 0;
  const top = new Set(retrieved.slice(0, Math.max(0, k)));
  const found = relevant.filter((page) => top.has(page)).length;
  return found / relevant.length;
}

/**
 * 1/rank of the first relevant page, or 0 if none was retrieved at all.
 *
 * Unlike hit rate this is sensitive to *where* the passage landed, which is
 * what separates "retrieval works" from "retrieval works and the right page is
 * usually first".
 */
export function reciprocalRank({ retrieved, relevant }: Judged): number {
  const rank = retrieved.findIndex((page) => relevant.includes(page));
  return rank === -1 ? 0 : 1 / (rank + 1);
}

export interface CutoffReport {
  k: number;
  hitRate: number;
  recall: number;
}

export interface EvalReport {
  questions: number;
  cutoffs: CutoffReport[];
  mrr: number;
}

const mean = (xs: number[]) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);

export function summarise(judged: Judged[], ks: number[]): EvalReport {
  return {
    questions: judged.length,
    cutoffs: ks.map((k) => ({
      k,
      hitRate: mean(judged.map((j) => (hitAtK(j, k) ? 1 : 0))),
      recall: mean(judged.map((j) => recallAtK(j, k))),
    })),
    mrr: mean(judged.map(reciprocalRank)),
  };
}
