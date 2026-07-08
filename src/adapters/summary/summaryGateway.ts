import type { GatewayPort } from "../../core/chat/types.js";
import type { SummaryGatewayPort } from "../../core/summary/types.js";

export function createSummaryGateway(
  gateway: GatewayPort,
  model: string,
): SummaryGatewayPort {
  return {
    async summarize(prompt: string): Promise<string> {
      const messages = [
        { role: "system", content: "You are a concise book summarizer." },
        { role: "user", content: prompt },
      ];

      let result = "";
      for await (const event of gateway.complete(messages, model)) {
        if (event.type === "chunk") {
          result += event.text;
        }
      }
      return result;
    },
  };
}
