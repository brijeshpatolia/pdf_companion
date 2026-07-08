import type { GatewayPort } from "../../core/chat/types.js";

export function createAnthropicGateway(apiKey: string | undefined): GatewayPort {
  return {
    async *complete(messages, model) {
      if (!apiKey) {
        const err = new Error(
          "Anthropic API key is not configured. Set ANTHROPIC_API_KEY in your .env.local file.",
        );
        (err as any).code = "missing-key";
        throw err;
      }

      const systemMsg = messages.find((m) => m.role === "system");
      const nonSystemMsgs = messages.filter((m) => m.role !== "system");

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model.replace("anthropic/", ""),
          max_tokens: 1024,
          stream: true,
          ...(systemMsg ? { system: systemMsg.content } : {}),
          messages: nonSystemMsgs.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        if (res.status === 401 || res.status === 403) {
          const err = new Error(`Invalid Anthropic API key: ${body}`);
          (err as any).code = "missing-key";
          throw err;
        }
        throw new Error(`Anthropic ${res.status}: ${body}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let tokensIn = 0;
      let tokensOut = 0;

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

            let parsed: any;
            try {
              parsed = JSON.parse(data);
            } catch {
              continue;
            }

            if (parsed.type === "content_block_delta" && parsed.delta?.text) {
              yield { type: "chunk" as const, text: parsed.delta.text };
            }

            if (parsed.type === "message_start" && parsed.message?.usage) {
              tokensIn = parsed.message.usage.input_tokens ?? 0;
            }

            if (parsed.type === "message_delta" && parsed.usage) {
              tokensOut = parsed.usage.output_tokens ?? 0;
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      yield {
        type: "usage" as const,
        tokensIn,
        tokensOut,
        costUSD: 0,
      };
    },
  };
}
