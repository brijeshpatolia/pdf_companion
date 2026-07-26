"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { spineColour, spineInk } from "@/core/library/shelfRow.js";
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
  body: ImportBody;
}

/**
 * A book object at a fixed size, so a grid of them lines up.
 *
 * When there's no cover — or the remote one 404s, which Archive.org's do
 * often — it falls back to a coloured board keyed off the book's id, the same
 * palette the shelf uses for spines. A missing cover then still reads as a
 * book rather than as a hole.
 */
function Cover({ url, seed }: { url?: string; seed: string }) {
  const [failed, setFailed] = useState(false);
  const board = spineColour(seed);
  return (
    <div className="cat-cover" style={{ background: board }}>
      {url && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" onError={() => setFailed(true)} />
      ) : (
        <span style={{ color: spineInk(board), opacity: 0.55 }}>
          <Icon name="book" size={20} />
        </span>
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
      <div key={c.key} className="cat-card fade-in">
        <Cover url={c.coverUrl} seed={c.key} />
        <div className="cat-body">
          <span className="cat-title">{c.title}</span>
          <span className="cat-author">{c.author}</span>
          {c.description && <p className="cat-desc">{c.description}</p>}
          {st === "added" ? (
            <button
              className="btn-sm"
              disabled
              style={{ marginTop: "auto", alignSelf: "flex-start", color: "var(--success)", borderColor: "transparent" }}
            >
              <Icon name="check" /> Added
            </button>
          ) : (
            <button className="btn-sm cat-add" onClick={() => add(c.key, c.body)} disabled={st === "adding"}>
              {st === "adding" ? (
                <>
                  <span className="spinner" /> Adding
                </>
              ) : (
                <>
                  <Icon name="plus" /> Add to library
                </>
              )}
            </button>
          )}
          {st === "error" && (
            <p role="alert" style={{ margin: 0, color: "var(--danger)", fontSize: 12 }}>
              {errors[c.key]}
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="rail-layout">
      <AppRail />
    <main className="page-pad">
      <header className="page-head">
        <div style={{ minWidth: 0 }}>
          <h1>Free books</h1>
          <p>
            Every public-domain book on Project Gutenberg and the Internet Archive, ready to read
            with the companion. Search for one, or take something off the {curatedSource || "Gutenberg"} shelf.
          </p>
        </div>
      </header>

      <div className="cat-search">
        <span className="cat-search-icon" aria-hidden="true">
          <Icon name="search" size={17} />
        </span>
        <input
          className="input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Dostoevsky, Kant, evolution…"
          aria-label="Search public-domain books"
        />
        {searching && <span className="spinner" />}
      </div>

      <div className="cat-controls">
        <div className="segmented" role="tablist" aria-label="Book source">
          {SOURCES.map((s) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={bookSource === s.id}
              onClick={() => setBookSource(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
        {bookSource === "archive" && (
          <span className="cat-note">Scanned books — text quality varies (OCR).</span>
        )}
      </div>

      {anyAdded && (
        <div className="cat-added fade-in">
          <span className="badge badge-ok">Added</span>
          <span style={{ color: "var(--text-600)", fontSize: 13.5 }}>
            Your book is being read in. It&apos;s openable before that finishes.
          </span>
          <button className="btn-primary btn-sm" style={{ marginLeft: "auto" }} onClick={() => router.push("/")}>
            Go to library <Icon name="arrow-right" />
          </button>
        </div>
      )}

      {searchError && (
        <p role="alert" className="fade-in" style={{ color: "var(--danger)", marginTop: 16 }}>
          {searchError}
        </p>
      )}

      {searchNote && (
        <p role="status" className="fade-in cat-note" style={{ marginTop: 16 }}>
          {searchNote}
        </p>
      )}

      {isSearch && !searching && results.length === 0 && !searchError && (
        <div className="empty-state" style={{ marginTop: 24 }}>
          <Icon name="search" size={26} />
          <p>Nothing readable found for “{debounced}”. Try an author, or the other source.</p>
        </div>
      )}

      {isSearch ? (
        <div className="cat-grid" style={{ marginTop: 24 }}>{cards.map(renderCard)}</div>
      ) : !loaded ? (
        <div className="cat-grid" style={{ marginTop: 24 }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton" style={{ height: 148 }} />
          ))}
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.subject}>
            <h2 className="section-label">{g.subject}</h2>
            <div className="cat-grid">{g.cards.map(renderCard)}</div>
          </section>
        ))
      )}

      {isSearch && hasMore && (
        <div style={{ textAlign: "center", marginTop: 20 }}>
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
