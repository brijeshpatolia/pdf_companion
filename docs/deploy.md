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

The schema (tables, RLS policies, the `pdfs` storage bucket, the
`match_chunks` function) lives in `supabase/migrations/`. Apply it to the
hosted project:

```bash
# from the repo root, with the Supabase CLI (it's a dev dependency)
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

`<your-project-ref>` is in your project's URL / **Project Settings → General**.
(Alternatively, paste each migration in order into the Supabase **SQL Editor**.)

Verify in the dashboard: **Table Editor** shows `books`, `chunks`, `messages`,
`saved_items`, `notes`, `reading_progress`, `usage_records`, and
`rolling_summaries`; **Storage** shows a private `pdfs` bucket.

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

If all of that works, every subsystem (auth + RLS, storage, ingestion,
retrieval, chat, capture, dashboard) is live.

---

## ⚠️ Ingestion caveat (read this)

Ingestion — the step that turns an uploaded/added book into searchable chunks —
runs the **embedding model (`all-MiniLM-L6-v2`) in-process** inside the
`/api/ingest` serverless function. The embedder uses the **quantized (q8, ~23 MB)**
model precisely so it fits inside serverless memory limits (e.g. Vercel Hobby's
1 GB), so small and medium books ingest fine on the free tier. Two limits still
apply for very large books:

- **Memory / cold starts.** The model is loaded per cold start and its cache is
  ephemeral, so it re-downloads each cold start. `vercel.json` in this repo
  requests more memory for the heavy functions, **but memory above 1 GB requires
  the Vercel Pro plan.**
- **Time.** The function is capped at `maxDuration = 60` (Hobby/Pro allow up to
  60/300 s). A very large book (hundreds of pages) embedded sequentially can
  exceed that.

If you hit OOM or timeouts on big books, in order of effort:

1. **Upgrade to Vercel Pro** and keep the `vercel.json` memory/duration bumps.
2. **Move embeddings off the request path** (the real fix at scale): run them in
   a Supabase Edge Function or a queue/worker, or swap the local embedder for a
   hosted embedding API. This keeps the web functions light.

(The precision is set in `src/adapters/embedder/localEmbedder.ts` — raise it back
to `dtype: "fp32"` if you want maximum embedding quality and have the memory.)

Everything else in the app — reader, chat streaming, catalog search, auth,
dashboard, notes — is ordinary Next.js and deploys without special handling.
