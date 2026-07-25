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
let instance: FeatureExtractionPipeline | null = null;

async function getEmbedder(): Promise<FeatureExtractionPipeline> {
  if (!instance) {
    instance = await pipeline("feature-extraction", MODEL_ID, {
      dtype: "q8",
    }) as FeatureExtractionPipeline;
  }
  return instance;
}

export function createLocalEmbedder(): EmbedderPort {
  return {
    async embed(texts: string[]): Promise<number[][]> {
      const embedder = await getEmbedder();
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
  const embedder = await getEmbedder();
  const output = await embedder(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}
