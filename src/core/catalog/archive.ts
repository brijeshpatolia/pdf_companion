/**
 * Internet Archive as a book source, scoped to genuinely-free texts.
 *
 * IA hosts three kinds of books: institutional public-domain scans (good),
 * user "Community Texts" uploads that include infringing in-copyright material
 * (bad), and the Controlled-Digital-Lending library (DRM, ruled infringing in
 * Hachette v. Internet Archive — excluded). The search filter below admits
 * only the first: public-domain, non-restricted, EPUB-bearing items, and the
 * import path re-verifies that against the authoritative metadata.
 */

const ROWS = 20;

// Fixed, non-negotiable safety clauses ANDed onto every query.
const SAFETY_FILTER = [
  "mediatype:texts",
  "format:EPUB",
  "-access-restricted-item:true",
  "possible-copyright-status:NOT_IN_COPYRIGHT",
  "-collection:opensource", // the community-upload collection
].join(" AND ");

export interface ArchiveResult {
  archiveId: string;
  title: string;
  author: string;
  coverUrl: string;
  year?: number;
}

export interface ArchivePage {
  results: ArchiveResult[];
  hasMore: boolean;
}

/**
 * Strip Lucene/IA query operators from user input so a search term can't
 * inject clauses that bypass the safety filter (e.g. a literal
 * "access-restricted-item:true"). Leaves plain words and spaces.
 */
export function sanitizeArchiveQuery(q: string): string {
  return q
    .replace(/[:"()[\]{}^~*?\\/+!&|<>=]/g, " ")
    .replace(/\s-+/g, " ") // stray minus operators
    .replace(/\s+/g, " ")
    .trim();
}

export function archiveSearchUrl(query: string, page = 1): string {
  const terms = sanitizeArchiveQuery(query);
  const q = `(${terms}) AND ${SAFETY_FILTER}`;
  const params = new URLSearchParams();
  params.set("q", q);
  for (const f of ["identifier", "title", "creator", "year"]) params.append("fl[]", f);
  params.append("sort[]", "downloads desc");
  params.set("rows", String(ROWS));
  params.set("page", String(Math.max(1, page)));
  params.set("output", "json");
  return `https://archive.org/advancedsearch.php?${params.toString()}`;
}

export function archiveCoverUrl(identifier: string): string {
  return `https://archive.org/services/img/${encodeURIComponent(identifier)}`;
}

/** IA identifiers are a restricted charset; validate before building URLs. */
export function isValidArchiveId(id: unknown): id is string {
  return typeof id === "string" && /^[A-Za-z0-9._-]{1,128}$/.test(id);
}

interface RawDoc {
  identifier?: unknown;
  title?: unknown;
  creator?: unknown;
  year?: unknown;
}

export function mapArchiveSearch(json: unknown): ArchivePage {
  const response = ((json ?? {}) as { response?: unknown }).response as
    | { docs?: unknown; numFound?: unknown; start?: unknown }
    | undefined;
  const docs = Array.isArray(response?.docs) ? (response!.docs as RawDoc[]) : [];

  const results: ArchiveResult[] = [];
  for (const doc of docs) {
    const id = doc.identifier;
    if (!isValidArchiveId(id)) continue;
    results.push({
      archiveId: id,
      title: asText(doc.title) || "Untitled",
      author: asText(doc.creator) || "Unknown author",
      coverUrl: archiveCoverUrl(id),
      year: Number.isFinite(Number(doc.year)) ? Number(doc.year) : undefined,
    });
  }

  const start = Number(response?.start) || 0;
  const numFound = Number(response?.numFound) || 0;
  return { results, hasMore: start + docs.length < numFound };
}

// creator/title can be a string or an array of strings.
function asText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.filter((v) => typeof v === "string").join(", ").trim();
  return "";
}

interface ArchiveMetadata {
  metadata?: {
    "possible-copyright-status"?: unknown;
    "access-restricted-item"?: unknown;
    title?: unknown;
    [k: string]: unknown;
  };
  files?: Array<{ name?: unknown; format?: unknown }>;
  is_dark?: unknown;
}

/**
 * Authoritative import-time gate: only NOT_IN_COPYRIGHT, non-restricted,
 * non-dark items may be imported — regardless of what the client requested.
 */
export function isImportableArchiveItem(meta: ArchiveMetadata): boolean {
  if (meta.is_dark) return false;
  const m = meta.metadata ?? {};
  if (String(m["access-restricted-item"]).toLowerCase() === "true") return false;
  return String(m["possible-copyright-status"]) === "NOT_IN_COPYRIGHT";
}

/** Find the EPUB file name in an item's metadata, if any. */
export function pickArchiveEpub(meta: ArchiveMetadata): string | undefined {
  const files = Array.isArray(meta.files) ? meta.files : [];
  for (const f of files) {
    const name = typeof f.name === "string" ? f.name : "";
    const format = typeof f.format === "string" ? f.format : "";
    if (format.toLowerCase() === "epub" || name.toLowerCase().endsWith(".epub")) return name;
  }
  return undefined;
}

export function archiveMetadataUrl(identifier: string): string {
  return `https://archive.org/metadata/${encodeURIComponent(identifier)}`;
}

export function archiveDownloadUrl(identifier: string, fileName: string): string {
  return `https://archive.org/download/${encodeURIComponent(identifier)}/${encodeURIComponent(fileName)}`;
}
