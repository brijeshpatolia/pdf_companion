import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Request-scoped Supabase client bound to the caller's session cookie
 * (anon key). Queries run *as the authenticated user*, so Row-Level
 * Security enforces per-user ownership. Use this in route handlers and
 * server components for all user-facing data access.
 *
 * The trusted background ingestion job uses `supabaseServer()` (service
 * role) instead, since it runs without a user session.
 */
export async function supabaseUser(): Promise<SupabaseClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set (see .env.example)",
    );
  }

  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component where cookies are read-only;
          // the middleware refreshes the session cookie instead.
        }
      },
    },
  });
}

/** Returns the authenticated user, or null if the request has no session. */
export async function currentUser() {
  const client = await supabaseUser();
  const {
    data: { user },
  } = await client.auth.getUser();
  return user;
}
