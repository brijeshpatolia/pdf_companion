import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseUser } from "@/adapters/supabase/userClient.js";

export const runtime = "nodejs";

/**
 * Magic-link landing point. Handles both shapes a sign-in link can arrive in:
 *
 * - `?code=…` (PKCE) — the sign-in started in *this* browser, so the matching
 *   `code_verifier` cookie is present and we exchange it directly.
 * - `?token_hash=…&type=…` — for links minted outside this browser (the admin
 *   `generate_link` API, or an email template using `{{ .TokenHash }}`). There's
 *   no verifier to pair with, so we verify the one-time token itself.
 *
 * Either path ends with session cookies set; then we forward the user on.
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const redirect = searchParams.get("redirect") ?? "/";
  // Only allow same-site relative redirects.
  const safeRedirect = redirect.startsWith("/") ? redirect : "/";

  const fail = (message: string) =>
    NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(message)}`);

  // Supabase reports a rejected link (expired, already used) on the query string.
  const providerError = searchParams.get("error_description") ?? searchParams.get("error");
  if (providerError) return fail(providerError);

  if (code) {
    const supabase = await supabaseUser();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail(error.message);
    return NextResponse.redirect(`${origin}${safeRedirect}`);
  }

  if (tokenHash && type) {
    const supabase = await supabaseUser();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) return fail(error.message);
    return NextResponse.redirect(`${origin}${safeRedirect}`);
  }

  return fail("missing-code");
}
