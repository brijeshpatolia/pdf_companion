"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { Intent } from "@/core/chat/intents.js";
import Icon from "../../components/Icon";

/**
 * Select-to-ask.
 *
 * Two very different gestures have to end in the same popover.
 *
 * **With a mouse**, the browser puts its own menu on a *live* selection —
 * Edge's mini menu (Explore more / Translate / Search / Copy), and the
 * equivalents elsewhere — and no page code can suppress it. It landed on top
 * of this popover, so one gesture produced two competing menus. The way out is
 * to stop having a live selection: on mouseup we take the text and the
 * geometry, then clear it, and draw the marks ourselves from the range's
 * client rects so you still see what you picked.
 *
 * **On a touch screen** that trick is exactly wrong, and listening for
 * `touchend` doesn't work either. Selecting means long-pressing, then dragging
 * the handles to extend — a gesture that belongs to the browser's own
 * selection UI. `touchend` frequently never reaches the page, and adjusting a
 * handle produces no touch event on this container at all, so the popover
 * simply never appeared in the installed app. Clearing the selection would be
 * worse still: it destroys the handles mid-gesture, so the selection can't be
 * adjusted.
 *
 * So touch is driven by `selectionchange` — the one signal that fires however
 * a selection was made or altered — and keeps its selection. The native menu
 * shows up alongside ours there, which is unavoidable and how every reading
 * app on a phone behaves.
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
  /** Touch keeps its selection; a mouse gets it taken away. */
  const touchRef = useRef(false);

  const dismiss = useCallback(() => setTooltip(null), []);

  const capture = useCallback((e?: Event) => {
    // The popover lives inside the container, so releasing the mouse on one of
    // its buttons bubbles to this same listener. Without this guard the
    // selection is already cleared by then, so we'd read "no text", unmount the
    // popover on mouseup, and the click would never be dispatched — every
    // action in the popover silently did nothing.
    const from = e?.target;
    if (from instanceof Element && from.closest("[data-selection-tooltip]")) return;

    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (!sel || !text || text.length < 2) {
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
      // On touch the real selection stays on screen, so drawing our own marks
      // over it would just double every highlight.
      boxes: touchRef.current ? [] : boxes,
    });

    if (!touchRef.current) {
      // With nothing selected the browser's own menu has nothing to attach to.
      // Our marks stand in for the selection from here.
      sel.removeAllRanges();
    }
  }, [containerRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const markTouch = () => {
      touchRef.current = true;
    };

    /*
     * The touch path. `selectionchange` fires continuously while a handle is
     * dragged, so it's debounced until the selection settles — otherwise the
     * popover would chase the handle around the page.
     *
     * It also fires when *we* clear the selection after a mouse gesture, which
     * would immediately dismiss the popover we had just opened; the touch flag
     * keeps this path off the mouse's back.
     */
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    const handleSelectionChange = () => {
      if (!touchRef.current) return;
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => capture(), 300);
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-selection-tooltip]")) dismiss();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };

    container.addEventListener("mouseup", capture);
    container.addEventListener("touchstart", markTouch, { passive: true });
    document.addEventListener("selectionchange", handleSelectionChange);
    // A mark pinned to text you've scrolled away from is just a stray box.
    container.addEventListener("scroll", dismiss, { passive: true });
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);

    return () => {
      clearTimeout(settleTimer);
      container.removeEventListener("mouseup", capture);
      container.removeEventListener("touchstart", markTouch);
      document.removeEventListener("selectionchange", handleSelectionChange);
      container.removeEventListener("scroll", dismiss);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [containerRef, capture, dismiss]);

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
