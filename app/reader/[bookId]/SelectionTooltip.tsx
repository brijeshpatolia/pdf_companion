"use client";

import { useEffect, useState, useCallback } from "react";
import type { Intent } from "@/core/chat/intents.js";
import Icon from "../../components/Icon";

interface SelectionTooltipProps {
  containerRef: React.RefObject<HTMLElement | null>;
  onSelect: (selection: string, intent: Intent) => void;
  onHighlight?: (selection: string) => void;
}

interface TooltipState {
  text: string;
  x: number;
  y: number;
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

  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (!text || text.length < 2) {
      setTooltip(null);
      return;
    }

    const range = sel?.getRangeAt(0);
    if (!range || !containerRef.current) return;

    if (!containerRef.current.contains(range.commonAncestorContainer)) {
      setTooltip(null);
      return;
    }

    const rect = range.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();

    setTooltip({
      text,
      x: rect.left + rect.width / 2 - containerRect.left,
      y: rect.top - containerRect.top - 8,
    });
  }, [containerRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Touch selection finalizes just after touchend; defer the read.
    const handleTouchEnd = () => setTimeout(handleMouseUp, 50);

    container.addEventListener("mouseup", handleMouseUp);
    container.addEventListener("touchend", handleTouchEnd);
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-selection-tooltip]")) {
        setTooltip(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      container.removeEventListener("mouseup", handleMouseUp);
      container.removeEventListener("touchend", handleTouchEnd);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [containerRef, handleMouseUp]);

  if (!tooltip) return null;

  return (
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
            onClick={() => {
              onHighlight(tooltip.text);
              setTooltip(null);
              window.getSelection()?.removeAllRanges();
            }}
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
          onClick={() => {
            onSelect(tooltip.text, intent);
            setTooltip(null);
            window.getSelection()?.removeAllRanges();
          }}
          style={{ whiteSpace: "nowrap" }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
