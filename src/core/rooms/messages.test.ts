import { describe, it, expect } from "vitest";
import {
  parsePresenceMeta,
  participantsFrom,
  parseLiveHighlight,
  addHighlight,
  MAX_HIGHLIGHT_CHARS,
  MAX_NAME_CHARS,
} from "./messages.js";

describe("parsePresenceMeta", () => {
  it("accepts a well-formed entry", () => {
    expect(parsePresenceMeta({ userId: "u1", name: "Ana", page: 12 })).toEqual({
      userId: "u1",
      name: "Ana",
      page: 12,
    });
  });

  it("falls back to a neutral name when none is given", () => {
    expect(parsePresenceMeta({ userId: "u1", page: 1 })?.name).toBe("Reader");
  });

  it("clamps an overlong name from a peer", () => {
    const meta = parsePresenceMeta({ userId: "u1", page: 1, name: "n".repeat(500) });
    expect(meta?.name).toHaveLength(MAX_NAME_CHARS);
  });

  it("collapses whitespace so a peer can't stretch the layout", () => {
    expect(parsePresenceMeta({ userId: "u1", page: 1, name: "A\n\n\n   B" })?.name).toBe("A B");
  });

  it("rejects entries with no user", () => {
    expect(parsePresenceMeta({ page: 3 })).toBeNull();
  });

  it.each([[0], [-5], ["not a page"], [null], [Infinity], [NaN]])(
    "rejects an impossible page (%p)",
    (page) => {
      expect(parsePresenceMeta({ userId: "u1", page })).toBeNull();
    },
  );

  it("floors a fractional page rather than rejecting it", () => {
    expect(parsePresenceMeta({ userId: "u1", page: 12.7 })?.page).toBe(12);
  });

  it("rejects non-objects", () => {
    expect(parsePresenceMeta("hello")).toBeNull();
    expect(parsePresenceMeta(null)).toBeNull();
  });
});

describe("participantsFrom", () => {
  const state = {
    kb: [{ userId: "u2", name: "Ana", page: 8 }],
    ka: [{ userId: "u1", name: "Me", page: 3 }],
    kc: [{ userId: "u3", name: "Sam", page: 5 }],
  };

  it("puts you first, then keeps a stable order", () => {
    const list = participantsFrom(state, "ka");
    expect(list.map((p) => p.name)).toEqual(["Me", "Ana", "Sam"]);
    expect(list[0]!.isSelf).toBe(true);
    expect(list.slice(1).every((p) => !p.isSelf)).toBe(true);
  });

  it("does not reorder as pages change", () => {
    // Presence heartbeats fire constantly; the list must not jump around.
    const moved = { ...state, kb: [{ userId: "u2", name: "Ana", page: 99 }] };
    expect(participantsFrom(moved, "ka").map((p) => p.key)).toEqual(
      participantsFrom(state, "ka").map((p) => p.key),
    );
  });

  it("drops malformed entries instead of rendering them", () => {
    const dirty = { ...state, bad: [{ nonsense: true }], empty: [] };
    expect(participantsFrom(dirty, "ka")).toHaveLength(3);
  });

  it("marks nobody as self when this client isn't in the state yet", () => {
    expect(participantsFrom(state, "unknown").every((p) => !p.isSelf)).toBe(true);
  });
});

describe("parseLiveHighlight", () => {
  const raw = { id: "h1", userId: "u2", name: "Ana", page: 8, text: "the unexamined life" };

  it("accepts a well-formed highlight", () => {
    expect(parseLiveHighlight(raw, 1000)).toEqual({ ...raw, at: 1000 });
  });

  it("truncates an overlong quote from a peer", () => {
    const long = parseLiveHighlight({ ...raw, text: "x".repeat(50_000) }, 1);
    expect(long?.text).toHaveLength(MAX_HIGHLIGHT_CHARS);
  });

  it("rejects an empty quote", () => {
    expect(parseLiveHighlight({ ...raw, text: "   " }, 1)).toBeNull();
  });

  it("rejects a highlight with no page or no author", () => {
    expect(parseLiveHighlight({ ...raw, page: 0 }, 1)).toBeNull();
    expect(parseLiveHighlight({ ...raw, userId: "" }, 1)).toBeNull();
  });

  it("synthesizes an id when the peer omits one", () => {
    expect(parseLiveHighlight({ ...raw, id: undefined }, 42)?.id).toBe("u2-42");
  });
});

describe("addHighlight", () => {
  const h = (id: string) => ({ id, userId: "u", name: "Ana", page: 1, text: "t", at: 1 });

  it("puts the newest first", () => {
    expect(addHighlight([h("a")], h("b")).map((x) => x.id)).toEqual(["b", "a"]);
  });

  it("ignores a duplicate id", () => {
    // Broadcast can deliver the same event twice; it must not double up.
    expect(addHighlight([h("a")], h("a"))).toHaveLength(1);
  });

  it("caps the feed so a chatty room can't grow without bound", () => {
    let feed = [] as ReturnType<typeof h>[];
    for (let i = 0; i < 100; i++) feed = addHighlight(feed, h(`h${i}`), 20);
    expect(feed).toHaveLength(20);
    expect(feed[0]!.id).toBe("h99");
  });
});
