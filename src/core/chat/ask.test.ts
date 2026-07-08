import { describe, it, expect } from "vitest";
import { ask } from "./ask.js";
import type {
  AskDeps,
  AskEvent,
  GatewayPort,
  PageTextPort,
  ConversationPort,
  Message,
} from "./types.js";

// ── Fakes ──────────────────────────────────────────────────────────

function fakeGateway(answer = "42"): GatewayPort & { lastMessages: Array<{ role: string; content: string }> | null } {
  const gw = {
    lastMessages: null as Array<{ role: string; content: string }> | null,
    async *complete(messages: Array<{ role: string; content: string }>, _model: string) {
      gw.lastMessages = messages;
      yield { type: "chunk" as const, text: answer };
      yield { type: "usage" as const, tokensIn: 10, tokensOut: 5, costUSD: 0.001 };
    },
  };
  return gw;
}

function fakePageText(pages: Record<string, Record<number, string>>): PageTextPort {
  return {
    async getText(bookId: string, page: number) {
      return pages[bookId]?.[page] ?? "";
    },
  };
}

function fakeConversation(): ConversationPort {
  const store = new Map<string, Message[]>();
  return {
    async load(bookId) {
      return store.get(bookId) ?? [];
    },
    async append(bookId, messages) {
      const existing = store.get(bookId) ?? [];
      store.set(bookId, [...existing, ...messages]);
    },
  };
}

function makeDeps(overrides?: Partial<AskDeps>): AskDeps {
  return {
    gateway: fakeGateway(),
    pageText: fakePageText({ "book-1": { 1: "Page one content.", 2: "Page two content." } }),
    conversation: fakeConversation(),
    model: "test-model",
    ...overrides,
  };
}

async function collect(iter: AsyncIterable<AskEvent>): Promise<AskEvent[]> {
  const events: AskEvent[] = [];
  for await (const e of iter) events.push(e);
  return events;
}

// ── Tests ──────────────────────────────────────────────────────────

describe("ask", () => {
  it("grounds the prompt on the current page text (H6)", async () => {
    const gw = fakeGateway("Socrates was wise.");
    const deps = makeDeps({ gateway: gw });

    await collect(ask({ bookId: "book-1", currentPage: 1, question: "Who is this about?" }, deps));

    expect(gw.lastMessages).not.toBeNull();
    const systemMsg = gw.lastMessages!.find((m) => m.role === "system");
    expect(systemMsg?.content).toContain("Page one content.");
  });

  it("after a page turn, grounds on the new page", async () => {
    const gw = fakeGateway("Answer about page 2.");
    const deps = makeDeps({ gateway: gw });

    await collect(ask({ bookId: "book-1", currentPage: 1, question: "First?" }, deps));
    await collect(ask({ bookId: "book-1", currentPage: 2, question: "Second?" }, deps));

    const systemMsg = gw.lastMessages!.find((m) => m.role === "system");
    expect(systemMsg?.content).toContain("Page two content.");
    expect(systemMsg?.content).not.toContain("Page one content.");
  });

  it("emits a UsageRecord with tokens, model, and cost", async () => {
    const deps = makeDeps();
    const events = await collect(ask({ bookId: "book-1", currentPage: 1, question: "Hello?" }, deps));

    const done = events.find((e) => e.type === "done");
    expect(done).toEqual({
      type: "done",
      usage: { tokensIn: 10, tokensOut: 5, model: "test-model", costUSD: 0.001 },
    });
  });

  it("persists conversation and includes history in next ask", async () => {
    const gw = fakeGateway("Second answer.");
    const conv = fakeConversation();
    const deps = makeDeps({ gateway: gw, conversation: conv });

    await collect(ask({ bookId: "book-1", currentPage: 1, question: "First question" }, deps));
    await collect(ask({ bookId: "book-1", currentPage: 1, question: "Follow-up" }, deps));

    const userMsgs = gw.lastMessages!.filter((m) => m.role === "user");
    expect(userMsgs).toHaveLength(2);
    expect(userMsgs[0]!.content).toBe("First question");
    expect(userMsgs[1]!.content).toBe("Follow-up");

    const assistantMsgs = gw.lastMessages!.filter((m) => m.role === "assistant");
    expect(assistantMsgs).toHaveLength(1);
    expect(assistantMsgs[0]!.content).toBe("Second answer.");
  });

  it("surfaces gateway error as a retryable error event", async () => {
    const errorGw: GatewayPort = {
      async *complete() {
        throw new Error("upstream 502");
      },
    };
    const deps = makeDeps({ gateway: errorGw });

    const events = await collect(ask({ bookId: "book-1", currentPage: 1, question: "Boom?" }, deps));

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "error", code: "gateway-error" });
  });

  it("surfaces missing key as a distinct actionable error", async () => {
    const noKeyGw: GatewayPort = {
      async *complete() {
        const err = new Error("invalid api key");
        (err as any).code = "missing-key";
        throw err;
      },
    };
    const deps = makeDeps({ gateway: noKeyGw });

    const events = await collect(ask({ bookId: "book-1", currentPage: 1, question: "No key?" }, deps));

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "error", code: "missing-key" });
  });
});
