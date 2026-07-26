"use client";

import { useEffect, useState, useCallback } from "react";
import type { Intent } from "@/core/chat/intents.js";
import Icon from "../../components/Icon";

/**
 * Select-to-ask.
 *
 * The browser puts its own menu on a *live* text selection — Edge's mini menu
 * (Explore more / Translate / Search / Copy / Snapshot), and the equivalents in
 * Chrome and on iOS — and no page code can suppress it. It landed on top of
 * this popover, so one gesture produced two competing menus.
 *
 * The way out is to stop having a live selection. The moment a drag ends we
 * take the text and the geometry, then clear the selection: with nothing
 * selected, the browser has nothing to decorate. We draw the marks ourselves
 * from the range's client rects, so you still see exactly what you picked —
 * which is the part that would otherwise feel broken.
 */

interface SelectionTooltipProps {
  containerRef: React.RefObject<HTMLElement | null>;
  onSelect: (selection: string, intent: Intent) => void;
  onHighlight?: (selection: string) => void;
}

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface TooltipState {
  text: string;
  x: number;
  y: number;
  /** One box per line of the selection, in container coordinates. */
  boxes: Box[];
}

const INTENTS: { intent: Intent; label: string }[] = [
  { intent: "define", label: "Define" },
  { intent: "deep-dive", label: "Deep Dive" },
  { intent: "eli5", label: "ELI5" },
];

export default function SelectionTooltip({
  containerRef,
  onSelect,
  onHighlight,
}: SelectionTooltipProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const dismiss = useCallback(() => setTooltip(null), []);

  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (!text || text.length < 2) {
      setTooltip(null);
      return;
    }

    const range = sel?.getRangeAt(0);
    const container = containerRef.current;
    if (!range || !container) return;

    if (!container.contains(range.commonAncestorContainer)) {
      setTooltip(null);
      return;
    }

    const containerRect = container.getBoundingClientRect();
    // The marks live inside the scrolling pane, so viewport coordinates alone
    // would drift the moment it scrolls.
    const offsetX = container.scrollLeft - containerRect.left;
    const offsetY = container.scrollTop - containerRect.top;

    // One rect per line: a selection spanning three lines gets three marks,
    // rather than one block swallowing everything between them.
    const boxes: Box[] = Array.from(range.getClientRects())
      .filter((r) => r.width > 0 && r.height > 0)
      .map((r) => ({
        left: r.left + offsetX,
        top: r.top + offsetY,
        width: r.width,
        height: r.height,
      }));

    const rect = range.getBoundingClientRect();
    setTooltip({
      text,
      x: rect.left + rect.width / 2 + offsetX,
      y: rect.top + offsetY - 8,
      boxes,
    });

    // With nothing selected the browser's own menu has nothing to attach to.
    // Our marks stand in for the selection from here.
    sel?.removeAllRanges();
  }, [containerRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Touch selection finalizes just after touchend; defer the read.
    const handleTouchEnd = () => setTimeout(handleMouseUp, 50);

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-selection-tooltip]")) dismiss();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };

    container.addEventListener("mouseup", handleMouseUp);
    container.addEventListener("touchend", handleTouchEnd);
    // A mark pinned to text you've scrolled away from is just a stray box.
    container.addEventListener("scroll", dismiss, { passive: true });
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);

    return () => {
      container.removeEventListener("mouseup", handleMouseUp);
      container.removeEventListener("touchend", handleTouchEnd);
      container.removeEventListener("scroll", dismiss);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [containerRef, handleMouseUp, dismiss]);

  if (!tooltip) return null;

  const act = (fn: () => void) => {
    fn();
    setTooltip(null);
  };

  return (
    <>
      {/* Our stand-in for the selection the browser no longer has. */}
      {tooltip.boxes.map((b, i) => (
        <span
          key={i}
          className="sel-mark"
          aria-hidden="true"
          style={{ left: b.left, top: b.top, width: b.width, height: b.height }}
        />
      ))}

      <div
        data-selection-tooltip
        className="sel-popover fade-in"
        style={{
          position: "absolute",
          left: tooltip.x,
          top: tooltip.y,
          transform: "translate(-50%, -100%)",
          zIndex: 100,
        }}
      >
        {onHighlight && (
          <>
            <button
              className="btn-ghost btn-sm"
              onClick={() => act(() => onHighlight(tooltip.text))}
              style={{ whiteSpace: "nowrap", color: "var(--accent)" }}
            >
              <Icon name="highlight" /> Highlight
            </button>
            <span className="sel-divider" aria-hidden="true" />
          </>
        )}
        {INTENTS.map(({ intent, label }, i) => (
          <button
            key={intent}
            // Define is what you want most of the time, so it looks like it.
            className={i === 0 ? "btn-primary btn-sm" : "btn-ghost btn-sm"}
            onClick={() => act(() => onSelect(tooltip.text, intent))}
            style={{ whiteSpace: "nowrap" }}
          >
            {label}
          </button>
        ))}
      </div>
    </>
  );
}
