# PDF Companion — Product Spec

> **An AI that reads with you.** Always on your page. Holding the whole book in mind.

**Working name:** PDF Companion · **Status:** Draft v0.1 · **Date:** 06 Jul 2026 · *Living document*

A reading companion for hard books. Instead of breaking your flow to paste a page into ChatGPT — or Googling a term with none of the book's context — the AI sits beside the page you're on, **remembers everything you've read**, and answers grounded in the book itself. Ask, highlight, sketch, and keep the explanations worth keeping.

> **Where it came from.** Two books. *The Last Days of Socrates* — wanting to argue with the text, one page at a time. And *Designing Data-Intensive Applications* — wanting a term explained in the book's own context, without losing your place. The same tool serves both: a slow dialectic on one page, and a fast in-context lookup on the next.

**Phase legend:** `[MVP]` prove the magic · `[V1]` real product · `[V2]` later

---

## Contents

1. [The problem](#01--the-problem)
2. [The core idea](#02--the-core-idea)
3. [Feature map](#03--feature-map)
4. [The AI model](#04--the-ai-model)
5. [Money](#05--money)
6. [Sharing](#06--sharing)
7. [Architecture](#07--architecture)
8. [Tech stack](#08--tech-stack)
9. [MVP & roadmap](#09--mvp--roadmap)
10. [Risks & open questions](#10--risks--open-questions)

---

## 01 · The problem

**Reading a hard book is a solitary negotiation.** There's help you want in two very different moments — and neither is available on the page.

**The detour.** You hit a term — say *linearizability* in a systems book. To understand it you leave the book, ask a blank ChatGPT or Google, get a generic definition with none of the chapter's context, and lose your place. The answer doesn't know what the author meant by it three pages ago.

**The silent read.** For a dense argument — Socrates on whether the soul outlives the body — you want to push back, ask "what did he actually mean," go deeper. So you copy the page into a chat. Then the next page. Then the next. Each time, it has forgotten what came before.

> **The through-line:** the help has to be **on the page** and it has to **carry the whole book's context**. Copy-pasting pages into a chatbot is the manual, forgetful version of exactly this. We automate it and give it memory.

---

## 02 · The core idea

**The AI is always on your current page, and remembers everything you've read.** That single sentence is the whole product. A split view: the book on one side, the companion on the other, kept in sync as you turn pages. From there, three moves:

- **Ask in context** — select anything, get an answer grounded in the book so far (a term explained the way *this* author uses it; argue, go deeper, or get the one-line version).
- **Capture what's worth it** — highlight, note, sketch, and clip the AI answers you love. Build your own annotated edition, every keeper anchored to the exact passage.
- **Retain it later** — your highlights and saved answers become review material: chapter summaries as you finish, flashcards so reading becomes remembering.

---

## 03 · Feature map

### A · The reading loop — *the AI that reads with you*
- Split-view PDF + companion `[MVP]`
- Page-aware context, in sync as you read `[MVP]`
- Rolling memory of the whole book `[MVP]`
- Citations back to the page `[V1]`

### B · Ask, your way — *select text → choose an intent*
- Select-to-ask on any passage `[MVP]`
- Define-in-context · Deep dive · ELI5 `[MVP]`
- Analogy · Why it matters · Prerequisites `[V1]`
- Socratic dialogue mode `[V1]`

### C · Capture — *mark the book up, keep the good answers*
- Multi-color highlights `[MVP]`
- Clip & save an AI answer to a highlight `[MVP]`
- Margin notes anchored to text `[V1]`
- Embedded Excalidraw sketches `[V1]`

### D · Your second brain — *everything you kept, in one place*
- Per-book notebook of highlights + saves `[MVP]`
- Search across all your notes `[V1]`
- Export to Notion / Obsidian / Markdown `[V1]`

### E · Retain — *the part most reading apps skip*
- Auto chapter summaries `[V1]`
- Spaced-repetition flashcards `[V2]`
- "Where was this introduced?" `[V2]`

### F · Share — *your annotated copy, handed to someone else*
- Snapshot share of your marked-up reading `[V2]`
- Study groups · teacher → student `[V2]`
- Live co-reading `[V2]`

*On the horizon, past V2:* cross-book Q&A ("compare Plato and Kant on the soul"), a concept map of the book, read-aloud audio, reading stats.

---

## 04 · The AI model

**Two axes: whose key, and which model.** The AI is a separate concern from the app. A user picks how it's fueled, and which model does the thinking — and always sees what it costs.

| Fuel | Pays for AI how | Sees usage? |
|---|---|---|
| **BYOK** | Their own key — their provider bills them directly | Yes — every request metered in-app |
| **Managed pool** | Buys our credits; we route through our keys, ~20–30% markup | Yes — same meter, plus balance |

**Model selection, via a gateway.** Rather than wiring each provider by hand, build on an **AI gateway (OpenRouter)**: one API exposes hundreds of models — GPT, Claude, Gemini and more — and returns the exact cost per request. A BYOK user can paste a provider key *or* their own OpenRouter key to unlock the full model list.

> **Per-mode routing (differentiator).** A quick term-lookup runs on a cheap, fast model; a deep Socratic dialogue runs on a powerful one. Set once, or auto-route. Saves the user money and makes the app feel smart.

**The usage meter — for everyone, including BYOK.** Every response returns token counts; multiply by the model's price and show *this chat ≈ $0.02 · today $0.34 · this month $4.10*, broken down by book and by model, with an optional budget alert. Works identically for BYOK and managed.

> **One honest limit.** For a BYOK key you can show usage **through the app**, but not their provider account's global balance ("$12 left on OpenAI") — no API exposes that from a normal key. Fine in practice: people care what they spent *reading*.

---

## 05 · Money

**You pay for the app. You pay for the AI. They're separate.** Making the app free for anyone who brings a key would be a mistake — they still use the servers, storage, and the whole reading experience. So: a flat subscription for the *Companion*, and AI as its own axis on top.

| Tier | What it is |
|---|---|
| **Trial** | A limited taste — time-boxed or capped (e.g. one book, no sync). The funnel, not a free tier. Nobody subscribes before they've felt the magic. |
| **Companion Pro** | ~$8–10/mo, paid by **everyone** incl. BYOK. Unlocks unlimited books, sync, notes, Excalidraw, flashcards, export, the saved-explanation library. |
| **+ AI axis** | BYOK (fuel it yourself) *or* managed credits (our pool, with markup). Chosen independently of the subscription. |

> **Principle — BYOK is not free.** It only means the user covers their own tokens; the Companion subscription still applies. Two revenue streams: subscriptions + credit markup. Avoid a flat "pay to open the app" wall; keep the trial friction-free at the top of funnel.

*None of this billing exists in the MVP — pricing is a V1 concern. Captured here only so the data model doesn't paint us into a corner.*

---

## 06 · Sharing

**Hand someone your annotated copy.** "Here's how I read this" is a growth engine — every shared link is a new reader walking in. Three modes, sequenced by cost:

| Mode | What it is |
|---|---|
| **Snapshot** `[V2]` | A frozen, read-only view of your book as you marked it up — highlights, notes, saved AI answers. Matches "share the current condition." Simple and viral. |
| **Fork** *(later)* | The recipient gets an editable copy to build on. Easy once snapshots exist. |
| **Live co-read** *(later)* | A book club annotating together in real time. Needs real-time sync + presence — a bigger build. |

> ⚠️ **Copyright — do not skip.** Share the **annotation layer**, never the raw PDF. Redistributing a copyrighted book file to other users is piracy, and it's the platform's liability. Safe design: the recipient brings their own copy; the app overlays the shared notes. Share files freely only for public-domain or user-owned content.

> **Why this shapes the build.** It forces a decision we want anyway: **annotations are a portable, first-class layer, separate from the PDF.** Once they're their own objects, sharing, export, and sync all fall out for free (see §07).

---

## 07 · Architecture

**The context engine is the hard, valuable part.** "Remembers everything you've read" can't mean "stuff the whole book into every prompt" — that's slow and expensive. Instead, assemble a focused context from three sources on every ask:

```
  [ Current page text        ]  (now)
  [ Rolling summary of pages ]  (behind you)   ─┐
  [ Retrieved chunks         ]  (anywhere,      ├─►  Grounded prompt  ─►  Model (gateway)  ─►  Answer + page citations
                                 semantic search)┘
```

- The **rolling summary** keeps the "whole book in mind" compact — updated as you finish sections.
- **Retrieval** (semantic search over the book) handles grounding and powers "where was this introduced."
- A **hard cap** on assembled context keeps cost predictable.

### Ingestion, once per book

```
  Upload PDF ─► Extract text/page ─► Chunk ─► Embed ─► Store in pgvector
```

### Data model — the entities that matter

| Entity | Holds |
|---|---|
| **Book** | File reference, title, page count, ingestion status, owner |
| **Chunk** | Book + page + text + embedding — the RAG index |
| **Annotation** | **The portable layer.** Type (highlight · note · sketch · saved-answer), text anchor, color, content, linked answer |
| **Conversation** | Messages, page context, model used, token usage + cost |
| **Share** | Snapshot of an annotation layer, access rule, permission |
| **UsageRecord** | Per-request tokens, model, cost — feeds the meter |
| **User / Subscription** | Account, encrypted BYOK keys, model prefs, plan status |

### System shape

```
  Client · PWA                        API                     Backend
  ┌──────────────────────────┐        ┌──────────────┐        ┌────────────────────────┐
  │ Reader (PDF.js)          │        │ App +        │        │ Postgres + pgvector     │
  │ Companion chat           │  ───►  │ context      │  ───►  │ Object storage (PDFs)   │
  │ Annotation layer         │        │ engine       │        │ AI gateway → providers  │
  └──────────────────────────┘        └──────────────┘        └────────────────────────┘
```

---

## 08 · Tech stack

*A stack a solo builder can move fast on.*

| Layer | Recommendation | Why |
|---|---|---|
| **Client** | Next.js (React, TypeScript) as a PWA + Tailwind | One codebase, desktop → mobile, installable without app stores |
| **PDF** | PDF.js / react-pdf | Renders pages *and* exposes the text layer — needed to anchor highlights and select-to-ask |
| **Sketching** | @excalidraw/excalidraw | Drop-in embeddable canvas, exactly the feature described |
| **Backend** | Next.js API routes / Node | Colocated with the client, simplest possible start |
| **Data · Auth · Files** | Supabase | Postgres + pgvector + Auth + Storage + Realtime in one — covers RAG, accounts, PDFs, future live-collab |
| **Embeddings** | text-embedding-3-small (or peer) → pgvector | Cheap, good enough for retrieval; no separate vector DB to run |
| **AI gateway** | OpenRouter | Many models via one API + per-request cost; powers BYOK and the managed pool alike |
| **Payments** | Stripe `[V1]` | Subscriptions + credit top-ups; not in the MVP |
| **Hosting** | Vercel + Supabase | Push-to-deploy, scales without ops work |

---

## 09 · MVP & roadmap

**Build the magic first. Everything else layers on.** The first version is **personal-first** — just you, no accounts, no billing. The fastest way to feel whether the core actually works.

**In the MVP**
- ✓ Upload a PDF, split-view reader
- ✓ Page-aware chat (BYOK, with model select)
- ✓ Select-to-ask on any passage
- ✓ Highlights
- ✓ Clip & save an AI answer to a highlight
- ✓ Basic per-book notebook
- ✓ Simple local / single-user persistence

**Deliberately out** — accounts & billing · managed AI pool · sharing · flashcards · Excalidraw · export · mobile polish

### Roadmap

| Phase 0 — MVP (the magic) | Phase 1 — Real product | Phase 2 — Network & recall |
|---|---|---|
| Reader + context engine | Accounts, trial, Companion Pro | Snapshot sharing |
| Page-aware chat + select-to-ask | Managed pool + usage dashboard | Flashcards + sync |
| Highlights + save-answer | Notes, Excalidraw, summaries | Live co-reading |
| BYOK, one gateway | Export + PWA / mobile polish | Cross-book Q&A, concept map |

---

## 10 · Risks & open questions

| Risk | Mitigation |
|---|---|
| **Copyright / redistribution** | Never share raw PDFs; share the annotation layer only; recipient brings their own copy. The one thing that could take the app down. |
| **BYOK key security** | Encrypt at rest (KMS / envelope), never log, never return to the client after entry |
| **Managed-pool cost runaway** | Hard credit balance, block at zero, per-user spend caps, per-model credit rates |
| **Context-window cost creep** | Rolling summary + retrieval caps; a hard ceiling on assembled context per request |

**Open questions**
- **Product name.** "PDF Companion" is a placeholder — candidates: *Gloss*, *Marginalia*, *Sidenote*, *Codex*, *Recto*.
- **Confirm personal-first MVP** (vs. building accounts from day one).
- **MVP provider** — start with OpenRouter-only, or a single direct provider?
- **Ingestion** — client-side PDF.js text extraction, or a server-side parser for messy/scanned PDFs (OCR)?

---

### → Next step

**Build the reader + context engine.** Confirm the personal-first MVP, then start with the split-view reader and the three-source context engine — the part that has to feel like magic before anything else matters.
