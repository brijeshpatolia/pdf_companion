"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Icon from "../components/Icon";
import AppRail from "../components/AppRail";

interface CuratedBook {
  id: string;
  title: string;
  author: string;
  description: string;
  subject: string;
  gutenbergId: number;
}

type BookSource = "gutenberg" | "archive";

interface SearchResult {
  gutenbergId?: number;
  archiveId?: string;
  title: string;
  author: string;
  coverUrl?: string;
}

type AddState = "idle" | "adding" | "added" | "error";
type ImportBody =
  | { catalogId: string }
  | { gutenbergId: number; title: string }
  | { archiveId: string; title: string };

const SOURCES: { id: BookSource; label: string }[] = [
  { id: "gutenberg", label: "Project Gutenberg" },
  { id: "archive", label: "Internet Archive" },
];

interface Card {
  key: string;
  title: string;
  author: string;
  description?: string;
  subject?: string;
  coverUrl?: string;
  showCover?: boolean;
  body: ImportBody;
}

/** Fixed-size cover slot: the image fills it, with a book placeholder when
 *  there's no cover or it fails to load. */
function Cover({ url }: { url?: string }) {
  const [failed, setFailed] = useState(false);
  const showImage = url && !failed;
  return (
    <div
      style={{
        width: 52,
        height: 76,
        flexShrink: 0,
        borderRadius: 4,
        border: "1px solid var(--border)",
        background: "var(--bg-raised)",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          onError={() => setFailed(true)}
        />
      ) : (
        <span style={{ fontSize: "1.3rem", opacity: 0.5 }}><Icon name="book" /></span>
      )}
    </div>
  );
}

/**
 * Reading the `?q=` prefill opts this page out of static prerendering unless
 * it sits behind a Suspense boundary, so the default export supplies one.
 */
export default function CatalogPage() {
  return (
    <Suspense fallback={null}>
      <Catalog />
    </Suspense>
  );
}

