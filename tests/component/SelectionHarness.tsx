"use client";

import { useRef, useState } from "react";
import SelectionTooltip from "../../app/reader/[bookId]/SelectionTooltip";

/**
 * The reader's book pane, reduced to what the popover actually depends on: a
 * scrolling container to measure against, some real prose to select, and
 * somewhere for the callbacks to land.
 *
 * The class names are the app's own, because the popover positions itself
 * against the container's box and draws its marks in container coordinates —
 * a bare <div> would be a different component.
 */
export default function SelectionHarness({ narrow = false }: { narrow?: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const [calls, setCalls] = useState<string[]>([]);

  return (
    <section ref={ref} className="pane-book" style={{ height: "100vh", position: "relative" }}>
      {/* Narrow enough that the popover is wider than the space either side of
          a selection, which is the phone case and the one that overflowed. */}
      <div className="paper reader-paper is-text" style={{ width: narrow ? 340 : 600 }}>
        <div className="epub-page">
          <p data-testid="prose">
            It is not the thing itself that troubles a person, but the account they keep giving of
            it. And so the work is not to arrange the world differently.
          </p>
        </div>
      </div>

      <SelectionTooltip
        containerRef={ref}
        onSelect={(text, intent) => setCalls((c) => [...c, `select:${intent}:${text}`])}
        onHighlight={(text) => setCalls((c) => [...c, `highlight:${text}`])}
      />

      {/* Read by the test rather than displayed — the callbacks are the assertion. */}
      <output data-testid="calls">{calls.join("\n")}</output>
    </section>
  );
}
