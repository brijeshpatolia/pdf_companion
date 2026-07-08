# Local development

## Prerequisites

- Node 20+ and npm
- Docker Desktop running (for local Supabase)
- Supabase CLI is a dev dependency — invoke it with `npx supabase`

## Setup

```bash
npm install
npx supabase start      # first run pulls ~2-4 GB of images; cached after
```

`supabase start` applies the migrations in `supabase/migrations/` automatically,
including the `books` table and the private `pdfs` storage bucket.

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
