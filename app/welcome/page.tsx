import Link from "next/link";

export const metadata = {
  title: "The book, and someone to think with",
  description:
    "Studiolo is a reading companion for hard books. Not a summary — a companion on the page you're on, holding the whole book in mind.",
};

/**
 * The landing page — the only surface a stranger meets before signing in.
 *
 * It has no nav rail and no chrome to speak of, because there is nothing yet
 * to navigate. The whole argument is made by one pair of objects in the hero:
 * a page, and the thing reading it alongside you. That pair *is* the product;
 * everything below it is elaboration.
 */
export default function WelcomePage() {
  return (
    <main className="landing">
      <header className="landing-bar">
        <span className="landing-brand">
          <span className="rail-brand" aria-hidden="true">
            S
          </span>
          Studiolo
        </span>
        <span style={{ flex: 1 }} />
        <Link href="/catalog" className="landing-nav">
          Free library
        </Link>
        <Link href="/login" className="btn-primary btn-sm">
          Open your library
        </Link>
      </header>

      <section className="landing-hero">
        <div>
          <span className="landing-kicker">For hard books · PDF &amp; EPUB</span>
          <h1 className="landing-h1">
            The book, and
            <br />
            someone to
            <br />
            <em>think with</em>
          </h1>
          <p className="landing-lede">
            Not a summary — the opposite. A companion that stays on the page you&apos;re on, holds
            the whole book in mind, and keeps what mattered, so the book you&apos;ve been meaning to
            finish becomes one you can.
          </p>
          <div className="landing-cta">
            <Link href="/login" className="btn-primary">
              Upload a book
            </Link>
            <Link href="/catalog" className="btn-ghost">
              Browse free classics
            </Link>
          </div>
          <p className="landing-fine">
            Up to 50&nbsp;MB · your library stays private · costs shown per question
          </p>
        </div>

        {/*
          The pitch, as two objects rather than a claim: the page you're
          reading, and the companion that is on it with you.
        */}
        <div className="landing-art" aria-hidden="true">
          <div className="paper landing-page">
            <div className="paper-running-head">
              <span>Meditations</span>
              <span className="tabular">84</span>
            </div>
            <div className="landing-page-body">
              <p>
                It is not the thing itself that troubles a person, but the account they keep giving
                of it.
              </p>
              <p>
                And so the work is not to arrange the world differently. It is{" "}
                <mark className="hl-mine">
                  to watch for the moment where judgement enters, and quietly decline to add it
                </mark>
                .
              </p>
              {/* Short on purpose: the companion card overlaps the page's
                  bottom-right, and a long line here would run under it. */}
              <p>What remains is astonishingly plain.</p>
            </div>
          </div>

          <div className="landing-companion">
            <div className="eyebrow" style={{ marginBottom: 12 }}>
              Companion · knows page 84
            </div>
            <div className="bubble bubble-user" style={{ marginLeft: "auto", marginBottom: 12 }}>
              What does he mean by &ldquo;the account&rdquo;?
            </div>
            <p className="landing-answer">
              The story you narrate about an event — its meaning, its threat. Earlier he calls it{" "}
              <strong>the opinion added</strong>.
            </p>
            <div style={{ display: "flex", gap: 6, marginTop: 12, alignItems: "center" }}>
              <span className="chip-cite">p. 82</span>
              <span className="chip-cite">p. 119</span>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 11, color: "var(--text-900)" }}>$0.0021</span>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-features">
        <div>
          <h2>Always on your page</h2>
          <p>
            Ask without explaining where you are. The page you&apos;re reading is the context, every
            time.
          </p>
        </div>
        <div>
          <h2>Holds the whole book</h2>
          <p>
            Answers are drawn from passages across the entire text — and cite the pages they came
            from.
          </p>
        </div>
        <div>
          <h2>Keeps what mattered</h2>
          <p>
            Highlights, saved answers and notes become flashcards, or a page you can share with
            someone. Nothing here is built to help you skip the book.
          </p>
        </div>
      </section>
    </main>
  );
}
