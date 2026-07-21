import { describe, it, expect } from "vitest";
import { htmlToText } from "./htmlToText.js";

describe("htmlToText", () => {
  it("strips tags and keeps readable text", () => {
    const out = htmlToText("<p>Hello <em>world</em></p>");
    expect(out).toBe("Hello world");
  });

  it("drops script and style content", () => {
    const out = htmlToText(
      "<style>.x{color:red}</style><p>Keep</p><script>evil()</script>",
    );
    expect(out).toBe("Keep");
    expect(out).not.toContain("evil");
    expect(out).not.toContain("color");
  });

  it("turns block boundaries into blank-line paragraph breaks", () => {
    const out = htmlToText("<p>One</p><p>Two</p>");
    expect(out).toBe("One\n\nTwo");
  });

  it("decodes named and numeric entities", () => {
    expect(htmlToText("<p>a&amp;b</p>")).toBe("a&b");
    expect(htmlToText("<p>Chapter&#160;One</p>")).toBe("Chapter One");
    expect(htmlToText("<p>em&mdash;dash</p>")).toBe("em—dash");
  });

  it("renders list items as bullets", () => {
    const out = htmlToText("<ul><li>first</li><li>second</li></ul>");
    expect(out).toContain("• first");
    expect(out).toContain("• second");
  });

  it("collapses excess whitespace and blank lines", () => {
    const out = htmlToText("<p>a   b</p>\n\n\n\n<p>c</p>");
    expect(out).toBe("a b\n\nc");
  });
});
