import { env, pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";
import type { EmbedderPort } from "../../core/ingestion/types.js";

/**
 * The embedding model, and the name written beside every vector it produces.
 *
 * Was `Xenova/all-MiniLM-L6-v2`. Measured on the retrieval eval, BGE finds the
 * page that answers a question far more often — hit@1 30.8% -> 50.0%, hit@5
 * 51.9% -> 75.0%, MRR 0.393 -> 0.601 — at the page size already in use, and it
 * is also 384-dimensional, so `chunks.embedding vector(384)` is untouched.
 *
 * Exported because it is stored: `chunks.embedding_model` records which model
 * made each row, and the ingester treats a page embedded by any other model as
 * not yet embedded.
 */
export const MODEL_ID = "Xenova/bge-small-en-v1.5";

/**
 * BGE is trained with an asymmetry: passages are embedded bare, questions are
 * embedded behind this instruction. Skipping it costs real accuracy, and using
 * it on the passage side costs some too — so it belongs on queries only, which
 * is why `embedSingle` (retrieval) applies it and `embed` (ingestion) does not.
 */
export const QUERY_PREFIX = "Represent this sentence for searching relevant passages: ";

// transformers.js caches downloaded model weights in a folder inside its own
// package directory. On serverless (Vercel/Lambda) the deployment tree at
// /var/task is read-only, so that mkdir fails with ENOENT and every embed dies.
// /tmp is the one writable location there, and works locally too.
env.cacheDir = process.env.TRANSFORMERS_CACHE ?? "/tmp/transformers-cache";

// Quantized (int8) weights: ~23 MB instead of ~90 MB for fp32. This keeps the
// model inside serverless memory limits (e.g. Vercel Hobby's 1 GB) with a small
// quality trade-off. Chunk and query embeddings share this loader, so they stay
// consistent — cosine similarity is unaffected by the shared precision choice.
export type EmbedderPrecision = "q8" | "fp32";

/** What ships: quantized, to fit inside a serverless memory limit. */
export const PRODUCTION_PRECISION: EmbedderPrecision = "q8";

const instances = new Map<EmbedderPrecision, Promise<FeatureExtractionPipeline>>();

async function getEmbedder(precision: EmbedderPrecision): Promise<FeatureExtractionPipeline> {
  let held = instances.get(precision);
  if (!held) {
    held = pipeline("feature-extraction", MODEL_ID, {
      dtype: precision,
    }) as Promise<FeatureExtractionPipeline>;
    instances.set(precision, held);
  }
  return held;
}

/**
 * `precision` exists for the retrieval eval, which needs a reproducible
 * number: int8 inference here is not deterministic — the same text embedded
 * twice can come back as a materially different vector — so a measurement
 * taken at q8 moves several points between identical runs. See
 * `src/core/eval/embedding.eval.ts`, which measures exactly that. Production
 * leaves this alone.
 */
export function createLocalEmbedder(
  precision: EmbedderPrecision = PRODUCTION_PRECISION,
): EmbedderPort {
  return {
    async embed(texts: string[]): Promise<number[][]> {
      const embedder = await getEmbedder(precision);
      const results: number[][] = [];

      for (const text of texts) {
        const output = await embedder(text, { pooling: "mean", normalize: true });
        results.push(Array.from(output.data as Float32Array));
      }

      return results;
    },
  };
}

/** Embeds a *question*, for searching against stored passages. */
export async function embedSingle(text: string): Promise<number[]> {
  const embedder = await getEmbedder(PRODUCTION_PRECISION);
  const output = await embedder(QUERY_PREFIX + text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}
