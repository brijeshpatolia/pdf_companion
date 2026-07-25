/**
 * Identifying headers for outbound requests to public book sources.
 *
 * Gutendex answers datacenter-IP requests carrying the runtime's default agent
 * with a 403, which silently broke live Gutenberg search once deployed (it
 * works fine from a laptop). Sending a real User-Agent fixes it, and naming the
 * project is the polite thing to do when hitting a free community API.
 */
export const CATALOG_FETCH_HEADERS: Record<string, string> = {
  "User-Agent": "pdf-companion/1.0 (+https://github.com/brijeshpatolia/pdf_companion)",
  Accept: "application/json, application/epub+zip, */*",
};
