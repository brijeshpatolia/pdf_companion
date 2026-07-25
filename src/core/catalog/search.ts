import { gutendexSearchUrl, mapGutendexBooks, type GutendexResult } from "./gutendex.js";
import { archiveSearchUrl, mapArchiveSearch, type ArchiveResult } from "./archive.js";

/**
 * Live catalog search, with a fallback for the source that can't be relied on.
 *
 * Gutendex refuses requests from datacenter IP ranges with a 403. It works from
 * a laptop and fails from the deployment, and a User-Agent doesn't change that
 * — the block is on the address, not the agent. Rather than leave search broken
 * in production, a failed Gutenberg search retries against the Internet
 * Archive, which serves the same public-domain books and answers us fine.
 *
 * The fallback is one-directional on purpose. If the Archive is what failed,
 * falling back to Gutenberg would almost certainly fail too and only add
 * latency before the same error.
 */

export type CatalogSource = "gutenberg" | "archive";

export interface CatalogSearchOutcome {
  results: (GutendexResult | ArchiveResult)[];
  hasMore: boolean;
  /** The source that actually answered — not necessarily the one asked for. */
  source: CatalogSource;
  /** True when the requested source failed and another one answered instead. */
  fellBack: boolean;
  /** Why the requested source didn't answer. Present only on a fallback. */
  note?: string;
}

export interface SearchDeps {
  /** Fetches and parses a source's JSON, throwing on any non-OK response. */
  fetchJson(url: string): Promise<unknown>;
}

async function searchOne(
  source: CatalogSource,
  query: string,
  page: number,
  deps: SearchDeps,
): Promise<{ results: (GutendexResult | ArchiveResult)[]; hasMore: boolean }> {
  if (source === "archive") {
    return mapArchiveSearch(await deps.fetchJson(archiveSearchUrl(query, page)));
  }
  return mapGutendexBooks(await deps.fetchJson(gutendexSearchUrl(query, page)));
}

export async function searchCatalog(
  requested: CatalogSource,
  query: string,
  page: number,
  deps: SearchDeps,
): Promise<CatalogSearchOutcome> {
  try {
    const page1 = await searchOne(requested, query, page, deps);
    return { ...page1, source: requested, fellBack: false };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown error";
    if (requested !== "gutenberg") throw err;

    const fallback = await searchOne("archive", query, page, deps);
    return {
      ...fallback,
      source: "archive",
      fellBack: true,
      note: `Project Gutenberg didn't respond (${reason}) — showing Internet Archive results instead.`,
    };
  }
}
