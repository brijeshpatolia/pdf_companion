export type Intent = "define" | "deep-dive" | "eli5";

const INTENT_PROMPTS: Record<Intent, (selection: string) => string> = {
  define: (s) =>
    `Define the following term or concept from the text I'm reading:\n\n"${s}"`,
  "deep-dive": (s) =>
    `Explain this passage in depth — what does it mean, why does it matter, and how does it connect to the surrounding context?\n\n"${s}"`,
  eli5: (s) =>
    `Explain this like I'm 5 — use simple language, analogies, and short sentences:\n\n"${s}"`,
};

export function buildIntentQuestion(
  intent: Intent,
  selection: string,
): string {
  return INTENT_PROMPTS[intent](selection.trim());
}
