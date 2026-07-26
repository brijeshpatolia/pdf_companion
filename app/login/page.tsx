"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/adapters/supabase/browserClient.js";
import Icon from "../components/Icon";

function LoginForm() {
  const params = useSearchParams();
  const redirect = params.get("redirect") ?? "/";
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setStatus("sending");
    setError(null);
    try {
      const supabase = supabaseBrowser();
      const emailRedirectTo = `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`;
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: { emailRedirectTo },
      });
      if (error) throw error;
      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setError((err as Error).message);
    }
  }

  return (
    <main className="gate">
      <div className="gate-card">
        <Link href="/welcome" className="rail-brand gate-mark" aria-label="What Studiolo is">
          S
        </Link>
        <h1 className="gate-title">Studiolo</h1>
        <p className="gate-sub">
          A reading companion for hard books. Sign in and your library, highlights and answers are
          waiting the next time you open a book.
        </p>

        {status === "sent" ? (
          <div className="gate-sent fade-in" role="status">
            <span className="gate-sent-mark" aria-hidden="true">
              <Icon name="mail" size={20} />
            </span>
            <p>
              A sign-in link is on its way to <strong>{email}</strong>. You can close this tab.
            </p>
            <button className="btn-ghost btn-sm" onClick={() => setStatus("idle")}>
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="gate-form">
            <input
              className="input"
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              aria-label="Email address"
            />
            {/*
              Not disabled on an empty field. The button is the only marigold
              thing here, and rendering it dimmed the moment you arrive makes
              the page look broken rather than waiting — `required` already
              stops an empty submit.
            */}
            <button type="submit" className="btn-primary" disabled={status === "sending"}>
              {status === "sending" ? (
                <>
                  <span className="spinner" /> Sending link
                </>
              ) : (
                "Email me a sign-in link"
              )}
            </button>
            {error && (
              <p role="alert" style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>
                {error}
              </p>
            )}
            <p className="gate-fine">No password. One link, good once.</p>
          </form>
        )}
      </div>

      <Link href="/welcome" className="gate-back">
        What is this?
      </Link>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
