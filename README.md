# Studiolo 📖

> The book, and someone to think with.

**A reading companion for hard books.** Instead of pausing to paste a page into ChatGPT — or Googling a term with none of the book's context — the companion sits beside the page you're on, **remembers everything you've read**, and answers grounded in the book itself.

*A* studiolo *was the small private room a Renaissance reader kept for study and contemplation — Federico da Montefeltro's at Urbino has walls inlaid with trompe-l'œil books. One lit page, and quiet around it. That is the room this is trying to be.*

### What it isn't

Not a summariser. Blinkist, "TL;DR this PDF" and "read 100 books a year" all optimise for getting *through* a book. This optimises for getting *it* — the Critique, the Republic, *Designing Data-Intensive Applications*: the ones you'd finish if you had someone to read them with. Nothing here is built to help you skip the book.

**Status:** 🚀 Working MVP — split-view reader, page-aware chat, select-to-ask, local embeddings, and rolling book memory are all live.

## What works today

- **📱 Installable, and built for a phone** — add it to a home screen and it opens without a browser bar: manifest, maskable icons, a bottom nav, and a reader that fits the screen. Every screen is tested at phone size in CI, asserting against the *viewport* rather than the document. A small service worker makes it installable and gives an offline tab something true to say; books live on the server, so this isn't an offline reading mode and doesn't pretend to be.
- **🎨 One visual language** — a warm-ink design system in `app/globals.css` (plain CSS custom properties, no Tailwind): dark chrome so the cream page is the only lit object on screen, marigold reserved for the AI, citations, progress and one primary action per screen, and an inline SVG icon set in place of emoji. A public landing page at `/welcome` is where signed-out visitors arrive.
- **🔐 Accounts** — passwordless magic-link sign-in (Supabase Auth). Every book, highlight, chat, and page of progress is scoped to its owner by Row-Level Security.
- **📚 Library** — drag-and-drop **PDF and EPUB** upload (50 MB guardrail), live ingestion progress (`120/879 pages`), resume a stalled book or retry a failed one, delete with full storage + data cleanup.
- **📗 EPUB support** — DRM-free EPUBs are parsed and split into synthetic pages, so the whole page-aware pipeline (chat, retrieval, progress, highlights) works on them too; the reader renders them as clean prose.
- **📚 Free books catalog** — a curated shelf of public-domain "hard books" grouped by subject (Philosophy · Science & Technology · Politics & Economics — Plato, Einstein, Babbage, Darwin, Adam Smith…) plus **live search over Project Gutenberg** (via Gutendex) and the **Internet Archive**; add any title with a click and it flows through the normal EPUB ingestion. Gutendex blocks datacenter IP ranges, so a Gutenberg search that fails from the deployment falls back to the Internet Archive automatically and says so. The Internet Archive source is filtered to genuinely public-domain, non-restricted texts — it excludes the Controlled-Digital-Lending library and community uploads.
- **📖 Split-view reader** — PDF.js rendering beside the companion, keyboard navigation (`←`/`→`), jump-to-page, and a reading-progress bar. Your furthest sequentially-read page is tracked and restored. Pages **turn** rather than swap: the page you're leaving is cloned, pixels and all, and pivots on the spine while the next one is revealed underneath — forward it lifts away, back it swings in over. A jump of more than one page dissolves instead, because one leaf means one page. EPUB text for the pages either side is fetched ahead, so a turn lands on words rather than a spinner, and a reader who has asked their system for less motion just gets the next page.
- **💬 Page-aware companion** — streaming answers grounded in a 4-source context: the page you're on, semantically retrieved passages, a rolling summary of everything read so far, and the conversation history. Stop generation mid-stream, retry on errors.
- **✨ Select-to-ask** — highlight any passage and choose **Define · Deep Dive · ELI5**.
- **📌 Capture** — save highlights straight from the selection tooltip and star AI answers worth keeping; browse them in the companion's **Saved** tab with jump-to-page.
- **📝 Notes** — write your own free-form, editable notes anchored to the page you're on, in the companion's **Notes** tab (create, edit, delete, jump-to-page).
- **⬇ Export** — download everything you've kept for a book (highlights, saved answers, and notes) as a single Markdown file.
- **🃏 Flashcards** — generate study flashcards from what you kept (highlights, answers, notes) with the AI, add your own, and review them with a flip-card deck.
- **👥 Live co-reading** — open a room on a book and share the link. Everyone sees who else is reading, what page they're on (click to jump to them), and each other's highlights the moment they're made. Presence and highlights travel over a Supabase Realtime channel and are never stored, so nobody's annotations land in someone else's account — and each participant reads their own copy, so no book file is ever redistributed.
- **📸 Shareable reading card** — a Strava-style image of what you're reading: the highlight that stopped you, set in serif, over your progress and counts. Sized for Instagram; on a phone the share sheet hands it straight to any app.
- **🔗 Sharing** — turn a book into a read-only public link that shows your highlights, saved answers, notes, and flashcards (never the book's text). Create it in one click, copy the link, or stop sharing anytime; visitors need no account.
- **🔎 Ask your library** — ask a question and get a streamed answer grounded in passages retrieved from across *all* your books (pgvector, RLS-scoped), with cited sources that deep-link to the exact page in the reader. The thread is kept, so reloading the tab doesn't throw away what you asked; clear it whenever you like.
- **🧠 Local embeddings** — bge-small-en-v1.5 runs in-process (no embedding API cost); retrieval via Supabase pgvector. Retrieval quality is **measured, not asserted**: 52 hand-labelled questions against a real book, `npm run eval`. Currently 75.0% hit@5, MRR 0.601 — up from 51.9% / 0.393 on the previous model, which is why it changed. See `src/core/eval/README.md`.
- **🔁 Resumable ingestion** — text extraction, chunking, embedding, and status lifecycle (`uploaded → processing → ready / failed`). Pages are embedded in batches against a time budget, so book length never matters: a run that runs out of time hands off to the next one and picks up from the pages already stored.
- **📊 Usage & cost dashboard** — every answer records tokens and cost; the dashboard shows total spend, per-book and per-model breakdowns, and a daily-spend chart (all RLS-scoped to you).
- **💵 Spending limits** — AI calls bill to the operator's API key, so every reader has a rolling 24-hour and 30-day ceiling. Going over returns a clear message instead of a silent bill, and the dashboard shows the remaining budget before you get there. Configure with `USAGE_DAILY_LIMIT_USD` / `USAGE_MONTHLY_LIMIT_USD`.

## Stack

Next.js (App Router) · PDF.js / react-pdf · fflate (EPUB parsing) · Supabase (Postgres + pgvector + Auth + Storage) · OpenRouter / Anthropic gateways · @huggingface/transformers (local embedder) · Vitest · Playwright (component + phone-size tests)

> **On tests:** the domain logic is pure and tested with Vitest against injected fakes. A handful of behaviours only *exist* in a browser — text selection, DOM event order, whether a click is dispatched at all, whether something is actually on screen — so those run in real Chromium: `npm run test:browser` mounts components in isolation, `npm run test:e2e` loads whole pages at phone size. All three suites run in CI.

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
npm run test:browser # components, in real Chromium
npm run test:e2e     # whole pages, at phone size
npm run typecheck    # tsc --noEmit
```

## Full spec

The complete product spec lives in **[SPEC.md](./SPEC.md)** — problem, feature map, AI & pricing model, sharing, architecture, tech stack, MVP scope, and roadmap. A polished web version is in [`pdf-companion-spec.html`](./pdf-companion-spec.html).

## Roadmap

- **Phase 0 — MVP:** ✅ split-view reader + page-aware chat + select-to-ask + highlights + save-AI-answer *(done)*
- **Phase 1:** ✅ accounts · ✅ usage dashboard · ✅ notes · ✅ export · ✅ PWA / mobile polish *(done)* · managed AI pool, Excalidraw *(next)*
- **Phase 2:** ✅ flashcards · ✅ sharing · ✅ cross-book Q&A · ✅ live co-reading *(done)*

---

*Named for the* studiolo *— the room kept for reading.*
