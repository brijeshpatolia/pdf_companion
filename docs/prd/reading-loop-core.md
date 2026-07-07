<!--
PRD draft — not yet published to the issue tracker.
Intended destination: GitHub issue in brijeshpatolia/pdf_companion, label `ready-for-agent`.
Publish once `gh` is installed:  gh issue create --title "PRD: Reading loop core — the AI that reads with you" --body-file docs/prd/reading-loop-core.md --label ready-for-agent

Revision history:
- v2: after a /grilling session that resolved 10 load-bearing decisions (see "Design decisions").
- v3 (current): after a Fable 5 multi-agent adversarial review (7 reviewers × 3-lens verification). Seven confirmed findings folded in — see "Adversarially confirmed hardening" below. Two were independently confirmed by two separate verification panels.
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
38. As a reader, I want jumping ahead (to the index, an appendix, a mistyped page) to NOT count as reading, so that a stray jump never spoils the companion or silently spends my money summarizing pages I never read.
39. As a reader of reference books who jumps ahead deliberately, I want to explicitly confirm "treat pages X–Y as read" after a forward jump, so that reference-style reading can widen the companion's scope on my terms.
40. As a reader, I want the first answer after a long reading stretch to start streaming within a couple of seconds, so that memory catch-up work never freezes my question.
41. As a reader, I want immediate feedback when my selection is too long for a single ask, so that I can trim it instead of getting an answer that silently ignores part of it.
42. As a reader of real-world PDFs (two-column layouts, footnotes, hyphenated technical terms), I want the text the AI sees to read the way the page reads, so that garbled extraction never degrades my answers.

## Design decisions (from grilling)

Ten load-bearing decisions were resolved in a stress-test session; they drive the Implementation and Testing sections below.

1. **Runtime** — local dev on the Supabase stack (Postgres + pgvector + Storage), with the V1-shaped schema. No hosting, auth, or phone support yet.
2. **Embeddings** — a **local** embedding model (e.g. gte-small / all-MiniLM class via Transformers.js or a Python sidecar). Ingestion is free, offline, and needs no key. This decouples ingestion from BYOK entirely and corrects the spec's "OpenRouter-only" framing (OpenRouter is a chat gateway; it does not serve embeddings).
3. **Ingestion location** — server-side, using the same PDF.js family (`pdfjs-dist`) the reader renders with, so there is one consistent text representation for future highlight anchoring.
4. **Spoiler cap** — retrieval *and* the rolling summary are limited to **read-so-far**, keyed on a **furthest-read page** (distinct from current page). Hardened below: an explicit bump rule so navigation ≠ reading, plus a prompt-level constraint so the model's own knowledge can't spoil either.
5. **Conversation as a 4th context source** — one persistent thread per book; recent turns feed back into the prompt so deep-dive and follow-ups actually work.
6. **Context-cap policy** — a fixed, model-agnostic token budget with reserved slots for the essentials and retrieval as the flex. Hardened below: per-slot maxima and a defined degradation order.
7. **Rolling summary** — incremental, ask-triggered, page-threshold, cheap model, metered — no idle token spend. Hardened below: the fold is **non-blocking** and bounded per ask.
8. **BYOK** — OpenRouter key only for the MVP (one adapter, real per-request cost, per-mode routing). Raw provider keys are V1.
9. **Key storage** — local env/secret, no DB, no KMS. Per-user encrypted storage arrives with auth in V1. No in-app key UI (key = config).
10. **Retrieval testing** — real (deterministic, offline) local embedder for relevance tests; hand-crafted vectors for mechanism tests; fake gateway for the completion.

### Adversarially confirmed hardening (Fable 5 review panel)

A 7-dimension multi-agent review with 3-lens adversarial verification confirmed seven defects in the previous draft; each fix below is folded into the Implementation and Testing sections. (Findings H1 and H3 were independently confirmed by two separate verification panels.)

