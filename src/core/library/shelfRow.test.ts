import { describe, it, expect } from "vitest";
import {
  shelfRow,
  spineColour,
  spineInk,
  shelfSummary,
  SPINE_COLOURS,
} from "./shelfRow.js";

const book = (over: Partial<Parameters<typeof shelfRow>[0]> = {}) => ({
  id: "b1",
  title: "Meditations",
  page_count: 312,
  status: "ready",
  ...over,
});

describe("shelfRow", () => {
  it("calls a started book 'reading' and shows the page", () => {
    // The database has no 'reading' status — it's derived, and it's the state
    // most rows will be in.
    const r = shelfRow(book({ current_page: 84 }));
    expect(r.state).toBe("reading");
    expect(r.right).toBe("p. 84");
    expect(r.percent).toBe(27);
  });

  it("treats page 1 as not yet started", () => {
    // Opening a book and reading nothing shouldn't claim progress.
    expect(shelfRow(book({ current_page: 1 })).state).toBe("ready");
  });

  it("shows a ready book as a full inert bar", () => {
    const r = shelfRow(book());
    expect(r.state).toBe("ready");
    expect(r.percent).toBe(100);
    expect(r.right).toBe("Start");
  });

  it("reports concrete counts while processing", () => {
    const r = shelfRow(book({ status: "processing", pages_done: 318, page_count: 502 }));
    expect(r.state).toBe("processing");
    expect(r.meta).toBe("embedding 318 of 502");
    expect(r.right).toBe("63%");
  });

  it("lets you read a book that is still embedding", () => {
    expect(shelfRow(book({ status: "processing", pages_done: 10 })).openable).toBe(true);
  });

  it("treats a queued book as processing, not as ready", () => {
    expect(shelfRow(book({ status: "uploaded" })).state).toBe("processing");
  });

  it("refuses to open a failed book, and leaves the retry to the button", () => {
    // The row already renders a Retry control; a "Retry" readout beside it
    // reads as a second, different offer.
    const r = shelfRow(book({ status: "failed" }));
    expect(r.right).toBe("");
    expect(r.openable).toBe(false);
  });

  it("never exceeds 100% when a stale page overruns the count", () => {
    expect(shelfRow(book({ current_page: 400, page_count: 312 })).percent).toBe(100);
  });

  it("survives a book with no page count", () => {
    const r = shelfRow(book({ page_count: 0, status: "processing", pages_done: 0 }));
    expect(r.percent).toBe(0);
    expect(r.right).toBe("—");
  });

  it("gives all four states a distinct label", () => {
    const labels = [
      shelfRow(book({ current_page: 5 })).label,
      shelfRow(book()).label,
      shelfRow(book({ status: "processing" })).label,
      shelfRow(book({ status: "failed" })).label,
    ];
    expect(new Set(labels).size).toBe(4);
  });
});

describe("spineColour", () => {
  it("is stable for the same book", () => {
    expect(spineColour("abc-123")).toBe(spineColour("abc-123"));
  });

  it("only ever returns a colour from the set", () => {
    for (const id of ["a", "bb", "ccc", "a-long-uuid-like-string", ""]) {
      expect(SPINE_COLOURS).toContain(spineColour(id) as (typeof SPINE_COLOURS)[number]);
    }
  });

  it("spreads different books across the set", () => {
    const seen = new Set(Array.from({ length: 40 }, (_, i) => spineColour(`book-${i}`)));
    expect(seen.size).toBeGreaterThan(3);
  });

  it("does not give near-identical short ids all the same spine", () => {
    // The original hash mixed its low bits too little, and four books added in
    // a row all came out the same brown. Four items across eight colours will
    // collide sometimes by chance — what must not happen is all of them
    // landing together.
    const seen = new Set(["aa11", "bb22", "cc33", "dd44"].map(spineColour));
    expect(seen.size).toBeGreaterThan(1);
  });

  it("spreads real book ids evenly across the whole set", () => {
    // The property that actually matters: book ids are UUIDs, and every
    // colour should be roughly as likely as every other.
    // Deterministic, but with the character-level variety a real UUID has —
    // ids that differ only in a shared template don't exercise the hash.
    let seed = 12345;
    const uuid = () => {
      let s = "";
      for (let i = 0; i < 32; i++) {
        seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
        s += ((seed >>> 16) & 15).toString(16);
      }
      return s;
    };
    const counts = new Map<string, number>();
    for (let i = 0; i < 4000; i++) {
      const c = spineColour(uuid());
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    expect(counts.size).toBe(SPINE_COLOURS.length);
    const values = [...counts.values()];
    expect(Math.max(...values) / Math.min(...values)).toBeLessThan(1.6);
  });

  it("puts dark lettering on the one pale spine", () => {
    expect(spineInk("#e8dcc4")).toBe("#211e19");
    expect(spineInk("#3f5b45")).toBe("#efeae2");
  });
});

describe("shelfSummary", () => {
  it("says something honest about an empty shelf", () => {
    expect(shelfSummary([])).toBe("Nothing here yet.");
  });

  it("counts books and pages actually read", () => {
    const s = shelfSummary([book({ current_page: 84 }), book({ id: "b2", current_page: 21 })]);
    expect(s).toContain("2 books");
    expect(s).toContain("103 pages read"); // 83 + 20
  });

  it("omits the pages clause when nothing has been read", () => {
    expect(shelfSummary([book()])).toBe("1 book");
  });

  it("appends the last-opened book when there is one", () => {
    expect(shelfSummary([book({ current_page: 9 })], "Meditations")).toContain(
      "last opened Meditations",
    );
  });
});
