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
    <main className="gate">
      <div className="gate-card">
        <span className="gate-sent-mark" aria-hidden="true">
          <Icon name="users" size={20} />
        </span>
        <h1 className="gate-title">Bring your own copy</h1>
        <p className="gate-sub">
          You&apos;ve been invited to read <strong style={{ color: "var(--text-100)" }}>{room.bookTitle}</strong>{" "}
          with someone — but it isn&apos;t on your shelf yet.
        </p>
        <p className="gate-sub">
          Everyone in a room reads their own copy. What travels between you is the page you&apos;re on
          and what you mark, never the book file.
        </p>
        <div className="gate-actions">
          <Link href={`/catalog?q=${encodeURIComponent(room.bookTitle)}`} className="btn-primary btn-sm">
            Find it in the catalog
          </Link>
          <Link href="/" className="btn-ghost btn-sm">
            <Icon name="arrow-left" /> Library
          </Link>
        </div>
        <p className="gate-fine" style={{ textAlign: "left" }}>
          Come back to this link once it&apos;s ready.
        </p>
      </div>
    </main>
  );
}

function Problem({ message }: { message: string }) {
  return (
    <main className="gate">
      <div className="gate-card">
        <h1 className="gate-title" style={{ marginTop: 0 }}>
          Reading room
        </h1>
        <p className="gate-sub">{message}</p>
        <div className="gate-actions">
          <Link href="/" className="btn-ghost btn-sm">
            <Icon name="arrow-left" /> Library
          </Link>
        </div>
      </div>
    </main>
  );
}
