# PDF Companion 📖

> An AI that reads with you — always on your page, holding the whole book in mind.

A reading companion for hard books. Instead of pausing to paste a page into ChatGPT — or Googling a term with none of the book's context — the AI sits beside the page you're on, **remembers everything you've read**, and answers grounded in the book itself. Ask, highlight, sketch, and keep the explanations worth keeping.

**Status:** 📝 Spec / pre-build · Draft v0.1

## 📄 Full spec

The complete product spec lives in **[SPEC.md](./SPEC.md)** — problem, feature map, AI & pricing model, sharing, architecture, tech stack, MVP scope, and roadmap. A polished web version is in [`pdf-companion-spec.html`](./pdf-companion-spec.html).

## The idea, in three moves

- **Ask in context** — select any passage, get an answer grounded in the book so far.
- **Capture** — highlight, note, sketch, and clip the AI answers worth keeping.
- **Retain** — chapter summaries and flashcards built from what you kept.

## Planned stack

Next.js (PWA) · PDF.js · Supabase (Postgres + pgvector + Auth + Storage) · OpenRouter (multi-model AI gateway) · Excalidraw · Stripe *(later)*

## Roadmap

- **Phase 0 — MVP:** split-view reader + page-aware chat + select-to-ask + highlights + save-AI-answer (personal, BYOK)
- **Phase 1:** accounts, managed AI pool + usage dashboard, notes, Excalidraw, export
- **Phase 2:** sharing, flashcards, sync, live co-reading, cross-book Q&A

---

*Working name — candidates: Gloss · Marginalia · Sidenote · Codex · Recto.*
