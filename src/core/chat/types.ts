export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface UsageRecord {
  tokensIn: number;
  tokensOut: number;
  model: string;
  costUSD: number;
}

export type AskEvent =
  | { type: "chunk"; text: string }
  | { type: "done"; usage: UsageRecord }
  | { type: "error"; code: "gateway-error" | "missing-key"; message: string };

export interface GatewayPort {
  complete(
    messages: Array<{ role: string; content: string }>,
    model: string,
  ): AsyncIterable<
    | { type: "chunk"; text: string }
    | { type: "usage"; tokensIn: number; tokensOut: number; costUSD: number }
  >;
}

export interface PageTextPort {
  getText(bookId: string, page: number): Promise<string>;
}

export interface ConversationPort {
  load(bookId: string): Promise<Message[]>;
  append(bookId: string, messages: Message[]): Promise<void>;
}

export interface AskDeps {
  gateway: GatewayPort;
  pageText: PageTextPort;
  conversation: ConversationPort;
  retrieval?: import("./context.js").RetrievalPort;
  summaryDeps?: import("../summary/types.js").FoldDeps;
  furthestReadPage?: number;
  model: string;
}

export interface AskInput {
  bookId: string;
  currentPage: number;
  question: string;
}
