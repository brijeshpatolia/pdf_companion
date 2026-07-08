import type { FoldDeps, RollingSummary } from "./types.js";

const MAX_PAGES_PER_FOLD = 10;

export async function maybeFoldSummary(
  bookId: string,
  furthestReadPage: number,
  deps: FoldDeps,
): Promise<RollingSummary | null> {
  const existing = await deps.summaryPort.load(bookId);
  const coveredUpTo = existing?.coveredUpToPage ?? 0;

  const unfolded = furthestReadPage - coveredUpTo;
  if (unfolded < deps.pageThreshold) {
    return existing;
  }

  const foldEnd = Math.min(coveredUpTo + MAX_PAGES_PER_FOLD, furthestReadPage);
  const pageTexts: string[] = [];
  for (let p = coveredUpTo + 1; p <= foldEnd; p++) {
    try {
      const text = await deps.pageText.getText(bookId, p);
      if (text.trim()) pageTexts.push(`[Page ${p}]: ${text}`);
    } catch {
      // skip pages that fail to load
    }
  }

  if (pageTexts.length === 0) {
    return existing;
  }

  const previousSummary = existing?.summary ?? "";
  const prompt = buildFoldPrompt(previousSummary, pageTexts, coveredUpTo + 1, foldEnd);
  const newSummary = await deps.gateway.summarize(prompt);

  const result: RollingSummary = {
    bookId,
    summary: newSummary,
    coveredUpToPage: foldEnd,
  };

  await deps.summaryPort.save(bookId, result);
  return result;
}

function buildFoldPrompt(
  previousSummary: string,
  pageTexts: string[],
  fromPage: number,
  toPage: number,
): string {
  const parts: string[] = [];

  parts.push(
    "You are summarizing a book incrementally as the reader progresses. " +
    "Produce a concise running summary that captures the key ideas, arguments, and narrative so far. " +
    "Do NOT include information beyond what is provided. Keep the summary under 500 words.",
  );

  if (previousSummary) {
    parts.push(`Previous summary (up to page ${fromPage - 1}):\n${previousSummary}`);
  }

  parts.push(
    `New pages (${fromPage}–${toPage}):\n\n${pageTexts.join("\n\n")}`,
  );

  parts.push("Updated running summary:");

  return parts.join("\n\n");
}
