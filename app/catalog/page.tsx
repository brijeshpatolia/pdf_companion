"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface CatalogBook {
  id: string;
  title: string;
  author: string;
  description: string;
  gutenbergId: number;
}

type AddState = "idle" | "adding" | "added" | "error";

export default function CatalogPage() {
  const router = useRouter();
  const [books, setBooks] = useState<CatalogBook[]>([]);
  const [source, setSource] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [state, setState] = useState<Record<string, AddState>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/catalog")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.books)) setBooks(data.books);
        if (data.source) setSource(data.source);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  async function add(id: string) {
    setState((s) => ({ ...s, [id]: "adding" }));
    setErrors((e) => ({ ...e, [id]: "" }));
    try {
      const res = await fetch("/api/catalog/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ catalogId: id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `import failed (${res.status})`);
      }
      setState((s) => ({ ...s, [id]: "added" }));
    } catch (err) {
      setState((s) => ({ ...s, [id]: "error" }));
      setErrors((e) => ({ ...e, [id]: (err as Error).message }));
    }
  }

  const anyAdded = Object.values(state).some((s) => s === "added");

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "2.5rem 1.25rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
        <div>
          <h1 className="wordmark" style={{ marginBottom: "0.25rem", fontSize: "1.8rem" }}>
            Free books
          </h1>
          <p style={{ color: "var(--muted)", marginTop: 0 }}>
            Public-domain classics{source ? ` from ${source}` : ""} — add one to start reading with the companion.
          </p>
        </div>
        <Link href="/" className="btn-ghost btn-sm" style={{ whiteSpace: "nowrap" }}>
          ← Library
        </Link>
      </div>

      {anyAdded && (
        <div className="card fade-in" style={{ padding: "0.7rem 1rem", marginTop: "1rem", display: "flex", gap: "0.6rem", alignItems: "center" }}>
          <span className="badge badge-ok">Added</span>
          <span style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
            Your book is being processed.
          </span>
          <button className="btn-primary btn-sm" style={{ marginLeft: "auto" }} onClick={() => router.push("/")}>
            Go to library →
          </button>
        </div>
      )}

      <div
        style={{
          marginTop: "1.5rem",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: "0.8rem",
        }}
      >
        {!loaded &&
          [0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton" style={{ height: 150 }} />
          ))}

        {books.map((b) => {
          const st = state[b.id] ?? "idle";
          return (
            <div
              key={b.id}
              className="card fade-in"
              style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}
            >
              <strong style={{ lineHeight: 1.3 }}>{b.title}</strong>
              <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>{b.author}</span>
              <p style={{ margin: "0.1rem 0 0", color: "var(--faint)", fontSize: "0.82rem", lineHeight: 1.45, flex: 1 }}>
                {b.description}
              </p>
              {st === "added" ? (
                <button className="btn-sm" disabled style={{ color: "var(--ok)", borderColor: "transparent" }}>
                  ✓ Added
                </button>
              ) : (
                <button
                  className="btn-primary btn-sm"
                  onClick={() => add(b.id)}
                  disabled={st === "adding"}
                  style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.4rem" }}
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
                  {errors[b.id]}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
