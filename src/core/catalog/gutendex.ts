/**
 * Maps the Gutendex API (https://gutendex.com — a JSON API over the full
 * Project Gutenberg catalog) into the shape our catalog UI uses. Only books
 * that expose an EPUB are kept, since that's what we can ingest.
 */

const EPUB_FORMAT = "application/epub+zip";
const COVER_FORMAT = "image/jpeg";

export interface GutendexResult {
  gutenbergId: number;
  title: string;
  author: string;
  coverUrl?: string;
  downloadCount: number;
  languages: string[];
}

export interface GutendexPage {
  results: GutendexResult[];
  hasMore: boolean;
}

/** Gutendex requires the trailing slash (a bare /books 301-redirects). */
export function gutendexSearchUrl(query: string, page = 1): string {
  const params = new URLSearchParams({ search: query });
  if (page > 1) params.set("page", String(page));
  return `https://gutendex.com/books/?${params.toString()}`;
}

interface RawBook {
  id?: unknown;
  title?: unknown;
  authors?: Array<{ name?: unknown }>;
  languages?: unknown;
  download_count?: unknown;
  formats?: Record<string, unknown>;
}

export function mapGutendexBooks(json: unknown): GutendexPage {
  const root = (json ?? {}) as { results?: unknown; next?: unknown };
  const raw = Array.isArray(root.results) ? (root.results as RawBook[]) : [];

  const results: GutendexResult[] = [];
  for (const book of raw) {
    const formats = book.formats ?? {};
    const epubUrl = pickFormat(formats, EPUB_FORMAT);
    if (!epubUrl) continue; // can't ingest without an EPUB
    const id = Number(book.id);
    if (!Number.isInteger(id) || id <= 0) continue;

    results.push({
      gutenbergId: id,
      title: typeof book.title === "string" && book.title.trim() ? book.title.trim() : "Untitled",
      author: authorName(book.authors),
      coverUrl: pickFormat(formats, COVER_FORMAT),
      downloadCount: Number(book.download_count) || 0,
      languages: Array.isArray(book.languages) ? book.languages.filter((l): l is string => typeof l === "string") : [],
    });
  }

  return { results, hasMore: typeof root.next === "string" && root.next.length > 0 };
}

// Gutenberg exposes several epub variants under keys like
// "application/epub+zip" — match by prefix and skip empty values.
function pickFormat(formats: Record<string, unknown>, mime: string): string | undefined {
  for (const [key, value] of Object.entries(formats)) {
    if (key.startsWith(mime) && typeof value === "string" && value) return value;
  }
  return undefined;
}

function authorName(authors: RawBook["authors"]): string {
  const name = authors?.[0]?.name;
  if (typeof name !== "string" || !name.trim()) return "Unknown author";
  // Gutenberg uses a library "Surname, Given" convention. We show it as-is:
  // flipping to "Given Surname" garbles names with epithets/titles after the
  // comma (e.g. "Marcus Aurelius, Emperor of Rome"), so leave it verbatim.
  return name.trim();
}
