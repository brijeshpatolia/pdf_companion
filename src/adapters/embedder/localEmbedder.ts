import { env, pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";
import type { EmbedderPort } from "../../core/ingestion/types.js";

const MODEL_ID = "Xenova/all-MiniLM-L6-v2";

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

export async function embedSingle(text: string): Promise<number[]> {
  const embedder = await getEmbedder(PRODUCTION_PRECISION);
  const output = await embedder(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}