- **H1 (critical) — Navigation ≠ reading.** `furthestReadPage` previously bumped on *any* page view, so one jump to the index irreversibly broke the spoiler cap and triggered a massive metered summary fold of unread pages. Fixed with an explicit bump rule + opt-in confirmation for deliberate jumps.
- **H2 (critical) — Extraction fidelity was unspecified.** `pdfjs-dist` raw text output interleaves columns, mixes in headers/footers/footnotes, and splits hyphenated terms; every context source is downstream of it, and the old tests would have passed on garbage. Fixed with explicit fidelity requirements + golden-text fixtures.
- **H3 (major) — The lazy summary fold blocked the first ask.** After a long reading stretch, the highest-stakes ask of a session stalled for the whole catch-up. Fixed: the fold is non-blocking and bounded; first token streams regardless.
- **H4 (major) — Model-knowledge spoilers.** The cap filtered only *context*; a frontier model knows famous books (the founding examples!) from pretraining and would happily narrate the ending. Fixed with a prompt-level constraint, tested on every payload.
- **H5 (major) — Retrieval query composition was unspecified.** Embedding a semantically-empty question ("what does this mean?") retrieves nothing; define-in-context depends on embedding the *selection*. Fixed with an explicit query-composition rule + relevance test.
- **H6 (major) — `ask()` didn't carry the current page.** Grounding raced an async progress write, so an ask fired right after a page turn could ground on the previous page. Fixed: the UI passes `currentPage` explicitly at ask time.
- **H7 (major) — The cap policy was self-contradictory at the edges.** "Selection never cut" + a hard budget can't both hold for an oversize selection, and no degradation order existed. Fixed with per-slot maxima (selection capped at selection time, with UI feedback) and a defined degradation order.

## Implementation Decisions

**Three modules, three seams. There is no existing code — every seam here is newly proposed at the highest point that keeps the module deep and testable.**

**Runtime & persistence.** The app runs locally but on the **Supabase stack** so the schema matches future hosted V1 exactly: **Postgres + pgvector** for books/chunks/conversations/reading-progress/usage and vector retrieval, and **object storage** for the raw PDF. No auth, no RLS/multi-tenant policies, single user. Entities carry the fields a future owner/account layer will need, so adding auth later is additive, not a rewrite.

