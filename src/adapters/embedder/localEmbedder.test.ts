import { describe, it, expect } from "vitest";
import { createLocalEmbedder, embedSingle } from "./localEmbedder.js";

function cosine(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

describe("localEmbedder", () => {
  it("produces 384-dimensional vectors", async () => {
    const embedder = createLocalEmbedder();
    const [vec] = await embedder.embed(["The soul is immortal."]);
    expect(vec).toBeDefined();
    expect(vec!.length).toBe(384);
  }, 60_000);

  it("similar texts have higher cosine similarity than dissimilar", async () => {
    const a = await embedSingle("The theory of forms in Plato's philosophy");
    const b = await embedSingle("Plato argued that abstract forms are more real than physical objects");
    const c = await embedSingle("The weather forecast calls for rain tomorrow");

    const simAB = cosine(a, b);
    const simAC = cosine(a, c);

    expect(simAB).toBeGreaterThan(simAC);
    expect(simAB).toBeGreaterThan(0.5);
  }, 60_000);

  it("batch embed returns one vector per input", async () => {
    const embedder = createLocalEmbedder();
    const vecs = await embedder.embed(["Hello", "World", "Test"]);
    expect(vecs.length).toBe(3);
    for (const v of vecs) {
      expect(v.length).toBe(384);
    }
  }, 60_000);
});
