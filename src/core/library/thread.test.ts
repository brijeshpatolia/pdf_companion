import { describe, it, expect } from "vitest";
import { toExchanges, newestFirst, parseSources, type StoredMessage } from "./thread.js";

const msg = (over: Partial<StoredMessage> & Pick<StoredMessage, "role" | "content">): StoredMessage => ({
  id: Math.random().toString(36).slice(2),
  ...over,
});

describe("toExchanges", () => {
  it("pairs a question with the answer that followed it", () => {
    const out = toExchanges([
      msg({ role: "user", content: "What do these books disagree about?" }),
      msg({
        role: "assistant",
        content: "Chiefly the status of the state.",
        sources: [{ bookId: "b1", bookTitle: "The Republic", pages: [7, 12] }],
      }),
    ]);

    expect(out).toHaveLength(1);
    expect(out[0]!.question).toBe("What do these books disagree about?");
    expect(out[0]!.answer).toBe("Chiefly the status of the state.");
    expect(out[0]!.sources[0]!.pages).toEqual([7, 12]);
    expect(out[0]!.unanswered).toBe(false);
  });

  it("keeps a question whose answer never arrived", () => {
    // The request can fail after the question is written. Dropping it would
    // make the thread quietly lose something the reader typed.
    const out = toExchanges([msg({ role: "user", content: "Where have I read about attention?" })]);
    expect(out).toHaveLength(1);
    expect(out[0]!.unanswered).toBe(true);
    expect(out[0]!.answer).toBeUndefined();
  });

  it("does not attach an answer to an exchange that already has one", () => {
    const out = toExchanges([
      msg({ role: "user", content: "Q1" }),
      msg({ role: "assistant", content: "A1" }),
      msg({ role: "assistant", content: "A2" }),
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]!.answer).toBe("A1");
    expect(out[1]!.answer).toBe("A2");
    expect(out[1]!.question).toBe("");
  });

  it("keeps an orphaned answer rather than dropping it", () => {
    const out = toExchanges([msg({ role: "assistant", content: "An answer with no question." })]);
    expect(out).toHaveLength(1);
    expect(out[0]!.answer).toBe("An answer with no question.");
  });

  it("handles several exchanges in a row", () => {
    const out = toExchanges([
      msg({ role: "user", content: "Q1" }),
      msg({ role: "assistant", content: "A1" }),
      msg({ role: "user", content: "Q2" }),
      msg({ role: "assistant", content: "A2" }),
    ]);
    expect(out.map((e) => [e.question, e.answer])).toEqual([
      ["Q1", "A1"],
      ["Q2", "A2"],
    ]);
  });

  it("is empty for an empty history", () => {
    expect(toExchanges([])).toEqual([]);
  });

  it("treats a missing sources column as no sources", () => {
    const out = toExchanges([
      msg({ role: "user", content: "Q" }),
      msg({ role: "assistant", content: "A", sources: null }),
    ]);
    expect(out[0]!.sources).toEqual([]);
  });
});

describe("newestFirst", () => {
  it("reverses without mutating the input", () => {
    const input = toExchanges([
      msg({ role: "user", content: "Q1" }),
      msg({ role: "assistant", content: "A1" }),
      msg({ role: "user", content: "Q2" }),
      msg({ role: "assistant", content: "A2" }),
    ]);
    expect(newestFirst(input).map((e) => e.question)).toEqual(["Q2", "Q1"]);
    expect(input.map((e) => e.question)).toEqual(["Q1", "Q2"]);
  });
});

describe("parseSources", () => {
  it("keeps well-formed sources", () => {
    expect(parseSources([{ bookId: "b1", bookTitle: "The Republic", pages: [7, 12] }])).toEqual([
      { bookId: "b1", bookTitle: "The Republic", pages: [7, 12] },
    ]);
  });

  it("drops a source with no pages, which would cite nowhere", () => {
    expect(parseSources([{ bookId: "b1", bookTitle: "The Republic", pages: [] }])).toEqual([]);
  });

  it("drops junk page numbers but keeps the real ones", () => {
    const out = parseSources([
      { bookId: "b1", bookTitle: "T", pages: [3, "x", null, 0, -2, NaN, 9] },
    ]);
    expect(out[0]!.pages).toEqual([3, 9]);
  });

  it("survives anything that isn't a list of sources", () => {
    // This column is jsonb — it can hold whatever was written to it, including
    // by a future version of the app.
    for (const junk of [null, undefined, {}, "sources", 7, [null], [{}], [{ bookId: "" }]]) {
      expect(parseSources(junk)).toEqual([]);
    }
  });
});
