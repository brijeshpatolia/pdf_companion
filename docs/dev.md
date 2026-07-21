# Local development

## Prerequisites

- Node 20+ and npm
- Docker Desktop running (for local Supabase)
- Supabase CLI is a dev dependency — invoke it with `npx supabase`

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npx supabase start           # first run pulls ~2-4 GB of images; cached after
```

`supabase start` applies the migrations in `supabase/migrations/` automatically,
including the `books` table, the private `pdfs` storage bucket, and the
Row-Level Security policies that scope every row to its owner.

After `supabase start`, populate `.env.local` from `npx supabase status`:

- `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` → the **API URL**
- `SUPABASE_SERVICE_ROLE_KEY` → the **service_role key** (server-only)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` → the **anon key** (safe for the browser)

## Auth (magic link)

Sign-in is passwordless: the login page emails a one-time link that lands on
`/auth/callback` and establishes the session. Access is gated by `middleware.ts`,
and every data route runs as the signed-in user so RLS enforces ownership.

Local Supabase captures outbound email instead of sending it — open **Inbucket**
at the URL shown by `npx supabase status` (default <http://127.0.0.1:54324>) to
click the magic link. No SMTP setup is needed for local dev.

On a hosted Supabase project you'll need to add your app's `/auth/callback` URL
under **Authentication → URL Configuration → Redirect URLs**, and configure an
SMTP sender for real email delivery.

## Tests

Unit tests need nothing but Node — they run against injected fakes:

```bash
npm test
```

The Supabase **integration** test is skipped unless the local stack's URL + key
are exported (so `npm test` stays green without Docker):

```bash
eval "$(npx supabase status -o env | grep -E 'API_URL|SERVICE_ROLE_KEY' \
  | sed 's/^/export SUPABASE_/; s/API_URL/URL/')"
npm test        # now includes the integration test
```

`SUPABASE_SERVICE_ROLE_KEY` for local dev is the well-known Supabase demo key —
not a secret.

## Gotcha: `supabase db reset` desyncs the stack

`db reset` swaps the Postgres DB out from under the running `storage`/`kong`
containers, which leaves Kong routing to a stale storage upstream — uploads then
hang. If you edit a migration and need to re-apply it, follow the reset with a
full restart so internal networking is consistent:

```bash
npx supabase db reset && npx supabase stop && npx supabase start
```
