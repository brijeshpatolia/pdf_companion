"use client";

import { Suspense, useState } from "react";
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
    <main
      style={{
        // Centred in the viewport rather than pinned to the top — a sign-in
        // page with one field shouldn't leave two thirds of the screen empty.
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        maxWidth: 380,
        margin: "0 auto",
        padding: "2rem 1.25rem",
      }}
    >
      <h1 className="wordmark" style={{ fontSize: "1.9rem", marginBottom: "0.25rem" }}>
        PDF Companion
      </h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        An AI that reads with you. Sign in to keep your library, highlights, and chats.
      </p>

      {status === "sent" ? (
        <div className="card fade-in" style={{ padding: "1.25rem", marginTop: "1.5rem" }}>
          <p style={{ margin: 0, fontSize: "1.4rem" }}><Icon name="mail" />️</p>
          <p style={{ margin: "0.5rem 0 0" }}>
            Check <strong>{email}</strong> for a sign-in link. You can close this tab.
          </p>
          <button
            className="btn-ghost btn-sm"
            style={{ marginTop: "0.75rem" }}
            onClick={() => setStatus("idle")}
          >
            Use a different email
          </button>
        </div>
      ) : (
        <form onSubmit={onSubmit} style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          <input
            className="input"
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            aria-label="Email address"
            style={{ fontSize: "1rem", padding: "0.6rem 0.75rem" }}
          />
          <button
            type="submit"
            className="btn-primary"
            disabled={status === "sending" || !email.trim()}
            style={{ padding: "0.6rem", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
          >
            {status === "sending" ? (
              <>
                <span className="spinner" /> Sending link…
              </>
            ) : (
              "Email me a sign-in link"
            )}
          </button>
          {error && (
            <p role="alert" style={{ color: "var(--danger)", fontSize: "0.85rem", margin: 0 }}>
              {error}
            </p>
          )}
          <p style={{ color: "var(--faint)", fontSize: "0.78rem", marginTop: "0.25rem" }}>
            No password needed — we&apos;ll email you a one-time link.
          </p>
        </form>
      )}
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
