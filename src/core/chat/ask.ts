import type { AskDeps, AskInput, AskEvent } from "./types.js";
import { assembleContext } from "./context.js";
import { maybeFoldSummary } from "../summary/fold.js";

export async function* ask(
  input: AskInput,
  deps: AskDeps,
): AsyncGenerator<AskEvent> {
  const pageText = await deps.pageText.getText(input.bookId, input.currentPage);

  const history = await deps.conversation.load(input.bookId);

  const maxPage = deps.furthestReadPage ?? input.currentPage;
  let retrievedChunks: import("./context.js").RetrievedChunk[] = [];
  if (deps.retrieval) {
    try {
      retrievedChunks = await deps.retrieval.search(
        input.bookId,
        input.question,
        maxPage,
        5,
      );
    } catch {
      // retrieval failure is non-fatal — continue without chunks
    }
  }

  let rollingSummary: string | undefined;
  if (deps.summaryDeps) {
    try {
      const folded = await maybeFoldSummary(input.bookId, maxPage, deps.summaryDeps);
      rollingSummary = folded?.summary || undefined;
    } catch {
      // summary fold failure is non-fatal
    }
  }

  const systemContent = assembleContext({
    currentPageText: pageText,
    currentPage: input.currentPage,
    retrievedChunks,
    recentTurns: history,
    rollingSummary,
    question: input.question,
  });

  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: systemContent },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: input.question },
  ];

  let fullAnswer = "";
  let usage: { tokensIn: number; tokensOut: number; costUSD: number } | null = null;

  try {
    for await (const event of deps.gateway.complete(messages, deps.model)) {
      if (event.type === "chunk") {
        fullAnswer += event.text;
        yield { type: "chunk", text: event.text };
      } else if (event.type === "usage") {
        usage = { tokensIn: event.tokensIn, tokensOut: event.tokensOut, costUSD: event.costUSD };
      }
    }
  } catch (err: unknown) {
    const code = (err as any)?.code === "missing-key" ? "missing-key" as const : "gateway-error" as const;
    const message = err instanceof Error ? err.message : "Unknown gateway error";
    yield { type: "error", code, message };
    return;
  }

  await deps.conversation.append(input.bookId, [
    { role: "user", content: input.question },
    { role: "assistant", content: fullAnswer },
  ]);

  if (usage) {
    yield {
      type: "done",
      usage: { ...usage, model: deps.model },
    };
  }
}
