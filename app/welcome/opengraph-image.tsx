import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * The card that appears when someone pastes the link somewhere.
 *
 * Worth more than any amount of keyword work here: this product will be found
 * because a person put the link in a chat, and what everyone in that chat sees
 * is this image. Without one they see a grey box and a hostname.
 *
 * It makes the same argument the landing page does, in the one composition
 * that survives being 300px wide in a message thread: a page, and the thing
 * reading it alongside you.
 */

export const alt = "Studiolo — a reading companion for hard books";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#100f0e";
const PAPER = "#faf7f0";
const PAPER_INK = "#211e19";
const MARIGOLD = "#e9a13b";
const MUTED = "#8a8279";

/**
 * The display face, read off disk.
 *
 * Committed rather than fetched, and it has to be. This renders at build time,
 * and `next/og` cannot render without a font — there is no default to fall back
 * to. A version of this fetched Fraunces from Google and caught the failure;
 * pointing it at a host that does not resolve killed the build with
 * `Cannot read properties of undefined`, which is a strange way for a
 * deployment to fail over a web font. It is 11 KB, subset to the characters
 * below and nothing else. See `fonts/README.md`.
 */
const displayFont = () =>
  readFile(join(process.cwd(), "app/welcome/fonts/Fraunces-600-subset.ttf"));

export default async function Image() {
  const font = await displayFont();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: INK,
          // The warmth of the app's chrome, so the card and the site it opens
          // are recognisably the same object.
          backgroundImage: `radial-gradient(1100px 620px at 88% 12%, rgba(233,161,59,0.10), transparent 62%)`,
          padding: "64px",
          alignItems: "center",
          gap: 48,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", width: 560, flexShrink: 0 }}>
          <div
            style={{
              display: "flex",
              fontSize: 21,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: MARIGOLD,
              marginBottom: 26,
            }}
          >
            Studiolo
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontFamily: "Display",
              fontSize: 64,
              fontWeight: 600,
              lineHeight: 1.1,
              letterSpacing: -2,
              color: "#f4efe6",
            }}
          >
            {/* Broken by hand across the same three lines as the landing page,
                so the card and the page it opens read as one thing. */}
            <div style={{ display: "flex" }}>The book, and</div>
            <div style={{ display: "flex" }}>someone to</div>
            <div style={{ display: "flex" }}>think with</div>
          </div>

          <div
            style={{ display: "flex", width: 520, fontSize: 25, lineHeight: 1.45, color: MUTED, marginTop: 28 }}
          >
            A reading companion for hard books. Not a summary — the opposite.
          </div>
        </div>

        {/* The page, with the companion's mark on it. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            // Fixed rather than flexible: satori grows a flex child to fit its
            // longest line rather than wrapping it, so `flex: 1` let the card
            // push its own text off the side of the image.
            width: 464,
            flexShrink: 0,
            background: PAPER,
            borderRadius: 8,
            padding: "34px 36px",
            transform: "rotate(1.5deg)",
            boxShadow: "0 40px 90px rgba(0,0,0,0.55)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 14,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: "#9a917f",
              marginBottom: 22,
            }}
          >
            <div style={{ display: "flex" }}>Meditations</div>
            <div style={{ display: "flex" }}>8</div>
          </div>

          {/* Broken by hand, for the same reason the card's width is fixed. */}
          {[
            "The settlement made after",
            "these troubles was hardly",
            "complete when a graver",
            "danger threatened",
          ].map((line) => (
            <div
              key={line}
              style={{ display: "flex", fontSize: 22, lineHeight: 1.62, color: PAPER_INK }}
            >
              {line}
            </div>
          ))}
          {/* `alignSelf` so the mark hugs the words. Left to stretch, it fills
              the column and reads as a block of colour rather than a highlight. */}
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              fontSize: 22,
              lineHeight: 1.62,
              color: PAPER_INK,
              background: "rgba(233,161,59,0.45)",
              padding: "0 5px",
              borderRadius: 2,
            }}
          >
            the empire in the east.
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 30,
              padding: "17px 20px",
              borderRadius: 12,
              background: "#1b1917",
              color: "#efeae2",
              fontSize: 19,
              lineHeight: 1.45,
            }}
          >
            Governor of the eastern provinces, who declared himself emperor on a
            false report of Marcus&apos;s death.
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Display", data: font, weight: 600, style: "normal" }],
    },
  );
}
