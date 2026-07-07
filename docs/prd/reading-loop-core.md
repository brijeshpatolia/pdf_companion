<!--
PRD draft — not yet published to the issue tracker.
Intended destination: GitHub issue in brijeshpatolia/pdf_companion, label `ready-for-agent`.
Publish once `gh` is installed:  gh issue create --title "PRD: Reading loop core — the AI that reads with you" --body-file docs/prd/reading-loop-core.md --label ready-for-agent

Revised after a /grilling session that resolved 10 load-bearing decisions and fixed two internal contradictions. Decision rationale is summarized in "Design decisions (from grilling)" below.
-->

# PRD: Reading loop core — the AI that reads with you

> **Scope:** Upload a PDF → split-view reader → page-aware chat + select-to-ask, fueled by the reader's own OpenRouter key (BYOK) through one AI gateway. **Personal-first, single-user, no accounts, runs locally.** This is the "prove the magic" slice of the personal-first MVP (SPEC §09). Highlights, save-answer, and the notebook are deliberately a *later* PRD.

## Problem Statement

Reading a hard book is a solitary negotiation, and the help you want is never on the page. When I hit a term like *linearizability* in a systems book, I leave the book, ask a blank ChatGPT or Google, get a generic definition with none of the chapter's context, and lose my place — the answer doesn't know what the author meant by it three pages ago. When I want to push back on a dense argument — Socrates on whether the soul outlives the body — I copy the page into a chat, then the next page, then the next, and each time the chat has forgotten everything that came before. The help has to be *on the page* and it has to *carry the whole book's context so far*. Copy-pasting pages into a chatbot is the manual, forgetful version of exactly this.

## Solution

A split view: the book on one side, an AI companion on the other, kept in sync as I turn pages. The companion is always on my current page and remembers everything I've read so far — never spoiling what's ahead. I can:

- **Ask in context** — type a question in the companion, or select any passage in the reader and choose an intent (define-in-context, deep dive, ELI5). The answer is grounded in *this* book **up to where I've read**, in the way *this* author uses the term.
- **Trust the memory** — the companion assembles its answer from my current page, a rolling summary of what's behind me, semantically-retrieved passages from anywhere I've *already read*, and our ongoing conversation about this book — so it "holds the whole book so far in mind" without me pasting anything.
- **See what it costs** — I fuel it with my own OpenRouter key; every response shows me roughly what that request cost and my running total, and I can pick which model does the thinking (a cheap fast one for lookups, a powerful one for deep dialogue).

## User Stories

1. As a reader, I want to upload a PDF of a book I own, so that I can read it inside the companion.
2. As a reader, I want ingestion to run server-side and keep going even if I close the tab, so that a long book finishes processing reliably.
3. As a reader, I want to see ingestion progress after upload, so that I know when the book is ready to read and chat with.
4. As a reader, I want a clear message if my PDF can't be processed (encrypted, image-only/scanned, corrupt), so that I understand why and what to try instead.
5. As a reader, I want to open a book I previously uploaded without re-uploading it, so that I can pick up where I left off.
6. As a reader, I want a split view with the book on one side and the companion on the other, so that I can read and ask without leaving the page.
7. As a reader, I want to turn pages and jump to a page, so that I can navigate the book naturally.
8. As a reader, I want the companion to always know which page I'm currently on, so that its answers are anchored to what I'm actually reading.
9. As a reader, I want the reader to remember my current page when I reopen a book, so that I return to where I left off.
10. As a reader, when I flip back to an earlier page, I want the companion to still draw on everything I've read up to my furthest point, so that it doesn't "forget" later pages I've already finished.
11. As a reader, I want the companion to never use pages I haven't reached yet, so that it doesn't spoil what's ahead.
12. As a reader, I want to type a free-form question to the companion, so that I can ask anything about the book so far.
13. As a reader, I want to select a passage in the reader and ask about it directly, so that I don't have to retype or describe what I'm pointing at.
14. As a reader, I want the answer to reflect the specific passage I selected rather than just the whole page, so that targeted questions get targeted answers.
15. As a reader, I want to choose "define in context" on a selected term, so that I get the meaning the way this author uses it, not a generic dictionary definition.
16. As a reader, I want a "deep dive" intent on a passage, so that I can push further into a dense argument.
17. As a reader, I want an "ELI5" intent, so that I can get a plain-language explanation when I'm stuck.
18. As a reader, I want the companion to remember earlier turns in our conversation about this book, so that I can say "go deeper" or ask a follow-up without re-explaining.
19. As a reader, I want a passage I select to become part of the same ongoing conversation, so that I can follow up on it conversationally.
20. As a reader, I want answers grounded in what I've read so far, so that they respect the book's context.
21. As a reader, I want the companion to draw on earlier pages I've read even when they're not on screen, so that it genuinely "remembers the book so far."
22. As a reader, I want the companion to pull in the most relevant passages from anywhere I've already read when answering, so that its grounding isn't limited to the current page.
23. As a reader, I want my conversation with the companion to persist per book, so that I can scroll back through what I asked and what it answered.
24. As a reader, I want to see the companion "thinking"/streaming its answer, so that I get feedback quickly rather than waiting for a full response.
25. As a reader, I want a clear error if a request to the model fails, so that I can retry without losing my question.
26. As a reader, I want to configure my OpenRouter key once (in local config), so that the companion can use my chosen models without me pasting it repeatedly.
27. As a reader, I want my key never displayed back to me, logged, or sent to the browser, so that I can trust the app with it.
28. As a reader, I want to pick which model answers, so that I can trade off cost, speed, and quality.
29. As a reader, I want different intents to route to different models by default (cheap/fast for lookups, powerful for deep dives), so that I save money without thinking about it.
30. As a reader, I want to override the model per request or set a default, so that I stay in control of what I'm paying for.
31. As a reader, I want to see the approximate cost of each response, so that I understand what reading with AI costs me.
32. As a reader, I want a running total of what I've spent today / this month / on this book, so that I can keep an eye on my spending.
33. As a reader, I want the usage meter to include summary-generation costs too, so that the meter reflects everything the companion spent on my behalf.
34. As a reader, I want the companion to stay responsive on a long book, so that ingestion and memory don't make it slow to answer.
35. As a reader, I want assembled context to stay within a sensible size, so that a single question never balloons into an unexpectedly expensive request.
36. As a reader, I want to switch between multiple uploaded books, so that I can read more than one at a time.
37. As a reader on a laptop or tablet, I want the split view to be usable at my screen size, so that the reading experience isn't cramped.

