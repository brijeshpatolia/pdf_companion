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

### Browser tests

A few things are only *behaviour* in a real browser: text selection, the order
DOM events arrive in, whether a click is dispatched at all, and whether
something is actually on screen. jsdom models none of it. Two suites cover it:

```bash
npx playwright install chromium   # once
npm run test:browser              # components, mounted in isolation
npm run test:e2e                  # whole pages, at phone size
```

`test:e2e` starts its own dev server with the Supabase variables blanked.
That's deliberate: `middleware.ts` doesn't gate anything when auth isn't
configured, so every route is reachable without standing up a database, and
the API is stubbed per test. Routes whose *server* component needs Supabase —
the reader, the share page — can't be reached that way, and are covered by
component tests instead.

They're component tests rather than end-to-end because the alternative — a
signed-in session, a stored book and a rendered PDF before you can select a
word — is a lot of moving parts to stand up in order to test event plumbing.
Mounting the component keeps the test about the thing that breaks, and keeps
the harness out of the app: nothing test-only is shipped to production.

The fixture lives in `tests/component/`. `SelectionHarness.tsx` reproduces just
enough of the reader's book pane for the popover to position itself against,
and records what its callbacks receive; the spec drives a real mouse drag over
real prose.

If Playwright's browser download is unavailable but a compatible Chromium is
already on the machine, point at it:

```bash
PLAYWRIGHT_CHROMIUM_PATH=/path/to/chrome npm run test:browser
```

**Why this exists.** Three things shipped broken and were found by a person,
not a test run.

The selection popover broke twice: first the browser's own selection menu
opened on top of it, then the fix for that cleared the selection on mouseup,
which made the popover unmount between `mouseup` and `click` so every action in
it silently did nothing.

Then the whole mobile layout — the nav bar sat exactly one viewport below the
fold, and the reader's top bar stretched the document wider than the screen.
Neither was catchable by the checks in place, because those were full-page
screenshots: they capture the whole *document*, so anything pushed past the
viewport still appears in them, looking fine.

That's why the assertions here are about the **viewport** — `toBeInViewport`,
`scrollWidth` against `clientWidth`, measured tap targets — rather than about
the document. Every one of them was confirmed to fail against the broken code
before being kept; a regression test that passes on the bug is decoration.

### Applying a new migration

`supabase/migrations/` is applied automatically by `npx supabase start` locally.
A hosted project needs it pushed (`npx supabase db push`, or the SQL editor).

Until `20260726120000_library_messages.sql` is applied, Ask-your-library still
answers — it just can't remember. The reads fail closed to an empty thread and
the writes are best-effort, so a missing table costs you the history and
nothing else.

### Installing it (PWA)

The app is installable: `app/manifest.ts` describes it, `scripts/make-icons.mjs`
draws the icons (`npm run icons` after editing), and `public/sw.js` is a
deliberately small service worker.

The worker exists to make the app installable — Chrome wants a fetch handler
before it offers "add to home screen" — and to make an offline tab say
something true instead of showing the browser's error page. It is **not** an
offline reading mode; books live in Supabase behind auth.

Its caching rules are chosen so a stale cache can never serve stale app code:
`/_next/static/` is content-hashed and therefore safe to cache forever, and
everything else goes to the network first. It only registers in production
builds, so it can't make your edits appear not to take.

## Gotcha: `supabase db reset` desyncs the stack

`db reset` swaps the Postgres DB out from under the running `storage`/`kong`
containers, which leaves Kong routing to a stale storage upstream — uploads then
hang. If you edit a migration and need to re-apply it, follow the reset with a
full restart so internal networking is consistent:

```bash
npx supabase db reset && npx supabase stop && npx supabase start
```