function Catalog() {
  const router = useRouter();
  const [curated, setCurated] = useState<CuratedBook[]>([]);
  const [curatedSource, setCuratedSource] = useState("");
  const [loaded, setLoaded] = useState(false);

  const [bookSource, setBookSource] = useState<BookSource>("gutenberg");
  // A `?q=` prefill lets other pages send someone here looking for a specific
  // book — a room invite for a book they don't own yet, for instance.
  const initialQuery = useSearchParams().get("q") ?? "";
  const [query, setQuery] = useState(initialQuery);
  const [debounced, setDebounced] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  /** Set when results came from a different source than the one selected. */
  const [searchNote, setSearchNote] = useState<string | null>(null);

  const [state, setState] = useState<Record<string, AddState>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const reqId = useRef(0);

  useEffect(() => {
    fetch("/api/catalog")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.books)) setCurated(data.books);
        if (data.source) setCuratedSource(data.source);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // Debounce the query.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 400);
    return () => clearTimeout(id);
  }, [query]);

  const runSearch = useCallback(async (q: string, p: number, src: BookSource) => {
    if (!q) {
      setResults([]);
      setHasMore(false);
      setSearchError(null);
      setSearchNote(null);
      return;
    }
    const mine = ++reqId.current;
    setSearching(true);
    setSearchError(null);
    try {
      const res = await fetch(`/api/catalog/search?q=${encodeURIComponent(q)}&page=${p}&source=${src}`);
      const data = await res.json();
      if (mine !== reqId.current) return; // a newer search superseded this one
      if (!res.ok) throw new Error(data.error ?? `search failed (${res.status})`);
      setResults((prev) => (p === 1 ? data.results : [...prev, ...data.results]));
      setHasMore(Boolean(data.hasMore));
      // Don't let the toggle claim a source that didn't actually answer.
      setSearchNote(data.fellBack ? (data.note ?? null) : null);
    } catch (err) {
      if (mine === reqId.current) setSearchError((err as Error).message);
    } finally {
      if (mine === reqId.current) setSearching(false);
    }
  }, []);

  useEffect(() => {
    setPage(1);
    void runSearch(debounced, 1, bookSource);
  }, [debounced, bookSource, runSearch]);

  async function add(key: string, body: ImportBody) {
    setState((s) => ({ ...s, [key]: "adding" }));
    setErrors((e) => ({ ...e, [key]: "" }));
    try {
      const res = await fetch("/api/catalog/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? `import failed (${res.status})`);
      }
      setState((s) => ({ ...s, [key]: "added" }));
    } catch (err) {
      setState((s) => ({ ...s, [key]: "error" }));
      setErrors((e) => ({ ...e, [key]: (err as Error).message }));
    }
  }

  const isSearch = debounced.length > 0;
  const cards: Card[] = isSearch
    ? results.map((r): Card => ({
        key: r.archiveId ? `a-${r.archiveId}` : `g-${r.gutenbergId}`,
        title: r.title,
        author: r.author,
        coverUrl: r.coverUrl,
        showCover: true,
        body: r.archiveId
          ? { archiveId: r.archiveId, title: r.title }
          : { gutenbergId: r.gutenbergId!, title: r.title },
      }))
    : curated.map((b) => ({
        key: b.id,
        title: b.title,
        author: b.author,
        description: b.description,
        subject: b.subject,
        body: { catalogId: b.id },
      }));

  // Curated books are grouped by subject; search results are a flat list.
  const groups: { subject: string; cards: Card[] }[] = [];
  if (!isSearch) {
    for (const c of cards) {
      const subject = c.subject ?? "Books";
      let group = groups.find((g) => g.subject === subject);
      if (!group) {
        group = { subject, cards: [] };
        groups.push(group);
      }
      group.cards.push(c);
    }
  }

  const anyAdded = Object.values(state).some((s) => s === "added");

  const renderCard = (c: Card) => {
    const st = state[c.key] ?? "idle";
    return (
      <div key={c.key} className="card fade-in" style={{ padding: "1rem", display: "flex", gap: "0.8rem" }}>
        {c.showCover && <Cover url={c.coverUrl} />}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", minWidth: 0, flex: 1 }}>
          <strong style={{ lineHeight: 1.3 }}>{c.title}</strong>
          <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>{c.author}</span>
          {c.description && (
            <p style={{ margin: "0.1rem 0 0", color: "var(--faint)", fontSize: "0.82rem", lineHeight: 1.45, flex: 1 }}>
              {c.description}
            </p>
          )}
          {st === "added" ? (
            <button className="btn-sm" disabled style={{ color: "var(--ok)", borderColor: "transparent", marginTop: "auto" }}>
              <Icon name="check" /> Added
            </button>
          ) : (
            <button
              className="btn-primary btn-sm"
              onClick={() => add(c.key, c.body)}
              disabled={st === "adding"}
              style={{ marginTop: "auto", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.4rem" }}
            >
              {st === "adding" ? (
                <>
                  <span className="spinner" /> Adding…
                </>
              ) : (
                "Add to library"
              )}
            </button>
          )}
          {st === "error" && (
            <p role="alert" style={{ margin: 0, color: "var(--danger)", fontSize: "0.78rem" }}>
              {errors[c.key]}
            </p>
          )}
        </div>
      </div>
    );
  };

  const gridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
    gap: "0.8rem",
  } as const;

  return (
    <div className="rail-layout">
      <AppRail />
    <main className="page-pad">
      <header className="page-head">
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 32, margin: 0 }}>Free books</h1>
          <p style={{ margin: "6px 0 0", fontSize: 14, color: "var(--text-600)" }}>
            Search public-domain books, or pick from the {curatedSource || "Project Gutenberg"} shelf below.
          </p>
        </div>
      </header>

      <div style={{ marginTop: "1.25rem", position: "relative" }}>
        <input
          className="input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title or author — e.g. Dostoevsky, Kant, evolution…"
          aria-label="Search public-domain books"
          style={{ width: "100%", fontSize: "1rem", padding: "0.6rem 0.85rem" }}
        />
        {searching && (
          <span className="spinner" style={{ position: "absolute", right: 14, top: 14, color: "var(--muted)" }} />
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.6rem", flexWrap: "wrap" }}>
        <div role="tablist" aria-label="Book source" style={{ display: "flex", gap: "0.3rem" }}>
          {SOURCES.map((s) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={bookSource === s.id}
              className={`btn-sm${bookSource === s.id ? " btn-primary" : " btn-ghost"}`}
              onClick={() => setBookSource(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
        {bookSource === "archive" && (
          <span style={{ color: "var(--faint)", fontSize: "0.78rem" }}>
            Scanned public-domain books — text quality varies (OCR).
          </span>
        )}
      </div>

      {anyAdded && (
        <div className="card fade-in" style={{ padding: "0.7rem 1rem", marginTop: "1rem", display: "flex", gap: "0.6rem", alignItems: "center" }}>
          <span className="badge badge-ok">Added</span>
          <span style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Your book is being processed.</span>
          <button className="btn-primary btn-sm" style={{ marginLeft: "auto" }} onClick={() => router.push("/")}>
            Go to library <Icon name="arrow-right" />
          </button>
        </div>
      )}

      {searchError && (
        <p role="alert" className="fade-in" style={{ color: "var(--danger)", marginTop: "1rem" }}>
          {searchError}
        </p>
      )}

      {searchNote && (
        <p
          role="status"
          className="fade-in"
          style={{ color: "var(--muted)", marginTop: "1rem", fontSize: "0.85rem" }}
        >
          {searchNote}
        </p>
      )}

      {isSearch && !searching && results.length === 0 && !searchError && (
        <p style={{ color: "var(--muted)", marginTop: "1.5rem" }}>
          No EPUB books found for “{debounced}”. Try a different search.
        </p>
      )}

      {isSearch ? (
        <div style={{ ...gridStyle, marginTop: "1.5rem" }}>{cards.map(renderCard)}</div>
      ) : !loaded ? (
        <div style={{ ...gridStyle, marginTop: "1.5rem" }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton" style={{ height: 150 }} />
          ))}
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.subject} style={{ marginTop: "1.75rem" }}>
            <h2 style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)", margin: "0 0 0.75rem" }}>
              {g.subject}
            </h2>
            <div style={gridStyle}>{g.cards.map(renderCard)}</div>
          </section>
        ))
      )}

      {isSearch && hasMore && (
        <div style={{ textAlign: "center", marginTop: "1.25rem" }}>
          <button
            onClick={() => {
              const next = page + 1;
              setPage(next);
              void runSearch(debounced, next, bookSource);
            }}
            disabled={searching}
          >
            {searching ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
      </main>
    </div>
  );
}
