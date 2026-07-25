import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Paths reachable without a session. `/api/ingest` is here on purpose:
 * it's a trusted background job keyed by an unguessable book UUID and
 * called server-to-server (no cookies), so it can't carry a session.
 * `/share` is the public read-only view of a book's kept material, gated by
 * its own unguessable token rather than a session.
 */
const PUBLIC_PATHS = ["/login", "/auth", "/api/ingest", "/share"];

function isPublic(path: string): boolean {
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Without auth configured (e.g. CI build), don't gate anything.
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Refreshes the session and tells us who (if anyone) is signed in.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  if (!user && !isPublic(path)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = `?redirect=${encodeURIComponent(path)}`;
    return NextResponse.redirect(redirectUrl);
  }

  if (user && path === "/login") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except Next internals and public static assets.
    "/((?!_next/static|_next/image|favicon.ico|pdf.worker.min.mjs|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
