# Deploying to Vercel

This app is a Next.js (App Router) frontend backed by a **hosted Supabase**
project. Vercel runs the web app and the API routes; Supabase holds the
database, auth, and file storage. You need both.

> **Read the "Ingestion caveat" section at the bottom before you rely on this
> in production** — it's the one part that needs attention on serverless.

---

## 0. Make sure `main` is complete

Vercel deploys your **production branch** (`main`). Anything sitting in an
unmerged PR won't be live. Merge any open feature PRs first, so `main` has
everything you want deployed.

## 1. Create a hosted Supabase project

1. Go to <https://supabase.com> → **New project**. Pick a region close to your
   users and set a database password.
2. Wait for it to provision (~2 min).

## 2. Apply the database migrations

The schema — tables, RLS policies, the **pgvector** extension, the private
`pdfs` storage bucket, and the `match_chunks` / `match_chunks_all` retrieval
functions — lives in `supabase/migrations/`. Applying it enables pgvector and
creates the bucket for you, so there's nothing to click in the dashboard. Apply
it to the hosted project:

```bash
# from the repo root, with the Supabase CLI (it's a dev dependency)
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

`<your-project-ref>` is in your project's URL / **Project Settings → General**.
(Alternatively, paste each migration in order into the Supabase **SQL Editor**.)

Verify in the dashboard: **Table Editor** shows `books`, `chunks`, `messages`,
`saved_items`, `notes`, `flashcards`, `shares`, `reading_progress`,
`usage_records`, and `rolling_summaries`; **Storage** shows a private `pdfs`
bucket; **Database → Extensions** shows `vector` enabled.

## 3. Grab your keys and configure auth

From **Project Settings → API**:

- **Project URL** → `SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL`
- **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` *(server-only — never expose it)*

Then, under **Authentication → URL Configuration**, add your Vercel URLs to
**Redirect URLs** (you can add these now with a placeholder and fix the exact
domain after the first deploy):

