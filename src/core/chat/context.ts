import type { Message } from "./types.js";

export interface RetrievedChunk {
  page: number;
  text: string;
  score: number;
}

export interface RetrievalPort {
  search(
    bookId: string,
    query: string,
    maxPage: number,
    limit: number,
  ): Promise<RetrievedChunk[]>;
}

export interface ContextSlots {
  currentPageText: string;
  currentPage: number;
  retrievedChunks: RetrievedChunk[];
  recentTurns: Message[];
  rollingSummary?: string;
  question: string;
}

export interface ContextConfig {
  maxTokens: number;
  pageReserve: number;
  turnsReserve: number;
  retrievalReserve: number;
  summaryReserve: number;
  questionReserve: number;
}

const DEFAULT_CONFIG: ContextConfig = {
  maxTokens: 12000,
  pageReserve: 3000,
  turnsReserve: 2000,
  retrievalReserve: 4000,
  summaryReserve: 1500,
  questionReserve: 1000,
};

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function truncateToTokens(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "…";
}

export function assembleContext(
  slots: ContextSlots,
  config: ContextConfig = DEFAULT_CONFIG,
): string {
  const parts: string[] = [];

  parts.push(
    "You are a reading companion. Help the user understand the book they are reading. " +
    "Do NOT reveal plot points, concepts, or information from pages the user has not yet read. " +
    "Only discuss content from the provided context. " +
    "Keep answers concise and format them in Markdown: bold key terms, use short lists where they " +
    "aid scanning, and code blocks only for actual code. Avoid headings in short answers.",
  );

  const pageText = truncateToTokens(slots.currentPageText, config.pageReserve);
  parts.push(
    `The user is on page ${slots.currentPage}. Here is the text of that page:\n\n${pageText}`,
  );

  if (slots.retrievedChunks.length > 0) {
    let retrievalText = "";
    let retrievalTokens = 0;
    const included: RetrievedChunk[] = [];

    for (const chunk of slots.retrievedChunks) {
      const entry = `[Page ${chunk.page}]: ${chunk.text}\n`;
      const entryTokens = estimateTokens(entry);
      if (retrievalTokens + entryTokens > config.retrievalReserve) break;
      retrievalText += entry;
      retrievalTokens += entryTokens;
      included.push(chunk);
    }

    if (included.length > 0) {
      parts.push(
        `Relevant passages from earlier in the book:\n\n${retrievalText.trim()}`,
      );
    }
  }

  if (slots.rollingSummary) {
    const summaryText = truncateToTokens(slots.rollingSummary, config.summaryReserve);
    parts.push(`Summary of what the reader has covered so far:\n\n${summaryText}`);
  }

  if (slots.recentTurns.length > 0) {
    let turnsText = "";
    let turnsTokens = 0;
    const reversedTurns = [...slots.recentTurns].reverse();
    const keptTurns: string[] = [];

    for (const turn of reversedTurns) {
      const entry = `${turn.role}: ${turn.content}\n`;
      const entryTokens = estimateTokens(entry);
      if (turnsTokens + entryTokens > config.turnsReserve) break;
      keptTurns.unshift(entry);
      turnsTokens += entryTokens;
    }

    if (keptTurns.length > 0) {
      turnsText = keptTurns.join("");
      parts.push(
        `Recent conversation:\n\n${turnsText.trim()}`,
      );
    }
  }

  return parts.join("\n\n");
}
