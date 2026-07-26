import Link from "next/link";
import type { SharedBook } from "@/core/sharing/buildSharedBook.js";
import Icon from "../../components/Icon";

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function count(n: number, singular: string): string {
  return `${n} ${singular}${n === 1 ? "" : "s"}`;
}

/** Pure presentation of a shared book — no data access, so it's easy to preview. */
export default function SharedBookView({ shared }: { shared: SharedBook }) {
  const { bookTitle, sharedAt, counts, highlights, answers, notes, flashcards, isEmpty } = shared;

  return (
    <main className="share-page">
      <header className="share-page-head">
        <p className="share-eyebrow"><Icon name="book" /> Shared from Studiolo</p>
        <h1 className="wordmark share-title">{bookTitle}</h1>
        <p className="share-sub">
          A reader’s highlights, saved answers, notes, and flashcards for this book · shared {fmtDate(sharedAt)}
        </p>
        <div className="share-counts">
          {counts.highlights > 0 && <span className="badge badge-info"><Icon name="highlight" /> {count(counts.highlights, "highlight")}</span>}
          {counts.answers > 0 && <span className="badge badge-info"><Icon name="chat" /> {count(counts.answers, "answer")}</span>}
          {counts.notes > 0 && <span className="badge badge-info"><Icon name="note" /> {count(counts.notes, "note")}</span>}
          {counts.flashcards > 0 && <span className="badge badge-info"><Icon name="cards" /> {count(counts.flashcards, "flashcard")}</span>}
        </div>
      </header>

      {isEmpty ? (
        <div className="card share-empty">
          <p style={{ margin: 0, fontSize: "1.4rem" }}><Icon name="seedling" /></p>
          <p style={{ margin: "0.5rem 0 0" }}>Nothing has been kept for this book yet.</p>
        </div>
      ) : (
        <>
          {highlights.length > 0 && (
            <section className="share-section">
              <h2>Highlights</h2>
              {highlights.map((h, i) => (
                <blockquote className="share-quote" key={i}>
                  {h.text}
                  <cite>p. {h.page}</cite>
                </blockquote>
              ))}
            </section>
          )}

          {answers.length > 0 && (
            <section className="share-section">
              <h2>Saved answers</h2>
              {answers.map((a, i) => (
                <div className="card share-answer" key={i}>
                  <p className="share-answer-q">{a.question?.trim() || "Answer"}</p>
                  <p className="share-answer-meta">p. {a.page}</p>
                  <p className="share-answer-a">{a.text}</p>
                </div>
              ))}
            </section>
          )}

          {notes.length > 0 && (
            <section className="share-section">
              <h2>Notes</h2>
              {notes.map((n, i) => (
                <div className="card share-note" key={i}>
                  <p className="share-answer-meta">
                    {n.page != null ? `p. ${n.page} · ` : ""}
                    {fmtDate(n.updatedAt)}
                  </p>
                  <p style={{ margin: "0.25rem 0 0", whiteSpace: "pre-wrap" }}>{n.text}</p>
                </div>
              ))}
            </section>
          )}

          {flashcards.length > 0 && (
            <section className="share-section">
              <h2>Flashcards</h2>
              <div className="share-cards">
                {flashcards.map((c, i) => (
                  <div className="card share-card" key={i}>
                    <p className="share-card-front">{c.front}</p>
                    <p className="share-card-back">{c.back}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <footer className="share-foot">
        <Link href="/" className="btn-primary btn-sm">
          Read with Studiolo <Icon name="arrow-right" />
        </Link>
        <p className="share-foot-note">
          An AI that reads with you — always on your page, holding the whole book in mind.
        </p>
      </footer>
    </main>
  );
}