- `https://<your-app>.vercel.app/auth/callback`
- (and any custom domain's `/auth/callback`)

**Email delivery:** magic-link sign-in emails go through Supabase's built-in
sender, which is **heavily rate-limited** and only meant for testing. For real
use, configure a custom SMTP provider under **Authentication → Emails → SMTP**
(Resend, Postmark, SES, etc.).

## 4. Get an AI key

Set **one** of these (Anthropic takes precedence if both are present):

- `ANTHROPIC_API_KEY` — from <https://console.anthropic.com>
- `OPENROUTER_API_KEY` — from <https://openrouter.ai>

**That key is yours, and every reader spends against it.** So each reader has a
rolling budget: **$1 per 24 hours** and **$10 per 30 days** by default. Past
either ceiling, chat, cross-book Ask, and flashcard generation return a clear
"you've used your budget" message instead of quietly running up your bill; the
usage dashboard shows the remaining headroom before anyone gets there.

Override with `USAGE_DAILY_LIMIT_USD` and `USAGE_MONTHLY_LIMIT_USD`. Setting one
to `0` removes that ceiling — reasonable for a solo deployment, unwise for one
you've shared. A malformed value falls back to the default rather than to
unlimited, so a typo can't silently uncap you.

## 5. Import the repo into Vercel

1. Push `main` to GitHub (already there).
2. <https://vercel.com> → **Add New → Project** → import this repo.
3. Framework preset auto-detects **Next.js**. Leave build/output settings at
   their defaults — the `postinstall` step copies the PDF worker into `public/`
   automatically during the build.
4. Under **Environment Variables**, add all of these (see `.env.example`):

   | Variable | Value |
   | --- | --- |
   | `SUPABASE_URL` | Supabase Project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
   | `ANTHROPIC_API_KEY` *or* `OPENROUTER_API_KEY` | your AI key |

5. **Deploy.**

## 6. Point auth at the real domain

After the first deploy, copy your production URL (e.g.
`https://pdf-companion.vercel.app`) and make sure that exact
`https://<domain>/auth/callback` is in Supabase's **Redirect URLs** (Step 3).
Redeploy isn't needed for that change.

## 7. Smoke-test the live app

1. Open the site → you're redirected to `/login`.
2. Enter your email → check your inbox → click the magic link → you land in the
   library.
3. **Browse free books → add one** (e.g. *Meditations*). Watch it go
   `Processing → Ready`.
4. Open it, ask the companion a question, highlight a passage, write a note.
5. Check **Usage & cost** — your question should show up.
6. Open **🃏 Flashcards** → *Generate from what you kept* → flip through the deck.
7. In the companion's **Saved** tab, **🔗 Share book**, copy the link, and open
   it in a private window — you should see your kept items with no sign-in.
8. From the library, **🔎 Ask your library** and ask a question that spans your
   books; the cited sources should deep-link to the exact page.

If all of that works, every subsystem — auth + RLS, storage, ingestion,
retrieval, chat, capture, dashboard, flashcards, sharing, and cross-book Q&A —
is live.

---

## ⚠️ Ingestion caveat (read this)

Ingestion — the step that turns an uploaded/added book into searchable chunks —
runs the **embedding model (`bge-small-en-v1.5`) in-process** inside the
`/api/ingest` serverless function. The embedder uses the **quantized (q8, ~23 MB)**
model precisely so it fits inside serverless memory limits (e.g. Vercel Hobby's
1 GB), so books ingest fine on the free tier.

**Book length is not a limit.** A serverless function is capped at
`maxDuration = 60`, which a few hundred pages will happily blow through, so
ingestion is **batched and resumable**. Pages are embedded 25 at a time, and the
run checks its 40-second budget *before* starting each batch. When the budget is
gone it leaves the book `processing`, reports how far it got, and `/api/ingest`
re-invokes itself for another pass with a fresh budget. Each stored chunk is the
record that its page is done, so the next pass skips what's already embedded —
nothing is lost and nothing is redone. An 879-page book simply takes several
passes.

Two things are worth knowing:

- **Memory / cold starts.** The model is loaded per cold start and its cache is
  ephemeral, so it re-downloads each cold start. `vercel.json` in this repo
  requests more memory for the heavy functions, **but memory above 1 GB requires
  the Vercel Pro plan.**
- **A stalled book is recoverable.** If a pass is lost (a cold start that never
  finishes, a deploy mid-ingestion), the library shows a **Resume** button next
  to any book still processing. It continues from the pages already embedded —
  there's never a reason to delete and re-upload.

At real scale the right move is still to **take embeddings off the request
path**: run them in a Supabase Edge Function or a queue/worker, or swap the local
embedder for a hosted embedding API, so the web functions stay light.

(The precision is set in `src/adapters/embedder/localEmbedder.ts` — raise it back
to `dtype: "fp32"` if you want maximum embedding quality and have the memory.)

Everything else in the app — reader, chat streaming, catalog search, auth,
dashboard, notes — is ordinary Next.js and deploys without special handling.

## Re-indexing after an embedding-model change

Vectors from two models are not comparable — they are points in unrelated
spaces that happen to share a number of axes. `chunks.embedding_model` records
which model produced each row, and both search functions filter on it, so a
book that has not been re-indexed simply returns nothing rather than nonsense.

Nothing re-indexes automatically. A mass re-embed of every book in the system
is a lot of function-minutes to trigger from a deploy, so it is a decision you
make, per book or all at once, by putting books back into `processing`:

```sql
-- All books whose chunks predate the current model.
update public.books set status = 'processing'
where id in (
  select distinct book_id from public.chunks
  where embedding_model <> 'Xenova/bge-small-en-v1.5'
);
```

The library then shows them as processing with a **Resume** control, and the
ordinary self-continuing ingestion re-embeds each one from page 1 — pages
carrying the old model's vectors read as not-yet-done, so no special path is
involved. Highlights, notes, saved answers and reading progress are keyed to
page numbers, not to chunks, and are untouched.

Until a book is re-indexed its chat and library search find nothing in it. If
you would rather stage that, update the books a few at a time.
