"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/adapters/supabase/browserClient.js";

/** Shows the signed-in email with a sign-out control. */
export default function AuthButton() {
  const [email, setEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    try {
      supabaseBrowser()
        .auth.getUser()
        .then(({ data }) => {
          if (!cancelled) setEmail(data.user?.email ?? null);
        })
        .catch(() => {});
    } catch {
      // Auth env not configured — render nothing.
    }
    return () => {
      cancelled = true;
    };
  }, []);

  async function signOut() {
    setBusy(true);
    try {
      await supabaseBrowser().auth.signOut();
    } catch {}
    window.location.href = "/login";
  }

  if (!email) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", fontSize: "0.85rem" }}>
      <span style={{ color: "var(--muted)", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {email}
      </span>
      <button className="btn-ghost btn-sm" onClick={signOut} disabled={busy}>
        {busy ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
