import type { GatewayPort } from "../../core/chat/types.js";
import { computeCostUSD } from "../../core/usage/pricing.js";

export function createOpenRouterGateway(apiKey: string | undefined): GatewayPort {
  return {
    async *complete(messages, model) {
      if (!apiKey) {
        const err = new Error(
          "OpenRouter API key is not configured. Set OPENROUTER_API_KEY in your .env.local file.",
        );
        (err as any).code = "missing-key";
        throw err;
      }

      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://pdf-companion.local",
        },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
          stream_options: { include_usage: true },
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        if (res.status === 401 || res.status === 403) {
          const err = new Error(`Invalid OpenRouter API key: ${body}`);
          (err as any).code = "missing-key";
          throw err;
        }
        throw new Error(`OpenRouter ${res.status}: ${body}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;
            const data = trimmed.slice(6);
            if (data === "[DONE]") continue;

            let parsed: any;
            try {
              parsed = JSON.parse(data);
            } catch {
              continue;
            }

            const delta = parsed.choices?.[0]?.delta?.content;
            if (typeof delta === "string" && delta.length > 0) {
              yield { type: "chunk" as const, text: delta };
            }

            const usage = parsed.usage;
            if (usage) {
              const tokensIn = usage.prompt_tokens ?? 0;
              const tokensOut = usage.completion_tokens ?? 0;
              yield {
                type: "usage" as const,
                tokensIn,
                tokensOut,
                costUSD: computeCostUSD(model, tokensIn, tokensOut),
              };
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    },
  };
}
