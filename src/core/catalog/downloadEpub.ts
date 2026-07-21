/** Minimal fetch surface we depend on — lets tests inject a fake. */
export interface FetchLike {
  (url: string): Promise<FetchResponseLike>;
}

export interface FetchResponseLike {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface DownloadOptions {
  fetchImpl: FetchLike;
  maxBytes: number;
}

/**
 * Download an EPUB by URL with guards: non-OK responses, oversized files
 * (checked against Content-Length when present and again after reading),
 * and responses that clearly aren't an EPUB/zip all throw.
 */
export async function downloadEpubBytes(
  url: string,
  { fetchImpl, maxBytes }: DownloadOptions,
): Promise<Uint8Array> {
  const res = await fetchImpl(url);
  if (!res.ok) {
    throw new Error(`download failed (${res.status})`);
  }

  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new Error(`file too large (${(declared / 1024 / 1024).toFixed(1)} MB)`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType && !/epub\+zip|octet-stream|application\/zip/i.test(contentType)) {
    throw new Error(`unexpected content type: ${contentType}`);
  }

  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length === 0) throw new Error("empty download");
  if (bytes.length > maxBytes) {
    throw new Error(`file too large (${(bytes.length / 1024 / 1024).toFixed(1)} MB)`);
  }

  // EPUB/zip files start with the local-file-header magic "PK\x03\x04".
  if (!(bytes[0] === 0x50 && bytes[1] === 0x4b)) {
    throw new Error("downloaded file is not a valid EPUB");
  }

  return bytes;
}
