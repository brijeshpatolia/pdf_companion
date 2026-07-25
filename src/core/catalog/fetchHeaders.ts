/**
 * Identifying headers for outbound requests to public book sources.
 *
 * Naming the project is the polite thing to do when hitting a free community
 * API, and it's why these exist. It is *not* a fix for Gutendex's 403s from the
 * deployment — that was the original guess here and it turned out to be wrong.
 * Gutendex blocks the datacenter IP range, not the agent string, so no header
 * makes it work. `searchCatalog` handles that by falling back to the Internet
 * Archive instead.
 */
export const CATALOG_FETCH_HEADERS: Record<string, string> = {
  "User-Agent": "pdf-companion/1.0 (+https://github.com/brijeshpatolia/pdf_companion)",
  Accept: "application/json, application/epub+zip, */*",
};
