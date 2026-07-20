# PDF Companion 📖

> An AI that reads with you — always on your page, holding the whole book in mind.

A reading companion for hard books. Instead of pausing to paste a page into ChatGPT — or Googling a term with none of the book's context — the AI sits beside the page you're on, **remembers everything you've read**, and answers grounded in the book itself.

**Status:** 🚀 Working MVP — split-view reader, page-aware chat, select-to-ask, local embeddings, and rolling book memory are all live.

## What works today

- **📚 Library** — drag-and-drop PDF upload (50 MB guardrail), live ingestion status, retry failed ingestions, delete with full storage + data cleanup.
- **📖 Split-view reader** — PDF.js rendering beside the companion, keyboard navigation (`←`/`→`), jump-to-page, and a reading-progress bar. Your furthest sequentially-read page is tracked and restored.
- **💬 Page-aware companion** — streaming answers grounded in a 4-source context: the page you're on, semantically retrieved passages, a rolling summary of everything read so far, and the conversation history. Stop generation mid-stream, retry on errors.
- **✨ Select-to-ask** — highlight any passage and choose **Define · Deep Dive · ELI5**.
- **🧠 Local embeddings** — all-MiniLM-L6-v2 runs in-process (no embedding API cost); retrieval via Supabase pgvector.
- **🔁 Ingestion pipeline** — text extraction, chunking, embedding, and status lifecycle (`uploaded → processing → ready / failed`) with retry.

## Stack

Next.js (App Router) · PDF.js / react-pdf · Supabase (Postgres + pgvector + Storage) · OpenRouter / Anthropic gateways · @huggingface/transformers (local embedder) · Vitest

## Getting started

See **[docs/dev.md](./docs/dev.md)** for local setup (Supabase via Docker, env vars, tests).

```bash
npm install
npx supabase start   # local Postgres + Storage, migrations auto-applied
npm run dev
```

```bash
npm test             # unit tests (no Docker needed)
npm run typecheck    # tsc --noEmit
```

## Full spec

The complete product spec lives in **[SPEC.md](./SPEC.md)** — problem, feature map, AI & pricing model, sharing, architecture, tech stack, MVP scope, and roadmap. A polished web version is in [`pdf-companion-spec.html`](./pdf-companion-spec.html).

## Roadmap

- **Phase 0 — MVP:** ✅ split-view reader + page-aware chat + select-to-ask *(done)* · highlights + save-AI-answer *(next)*
- **Phase 1:** accounts, managed AI pool + usage dashboard, notes, Excalidraw, export
- **Phase 2:** sharing, flashcards, sync, live co-reading, cross-book Q&A

---

*Working name — candidates: Gloss · Marginalia · Sidenote · Codex · Recto.*
