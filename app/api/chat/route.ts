import { type NextRequest, NextResponse } from "next/server";
import { ask } from "../../../src/core/chat/ask.js";
import type { AskDeps } from "../../../src/core/chat/types.js";
import { supabaseUser } from "../../../src/adapters/supabase/userClient.js";
import { createOpenRouterGateway } from "../../../src/adapters/openrouter/gateway.js";
import { createAnthropicGateway } from "../../../src/adapters/anthropic/gateway.js";
import { supabaseConversation } from "../../../src/adapters/supabase/supabaseConversation.js";
import { supabasePageText } from "../../../src/adapters/supabase/supabasePageText.js";
import { supabaseRetrieval } from "../../../src/adapters/supabase/supabaseRetrieval.js";
import { supabaseProgress } from "../../../src/adapters/supabase/supabaseProgress.js";
import { getProgress } from "../../../src/core/progress/progress.js";
import { embedSingle } from "../../../src/adapters/embedder/localEmbedder.js";
import { supabaseSummary } from "../../../src/adapters/supabase/supabaseSummary.js";
import { createSummaryGateway } from "../../../src/adapters/summary/summaryGateway.js";
import { writeUsageRecord } from "../../../src/adapters/supabase/supabaseUsage.js";
import type { GatewayPort } from "../../../src/core/chat/types.js";

const OPENROUTER_MODEL = "anthropic/claude-sonnet-4-6";
const ANTHROPIC_MODEL = "claude-sonnet-4-6";

function resolveGateway(): { gateway: GatewayPort; model: string } {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    return { gateway: createAnthropicGateway(anthropicKey), model: ANTHROPIC_MODEL };
  }
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  return { gateway: createOpenRouterGateway(openrouterKey), model: OPENROUTER_MODEL };
}

export async function GET(req: NextRequest) {
  const bookId = req.nextUrl.searchParams.get("bookId");
  if (!bookId) return NextResponse.json([], { status: 200 });

  const client = await supabaseUser();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const conv = supabaseConversation(client);
  const messages = await conv.load(bookId);
  return NextResponse.json(messages);
}

export async function POST(req: NextRequest) {
  let body: { bookId?: string; currentPage?: number; question?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { bookId, currentPage, question } = body;
  if (!bookId || typeof currentPage !== "number" || !question) {
    return new Response("Missing bookId, currentPage, or question", { status: 400 });
  }

  const client = await supabaseUser();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const { gateway, model } = resolveGateway();

  const progress = await getProgress(bookId, supabaseProgress(client));

  const pageTextPort = supabasePageText(client);

  const deps: AskDeps = {
    gateway,
    pageText: pageTextPort,
    conversation: supabaseConversation(client),
    retrieval: supabaseRetrieval(client, embedSingle),
    summaryDeps: {
      summaryPort: supabaseSummary(client),
      pageText: pageTextPort,
      gateway: createSummaryGateway(gateway, model),
      pageThreshold: 5,
    },
    furthestReadPage: progress.furthestReadPage,
    model,
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of ask({ bookId, currentPage, question }, deps)) {
          if (event.type === "chunk") {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "chunk", text: event.text })}\n\n`));
          } else if (event.type === "done") {
            await writeUsageRecord(client, bookId, event.usage);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done", usage: event.usage })}\n\n`));
          } else if (event.type === "error") {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", code: event.code, message: event.message })}\n\n`));
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", code: "gateway-error", message })}\n\n`));
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
