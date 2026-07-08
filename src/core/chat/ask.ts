import type { AskDeps, AskInput, AskEvent } from "./types.js";

export async function* ask(
  input: AskInput,
  deps: AskDeps,
): AsyncGenerator<AskEvent> {
  const pageText = await deps.pageText.getText(input.bookId, input.currentPage);

  const history = await deps.conversation.load(input.bookId);

  const messages: Array<{ role: string; content: string }> = [
    {
      role: "system",
      content: `You are a reading companion. The user is currently on page ${input.currentPage}. Here is the text of that page:\n\n${pageText}\n\nAnswer the user's question based on this page.`,
    },
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
