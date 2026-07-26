"use client";

/**
 * The app shell at phone width: the nav rail beside (or under) a full-height
 * page.
 *
 * The rail's own markup is reproduced rather than importing <AppRail/>, which
 * needs Next's router. What broke here was never the component — it was the
 * CSS contract between `.rail-layout`, a `100dvh` main, and the rail's mobile
 * rules, and that is exactly what these class names pin down.
 */
export default function MobileShellHarness() {
  return (
    <div className="rail-layout">
      <nav className="app-rail" aria-label="Sections">
        <span className="rail-brand">Pc</span>
        <div className="rail-items">
          {["Library", "Free", "Ask", "Usage"].map((label, i) => (
            <a key={label} href="#" className="rail-item" data-active={i === 0}>
              <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true" />
              <span>{label}</span>
            </a>
          ))}
        </div>
        <span className="rail-avatar">R</span>
      </nav>

      {/* Every screen under this shell is at least a viewport tall. */}
      <main className="shelf">
        <h1>Your library</h1>
        <p data-testid="last">The last thing on the page.</p>
      </main>
    </div>
  );
}