- **Ingestion module (Seam 1).** A deep module behind a small interface: `ingestBook(pdf) → { bookId, pageCount, status }`, plus a status query the UI can poll/stream. It runs **server-side**: the client uploads the raw PDF to Storage; the server extracts per-page text with **`pdfjs-dist`** (same PDF.js family the reader renders with, so the text model is consistent for future anchoring) → chunks → embeds each chunk with the **local embedding model** → persists chunks with their page number and embedding. Runs once per book, headless (survives tab close), with streamed progress. Scanned/image-only and encrypted PDFs are detected and rejected with a clear, defined error (OCR is out of scope). The embedder is an **injected dependency** (accept, don't create) so tests can substitute one. The pgvector column dimension is fixed to the local model's output; changing embedder later means a re-embed.

  **Extraction fidelity (H2) — a requirement, not an afterthought.** `getTextContent()` returns positioned items in content-stream order with no whitespace guarantees, and every context source is downstream of this text. Seam 1 must: (a) reconstruct reading order from text-item coordinates (y-then-x with column detection — or, if the MVP ships single-column-only, say so explicitly and reject/flag multi-column layouts rather than interleaving them); (b) infer inter-item word spacing; (c) de-hyphenate end-of-line breaks (a split "lineariz-ability" poisons exactly the terms users select); (d) strip repeating headers/footers/page numbers via cross-page repetition detection.

- **Context engine + ask module (Seam 2) — the deep module that carries the magic.** Interface: `ask({ bookId, currentPage, question, intent, selection?, model? }) → { answer, usage }` (a streaming variant yields the answer incrementally). **The UI supplies `currentPage` explicitly at ask time (H6)** — grounding must never race an async progress write; persisted progress is only a fallback when the caller omits it. The engine reads the rest of its state (furthest-read page, rolling summary, the per-book conversation thread) from persistence itself, so the interface stays small while the behavior is large. On every call it assembles a *grounded prompt* from **four** sources, all respecting read-so-far:
  1. **Current page text** (the "now") — the page the caller passed, even if the reader is peeking ahead of the furthest-read page (it's on screen; sources 2–4 stay capped).
  2. **Rolling summary** of pages behind the reader (compact "book so far in mind").
  3. **Retrieved chunks** — semantic search over the book's embeddings, **filtered to pages ≤ furthest-read page** so nothing ahead can surface.
  4. **Recent conversation turns** from the per-book thread — so "deep dive / push further" and follow-ups keep their context.

  **Retrieval query composition (H5):** the retrieval query embeds the **selection text** (plus the question when present); for `define-in-context` specifically, the selected term/phrase *is* the query — that is what surfaces the passages where the author previously introduced or used the term. A free-form ask with no selection embeds the question. Embedding only the question is a defect: "what does this mean?" is semantically empty and retrieves noise.

  **Spoiler discipline (two halves):** *Context half* — sources 2 and 3 are keyed on the **furthest-read page**, not the current page: flipping back to page 10 after reading to page 200 still lets the engine use all 200, while source 1 stays the "now." *Prompt half (H4)* — filtering context is not enough: the model may know famous books from pretraining (the founding examples — Socrates, DDIA — are exactly such books). Every assembled prompt must instruct the model to answer **only from the supplied context**, to treat the reader as positioned at the furthest-read page, and to decline to reveal or foreshadow later content even if it knows the work. This is a hard requirement of the assembled prompt, asserted by tests. (Residual risk: a prompt-level constraint is strong but not absolute — noted, accepted for MVP.)

  **Hard cap + allocation policy (H7):** a fixed, **model-agnostic** total token budget (default ~8k input tokens, tunable) keeps cost predictable even on a huge-window model. Reserved slots have **per-slot maxima** (defaults, tunable — the *order* is the contract): selection ≤ ~1.5k tokens, **enforced at selection time with UI feedback** so "the selection is never cut" stays true (story 41); current page ≤ ~2k; rolling summary ≤ ~1k; last-N conversation turns ≤ ~2k. Slot maxima must sum to **less than** the total budget. **Retrieved chunks fill whatever remains, dropping lowest-scored first.** If reserved content still exceeds its slots, the degradation order is: drop oldest conversation turns first → truncate the summary → clip current-page text last; the question + (pre-capped) selection are never cut.

  **Rolling summary (H3 — non-blocking, bounded):** maintained **incrementally** with a "covered up to page X" marker, updated only in response to an ask (no idle token spend), using the **cheap/fast model tier**, metered like everything else. Two hard rules: (a) **the fold never blocks the answer** — the ask is answered immediately from the *stale* summary + retrieval (chunks from ingest already cover the un-summarized gap); the fold runs concurrently with / after the streamed response so the *next* ask benefits; (b) **at most M pages fold per ask** (default ~25, tunable), so a giant backlog amortizes across asks instead of producing one huge burst. Explicit requirement: **the first token of an answer streams within ~2–3s regardless of pending summary work** (story 40). The UI may show a subtle "catching up on pages X–Y" status while a fold runs. Only pages **actually marked read** are ever folded (see the bump rule below).

  **Model routing:** the intent (`define-in-context` | `deep-dive` | `eli5`) selects a default model via a **per-intent routing table** (cheap/fast for define & ELI5, powerful for deep-dive); an explicit `model` overrides it. Summaries route to the cheap tier.

- **AI gateway adapter.** The gateway is an **injected adapter** behind a narrow interface (`complete(prompt, model) → { text, tokensIn, tokensOut, costUSD }`, streaming variant included). The real adapter targets **OpenRouter only** for the MVP — one API for all chat models, returning the actual dollar cost per request (which powers the meter and per-mode routing for free). A deterministic **fake adapter** satisfies the same interface for tests — two adapters, so this is a real seam.

- **Reader / companion UI (Seam 3) — thin over the modules.** Split-view: PDF reader (with a real PDF.js text layer to enable text selection) + companion chat panel. Select-to-ask captures the selected text and chosen intent and calls Seam 2 (passing `currentPage`), appending into the per-book thread. Renders streaming answers and a usage readout. Enforces the selection-size cap at selection time with visible feedback (H7 / story 41). No highlighting, no saving answers, no notebook in this scope. *(Assumption: in a two-page spread the "current page" source is the visible page(s), defaulting to single-page.)*

  **Reading progress & the bump rule (H1) — navigation is not reading.** Seam 3 reports page views via `updateReadingProgress(bookId, page)`, which always updates `currentPage` but advances `furthestReadPage` **only on contiguous forward reading** — i.e. when `page ≤ furthestReadPage + 1` (optionally gated by a short dwell threshold). A jump beyond that (index, appendix, mistyped page box) updates `currentPage` **only** — it must not widen retrieval scope and must not make pages eligible for a summary fold. There is no automatic un-bump; that's exactly why an accidental bump must be impossible. For deliberate jump-ahead readers (reference books like DDIA are a founding use case), the UI offers a **one-time explicit confirmation** on a far-forward jump — "You jumped ahead — treat pages X–Y as read?" — which calls `markPagesRead(bookId, throughPage)`; declining leaves scope untouched (stories 38–39).

**Cross-cutting decisions:**

- **BYOK key handling:** a single **OpenRouter** key, configured once in a **gitignored local env/secret** — never stored in the DB, never returned to the browser, never logged. No KMS/envelope encryption in the MVP; per-user encrypted-at-rest key storage arrives with the auth/User table in V1. There is no in-app key-entry UI in this scope (key = config).
- **Data model (this PRD's entities only):**
  - **Book** — file reference, title, page count, ingestion status.
  - **Chunk** — book + page + text + embedding — the retrieval index (page enables the read-so-far filter).
  - **ReadingProgress** — per book: `currentPage`, `furthestReadPage`, `summary`, `summaryCoveredUpToPage`. `furthestReadPage` moves only via the bump rule or explicit `markPagesRead`.
  - **Conversation** — the per-book thread: messages (incl. the selection/intent that prompted each), model used, token usage + cost.
  - **UsageRecord** — per-request tokens, model, cost — feeds the meter (includes summary-generation calls).

  `Annotation`, `Share`, `User`, `Subscription` are named in the spec's full model but are **out of scope here**.
- **Usage meter:** OpenRouter returns per-request cost; aggregate to show *this response ≈ $X · today · this month · this book*, including summary-generation calls.

## Testing Decisions

**What makes a good test here:** exercise each module *through its interface* and assert only externally observable behavior — never internal structure. Cross the same seam a caller crosses. Given inputs to `ingestBook`/`ask`, assert the returned values and the persisted, queryable effects — not which private helper ran or how the prompt string was built.

- **Seam 2 (context engine + ask) is the primary test surface.** Seed a small book's chunks, a `ReadingProgress` row, and a conversation thread; inject a **deterministic fake gateway adapter**. Then assert externally:
  - **Context composition** — the payload handed to the gateway includes current-page text (the page passed to `ask`), rolling-summary content, top retrieved chunks, and recent conversation turns.
  - **Spoiler cap** — with `furthestReadPage = P`, no retrieved chunk and no summarized content comes from a page > P, even when highly relevant chunks exist ahead. Flipping `currentPage` back below `furthestReadPage` does not shrink retrieval scope.
  - **Prompt-level spoiler constraint (H4)** — every payload captured by the fake gateway contains the answer-only-from-context / no-foreshadowing instruction and the reader's position.
  - **Query composition (H5)** — a relevance test: with a term introduced on page 12 and selected on page 40, the page-12 chunk ranks in the retrieved set (real local embedder; the selection, not the bare question, drives retrieval).
  - **Cap policy (H7)** — total assembled context never exceeds the budget for a large seeded book; reserved slots survive within their maxima; retrieval is truncated first (lowest-scored first). An **oversize-selection** case asserts the defined behavior: the selection is capped at selection time (Seam 3) and the degradation order (turns → summary → page) engages in that order.
  - **Summary fold (H3)** — a fold happens only in response to an ask with ≥ N uncovered read pages, folds **at most M pages**, advances `summaryCoveredUpToPage`, uses the cheap tier, and **never blocks the answer**: with a 150-page uncovered backlog, the ask completes against the stale summary while the fold proceeds; no fold occurs when idle/under threshold; only pages ≤ `furthestReadPage` are ever folded.
  - **Routing + usage** — `intent` selects the expected default model, an explicit `model` overrides it, and returned `usage` reflects the fake adapter's tokens/cost (summary calls included).
- **Retrieval quality vs. mechanism (resolves the fake-embedder circularity).** Because the embedder is **local**, it is offline, free, and **deterministic** — the same text yields the same vector every run. So retrieval-**relevance** tests embed a tiny curated fixture with the **real local model** and assert the expected chunk ranks top. Pure-**mechanism** tests (top-k, distance ordering, the read-so-far page filter) use **hand-crafted vectors** and need no model. Never assert relevance over a fake embedder. **At least one relevance test must run through the full `extract → chunk → embed` pipeline from a real PDF fixture (H2)** — seeding chunks directly would let extraction defects hide.
- **Seam 1 (ingestion)** — feed a small known text-based PDF fixture and assert the observable result: the book reaches `ready` status with the expected page count, and chunks are retrievable with correct page numbers and non-empty embeddings. A separate case asserts an image-only/encrypted fixture is rejected with the defined error. **Extraction-fidelity golden tests (H2):** fixtures for a two-column page, a footnoted page (running headers + page numbers), and an end-of-line-hyphenated technical term — asserting known sentences extract contiguously, in reading order, de-hyphenated, with headers/footers stripped.
- **Seam 3 (reader/companion UI)** — interaction tests: selecting text and choosing an intent calls `ask` with the correct selection, intent, **and currentPage**; **an ask issued immediately after a page turn grounds on the new page (H6)**; contiguous forward navigation advances `furthestReadPage`; **a jump from page 12 to page 380 does not change `furthestReadPage`, does not widen retrieval, and does not trigger a summary fold (H1)** — unless the user explicitly confirms, in which case `markPagesRead` advances it; an oversize selection is blocked at selection time with visible feedback (H7); a gateway error surfaces a retryable error without dropping the typed question.
- **Prior art:** none — this is a greenfield repo, so this PRD *establishes* the testing pattern (fake gateway + real local embedder, test-through-the-interface, per the project's TDD and codebase-design skills). Later PRDs should follow it.

## Out of Scope

- Highlights (multi-color), margin notes, clip-and-save an AI answer to a highlight, the per-book notebook, search across notes, export — **the next PRD**.
- Accounts, auth, trial/subscription billing, the managed AI credit pool and its markup — V1.
- Sharing (snapshot/fork/live co-read) and the `Annotation`/`Share` entities.
- Hosting / deployment and phone support (deep split-view targets desktop/tablet; runs locally for now).
- **Raw provider keys** (OpenAI/Anthropic direct) and any in-app pricing table — MVP is OpenRouter-key only.
- **In-app key-entry/management UI** and **encrypted-at-rest / KMS key storage** — key is local config in the MVP; encrypted per-user storage lands with auth in V1.
- **Whole-book / spoiler-off retrieval mode** and any per-book spoiler toggle — retrieval is read-so-far only (the explicit "treat pages X–Y as read" confirmation is the only sanctioned scope-widening).
- **Idle-time / background summarization** — no token is spent while the user merely reads. (The ask-triggered fold may complete concurrently with or after the streamed answer, but nothing runs while idle.)
- Page-citation chips in answers (grounding is in scope; surfacing citations back to the page is V1).
- Additional ask intents beyond define-in-context / deep-dive / ELI5 (analogy, why-it-matters, prerequisites, Socratic mode) — V1.
- Embedded Excalidraw, auto chapter summaries, spaced-repetition flashcards, "where was this introduced," read-aloud, reading stats.
- OCR / scanned-PDF support (such PDFs are detected and rejected, not processed).

## Further Notes

- **SPEC §10 open questions now answered by this PRD:** ingestion is **server-side** (with client-consistent PDF.js text extraction); provider posture is **OpenRouter-only** for chat, with a **local** embedding model for ingestion. Reconcile SPEC §10 when convenient (not done here).
- **Residual spoiler risk (H4):** the prompt-level no-foreshadowing constraint is strong but not absolute — a model can still leak knowledge of a famous book despite instructions. Accepted for MVP; if it proves leaky in practice, escalation options (stronger system prompts, answer post-checks) are a tuning concern, not an interface change.
- Naming: "PDF Companion" is a working title (candidates: *Gloss*, *Marginalia*, *Sidenote*, *Codex*, *Recto*); not a blocker.
- Chunk size/overlap, the context-budget number and per-slot maxima, summary page-threshold `N`, fold bound `M`, dwell threshold, and last-`N`-turns count are tunable defaults — but the **degradation order, the bump rule, the non-blocking fold, and the never-cut guarantees are contracts**, not tunables.
- Designed so the deferred `Annotation` layer attaches to the same PDF.js text model the reader already exposes for select-to-ask, so the next PRD builds on this seam rather than reworking it.
