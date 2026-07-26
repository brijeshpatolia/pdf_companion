"use client";

import { useEffect, useRef, useState } from "react";
import { usePageTurn } from "../../app/reader/[bookId]/usePageTurn";

/**
 * The reader's page, reduced to what a turn actually depends on: a stage with
 * perspective, a page to copy, and somewhere for the copy to go.
 *
 * The class names are the app's own, because the turn is mostly CSS — the hook
 * only decides which element carries the motion. A bare <div> would be a
 * different component.
 *
 * The canvas stands in for a rendered PDF page. It is painted a colour per
 * page, which is how a test can tell whether the copy carries the picture or
 * just an empty sheet the same size.
 */
export default function PageTurnHarness() {
  const [page, setPage] = useState(5);
  const pageRef = useRef(5);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const turn = usePageTurn();

  const go = (n: number) => {
    const from = pageRef.current;
    if (n === from) return;
    pageRef.current = n;
    turn.start(from, n);
    setPage(n);
  };

  // After the commit, exactly as react-pdf paints a page after rendering it.
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = COLOURS[page % COLOURS.length]!;
    ctx.fillRect(0, 0, 60, 60);
  }, [page]);

  return (
    <section className="pane-book" style={{ height: "100vh" }}>
      <div className="page-stage">
        <div
          ref={turn.paperRef}
          className={`paper reader-paper is-text${turn.arriving ? " is-arriving" : ""}`}
        >
          <div className="paper-running-head">
            <span>Middlemarch</span>
            <span className="tabular">{page}</span>
          </div>
          <div className="epub-page">
            <p data-testid="prose">Page {page} of the fixture.</p>
          </div>
          <canvas ref={canvasRef} width={60} height={60} />
        </div>

        <div
          ref={turn.leafRef}
          className={`page-leaf${turn.arriving ? " is-behind" : ""}`}
          aria-hidden="true"
        />
      </div>

      <div style={{ position: "fixed", bottom: 0, left: 0, display: "flex", gap: 8 }}>
        <button onClick={() => go(page - 1)}>Back</button>
        <button onClick={() => go(page + 1)}>Next</button>
        <button onClick={() => go(page + 300)}>Jump ahead</button>
        <button onClick={() => go(page)}>Stay</button>
      </div>
    </section>
  );
}

/** Distinct enough that a wrong page is obvious from one pixel. */
const COLOURS = ["#ff4000", "#0080ff", "#00c040", "#c000c0", "#ffc000"];
