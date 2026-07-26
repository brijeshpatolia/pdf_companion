import * as React from "react";
import type { ReadingCard } from "./readingCard.js";

/**
 * The share card's artwork, as data-in / JSX-out.
 *
 * Kept apart from the route so it can be rendered — and looked at — without an
 * authenticated request. Satori (what `next/og` renders with) supports only a
 * subset of CSS and throws at *request* time rather than build time, so being
 * able to render this in isolation is the difference between catching a
 * layout mistake here and catching it in production.
 *
 * Satori rules worth remembering: every element with more than one child needs
 * an explicit `display: flex`, and there is no `gap` shorthand inheritance —
 * so the styling below is more verbose than it would otherwise be.
 */

export const CARD_W = 1080;
export const CARD_H = 1350;

export function ShareCardArt({ card }: { card: ReadingCard }) {
  return (
    <div
      style={{
        width: CARD_W,
        height: CARD_H,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 80,
        background: "linear-gradient(160deg, #0b0e14 0%, #131a29 55%, #1b2740 100%)",
        color: "#e6e9ef",
        fontFamily: "Lora, serif",
      }}
    >
      {/* With a quote, this is a credit line sitting above it. Without one it
          grows to fill the card and centres, so the title reads as the subject
          rather than floating at the top of empty space. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          ...(card.variant === "title"
            ? { flex: 1, justifyContent: "center" as const }
            : {}),
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 24,
            letterSpacing: 6,
            color: "#4c8dff",
            marginBottom: 18,
          }}
        >
          {card.eyebrow}
        </div>
        <div style={{ display: "flex", fontSize: card.titleSize, lineHeight: 1.08, marginBottom: 12 }}>
          {card.title}
        </div>
        {card.author ? (
          <div style={{ display: "flex", fontSize: card.variant === "title" ? 38 : 32, color: "#9aa4b2" }}>{card.author}</div>
        ) : null}
      </div>

      {card.quote ? (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: card.quoteSize,
              lineHeight: 1.32,
              fontStyle: "italic",
              color: "#ffffff",
              marginBottom: 24,
            }}
          >
            {card.quote.source === "note" ? card.quote.text : `“${card.quote.text}”`}
          </div>
          <div style={{ display: "flex", fontSize: 26, color: "#6b7686" }}>
            {card.quoteCaption}
          </div>
        </div>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column" }}>
        {/* Where you are, spelled out. In the quote variant the page already
            sits under the quote, so this would just repeat it. */}
        {card.variant === "title" ? (
          <div style={{ display: "flex", fontSize: 28, color: "#6b7686", marginBottom: 20 }}>
            {card.progressLabel}
          </div>
        ) : null}
        <div
          style={{
            display: "flex",
            width: "100%",
            height: 8,
            background: "#232a36",
            borderRadius: 99,
            marginBottom: 28,
          }}
        >
          <div
            style={{
              display: "flex",
              width: `${Math.max(card.percent, 2)}%`,
              height: 8,
              background: "#4c8dff",
              borderRadius: 99,
            }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ display: "flex" }}>
            {card.stats.map((s) => (
              <div
                key={s.label}
                style={{ display: "flex", flexDirection: "column", marginRight: 56 }}
              >
                <div style={{ display: "flex", fontSize: 56 }}>{s.value}</div>
                <div style={{ display: "flex", fontSize: 22, color: "#9aa4b2", letterSpacing: 2 }}>
                  {s.label.toUpperCase()}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", fontSize: 22, color: "#4c8dff", letterSpacing: 2 }}>
            PDF COMPANION
          </div>
        </div>
      </div>
    </div>
  );
}
