"use client";

import { useEffect, useLayoutEffect, useState, useCallback, useRef } from "react";
import type { Intent } from "@/core/chat/intents.js";
import { placePopover } from "@/core/reading/selectionPopover.js";
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
 * **On a touch screen** the same problem is worse, and listening for
 * `touchend` doesn't work either. Selecting means long-pressing, then dragging
 * the handles to extend — a gesture that belongs to the browser's own
 * selection UI. `touchend` frequently never reaches the page, and adjusting a
 * handle produces no touch event on this container at all, so the popover
 * simply never appeared in the installed app.
 *
 * So touch is driven by `selectionchange`, the one signal that fires however a
 * selection was made or altered. It was then left alone, on the reasoning that
 * clearing it destroys the handles and the selection could never be extended
 * past the first long-pressed word. That was the wrong trade: keeping the
 * selection keeps Android's Copy / Share / Select-all bar, which is drawn by
 * the system directly over this popover, and it keeps Chrome's touch-to-search
 * panel along the bottom. The reader ended up with three menus, two of them
 * covering the one that belongs to the app.
 *
 * The handles are kept where they are worth keeping. `selectionchange` fires
 * on every adjustment, so the timer below restarts on each one and the
 * selection is only taken over once the reader stops moving it — long-press,
 * drag to extend, pause, and the platform's UI gives way to ours. The cost is
 * that a selection can't be nudged after that pause; long-press again.
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
  /** The selection's own box, in container coordinates — what to sit beside. */
  rect: { left: number; top: number; right: number; bottom: number };
  /** One box per line of the selection, in container coordinates. */
  boxes: Box[];
  /**
   * Set for a selection made by touch, where the platform's own menu wants the
   * space above it.
   */
  below: boolean;
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
  /** Which gesture made this selection: it decides the timing and the side. */
  const touchRef = useRef(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  /**
   * Set for the one `selectionchange` our own clearing is about to cause.
   *
   * Without it the touch path answers its own event: it clears the selection,
   * the clearing fires a change, the change schedules another capture, and
   * that capture finds nothing selected and dismisses the popover it had just
   * put up — half a second after the reader saw it appear.
   */
  const selfClearedRef = useRef(false);

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
      rect: {
        left: rect.left + offsetX,
        right: rect.right + offsetX,
        top: rect.top + offsetY,
        bottom: rect.bottom + offsetY,
      },
      boxes,
      below: touchRef.current,
    });

    // With nothing selected, none of the browser's own menus has anything to
    // attach to. Our marks stand in for the selection from here.
    //
    // The selection is non-empty — its text is what we just read — so this
    // always dirties it, and the flag is always spent on a real event.
    selfClearedRef.current = true;
    sel.removeAllRanges();
  }, [containerRef]);

  /*
   * Positioned after it exists, because where it goes depends on how big it
   * turns out to be — four buttons in a row is most of a phone's width, and
   * one centred on a selection near the edge hangs off the screen.
   *
   * A layout effect, so this lands before the browser paints and the popover is
   * never seen in the wrong place.
   */
  useLayoutEffect(() => {
    const el = popoverRef.current;
    const container = containerRef.current;
    if (!el || !container || !tooltip) return;

    const { left, top } = placePopover(
      tooltip.rect,
      {
        left: container.scrollLeft,
        top: container.scrollTop,
        width: container.clientWidth,
        height: container.clientHeight,
      },
      { width: el.offsetWidth, height: el.offsetHeight },
      tooltip.below,
    );
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }, [tooltip, containerRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const markTouch = () => {
      touchRef.current = true;
    };

    /*
     * The touch path. `selectionchange` fires continuously while a handle is
     * dragged, so it waits for the selection to settle — otherwise the popover
     * would chase the handle around the page, and taking the selection over
     * mid-drag would cut the gesture short.
     *
     * Long enough that letting go of one handle to reach for the other doesn't
     * count as having finished, short enough not to feel like a lag.
     *
     * It also fires when *we* clear the selection; that one is spoken for.
     */
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    const handleSelectionChange = () => {
      if (selfClearedRef.current) {
        selfClearedRef.current = false;
        return;
      }
      if (!touchRef.current) return;
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => capture(), 550);
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
        ref={popoverRef}
        data-selection-tooltip
        className="sel-popover fade-in"
        // left and top are set by the layout effect, which needs the rendered
        // size to work them out. Off-screen until then, so a popover is never
        // painted at the origin on its way to where it belongs.
        style={{ position: "absolute", left: -9999, top: 0, zIndex: 100 }}
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
