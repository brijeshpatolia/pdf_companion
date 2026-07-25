import Link from "next/link";

export default function ShareNotFound() {
  return (
    <main className="share-page">
      <div className="card share-empty" style={{ marginTop: "3rem" }}>
        <p style={{ margin: 0, fontSize: "1.6rem" }}>🔗</p>
        <h1 className="wordmark" style={{ fontSize: "1.4rem", margin: "0.5rem 0 0" }}>
          This share link isn’t available
        </h1>
        <p style={{ margin: "0.5rem 0 1rem", color: "var(--muted)" }}>
          The link may be mistyped, or the owner may have stopped sharing this book.
        </p>
        <Link href="/" className="btn-primary btn-sm">
          Go to PDF Companion →
        </Link>
      </div>
    </main>
  );
}
