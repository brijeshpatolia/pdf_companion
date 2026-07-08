"use client";

import { useEffect, useState, useCallback } from "react";
import type { Intent } from "@/core/chat/intents.js";

interface SelectionTooltipProps {
  containerRef: React.RefObject<HTMLElement | null>;
  onSelect: (selection: string, intent: Intent) => void;
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

    container.addEventListener("mouseup", handleMouseUp);
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-selection-tooltip]")) {
        setTooltip(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      container.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [containerRef, handleMouseUp]);

  if (!tooltip) return null;

  return (
    <div
      data-selection-tooltip
      style={{
        position: "absolute",
        left: tooltip.x,
        top: tooltip.y,
        transform: "translate(-50%, -100%)",
        display: "flex",
        gap: "0.25rem",
        padding: "0.35rem 0.5rem",
        background: "#1a1f2e",
        border: "1px solid #2d3548",
        borderRadius: 8,
        boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
        zIndex: 100,
      }}
    >
      {INTENTS.map(({ intent, label }) => (
        <button
          key={intent}
          onClick={() => {
            onSelect(tooltip.text, intent);
            setTooltip(null);
            window.getSelection()?.removeAllRanges();
          }}
          style={{
            background: "none",
            border: "1px solid #3d4558",
            borderRadius: 6,
            color: "#e2e8f0",
            padding: "0.3rem 0.6rem",
            cursor: "pointer",
            fontSize: "0.8rem",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
