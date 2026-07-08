export interface RollingSummary {
  bookId: string;
  summary: string;
  coveredUpToPage: number;
}

export interface SummaryPort {
  load(bookId: string): Promise<RollingSummary | null>;
  save(bookId: string, summary: RollingSummary): Promise<void>;
}

export interface SummaryGatewayPort {
  summarize(prompt: string): Promise<string>;
}

export interface FoldDeps {
  summaryPort: SummaryPort;
  pageText: import("../chat/types.js").PageTextPort;
  gateway: SummaryGatewayPort;
  pageThreshold: number;
}
