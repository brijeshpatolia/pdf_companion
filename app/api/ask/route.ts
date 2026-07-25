import { NextResponse } from "next/server";
import { supabaseUser } from "@/adapters/supabase/userClient.js";
import { supabaseLibrarySearch } from "@/adapters/supabase/supabaseLibrarySearch.js";
import { writeUsageRecord } from "@/adapters/supabase/supabaseUsage.js";
import { createOpenRouterGateway } from "@/adapters/openrouter/gateway.js";
import { createAnthropicGateway } from "@/adapters/anthropic/gateway.js";
import { embedSingle } from "@/adapters/embedder/localEmbedder.js";
import { buildLibraryQaMessages, collectSources, MAX_PASSAGES } from "@/core/library/qa.js";
import type { GatewayPort } from "@/core/chat/types.js";

export const runtime = "nodejs";
export const maxDuration = 60;

const OPENROUTER_MODEL = "anthropic/claude-sonnet-4-6";
const ANTHROPIC_MODEL = "claude-sonnet-4-6";

function resolveGateway(): { gateway: GatewayPort; model: string } {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) return { gateway: createAnthropicGateway(anthropicKey), model: ANTHROPIC_MODEL };
  return { gateway: createOpenRouterGateway(process.env.OPENROUTER_API_KEY), model: OPENROUTER_MODEL };
}

/**
 * Ask a question answered from passages drawn across the reader's whole library.
 * Streams Server-Sent Events: one `sources` event, then `chunk`s, then `done`.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const question = ((body ?? {}).question as string | undefined)?.trim();
  if (!question) return NextResponse.json({ error: "missing question" }, { status: 400 });

  const client = await supabaseUser();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let passages;
  try {
    passages = await supabaseLibrarySearch(client, embedSingle).searchAll(question, MAX_PASSAGES);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  const sources = collectSources(passages);
  const messages = buildLibraryQaMessages(question, passages);
  const { gateway, model } = resolveGateway();
  const topBook = passages[0];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        send({ type: "sources", sources });

        let usage: { tokensIn: number; tokensOut: number; costUSD: number } | null = null;
        for await (const event of gateway.complete(messages, model)) {
          if (event.type === "chunk") send({ type: "chunk", text: event.text });
          else if (event.type === "usage") usage = event;
        }

        // Cross-book spend is attributed to the top-matched book so it still
        // shows in the usage dashboard (best-effort; never blocks the response).
        if (usage && topBook) {
          await writeUsageRecord(client, topBook.bookId, { ...usage, model }).catch(() => {});
        }

        send({ type: "done" });
      } catch (err) {
        const code = (err as { code?: string }).code ?? "gateway-error";
        send({ type: "error", code, message: (err as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