## Design decisions (from grilling)

Ten load-bearing decisions were resolved in a stress-test session; they drive the Implementation and Testing sections below.

1. **Runtime** — local dev on the Supabase stack (Postgres + pgvector + Storage), with the V1-shaped schema. No hosting, auth, or phone support yet.
2. **Embeddings** — a **local** embedding model (e.g. gte-small / all-MiniLM class via Transformers.js or a Python sidecar). Ingestion is free, offline, and needs no key. This decouples ingestion from BYOK entirely and corrects the spec's "OpenRouter-only" framing (OpenRouter is a chat gateway; it does not serve embeddings).
3. **Ingestion location** — server-side, using the same PDF.js family (`pdfjs-dist`) the reader renders with, so there is one consistent text representation for future highlight anchoring.
4. **Spoiler cap** — retrieval *and* the rolling summary are limited to **read-so-far**, keyed on a **furthest-read page** (distinct from current page). Resolves the story-16-vs-14 contradiction in the original draft.
5. **Conversation as a 4th context source** — one persistent thread per book; recent turns feed back into the prompt so deep-dive and follow-ups actually work.
6. **Context-cap policy** — a fixed, model-agnostic token budget with reserved slots for the essentials and retrieval as the flex.
7. **Rolling summary** — incremental, lazy-at-ask, page-threshold trigger, cheap model, metered — no idle token spend.
8. **BYOK** — OpenRouter key only for the MVP (one adapter, real per-request cost, per-mode routing). Raw provider keys are V1.
9. **Key storage** — local env/secret, no DB, no KMS. Per-user encrypted storage arrives with auth in V1.
10. **Retrieval testing** — real (deterministic, offline) local embedder for relevance tests; hand-crafted vectors for mechanism tests; fake gateway for the completion.

## Implementation Decisions

**Three modules, three seams. There is no existing code — every seam here is newly proposed at the highest point that keeps the module deep and testable.**

**Runtime & persistence.** The app runs locally but on the **Supabase stack** so the schema matches future hosted V1 exactly: **Postgres + pgvector** for books/chunks/conversations/reading-progress/usage and vector retrieval, and **object storage** for the raw PDF. No auth, no RLS/multi-tenant policies, single user. Entities carry the fields a future owner/account layer will need, so adding auth later is additive, not a rewrite.

