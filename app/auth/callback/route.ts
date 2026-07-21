import { NextResponse, type NextRequest } from "next/server";
import { supabaseUser } from "@/adapters/supabase/userClient.js";

export const runtime = "nodejs";

/**
 * Magic-link landing point. Supabase emails a link back here with a `code`;
 * we exchange it for a session (which sets the auth cookies) and forward the
 * user to wherever they were headed.
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const redirect = searchParams.get("redirect") ?? "/";
  // Only allow same-site relative redirects.
  const safeRedirect = redirect.startsWith("/") ? redirect : "/";

  if (code) {
    const supabase = await supabaseUser();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${safeRedirect}`);
    }
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
  }

  return NextResponse.redirect(`${origin}/login?error=missing-code`);
}
