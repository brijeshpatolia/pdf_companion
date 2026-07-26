# PDF Companion 📖

> An AI that reads with you — always on your page, holding the whole book in mind.

A reading companion for hard books. Instead of pausing to paste a page into ChatGPT — or Googling a term with none of the book's context — the AI sits beside the page you're on, **remembers everything you've read**, and answers grounded in the book itself.

**Status:** 🚀 Working MVP — split-view reader, page-aware chat, select-to-ask, local embeddings, and rolling book memory are all live.

## What works today

- **🔐 Accounts** — passwordless magic-link sign-in (Supabase Auth). Every book, highlight, chat, and page of progress is scoped to its owner by Row-Level Security.
- **📚 Library** — drag-and-drop **PDF and EPUB** upload (50 MB guardrail), live ingestion progress (`120/879 pages`), resume a stalled book or retry a failed one, delete with full storage + data cleanup.
- **📗 EPUB support** — DRM-free EPUBs are parsed and split into synthetic pages, so the whole page-aware pipeline (chat, retrieval, progress, highlights) works on them too; the reader renders them as clean prose.
- **📚 Free books catalog** — a curated shelf of public-domain "hard books" grouped by subject (Philosophy · Science & Technology · Politics & Economics — Plato, Einstein, Babbage, Darwin, Adam Smith…) plus **live search over Project Gutenberg** (via Gutendex) and the **Internet Archive**; add any title with a click and it flows through the normal EPUB ingestion. Gutendex blocks datacenter IP ranges, so a Gutenberg search that fails from the deployment falls back to the Internet Archive automatically and says so. The Internet Archive source is filtered to genuinely public-domain, non-restricted texts — it excludes the Controlled-Digital-Lending library and community uploads.
- **📖 Split-view reader** — PDF.js rendering beside the companion, keyboard navigation (`←`/`→`), jump-to-page, and a reading-progress bar. Your furthest sequentially-read page is tracked and restored.
- **💬 Page-aware companion** — streaming answers grounded in a 4-source context: the page you're on, semantically retrieved passages, a rolling summary of everything read so far, and the conversation history. Stop generation mid-stream, retry on errors.
- **✨ Select-to-ask** — highlight any passage and choose **Define · Deep Dive · ELI5**.
- **📌 Capture** — save highlights straight from the selection tooltip and star AI answers worth keeping; browse them in the companion's **Saved** tab with jump-to-page.
- **📝 Notes** — write your own free-form, editable notes anchored to the page you're on, in the companion's **Notes** tab (create, edit, delete, jump-to-page).
- **⬇ Export** — download everything you've kept for a book (highlights, saved answers, and notes) as a single Markdown file.
- **🃏 Flashcards** — generate study flashcards from what you kept (highlights, answers, notes) with the AI, add your own, and review them with a flip-card deck.
- **👥 Live co-reading** — open a room on a book and share the link. Everyone sees who else is reading, what page they're on (click to jump to them), and each other's highlights the moment they're made. Presence and highlights travel over a Supabase Realtime channel and are never stored, so nobody's annotations land in someone else's account — and each participant reads their own copy, so no book file is ever redistributed.
- **🔗 Sharing** — turn a book into a read-only public link that shows your highlights, saved answers, notes, and flashcards (never the book's text). Create it in one click, copy the link, or stop sharing anytime; visitors need no account.
- **🔎 Ask your library** — ask a question and get a streamed answer grounded in passages retrieved from across *all* your books (pgvector, RLS-scoped), with cited sources that deep-link to the exact page in the reader.
- **🧠 Local embeddings** — all-MiniLM-L6-v2 runs in-process (no embedding API cost); retrieval via Supabase pgvector.
- **🔁 Resumable ingestion** — text extraction, chunking, embedding, and status lifecycle (`uploaded → processing → ready / failed`). Pages are embedded in batches against a time budget, so book length never matters: a run that runs out of time hands off to the next one and picks up from the pages already stored.
- **📊 Usage & cost dashboard** — every answer records tokens and cost; the dashboard shows total spend, per-book and per-model breakdowns, and a daily-spend chart (all RLS-scoped to you).
- **💵 Spending limits** — AI calls bill to the operator's API key, so every reader has a rolling 24-hour and 30-day ceiling. Going over returns a clear message instead of a silent bill, and the dashboard shows the remaining budget before you get there. Configure with `USAGE_DAILY_LIMIT_USD` / `USAGE_MONTHLY_LIMIT_USD`.

## Stack

Next.js (App Router) · PDF.js / react-pdf · fflate (EPUB parsing) · Supabase (Postgres + pgvector + Auth + Storage) · OpenRouter / Anthropic gateways · @huggingface/transformers (local embedder) · Vitest

> **Note on Kindle books:** Amazon Kindle purchases are DRM-locked with no API for third-party access, so they can't be imported. EPUB (the open standard, widely sold DRM-free) is the supported path for bringing your own books.

## Getting started

See **[docs/dev.md](./docs/dev.md)** for local setup (Supabase via Docker, env vars, tests), and **[docs/deploy.md](./docs/deploy.md)** to host it on Vercel + hosted Supabase.

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

- **Phase 0 — MVP:** ✅ split-view reader + page-aware chat + select-to-ask + highlights + save-AI-answer *(done)*
- **Phase 1:** ✅ accounts · ✅ usage dashboard · ✅ notes · ✅ export *(done)* · managed AI pool, Excalidraw *(next)*
- **Phase 2:** ✅ flashcards · ✅ sharing · ✅ cross-book Q&A · ✅ live co-reading *(done)*

---

*Working name — candidates: Gloss · Marginalia · Sidenote · Codex · Recto.*