- **Ingestion module (Seam 1).** A deep module behind a small interface: `ingestBook(pdf) → { bookId, pageCount, status }`, plus a status query the UI can poll/stream. It runs **server-side**: the client uploads the raw PDF to Storage; the server extracts per-page text with **`pdfjs-dist`** (same PDF.js family the reader renders with, so the text model is consistent for future anchoring) → chunks → embeds each chunk with the **local embedding model** → persists chunks with their page number and embedding. Runs once per book, headless (survives tab close), with streamed progress. Scanned/image-only and encrypted PDFs are detected and rejected with a clear, defined error (OCR is out of scope). The embedder is an **injected dependency** (accept, don't create) so tests can substitute one. The pgvector column dimension is fixed to the local model's output; changing embedder later means a re-embed.

- **Context engine + ask module (Seam 2) — the deep module that carries the magic.** Interface: `ask({ bookId, question, intent, selection?, model? }) → { answer, usage }` (a streaming variant yields the answer incrementally). The engine reads persisted **reading progress** and the per-book **conversation thread** itself, so the interface stays small while the behavior is large. On every call it assembles a *grounded prompt* from **four** sources, all respecting read-so-far:
  1. **Current page text** (the "now").
  2. **Rolling summary** of pages behind the reader (compact "book so far in mind").
  3. **Retrieved chunks** — semantic search over the book's embeddings, **filtered to pages ≤ furthest-read page** so nothing ahead can surface.
  4. **Recent conversation turns** from the per-book thread — so "deep dive / push further" and follow-ups keep their context.

  **Spoiler discipline:** sources 2 and 3 are keyed on the **furthest-read page**, not the current page — flipping back to page 10 after reading to page 200 still lets the engine use all 200, while source 1 (current page) stays the "now."

  **Hard cap + allocation policy:** a fixed, **model-agnostic** total token budget (default ~6–8k input tokens, tunable) keeps cost predictable even on a huge-window model. Reserved slots guarantee room for: the question + selection (never cut), the current page, the last N conversation turns, and the rolling summary. **Retrieved chunks fill whatever remains, dropping lowest-scored first** — retrieval is the elastic part that absorbs the cap.

  **Rolling summary:** maintained **incrementally** with a "covered up to page X" marker. It is updated **lazily, at ask-time**, only when there are ≥ N newly-read pages not yet folded in; those pages are summarized (feeding summary-so-far + new pages) using the **cheap/fast model tier**, then context is assembled. No summarization happens while the user is idle; the first ask after a long reading stretch pays a small catch-up. Summary generation is metered on the usage meter like any other call.

  **Model routing:** the intent (`define-in-context` | `deep-dive` | `eli5`) selects a default model via a **per-intent routing table** (cheap/fast for define & ELI5, powerful for deep-dive); an explicit `model` overrides it. Summaries route to the cheap tier.

- **AI gateway adapter.** The gateway is an **injected adapter** behind a narrow interface (`complete(prompt, model) → { text, tokensIn, tokensOut, costUSD }`, streaming variant included). The real adapter targets **OpenRouter only** for the MVP — one API for all chat models, returning the actual dollar cost per request (which powers the meter and per-mode routing for free). A deterministic **fake adapter** satisfies the same interface for tests — two adapters, so this is a real seam.

- **Reader / companion UI (Seam 3) — thin over the modules.** Split-view: PDF reader (with a real PDF.js text layer to enable text selection) + companion chat panel. It maintains **reading progress** by reporting page views to a small persistence operation (`updateReadingProgress(bookId, page)` — updates `currentPage`, bumps `furthestReadPage`). Select-to-ask captures the selected text and chosen intent and calls Seam 2, appending into the per-book thread. Renders streaming answers and a usage readout. No highlighting, no saving answers, no notebook in this scope. *(Assumption: in a two-page spread the "current page" source is the visible page(s), defaulting to single-page.)*

**Cross-cutting decisions:**

- **BYOK key handling:** a single **OpenRouter** key, configured once in a **gitignored local env/secret** — never stored in the DB, never returned to the browser, never logged. No KMS/envelope encryption in the MVP; per-user encrypted-at-rest key storage arrives with the auth/User table in V1. There is no in-app key-entry UI in this scope (key = config).
- **Data model (this PRD's entities only):**
  - **Book** — file reference, title, page count, ingestion status.
  - **Chunk** — book + page + text + embedding — the retrieval index (page enables the read-so-far filter).
  - **ReadingProgress** — per book: `currentPage`, `furthestReadPage`, `summary`, `summaryCoveredUpToPage`.
  - **Conversation** — the per-book thread: messages (incl. the selection/intent that prompted each), model used, token usage + cost.
  - **UsageRecord** — per-request tokens, model, cost — feeds the meter (includes summary-generation calls).

  `Annotation`, `Share`, `User`, `Subscription` are named in the spec's full model but are **out of scope here**.
- **Usage meter:** OpenRouter returns per-request cost; aggregate to show *this response ≈ $X · today · this month · this book*, including summary-generation calls.

## Testing Decisions

**What makes a good test here:** exercise each module *through its interface* and assert only externally observable behavior — never internal structure. Cross the same seam a caller crosses. Given inputs to `ingestBook`/`ask`, assert the returned values and the persisted, queryable effects — not which private helper ran or how the prompt string was built.

- **Seam 2 (context engine + ask) is the primary test surface.** Seed a small book's chunks, a `ReadingProgress` row, and a conversation thread; inject a **deterministic fake gateway adapter**. Then assert externally:
  - **Context composition** — the payload handed to the gateway includes current-page text, rolling-summary content, top retrieved chunks, and recent conversation turns.
  - **Spoiler cap** — with `furthestReadPage = P`, no retrieved chunk and no summarized content comes from a page > P, even when highly relevant chunks exist ahead. Flipping `currentPage` back below `furthestReadPage` does not shrink retrieval scope.
  - **Cap policy** — total assembled context never exceeds the budget for a large seeded book; the reserved slots survive and retrieval is what gets truncated (lowest-scored first).
  - **Summary trigger** — a summary fold happens only when ≥ N new read pages are uncovered, uses the cheap tier, and advances `summaryCoveredUpToPage`; no fold occurs when idle/under threshold.
  - **Routing + usage** — `intent` selects the expected default model, an explicit `model` overrides it, and returned `usage` reflects the fake adapter's tokens/cost (summary calls included).
- **Retrieval quality vs. mechanism (resolves the fake-embedder circularity).** Because the embedder is **local**, it is offline, free, and **deterministic** — the same text yields the same vector every run. So retrieval-**relevance** tests embed a tiny curated fixture with the **real local model** and assert the expected chunk ranks top. Pure-**mechanism** tests (top-k, distance ordering, the read-so-far page filter) use **hand-crafted vectors** and need no model. Never assert relevance over a fake embedder.
- **Seam 1 (ingestion)** — feed a small known text-based PDF fixture and assert the observable result: the book reaches `ready` status with the expected page count, and chunks are retrievable with correct page numbers and non-empty embeddings. A separate case asserts an image-only/encrypted fixture is rejected with the defined error.
- **Seam 3 (reader/companion UI)** — lighter interaction tests: selecting text and choosing an intent calls `ask` with the correct selection and intent and appends to the thread; navigating pages calls `updateReadingProgress` and bumps `furthestReadPage`; a gateway error surfaces a retryable error without dropping the typed question.
- **Prior art:** none — this is a greenfield repo, so this PRD *establishes* the testing pattern (fake gateway + real local embedder, test-through-the-interface, per the project's TDD and codebase-design skills). Later PRDs should follow it.

## Out of Scope

- Highlights (multi-color), margin notes, clip-and-save an AI answer to a highlight, the per-book notebook, search across notes, export — **the next PRD**.
- Accounts, auth, trial/subscription billing, the managed AI credit pool and its markup — V1.
- Sharing (snapshot/fork/live co-read) and the `Annotation`/`Share` entities.
- Hosting / deployment and phone support (deep split-view targets desktop/tablet; runs locally for now).
- **Raw provider keys** (OpenAI/Anthropic direct) and any in-app pricing table — MVP is OpenRouter-key only.
- **In-app key-entry/management UI** and **encrypted-at-rest / KMS key storage** — key is local config in the MVP; encrypted per-user storage lands with auth in V1.
- **Whole-book / spoiler-off retrieval mode** and any per-book spoiler toggle — retrieval is read-so-far only.
- **Eager/background summarization** — the summary is computed lazily at ask-time.
- Page-citation chips in answers (grounding is in scope; surfacing citations back to the page is V1).
- Additional ask intents beyond define-in-context / deep-dive / ELI5 (analogy, why-it-matters, prerequisites, Socratic mode) — V1.
- Embedded Excalidraw, auto chapter summaries, spaced-repetition flashcards, "where was this introduced," read-aloud, reading stats.
- OCR / scanned-PDF support (such PDFs are detected and rejected, not processed).

## Further Notes

- **SPEC §10 open questions now answered by this PRD:** ingestion is **server-side** (with client-consistent PDF.js text extraction); provider posture is **OpenRouter-only** for chat, with a **local** embedding model for ingestion. Reconcile SPEC §10 when convenient (not done here).
- Naming: "PDF Companion" is a working title (candidates: *Gloss*, *Marginalia*, *Sidenote*, *Codex*, *Recto*); not a blocker.
- Chunk size/overlap and the exact context-budget number, summary page-threshold `N`, and last-`N`-turns count are tunable defaults, not interface decisions — they can change without touching the seams.
- Designed so the deferred `Annotation` layer attaches to the same PDF.js text model the reader already exposes for select-to-ask, so the next PRD builds on this seam rather than reworking it.
