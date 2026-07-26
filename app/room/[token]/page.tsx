import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseUser } from "@/adapters/supabase/userClient.js";
import { supabaseServer } from "@/adapters/supabase/serverClient.js";
import { supabaseRooms } from "@/adapters/supabase/supabaseRooms.js";
import { isValidTokenFormat } from "@/core/sharing/token.js";
import { findOwnCopy } from "@/core/rooms/matchBook.js";
import Icon from "../../components/Icon";

export const runtime = "nodejs";

export const metadata = { title: "Join a reading room" };

/**
 * Following a room link.
 *
 * The app never redistributes book files, so joining means reading *your own*
 * copy alongside everyone else. If you have the book, this bounces straight
 * into the reader with the room attached. If you don't, it says which book to
 * bring and points at the free catalog rather than dead-ending.
 */
export default async function JoinRoomPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isValidTokenFormat(token)) return <Problem message="That room link isn't valid." />;

  const client = await supabaseUser();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect(`/login?redirect=/room/${token}`);

  // Resolved with the service-role client: a joiner doesn't own the host's book.
  const room = await supabaseRooms(supabaseServer()).getByToken(token);
  if (!room) {
    return <Problem message="This reading room has ended, or the link is wrong." />;
  }

  const { data: books } = await client.from("books").select("id, title, status");
  const ready = ((books ?? []) as { id: string; title: string; status: string }[]).filter(
    (b) => b.status === "ready",
  );
  const own = findOwnCopy(ready, room.bookTitle);

  if (own) redirect(`/reader/${own.id}?room=${token}`);

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "3rem 1.25rem" }}>
      <h1 className="wordmark" style={{ fontSize: "1.6rem", marginBottom: "0.5rem" }}>
        Join the reading
      </h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        You&apos;ve been invited to read <strong style={{ color: "var(--text)" }}>{room.bookTitle}</strong> with
        someone.
      </p>

      <div className="card" style={{ padding: "1.25rem", marginTop: "1.5rem" }}>
        <p style={{ marginTop: 0 }}>
          You don&apos;t have this book yet. Everyone in a room reads their own copy — the app shares
          notes and highlights, never the book file itself.
        </p>
        <p style={{ color: "var(--muted)", fontSize: "0.88rem" }}>
          If it&apos;s in the public-domain catalog, adding it takes one click. Come back to this link
          once it&apos;s ready.
        </p>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "1rem" }}>
          <Link
            href={`/catalog?q=${encodeURIComponent(room.bookTitle)}`}
            className="btn-ghost btn-sm"
          >
            Find it in the catalog
          </Link>
          <Link href="/" className="btn-ghost btn-sm">
            <Icon name="arrow-left" /> Library
          </Link>
        </div>
      </div>
    </main>
  );
}

function Problem({ message }: { message: string }) {
  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "3rem 1.25rem" }}>
      <h1 className="wordmark" style={{ fontSize: "1.4rem", marginBottom: "0.5rem" }}>
        Reading room
      </h1>
      <p style={{ color: "var(--muted)" }}>{message}</p>
      <Link href="/" className="btn-ghost btn-sm">
        <Icon name="arrow-left" /> Library
      </Link>
    </main>
  );
}
