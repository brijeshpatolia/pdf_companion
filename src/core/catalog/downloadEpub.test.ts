import { describe, it, expect } from "vitest";
import { downloadEpubBytes } from "./downloadEpub.js";
import type { FetchResponseLike } from "./downloadEpub.js";

const PK = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);

function response(overrides: Partial<FetchResponseLike> & { body?: Uint8Array }): FetchResponseLike {
  const body = overrides.body ?? PK;
  return {
    ok: overrides.ok ?? true,
    status: overrides.status ?? 200,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "content-type"
          ? "application/epub+zip"
          : name.toLowerCase() === "content-length"
            ? String(body.length)
            : null,
      ...(overrides.headers ? {} : {}),
    },
    arrayBuffer: async () => new Uint8Array(body).buffer,
  };
}

describe("downloadEpubBytes", () => {
  it("returns bytes for a valid EPUB response", async () => {
    const bytes = await downloadEpubBytes("http://x/book.epub", {
      fetchImpl: async () => response({}),
      maxBytes: 1000,
    });
    expect(Array.from(bytes.slice(0, 2))).toEqual([0x50, 0x4b]);
  });

  it("throws on a non-OK response", async () => {
    await expect(
      downloadEpubBytes("http://x", {
        fetchImpl: async () => response({ ok: false, status: 404 }),
        maxBytes: 1000,
      }),
    ).rejects.toThrow(/404/);
  });

  it("rejects a file that exceeds maxBytes by declared length", async () => {
    await expect(
      downloadEpubBytes("http://x", {
        fetchImpl: async () => response({ body: new Uint8Array(500).fill(0x50) }),
        maxBytes: 100,
      }),
    ).rejects.toThrow(/too large/);
  });

  it("rejects a response whose bytes are not a zip", async () => {
    await expect(
      downloadEpubBytes("http://x", {
        fetchImpl: async () =>
          response({ body: new Uint8Array([0x3c, 0x68, 0x74, 0x6d, 0x6c]) }), // "<html"
        maxBytes: 1000,
      }),
    ).rejects.toThrow(/not a valid EPUB/);
  });

  it("rejects an empty download", async () => {
    await expect(
      downloadEpubBytes("http://x", {
        fetchImpl: async () => response({ body: new Uint8Array(0) }),
        maxBytes: 1000,
      }),
    ).rejects.toThrow(/empty/);
  });
});
